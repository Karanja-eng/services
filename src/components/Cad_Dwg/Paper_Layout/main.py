"""
CAD DXF Parser Backend — FastAPI + ezdxf
Full Paper Space Layout Support
"""

from __future__ import annotations

import io
import math
import re
from typing import Any, Optional

import ezdxf
from ezdxf.document import Drawing
from ezdxf.layouts import Layout, Paperspace
from ezdxf.entities import (
    DXFGraphic, Insert, LWPolyline, Polyline, Line, Circle, Arc,
    Ellipse, Spline, MText, Text, Hatch, Dimension, Viewport, Face3d,
    Mesh, Solid, Trace, Point,
)
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="CAD DXF Parser", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Scale helpers
# ---------------------------------------------------------------------------

_KNOWN_SCALES: dict[float, str] = {
    0.001: "1:1000",
    0.002: "1:500",
    0.005: "1:200",
    0.01:  "1:100",
    0.02:  "1:50",
    0.05:  "1:20",
    0.1:   "1:10",
    0.2:   "1:5",
    0.25:  "1:4",
    0.5:   "1:2",
    1.0:   "1:1",
    2.0:   "2:1",
    5.0:   "5:1",
    10.0:  "10:1",
}

def format_scale_label(scale: float) -> str:
    """Return a human-readable scale string for a numeric scale factor."""
    if scale <= 0:
        return "?"
    # Snap to a known value within 2 %
    for k, v in _KNOWN_SCALES.items():
        if abs(scale - k) / k < 0.02:
            return v
    if scale < 1.0:
        ratio = round(1.0 / scale)
        return f"1:{ratio}"
    ratio = round(scale)
    return f"{ratio}:1"


# ---------------------------------------------------------------------------
# Color / layer helpers (carry over from original MVP)
# ---------------------------------------------------------------------------

def resolve_color(entity: DXFGraphic, layers: dict) -> str:
    """Return a CSS hex colour for the entity, resolving BYLAYER/BYBLOCK."""
    ACI_TO_HEX = {
        1: "#FF0000", 2: "#FFFF00", 3: "#00FF00", 4: "#00FFFF",
        5: "#0000FF", 6: "#FF00FF", 7: "#FFFFFF", 30: "#FF7F00",
        40: "#FFBF00", 50: "#FFFF7F",
    }
    try:
        color_idx = entity.dxf.color
    except Exception:
        color_idx = 256  # BYLAYER

    if color_idx == 256:  # BYLAYER
        layer_name = getattr(entity.dxf, "layer", "0")
        layer = layers.get(layer_name, {})
        color_idx = layer.get("color", 7)

    if color_idx == 0:  # BYBLOCK — default white
        return "#FFFFFF"

    if entity.rgb is not None:
        r, g, b = entity.rgb
        return f"#{r:02X}{g:02X}{b:02X}"

    return ACI_TO_HEX.get(color_idx, "#FFFFFF")


def get_layers_dict(doc: Drawing) -> dict[str, dict]:
    layers: dict[str, dict] = {}
    for layer in doc.layers:
        layers[layer.dxf.name] = {
            "name": layer.dxf.name,
            "color": layer.dxf.color,
            "linetype": getattr(layer.dxf, "linetype", "Continuous"),
            "is_off": layer.is_off(),
            "is_frozen": layer.is_frozen(),
            "is_locked": layer.is_locked(),
            "lineweight": getattr(layer.dxf, "lineweight", -3),
        }
    return layers


# ---------------------------------------------------------------------------
# Entity serialisation
# ---------------------------------------------------------------------------

def _safe(v: Any, default=None):
    try:
        if v is None:
            return default
        if isinstance(v, (int, float)):
            return v if math.isfinite(v) else default
        return v
    except Exception:
        return default


def _vec(v) -> list[float]:
    try:
        return [float(v.x), float(v.y), float(v.z)]
    except Exception:
        try:
            return [float(v[0]), float(v[1]), float(v[2])]
        except Exception:
            return [0.0, 0.0, 0.0]


