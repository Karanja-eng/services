"""
deterministic_cad_extractor.py
================================
Fundi Studio — Architectural DXF → Structural Model Extractor
Module: src/Backend/calculations/Atomationmodels/arch_pro/deterministic_cad_extractor.py

Deterministic geometric extraction of structural elements (walls, columns, beams, slab
panels, openings) from architectural 2D DXF files.  No ML, no CV, no rasterization.

Algorithm overview
------------------
1.  Read DXF with ezdxf; normalise all coordinates to metres.
2.  Collect LINE entities from wall-candidate layers.
3.  Pair parallel, adjacent double-lines → wall centrelines + thickness.
4.  Snap endpoints to a tolerance grid; merge collinear segments; detect junctions.
5.  Build a planar graph; trace minimal cycles (room boundaries) via half-edge traversal.
6.  Classify slab panels; attach room-name text by point-in-polygon.
7.  Detect columns from explicit blocks/polylines and from junction inference.
8.  Infer perimeter beams for each slab panel.
9.  Return the validated output dictionary contract.

Author: Fundi Studio — generated for FullBuildingAnalyzer integration
"""

from __future__ import annotations

import math
import uuid
from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple

import ezdxf
from ezdxf.document import Drawing
from ezdxf.layouts.layouts import Layouts

# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------
Point2D = Tuple[float, float]
Point3D = Tuple[float, float, float]
Segment = Tuple[Point2D, Point2D]

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_UNIT_MAP: Dict[int, Tuple[float, str]] = {
    1: (0.0254,  "Inches"),
    2: (0.3048,  "Feet"),
    4: (0.001,   "Millimetres"),
    6: (1.0,     "Metres"),
}
_DEFAULT_UNIT_CODE    = 6
_FALLBACK_THRESHOLD   = 500.0        # if extents exceed this → assume mm
_MIN_THICKNESS        = 0.08         # metres
_MAX_THICKNESS        = 0.45         # metres
_DEFAULT_THICKNESS    = 0.15         # metres (single-line fallback)
_SNAP_TOLERANCE       = 0.05         # metres
_MIN_ROOM_AREA        = 1.0          # m²
_PARALLELISM_DOT      = 0.98
_BEAM_WIDTH           = 0.30
_BEAM_DEPTH           = 0.50

_DEFAULT_WALL_KEYWORDS   = ("WALL", "STRUCT", "BRICK", "PARTITION", "A-WALL")
_DEFAULT_COLUMN_KEYWORDS = ("COLU", "PILLAR", "POST", "A-COLS")

# ---------------------------------------------------------------------------
# Small geometry helpers
# ---------------------------------------------------------------------------

def _dist2(a: Point2D, b: Point2D) -> float:
    return math.hypot(b[0] - a[0], b[1] - a[1])


def _unit_vec(a: Point2D, b: Point2D) -> Tuple[float, float]:
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy)
    if L < 1e-12:
        return (1.0, 0.0)
    return (dx / L, dy / L)


def _project(pt: Point2D, a: Point2D, b: Point2D) -> float:
    """Scalar projection of pt onto line a→b (parameterised 0-1 along a→b)."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    L2 = dx * dx + dy * dy
    if L2 < 1e-24:
        return 0.0
    return ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L2


def _perp_dist(pt: Point2D, a: Point2D, b: Point2D) -> float:
    """Perpendicular distance from pt to infinite line through a,b."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy)
    if L < 1e-12:
        return _dist2(pt, a)
    return abs((pt[0] - a[0]) * dy - (pt[1] - a[1]) * dx) / L


def _seg_length(seg: Segment) -> float:
    return _dist2(seg[0], seg[1])


def _midpoint(a: Point2D, b: Point2D) -> Point2D:
    return ((a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5)


def _lerp2(a: Point2D, b: Point2D, t: float) -> Point2D:
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def _shoelace(polygon: List[Point2D]) -> float:
    """Signed area via the Shoelace formula (positive = CCW)."""
    n = len(polygon)
    s = 0.0
    for i in range(n):
        x0, y0 = polygon[i]
        x1, y1 = polygon[(i + 1) % n]
        s += (x0 * y1 - x1 * y0)
    return s * 0.5


def _point_in_polygon(pt: Point2D, polygon: List[Point2D]) -> bool:
    """Ray-casting point-in-polygon test."""
    x, y = pt
    inside = False
    n = len(polygon)
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-30) + xi):
            inside = not inside
        j = i
    return inside


