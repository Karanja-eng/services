"""
CAD Backend — DXF entity parser with lineweight + linetype extraction.
Dependencies: ezdxf, fastapi, uvicorn
"""

from __future__ import annotations

import math
import os
from pathlib import Path
from typing import Any

import ezdxf
from ezdxf.document import Drawing
from ezdxf.entities import DXFGraphic
from ezdxf.enums import Lineweight as EzdxfLineweight
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="CAD Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Lineweight mapping: DXF integer (hundredths of mm) → mm ──────────────────
LINEWEIGHT_MAP: dict[int, float] = {
    -3: None,    # BYLAYER  → resolved later
    -2: None,    # BYBLOCK  → resolved at INSERT time
    -1: 0.25,    # DEFAULT
    0: 0.0,
    5: 0.05,
    9: 0.09,
    13: 0.13,
    15: 0.15,
    18: 0.18,
    20: 0.20,
    25: 0.25,
    30: 0.30,
    35: 0.35,
    40: 0.40,
    50: 0.50,
    53: 0.53,
    60: 0.60,
    70: 0.70,
    80: 0.80,
    90: 0.90,
    100: 1.00,
    106: 1.06,
    120: 1.20,
    140: 1.40,
    158: 1.58,
    200: 2.00,
    211: 2.11,
}

DEFAULT_LINEWEIGHT_MM = 0.25

# ── Fallback standard AutoCAD linetype patterns ───────────────────────────────
STANDARD_LINETYPES: dict[str, list[float]] = {
    "CONTINUOUS": [],
    "DASHED":     [12.0, -6.0],
    "DASHED2":    [6.0, -3.0],
    "DASHEDX2":   [24.0, -12.0],
    "HIDDEN":     [6.0, -3.0],
    "HIDDEN2":    [3.0, -1.5],
    "HIDDENX2":   [12.0, -6.0],
    "CENTER":     [31.75, -6.35, 6.35, -6.35],
    "CENTER2":    [15.875, -3.175, 3.175, -3.175],
    "CENTERX2":   [63.5, -12.7, 12.7, -12.7],
    "PHANTOM":    [25.4, -5.08, 5.08, -5.08, 5.08, -5.08],
    "PHANTOM2":   [12.7, -2.54, 2.54, -2.54, 2.54, -2.54],
    "PHANTOMX2":  [50.8, -10.16, 10.16, -10.16, 10.16, -10.16],
    "DOT":        [0.0, -6.35],
    "DOT2":       [0.0, -3.175],
    "DOTX2":      [0.0, -12.7],
    "DASHDOT":    [12.7, -3.18, 0.0, -3.18],
    "DASHDOT2":   [6.35, -1.59, 0.0, -1.59],
    "DASHDOTX2":  [25.4, -6.35, 0.0, -6.35],
    "BORDER":     [12.7, -3.18, 12.7, -3.18, 0.0, -3.18],
    "BORDER2":    [6.35, -1.59, 6.35, -1.59, 0.0, -1.59],
    "BORDERX2":   [25.4, -6.35, 25.4, -6.35, 0.0, -6.35],
    "DIVIDE":     [12.7, -3.18, 0.0, -3.18, 0.0, -3.18],
    "DIVIDE2":    [6.35, -1.59, 0.0, -1.59, 0.0, -1.59],
    "DIVIDEX2":   [25.4, -6.35, 0.0, -6.35, 0.0, -6.35],
    "FENCELINE1": [12.7, -2.54, 0.0, -2.54],
    "FENCELINE2": [12.7, -2.54, 0.0, -2.54, 0.0, -2.54],
    "TRACKS":     [12.7, -2.54],
    "BATTING":    [12.7, -2.54, 6.35, -2.54],
    "HOT_WATER_SUPPLY": [12.7, -3.18, 0.0, -3.18, 12.7, -3.18],
    "ZIGZAG":     [12.7, -6.35, 6.35, -6.35],
}

SYMBOL_LINETYPES = {"FENCELINE1", "FENCELINE2", "ZIGZAG", "TRACKS", "BATTING", "HOT_WATER_SUPPLY"}