def _vec2(v) -> list[float]:
    try:
        return [float(v.x), float(v.y)]
    except Exception:
        try:
            return [float(v[0]), float(v[1])]
        except Exception:
            return [0.0, 0.0]


def serialize_entity(entity: DXFGraphic, layers: dict) -> Optional[dict]:
    """Convert a single DXF entity to a JSON-serialisable dict."""
    etype = entity.dxftype()
    base = {
        "type": etype,
        "handle": entity.dxf.handle,
        "layer": _safe(getattr(entity.dxf, "layer", "0"), "0"),
        "color": resolve_color(entity, layers),
        "linetype": _safe(getattr(entity.dxf, "linetype", None)),
        "lineweight": _safe(getattr(entity.dxf, "lineweight", None)),
        "visible": _safe(getattr(entity.dxf, "invisible", 0), 0) == 0,
    }

    try:
        if etype == "LINE":
            return {**base,
                    "start": _vec(entity.dxf.start),
                    "end": _vec(entity.dxf.end)}

        if etype == "CIRCLE":
            return {**base,
                    "center": _vec(entity.dxf.center),
                    "radius": float(entity.dxf.radius)}

        if etype == "ARC":
            return {**base,
                    "center": _vec(entity.dxf.center),
                    "radius": float(entity.dxf.radius),
                    "start_angle": float(entity.dxf.start_angle),
                    "end_angle": float(entity.dxf.end_angle)}

        if etype == "ELLIPSE":
            return {**base,
                    "center": _vec(entity.dxf.center),
                    "major_axis": _vec(entity.dxf.major_axis),
                    "ratio": float(entity.dxf.ratio),
                    "start_param": float(entity.dxf.start_param),
                    "end_param": float(entity.dxf.end_param)}

        if etype in ("LWPOLYLINE", "POLYLINE", "2DPOLYLINE"):
            if etype == "LWPOLYLINE":
                pts = [{"x": p[0], "y": p[1], "bulge": p[4] if len(p) > 4 else 0.0}
                       for p in entity.get_points("xyb")]
            else:
                pts = [{"x": v.dxf.location.x, "y": v.dxf.location.y, "bulge": 0.0}
                       for v in entity.vertices]
            return {**base,
                    "points": pts,
                    "is_closed": bool(entity.is_closed)}

        if etype == "SPLINE":
            try:
                pts = [[p.x, p.y, p.z] for p in entity.control_points]
            except Exception:
                pts = []
            return {**base,
                    "control_points": pts,
                    "degree": _safe(entity.dxf.degree, 3),
                    "closed": bool(entity.closed)}

        if etype in ("TEXT", "MTEXT"):
            if etype == "MTEXT":
                raw = entity.text or ""
                # strip MTEXT formatting codes
                text = re.sub(r"\\[pPnN]", "\n", raw)
                text = re.sub(r"\\[a-zA-Z][^;]*;", "", text)
                text = re.sub(r"\{[^}]*\}", lambda m: m.group(0)[1:-1], text)
                pos = _vec(entity.dxf.insert)
                height = float(getattr(entity.dxf, "char_height", 2.5))
                rotation = float(getattr(entity.dxf, "rotation", 0))
            else:
                text = _safe(entity.dxf.text, "")
                pos = _vec(entity.dxf.insert)
                height = float(getattr(entity.dxf, "height", 2.5))
                rotation = float(getattr(entity.dxf, "rotation", 0))
            return {**base,
                    "text": text,
                    "position": pos,
                    "height": height,
                    "rotation": rotation}

        if etype == "INSERT":
            return {**base,
                    "block_name": entity.dxf.name,
                    "insert": _vec(entity.dxf.insert),
                    "x_scale": float(getattr(entity.dxf, "xscale", 1.0)),
                    "y_scale": float(getattr(entity.dxf, "yscale", 1.0)),
                    "z_scale": float(getattr(entity.dxf, "zscale", 1.0)),
                    "rotation": float(getattr(entity.dxf, "rotation", 0.0)),
                    "attribs": [
                        {"tag": a.dxf.tag, "text": a.dxf.text}
                        for a in entity.attribs
                    ] if hasattr(entity, "attribs") else []}

        if etype == "HATCH":
            paths = []
            try:
                for boundary in entity.paths:
                    btype = boundary.PATH_TYPE
                    if btype == "EdgePath":
                        edges = []
                        for edge in boundary.edges:
                            et = edge.EDGE_TYPE
                            if et == "LineEdge":
                                edges.append({"type": "line",
                                              "start": list(edge.start),
                                              "end": list(edge.end)})
                            elif et == "ArcEdge":
                                edges.append({"type": "arc",
                                              "center": list(edge.center),
                                              "radius": edge.radius,
                                              "start_angle": edge.start_angle,
                                              "end_angle": edge.end_angle,
                                              "ccw": edge.ccw})
                        paths.append({"type": "edge", "edges": edges})
                    else:
                        paths.append({"type": "polyline",
                                      "points": [[p[0], p[1]] for p in boundary.vertices],
                                      "is_closed": boundary.is_closed})
            except Exception:
                pass
            return {**base,
                    "solid_fill": bool(entity.dxf.solid_fill),
                    "pattern_name": _safe(getattr(entity.dxf, "pattern_name", "SOLID")),
                    "paths": paths}

        if etype == "DIMENSION":
            try:
                return {**base,
                        "dim_type": int(entity.dxf.dimtype) & 7,
                        "defpoint": _vec(entity.dxf.defpoint),
                        "text_midpoint": _vec(entity.dxf.text_midpoint),
                        "measurement": _safe(entity.get_measurement()),
                        "override_text": _safe(getattr(entity.dxf, "text", None))}
            except Exception:
                return None

        if etype in ("SOLID", "TRACE", "3DFACE"):
            verts = []
            for attr in ("vtx0", "vtx1", "vtx2", "vtx3"):
                try:
                    verts.append(_vec(getattr(entity.dxf, attr)))
                except Exception:
                    pass
            return {**base, "vertices": verts}

        if etype == "POINT":
            return {**base, "position": _vec(entity.dxf.location)}

        if etype == "XLINE":
            return {**base,
                    "start": _vec(entity.dxf.start),
                    "unit_vector": _vec(entity.dxf.unit_vector)}

        if etype == "RAY":
            return {**base,
                    "start": _vec(entity.dxf.start),
                    "unit_vector": _vec(entity.dxf.unit_vector)}

    except Exception as exc:
        return {**base, "_parse_error": str(exc)}

    return None  # unsupported type silently dropped