def _bbox(polygon: List[Point2D]) -> Dict[str, float]:
    xs = [p[0] for p in polygon]
    ys = [p[1] for p in polygon]
    xmin, xmax = min(xs), max(xs)
    ymin, ymax = min(ys), max(ys)
    return {"xmin": xmin, "ymin": ymin, "xmax": xmax, "ymax": ymax,
            "width": xmax - xmin, "depth": ymax - ymin}


# ---------------------------------------------------------------------------
# Step 1 — DXF reading & unit normalisation
# ---------------------------------------------------------------------------

def _detect_units(doc: Drawing) -> Tuple[int, float, str]:
    """Return (unit_code, scale_factor, unit_name)."""
    try:
        code = int(doc.header.get("$INSUNITS", 0))
    except Exception:
        code = 0

    if code in _UNIT_MAP:
        scale, name = _UNIT_MAP[code]
        return code, scale, name

    # Fallback: inspect bounding box of all LINE entities
    max_coord = 0.0
    msp = doc.modelspace()
    for e in msp:
        if e.dxftype() == "LINE":
            for pt in (e.dxf.start, e.dxf.end):
                max_coord = max(max_coord, abs(pt.x), abs(pt.y))

    if max_coord > _FALLBACK_THRESHOLD:
        return 4, 0.001, "Millimetres (inferred)"
    return _DEFAULT_UNIT_CODE, 1.0, "Metres (assumed)"


def _scale_pt(pt: Any, scale: float) -> Point2D:
    return (pt.x * scale, pt.y * scale)


# ---------------------------------------------------------------------------
# Step 2 — Collect wall-candidate line segments
# ---------------------------------------------------------------------------

def _layer_matches(layer_name: str, keywords: Tuple[str, ...]) -> bool:
    up = layer_name.upper()
    return any(k in up for k in keywords)


class _RawLine:
    __slots__ = ("start", "end", "handle", "layer")

    def __init__(self, start: Point2D, end: Point2D, handle: str, layer: str):
        self.start  = start
        self.end    = end
        self.handle = handle
        self.layer  = layer

    @property
    def length(self) -> float:
        return _dist2(self.start, self.end)

    @property
    def unit_vec(self) -> Tuple[float, float]:
        return _unit_vec(self.start, self.end)


def _collect_lines(doc: Drawing, scale: float,
                   wall_keywords: Tuple[str, ...]) -> List[_RawLine]:
    lines: List[_RawLine] = []
    msp = doc.modelspace()
    for e in msp:
        if e.dxftype() != "LINE":
            continue
        layer = e.dxf.layer
        if not _layer_matches(layer, wall_keywords):
            continue
        s = _scale_pt(e.dxf.start, scale)
        en = _scale_pt(e.dxf.end, scale)
        if _dist2(s, en) < 1e-6:
            continue
        handle = e.dxf.handle if e.dxf.hasattr("handle") else str(uuid.uuid4())
        lines.append(_RawLine(s, en, handle, layer))
    return lines


# ---------------------------------------------------------------------------
# Step 3 — Double-line wall pairing
# ---------------------------------------------------------------------------

class _WallCandidate:
    """Represents a detected centreline wall segment."""

    def __init__(self, start: Point2D, end: Point2D, thickness: float,
                 handles: List[str], is_paired: bool):
        self.start     = start
        self.end       = end
        self.thickness = thickness
        self.handles   = handles
        self.is_paired = is_paired
        self.id        = ""

    @property
    def length(self) -> float:
        return _dist2(self.start, self.end)

    @property
    def unit_vec(self) -> Tuple[float, float]:
        return _unit_vec(self.start, self.end)

    @property
    def confidence(self) -> float:
        if not self.is_paired:
            return 0.5
        # Scale confidence by how close thickness is to typical 0.20 m wall
        t = self.thickness
        if 0.10 <= t <= 0.25:
            return 0.95
        if 0.08 <= t <= 0.35:
            return 0.80
        return 0.65


