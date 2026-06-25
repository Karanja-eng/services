"""
CAD Backend — Principal 3D CAD & BIM Rendering Engine
FastAPI + ezdxf solid surface extraction with material hint inference.
"""
from __future__ import annotations

import logging
import math
import traceback
from pathlib import Path
from typing import Any

import ezdxf
import numpy as np
from ezdxf.document import Drawing
from ezdxf.entities import (
    DXFEntity,
    Face3d,
    Insert,
    LWPolyline,
    Line,
    Circle,
    Mesh,
    PolyFaceMesh,
    Solid,
    Text,
    MText,
)
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="CAD Rendering Engine", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Material hint inference
# ---------------------------------------------------------------------------
MATERIAL_RULES: list[tuple[list[str], str]] = [
    (["WALL"], "concrete"),
    (["GLAZ", "WIND", "GLASS"], "glass"),
    (["ROOF", "SLAB", "CEIL"], "concrete"),
    (["STEEL", "STL", "METAL"], "metal"),
    (["WOOD", "FLOR", "FLOOR", "TIMBER"], "wood"),
    (["FURN", "FURNITURE"], "plastic"),
]


def material_hint_from_layer(layer_name: str) -> str:
    upper = layer_name.upper()
    for keywords, hint in MATERIAL_RULES:
        if any(kw in upper for kw in keywords):
            return hint
    return "generic"


# ---------------------------------------------------------------------------
# Math helpers
# ---------------------------------------------------------------------------
def cross(a: list[float], b: list[float]) -> list[float]:
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]


def sub(a: list[float], b: list[float]) -> list[float]:
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]


def normalize(v: list[float]) -> list[float]:
    mag = math.sqrt(sum(x * x for x in v))
    if mag < 1e-10:
        return [0.0, 0.0, 1.0]
    return [x / mag for x in v]


def face_normal(verts: list[list[float]]) -> list[float]:
    """Compute face normal from first 3 vertices (Newell's method for robustness)."""
    if len(verts) < 3:
        return [0.0, 0.0, 1.0]
    n = [0.0, 0.0, 0.0]
    count = len(verts)
    for i in range(count):
        curr = verts[i]
        nxt = verts[(i + 1) % count]
        n[0] += (curr[1] - nxt[1]) * (curr[2] + nxt[2])
        n[1] += (curr[2] - nxt[2]) * (curr[0] + nxt[0])
        n[2] += (curr[0] - nxt[0]) * (curr[1] + nxt[1])
    return normalize(n)


def vec3(pt: Any) -> list[float]:
    try:
        return [float(pt[0]), float(pt[1]), float(pt[2])]
    except Exception:
        return [float(pt[0]), float(pt[1]), 0.0]


def dxf_color_to_hex(color_index: int) -> str:
    """Convert ACI color index to hex string (simplified)."""
    ACI = {
        1: "#ff0000", 2: "#ffff00", 3: "#00ff00", 4: "#00ffff",
        5: "#0000ff", 6: "#ff00ff", 7: "#ffffff", 8: "#808080",
        9: "#c0c0c0",
    }
    return ACI.get(color_index, "#cccccc")


# ---------------------------------------------------------------------------
# Entity extractors
# ---------------------------------------------------------------------------

def extract_face3d(entity: Face3d, doc: Drawing) -> dict | None:
    try:
        layer = entity.dxf.layer
        v = [
            vec3(entity.dxf.vtx0),
            vec3(entity.dxf.vtx1),
            vec3(entity.dxf.vtx2),
            vec3(entity.dxf.vtx3),
        ]
        # Degenerate triangle: v3 == v4
        if v[2] == v[3]:
            verts = v[:3]
        else:
            verts = v
        normal = face_normal(verts)
        color = dxf_color_to_hex(entity.dxf.get("color", 7))
        return {
            "type": "FACE3D",
            "vertices": verts,
            "normal": normal,
            "layer": layer,
            "color": color,
            "material_hint": material_hint_from_layer(layer),
        }
    except Exception as exc:
        log.warning("FACE3D parse error: %s", exc)
        return None