def serialize_layout_entities(layout: Layout, layers: dict) -> list[dict]:
    """Serialise all non-VIEWPORT entities in a layout."""
    result = []
    for entity in layout:
        if entity.dxftype() == "VIEWPORT":
            continue  # handled separately
        serialised = serialize_entity(entity, layers)
        if serialised:
            result.append(serialised)
    return result


# ---------------------------------------------------------------------------
# Block definitions
# ---------------------------------------------------------------------------

def serialize_blocks(doc: Drawing, layers: dict) -> dict[str, list[dict]]:
    blocks: dict[str, list[dict]] = {}
    for block in doc.blocks:
        name = block.name
        if name.startswith("*"):
            continue
        entities = []
        for entity in block:
            s = serialize_entity(entity, layers)
            if s:
                entities.append(s)
        if entities:
            blocks[name] = entities
    return blocks


# ---------------------------------------------------------------------------
# Viewport extraction
# ---------------------------------------------------------------------------

def extract_viewports(layout: Layout, layers: dict) -> list[dict]:
    """Extract all VIEWPORT entities from a paper space layout."""
    viewports = []
    for entity in layout:
        if entity.dxftype() != "VIEWPORT":
            continue
        vp = entity  # type: ignore[assignment]
        try:
            # Paper-space rectangle
            try:
                center_paper = _vec2(vp.dxf.center)
            except Exception:
                center_paper = [0.0, 0.0]
            width_paper = float(getattr(vp.dxf, "width", 0.0))
            height_paper = float(getattr(vp.dxf, "height", 0.0))

            # Model-space view parameters
            try:
                center_model = _vec(vp.dxf.view_center_point)
                # view_center_point is 2D in paper coords representing MS centre
                # actual MS target is view_target_point
            except Exception:
                center_model = [0.0, 0.0, 0.0]

            try:
                target = _vec(vp.dxf.view_target_point)
            except Exception:
                target = [0.0, 0.0, 0.0]

            view_height = float(getattr(vp.dxf, "view_height", height_paper))
            if view_height == 0:
                view_height = height_paper if height_paper != 0 else 1.0

            scale = height_paper / view_height if view_height != 0 else 1.0

            try:
                view_dir = _vec(vp.dxf.view_direction_vector)
            except Exception:
                view_dir = [0.0, 0.0, 1.0]

            twist = float(getattr(vp.dxf, "snap_angle", 0.0))
            try:
                twist = float(vp.dxf.view_twist_angle)
            except Exception:
                pass

            # Frozen layers in this viewport
            frozen_layers: list[str] = []
            try:
                frozen_layers = list(vp.frozen_layers)
            except Exception:
                try:
                    frozen_layers = [ln for ln in (vp.dxf.frozen_layers or [])]
                except Exception:
                    pass

            is_active = True
            try:
                flags = int(vp.dxf.flags)
                is_active = bool(flags & 1)
            except Exception:
                pass

            # Clipping boundary (non-rectangular viewports)
            clip_boundary = None
            try:
                if vp.dxf.hasattr("clipping_boundary_handle"):
                    clip_entity = doc.entitydb.get(vp.dxf.clipping_boundary_handle)
                    if clip_entity and clip_entity.dxftype() == "LWPOLYLINE":
                        clip_boundary = [[p[0], p[1]] for p in clip_entity.get_points("xy")]
            except Exception:
                pass

            viewports.append({
                "id": vp.dxf.handle,
                "layer": _safe(getattr(vp.dxf, "layer", "0"), "0"),
                "color": resolve_color(vp, layers),
                "center_paper": center_paper,
                "width_paper": width_paper,
                "height_paper": height_paper,
                "center_model": center_model,
                "view_target": target,
                "view_height": view_height,
                "view_direction": view_dir,
                "twist_angle": twist,
                "scale": scale,
                "scale_label": format_scale_label(scale),
                "frozen_layers": frozen_layers,
                "is_active": is_active,
                "clip_boundary": clip_boundary,
            })
        except Exception as exc:
            viewports.append({
                "id": getattr(vp.dxf, "handle", "?"),
                "_parse_error": str(exc),
                "center_paper": [0.0, 0.0],
                "width_paper": 0.0,
                "height_paper": 0.0,
                "center_model": [0.0, 0.0, 0.0],
                "view_target": [0.0, 0.0, 0.0],
                "view_height": 1.0,
                "view_direction": [0.0, 0.0, 1.0],
                "twist_angle": 0.0,
                "scale": 1.0,
                "scale_label": "1:1",
                "frozen_layers": [],
                "is_active": False,
                "clip_boundary": None,
            })
    return viewports