def _overlap_fraction(a: _RawLine, b: _RawLine) -> float:
    """
    Fraction of mutual overlap along the shared parallel direction.
    Project both endpoints of b onto a's axis; check intersection.
    """
    ua = a.unit_vec
    # Project a's endpoints
    ta0 = 0.0
    ta1 = a.length
    # Project b's endpoints onto a's axis from a.start
    tb0 = ((b.start[0] - a.start[0]) * ua[0] + (b.start[1] - a.start[1]) * ua[1])
    tb1 = ((b.end[0]   - a.start[0]) * ua[0] + (b.end[1]   - a.start[1]) * ua[1])
    if tb0 > tb1:
        tb0, tb1 = tb1, tb0
    lo = max(ta0, tb0)
    hi = min(ta1, tb1)
    if hi <= lo:
        return 0.0
    overlap = hi - lo
    denom   = min(a.length, b.length)
    return overlap / denom if denom > 1e-9 else 0.0


def _pair_walls(lines: List[_RawLine],
                min_t: float, max_t: float) -> Tuple[List[_WallCandidate], int]:
    """Return (wall_candidates, unpaired_count)."""
    used: Set[int] = set()
    walls: List[_WallCandidate] = []

    for i in range(len(lines)):
        if i in used:
            continue
        L1 = lines[i]
        u1 = L1.unit_vec
        best_j   = -1
        best_d   = 1e18

        for j in range(i + 1, len(lines)):
            if j in used:
                continue
            L2 = lines[j]
            u2 = L2.unit_vec

            # Parallelism check
            dot = abs(u1[0] * u2[0] + u1[1] * u2[1])
            if dot < _PARALLELISM_DOT:
                continue

            # Perpendicular distance (use midpoint of L2 to line through L1)
            d = _perp_dist(_midpoint(L2.start, L2.end), L1.start, L1.end)
            if not (min_t <= d <= max_t):
                continue

            # Overlap check
            frac = _overlap_fraction(L1, L2)
            if frac < 0.3:
                continue

            if d < best_d:
                best_d = d
                best_j = j

        if best_j >= 0:
            L2 = lines[best_j]
            used.add(i)
            used.add(best_j)

            # Build centreline from overlapping region projected onto both lines
            u1 = L1.unit_vec
            ta0 = 0.0
            ta1 = L1.length
            tb0 = ((L2.start[0] - L1.start[0]) * u1[0] + (L2.start[1] - L1.start[1]) * u1[1])
            tb1 = ((L2.end[0]   - L1.start[0]) * u1[0] + (L2.end[1]   - L1.start[1]) * u1[1])
            if tb0 > tb1:
                tb0, tb1 = tb1, tb0

            lo = max(ta0, tb0) / L1.length
            hi = min(ta1, tb1) / L1.length

            # Points on L1 at overlap extents
            c1s = _lerp2(L1.start, L1.end, lo)
            c1e = _lerp2(L1.start, L1.end, hi)

            # Shift halfway toward L2
            perp = (-u1[1], u1[0])
            # Determine which direction L2 is relative to L1
            sign_vec = (L2.start[0] - L1.start[0], L2.start[1] - L1.start[1])
            sign = 1.0 if (sign_vec[0] * perp[0] + sign_vec[1] * perp[1]) >= 0 else -1.0
            half = best_d * 0.5 * sign
            cms = (c1s[0] + perp[0] * half, c1s[1] + perp[1] * half)
            cme = (c1e[0] + perp[0] * half, c1e[1] + perp[1] * half)

            walls.append(_WallCandidate(
                start=cms, end=cme, thickness=best_d,
                handles=[L1.handle, L2.handle], is_paired=True))
        else:
            # Single-line fallback
            used.add(i)
            walls.append(_WallCandidate(
                start=L1.start, end=L1.end, thickness=_DEFAULT_THICKNESS,
                handles=[L1.handle], is_paired=False))

    unpaired = sum(1 for w in walls if not w.is_paired)
    return walls, unpaired


# ---------------------------------------------------------------------------
# Step 4 — Endpoint snapping, merging, junction detection
# ---------------------------------------------------------------------------

class _SnapGrid:
    """Bucket-based spatial snap grid for 2D points."""

    def __init__(self, tol: float):
        self.tol     = tol
        self._grid: Dict[Tuple[int, int], List[Point2D]] = defaultdict(list)
        self._reps: Dict[Tuple[int, int], Point2D] = {}

    def _cell(self, pt: Point2D) -> Tuple[int, int]:
        return (int(math.floor(pt[0] / self.tol)),
                int(math.floor(pt[1] / self.tol)))

    def snap(self, pt: Point2D) -> Point2D:
        cx, cy = self._cell(pt)
        for dx in range(-1, 2):
            for dy in range(-1, 2):
                key = (cx + dx, cy + dy)
                if key in self._reps:
                    rep = self._reps[key]
                    if _dist2(rep, pt) <= self.tol:
                        return rep
        # New canonical point
        key = (cx, cy)
        self._reps[key] = pt
        return pt