def _resolve_lineweight(entity: DXFGraphic, doc: Drawing, layer_cache: dict[str, float]) -> float:
    """Return lineweight in mm for a given entity, resolving BYLAYER/BYBLOCK."""
    raw = getattr(entity.dxf, "lineweight", -3)
    if isinstance(raw, EzdxfLineweight):
        raw = raw.value

    if raw == -3:  # BYLAYER
        layer_name = getattr(entity.dxf, "layer", "0")
        if layer_name not in layer_cache:
            layer_cache[layer_name] = _layer_lineweight(layer_name, doc)
        return layer_cache[layer_name]

    if raw == -2:  # BYBLOCK – not easily resolvable without INSERT context; use default
        return DEFAULT_LINEWEIGHT_MM

    return LINEWEIGHT_MAP.get(raw, DEFAULT_LINEWEIGHT_MM) or DEFAULT_LINEWEIGHT_MM


def _layer_lineweight(layer_name: str, doc: Drawing) -> float:
    """Lookup a layer's lineweight, with fallback."""
    try:
        layer = doc.layers.get(layer_name)
        if layer is None:
            return DEFAULT_LINEWEIGHT_MM
        lw = layer.dxf.get("lineweight", -1)
        if isinstance(lw, EzdxfLineweight):
            lw = lw.value
        return LINEWEIGHT_MAP.get(lw, DEFAULT_LINEWEIGHT_MM) or DEFAULT_LINEWEIGHT_MM
    except Exception:
        return DEFAULT_LINEWEIGHT_MM


def _resolve_linetype(entity: DXFGraphic, doc: Drawing) -> tuple[str, list[float], float]:
    """Return (name, pattern, scale) for an entity's linetype."""
    # Resolve name
    lt_name = getattr(entity.dxf, "linetype", "BYLAYER") or "BYLAYER"
    if lt_name.upper() in ("BYLAYER", ""):
        layer_name = getattr(entity.dxf, "layer", "0")
        try:
            layer = doc.layers.get(layer_name)
            if layer:
                lt_name = layer.dxf.get("linetype", "CONTINUOUS") or "CONTINUOUS"
        except Exception:
            lt_name = "CONTINUOUS"

    if lt_name.upper() == "BYBLOCK":
        lt_name = "CONTINUOUS"

    lt_name_upper = lt_name.upper()

    # Resolve scale
    entity_ltscale = float(getattr(entity.dxf, "ltscale", 1.0) or 1.0)
    try:
        global_ltscale = float(doc.header.get("$LTSCALE", 1.0) or 1.0)
    except Exception:
        global_ltscale = 1.0
    combined_scale = global_ltscale * entity_ltscale

    # Resolve pattern: first try doc.linetypes, then fallback table
    pattern: list[float] = []
    try:
        ltype_entry = doc.linetypes.get(lt_name)
        if ltype_entry:
            raw_pattern = ltype_entry.dxf.get("pattern", [])
            # ezdxf pattern is stored as a flat list; first element is total length, rest are elements
            if raw_pattern and len(raw_pattern) > 1:
                pattern = [float(x) for x in raw_pattern[1:]]
            else:
                pattern = []
    except Exception:
        pass

    if not pattern and lt_name_upper != "CONTINUOUS":
        pattern = STANDARD_LINETYPES.get(lt_name_upper, [])

    return lt_name_upper, pattern, combined_scale


def _color_to_rgb(entity: DXFGraphic, doc: Drawing) -> tuple[int, int, int]:
    """Resolve entity color to RGB using ACI palette or true color."""
    ACI_PALETTE = {
        1: (255, 0, 0), 2: (255, 255, 0), 3: (0, 255, 0),
        4: (0, 255, 255), 5: (0, 0, 255), 6: (255, 0, 255),
        7: (255, 255, 255), 8: (128, 128, 128), 9: (192, 192, 192),
    }
    # True color takes precedence
    if hasattr(entity.dxf, "true_color") and entity.dxf.hasattr("true_color"):
        tc = entity.dxf.true_color
        return ((tc >> 16) & 0xFF, (tc >> 8) & 0xFF, tc & 0xFF)

    color = getattr(entity.dxf, "color", 256)
    if color == 256:  # BYLAYER
        try:
            layer = doc.layers.get(getattr(entity.dxf, "layer", "0"))
            if layer:
                color = layer.dxf.get("color", 7)
        except Exception:
            color = 7
    if color == 0:  # BYBLOCK
        color = 7
    return ACI_PALETTE.get(color, (255, 255, 255))


