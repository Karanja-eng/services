"""
Persistent identity mapping between engineering elements, CAD entities and IFC
elements.

Problem this solves
-------------------
A Fundi element exists in at least three representations at once:

    canonical element (internal_id)
        |-- DXF entity (per-file handle, on a given layer, in a given drawing)
        `-- IFC element (GlobalId, in a given .ifc file)

None of those identifiers is durable: DXF handles are reassigned on re-export,
IFC GlobalIds differ between exporters unless derived (this project derives them
from ``internal_id``, see ``identity.py``), and elements get deleted or copied.
Storing "the link" in viewer state would lose it on refresh.

This module persists the mapping in SQLite (stdlib only, no server needed), which
is the same storage technology the existing backend already uses for the
geotechnical database (``soil_mechanics.db``).

State machine per link
----------------------
``ok``            in sync with the current model
``regenerated``   geometry changed and was re-exported
``deleted``       the element no longer exists in the canonical model
``stale``         the link exists but the file no longer contains the entity
``conflict``      the file was modified outside Fundi *and* the model changed;
                  automatic overwrite is refused
``unit_mismatch`` the DXF was re-scaled behind our back

Recovery
--------
The DXF carries the internal id in XDATA, and IFC carries it in
``Pset_FundiIdentity``. Either file can therefore rebuild the SQLite mapping with
``rebuild_from_dxf`` / ``rebuild_from_ifc`` after data loss.
"""

from __future__ import annotations

import json
import os
import sqlite3
from typing import Any, Dict, Iterable, List, Optional

from . import identity, units