def _snap_walls(walls: List[_WallCandidate], tol: float) -> Tuple[List[_WallCandidate], int]:
    grid = _SnapGrid(tol)
    snapped_count = 0
    for w in walls:
        s2 = grid.snap(w.start)
        e2 = grid.snap(w.end)
        if s2 is not w.start or e2 is not w.end:
            snapped_count += 1
        w.start = s2
        w.end   = e2
    return walls, snapped_count


def _detect_junctions(walls: List[_WallCandidate]) -> Dict[Point2D, int]:
    """Return a map of endpoint → connection degree."""
    degree: Dict[Point2D, int] = defaultdict(int)
    for w in walls:
        degree[w.start] += 1
        degree[w.end]   += 1
    return dict(degree)


# ---------------------------------------------------------------------------
# Step 5 — Planar graph / minimal cycle extraction
# ---------------------------------------------------------------------------

class _PlanarGraph:
    """
    Half-edge–style planar graph for face extraction.
    Each directed edge (u→v) knows its "next CCW edge out of v".
    """

    def __init__(self, walls: List[_WallCandidate]):
        # adj[u] = sorted list of (angle, v, wall_index)
        self._adj: Dict[Point2D, List[Tuple[float, Point2D, int]]] = defaultdict(list)
        for idx, w in enumerate(walls):
            u, v = w.start, w.end
            ang_fwd = math.atan2(v[1] - u[1], v[0] - u[0])
            ang_rev = math.atan2(u[1] - v[1], u[0] - v[0])
            self._adj[u].append((ang_fwd, v, idx))
            self._adj[v].append((ang_rev, u, idx))

        for key in self._adj:
            self._adj[key].sort(key=lambda x: x[0])

    def _next_half_edge(self, from_pt: Point2D, arrived_from: Point2D) -> Optional[Point2D]:
        """
        Given we arrived at `from_pt` from `arrived_from`, return the next
        vertex in the minimal-face traversal (rightmost turn = CW face).
        """
        neighbours = self._adj.get(from_pt, [])
        if not neighbours:
            return None

        # Angle of the incoming edge (reversed → as if we look "back")
        arr_ang = math.atan2(arrived_from[1] - from_pt[1],
                             arrived_from[0] - from_pt[0])

        # Find the neighbour with angle just *greater* than arr_ang (CCW order)
        angles = [ang for ang, _, _ in neighbours]
        angles_sorted = sorted(angles)

        # We want the first angle CW after arr_ang (i.e. smallest angle > arr_ang)
        # In planar face traversal (find minimal left face) pick the next CCW edge
        best_ang = None
        best_pt  = None
        for ang, nb_pt, _ in neighbours:
            diff = (ang - arr_ang) % (2 * math.pi)
            if diff < 1e-9:
                diff = 2 * math.pi  # avoid zero-diff (the reverse edge)
            if best_ang is None or diff < best_ang:
                best_ang = diff
                best_pt  = nb_pt
        return best_pt

    def extract_faces(self) -> List[List[Point2D]]:
        """Return all minimal polygon faces."""
        visited_edges: Set[Tuple[Point2D, Point2D]] = set()
        faces: List[List[Point2D]] = []

        for start in list(self._adj.keys()):
            for _, nxt, _ in self._adj[start]:
                if (start, nxt) in visited_edges:
                    continue
                # Trace face
                face: List[Point2D] = [start]
                cur  = nxt
                prev = start
                max_steps = len(self._adj) * 2 + 10
                steps = 0
                while cur != start and steps < max_steps:
                    visited_edges.add((prev, cur))
                    face.append(cur)
                    nxt_pt = self._next_half_edge(cur, prev)
                    if nxt_pt is None:
                        break
                    prev = cur
                    cur  = nxt_pt
                    steps += 1
                visited_edges.add((prev, cur))
                if cur == start and len(face) >= 3:
                    faces.append(face)

        return faces


def _filter_faces(faces: List[List[Point2D]]) -> List[List[Point2D]]:
    """Remove the outer (largest area) face and tiny/degenerate cycles."""
    if not faces:
        return []

    areas = [abs(_shoelace(f)) for f in faces]
    max_idx = max(range(len(areas)), key=lambda i: areas[i])

    result = []
    for i, (face, area) in enumerate(zip(faces, areas)):
        if i == max_idx:
            continue
        if area < _MIN_ROOM_AREA:
            continue
        # Ensure CCW winding
        if _shoelace(face) < 0:
            face = face[::-1]
        result.append(face)

    return result


