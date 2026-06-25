"""
CAD DXF Parser — FastAPI backend with complete Block/INSERT resolution.
Flattens all INSERT entities into resolved primitives with coordinate transforms.
"""

import logging
import math
import uuid
from pathlib import Path
from typing import Any

import ezdxf
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(title="CAD Parser API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store: session_id → {entities, block_stats}
SESSION_STORE: dict[str, dict] = {}

# ---------------------------------------------------------------------------
# Coordinate transformation helpers
# ---------------------------------------------------------------------------

def make_transform(
    insert_x: float,
    insert_y: float,
    rotation_deg: float,
    scale_x: float,
    scale_y: float,
) -> np.ndarray:
    """
    Build a 3×3 homogeneous 2-D transform matrix:
      P' = T(insert) · R(rotation) · S(scale) · P
    Applied as: scale first, then rotate, then translate.
    """
    rad = math.radians(rotation_deg)
    cos_r = math.cos(rad)
    sin_r = math.sin(rad)

    # Combined scale-then-rotate then translate (column-major, applied right→left)
    # M = T · R · S
    m = np.array(
        [
            [cos_r * scale_x, -sin_r * scale_y, insert_x],
            [sin_r * scale_x,  cos_r * scale_y, insert_y],
            [0.0,              0.0,              1.0     ],
        ],
        dtype=float,
    )
    return m


def transform_point(pt: tuple[float, float], matrix: np.ndarray) -> tuple[float, float]:
    """Apply 3×3 homogeneous matrix to a 2-D point."""
    v = np.array([pt[0], pt[1], 1.0])
    r = matrix @ v
    return float(r[0]), float(r[1])


def transform_angle(angle_deg: float, matrix: np.ndarray) -> float:
    """Rotate an angle by the rotation component of the matrix."""
    # Extract rotation from the matrix (atan2 of upper-left 2×2)
    rotation = math.degrees(math.atan2(matrix[1, 0], matrix[0, 0]))
    return angle_deg + rotation


# ---------------------------------------------------------------------------
# Color resolution
# ---------------------------------------------------------------------------

AUTOCAD_COLORS: dict[int, str] = {
    1: "#FF0000", 2: "#FFFF00", 3: "#00FF00", 4: "#00FFFF",
    5: "#0000FF", 6: "#FF00FF", 7: "#FFFFFF", 0: "#000000",
}


def resolve_color(entity, layer_color_map: dict[str, str], insert_color: str | None) -> str:
    """
    Resolve final display color respecting BYBLOCK / BYLAYER inheritance.
    """
    raw = entity.dxf.get("color", 256)  # 256 = BYLAYER, 0 = BYBLOCK
    if raw == 0:  # BYBLOCK — inherit from INSERT
        return insert_color or "#FFFFFF"
    if raw == 256:  # BYLAYER — look up the layer
        layer = entity.dxf.get("layer", "0")
        return layer_color_map.get(layer, "#FFFFFF")
    return AUTOCAD_COLORS.get(raw, "#FFFFFF")


def build_layer_color_map(doc) -> dict[str, str]:
    color_map: dict[str, str] = {}
    for layer in doc.layers:
        aci = layer.dxf.get("color", 7)
        color_map[layer.dxf.name] = AUTOCAD_COLORS.get(abs(aci), "#FFFFFF")
    return color_map


# ---------------------------------------------------------------------------
# Entity coordinate extraction (primitive types)
# ---------------------------------------------------------------------------

def extract_line(entity, matrix: np.ndarray, layer_colors: dict, insert_color: str | None,
                 block_source: str | None) -> dict | None:
    try:
        start = transform_point((entity.dxf.start.x, entity.dxf.start.y), matrix)
        end = transform_point((entity.dxf.end.x, entity.dxf.end.y), matrix)
        return {
            "id": str(uuid.uuid4()),
            "type": "LINE",
            "layer": entity.dxf.get("layer", "0"),
            "color": resolve_color(entity, layer_colors, insert_color),
            "block_source": block_source,
            "x1": start[0], "y1": start[1],
            "x2": end[0],   "y2": end[1],
        }
    except Exception as exc:
        log.debug("LINE extraction failed: %s", exc)
        return None


def extract_circle(entity, matrix: np.ndarray, layer_colors: dict, insert_color: str | None,
                   block_source: str | None) -> dict | None:
    try:
        cx, cy = transform_point((entity.dxf.center.x, entity.dxf.center.y), matrix)
        # Radius is scaled by the average of x/y scale extracted from matrix columns
        scale_x = math.hypot(float(matrix[0, 0]), float(matrix[1, 0]))
        scale_y = math.hypot(float(matrix[0, 1]), float(matrix[1, 1]))
        radius = entity.dxf.radius * ((scale_x + scale_y) / 2)
        return {
            "id": str(uuid.uuid4()),
            "type": "CIRCLE",
            "layer": entity.dxf.get("layer", "0"),
            "color": resolve_color(entity, layer_colors, insert_color),
            "block_source": block_source,
            "cx": cx, "cy": cy, "radius": radius,
        }
    except Exception as exc:
        log.debug("CIRCLE extraction failed: %s", exc)
        return None


def extract_arc(entity, matrix: np.ndarray, layer_colors: dict, insert_color: str | None,
                block_source: str | None) -> dict | None:
    try:
        cx, cy = transform_point((entity.dxf.center.x, entity.dxf.center.y), matrix)
        scale_x = math.hypot(float(matrix[0, 0]), float(matrix[1, 0]))
        scale_y = math.hypot(float(matrix[0, 1]), float(matrix[1, 1]))
        radius = entity.dxf.radius * ((scale_x + scale_y) / 2)
        start_angle = transform_angle(entity.dxf.start_angle, matrix)
        end_angle = transform_angle(entity.dxf.end_angle, matrix)
        return {
            "id": str(uuid.uuid4()),
            "type": "ARC",
            "layer": entity.dxf.get("layer", "0"),
            "color": resolve_color(entity, layer_colors, insert_color),
            "block_source": block_source,
            "cx": cx, "cy": cy, "radius": radius,
            "start_angle": start_angle,
            "end_angle": end_angle,
        }
    except Exception as exc:
        log.debug("ARC extraction failed: %s", exc)
        return None


def extract_text(entity, matrix: np.ndarray, layer_colors: dict, insert_color: str | None,
                 block_source: str | None) -> dict | None:
    try:
        insert_pt = entity.dxf.get("insert", None) or entity.dxf.get("align_point", None)
        if insert_pt is None:
            return None
        x, y = transform_point((insert_pt.x, insert_pt.y), matrix)
        content = entity.dxf.get("text", "")
        height = entity.dxf.get("height", 1.0)
        rotation = transform_angle(entity.dxf.get("rotation", 0.0), matrix)
        return {
            "id": str(uuid.uuid4()),
            "type": "TEXT",
            "layer": entity.dxf.get("layer", "0"),
            "color": resolve_color(entity, layer_colors, insert_color),
            "block_source": block_source,
            "x": x, "y": y,
            "text": content,
            "height": height,
            "rotation": rotation,
        }
    except Exception as exc:
        log.debug("TEXT extraction failed: %s", exc)
        return None


def extract_lwpolyline(entity, matrix: np.ndarray, layer_colors: dict, insert_color: str | None,
                       block_source: str | None) -> dict | None:
    try:
        points = []
        for pt in entity.get_points():
            tx, ty = transform_point((pt[0], pt[1]), matrix)
            points.append({"x": tx, "y": ty})
        if len(points) < 2:
            return None
        return {
            "id": str(uuid.uuid4()),
            "type": "POLYLINE",
            "layer": entity.dxf.get("layer", "0"),
            "color": resolve_color(entity, layer_colors, insert_color),
            "block_source": block_source,
            "points": points,
            "closed": entity.closed,
        }
    except Exception as exc:
        log.debug("LWPOLYLINE extraction failed: %s", exc)
        return None


def extract_polyline(entity, matrix: np.ndarray, layer_colors: dict, insert_color: str | None,
                     block_source: str | None) -> dict | None:
    """Handle legacy POLYLINE / MESH entities."""
    try:
        points = []
        for vertex in entity.vertices:
            tx, ty = transform_point((vertex.dxf.location.x, vertex.dxf.location.y), matrix)
            points.append({"x": tx, "y": ty})
        if len(points) < 2:
            return None
        return {
            "id": str(uuid.uuid4()),
            "type": "POLYLINE",
            "layer": entity.dxf.get("layer", "0"),
            "color": resolve_color(entity, layer_colors, insert_color),
            "block_source": block_source,
            "points": points,
            "closed": bool(entity.dxf.get("flags", 0) & 1),
        }
    except Exception as exc:
        log.debug("POLYLINE extraction failed: %s", exc)
        return None


def extract_spline(entity, matrix: np.ndarray, layer_colors: dict, insert_color: str | None,
                   block_source: str | None) -> dict | None:
    """Approximate splines by sampling control points as a polyline."""
    try:
        pts = list(entity.control_points)
        if len(pts) < 2:
            return None
        points = []
        for pt in pts:
            tx, ty = transform_point((pt[0], pt[1]), matrix)
            points.append({"x": tx, "y": ty})
        return {
            "id": str(uuid.uuid4()),
            "type": "POLYLINE",
            "layer": entity.dxf.get("layer", "0"),
            "color": resolve_color(entity, layer_colors, insert_color),
            "block_source": block_source,
            "points": points,
            "closed": False,
        }
    except Exception as exc:
        log.debug("SPLINE extraction failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Core recursive flattener
# ---------------------------------------------------------------------------

IDENTITY = np.eye(3, dtype=float)

SKIP_BLOCK_PREFIXES = ("*Model_Space", "*Paper_Space", "*D", "*U", "*T")


def is_anonymous_block(name: str) -> bool:
    return name.startswith("*")


def flatten_insert(
    insert_entity,
    parent_transform: np.ndarray,
    doc,
    layer_colors: dict[str, str],
    depth: int = 0,
    visited: frozenset[str] | None = None,
) -> list[dict]:
    """
    Recursively resolve an INSERT entity into a flat list of primitive dicts.
    Applies compound transformation: parent_transform · local_transform.
    """
    MAX_DEPTH = 20

    if visited is None:
        visited = frozenset()

    block_name: str = insert_entity.dxf.name

    # Skip anonymous / internal AutoCAD blocks
    if is_anonymous_block(block_name):
        return []

    # Guard against circular references
    if block_name in visited:
        log.warning("Circular block reference detected: %s — breaking recursion", block_name)
        return []

    if depth > MAX_DEPTH:
        log.warning("Max recursion depth %d reached for block '%s'", MAX_DEPTH, block_name)
        return []

    # Retrieve block definition
    if block_name not in doc.blocks:
        log.warning("Block '%s' not found (possibly XREF) — skipping", block_name)
        return []

    block_def = doc.blocks[block_name]

    # Check for XREF (external reference flag bit 4)
    block_flags = block_def.block.dxf.get("flags", 0)
    if block_flags & 4:  # XREF bit
        log.warning("Block '%s' is an XREF — skipping", block_name)
        return []

    # Extract INSERT parameters
    ins_pt = insert_entity.dxf.get("insert", None)
    ix = float(ins_pt.x) if ins_pt else 0.0
    iy = float(ins_pt.y) if ins_pt else 0.0
    sx = float(insert_entity.dxf.get("xscale", 1.0))
    sy = float(insert_entity.dxf.get("yscale", 1.0))
    rot = float(insert_entity.dxf.get("rotation", 0.0))

    # Degenerate scale guard
    if sx == 0.0 or sy == 0.0:
        log.debug("INSERT of '%s' has zero scale — skipping", block_name)
        return []

    local_transform = make_transform(ix, iy, rot, sx, sy)
    compound_transform = parent_transform @ local_transform

    # Inherit color for BYBLOCK resolution
    raw_color = insert_entity.dxf.get("color", 256)
    insert_layer = insert_entity.dxf.get("layer", "0")
    if raw_color == 256:
        insert_color = layer_colors.get(insert_layer, "#FFFFFF")
    else:
        insert_color = AUTOCAD_COLORS.get(raw_color, "#FFFFFF")

    visited = visited | {block_name}
    results: list[dict] = []

    for child in block_def:
        dxf_type = child.dxftype()

        if dxf_type == "LINE":
            e = extract_line(child, compound_transform, layer_colors, insert_color, block_name)
            if e:
                results.append(e)

        elif dxf_type == "CIRCLE":
            e = extract_circle(child, compound_transform, layer_colors, insert_color, block_name)
            if e:
                results.append(e)

        elif dxf_type == "ARC":
            e = extract_arc(child, compound_transform, layer_colors, insert_color, block_name)
            if e:
                results.append(e)

        elif dxf_type in ("TEXT", "MTEXT"):
            e = extract_text(child, compound_transform, layer_colors, insert_color, block_name)
            if e:
                results.append(e)

        elif dxf_type == "LWPOLYLINE":
            e = extract_lwpolyline(child, compound_transform, layer_colors, insert_color, block_name)
            if e:
                results.append(e)

        elif dxf_type == "POLYLINE":
            e = extract_polyline(child, compound_transform, layer_colors, insert_color, block_name)
            if e:
                results.append(e)

        elif dxf_type == "SPLINE":
            e = extract_spline(child, compound_transform, layer_colors, insert_color, block_name)
            if e:
                results.append(e)

        elif dxf_type == "INSERT":
            nested = flatten_insert(
                child, compound_transform, doc, layer_colors, depth + 1, visited
            )
            results.extend(nested)

        elif dxf_type == "ATTRIB":
            e = extract_text(child, compound_transform, layer_colors, insert_color, block_name)
            if e:
                e["type"] = "TEXT"
                e["is_attrib"] = True
                results.append(e)

        # BLOCK / ENDBLK / SEQEND sentinels — ignore silently
        elif dxf_type in ("BLOCK", "ENDBLK", "SEQEND"):
            pass

        else:
            log.debug("Unsupported entity type inside block '%s': %s", block_name, dxf_type)

    # Also extract ATTRIB entities attached directly to the INSERT
    try:
        for attrib in insert_entity.attribs:
            e = extract_text(attrib, compound_transform, layer_colors, insert_color, block_name)
            if e:
                e["is_attrib"] = True
                results.append(e)
    except Exception:
        pass

    return results


# ---------------------------------------------------------------------------
# ModelSpace top-level parser
# ---------------------------------------------------------------------------

def parse_dxf(file_path: str) -> tuple[list[dict], dict]:
    """
    Parse a DXF file and return (entities, block_stats).
    All INSERT entities are fully flattened; output contains only primitives.
    """
    doc = ezdxf.readfile(file_path)
    msp = doc.modelspace()
    layer_colors = build_layer_color_map(doc)

    entities: list[dict] = []

    # --- Collect block statistics before flattening ---
    block_stats: dict[str, dict] = {}
    insertion_counts: dict[str, int] = {}

    for block_def in doc.blocks:
        name = block_def.name
        if is_anonymous_block(name):
            continue
        count = sum(1 for e in block_def if e.dxftype() not in ("BLOCK", "ENDBLK", "SEQEND"))
        block_stats[name] = {
            "name": name,
            "entity_count": count,
            "insertion_count": 0,
            "bbox": None,
        }

    # Count insertions across all of modelspace (shallow scan for stats)
    def count_inserts(space):
        for e in space:
            if e.dxftype() == "INSERT":
                bn = e.dxf.name
                if not is_anonymous_block(bn):
                    insertion_counts[bn] = insertion_counts.get(bn, 0) + 1

    count_inserts(msp)

    # --- Process ModelSpace entities ---
    for entity in msp:
        dxf_type = entity.dxftype()

        if dxf_type == "LINE":
            e = extract_line(entity, IDENTITY, layer_colors, None, None)
            if e:
                entities.append(e)

        elif dxf_type == "CIRCLE":
            e = extract_circle(entity, IDENTITY, layer_colors, None, None)
            if e:
                entities.append(e)

        elif dxf_type == "ARC":
            e = extract_arc(entity, IDENTITY, layer_colors, None, None)
            if e:
                entities.append(e)

        elif dxf_type in ("TEXT", "MTEXT"):
            e = extract_text(entity, IDENTITY, layer_colors, None, None)
            if e:
                entities.append(e)

        elif dxf_type == "LWPOLYLINE":
            e = extract_lwpolyline(entity, IDENTITY, layer_colors, None, None)
            if e:
                entities.append(e)

        elif dxf_type == "POLYLINE":
            e = extract_polyline(entity, IDENTITY, layer_colors, None, None)
            if e:
                entities.append(e)

        elif dxf_type == "SPLINE":
            e = extract_spline(entity, IDENTITY, layer_colors, None, None)
            if e:
                entities.append(e)

        elif dxf_type == "INSERT":
            resolved = flatten_insert(entity, IDENTITY, doc, layer_colors)
            entities.extend(resolved)

        else:
            log.debug("Skipping unsupported ModelSpace entity: %s", dxf_type)

    # --- Compute bounding boxes per block (from resolved entities) ---
    bbox_accum: dict[str, dict] = {}
    for ent in entities:
        src = ent.get("block_source")
        if not src:
            continue
        pts: list[tuple[float, float]] = []
        t = ent["type"]
        if t == "LINE":
            pts = [(ent["x1"], ent["y1"]), (ent["x2"], ent["y2"])]
        elif t in ("CIRCLE", "ARC"):
            r = ent["radius"]
            pts = [(ent["cx"] - r, ent["cy"] - r), (ent["cx"] + r, ent["cy"] + r)]
        elif t == "TEXT":
            pts = [(ent["x"], ent["y"])]
        elif t == "POLYLINE":
            pts = [(p["x"], p["y"]) for p in ent.get("points", [])]
        for px, py in pts:
            if src not in bbox_accum:
                bbox_accum[src] = {"min_x": px, "min_y": py, "max_x": px, "max_y": py}
            else:
                b = bbox_accum[src]
                b["min_x"] = min(b["min_x"], px)
                b["min_y"] = min(b["min_y"], py)
                b["max_x"] = max(b["max_x"], px)
                b["max_y"] = max(b["max_y"], py)

    # Merge stats
    for name, stat in block_stats.items():
        stat["insertion_count"] = insertion_counts.get(name, 0)
        if name in bbox_accum:
            b = bbox_accum[name]
            stat["bbox"] = {
                "min_x": b["min_x"], "min_y": b["min_y"],
                "max_x": b["max_x"], "max_y": b["max_y"],
                "width": b["max_x"] - b["min_x"],
                "height": b["max_y"] - b["min_y"],
            }

    # Only return stats for blocks that were actually referenced
    referenced_stats = {
        k: v for k, v in block_stats.items() if v["insertion_count"] > 0
    }

    log.info(
        "Parsed %d total entities (%d from block insertions). %d unique block types.",
        len(entities),
        sum(1 for e in entities if e.get("block_source")),
        len(referenced_stats),
    )

    return entities, referenced_stats


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

@app.post("/api/cad/upload")
async def upload_dxf(file: UploadFile = File(...)):
    """Upload a DXF file; returns session_id + flattened entity list."""
    if not file.filename.lower().endswith((".dxf", ".dwg")):
        raise HTTPException(status_code=400, detail="Only DXF/DWG files are supported.")

    session_id = str(uuid.uuid4())
    tmp_path = Path(f"/tmp/{session_id}_{file.filename}")

    try:
        content = await file.read()
        tmp_path.write_bytes(content)

        entities, block_stats = parse_dxf(str(tmp_path))

        SESSION_STORE[session_id] = {
            "entities": entities,
            "block_stats": block_stats,
            "filename": file.filename,
        }

        # Derive summary metadata
        layers = list({e.get("layer", "0") for e in entities})
        block_sources = list({e["block_source"] for e in entities if e.get("block_source")})

        return {
            "session_id": session_id,
            "filename": file.filename,
            "entity_count": len(entities),
            "layers": layers,
            "block_sources": block_sources,
            "entities": entities,
        }

    except ezdxf.DXFStructureError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid DXF structure: {exc}") from exc
    except Exception as exc:
        log.exception("Unexpected error parsing DXF")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


@app.get("/api/cad/entities/{session_id}")
async def get_entities(session_id: str):
    """Return cached entities for a session."""
    session = SESSION_STORE.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"session_id": session_id, "entities": session["entities"]}


@app.get("/api/cad/blocks/{session_id}")
async def get_block_stats(session_id: str):
    """
    Return block definition statistics for a session.
    Includes: name, entity_count, bounding_box, insertion_count.
    """
    session = SESSION_STORE.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    stats = session["block_stats"]
    return {
        "session_id": session_id,
        "block_count": len(stats),
        "blocks": list(stats.values()),
    }


@app.get("/api/health")
async def health():
    return {"status": "ok"}