# ---------------------------------------------------------------------------
# Paper size extraction
# ---------------------------------------------------------------------------

_PAPER_SIZES: dict[str, tuple[float, float]] = {
    "A0": (1189.0, 841.0),
    "A1": (841.0,  594.0),
    "A2": (594.0,  420.0),
    "A3": (420.0,  297.0),
    "A4": (297.0,  210.0),
    "ARCH A":   (304.8,  228.6),
    "ARCH B":   (457.2,  304.8),
    "ARCH C":   (609.6,  457.2),
    "ARCH D":   (914.4,  609.6),
    "ARCH E":   (1219.2, 914.4),
    "LETTER":   (279.4,  215.9),
    "LEGAL":    (355.6,  215.9),
    "TABLOID":  (431.8,  279.4),
}


def get_paper_size(layout: Layout) -> tuple[float, float]:
    """Extract paper size in mm from a paper space layout."""
    # 1. Try PLOTSETTINGS attached to layout
    try:
        ps = layout.get_plot_params()
        w = float(ps.get("paper_width", 0))
        h = float(ps.get("paper_height", 0))
        if w > 0 and h > 0:
            return (w, h)
    except Exception:
        pass

    # 2. Try DXF attributes directly
    try:
        w = float(layout.dxf.paper_width)
        h = float(layout.dxf.paper_height)
        if w > 0 and h > 0:
            return (w, h)
    except Exception:
        pass

    # 3. Guess from layout name
    name_upper = layout.name.upper()
    for key, dims in _PAPER_SIZES.items():
        if key in name_upper:
            return dims

    # 4. Default to A1
    return (841.0, 594.0)