# ---------------------------------------------------------------------------
# Step 5b — Spatial text extraction (room names)
# ---------------------------------------------------------------------------

def _collect_text_entities(doc: Drawing, scale: float) -> List[Tuple[Point2D, str]]:
    """Return list of (insert_point, text_string) from TEXT and MTEXT entities."""
    texts: List[Tuple[Point2D, str]] = []
    msp = doc.modelspace()
    for e in msp:
        if e.dxftype() == "TEXT":
            try:
                pt = (e.dxf.insert.x * scale, e.dxf.insert.y * scale)
                texts.append((pt, e.dxf.text.strip()))
            except Exception:
                pass
        elif e.dxftype() == "MTEXT":
            try:
                pt = (e.dxf.insert.x * scale, e.dxf.insert.y * scale)
                texts.append((pt, e.plain_text().strip()))
            except Exception:
                pass
    return texts


def _assign_room_names(faces: List[List[Point2D]],
                       texts: List[Tuple[Point2D, str]]) -> List[Optional[str]]:
    names: List[Optional[str]] = [None] * len(faces)
    for (pt, label) in texts:
        for i, face in enumerate(faces):
            if _point_in_polygon(pt, face):
                # Prefer longer / more descriptive existing name
                if names[i] is None or len(label) > len(names[i]):
                    names[i] = label
    return names


# ---------------------------------------------------------------------------
# Step 6 — Column detection
# ---------------------------------------------------------------------------

class _ColumnCandidate:
    __slots__ = ("position", "width", "depth", "source_handle", "detection_type")

    def __init__(self, position: Point2D, width: float, depth: float,
                 source_handle: str, detection_type: str):
        self.position       = position
        self.width          = width
        self.depth          = depth
        self.source_handle  = source_handle
        self.detection_type = detection_type


def _collect_explicit_columns(doc: Drawing, scale: float,
                               col_keywords: Tuple[str, ...]) -> List[_ColumnCandidate]:
    columns: List[_ColumnCandidate] = []
    msp = doc.modelspace()

    for e in msp:
        etype = e.dxftype()

        # Explicit block inserts
        if etype == "INSERT":
            name = e.dxf.name.upper() if e.dxf.hasattr("name") else ""
            layer = e.dxf.layer.upper() if e.dxf.hasattr("layer") else ""
            name_match  = any(k in name  for k in col_keywords)
            layer_match = any(k in layer for k in col_keywords)
            if name_match or layer_match:
                pt = (e.dxf.insert.x * scale, e.dxf.insert.y * scale)
                sx = getattr(e.dxf, "xscale", 1.0) * scale
                sy = getattr(e.dxf, "yscale", 1.0) * scale
                handle = e.dxf.handle if e.dxf.hasattr("handle") else "?"
                columns.append(_ColumnCandidate(
                    position=pt, width=abs(sx) * 0.3, depth=abs(sy) * 0.3,
                    source_handle=handle, detection_type="explicit_block"))

        # Closed rectangles / polylines on column layers
        elif etype in ("LWPOLYLINE", "POLYLINE"):
            layer = e.dxf.layer.upper() if e.dxf.hasattr("layer") else ""
            if not any(k in layer for k in col_keywords):
                continue
            try:
                pts = [(p[0] * scale, p[1] * scale) for p in e.get_points()]
            except Exception:
                continue
            if len(pts) < 3:
                continue
            closed = getattr(e.dxf, "closed", False) or \
                     (len(pts) >= 4 and _dist2(pts[0], pts[-1]) < _SNAP_TOLERANCE)
            if not closed:
                continue
            bb = _bbox(pts)
            cx = (bb["xmin"] + bb["xmax"]) * 0.5
            cy = (bb["ymin"] + bb["ymax"]) * 0.5
            handle = e.dxf.handle if e.dxf.hasattr("handle") else "?"
            columns.append(_ColumnCandidate(
                position=(cx, cy), width=bb["width"], depth=bb["depth"],
                source_handle=handle, detection_type="explicit_polyline"))

        # Circles on column layers
        elif etype == "CIRCLE":
            layer = e.dxf.layer.upper() if e.dxf.hasattr("layer") else ""
            if not any(k in layer for k in col_keywords):
                continue
            cx = e.dxf.center.x * scale
            cy = e.dxf.center.y * scale
            r  = e.dxf.radius * scale
            handle = e.dxf.handle if e.dxf.hasattr("handle") else "?"
            columns.append(_ColumnCandidate(
                position=(cx, cy), width=r * 2, depth=r * 2,
                source_handle=handle, detection_type="explicit_polyline"))

    return columns


