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
#: Entity-level states (per CAD entity, not per element).
STATUS_EDITED = "edited"
STATUS_DUPLICATE = "duplicate"
STATUS_NEW = "new"
STATUS_ORPHAN = "orphan"

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

-- One row per (element, drawing, entity handle): the one-to-many half of the
-- mapping. A single engineering element legitimately owns many CAD entities (a
-- beam detail is dozens of lines and texts), and a single entity can represent
-- more than one element (a section drawing shows a retaining wall stem and base
-- in one view), so neither column is unique on its own.
CREATE TABLE IF NOT EXISTS fundi_entity_links (
    model_id      TEXT NOT NULL,
    internal_id   TEXT NOT NULL,
    drawing_id    TEXT NOT NULL,
    handle        TEXT NOT NULL,
    layer         TEXT,
    entity_type   TEXT,
    view          TEXT,
    status        TEXT NOT NULL,
    geometry_hash TEXT,
    note          TEXT,
    updated_at    TEXT NOT NULL,
    PRIMARY KEY (model_id, internal_id, drawing_id, handle)
);

CREATE INDEX IF NOT EXISTS ix_entity_links_handle   ON fundi_entity_links(drawing_id, handle);
CREATE INDEX IF NOT EXISTS ix_entity_links_element  ON fundi_entity_links(model_id, internal_id);
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
    required_view: Optional[str] = "plan",
) -> Dict[str, Any]:
    """Reconcile stored links with a freshly exported DXF/IFC pair.

    ``dxf_links`` are the entries read back from the written DXF, so the handles
    recorded are the ones a CAD application will report. ``ifc_guids`` maps
    internal id -> GlobalId from the written IFC.

    ``required_view`` names a view an element *must* appear in for its CAD link to
    count as valid; it defaults to ``"plan"`` because that is the historical
    behaviour for the septic drawing, which always has a plan view, so an element
    surviving only in section means the plan geometry was deleted. Generator detail
    sheets have no plan view at all, so they pass ``None``: any single view is
    sufficient.
    """
    model_id = model_doc["model_id"]
    # An element may be drawn in several views (plan, section). The preferred view
    # is the canonical CAD handle; other views are kept for traceability below.
    by_internal_id: Dict[str, Dict[str, Any]] = {}
    views_by_internal_id: Dict[str, List[str]] = {}
    duplicates: List[str] = []
    seen: Dict[tuple, int] = {}
    preferred = required_view or "plan"
    for link in dxf_links:
        internal_id = link["internal_id"]
        view = link.get("view") or "plan"
        key = (view, internal_id)
        seen[key] = seen.get(key, 0) + 1
        if seen[key] > 1:
            duplicates.append(f"{view}:{internal_id}")
        views_by_internal_id.setdefault(internal_id, []).append(view)
        existing = by_internal_id.get(internal_id)
        if existing is None or (view == preferred and existing.get("view") != preferred):
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
        elif required_view and required_view not in views_by_internal_id.get(internal_id, []):
            # The required view is the authoritative CAD representation of an
            # element; a surviving entity in another view alone is not enough.
            status = STATUS_STALE
            note = (f"{required_view} view entity missing (element only present in: "
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


# ---------------------------------------------------------------------------
# Entity-level (one-to-many) links for generator-produced drawings
# ---------------------------------------------------------------------------


def _entity_key(internal_id: str, handle: str) -> tuple:
    return (str(internal_id), str(handle))


def sync_entity_links(
    conn: sqlite3.Connection,
    model_doc: Dict[str, Any],
    drawing_id: str,
    entity_links: Iterable[Dict[str, Any]],
) -> Dict[str, Any]:
    """Persist the element -> CAD entity links for one drawing.

    ``entity_links`` come from reading the written DXF back, so every handle is
    the one a CAD application will report. Links that disappeared are marked
    ``deleted``; links whose geometry changed are marked ``edited``. Rows are
    never silently removed, because the history of a drawing matters.
    """
    model_id = model_doc["model_id"]
    now = _utcnow()
    previous = {
        (row["internal_id"], row["handle"]): dict(row)
        for row in conn.execute(
            "SELECT * FROM fundi_entity_links WHERE model_id = ? AND drawing_id = ?",
            (model_id, drawing_id),
        ).fetchall()
    }

    counts = {"added": 0, "unchanged": 0, "edited": 0, "deleted": 0}
    current_keys = set()
    for link in entity_links:
        key = _entity_key(link["internal_id"], link["handle"])
        if key in current_keys:
            # The same (element, handle) pair twice cannot be represented; it means
            # the same entity carries this element id twice in its XDATA.
            continue
        current_keys.add(key)
        prior = previous.get(key)
        status = STATUS_OK
        note = None
        if prior is None:
            counts["added"] += 1
        elif prior["geometry_hash"] and link.get("geometry_hash") and \
                prior["geometry_hash"] != link["geometry_hash"]:
            status = STATUS_EDITED
            note = "geometry differs from the generated entity"
            counts["edited"] += 1
        else:
            counts["unchanged"] += 1
        conn.execute(
            """
            INSERT INTO fundi_entity_links(
                model_id, internal_id, drawing_id, handle, layer, entity_type, view,
                status, geometry_hash, note, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(model_id, internal_id, drawing_id, handle) DO UPDATE SET
                layer = excluded.layer,
                entity_type = excluded.entity_type,
                view = excluded.view,
                status = excluded.status,
                geometry_hash = excluded.geometry_hash,
                note = excluded.note,
                updated_at = excluded.updated_at
            """,
            (model_id, link["internal_id"], drawing_id, link["handle"],
             link.get("layer"), link.get("entity_type"), link.get("view"),
             status, link.get("geometry_hash"), note, now),
        )

    for key, row in previous.items():
        if key in current_keys:
            continue
        conn.execute(
            "UPDATE fundi_entity_links SET status = ?, note = ?, updated_at = ? "
            "WHERE model_id = ? AND internal_id = ? AND drawing_id = ? AND handle = ?",
            (STATUS_DELETED, "entity no longer present in the drawing", now,
             model_id, row["internal_id"], drawing_id, row["handle"]),
        )
        counts["deleted"] += 1

    conn.commit()
    return {"drawing_id": drawing_id, "counts": counts}


def entity_links_for(conn: sqlite3.Connection, model_id: str,
                     drawing_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """All entity links for a model (optionally one drawing), newest first."""
    if drawing_id:
        rows = conn.execute(
            "SELECT * FROM fundi_entity_links WHERE model_id = ? AND drawing_id = ? "
            "ORDER BY internal_id, handle",
            (model_id, drawing_id),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM fundi_entity_links WHERE model_id = ? "
            "ORDER BY drawing_id DESC, internal_id, handle",
            (model_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def elements_for_handle(conn: sqlite3.Connection, drawing_id: str,
                        handle: str) -> List[Dict[str, Any]]:
    """Which engineering element(s) a CAD handle represents.

    A handle may represent more than one element (a section view shows a stem and
    its base in one view), so this returns a list rather than a single row.
    """
    rows = conn.execute(
        "SELECT * FROM fundi_entity_links WHERE drawing_id = ? AND handle = ? "
        "AND status != ? ORDER BY internal_id",
        (drawing_id, str(handle), STATUS_DELETED),
    ).fetchall()
    return [dict(row) for row in rows]


def handles_for_element(conn: sqlite3.Connection, model_id: str, internal_id: str,
                        drawing_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """All CAD entities that represent one engineering element."""
    if drawing_id:
        rows = conn.execute(
            "SELECT * FROM fundi_entity_links WHERE model_id = ? AND internal_id = ? "
            "AND drawing_id = ? AND status != ? ORDER BY handle",
            (model_id, internal_id, drawing_id, STATUS_DELETED),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM fundi_entity_links WHERE model_id = ? AND internal_id = ? "
            "AND status != ? ORDER BY drawing_id, handle",
            (model_id, internal_id, STATUS_DELETED),
        ).fetchall()
    return [dict(row) for row in rows]


def reconcile_drawing(
    conn: sqlite3.Connection,
    model_doc: Dict[str, Any],
    drawing_id: str,
    scanned_entities: Iterable[Dict[str, Any]],
) -> Dict[str, Any]:
    """Compare a reopened drawing against the stored mapping and report drift.

    Detects, without guessing:

    ``missing``        stored entity handle absent from the file
    ``rehandled``      handle changed but the element id *and* geometry match, so
                       the entity was re-written by another application; identity
                       comes from the XDATA id, not from the handle
    ``edited``         handle present, geometry hash differs (user edited it)
    ``duplicates``     the same element appears twice in one view
    ``unmapped``       entities with no Fundi identity at all (reported, never
                       guessed)
    ``new_elements``   Fundi element ids in the file that the model does not know
    ``elements_without_entities``  model elements with no entity in this drawing
    """
    model_id = model_doc["model_id"]
    model_ids = {element["id"] for element in model_doc["elements"]}
    stored = {
        (row["internal_id"], row["handle"]): row
        for row in conn.execute(
            "SELECT * FROM fundi_entity_links WHERE model_id = ? AND drawing_id = ?",
            (model_id, drawing_id),
        ).fetchall()
    }

    scanned_entities = list(scanned_entities)
    # handle -> the entity's own facts (geometry hash, layer, type) plus the
    # element payloads found in its XDATA. Keeping the entity-level data here is
    # what allows an edited entity to be recognised: the geometry hash belongs to
    # the entity, not to the identity payload inside it.
    by_handle: Dict[str, Dict[str, Any]] = {}
    unmapped: List[Dict[str, Any]] = []
    for entity in scanned_entities:
        payloads = entity.get("elements") or []
        by_handle[entity["handle"]] = {
            "geometry_hash": entity.get("geometry_hash"),
            "layer": entity.get("layer"),
            "entity_type": entity.get("entity_type"),
            "elements": payloads,
        }
        if not payloads:
            unmapped.append(
                {"handle": entity.get("handle"), "layer": entity.get("layer"),
                 "type": entity.get("entity_type")}
            )

    missing: List[Dict[str, Any]] = []
    edited: List[Dict[str, Any]] = []
    unchanged = 0
    current_keys = set()

    # Index the file's entities by (element id, view) so a re-handled entity can be
    # recognised even though its handle changed.
    file_index: Dict[tuple, List[Dict[str, Any]]] = {}
    for handle, record in by_handle.items():
        for payload in record["elements"]:
            file_index.setdefault(
                (payload["internal_id"], payload.get("view")), []
            ).append(
                {"handle": handle, "geometry_hash": record["geometry_hash"],
                 "layer": record["layer"], "entity_type": record["entity_type"]}
            )

    rehandled: List[Dict[str, Any]] = []
    for (internal_id, handle), row in stored.items():
        record = by_handle.get(handle)
        entry = None
        if record is not None:
            for candidate in record["elements"]:
                if candidate["internal_id"] == internal_id:
                    entry = candidate
                    break
        if entry is not None:
            current_keys.add((internal_id, handle))
            stored_hash = row["geometry_hash"]
            current_hash = record["geometry_hash"]
            if stored_hash and current_hash and stored_hash != current_hash:
                edited.append(
                    {"internal_id": internal_id, "handle": handle,
                     "stored_hash": stored_hash, "current_hash": current_hash,
                     "layer": record["layer"]}
                )
            else:
                unchanged += 1
            continue

        # Handle gone: is it the same element re-written with a new handle?
        replacement = None
        for candidate in file_index.get((internal_id, row["view"]), []):
            if (internal_id, candidate["handle"]) in stored:
                continue
            if row["geometry_hash"] and candidate.get("geometry_hash") == row["geometry_hash"]:
                replacement = candidate
                break
        if replacement is None:
            missing.append(
                {"internal_id": internal_id, "handle": handle, "view": row["view"],
                 "layer": row["layer"], "entity_type": row["entity_type"]}
            )
        else:
            current_keys.add((internal_id, replacement["handle"]))
            rehandled.append(
                {"internal_id": internal_id, "old_handle": handle,
                 "new_handle": replacement["handle"], "view": row["view"]}
            )

    new_entities: List[Dict[str, Any]] = []
    duplicates: List[str] = []
    for handle, record in by_handle.items():
        for payload in record["elements"]:
            key = (payload["internal_id"], handle)
            if key in current_keys:
                continue
            new_entities.append(
                {"internal_id": payload["internal_id"], "handle": handle,
                 "view": payload.get("view"), "layer": record["layer"]}
            )
    # An element must appear once per view. More than once means the entity was
    # copied (which duplicates the XDATA) and the mapping cannot be one-to-one.
    for (view, internal_id), entries in sorted(file_index.items()):
        if len(entries) > 1:
            duplicates.append(f"{view}:{internal_id}")

    unknown_ids = sorted(
        {
            payload["internal_id"]
            for record in by_handle.values()
            for payload in record["elements"]
            if payload["internal_id"] not in model_ids
        }
    )
    elements_with_entities = {
        payload["internal_id"]
        for record in by_handle.values()
        for payload in record["elements"]
    }
    without_entities = sorted(model_ids - elements_with_entities)

    # Persist what the file actually says so the registry does not go stale.
    now = _utcnow()
    for item in rehandled:
        conn.execute(
            "UPDATE fundi_entity_links SET handle = ?, status = ?, note = ?, updated_at = ? "
            "WHERE model_id = ? AND internal_id = ? AND drawing_id = ? AND handle = ?",
            (item["new_handle"], STATUS_OK,
             f"handle reassigned from {item['old_handle']}", now,
             model_id, item["internal_id"], drawing_id, item["old_handle"]),
        )
    for item in missing:
        conn.execute(
            "UPDATE fundi_entity_links SET status = ?, note = ?, updated_at = ? "
            "WHERE model_id = ? AND internal_id = ? AND drawing_id = ? AND handle = ?",
            (STATUS_DELETED, "not found in the reopened drawing", now,
             model_id, item["internal_id"], drawing_id, item["handle"]),
        )
    for item in edited:
        conn.execute(
            "UPDATE fundi_entity_links SET status = ?, note = ?, updated_at = ? "
            "WHERE model_id = ? AND internal_id = ? AND drawing_id = ? AND handle = ?",
            (STATUS_EDITED, "geometry edited outside Fundi", now,
             model_id, item["internal_id"], drawing_id, item["handle"]),
        )
    conn.commit()

    requires_attention = bool(missing or edited or unknown_ids or without_entities)
    return {
        "drawing_id": drawing_id,
        "model_id": model_id,
        "unchanged": unchanged,
        "missing": missing,
        "rehandled": rehandled,
        "edited": edited,
        "new_entities": new_entities,
        "duplicates": sorted(set(duplicates)),
        "unmapped_entities": unmapped,
        "unknown_element_ids": unknown_ids,
        "elements_without_entities": without_entities,
        "requires_reconciliation": requires_attention,
        "summary": {
            "stored_links": len(stored),
            "file_entities": len(scanned_entities),
            "mapped_entities": sum(
                1 for record in by_handle.values() if record["elements"]
            ),
            "missing": len(missing),
            "rehandled": len(rehandled),
            "edited": len(edited),
            "new": len(new_entities),
            "unmapped": len(unmapped),
        },
    }


def entity_mapping_document(conn: sqlite3.Connection, model_id: str,
                            drawing_id: Optional[str] = None) -> Dict[str, Any]:
    """Serialise element -> entity links for the API and the workbench panel."""
    links = entity_links_for(conn, model_id, drawing_id)
    by_element: Dict[str, List[Dict[str, Any]]] = {}
    for link in links:
        by_element.setdefault(link["internal_id"], []).append(
            {
                "handle": link["handle"],
                "drawing_id": link["drawing_id"],
                "layer": link["layer"],
                "entity_type": link["entity_type"],
                "view": link["view"],
                "status": link["status"],
                "note": link["note"],
            }
        )
    counts: Dict[str, int] = {}
    for link in links:
        counts[link["status"]] = counts.get(link["status"], 0) + 1
    return {
        "model_id": model_id,
        "drawing_id": drawing_id,
        "entity_link_count": len(links),
        "by_status": dict(sorted(counts.items())),
        "elements": dict(sorted(by_element.items())),
    }