def extract_solid_2d(entity: Solid, doc: Drawing) -> dict | None:
    """2D SOLID — flat quad at elevation with bow-tie winding correction."""
    try:
        layer = entity.dxf.layer
        elev = float(entity.dxf.get("elevation", 0.0))
        # DXF SOLID winding: p1,p2,p4,p3 (bow-tie), correct to p1,p2,p3,p4
        pts = [
            entity.dxf.vtx0,
            entity.dxf.vtx1,
            entity.dxf.vtx3,  # swap 3 and 4
            entity.dxf.vtx2,
        ]
        verts = [[float(p[0]), float(p[1]), float(p[2]) if len(p) > 2 else elev] for p in pts]
        for v in verts:
            if v[2] == 0.0:
                v[2] = elev
        normal = face_normal(verts)
        color = dxf_color_to_hex(entity.dxf.get("color", 7))
        return {
            "type": "FACE3D",
            "vertices": verts,
            "normal": normal,
            "layer": layer,
            "color": color,
            "material_hint": material_hint_from_layer(layer),
        }
    except Exception as exc:
        log.warning("SOLID parse error: %s", exc)
        return None


def _triangulate_quad(i0: int, i1: int, i2: int, i3: int,
                       verts: list[list[float]]) -> list[list[int]]:
    """Split quad into 2 triangles along the shorter diagonal."""
    d02 = sum((verts[i0][k] - verts[i2][k]) ** 2 for k in range(3))
    d13 = sum((verts[i1][k] - verts[i3][k]) ** 2 for k in range(3))
    if d02 <= d13:
        return [[i0, i1, i2], [i0, i2, i3]]
    else:
        return [[i0, i1, i3], [i1, i2, i3]]


def extract_mesh(entity: Mesh, doc: Drawing) -> dict | None:
    try:
        layer = entity.dxf.layer
        verts = [vec3(v) for v in entity.vertices]
        faces: list[list[int]] = []
        for f in entity.faces:
            fi = list(f)
            if len(fi) == 3:
                faces.append(fi)
            elif len(fi) == 4:
                faces.extend(_triangulate_quad(fi[0], fi[1], fi[2], fi[3], verts))
            elif len(fi) > 4:
                # fan triangulation
                for k in range(1, len(fi) - 1):
                    faces.append([fi[0], fi[k], fi[k + 1]])
        color = dxf_color_to_hex(entity.dxf.get("color", 7))
        return {
            "type": "MESH3D",
            "vertices": verts,
            "faces": faces,
            "layer": layer,
            "color": color,
            "material_hint": material_hint_from_layer(layer),
        }
    except Exception as exc:
        log.warning("MESH parse error: %s", exc)
        return None


def extract_polyface(entity: PolyFaceMesh, doc: Drawing) -> dict | None:
    try:
        layer = entity.dxf.layer
        indexed = list(entity.indexed_faces())
        all_verts: list[list[float]] = []
        vert_map: dict[int, int] = {}
        faces: list[list[int]] = []
        for face in indexed:
            local_indices: list[int] = []
            for vi, vert in enumerate(face.vertices):
                key = id(vert)
                if key not in vert_map:
                    vert_map[key] = len(all_verts)
                    all_verts.append(vec3(vert.dxf.location))
                local_indices.append(vert_map[key])
            if len(local_indices) == 3:
                faces.append(local_indices)
            elif len(local_indices) == 4:
                faces.extend(_triangulate_quad(*local_indices, all_verts))
        if not all_verts:
            return None
        color = dxf_color_to_hex(entity.dxf.get("color", 7))
        return {
            "type": "MESH3D",
            "vertices": all_verts,
            "faces": faces,
            "layer": layer,
            "color": color,
            "material_hint": material_hint_from_layer(layer),
        }
    except Exception as exc:
        log.warning("POLYFACE parse error: %s", exc)
        return None