def _infer_junction_columns(degree_map: Dict[Point2D, int],
                             existing: List[_ColumnCandidate],
                             snap_tol: float) -> List[_ColumnCandidate]:
    """Add implicit columns at T/cross junctions not already covered."""
    # Build a quick lookup set of existing column positions
    existing_pts: Set[Point2D] = set()
    for col in existing:
        existing_pts.add(col.position)

    inferred: List[_ColumnCandidate] = []
    for pt, deg in degree_map.items():
        if deg < 3:
            continue  # only T, cross, and higher junctions
        # Check no explicit column nearby
        covered = any(_dist2(pt, ep) <= snap_tol * 2 for ep in existing_pts)
        if not covered:
            inferred.append(_ColumnCandidate(
                position=pt, width=0.30, depth=0.30,
                source_handle="inferred", detection_type="inferred_junction"))
    return inferred


# ---------------------------------------------------------------------------
# Step 7 — Beam inference
# ---------------------------------------------------------------------------

class _BeamCandidate:
    __slots__ = ("start", "end", "supporting_wall_id")

    def __init__(self, start: Point2D, end: Point2D, wall_id: str):
        self.start              = start
        self.end                = end
        self.supporting_wall_id = wall_id


def _infer_beams(walls: List[_WallCandidate],
                 slabs: List[List[Point2D]]) -> List[_BeamCandidate]:
    """Generate perimeter beams along supporting wall centrelines."""
    beams: List[_BeamCandidate] = []
    for w in walls:
        beams.append(_BeamCandidate(start=w.start, end=w.end, wall_id=w.id))
    return beams


# ---------------------------------------------------------------------------
# Output serialisation helpers
# ---------------------------------------------------------------------------

def _pt3(xy: Point2D, z: float) -> List[float]:
    return [round(xy[0], 4), round(xy[1], 4), round(z, 4)]


def _build_wall_output(walls: List[_WallCandidate], z: float) -> List[Dict[str, Any]]:
    out = []
    for w in walls:
        out.append({
            "id":             w.id,
            "type":           "wall",
            "start":          _pt3(w.start, z),
            "end":            _pt3(w.end,   z),
            "thickness":      round(w.thickness, 4),
            "length":         round(w.length,    4),
            "source_handles": w.handles,
            "is_paired":      w.is_paired,
            "is_single_line_fallback": not w.is_paired,
            "confidence":     round(w.confidence, 3),
            "properties": {
                "width":  round(w.thickness, 4),
                "height": 0.0,   # floor height set by caller
            }
        })
    return out


def _build_column_output(cols: List[_ColumnCandidate],
                         z: float, h: float) -> List[Dict[str, Any]]:
    out = []
    for idx, c in enumerate(cols):
        cid = f"C{idx + 1}"
        out.append({
            "id":             cid,
            "type":           "column",
            "position":       _pt3(c.position, z),
            "start":          _pt3(c.position, z),
            "end":            _pt3(c.position, z + h),
            "width":          round(c.width,  4),
            "depth":          round(c.depth,  4),
            "height":         round(h,         4),
            "source_handle":  c.source_handle,
            "detection_type": c.detection_type,
            "properties": {
                "width":  round(c.width,  4),
                "depth":  round(c.depth,  4),
                "height": round(h,         4),
            }
        })
    return out


def _build_beam_output(beams: List[_BeamCandidate], z: float, h: float) -> List[Dict[str, Any]]:
    out = []
    for idx, b in enumerate(beams):
        out.append({
            "id":                f"B{idx + 1}",
            "type":              "beam",
            "start":             _pt3(b.start, z + h),
            "end":               _pt3(b.end,   z + h),
            "width":             _BEAM_WIDTH,
            "depth":             _BEAM_DEPTH,
            "span":              round(_dist2(b.start, b.end), 4),
            "supporting_wall_id": b.supporting_wall_id,
            "properties": {
                "width": _BEAM_WIDTH,
                "depth": _BEAM_DEPTH,
            }
        })
    return out


