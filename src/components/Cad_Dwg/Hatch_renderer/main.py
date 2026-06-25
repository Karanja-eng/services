"""
CAD MVP Backend — Section & Elevation Generation Engine
FastAPI + ezdxf + shapely + numpy
"""

from __future__ import annotations

import io
import math
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import ezdxf
from ezdxf import colors
from ezdxf.enums import TextEntityAlignment

import fastapi
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from shapely.geometry import (
    LineString, Point, Polygon, MultiLineString, MultiPoint,
    GeometryCollection,
)
from shapely.strtree import STRtree

# ─────────────────────────────────────────────
#  App setup
# ─────────────────────────────────────────────
app = FastAPI(title="CAD Section/Elevation API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store
_sessions: Dict[str, Dict[str, Any]] = {}


# ─────────────────────────────────────────────
#  Pydantic models
# ─────────────────────────────────────────────
class Point2D(BaseModel):
    x: float
    y: float


class CutLine(BaseModel):
    start: Tuple[float, float]
    end: Tuple[float, float]


class SectionRequest(BaseModel):
    session_id: str
    cut_line: CutLine
    cut_depth: float = 1000.0
    cut_height: float = 3000.0
    view_direction: str = "left"  # "left" or "right"


class ElevationRequest(BaseModel):
    session_id: str
    view_direction: Tuple[float, float, float] = (0.0, -1.0, 0.0)
    view_plane_origin: Tuple[float, float] = (0.0, 0.0)
    view_width: float = 30000.0
    view_height: float = 15000.0
    view_name: str = "ELEVATION"


# ─────────────────────────────────────────────
#  DXF entity flattening helpers (existing MVP logic)
# ─────────────────────────────────────────────
def _color_index_to_hex(ci: int) -> str:
    """Convert ACI color index to hex string."""
    ACI = {
        1: "#FF0000", 2: "#FFFF00", 3: "#00FF00", 4: "#00FFFF",
        5: "#0000FF", 6: "#FF00FF", 7: "#FFFFFF", 8: "#808080",
        9: "#C0C0C0",
    }
    return ACI.get(ci, "#FFFFFF")


def _entity_to_json(e, doc) -> Optional[Dict]:
    """Flatten a single DXF entity to a JSON-serialisable dict."""
    try:
        base = {
            "type": e.dxftype(),
            "layer": e.dxf.get("layer", "0"),
            "color": _color_index_to_hex(e.dxf.get("color", 7)),
            "lineweight": e.dxf.get("lineweight", -1),
            "linetype": e.dxf.get("linetype", "CONTINUOUS"),
        }
        t = e.dxftype()
        if t == "LINE":
            s, ep = e.dxf.start, e.dxf.end
            base.update({"x1": s.x, "y1": s.y, "z1": s.z,
                         "x2": ep.x, "y2": ep.y, "z2": ep.z})
        elif t == "CIRCLE":
            c = e.dxf.center
            base.update({"cx": c.x, "cy": c.y, "cz": c.z,
                         "radius": e.dxf.radius})
        elif t == "ARC":
            c = e.dxf.center
            base.update({"cx": c.x, "cy": c.y, "cz": c.z,
                         "radius": e.dxf.radius,
                         "start_angle": e.dxf.start_angle,
                         "end_angle": e.dxf.end_angle})
        elif t in ("LWPOLYLINE", "POLYLINE"):
            pts = []
            try:
                pts = [[v[0], v[1]] for v in e.get_points()]
            except Exception:
                pass
            base.update({"points": pts,
                         "closed": e.is_closed if hasattr(e, "is_closed") else False})
        elif t == "TEXT":
            ip = e.dxf.get("insert", (0, 0, 0))
            base.update({"text": e.dxf.get("text", ""),
                         "x": ip[0], "y": ip[1],
                         "height": e.dxf.get("height", 2.5)})
        elif t == "HATCH":
            paths = []
            for bp in e.paths:
                segs = []
                for seg in bp.edges:
                    if hasattr(seg, "start") and hasattr(seg, "end"):
                        segs.append([list(seg.start), list(seg.end)])
                paths.append(segs)
            base.update({"pattern_name": e.dxf.get("pattern_name", ""),
                         "paths": paths})
        else:
            return None
        return base
    except Exception:
        return None


def _load_dxf_to_session(dxf_bytes: bytes) -> Dict[str, Any]:
    """Parse a DXF file and return a session data dict."""
    doc = ezdxf.read(io.StringIO(dxf_bytes.decode("utf-8", errors="replace")))
    msp = doc.modelspace()

    entities = []
    layers_seen = set()
    for e in msp:
        j = _entity_to_json(e, doc)
        if j:
            entities.append(j)
            layers_seen.add(j["layer"])

    layer_list = []
    for lname in doc.layers:
        layer = doc.layers.get(lname)
        layer_list.append({
            "name": lname,
            "color": _color_index_to_hex(layer.color if layer.color > 0 else 7),
            "on": True,
            "frozen": False,
        })

    return {
        "session_id": str(uuid.uuid4()),
        "filename": "uploaded.dxf",
        "entities": entities,
        "layers": layer_list,
        "sections": [],
        "_doc_bytes": dxf_bytes,
    }


# ─────────────────────────────────────────────
#  Upload endpoint (existing)
# ─────────────────────────────────────────────
@app.post("/api/cad/upload")
async def upload_dxf(file: UploadFile = File(...)):
    content = await file.read()
    session = _load_dxf_to_session(content)
    sid = session["session_id"]
    session["filename"] = file.filename
    _sessions[sid] = session
    return {"session_id": sid, "filename": file.filename,
            "entity_count": len(session["entities"]),
            "layers": session["layers"]}


@app.get("/api/cad/drawing/{session_id}")
async def get_drawing(session_id: str):
    s = _sessions.get(session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    return {
        "session_id": s["session_id"],
        "filename": s["filename"],
        "entities": s["entities"],
        "layers": s["layers"],
    }


# ─────────────────────────────────────────────
#  Geometry helpers
# ─────────────────────────────────────────────
Vec2 = np.ndarray  # shape (2,)
Vec3 = np.ndarray  # shape (3,)


def _unit(v: Vec2) -> Vec2:
    n = np.linalg.norm(v)
    return v / n if n > 1e-12 else v


def _perp2d(v: Vec2) -> Vec2:
    """90° counter-clockwise rotation."""
    return np.array([-v[1], v[0]])


def _signed_side(p: Vec2, a: Vec2, b: Vec2) -> float:
    """Sign indicates which side of line AB point P is on."""
    d = b - a
    return float(d[0] * (p[1] - a[1]) - d[1] * (p[0] - a[0]))


def _entity_points_2d(ent: Dict) -> List[Tuple[float, float, float]]:
    """
    Return representative 2D points (x, y, z) from an entity.
    z is taken from the entity's own z coordinate if present.
    """
    t = ent["type"]
    pts: List[Tuple[float, float, float]] = []
    if t == "LINE":
        pts = [(ent["x1"], ent["y1"], ent.get("z1", 0.0)),
               (ent["x2"], ent["y2"], ent.get("z2", 0.0))]
    elif t in ("CIRCLE", "ARC"):
        pts = [(ent["cx"], ent["cy"], ent.get("cz", 0.0))]
    elif t in ("LWPOLYLINE", "POLYLINE"):
        pts = [(p[0], p[1], 0.0) for p in ent.get("points", [])]
    elif t == "TEXT":
        pts = [(ent.get("x", 0), ent.get("y", 0), 0.0)]
    return pts


def _entity_to_shapely(ent: Dict) -> Optional[Any]:
    """Convert entity to a shapely geometry for intersection testing."""
    t = ent["type"]
    try:
        if t == "LINE":
            return LineString([(ent["x1"], ent["y1"]), (ent["x2"], ent["y2"])])
        elif t in ("LWPOLYLINE", "POLYLINE"):
            pts = ent.get("points", [])
            if len(pts) >= 2:
                coords = [(p[0], p[1]) for p in pts]
                if ent.get("closed") and len(coords) >= 3:
                    return Polygon(coords)
                return LineString(coords)
        elif t in ("CIRCLE", "ARC"):
            return Point(ent["cx"], ent["cy"]).buffer(ent["radius"], resolution=32)
    except Exception:
        pass
    return None


def _hatch_pattern_for_layer(layer_name: str) -> str:
    layer_upper = layer_name.upper()
    if any(k in layer_upper for k in ("WALL", "MUUR")):
        return "ANSI31"
    if any(k in layer_upper for k in ("SLAB", "FLOOR", "DALLE")):
        return "ANSI37"
    if any(k in layer_upper for k in ("COL", "COLUMN", "PILLAR", "PILE")):
        return "ANSI31"
    if any(k in layer_upper for k in ("INSUL", "ISOL")):
        return "BATTING"
    if any(k in layer_upper for k in ("STEEL", "STRUCT")):
        return "ANSI33"
    return "ANSI31"


def _round3(v: float) -> float:
    return round(v, 3)


# ─────────────────────────────────────────────
#  Section generation core
# ─────────────────────────────────────────────
def _generate_section(
    entities: List[Dict],
    cut_start: Vec2,
    cut_end: Vec2,
    cut_depth: float,
    cut_height: float,
    view_direction: str,  # "left" or "right"
) -> List[Dict]:
    """
    Core section algorithm.  Returns a list of output entity dicts
    using S-CUT-HEAVY / S-CUT-HATCH / S-VISIBLE / S-ANNOTATION layers.
    """
    cut_vec = cut_end - cut_start          # direction vector of cut line
    cut_unit = _unit(cut_vec)
    cut_perp = _perp2d(cut_unit)           # points "left" of cut line
    cut_len = float(np.linalg.norm(cut_vec))

    # The "view side" normal: left = perp, right = -perp
    side_sign = 1.0 if view_direction == "left" else -1.0
    view_normal = cut_perp * side_sign     # unit vector pointing into the scene

    cut_line_geom = LineString([cut_start.tolist(), cut_end.tolist()])

    # Build spatial index for fast intersection queries
    geoms = []
    valid_ents = []
    for ent in entities:
        g = _entity_to_shapely(ent)
        if g is not None and not g.is_empty:
            geoms.append(g)
            valid_ents.append(ent)

    strtree = STRtree(geoms) if geoms else None

    output: List[Dict] = []

    # ── A) Find cut elements (intersect the cut line) ──────────────────
    if strtree:
        candidate_idxs = strtree.query(cut_line_geom)
    else:
        candidate_idxs = list(range(len(geoms)))

    cut_entity_indices = set()
    for idx in candidate_idxs:
        g = geoms[idx]
        if g.intersects(cut_line_geom):
            cut_entity_indices.add(idx)

    # For each cut entity: emit a heavy outline + a hatch fill symbol
    for idx in cut_entity_indices:
        ent = valid_ents[idx]
        pts_3d = _entity_points_2d(ent)
        if not pts_3d:
            continue

        # Project each point onto section plane
        # projected_x = position along cut line
        # projected_y = z elevation of the entity (or 0 for 2D plans)
        # For a 2D plan (all z=0) we synthesise a wall of cut_height

        x_projs = []
        z_vals = []
        for (px, py, pz) in pts_3d:
            p2 = np.array([px, py])
            proj_x = float(np.dot(p2 - cut_start, cut_unit))
            x_projs.append(proj_x)
            z_vals.append(pz)

        if not x_projs:
            continue

        min_x = _round3(min(x_projs))
        max_x = _round3(max(x_projs))
        min_z = _round3(min(z_vals))
        max_z = _round3(max(z_vals))

        # For 2D plans: extrude to cut_height
        if abs(max_z - min_z) < 1.0:
            max_z = _round3(cut_height)
            min_z = 0.0

        # Width: use entity bounding extent along cut line
        w = max(max_x - min_x, 200.0)  # minimum 200mm width for visibility

        # Heavy cut outline (closed rectangle)
        rect_pts = [
            [min_x, min_z], [min_x + w, min_z],
            [min_x + w, max_z], [min_x, max_z],
        ]
        output.append({
            "type": "LWPOLYLINE",
            "layer": "S-CUT-HEAVY",
            "color": "#FFFFFF",
            "lineweight": 50,   # 0.5mm
            "linetype": "CONTINUOUS",
            "points": [[_round3(p[0]), _round3(p[1])] for p in rect_pts],
            "closed": True,
        })

        # Hatch fill entity (simplified — represented as diagonal lines)
        pattern = _hatch_pattern_for_layer(ent["layer"])
        hatch_spacing = 150.0  # mm
        hatch_angle_rad = math.radians(45)
        hatch_lines = []
        # generate diagonal hatch lines within bounding box
        diag_step = hatch_spacing
        x_range = max_x + w - min_x
        y_range = max_z - min_z
        for offset in np.arange(-(x_range + y_range), x_range + y_range, diag_step):
            # line: x_proj = min_x + t, y_proj = min_z + offset + t (45°)
            x_enter = min_x
            y_enter = min_z + offset
            x_exit = min_x + w
            y_exit = min_z + offset + w

            # clip to rect
            pts_clipped = []
            for (x_, y_) in [(x_enter, y_enter), (x_exit, y_exit)]:
                cx_ = max(min_x, min(min_x + w, x_))
                cy_ = max(min_z, min(max_z, y_))
                pts_clipped.append([_round3(cx_), _round3(cy_)])

            if pts_clipped[0] != pts_clipped[1]:
                hatch_lines.append(pts_clipped)

        for hl in hatch_lines[:60]:  # cap for performance
            output.append({
                "type": "LINE",
                "layer": "S-CUT-HATCH",
                "color": "#888888",
                "lineweight": -1,
                "linetype": "CONTINUOUS",
                "x1": hl[0][0], "y1": hl[0][1], "z1": 0.0,
                "x2": hl[1][0], "y2": hl[1][1], "z2": 0.0,
            })

    # ── B) Visible elements behind the cut ───────────────────────────────
    visible_with_depth: List[Tuple[float, int, Dict]] = []

    for i, ent in enumerate(entities):
        if i in cut_entity_indices:
            continue  # already handled as cut
        pts_3d = _entity_points_2d(ent)
        if not pts_3d:
            continue

        entity_projs = []
        for (px, py, pz) in pts_3d:
            p2 = np.array([px, py])
            # distance along view_normal (depth from cut plane into scene)
            depth = float(np.dot(p2 - cut_start, view_normal))
            if 0 < depth <= cut_depth:
                proj_x = _round3(float(np.dot(p2 - cut_start, cut_unit)))
                proj_y = _round3(pz)
                entity_projs.append((proj_x, proj_y, depth))

        if not entity_projs:
            continue

        avg_depth = sum(d for _, _, d in entity_projs) / len(entity_projs)
        visible_with_depth.append((avg_depth, i, ent))

    # Painter's algo: far → near
    visible_with_depth.sort(key=lambda x: -x[0])

    for depth, i, ent in visible_with_depth:
        pts_3d = _entity_points_2d(ent)
        projected = []
        for (px, py, pz) in pts_3d:
            p2 = np.array([px, py])
            depth_val = float(np.dot(p2 - cut_start, view_normal))
            if 0 < depth_val <= cut_depth:
                proj_x = _round3(float(np.dot(p2 - cut_start, cut_unit)))
                proj_y = _round3(pz)
                projected.append([proj_x, proj_y])

        if len(projected) < 2:
            if len(projected) == 1:
                # Emit as a short stub
                x_, y_ = projected[0]
                output.append({
                    "type": "LINE", "layer": "S-VISIBLE",
                    "color": "#AAAAAA", "lineweight": -1, "linetype": "CONTINUOUS",
                    "x1": x_, "y1": y_, "z1": 0.0,
                    "x2": x_, "y2": y_ + 0.1, "z2": 0.0,
                })
            continue

        t = ent["type"]
        if t == "LINE":
            p1, p2 = projected[0], projected[1]
            output.append({
                "type": "LINE", "layer": "S-VISIBLE",
                "color": "#AAAAAA", "lineweight": -1, "linetype": "CONTINUOUS",
                "x1": p1[0], "y1": p1[1], "z1": 0.0,
                "x2": p2[0], "y2": p2[1], "z2": 0.0,
            })
        elif t in ("LWPOLYLINE", "POLYLINE"):
            output.append({
                "type": "LWPOLYLINE", "layer": "S-VISIBLE",
                "color": "#AAAAAA", "lineweight": -1, "linetype": "CONTINUOUS",
                "points": projected, "closed": False,
            })

    # ── C) Annotation: ground line + section frame ───────────────────────
    # Ground line
    all_x = [e["x1"] for e in output if e["type"] == "LINE" and e["layer"] in ("S-CUT-HEAVY", "S-VISIBLE")]
    if not all_x:
        all_x = [0.0, cut_len]
    gx1 = _round3(min(all_x) - 500)
    gx2 = _round3(max(all_x) + 500)
    output.append({
        "type": "LINE", "layer": "S-ANNOTATION",
        "color": "#444444", "lineweight": 100, "linetype": "CONTINUOUS",
        "x1": gx1, "y1": -100.0, "z1": 0.0,
        "x2": gx2, "y2": -100.0, "z2": 0.0,
    })

    # GL label
    output.append({
        "type": "TEXT", "layer": "S-ANNOTATION",
        "color": "#FFFFFF", "lineweight": -1, "linetype": "CONTINUOUS",
        "text": "GL ±0.000", "x": gx1, "y": -300.0, "height": 200.0,
    })

    # Floor level label if cut_height > 0
    fl_y = _round3(cut_height)
    output.append({
        "type": "TEXT", "layer": "S-ANNOTATION",
        "color": "#FFFFFF", "lineweight": -1, "linetype": "CONTINUOUS",
        "text": f"FL +{cut_height/1000:.3f}", "x": gx1, "y": fl_y + 50, "height": 200.0,
    })

    return output


# ─────────────────────────────────────────────
#  Elevation generation core
# ─────────────────────────────────────────────
def _generate_elevation(
    entities: List[Dict],
    view_dir: np.ndarray,   # unit vector, looking direction
    origin: np.ndarray,     # 2D origin point on view plane
    view_width: float,
    view_height: float,
) -> List[Dict]:
    """
    Parallel-projection elevation generator.
    Projects all geometry onto plane perpendicular to view_dir.
    """
    # Basis vectors
    up3 = np.array([0.0, 0.0, 1.0])
    vd3 = np.array([view_dir[0], view_dir[1], 0.0])  # treat as 2D in XY
    vd3_unit = _unit(vd3[:2])

    # right = 90° CW from view_dir in XY
    right2 = _perp2d(vd3_unit) * -1.0  # CW

    output: List[Dict] = []
    projected_with_depth: List[Tuple[float, Dict]] = []

    for ent in entities:
        pts_3d = _entity_points_2d(ent)
        if not pts_3d:
            continue

        proj_pts = []
        depths = []
        for (px, py, pz) in pts_3d:
            p2 = np.array([px, py])
            d2 = p2 - origin
            depth = float(np.dot(d2, vd3_unit))
            px_proj = _round3(float(np.dot(d2, right2)))
            py_proj = _round3(pz)
            proj_pts.append([px_proj, py_proj])
            depths.append(depth)

        if not proj_pts:
            continue

        # Filter to view frustum
        in_view = [
            p for p in proj_pts
            if -view_width / 2 <= p[0] <= view_width / 2
            and 0 <= p[1] <= view_height
        ]
        if not in_view:
            continue

        avg_depth = sum(depths) / len(depths)

        t = ent["type"]
        if t == "LINE" and len(proj_pts) >= 2:
            projected_with_depth.append((avg_depth, {
                "type": "LINE", "layer": "E-VISIBLE",
                "color": "#DDDDDD", "lineweight": -1, "linetype": "CONTINUOUS",
                "x1": proj_pts[0][0], "y1": proj_pts[0][1], "z1": 0.0,
                "x2": proj_pts[1][0], "y2": proj_pts[1][1], "z2": 0.0,
            }))
        elif t in ("LWPOLYLINE", "POLYLINE") and len(proj_pts) >= 2:
            projected_with_depth.append((avg_depth, {
                "type": "LWPOLYLINE", "layer": "E-VISIBLE",
                "color": "#DDDDDD", "lineweight": -1, "linetype": "CONTINUOUS",
                "points": proj_pts, "closed": ent.get("closed", False),
            }))
        elif t in ("CIRCLE", "ARC"):
            projected_with_depth.append((avg_depth, {
                "type": "TEXT", "layer": "E-VISIBLE",
                "color": "#DDDDDD", "lineweight": -1, "linetype": "CONTINUOUS",
                "text": "⊙", "x": proj_pts[0][0], "y": proj_pts[0][1], "height": 200.0,
            }))

    # Painter's algo
    projected_with_depth.sort(key=lambda x: -x[0])
    for _, ent_out in projected_with_depth:
        output.append(ent_out)

    # Ground line
    gx1 = _round3(-view_width / 2)
    gx2 = _round3(view_width / 2)
    output.append({
        "type": "LINE", "layer": "E-ANNOTATION",
        "color": "#444444", "lineweight": 100, "linetype": "CONTINUOUS",
        "x1": gx1, "y1": -100.0, "z1": 0.0,
        "x2": gx2, "y2": -100.0, "z2": 0.0,
    })
    output.append({
        "type": "TEXT", "layer": "E-ANNOTATION",
        "color": "#FFFFFF", "lineweight": -1, "linetype": "CONTINUOUS",
        "text": "GL ±0.000", "x": gx1, "y": -350.0, "height": 200.0,
    })

    return output


# ─────────────────────────────────────────────
#  Section markers for original plan
# ─────────────────────────────────────────────
def _build_section_markers(
    cut_start: np.ndarray,
    cut_end: np.ndarray,
    label: str,
) -> List[Dict]:
    """Generate section marker bubbles and dashed cut line for the plan."""
    markers = []
    radius = 500.0  # mm

    for pt, side_label in [(cut_start, label), (cut_end, label)]:
        # Circle bubble
        markers.append({
            "type": "CIRCLE", "layer": "A-SECT-MARK",
            "color": "#FF4444", "lineweight": 25, "linetype": "CONTINUOUS",
            "cx": _round3(float(pt[0])), "cy": _round3(float(pt[1])), "cz": 0.0,
            "radius": radius,
        })
        # Label text
        markers.append({
            "type": "TEXT", "layer": "A-SECT-MARK",
            "color": "#FF4444", "lineweight": -1, "linetype": "CONTINUOUS",
            "text": side_label,
            "x": _round3(float(pt[0]) - 150),
            "y": _round3(float(pt[1]) - 150),
            "height": 300.0,
        })

    # Dashed cut line between the two bubbles
    cut_unit = _unit(cut_end - cut_start)
    dash_start = cut_start + cut_unit * radius
    dash_end = cut_end - cut_unit * radius
    markers.append({
        "type": "LINE", "layer": "A-SECT-MARK",
        "color": "#FF4444", "lineweight": 25, "linetype": "DASHED",
        "x1": _round3(float(dash_start[0])), "y1": _round3(float(dash_start[1])), "z1": 0.0,
        "x2": _round3(float(dash_end[0])),   "y2": _round3(float(dash_end[1])),   "z2": 0.0,
    })

    return markers


# ─────────────────────────────────────────────
#  Section endpoint
# ─────────────────────────────────────────────
@app.post("/api/cad/section")
async def create_section(req: SectionRequest):
    source = _sessions.get(req.session_id)
    if not source:
        raise HTTPException(404, "Session not found")

    cut_start = np.array(req.cut_line.start, dtype=float)
    cut_end = np.array(req.cut_line.end, dtype=float)

    # Derive label (A, B, C … based on existing section count)
    section_count = len(source.get("sections", []))
    label = chr(ord("A") + section_count % 26)
    cut_label = f"{label}-{label}"

    entities_out = _generate_section(
        entities=source["entities"],
        cut_start=cut_start,
        cut_end=cut_end,
        cut_depth=req.cut_depth,
        cut_height=req.cut_height,
        view_direction=req.view_direction,
    )

    # Add section markers to the source session's entities
    markers = _build_section_markers(cut_start, cut_end, label)
    source["entities"].extend(markers)

    section_session_id = f"section-{uuid.uuid4()}"
    layers = [
        {"name": "S-CUT-HEAVY", "color": "#FFFFFF", "on": True, "frozen": False},
        {"name": "S-CUT-HATCH", "color": "#888888", "on": True, "frozen": False},
        {"name": "S-VISIBLE",   "color": "#AAAAAA", "on": True, "frozen": False},
        {"name": "S-ANNOTATION","color": "#FFFF00", "on": True, "frozen": False},
    ]

    section_data = {
        "session_id": section_session_id,
        "filename": f"SECTION_{cut_label}.dxf",
        "entities": entities_out,
        "layers": layers,
        "section_meta": {
            "cut_line_start": list(cut_start),
            "cut_line_end": list(cut_end),
            "cut_direction_label": cut_label,
            "view_direction": req.view_direction,
            "scale": 0.02,
            "type": "section",
        },
    }

    # Store in generated views
    _sessions[section_session_id] = section_data
    source.setdefault("sections", []).append({
        "session_id": section_session_id,
        "label": cut_label,
        "type": "section",
        "cut_line_start": list(cut_start),
        "cut_line_end": list(cut_end),
        "entity_count": len(entities_out),
    })

    return section_data


# ─────────────────────────────────────────────
#  Elevation endpoint
# ─────────────────────────────────────────────
@app.post("/api/cad/elevation")
async def create_elevation(req: ElevationRequest):
    source = _sessions.get(req.session_id)
    if not source:
        raise HTTPException(404, "Session not found")

    view_dir = np.array(req.view_direction, dtype=float)
    origin = np.array(req.view_plane_origin, dtype=float)

    entities_out = _generate_elevation(
        entities=source["entities"],
        view_dir=view_dir,
        origin=origin,
        view_width=req.view_width,
        view_height=req.view_height,
    )

    elev_session_id = f"elevation-{uuid.uuid4()}"
    layers = [
        {"name": "E-VISIBLE",    "color": "#DDDDDD", "on": True, "frozen": False},
        {"name": "E-ANNOTATION", "color": "#FFFF00", "on": True, "frozen": False},
    ]

    elev_data = {
        "session_id": elev_session_id,
        "filename": f"{req.view_name.replace(' ', '_')}.dxf",
        "entities": entities_out,
        "layers": layers,
        "section_meta": {
            "cut_line_start": list(origin),
            "cut_line_end": [origin[0] + req.view_width, origin[1]],
            "cut_direction_label": req.view_name,
            "view_direction": str(req.view_direction),
            "scale": 0.02,
            "type": "elevation",
        },
    }

    _sessions[elev_session_id] = elev_data
    source.setdefault("sections", []).append({
        "session_id": elev_session_id,
        "label": req.view_name,
        "type": "elevation",
        "cut_line_start": list(origin),
        "cut_line_end": [origin[0] + req.view_width, origin[1]],
        "entity_count": len(entities_out),
    })

    return elev_data


# ─────────────────────────────────────────────
#  Generated views listing / deletion
# ─────────────────────────────────────────────
@app.get("/api/cad/sections/{session_id}")
async def list_sections(session_id: str):
    s = _sessions.get(session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    return {"sections": s.get("sections", [])}


@app.delete("/api/cad/section/{section_session_id}")
async def delete_section(section_session_id: str):
    if section_session_id not in _sessions:
        raise HTTPException(404, "Section session not found")
    del _sessions[section_session_id]
    # Remove from parent sessions
    for sid, sess in _sessions.items():
        if "sections" in sess:
            sess["sections"] = [
                s for s in sess["sections"]
                if s["session_id"] != section_session_id
            ]
    return {"deleted": section_session_id}


# ─────────────────────────────────────────────
#  DXF export
# ─────────────────────────────────────────────
@app.post("/api/cad/export/{session_id}")
async def export_dxf(session_id: str):
    s = _sessions.get(session_id)
    if not s:
        raise HTTPException(404, "Session not found")

    doc = ezdxf.new("R2010")
    msp = doc.modelspace()

    # Create layers
    for layer_info in s.get("layers", []):
        lname = layer_info["name"]
        if lname not in doc.layers:
            doc.layers.add(lname)

    for ent in s.get("entities", []):
        layer = ent.get("layer", "0")
        t = ent.get("type")
        try:
            if t == "LINE":
                msp.add_line(
                    (ent["x1"], ent["y1"], ent.get("z1", 0)),
                    (ent["x2"], ent["y2"], ent.get("z2", 0)),
                    dxfattribs={"layer": layer},
                )
            elif t == "LWPOLYLINE":
                pts = [(p[0], p[1]) for p in ent.get("points", [])]
                if len(pts) >= 2:
                    poly = msp.add_lwpolyline(pts, dxfattribs={"layer": layer})
                    if ent.get("closed"):
                        poly.closed = True
            elif t == "CIRCLE":
                msp.add_circle(
                    (ent["cx"], ent["cy"], ent.get("cz", 0)),
                    ent["radius"],
                    dxfattribs={"layer": layer},
                )
            elif t == "TEXT":
                msp.add_text(
                    ent.get("text", ""),
                    dxfattribs={
                        "layer": layer,
                        "insert": (ent.get("x", 0), ent.get("y", 0)),
                        "height": ent.get("height", 2.5),
                    },
                )
        except Exception:
            pass

    # ezdxf writes text; wrap in StringIO then encode to bytes for download
    strbuf = io.StringIO()
    doc.write(strbuf)
    raw = strbuf.getvalue().encode("utf-8")
    bytebuf = io.BytesIO(raw)
    filename = s.get("filename", "export.dxf")
    return StreamingResponse(
        bytebuf,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