def _entity_to_dict(entity: DXFGraphic, doc: Drawing,
                    layer_lw_cache: dict[str, float]) -> dict[str, Any] | None:
    """Convert a DXF entity to a serialisable dict."""
    dxftype = entity.dxftype()
    lw_mm = _resolve_lineweight(entity, doc, layer_lw_cache)
    lt_name, lt_pattern, lt_scale = _resolve_linetype(entity, doc)
    r, g, b = _color_to_rgb(entity, doc)

    base: dict[str, Any] = {
        "type": dxftype,
        "layer": getattr(entity.dxf, "layer", "0"),
        "color": f"#{r:02x}{g:02x}{b:02x}",
        "colorRGB": [r, g, b],
        "lineweight_mm": lw_mm,
        "linetype_name": lt_name,
        "linetype_pattern": lt_pattern,
        "linetype_scale": lt_scale,
        "is_symbol_linetype": lt_name in SYMBOL_LINETYPES,
    }

    if dxftype == "LINE":
        s, e = entity.dxf.start, entity.dxf.end
        base.update({"x1": s.x, "y1": s.y, "x2": e.x, "y2": e.y})
    elif dxftype in ("LWPOLYLINE", "POLYLINE"):
        try:
            pts = [(p[0], p[1]) for p in entity.get_points()]
        except Exception:
            pts = []
        base.update({"points": pts, "closed": bool(getattr(entity.dxf, "closed", False))})
    elif dxftype == "ARC":
        base.update({
            "cx": entity.dxf.center.x, "cy": entity.dxf.center.y,
            "radius": entity.dxf.radius,
            "start_angle": entity.dxf.start_angle,
            "end_angle": entity.dxf.end_angle,
        })
    elif dxftype == "CIRCLE":
        base.update({
            "cx": entity.dxf.center.x, "cy": entity.dxf.center.y,
            "radius": entity.dxf.radius,
        })
    elif dxftype == "ELLIPSE":
        base.update({
            "cx": entity.dxf.center.x, "cy": entity.dxf.center.y,
            "major_axis": [entity.dxf.major_axis.x, entity.dxf.major_axis.y],
            "ratio": entity.dxf.ratio,
            "start_param": entity.dxf.start_param,
            "end_param": entity.dxf.end_param,
        })
    elif dxftype in ("TEXT", "MTEXT"):
        try:
            text = entity.dxf.text if dxftype == "TEXT" else entity.text
        except Exception:
            text = ""
        insert = entity.dxf.get("insert", None) or entity.dxf.get("insert", None)
        ix = getattr(insert, "x", 0) if insert else 0
        iy = getattr(insert, "y", 0) if insert else 0
        base.update({
            "text": text,
            "x": ix, "y": iy,
            "height": float(getattr(entity.dxf, "height", 2.5) or 2.5),
            "rotation": float(getattr(entity.dxf, "rotation", 0) or 0),
        })
    elif dxftype == "SPLINE":
        try:
            pts = [(p[0], p[1]) for p in entity.flattening(0.01)]
        except Exception:
            pts = []
        base.update({"points": pts, "closed": bool(getattr(entity.dxf, "closed", False))})
    elif dxftype == "HATCH":
        # Serialize boundary paths
        paths = []
        for path in entity.paths:
            edges = []
            for edge in path.edges:
                et = edge.EDGE_TYPE
                if et == "LineEdge":
                    edges.append({"edge_type": "LINE", "start": list(edge.start)[:2], "end": list(edge.end)[:2]})
                elif et == "ArcEdge":
                    edges.append({
                        "edge_type": "ARC",
                        "center": list(edge.center)[:2],
                        "radius": edge.radius,
                        "start_angle": edge.start_angle,
                        "end_angle": edge.end_angle,
                        "ccw": edge.ccw,
                    })
            paths.append(edges)
        base.update({"paths": paths, "solid_fill": entity.dxf.solid_fill == 1})
    elif dxftype == "INSERT":
        base.update({
            "block_name": entity.dxf.name,
            "x": entity.dxf.insert.x, "y": entity.dxf.insert.y,
            "x_scale": float(getattr(entity.dxf, "xscale", 1.0) or 1.0),
            "y_scale": float(getattr(entity.dxf, "yscale", 1.0) or 1.0),
            "rotation": float(getattr(entity.dxf, "rotation", 0.0) or 0.0),
        })
    elif dxftype == "DIMENSION":
        base.update({
            "dimtype": getattr(entity.dxf, "dimtype", 0),
            "text": getattr(entity.dxf, "text", ""),
            "defpoint": list(getattr(entity.dxf, "defpoint", [0, 0, 0]))[:2],
        })
    else:
        return None  # unsupported type — skip

    return base