def _build_slab_output(faces: List[List[Point2D]], names: List[Optional[str]],
                       z: float, h: float) -> List[Dict[str, Any]]:
    out = []
    for idx, (face, name) in enumerate(zip(faces, names)):
        area   = abs(_shoelace(face))
        bb     = _bbox(face)
        lx, ly = bb["width"], bb["depth"]
        if min(lx, ly) < 1e-6:
            aspect = 99.0
        else:
            aspect = max(lx, ly) / min(lx, ly)
        slab_type = "two-way" if aspect <= 2.0 else "one-way"
        out.append({
            "id":           f"S{idx + 1}",
            "type":         "slab",
            "name":         name or f"ROOM_{idx + 1}",
            "start":        _pt3((bb["xmin"], bb["ymin"]), z + h),
            "end":          _pt3((bb["xmax"], bb["ymax"]), z + h),
            "polygon":      [[round(p[0], 4), round(p[1], 4)] for p in face],
            "bbox":         {k: round(v, 4) for k, v in bb.items()},
            "area_m2":      round(area, 4),
            "aspect_ratio": round(aspect, 4),
            "slab_type":    slab_type,
            "elevation":    round(z + h, 4),
            "properties": {
                "width":         round(bb["width"], 4),
                "depth":         round(bb["depth"], 4),
                "thickness":     0.20,    # default slab thickness; refine if tagged
                "load_combined": 0.0,
            }
        })
    return out


def _build_layers_summary(doc: Drawing) -> List[Dict[str, Any]]:
    layer_counts: Dict[str, int] = defaultdict(int)
    msp = doc.modelspace()
    for e in msp:
        layer = e.dxf.layer if e.dxf.hasattr("layer") else "0"
        layer_counts[layer] += 1
    return [{"name": k, "entity_count": v} for k, v in sorted(layer_counts.items())]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def process_file(
    file_path:          str,
    storey_level:       int                 = 1,
    storey_height:      float               = 3.5,
    wall_layers:        Optional[List[str]] = None,
    column_layers:      Optional[List[str]] = None,
    snap_tolerance:     float               = _SNAP_TOLERANCE,
    min_wall_thickness: float               = _MIN_THICKNESS,
    max_wall_thickness: float               = _MAX_THICKNESS,
) -> Dict[str, Any]:
    """
    Extract structural elements from an architectural DXF file.

    Parameters
    ----------
    file_path          : Absolute or relative path to the .dxf file.
    storey_level       : 1-based storey index (used to compute z = (level-1)*height).
    storey_height      : Floor-to-floor height in metres (default 3.5 m).
    wall_layers        : Optional explicit list of DXF layer names to treat as walls.
                         If None, any layer whose name contains a default keyword is used.
    column_layers      : Optional explicit list of DXF layer names to treat as columns.
    snap_tolerance     : Endpoint snap distance in metres.
    min_wall_thickness : Minimum wall thickness in metres.
    max_wall_thickness : Maximum wall thickness in metres.

    Returns
    -------
    dict  Matching the output contract specified in the Fundi Studio documentation.
    """
    warnings: List[str] = []
    z = (storey_level - 1) * storey_height

    # ------------------------------------------------------------------ #
    # 1. Read DXF
    # ------------------------------------------------------------------ #
    try:
        doc: Drawing = ezdxf.readfile(file_path)
    except Exception as exc:
        return {
            "status":      "error",
            "error":       str(exc),
            "elements":    {"walls": [], "columns": [], "beams": [], "slabs": []},
            "diagnostics": {"warnings": [str(exc)]},
        }

    # ------------------------------------------------------------------ #
    # 1b. Unit normalisation
    # ------------------------------------------------------------------ #
    unit_code, scale, unit_name = _detect_units(doc)

    # ------------------------------------------------------------------ #
    # 2. Collect wall-candidate lines
    # ------------------------------------------------------------------ #
    if wall_layers:
        # User supplied explicit layer names → match exactly (case-insensitive)
        wall_keywords: Tuple[str, ...] = tuple(l.upper() for l in wall_layers)
    else:
        wall_keywords = _DEFAULT_WALL_KEYWORDS

    if column_layers:
        col_keywords: Tuple[str, ...] = tuple(l.upper() for l in column_layers)
    else:
        col_keywords = _DEFAULT_COLUMN_KEYWORDS

    raw_lines = _collect_lines(doc, scale, wall_keywords)
    if not raw_lines:
        warnings.append("No LINE entities found on wall layers.")

    # ------------------------------------------------------------------ #
    # 3. Pair double-lines → wall candidates
    # ------------------------------------------------------------------ #
    walls, unpaired_count = _pair_walls(raw_lines, min_wall_thickness, max_wall_thickness)
    if unpaired_count > 0:
        warnings.append(f"{unpaired_count} single-line wall(s) could not be paired.")

    # ------------------------------------------------------------------ #
    # 4. Snap endpoints; detect junctions
    # ------------------------------------------------------------------ #
    walls, snap_count = _snap_walls(walls, snap_tolerance)
    degree_map = _detect_junctions(walls)

    # Assign IDs
    for idx, w in enumerate(walls):
        w.id = f"W{idx + 1}"

    # ------------------------------------------------------------------ #
    # 5. Planar graph → minimal face cycles → slab polygons
    # ------------------------------------------------------------------ #
    faces: List[List[Point2D]] = []
    if len(walls) >= 3:
        try:
            graph = _PlanarGraph(walls)
            raw_faces = graph.extract_faces()
            faces = _filter_faces(raw_faces)
            if not faces:
                warnings.append("No closed room cycles detected.")
        except Exception as exc:
            warnings.append(f"Planar face extraction failed: {exc}")
    else:
        warnings.append("Fewer than 3 walls found; skipping cycle detection.")

    # ------------------------------------------------------------------ #
    # 5b. Assign room names from text entities
    # ------------------------------------------------------------------ #
    text_entities = _collect_text_entities(doc, scale)
    room_names: List[Optional[str]] = _assign_room_names(faces, text_entities)

    # ------------------------------------------------------------------ #
    # 6. Column detection
    # ------------------------------------------------------------------ #
    explicit_cols  = _collect_explicit_columns(doc, scale, col_keywords)
    inferred_cols  = _infer_junction_columns(degree_map, explicit_cols, snap_tolerance)
    all_cols       = explicit_cols + inferred_cols

    # ------------------------------------------------------------------ #
    # 7. Beam inference
    # ------------------------------------------------------------------ #
    beams = _infer_beams(walls, faces)

    # ------------------------------------------------------------------ #
    # 8. Build output
    # ------------------------------------------------------------------ #
    layers_summary = _build_layers_summary(doc)

    return {
        "status": "success",
        "units": {
            "code":         unit_code,
            "scale_factor": scale,
            "unit_name":    unit_name,
        },
        "layers": layers_summary,
        "elements": {
            "walls":   _build_wall_output(walls, z),
            "columns": _build_column_output(all_cols, z, storey_height),
            "beams":   _build_beam_output(beams, z, storey_height),
            "slabs":   _build_slab_output(faces, room_names, z, storey_height),
        },
        "diagnostics": {
            "unpaired_wall_lines":  unpaired_count,
            "snapped_intersections": snap_count,
            "cycles_found":         len(faces),
            "warnings":             warnings,
        },
    }