def extract_3dsolid(entity: DXFEntity, doc: Drawing) -> dict | None:
    """Attempt ACIS parse; fall back to bounding box wireframe placeholder."""
    layer = getattr(entity.dxf, "layer", "0")
    try:
        import pyacis  # type: ignore
        sat_data = "\n".join(entity.acis_data)
        body = pyacis.parse(sat_data)
        verts = [[float(v.x), float(v.y), float(v.z)] for v in body.vertices]
        faces = [[int(i) for i in f.indices] for f in body.faces]
        color = dxf_color_to_hex(entity.dxf.get("color", 7))
        return {
            "type": "MESH3D",
            "vertices": verts,
            "faces": faces,
            "layer": layer,
            "color": color,
            "material_hint": material_hint_from_layer(layer),
        }
    except ImportError:
        log.info("3DSOLID/REGION: pyacis not available, using bounding box placeholder for handle=%s",
                 entity.dxf.handle)
    except Exception as exc:
        log.warning("3DSOLID ACIS parse failed (handle=%s): %s", entity.dxf.handle, exc)

    # Bounding box wireframe fallback
    try:
        bbox = ezdxf.bbox.extents([entity])
        if bbox.empty:
            return None
        mn, mx = bbox.extmin, bbox.extmax
        # 8 corners
        corners = [
            [mn.x, mn.y, mn.z], [mx.x, mn.y, mn.z],
            [mx.x, mx.y, mn.z], [mn.x, mx.y, mn.z],
            [mn.x, mn.y, mx.z], [mx.x, mn.y, mx.z],
            [mx.x, mx.y, mx.z], [mn.x, mx.y, mx.z],
        ]
        # 12 triangles (2 per box face)
        box_faces = [
            [0,1,2],[0,2,3],  # bottom
            [4,5,6],[4,6,7],  # top
            [0,1,5],[0,5,4],  # front
            [2,3,7],[2,7,6],  # back
            [1,2,6],[1,6,5],  # right
            [0,3,7],[0,7,4],  # left
        ]
        color = dxf_color_to_hex(entity.dxf.get("color", 7))
        return {
            "type": "MESH3D",
            "vertices": corners,
            "faces": box_faces,
            "layer": layer,
            "color": color,
            "material_hint": material_hint_from_layer(layer),
            "placeholder": True,
        }
    except Exception as exc2:
        log.warning("3DSOLID bounding box fallback failed: %s", exc2)
        return None


def _circle_ring(cx: float, cy: float, cz: float, r: float,
                 z_bottom: float, z_top: float, segments: int = 32
                 ) -> tuple[list[list[float]], list[list[int]]]:
    """Generate cylinder mesh for circle with thickness."""
    verts: list[list[float]] = []
    faces: list[list[int]] = []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        x = cx + r * math.cos(a)
        y = cy + r * math.sin(a)
        verts.append([x, y, z_bottom])  # 2*i
        verts.append([x, y, z_top])     # 2*i+1
    for i in range(segments):
        ni = (i + 1) % segments
        b0, t0 = 2 * i, 2 * i + 1
        b1, t1 = 2 * ni, 2 * ni + 1
        faces.append([b0, b1, t1])
        faces.append([b0, t1, t0])
    # Cap bottom
    cap_center_b = len(verts)
    verts.append([cx, cy, z_bottom])
    cap_center_t = len(verts)
    verts.append([cx, cy, z_top])
    for i in range(segments):
        ni = (i + 1) % segments
        faces.append([cap_center_b, 2 * ni, 2 * i])
        faces.append([cap_center_t, 2 * i + 1, 2 * ni + 1])
    return verts, faces


def extract_lwpolyline_with_thickness(entity: LWPolyline, doc: Drawing) -> dict | None:
    try:
        layer = entity.dxf.layer
        thickness = float(entity.dxf.get("thickness", 0.0))
        elevation = float(entity.dxf.get("elevation", 0.0))
        if abs(thickness) < 1e-6:
            return None
        pts = list(entity.get_points("xy"))
        if len(pts) < 2:
            return None
        if entity.closed and pts[0] != pts[-1]:
            pts.append(pts[0])
        z0, z1 = elevation, elevation + thickness
        all_verts: list[list[float]] = []
        all_faces: list[list[int]] = []
        for i in range(len(pts) - 1):
            x0, y0 = pts[i][0], pts[i][1]
            x1, y1 = pts[i + 1][0], pts[i + 1][1]
            base = len(all_verts)
            all_verts += [
                [x0, y0, z0], [x1, y1, z0],
                [x1, y1, z1], [x0, y0, z1],
            ]
            all_faces += [[base, base+1, base+2], [base, base+2, base+3]]
        color = dxf_color_to_hex(entity.dxf.get("color", 7))
        return {
            "type": "MESH3D",
            "vertices": all_verts,
            "faces": all_faces,
            "layer": layer,
            "color": color,
            "material_hint": material_hint_from_layer(layer),
        }
    except Exception as exc:
        log.warning("LWPOLYLINE thickness parse error: %s", exc)
        return None