STATUS_OK = "ok"
STATUS_REGENERATED = "regenerated"
STATUS_DELETED = "deleted"
STATUS_STALE = "stale"
STATUS_CONFLICT = "conflict"
STATUS_UNIT_MISMATCH = "unit_mismatch"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS fundi_models (
    model_id      TEXT PRIMARY KEY,
    generator     TEXT NOT NULL,
    revision      INTEGER NOT NULL,
    model_hash    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fundi_drawings (
    drawing_id    TEXT PRIMARY KEY,
    model_id      TEXT NOT NULL,
    dxf_path      TEXT NOT NULL,
    insunits      INTEGER NOT NULL,
    file_size     INTEGER NOT NULL,
    file_mtime    REAL NOT NULL,
    exported_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fundi_artifacts (
    artifact_id   TEXT PRIMARY KEY,
    model_id      TEXT NOT NULL,
    kind          TEXT NOT NULL,
    path          TEXT NOT NULL,
    file_size     INTEGER NOT NULL,
    file_mtime    REAL NOT NULL,
    exported_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fundi_element_links (
    model_id      TEXT NOT NULL,
    internal_id   TEXT NOT NULL,
    ifc_guid      TEXT,
    ifc_class     TEXT,
    dxf_handle    TEXT,
    drawing_id    TEXT,
    layer         TEXT,
    fingerprint   TEXT,
    unit_scale    REAL,
    status        TEXT NOT NULL,
    note          TEXT,
    updated_at    TEXT NOT NULL,
    PRIMARY KEY (model_id, internal_id)
);

CREATE INDEX IF NOT EXISTS ix_links_ifc_guid ON fundi_element_links(model_id, ifc_guid);
CREATE INDEX IF NOT EXISTS ix_links_handle   ON fundi_element_links(drawing_id, dxf_handle);
"""


def connect(db_path: str) -> sqlite3.Connection:
    """Open (and initialise) the mapping database."""
    directory = os.path.dirname(os.path.abspath(db_path))
    if directory:
        os.makedirs(directory, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.executescript(_SCHEMA)
    conn.commit()
    return conn


def _utcnow() -> str:
    import datetime as _dt

    return _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds")


# ---------------------------------------------------------------------------
# Model / artifact registration
# ---------------------------------------------------------------------------


def register_model(conn: sqlite3.Connection, model_doc: Dict[str, Any], model_hash: str) -> int:
    """Insert or bump the model revision; returns the new revision number."""
    from . import septic_model

    row = conn.execute(
        "SELECT revision FROM fundi_models WHERE model_id = ?", (model_doc["model_id"],)
    ).fetchone()
    revision = (row["revision"] + 1) if row else 1
    conn.execute(
        """
        INSERT INTO fundi_models(model_id, generator, revision, model_hash, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(model_id) DO UPDATE SET
            generator = excluded.generator,
            revision = excluded.revision,
            model_hash = excluded.model_hash,
            updated_at = excluded.updated_at
        """,
        (model_doc["model_id"], model_doc.get("generator", ""), revision, model_hash, _utcnow()),
    )
    conn.commit()
    return revision


def register_artifact(conn: sqlite3.Connection, model_id: str, kind: str, path: str) -> None:
    """Record a generated file so external modification can be detected."""
    stat = os.stat(path)
    conn.execute(
        """
        INSERT INTO fundi_artifacts(artifact_id, model_id, kind, path, file_size, file_mtime, exported_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(artifact_id) DO UPDATE SET
            path = excluded.path, file_size = excluded.file_size,
            file_mtime = excluded.file_mtime, exported_at = excluded.exported_at
        """,
        (f"{model_id}:{kind}", model_id, kind, path, stat.st_size, stat.st_mtime, _utcnow()),
    )
    conn.commit()


def file_modified_externally(conn: sqlite3.Connection, model_id: str, kind: str) -> bool:
    """True when the artifact changed on disk since Fundi wrote it."""
    row = conn.execute(
        "SELECT path, file_size, file_mtime FROM fundi_artifacts WHERE artifact_id = ?",
        (f"{model_id}:{kind}",),
    ).fetchone()
    if row is None:
        return False
    if not os.path.exists(row["path"]):
        return True
    stat = os.stat(row["path"])
    return (
        stat.st_size != row["file_size"]
        or abs(stat.st_mtime - row["file_mtime"]) > 1.0
    )


def register_drawing(conn: sqlite3.Connection, drawing_id: str, model_id: str,
                     dxf_path: str, insunits: int) -> None:
    stat = os.stat(dxf_path)
    conn.execute(
        """
        INSERT INTO fundi_drawings(drawing_id, model_id, dxf_path, insunits, file_size, file_mtime, exported_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(drawing_id) DO UPDATE SET
            model_id = excluded.model_id, dxf_path = excluded.dxf_path,
            insunits = excluded.insunits, file_size = excluded.file_size,
            file_mtime = excluded.file_mtime, exported_at = excluded.exported_at
        """,
        (drawing_id, model_id, dxf_path, insunits, stat.st_size, stat.st_mtime, _utcnow()),
    )
    conn.commit()


# ---------------------------------------------------------------------------
# Link synchronisation
# ---------------------------------------------------------------------------


def existing_links(conn: sqlite3.Connection, model_id: str) -> Dict[str, sqlite3.Row]:
    rows = conn.execute(
        "SELECT * FROM fundi_element_links WHERE model_id = ?", (model_id,)
    ).fetchall()
    return {row["internal_id"]: row for row in rows}


def sync_links(
    conn: sqlite3.Connection,
    model_doc: Dict[str, Any],
    *,
    drawing_id: str,
    dxf_links: Iterable[Dict[str, Any]],
    ifc_guids: Dict[str, str],
    ifc_conflict: bool = False,
) -> Dict[str, Any]:
    """Reconcile stored links with a freshly exported DXF/IFC pair.

    ``dxf_links`` are the entries read back from the written DXF, so the handles
    recorded are the ones a CAD application will report. ``ifc_guids`` maps
    internal id -> GlobalId from the written IFC.
    """
    model_id = model_doc["model_id"]
    # An element may be drawn in several views (plan, section). The plan view is
    # the canonical CAD handle; other views are kept for traceability below.
    by_internal_id: Dict[str, Dict[str, Any]] = {}
    views_by_internal_id: Dict[str, List[str]] = {}
    duplicates: List[str] = []
    seen: Dict[tuple, int] = {}
    for link in dxf_links:
        internal_id = link["internal_id"]
        view = link.get("view") or "plan"
        key = (view, internal_id)
        seen[key] = seen.get(key, 0) + 1
        if seen[key] > 1:
            duplicates.append(f"{view}:{internal_id}")
        views_by_internal_id.setdefault(internal_id, []).append(view)
        existing = by_internal_id.get(internal_id)
        if existing is None or (view == "plan" and existing.get("view") != "plan"):
            by_internal_id[internal_id] = link

    previous = existing_links(conn, model_id)
    current_ids = {element["id"] for element in model_doc["elements"]}
    now = _utcnow()
    counts = {"added": 0, "updated": 0, "unchanged": 0, "deleted": 0,
              "stale": 0, "conflict": 0, "unit_mismatch": 0, "duplicates": len(duplicates)}
    conflicts: List[Dict[str, Any]] = []
    expected_scale = units.conversion_factor(units.CANONICAL_LENGTH_UNIT, units.DXF_LENGTH_UNIT)

    for element in model_doc["elements"]:
        internal_id = element["id"]
        link = by_internal_id.get(internal_id)
        prior = previous.get(internal_id)
        fingerprint = element["fingerprint"]
        status = STATUS_OK
        note: Optional[str] = None

        if link is None:
            status = STATUS_STALE
            note = "element is absent from the DXF (no XDATA match)"
        elif "plan" not in views_by_internal_id.get(internal_id, []):
            # The plan view is the authoritative CAD representation of an
            # element; a surviving section entity alone is not enough.
            status = STATUS_STALE
            note = ("plan view entity missing (element only present in: "
                    + ", ".join(sorted(views_by_internal_id.get(internal_id, []))) + ")")
        elif abs(float(link["unit_scale"]) - expected_scale) > units.TOLERANCE_MM:
            status = STATUS_UNIT_MISMATCH
            note = f"DXF unit scale {link['unit_scale']} != expected {expected_scale}"

        if prior is not None and prior["fingerprint"] != fingerprint:
            if ifc_conflict:
                status = STATUS_CONFLICT
                note = ("IFC file was modified outside Fundi after export; "
                        "refusing to overwrite silently")
                conflicts.append({"internal_id": internal_id, "reason": note})

        if status == STATUS_OK:
            if prior is None:
                counts["added"] += 1
            elif prior["fingerprint"] != fingerprint:
                status = STATUS_REGENERATED
                counts["updated"] += 1
            else:
                counts["unchanged"] += 1
        else:
            counts[status] += 1

        if ifc_guids.get(internal_id) and link and link.get("ifc_guid") and \
                ifc_guids[internal_id] != link["ifc_guid"]:
            note = (note + "; " if note else "") + "IFC GlobalId changed on regeneration"

        conn.execute(
            """
            INSERT INTO fundi_element_links(
                model_id, internal_id, ifc_guid, ifc_class, dxf_handle, drawing_id,
                layer, fingerprint, unit_scale, status, note, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(model_id, internal_id) DO UPDATE SET
                ifc_guid = excluded.ifc_guid,
                ifc_class = excluded.ifc_class,
                dxf_handle = excluded.dxf_handle,
                drawing_id = excluded.drawing_id,
                layer = excluded.layer,
                fingerprint = excluded.fingerprint,
                unit_scale = excluded.unit_scale,
                status = excluded.status,
                note = excluded.note,
                updated_at = excluded.updated_at
            """,
            (model_id, internal_id, ifc_guids.get(internal_id), element["ifc_class"],
             (link or {}).get("handle"), drawing_id, (link or {}).get("layer"),
             fingerprint, (link or {}).get("unit_scale"), status, note, now),
        )

    # Elements that disappeared from the model: keep the row, mark it deleted so
    # the history of an old drawing/IFC is not silently rewritten.
    for internal_id, row in previous.items():
        if internal_id in current_ids:
            continue
        conn.execute(
            "UPDATE fundi_element_links SET status = ?, note = ?, updated_at = ? "
            "WHERE model_id = ? AND internal_id = ?",
            (STATUS_DELETED, "element removed from the canonical model", now, model_id, internal_id),
        )
        counts["deleted"] += 1

    conn.commit()
    return {
        "model_id": model_id,
        "drawing_id": drawing_id,
        "counts": counts,
        "duplicates": sorted(set(duplicates)),
        "conflicts": conflicts,
    }


def links_for(conn: sqlite3.Connection, model_id: str) -> List[Dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM fundi_element_links WHERE model_id = ? ORDER BY internal_id",
        (model_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def link_for(conn: sqlite3.Connection, model_id: str, internal_id: str) -> Optional[Dict[str, Any]]:
    row = conn.execute(
        "SELECT * FROM fundi_element_links WHERE model_id = ? AND internal_id = ?",
        (model_id, internal_id),
    ).fetchone()
    return dict(row) if row else None


def find_by_ifc_guid(conn: sqlite3.Connection, model_id: str, guid: str) -> Optional[Dict[str, Any]]:
    row = conn.execute(
        "SELECT * FROM fundi_element_links WHERE model_id = ? AND ifc_guid = ?",
        (model_id, guid),
    ).fetchone()
    return dict(row) if row else None


def find_by_handle(conn: sqlite3.Connection, drawing_id: str, handle: str) -> Optional[Dict[str, Any]]:
    row = conn.execute(
        "SELECT * FROM fundi_element_links WHERE drawing_id = ? AND dxf_handle = ?",
        (drawing_id, handle),
    ).fetchone()
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# Recovery
# ---------------------------------------------------------------------------


def rebuild_from_dxf(conn: sqlite3.Connection, model_doc: Dict[str, Any],
                     drawing_id: str, dxf_links: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    """Rebuild link handles from the DXF's own XDATA after data loss.

    The DXF contains one entity per view, so links are collapsed to one row per
    element (plan view preferred) - the same shape ``sync_links`` persists.
    """
    model_id = model_doc["model_id"]
    expected_scale = units.conversion_factor(units.CANONICAL_LENGTH_UNIT, units.DXF_LENGTH_UNIT)
    primary: Dict[str, Dict[str, Any]] = {}
    for link in dxf_links:
        existing = primary.get(link["internal_id"])
        if existing is None or (link.get("view") == "plan" and existing.get("view") != "plan"):
            primary[link["internal_id"]] = link

    rebuilt = 0
    for internal_id, link in primary.items():
        element = septic_model_lookup(model_doc, internal_id)
        if element is None:
            continue
        conn.execute(
            """
            INSERT INTO fundi_element_links(
                model_id, internal_id, ifc_guid, ifc_class, dxf_handle, drawing_id,
                layer, fingerprint, unit_scale, status, note, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(model_id, internal_id) DO UPDATE SET
                ifc_guid = excluded.ifc_guid,
                dxf_handle = excluded.dxf_handle,
                drawing_id = excluded.drawing_id,
                layer = excluded.layer,
                status = excluded.status,
                note = excluded.note,
                updated_at = excluded.updated_at
            """,
            (model_id, link["internal_id"], element["ifc_guid"], element["ifc_class"],
             link["handle"], drawing_id, link["layer"], element["fingerprint"],
             expected_scale, STATUS_OK, "rebuilt from DXF XDATA", _utcnow()),
        )
        rebuilt += 1
    conn.commit()
    return {"rebuilt": rebuilt, "drawing_id": drawing_id}


def septic_model_lookup(model_doc: Dict[str, Any], internal_id: str) -> Optional[Dict[str, Any]]:
    for element in model_doc["elements"]:
        if element["id"] == internal_id:
            return element
    return None


def handle_copies(conn: sqlite3.Connection, model_id: str, drawing_id: str,
                  dxf_links: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    """Detect duplicated internal ids caused by copying CAD entities.

    Copying an entity copies its XDATA, so the copied entity claims the same
    internal id. Occurrences are counted *per view* (an element is expected once
    in plan and once in section); within a view the first occurrence keeps the
    identity and later ones are re-identified as ``...#copyN`` so the
    one-to-one invariant of the mapping is restored instead of two CAD entities
    overwriting each other's row.
    """
    seen: Dict[tuple, int] = {}
    reidentified: List[Dict[str, str]] = []
    for link in dxf_links:
        internal_id = link["internal_id"]
        view = link.get("view") or "plan"
        key = (view, internal_id)
        seen[key] = seen.get(key, 0) + 1
        occurrence = seen[key]
        if occurrence == 1:
            continue
        new_id = identity.copy_suffix(internal_id, occurrence)
        reidentified.append(
            {
                "original_internal_id": internal_id,
                "new_internal_id": new_id,
                "handle": link["handle"],
                "view": view,
            }
        )
        conn.execute(
            """
            INSERT INTO fundi_element_links(
                model_id, internal_id, ifc_guid, ifc_class, dxf_handle, drawing_id,
                layer, fingerprint, unit_scale, status, note, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(model_id, internal_id) DO UPDATE SET
                dxf_handle = excluded.dxf_handle,
                drawing_id = excluded.drawing_id,
                status = excluded.status,
                note = excluded.note,
                updated_at = excluded.updated_at
            """,
            (model_id, new_id, identity.ifc_guid_from_internal_id(new_id), None,
             link["handle"], drawing_id, link["layer"], None, link["unit_scale"],
             STATUS_OK, f"copy of {internal_id} in {view} view", _utcnow()),
        )
    conn.commit()
    return {"reidentified": reidentified, "count": len(reidentified)}


def mapping_document(conn: sqlite3.Connection, model_id: str) -> Dict[str, Any]:
    """Serialise the mapping for the frontend and for reporting."""
    model = conn.execute(
        "SELECT * FROM fundi_models WHERE model_id = ?", (model_id,)
    ).fetchone()
    links = links_for(conn, model_id)
    return {
        "model_id": model_id,
        "revision": model["revision"] if model else None,
        "model_hash": model["model_hash"] if model else None,
        "units": units.describe_units(),
        "links": links,
        "by_status": _count_statuses(links),
    }


def _count_statuses(links: List[Dict[str, Any]]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for link in links:
        counts[link["status"]] = counts.get(link["status"], 0) + 1
    return dict(sorted(counts.items()))


def export_mapping_json(conn: sqlite3.Connection, model_id: str, path: str) -> Dict[str, Any]:
    document = mapping_document(conn, model_id)
    os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(document, handle, indent=2)
    return {"path": path, "links": len(document["links"])}