class DeterministicCADExtractor:
    """Configurable wrapper class for deterministic CAD structural extraction."""

    def __init__(
        self,
        snap_tolerance: float = _SNAP_TOLERANCE,
        min_wall_thickness: float = _MIN_THICKNESS,
        max_wall_thickness: float = _MAX_THICKNESS,
    ):
        self.snap_tolerance = snap_tolerance
        self.min_wall_thickness = min_wall_thickness
        self.max_wall_thickness = max_wall_thickness

    def process_file(
        self,
        file_path: str,
        storey_level: int = 1,
        storey_height: float = 3.5,
        wall_layers: Optional[List[str]] = None,
        column_layers: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        return process_file(
            file_path=file_path,
            storey_level=storey_level,
            storey_height=storey_height,
            wall_layers=wall_layers,
            column_layers=column_layers,
            snap_tolerance=self.snap_tolerance,
            min_wall_thickness=self.min_wall_thickness,
            max_wall_thickness=self.max_wall_thickness,
        )


# ---------------------------------------------------------------------------
# CLI entry-point (dev/debug)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import json
    import sys

    if len(sys.argv) < 2:
        print("Usage: python deterministic_cad_extractor.py <file.dxf> [storey_height]")
        sys.exit(1)

    path   = sys.argv[1]
    height = float(sys.argv[2]) if len(sys.argv) > 2 else 3.5
    result = process_file(path, storey_height=height)
    print(json.dumps(result, indent=2))