def extract_line_with_thickness(entity: Line, doc: Drawing) -> dict | None:
    try:
        thickness = float(entity.dxf.get("thickness", 0.0))
        if abs(thickness) < 1e-6:
            return None
        layer = entity.dxf.layer
        s = entity.dxf.start
        e = entity.dxf.end
        # Ribbon: extrude along Z by thickness
        verts = [
            [s.x, s.y, s.z],
            [e.x, e.y, e.z],
            [e.x, e.y, e.z + thickness],
            [s.x, s.y, s.z + thickness],
        ]
        faces = [[0, 1, 2], [0, 2, 3]]
        color = dxf_color_to_hex(entity.dxf.get("color", 7))
        return {
            "type": "MESH3D",
            "vertices": verts,
            "faces": faces,
            "layer": layer,
            "color": color,
            "material_hint": material_hint_from_layer(layer),
        }
    except Exception as exc:
        log.warning("LINE thickness parse error: %s", exc)
        return None


def extract_circle_with_thickness(entity: Circle, doc: Drawing) -> dict | None:
    try:
        thickness = float(entity.dxf.get("thickness", 0.0))
        if abs(thickness) < 1e-6:
            return None
        layer = entity.dxf.layer
        c = entity.dxf.center
        r = float(entity.dxf.radius)
        z0 = float(c.z)
        z1 = z0 + thickness
        verts, faces = _circle_ring(float(c.x), float(c.y), z0, r, z0, z1)
        color = dxf_color_to_hex(entity.dxf.get("color", 7))
        return {
            "type": "MESH3D",
            "vertices": verts,
            "faces": faces,
            "layer": layer,
            "color": color,
            "material_hint": material_hint_from_layer(layer),
        }
    except Exception as exc:
        log.warning("CIRCLE thickness parse error: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Wireframe / 2D entity extractors (legacy)
# ---------------------------------------------------------------------------

def _aci_to_hex(idx: int) -> str:
    return dxf_color_to_hex(idx)


def extract_wire_entities(msp, doc: Drawing) -> list[dict]:
    entities = []
    for e in msp:
        dxftype = e.dxftype()
        layer = e.dxf.get("layer", "0")
        color = _aci_to_hex(e.dxf.get("color", 7))
        try:
            if dxftype == "LINE":
                s, en = e.dxf.start, e.dxf.end
                entities.append({
                    "type": "LINE",
                    "start": [float(s.x), float(s.y), float(s.z)],
                    "end": [float(en.x), float(en.y), float(en.z)],
                    "layer": layer, "color": color,
                })
            elif dxftype == "CIRCLE":
                c = e.dxf.center
                entities.append({
                    "type": "CIRCLE",
                    "center": [float(c.x), float(c.y), float(c.z)],
                    "radius": float(e.dxf.radius),
                    "layer": layer, "color": color,
                })
            elif dxftype == "ARC":
                c = e.dxf.center
                entities.append({
                    "type": "ARC",
                    "center": [float(c.x), float(c.y), float(c.z)],
                    "radius": float(e.dxf.radius),
                    "start_angle": float(e.dxf.start_angle),
                    "end_angle": float(e.dxf.end_angle),
                    "layer": layer, "color": color,
                })
            elif dxftype == "LWPOLYLINE":
                pts = list(e.get_points("xy"))
                entities.append({
                    "type": "POLYLINE",
                    "points": [[p[0], p[1], 0.0] for p in pts],
                    "closed": e.closed,
                    "layer": layer, "color": color,
                })
            elif dxftype == "SPLINE":
                pts = list(e.flattening(0.01))
                entities.append({
                    "type": "POLYLINE",
                    "points": [[p[0], p[1], p[2] if len(p) > 2 else 0.0] for p in pts],
                    "closed": False,
                    "layer": layer, "color": color,
                })
            elif dxftype == "TEXT":
                ip = e.dxf.insert
                entities.append({
                    "type": "TEXT",
                    "text": e.dxf.text,
                    "position": [float(ip.x), float(ip.y), float(ip.z)],
                    "height": float(e.dxf.get("height", 1.0)),
                    "layer": layer, "color": color,
                })
            elif dxftype == "MTEXT":
                ip = e.dxf.insert
                entities.append({
                    "type": "TEXT",
                    "text": e.plain_mtext(),
                    "position": [float(ip.x), float(ip.y), float(ip.z)],
                    "height": float(e.dxf.get("char_height", 1.0)),
                    "layer": layer, "color": color,
                })
        except Exception:
            pass
    return entities


# ---------------------------------------------------------------------------
# Main extraction pipeline
# ---------------------------------------------------------------------------

def extract_all_entities(doc: Drawing) -> dict:
    msp = doc.modelspace()
    solid_entities: list[dict] = []
    wire_entities: list[dict] = []
    unparsed_handles: list[str] = []

    for entity in msp:
        dxftype = entity.dxftype()
        result: dict | None = None

        if dxftype == "3DFACE":
            result = extract_face3d(entity, doc)
        elif dxftype == "SOLID":
            result = extract_solid_2d(entity, doc)
        elif dxftype == "MESH":
            result = extract_mesh(entity, doc)
        elif dxftype == "POLYFACE MESH":
            result = extract_polyface(entity, doc)
        elif dxftype in ("3DSOLID", "REGION"):
            result = extract_3dsolid(entity, doc)
            if result and result.get("placeholder"):
                log.info("3DSOLID handle=%s rendered as bounding box placeholder",
                         entity.dxf.handle)
        elif dxftype == "LWPOLYLINE":
            thick_result = extract_lwpolyline_with_thickness(entity, doc)
            if thick_result:
                solid_entities.append(thick_result)
            # Also emit as wire
            try:
                layer = entity.dxf.layer
                color = dxf_color_to_hex(entity.dxf.get("color", 7))
                pts = list(entity.get_points("xy"))
                wire_entities.append({
                    "type": "POLYLINE",
                    "points": [[p[0], p[1], 0.0] for p in pts],
                    "closed": entity.closed,
                    "layer": layer, "color": color,
                })
            except Exception:
                pass
            continue
        elif dxftype == "LINE":
            thick_result = extract_line_with_thickness(entity, doc)
            if thick_result:
                solid_entities.append(thick_result)
            # Also emit wire
            try:
                s, e2 = entity.dxf.start, entity.dxf.end
                wire_entities.append({
                    "type": "LINE",
                    "start": [float(s.x), float(s.y), float(s.z)],
                    "end": [float(e2.x), float(e2.y), float(e2.z)],
                    "layer": entity.dxf.layer,
                    "color": dxf_color_to_hex(entity.dxf.get("color", 7)),
                })
            except Exception:
                pass
            continue
        elif dxftype == "CIRCLE":
            thick_result = extract_circle_with_thickness(entity, doc)
            if thick_result:
                solid_entities.append(thick_result)
            try:
                c = entity.dxf.center
                wire_entities.append({
                    "type": "CIRCLE",
                    "center": [float(c.x), float(c.y), float(c.z)],
                    "radius": float(entity.dxf.radius),
                    "layer": entity.dxf.layer,
                    "color": dxf_color_to_hex(entity.dxf.get("color", 7)),
                })
            except Exception:
                pass
            continue

        if result is not None:
            solid_entities.append(result)
        elif dxftype not in (
            "LINE", "CIRCLE", "ARC", "LWPOLYLINE", "TEXT", "MTEXT",
            "SPLINE", "DIMENSION", "INSERT", "ATTDEF", "VIEWPORT",
            "HATCH", "LEADER", "SOLID", "3DFACE", "MESH",
            "POLYFACE MESH", "3DSOLID", "REGION",
        ):
            unparsed_handles.append(f"{dxftype}#{entity.dxf.handle}")

    # Collect wire entities for everything else
    wire_entities += extract_wire_entities(msp, doc)

    if unparsed_handles:
        log.warning("Unparsed entity handles: %s", ", ".join(unparsed_handles[:20]))

    # Compute scene bounding box
    all_pts: list[list[float]] = []
    for ent in solid_entities:
        if ent["type"] in ("FACE3D", "MESH3D"):
            all_pts.extend(ent.get("vertices", []))

    bbox = None
    if all_pts:
        arr = np.array(all_pts)
        mn = arr.min(axis=0).tolist()
        mx = arr.max(axis=0).tolist()
        bbox = {"min": mn, "max": mx}

    # Triangle count warning
    total_tris = 0
    for ent in solid_entities:
        if ent["type"] == "FACE3D":
            n = len(ent["vertices"])
            total_tris += 2 if n == 4 else 1
        elif ent["type"] == "MESH3D":
            total_tris += len(ent.get("faces", []))

    return {
        "solid_entities": solid_entities,
        "wire_entities": wire_entities,
        "bbox": bbox,
        "stats": {
            "solid_count": len(solid_entities),
            "wire_count": len(wire_entities),
            "total_triangles": total_tris,
            "triangle_warning": total_tris > 500_000,
            "unparsed_count": len(unparsed_handles),
        },
    }


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}