def _extract_layer_table(doc: Drawing) -> list[dict[str, Any]]:
    """Return layer metadata including lineweight and linetype."""
    layers = []
    for layer in doc.layers:
        name = layer.dxf.name
        color_idx = layer.dxf.get("color", 7)

        ACI: dict[int, str] = {
            1: "#ff0000", 2: "#ffff00", 3: "#00ff00", 4: "#00ffff",
            5: "#0000ff", 6: "#ff00ff", 7: "#ffffff", 8: "#808080", 9: "#c0c0c0",
        }
        color_hex = ACI.get(abs(color_idx), "#ffffff")

        lw_raw = layer.dxf.get("lineweight", -1)
        if isinstance(lw_raw, EzdxfLineweight):
            lw_raw = lw_raw.value
        lw_mm = LINEWEIGHT_MAP.get(lw_raw, DEFAULT_LINEWEIGHT_MM) or DEFAULT_LINEWEIGHT_MM

        lt_name = layer.dxf.get("linetype", "CONTINUOUS") or "CONTINUOUS"
        lt_name = lt_name.upper()
        lt_pattern = STANDARD_LINETYPES.get(lt_name, [])
        try:
            ltype_entry = doc.linetypes.get(lt_name)
            if ltype_entry:
                raw = ltype_entry.dxf.get("pattern", [])
                if raw and len(raw) > 1:
                    lt_pattern = [float(x) for x in raw[1:]]
        except Exception:
            pass

        layers.append({
            "name": name,
            "color": color_hex,
            "lineweight_mm": lw_mm,
            "linetype_name": lt_name,
            "linetype_pattern": lt_pattern,
            "is_frozen": bool(layer.is_frozen()),
            "is_off": not bool(layer.is_on()),
        })
    return layers


def _get_extents(doc: Drawing) -> dict[str, float]:
    """Return drawing extents from header variables."""
    try:
        ext_min = doc.header.get("$EXTMIN", (0, 0, 0))
        ext_max = doc.header.get("$EXTMAX", (1000, 1000, 0))
        return {
            "min_x": float(ext_min[0]), "min_y": float(ext_min[1]),
            "max_x": float(ext_max[0]), "max_y": float(ext_max[1]),
        }
    except Exception:
        return {"min_x": 0, "min_y": 0, "max_x": 1000, "max_y": 1000}


def parse_dxf(file_bytes: bytes) -> dict[str, Any]:
    """Parse raw DXF bytes and return full JSON payload."""
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".dxf", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        doc = ezdxf.readfile(tmp_path)
    except Exception as exc:
        raise ValueError(f"Failed to parse DXF: {exc}") from exc
    finally:
        os.unlink(tmp_path)

    msp = doc.modelspace()
    layer_lw_cache: dict[str, float] = {}
    entities: list[dict[str, Any]] = []

    for entity in msp:
        try:
            d = _entity_to_dict(entity, doc, layer_lw_cache)
            if d:
                entities.append(d)
        except Exception:
            pass  # skip malformed entities

    # Also recurse into INSERT (block references) one level
    for entity in msp.query("INSERT"):
        try:
            block_name = entity.dxf.name
            block = doc.blocks.get(block_name)
            if not block:
                continue
            for sub in block:
                if not isinstance(sub, DXFGraphic):
                    continue
                try:
                    d = _entity_to_dict(sub, doc, layer_lw_cache)
                    if d:
                        d["_from_block"] = block_name
                        entities.append(d)
                except Exception:
                    pass
        except Exception:
            pass

    layers = _extract_layer_table(doc)
    extents = _get_extents(doc)

    # Drawing units / plot scale hint
    try:
        insunits = int(doc.header.get("$INSUNITS", 4) or 4)
    except Exception:
        insunits = 4  # mm default

    INSUNITS_TO_MM = {
        0: 1.0, 1: 25.4, 2: 304.8, 3: 1609344.0,
        4: 1.0, 5: 10.0, 6: 1000.0, 7: 1e6,
        8: 0.0254, 9: 0.001,
    }
    units_per_mm = 1.0 / INSUNITS_TO_MM.get(insunits, 1.0)

    return {
        "entities": entities,
        "layers": layers,
        "extents": extents,
        "units_per_mm": units_per_mm,
        "insunits": insunits,
        "standard_linetypes": STANDARD_LINETYPES,
    }


# ── API Routes ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/parse-dxf")
async def parse_dxf_endpoint(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".dxf"):
        raise HTTPException(400, "Only .dxf files are accepted")
    content = await file.read()
    try:
        result = parse_dxf(content)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    return JSONResponse(result)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
