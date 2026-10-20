
"""
Canonical DXF generator for Drainage System with Manhole Run to Public Sewer
Exam Drawing No. 02 – Connection to the Sewer + Typical Manhole Section

Units: millimetres (plan distances converted from metres)
"""

import ezdxf
from ezdxf import units
from ezdxf.math import Vec2
import math

# ----------------------------------------------------------------------
# Helper functions
# ----------------------------------------------------------------------
def add_rect(msp, x, y, w, h, layer, closed=True):
    """Add a rectangle by lower-left corner (x,y), width w, height h."""
    pts = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    msp.add_lwpolyline(pts, close=closed, dxfattribs={"layer": layer})


def add_hatch_rect(msp, x, y, w, h, layer, pattern="ANSI31", scale=0.5):
    """Add a rectangular hatch."""
    hatch = msp.add_hatch(color=7, dxfattribs={"layer": layer})
    hatch.paths.add_polyline_path(
        [(x, y), (x + w, y), (x + w, y + h), (x, y + h)],
        is_closed=True
    )
    hatch.set_pattern_fill(pattern, scale=scale)


def add_text(msp, text, insert, height=150, layer="TEXT", style="Standard"):
    """Simple text helper (uses MText for reliability)."""
    msp.add_mtext(
        text,
        dxfattribs={
            "layer": layer,
            "char_height": height,
            "insert": insert,
            "attachment_point": 5,  # middle-center
            "style": style
        }
    )