@app.post("/parse-dxf")
async def parse_dxf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith((".dxf", ".dwg")):
        raise HTTPException(400, "Only DXF/DWG files supported")
    data = await file.read()
    try:
        import io
        doc = ezdxf.read(io.BytesIO(data))
    except Exception as exc:
        log.error("DXF read error: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(422, f"DXF parse failed: {exc}")

    result = extract_all_entities(doc)

    stats = result["stats"]
    log.info(
        "Parsed DXF: %d solid, %d wire, %d triangles%s%s",
        stats["solid_count"],
        stats["wire_count"],
        stats["total_triangles"],
        " ⚠ TRIANGLE LIMIT EXCEEDED" if stats["triangle_warning"] else "",
        f" ({stats['unparsed_count']} unparsed)" if stats["unparsed_count"] else "",
    )

    return JSONResponse(content=result)


@app.post("/parse-ifc")
async def parse_ifc(file: UploadFile = File(...)):
    """IFC parsing via ifcopenshell (optional dependency)."""
    try:
        import ifcopenshell  # type: ignore
        import ifcopenshell.geom  # type: ignore
    except ImportError:
        raise HTTPException(501, "ifcopenshell not installed")

    data = await file.read()
    import tempfile, os
    with tempfile.NamedTemporaryFile(suffix=".ifc", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        ifc = ifcopenshell.open(tmp_path)
        settings = ifcopenshell.geom.settings()
        settings.set(settings.USE_WORLD_COORDS, True)

        solid_entities: list[dict] = []
        for product in ifc.by_type("IfcProduct"):
            try:
                shape = ifcopenshell.geom.create_shape(settings, product)
                verts_flat = shape.geometry.verts
                faces_flat = shape.geometry.faces
                verts = [[verts_flat[i], verts_flat[i+1], verts_flat[i+2]]
                         for i in range(0, len(verts_flat), 3)]
                faces = [[faces_flat[i], faces_flat[i+1], faces_flat[i+2]]
                          for i in range(0, len(faces_flat), 3)]
                layer = getattr(product, "ObjectType", "IFC") or "IFC"
                solid_entities.append({
                    "type": "MESH3D",
                    "vertices": verts,
                    "faces": faces,
                    "layer": layer,
                    "color": "#cccccc",
                    "material_hint": material_hint_from_layer(layer),
                })
            except Exception:
                pass
    finally:
        os.unlink(tmp_path)

    return JSONResponse(content={
        "solid_entities": solid_entities,
        "wire_entities": [],
        "bbox": None,
        "stats": {"solid_count": len(solid_entities), "wire_count": 0},
    })