def get_plot_margins(layout: Layout) -> dict[str, float]:
    """Return plot margins in mm."""
    defaults = {"left": 5.0, "right": 5.0, "top": 5.0, "bottom": 5.0}
    try:
        ps = layout.get_plot_params()
        return {
            "left":   float(ps.get("plot_origin_x", defaults["left"])),
            "bottom": float(ps.get("plot_origin_y", defaults["bottom"])),
            "right":  float(ps.get("paper_image_origin_x", defaults["right"])),
            "top":    float(ps.get("paper_image_origin_y", defaults["top"])),
        }
    except Exception:
        return defaults


# ---------------------------------------------------------------------------
# Layout enumeration
# ---------------------------------------------------------------------------

def enumerate_layouts(doc: Drawing, layers: dict) -> list[dict]:
    """Return a list of layout descriptors including entities and viewports."""
    layouts_out: list[dict] = []

    # Ensure model space is first
    layout_list = sorted(
        doc.layouts,
        key=lambda l: (0 if l.is_modelspace else 1, l.name)
    )

    for layout in layout_list:
        is_ms = layout.is_modelspace
        paper_width, paper_height = (0.0, 0.0) if is_ms else get_paper_size(layout)
        margins = {"left": 0, "right": 0, "top": 0, "bottom": 0} if is_ms else get_plot_margins(layout)

        try:
            plot_origin = [
                float(layout.dxf.plot_origin_x),
                float(layout.dxf.plot_origin_y),
            ]
        except Exception:
            plot_origin = [0.0, 0.0]

        paper_entities = serialize_layout_entities(layout, layers)
        viewports = [] if is_ms else extract_viewports(layout, layers)

        layouts_out.append({
            "name": layout.name,
            "is_modelspace": is_ms,
            "paper_width": paper_width,
            "paper_height": paper_height,
            "plot_origin": plot_origin,
            "margins": margins,
            "dxf_layout_key": layout.name,
            "paper_entities": paper_entities,
            "viewports": viewports,
        })

    return layouts_out


# ---------------------------------------------------------------------------
# Main upload endpoint
# ---------------------------------------------------------------------------

@app.post("/upload")
async def upload_dxf(file: UploadFile = File(...)) -> JSONResponse:
    if not file.filename:
        raise HTTPException(400, "No filename provided")

    filename_lower = file.filename.lower()
    if not (filename_lower.endswith(".dxf") or filename_lower.endswith(".dwg")):
        raise HTTPException(400, "Only DXF/DWG files are supported")

    content = await file.read()

    try:
        doc: Drawing = ezdxf.read(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(422, f"Failed to parse DXF file: {exc}") from exc

    layers = get_layers_dict(doc)
    blocks = serialize_blocks(doc, layers)
    layouts = enumerate_layouts(doc, layers)

    # For backward compat: expose model space entities at top level
    model_layout = next((l for l in layouts if l["is_modelspace"]), None)
    top_level_entities = model_layout["paper_entities"] if model_layout else []

    return JSONResponse({
        "filename": file.filename,
        "layers": list(layers.values()),
        "blocks": blocks,
        "entities": top_level_entities,   # legacy field — model space entities
        "layouts": layouts,
    })


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "version": "2.0.0"}