# ----------------------------------------------------------------------
# Main generation
# ----------------------------------------------------------------------
def create_drainage_dxf(filename="drainage_manhole_system.dxf"):
    doc = ezdxf.new("R2010")
    doc.units = units.MM
    msp = doc.modelspace()

    # ------------------------------------------------------------------
    # Layers
    # ------------------------------------------------------------------
    layers = {
        "BUILDING":        {"color": 7},
        "MANHOLES_PLAN":   {"color": 7},
        "PIPES":           {"color": 5},   # blue-ish
        "BOUNDARY":        {"color": 3},
        "ROAD":            {"color": 8},
        "SEWER":           {"color": 1},
        "SECTION_OUTLINE": {"color": 7},
        "SECTION_HATCH_WALL": {"color": 7},
        "SECTION_HATCH_CONCRETE": {"color": 7},
        "STEP_IRONS":      {"color": 4},
        "DIMENSIONS":      {"color": 2},
        "TEXT":            {"color": 7},
        "CENTERLINE":      {"color": 8, "linetype": "CENTER"},
    }
    for name, attrs in layers.items():
        if name not in doc.layers:
            doc.layers.new(name=name, dxfattribs=attrs)

    # Ensure CENTER linetype exists
    if "CENTER" not in doc.linetypes:
        doc.linetypes.new("CENTER", dxfattribs={
            "description": "Center ____ _ ____ _ ____",
            "pattern": [1.25, 0.25, -1.25, 0.25]
        })

    # ==================================================================
    # VIEW 1 – LAYOUT PLAN  (origin at centre of MH1)
    # All plan distances in metres → converted to mm (*1000)
    # ==================================================================
    # Coordinates (mm)
    MH1 = (0, 0)
    GT  = (-2000, 0)
    MH2 = (20000, 0)
    MH3 = (20000, -30000)
    SEWER_NODE = (20000, -42000)

    # ---- Building (schematic) ----
    # Place a simple rectangle to the left of the GT
    bldg_w, bldg_h = 4000, 3000
    bldg_x = GT[0] - bldg_w - 500
    bldg_y = -bldg_h / 2
    add_rect(msp, bldg_x, bldg_y, bldg_w, bldg_h, "BUILDING")
    add_text(msp, "BUILDING", (bldg_x + bldg_w/2, bldg_y + bldg_h/2), height=200, layer="TEXT")

    # ---- Gully Trap ----
    gt_size = 400
    add_rect(msp, GT[0]-gt_size/2, GT[1]-gt_size/2, gt_size, gt_size, "MANHOLES_PLAN")
    add_text(msp, "150mm φ G.T.", (GT[0], GT[1] + 600), height=150, layer="TEXT")

    # ---- Manhole symbols (schematic squares – NOT to internal size) ----
    mh_sym = 600  # visual size for plan symbols
    for centre, label in [(MH1, "MH1\n600×600"), (MH2, "MH2\n1000×800"), (MH3, "MH3\n1200×800")]:
        add_rect(msp, centre[0]-mh_sym/2, centre[1]-mh_sym/2, mh_sym, mh_sym, "MANHOLES_PLAN")
        add_text(msp, label, (centre[0], centre[1] + mh_sym/2 + 400), height=180, layer="TEXT")

    # ---- Public sewer node ----
    msp.add_circle(SEWER_NODE, radius=400, dxfattribs={"layer": "SEWER"})
    add_text(msp, "Public Sewer", (SEWER_NODE[0] + 1500, SEWER_NODE[1]), height=180, layer="TEXT")

    # ---- Pipes (centre-line style) ----
    # P1: GT → MH1  100 mm PVC  1:60
    msp.add_line(GT, MH1, dxfattribs={"layer": "PIPES", "linetype": "CENTER"})
    add_text(msp, "100 mm PVC  1:60", ((GT[0]+MH1[0])/2, 800), height=140, layer="TEXT")

    # P2: MH1 → MH2  150 mm PVC  1:60
    msp.add_line(MH1, MH2, dxfattribs={"layer": "PIPES", "linetype": "CENTER"})
    add_text(msp, "150 mm PVC  1:60   20 m C/C", ((MH1[0]+MH2[0])/2, 800), height=140, layer="TEXT")

    # P3: MH2 → MH3  200 mm PVC  1:60
    msp.add_line(MH2, MH3, dxfattribs={"layer": "PIPES", "linetype": "CENTER"})
    add_text(msp, "200 mm PVC  1:60\n30 m C/C", (MH2[0] + 1200, (MH2[1]+MH3[1])/2), height=140, layer="TEXT")

    # P4: MH3 → Public Sewer  250 mm concrete  1:60
    msp.add_line(MH3, SEWER_NODE, dxfattribs={"layer": "PIPES", "linetype": "CENTER"})
    add_text(msp, "250 mm Concrete  1:60", (MH3[0] + 1200, (MH3[1]+SEWER_NODE[1])/2), height=140, layer="TEXT")

    # ---- Boundary line (with X markers) at y = -30000 ----
    boundary_y = -30000
    x_start, x_end = -6000, 28000
    msp.add_line((x_start, boundary_y), (x_end, boundary_y), dxfattribs={"layer": "BOUNDARY"})
    # X ticks every 2000 mm
    for x in range(int(x_start), int(x_end)+1, 2000):
        msp.add_line((x-150, boundary_y-150), (x+150, boundary_y+150), dxfattribs={"layer": "BOUNDARY"})
        msp.add_line((x-150, boundary_y+150), (x+150, boundary_y-150), dxfattribs={"layer": "BOUNDARY"})
    add_text(msp, "BOUNDARY", (x_end - 3000, boundary_y + 600), height=160, layer="TEXT")

    # ---- Road edges ----
    road_n = -34000
    road_s = -40000
    msp.add_line((x_start, road_n), (x_end, road_n), dxfattribs={"layer": "ROAD"})
    msp.add_line((x_start, road_s), (x_end, road_s), dxfattribs={"layer": "ROAD"})
    add_text(msp, "TARMAC ROAD", ((x_start+x_end)/2, (road_n+road_s)/2), height=200, layer="TEXT")

    # ---- Public sewer line (horizontal dash-dot through node) ----
    sewer_y = -42000
    msp.add_line((14000, sewer_y), (x_end, sewer_y), dxfattribs={"layer": "SEWER", "linetype": "CENTER"})
    # short vertical tick / bracket left of node
    msp.add_line((14000, sewer_y-300), (14000, sewer_y+300), dxfattribs={"layer": "SEWER"})

    # ---- Key dimensions (plan) ----
    # 2.0 m GT–MH1
    msp.add_line((GT[0], -1200), (MH1[0], -1200), dxfattribs={"layer": "DIMENSIONS"})
    msp.add_line((GT[0], -1000), (GT[0], -1400), dxfattribs={"layer": "DIMENSIONS"})
    msp.add_line((MH1[0], -1000), (MH1[0], -1400), dxfattribs={"layer": "DIMENSIONS"})
    add_text(msp, "2.0 m", ((GT[0]+MH1[0])/2, -1600), height=140, layer="DIMENSIONS")

    # 20 m C/C MH1–MH2
    msp.add_line((MH1[0], 1500), (MH2[0], 1500), dxfattribs={"layer": "DIMENSIONS"})
    add_text(msp, "20 m C/C", ((MH1[0]+MH2[0])/2, 1800), height=140, layer="DIMENSIONS")

    # Vertical dimensions on the right side of the road/sewer
    dim_x = 26000
    # 4.00 m boundary → north road edge
    msp.add_line((dim_x, boundary_y), (dim_x, road_n), dxfattribs={"layer": "DIMENSIONS"})
    add_text(msp, "4.00 m", (dim_x + 600, (boundary_y+road_n)/2), height=140, layer="DIMENSIONS")
    # 6.00 m road width
    msp.add_line((dim_x + 1500, road_n), (dim_x + 1500, road_s), dxfattribs={"layer": "DIMENSIONS"})
    add_text(msp, "6.00 m", (dim_x + 2100, (road_n+road_s)/2), height=140, layer="DIMENSIONS")
    # 2.00 m south road → sewer
    msp.add_line((dim_x + 3000, road_s), (dim_x + 3000, sewer_y), dxfattribs={"layer": "DIMENSIONS"})
    add_text(msp, "2.00 m", (dim_x + 3600, (road_s+sewer_y)/2), height=140, layer="DIMENSIONS")

    # Title for plan
    add_text(msp, "LAYOUT PLAN – Connection to the Sewer", (10000, 4000), height=250, layer="TEXT")

    # ==================================================================
    # VIEW 2 – TYPICAL SECTION THROUGH MANHOLE
    # Placed to the right of the plan (origin shifted)
    # ==================================================================
    SEC_ORIGIN_X = 45000   # mm offset so section sits clear of plan
    SEC_ORIGIN_Y = -15000

    # Parameters (mm) – only confirmed values used
    WALL_THK   = 150
    BASE_THK   = 150
    SLAB_THK   = 100          # strongly inferred
    RENDER_THK = 12
    BENCH_H    = 175          # average
    COVER_W    = 600
    COVER_D    = 450
    STEP_DIA   = 12
    STEP_SPACING = 300

    # We choose a representative internal clear width for the typical section.
    # Spec lists three sizes; we use a mid-size (1000 mm) as representative.
    INTERNAL_W = 1000
    # Shaft height (unknown) – assume a reasonable working height for drawing
    SHAFT_H = 1800

    # Outer width = internal + 2×wall
    OUTER_W = INTERNAL_W + 2 * WALL_THK

    # Local origin of section (bottom-left of base)
    ox = SEC_ORIGIN_X
    oy = SEC_ORIGIN_Y

    # ---- Base concrete ----
    base_x = ox
    base_y = oy
    add_rect(msp, base_x, base_y, OUTER_W, BASE_THK, "SECTION_OUTLINE")
    add_hatch_rect(msp, base_x, base_y, OUTER_W, BASE_THK, "SECTION_HATCH_CONCRETE", "DOTS", 0.8)
    add_text(msp, "Concrete (1:3:6) 150 mm Thick", (ox + OUTER_W/2, oy - 400), height=120, layer="TEXT")

    # ---- Walls ----
    wall_bot = oy + BASE_THK
    # Left wall
    add_rect(msp, ox, wall_bot, WALL_THK, SHAFT_H, "SECTION_OUTLINE")
    add_hatch_rect(msp, ox, wall_bot, WALL_THK, SHAFT_H, "SECTION_HATCH_WALL", "ANSI31", 0.6)
    # Right wall
    add_rect(msp, ox + OUTER_W - WALL_THK, wall_bot, WALL_THK, SHAFT_H, "SECTION_OUTLINE")
    add_hatch_rect(msp, ox + OUTER_W - WALL_THK, wall_bot, WALL_THK, SHAFT_H, "SECTION_HATCH_WALL", "ANSI31", 0.6)
    add_text(msp, "150 mm SCB Wall", (ox - 800, wall_bot + SHAFT_H/2), height=120, layer="TEXT")

    # ---- Top slab ----
    slab_y = wall_bot + SHAFT_H
    # Slight overhang beyond walls (typical)
    overhang = 50
    add_rect(msp, ox - overhang, slab_y, OUTER_W + 2*overhang, SLAB_THK, "SECTION_OUTLINE")
    add_hatch_rect(msp, ox - overhang, slab_y, OUTER_W + 2*overhang, SLAB_THK, "SECTION_HATCH_CONCRETE", "DOTS", 0.8)
    add_text(msp, "100 mm PCC Slab, reinforced with Ref. A142",
             (ox + OUTER_W/2, slab_y + SLAB_THK + 300), height=120, layer="TEXT")

    # ---- Cover opening & cover (schematic) ----
    cover_x = ox + (OUTER_W - COVER_W) / 2
    cover_y = slab_y + SLAB_THK
    # Opening
    add_rect(msp, cover_x, cover_y - 20, COVER_W, 20, "SECTION_OUTLINE")  # recess
    # Cover symbol (rectangle on top)
    add_rect(msp, cover_x, cover_y, COVER_W, 40, "SECTION_OUTLINE")
    add_text(msp, "600 × 450 mm MDCI Cover", (ox + OUTER_W/2, cover_y + 250), height=120, layer="TEXT")

    # ---- Benching + central channel ----
    # Benching sits on the base, average 175 mm high, sloping to a U-channel
    bench_top = wall_bot + BENCH_H
    channel_half = 150  # assumed half-width of channel (UNKNOWN – documented)

    # Left bench (sloping)
    left_bench = [
        (ox + WALL_THK, wall_bot),
        (ox + WALL_THK, bench_top),
        (ox + OUTER_W/2 - channel_half, wall_bot + 40),
        (ox + WALL_THK, wall_bot)
    ]
    msp.add_lwpolyline(left_bench, close=True, dxfattribs={"layer": "SECTION_OUTLINE"})
    # Right bench
    right_bench = [
        (ox + OUTER_W - WALL_THK, wall_bot),
        (ox + OUTER_W - WALL_THK, bench_top),
        (ox + OUTER_W/2 + channel_half, wall_bot + 40),
        (ox + OUTER_W - WALL_THK, wall_bot)
    ]
    msp.add_lwpolyline(right_bench, close=True, dxfattribs={"layer": "SECTION_OUTLINE"})

    # Central U-channel (simple arc approximation)
    channel_pts = []
    cx = ox + OUTER_W / 2
    for a in range(180, -1, -10):
        rad = math.radians(a)
        channel_pts.append((cx + channel_half * math.cos(rad),
                            wall_bot + 40 + (channel_half * 0.6) * math.sin(rad)))
    msp.add_lwpolyline(channel_pts, dxfattribs={"layer": "SECTION_OUTLINE"})

    add_text(msp, "175 mm (av) High Benching (1:3:6)",
             (ox + OUTER_W/2, wall_bot + BENCH_H + 200), height=110, layer="TEXT")

    # ---- Step irons (left wall only) ----
    # First step below underside of slab, then every 300 mm
    step_start_y = slab_y - 200
    for i in range(5):
        sy = step_start_y - i * STEP_SPACING
        if sy < wall_bot + BENCH_H + 100:
            break
        # short horizontal bar
        msp.add_line((ox + WALL_THK, sy), (ox + WALL_THK + 80, sy),
                     dxfattribs={"layer": "STEP_IRONS"})
        msp.add_circle((ox + WALL_THK + 40, sy), STEP_DIA/2,
                       dxfattribs={"layer": "STEP_IRONS"})
    add_text(msp, "12 mm MS Step Iron\nat 300 mm centres",
             (ox - 1200, wall_bot + SHAFT_H/2 - 200), height=110, layer="TEXT")

    # ---- Waterproof render note ----
    add_text(msp, "12 mm Waterproof Render\n(inner faces)",
             (ox + OUTER_W + 400, wall_bot + SHAFT_H/2), height=110, layer="TEXT")

    # ---- Section title ----
    add_text(msp, "TYPICAL SECTION THROUGH MANHOLE",
             (ox + OUTER_W/2, oy - 1200), height=200, layer="TEXT")
    add_text(msp, "(Representative internal size 1000 mm – see notes)",
             (ox + OUTER_W/2, oy - 1500), height=110, layer="TEXT")

    # ---- Ground level note ----
    add_text(msp, "Ground Level = 50.00",
             (ox + OUTER_W/2, slab_y + SLAB_THK + 600), height=140, layer="TEXT")

    # ------------------------------------------------------------------
    # Title block / notes
    # ------------------------------------------------------------------
    notes_x = 5000
    notes_y = -52000
    add_text(msp, "NOTES", (notes_x, notes_y), height=200, layer="TEXT")
    notes = [
        "1. All plan dimensions in metres; section in millimetres.",
        "2. Pipe diameters, materials and gradients as labelled (all gradients 1:60).",
        "3. Manhole internal sizes: MH1 600×600, MH2 1000×800, MH3 1200×800.",
        "4. Plan manhole symbols are schematic (not drawn to internal size).",
        "5. Section shows representative construction; wall height assumed 1800 mm.",
        "6. Channel half-width assumed 150 mm (not dimensioned on original).",
        "7. Top slab thickness 100 mm (inferred – first digit cropped on original).",
        "8. Do not scale from this drawing."
    ]
    for i, line in enumerate(notes):
        add_text(msp, line, (notes_x, notes_y - 400 - i*250), height=120, layer="TEXT")

    # Save
    doc.saveas(filename)
    print(f"DXF written: {filename}")
    return filename


if __name__ == "__main__":
    from pathlib import Path

    output_dir = Path(__file__).parent / "civil_outputs"
    output_dir.mkdir(parents=True, exist_ok=True)

    create_drainage_dxf(output_dir / "drainage_manhole_1.dxf")