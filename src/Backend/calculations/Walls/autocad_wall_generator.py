"""
RC Wall DXF Generator - BS 8110 / Eurocode 2 Compliant
Generates detailed AutoCAD DXF files for reinforced concrete walls
"""

import ezdxf
from ezdxf.enums import TextEntityAlignment
import io
import math


def generate_wall_dxf(params):
    """
    Generates a DXF file for RC wall sections based on BS 8110/EC2.
    
    params: dict containing:
        - wall_type: "shear", "core", "bearing"
        - thickness: mm
        - height: m (converted to mm)
        - length: m (converted to mm)
        - cover: mm
        - vertical_steel: {"diameter": int, "spacing": int}
        - horizontal_steel: {"diameter": int, "spacing": int}
        - concrete_grade: str (e.g., "C30")
        - steel_grade: str (e.g., "460")
        - exposure_class: str (e.g., "XC3")
        - has_starter_bars: bool (default True)
        - has_kicker: bool (default True)
        - kicker_height: mm (default 75)
        - lap_length: mm (calculated or provided)
        
    Returns: String of DXF file content
    """
    
    # Extract and convert parameters
    wall_type = params.get("wall_type", "shear").lower()
    t = float(params.get("thickness", 200))  # Wall thickness in mm
    h_m = float(params.get("height", 3.5))  # Height in meters
    h = h_m * 1000  # Convert to mm
    length_m = float(params.get("length", 6.0))  # Length in meters
    length = length_m * 1000  # Convert to mm
    cover = float(params.get("cover", 30))
    
    # Steel details
    vert_dia = int(params.get("vertical_steel", {}).get("diameter", 16))
    vert_spacing = int(params.get("vertical_steel", {}).get("spacing", 200))
    horiz_dia = int(params.get("horizontal_steel", {}).get("diameter", 12))
    horiz_spacing = int(params.get("horizontal_steel", {}).get("spacing", 250))
    
    # Additional details
    concrete_grade = params.get("concrete_grade", "C30")
    steel_grade = params.get("steel_grade", "460")
    exposure_class = params.get("exposure_class", "XC3")
    has_starter = params.get("has_starter_bars", True)
    has_kicker = params.get("has_kicker", True)
    kicker_height = float(params.get("kicker_height", 75))
    
    # Calculate lap length (40 x diameter per BS 8110)
    lap_length = params.get("lap_length", 40 * vert_dia)
    
    # U-bar dimensions for wall thickness
    u_bar_dia = 12  # Typically T12 for U-bars
    u_bar_spacing = 300  # Typical spacing
    
    # --- Setup DXF Document ---
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    
    # Create text style
    if "Standard" not in doc.styles:
        doc.styles.new("Standard", dxfattribs={"font": "Arial.ttf"})
    
    # Define layers with colors
    layers = {
        "Concrete": 7,        # White/Black
        "Reinforcement": 5,   # Blue
        "Dimensions": 3,      # Green
        "Text": 2,            # Yellow
        "Hatching": 8,        # Gray
        "Centerline": 1,      # Red (dashed)
    }
    
    for name, color in layers.items():
        if name not in doc.layers:
            doc.layers.new(name=name, dxfattribs={"color": color})
    
    # Set centerline as dashed
    doc.layers.get("Centerline").dxf.linetype = "DASHED"
    
    # --- Drawing Scale and Origin ---
    # We'll draw multiple views:
    # 1. Section view (showing thickness)
    # 2. Elevation view (showing height and length)
    # 3. Detail views (starter bars, connections, etc.)
    
    scale = 1.0  # 1:1 scale in mm
    
    # Origin points for different views
    section_origin = (0, 0)
    elevation_origin = (t + 2000, 0)  # Offset from section
    detail_origin = (0, -h - 3000)  # Below main views
    
    # --- SECTION VIEW (Cross-section showing thickness) ---
    draw_section_view(msp, section_origin, t, h, cover, vert_dia, vert_spacing, 
                      horiz_dia, horiz_spacing, wall_type, has_kicker, kicker_height)
    
    # --- ELEVATION VIEW (Front view showing height and length) ---
    draw_elevation_view(msp, elevation_origin, length, h, vert_spacing, horiz_spacing,
                        has_starter, lap_length, kicker_height if has_kicker else 0)
    
    # --- DETAIL VIEWS ---
    # Detail A: Starter bars and kicker
    if has_starter:
        draw_starter_detail(msp, detail_origin, t, vert_dia, cover, kicker_height, lap_length)
    
    # Detail B: Horizontal bar connection at corners/openings
    detail_b_origin = (detail_origin[0] + 1500, detail_origin[1])
    draw_corner_detail(msp, detail_b_origin, t, vert_dia, horiz_dia, cover)
    
    # Detail C: U-bar detail for shear walls
    if wall_type == "shear":
        detail_c_origin = (detail_b_origin[0] + 1500, detail_origin[1])
        draw_ubar_detail(msp, detail_c_origin, t, u_bar_dia, vert_dia, cover)
    
    # --- ANNOTATIONS AND TITLE BLOCK ---
    add_title_block(msp, params, (0, -h - 5000))
    add_general_notes(msp, params, (length + t + 2500, 0))
    add_reinforcement_schedule(msp, params, (length + t + 2500, -1500))
    
    # --- Dimensions ---
    add_section_dimensions(msp, section_origin, t, h, cover)
    add_elevation_dimensions(msp, elevation_origin, length, h)
    
    # --- Output DXF ---
    stream = io.StringIO()
    doc.write(stream)
    return stream.getvalue()


def draw_section_view(msp, origin, t, h, cover, vert_dia, vert_spacing, 
                      horiz_dia, horiz_spacing, wall_type, has_kicker, kicker_height):
    """Draw cross-sectional view of wall"""
    ox, oy = origin
    
    # Draw wall section outline
    wall_height = min(h, 3000)  # Show max 3m for clarity
    
    # Main wall rectangle
    wall_pts = [
        (ox, oy),
        (ox + t, oy),
        (ox + t, oy - wall_height),
        (ox, oy - wall_height),
        (ox, oy)
    ]
    msp.add_lwpolyline(wall_pts, dxfattribs={"layer": "Concrete", "lineweight": 50})
    
    # Add kicker if present
    if has_kicker:
        kicker_width = t + 100  # Kicker extends 50mm each side
        kicker_pts = [
            (ox - 50, oy),
            (ox - 50, oy + kicker_height),
            (ox + t + 50, oy + kicker_height),
            (ox + t + 50, oy),
        ]
        msp.add_lwpolyline(kicker_pts, dxfattribs={"layer": "Concrete", "lineweight": 30})
    
    # Draw cover lines (dashed)
    cover_pts = [
        (ox + cover, oy - cover),
        (ox + t - cover, oy - cover),
        (ox + t - cover, oy - wall_height + cover),
        (ox + cover, oy - wall_height + cover),
        (ox + cover, oy - cover)
    ]
    msp.add_lwpolyline(cover_pts, dxfattribs={"layer": "Dimensions", "linetype": "DASHED"})
    
    # Draw vertical reinforcement (both faces)
    num_vert_bars = int(wall_height / vert_spacing) + 1
    
    # Front face (left side)
    for i in range(num_vert_bars):
        y_pos = oy - cover - vert_dia/2 - i * vert_spacing
        if y_pos >= oy - wall_height + cover:
            msp.add_circle(
                (ox + cover + vert_dia/2 + 8, y_pos), 
                radius=vert_dia/2,
                dxfattribs={"layer": "Reinforcement"}
            )
            # Add cross hatch to show bar in section
            msp.add_line(
                (ox + cover + 8, y_pos - vert_dia/2),
                (ox + cover + vert_dia + 8, y_pos + vert_dia/2),
                dxfattribs={"layer": "Reinforcement"}
            )
            msp.add_line(
                (ox + cover + 8, y_pos + vert_dia/2),
                (ox + cover + vert_dia + 8, y_pos - vert_dia/2),
                dxfattribs={"layer": "Reinforcement"}
            )
    
    # Back face (right side)
    for i in range(num_vert_bars):
        y_pos = oy - cover - vert_dia/2 - i * vert_spacing
        if y_pos >= oy - wall_height + cover:
            msp.add_circle(
                (ox + t - cover - vert_dia/2 - 8, y_pos), 
                radius=vert_dia/2,
                dxfattribs={"layer": "Reinforcement"}
            )
            msp.add_line(
                (ox + t - cover - vert_dia - 8, y_pos - vert_dia/2),
                (ox + t - cover - 8, y_pos + vert_dia/2),
                dxfattribs={"layer": "Reinforcement"}
            )
            msp.add_line(
                (ox + t - cover - vert_dia - 8, y_pos + vert_dia/2),
                (ox + t - cover - 8, y_pos - vert_dia/2),
                dxfattribs={"layer": "Reinforcement"}
            )
    
    # Draw horizontal reinforcement (shown as rectangles in section)
    num_horiz_bars = int(wall_height / horiz_spacing) + 1
    
    for i in range(num_horiz_bars):
        y_pos = oy - cover - i * horiz_spacing
        if y_pos >= oy - wall_height + cover:
            # Front face
            msp.add_lwpolyline([
                (ox + cover, y_pos - horiz_dia/2),
                (ox + t/2 - 5, y_pos - horiz_dia/2),
                (ox + t/2 - 5, y_pos + horiz_dia/2),
                (ox + cover, y_pos + horiz_dia/2),
                (ox + cover, y_pos - horiz_dia/2)
            ], dxfattribs={"layer": "Reinforcement"})
            
            # Back face
            msp.add_lwpolyline([
                (ox + t/2 + 5, y_pos - horiz_dia/2),
                (ox + t - cover, y_pos - horiz_dia/2),
                (ox + t - cover, y_pos + horiz_dia/2),
                (ox + t/2 + 5, y_pos + horiz_dia/2),
                (ox + t/2 + 5, y_pos - horiz_dia/2)
            ], dxfattribs={"layer": "Reinforcement"})
    
    # Add view label
    msp.add_text(
        "SECTION A-A",
        dxfattribs={
            "layer": "Text",
            "height": 80,
            "style": "Standard"
        }
    ).set_placement((ox + t/2, oy + 300), align=TextEntityAlignment.MIDDLE_CENTER)


def draw_elevation_view(msp, origin, length, h, vert_spacing, horiz_spacing,
                        has_starter, lap_length, kicker_height):
    """Draw elevation view of wall showing reinforcement pattern"""
    ox, oy = origin
    
    # Scale height for drawing (max 3m shown)
    draw_height = min(h, 3000)
    
    # Draw wall outline
    wall_pts = [
        (ox, oy),
        (ox + length, oy),
        (ox + length, oy - draw_height),
        (ox, oy - draw_height),
        (ox, oy)
    ]
    msp.add_lwpolyline(wall_pts, dxfattribs={"layer": "Concrete", "lineweight": 50})
    
    # Draw kicker outline if present
    if kicker_height > 0:
        msp.add_line(
            (ox, oy), (ox + length, oy),
            dxfattribs={"layer": "Concrete", "lineweight": 70}
        )
        msp.add_line(
            (ox, oy + kicker_height), (ox + length, oy + kicker_height),
            dxfattribs={"layer": "Dimensions", "linetype": "DASHED"}
        )
    
    # Draw vertical reinforcement pattern (simplified - show every other bar)
    num_vert_positions = int(draw_height / vert_spacing)
    display_vert_spacing = vert_spacing * 2  # Show every 2nd bar for clarity
    
    for i in range(0, num_vert_positions, 2):
        y_top = oy - i * vert_spacing
        y_bot = oy - draw_height
        if y_top > y_bot:
            # Draw vertical bar line
            msp.add_line(
                (ox + 100, y_top), (ox + 100, y_bot),
                dxfattribs={"layer": "Reinforcement"}
            )
            msp.add_line(
                (ox + length - 100, y_top), (ox + length - 100, y_bot),
                dxfattribs={"layer": "Reinforcement"}
            )
    
    # Draw horizontal reinforcement pattern
    num_horiz_bars = int(draw_height / horiz_spacing)
    
    for i in range(num_horiz_bars + 1):
        y_pos = oy - i * horiz_spacing
        if y_pos >= oy - draw_height:
            msp.add_line(
                (ox, y_pos), (ox + length, y_pos),
                dxfattribs={"layer": "Reinforcement", "linetype": "DASHED"}
            )
    
    # Show starter bars if present
    if has_starter:
        # Draw starter bars extending from base
        starter_y_top = oy + lap_length
        for x_pos in [ox + 100, ox + length/2, ox + length - 100]:
            msp.add_line(
                (x_pos, oy), (x_pos, starter_y_top),
                dxfattribs={"layer": "Reinforcement", "lineweight": 40}
            )
            # Add arrow to show it's projecting
            arrow_size = 30
            msp.add_solid([
                (x_pos, starter_y_top),
                (x_pos - arrow_size/2, starter_y_top - arrow_size),
                (x_pos + arrow_size/2, starter_y_top - arrow_size),
            ], dxfattribs={"layer": "Reinforcement"})
    
    # Add structural floor level line
    floor_level_y = oy + kicker_height + 150
    msp.add_line(
        (ox - 200, floor_level_y), (ox + length + 200, floor_level_y),
        dxfattribs={"layer": "Centerline", "linetype": "DASHDOT"}
    )
    msp.add_text(
        "STRUCTURAL FLOOR LEVEL",
        dxfattribs={"layer": "Text", "height": 60}
    ).set_placement((ox + length + 250, floor_level_y), align=TextEntityAlignment.MIDDLE_LEFT)
    
    # Add view label
    msp.add_text(
        "ELEVATION",
        dxfattribs={"layer": "Text", "height": 80, "style": "Standard"}
    ).set_placement((ox + length/2, oy + 400), align=TextEntityAlignment.MIDDLE_CENTER)


def draw_starter_detail(msp, origin, t, vert_dia, cover, kicker_height, lap_length):
    """Draw detail of starter bars and kicker connection"""
    ox, oy = origin
    scale = 2.0  # Enlarged detail
    
    t_scaled = t * scale
    kicker_h_scaled = kicker_height * scale
    lap_scaled = lap_length * scale
    
    # Draw foundation/kicker
    found_pts = [
        (ox, oy + kicker_h_scaled),
        (ox + t_scaled + 100, oy + kicker_h_scaled),
        (ox + t_scaled + 100, oy),
        (ox - 100, oy),
        (ox - 100, oy + kicker_h_scaled + 150),
        (ox, oy + kicker_h_scaled + 150),
    ]
    msp.add_lwpolyline(found_pts, dxfattribs={"layer": "Concrete", "lineweight": 40})
    
    # Kicker
    kicker_pts = [
        (ox - 50, oy + kicker_h_scaled),
        (ox + t_scaled + 50, oy + kicker_h_scaled),
        (ox + t_scaled + 50, oy + kicker_h_scaled + 150),
        (ox - 50, oy + kicker_h_scaled + 150),
    ]
    msp.add_lwpolyline(kicker_pts, dxfattribs={"layer": "Concrete", "lineweight": 30})
    
    # Wall above
    wall_pts = [
        (ox, oy + kicker_h_scaled + 150),
        (ox + t_scaled, oy + kicker_h_scaled + 150),
        (ox + t_scaled, oy + kicker_h_scaled + 150 + lap_scaled + 200),
        (ox, oy + kicker_h_scaled + 150 + lap_scaled + 200),
    ]
    msp.add_lwpolyline(wall_pts, dxfattribs={"layer": "Concrete", "lineweight": 40})
    
    # Starter bars from foundation
    starter_x_positions = [ox + cover * scale + 20, ox + t_scaled - cover * scale - 20]
    for x_pos in starter_x_positions:
        # Bar in foundation
        msp.add_line(
            (x_pos, oy + 50), 
            (x_pos, oy + kicker_h_scaled + 150 + lap_scaled),
            dxfattribs={"layer": "Reinforcement", "lineweight": 35}
        )
        # Show bar as circle at base
        msp.add_circle((x_pos, oy + 70), radius=vert_dia * scale/2,
                       dxfattribs={"layer": "Reinforcement"})
    
    # Wall vertical bars (lapping with starters)
    for x_pos in starter_x_positions:
        msp.add_line(
            (x_pos + 15, oy + kicker_h_scaled + 150), 
            (x_pos + 15, oy + kicker_h_scaled + 150 + lap_scaled + 150),
            dxfattribs={"layer": "Reinforcement", "lineweight": 35}
        )
    
    # Dimension for lap length
    dim_x = ox + t_scaled + 200
    msp.add_line(
        (dim_x, oy + kicker_h_scaled + 150),
        (dim_x, oy + kicker_h_scaled + 150 + lap_scaled),
        dxfattribs={"layer": "Dimensions"}
    )
    msp.add_line((dim_x - 30, oy + kicker_h_scaled + 150), 
                 (dim_x + 30, oy + kicker_h_scaled + 150),
                 dxfattribs={"layer": "Dimensions"})
    msp.add_line((dim_x - 30, oy + kicker_h_scaled + 150 + lap_scaled), 
                 (dim_x + 30, oy + kicker_h_scaled + 150 + lap_scaled),
                 dxfattribs={"layer": "Dimensions"})
    msp.add_text(
        f"LAP = {int(lap_length)}mm",
        dxfattribs={"layer": "Text", "height": 50, "rotation": 90}
    ).set_placement((dim_x + 40, oy + kicker_h_scaled + 150 + lap_scaled/2), 
                    align=TextEntityAlignment.MIDDLE_LEFT)
    
    # Kicker dimension
    msp.add_line(
        (dim_x, oy + kicker_h_scaled),
        (dim_x, oy + kicker_h_scaled + 150),
        dxfattribs={"layer": "Dimensions"}
    )
    msp.add_text(
        f"KICKER = {int(kicker_height)}mm",
        dxfattribs={"layer": "Text", "height": 40, "rotation": 90}
    ).set_placement((dim_x + 40, oy + kicker_h_scaled + 75), 
                    align=TextEntityAlignment.MIDDLE_LEFT)
    
    # Add detail label
    circle_center = (ox - 300, oy + kicker_h_scaled + lap_scaled)
    msp.add_circle(circle_center, radius=120, dxfattribs={"layer": "Text", "lineweight": 25})
    msp.add_text(
        "DETAIL 'A'",
        dxfattribs={"layer": "Text", "height": 50, "style": "Standard"}
    ).set_placement(circle_center, align=TextEntityAlignment.MIDDLE_CENTER)
    
    # Add note
    msp.add_text(
        "STARTER BARS & KICKER DETAIL",
        dxfattribs={"layer": "Text", "height": 60}
    ).set_placement((ox + t_scaled/2, oy + kicker_h_scaled + lap_scaled + 400), 
                    align=TextEntityAlignment.MIDDLE_CENTER)


def draw_corner_detail(msp, origin, t, vert_dia, horiz_dia, cover):
    """Draw detail of corner/T-junction reinforcement"""
    ox, oy = origin
    scale = 2.5
    
    t_scaled = t * scale
    
    # Draw L-shaped wall junction
    # Vertical wall
    vert_wall = [
        (ox, oy),
        (ox + t_scaled, oy),
        (ox + t_scaled, oy - 800),
        (ox, oy - 800),
    ]
    msp.add_lwpolyline(vert_wall, dxfattribs={"layer": "Concrete", "lineweight": 40})
    
    # Horizontal wall (connecting)
    horiz_wall = [
        (ox, oy - 400),
        (ox + 1000, oy - 400),
        (ox + 1000, oy - 400 - t_scaled),
        (ox, oy - 400 - t_scaled),
    ]
    msp.add_lwpolyline(horiz_wall, dxfattribs={"layer": "Concrete", "lineweight": 40})
    
    # U-bars around corner (2 bars within loop for walls < 300mm)
    u_bar_width = t_scaled - 2 * cover * scale
    u_bar_height = t_scaled - 2 * cover * scale
    
    # First U-bar
    u_bar_1 = [
        (ox + cover * scale, oy - 300),
        (ox + cover * scale, oy - 400 - cover * scale),
        (ox + cover * scale + u_bar_width, oy - 400 - cover * scale),
        (ox + cover * scale + u_bar_width, oy - 300),
    ]
    msp.add_lwpolyline(u_bar_1, dxfattribs={"layer": "Reinforcement", "lineweight": 30})
    
    # Second U-bar (offset)
    u_bar_2 = [
        (ox + cover * scale + 30, oy - 320),
        (ox + cover * scale + 30, oy - 400 - cover * scale - 30),
        (ox + cover * scale + u_bar_width + 30, oy - 400 - cover * scale - 30),
        (ox + cover * scale + u_bar_width + 30, oy - 320),
    ]
    msp.add_lwpolyline(u_bar_2, dxfattribs={"layer": "Reinforcement", "lineweight": 30})
    
    # Tension lap bars projecting
    for i in range(3):
        # Horizontal projection
        y_pos = oy - 400 - cover * scale - i * 60
        msp.add_line(
            (ox + t_scaled - cover * scale, y_pos),
            (ox + t_scaled + 450, y_pos),
            dxfattribs={"layer": "Reinforcement", "lineweight": 25}
        )
        msp.add_circle((ox + t_scaled + 450, y_pos), radius=20,
                       dxfattribs={"layer": "Reinforcement"})
    
    # Add labels
    msp.add_text(
        "TWO BARS SHOULD BE PLACED",
        dxfattribs={"layer": "Text", "height": 40}
    ).set_placement((ox + t_scaled + 200, oy - 100), align=TextEntityAlignment.MIDDLE_LEFT)
    
    msp.add_text(
        "WITHIN LOOP FOR WALL",
        dxfattribs={"layer": "Text", "height": 40}
    ).set_placement((ox + t_scaled + 200, oy - 160), align=TextEntityAlignment.MIDDLE_LEFT)
    
    msp.add_text(
        f"THICKNESS {int(t)}mm AND LESS",
        dxfattribs={"layer": "Text", "height": 40}
    ).set_placement((ox + t_scaled + 200, oy - 220), align=TextEntityAlignment.MIDDLE_LEFT)
    
    msp.add_text(
        "TENSION LAP",
        dxfattribs={"layer": "Text", "height": 35}
    ).set_placement((ox + t_scaled + 250, oy - 450), align=TextEntityAlignment.MIDDLE_LEFT)
    
    # Detail label
    circle_center = (ox - 250, oy - 400)
    msp.add_circle(circle_center, radius=100, dxfattribs={"layer": "Text", "lineweight": 25})
    msp.add_text(
        "DETAIL 'B'",
        dxfattribs={"layer": "Text", "height": 45}
    ).set_placement(circle_center, align=TextEntityAlignment.MIDDLE_CENTER)


def draw_ubar_detail(msp, origin, t, u_dia, vert_dia, cover):
    """Draw U-bar detail for shear walls"""
    ox, oy = origin
    scale = 3.0
    
    t_scaled = t * scale
    
    # Draw wall section
    wall_pts = [
        (ox, oy),
        (ox + t_scaled, oy),
        (ox + t_scaled, oy - 1000),
        (ox, oy - 1000),
    ]
    msp.add_lwpolyline(wall_pts, dxfattribs={"layer": "Concrete", "lineweight": 40})
    
    # Draw U-bar shape
    u_width = t_scaled - 2 * cover * scale
    u_height = 400
    
    u_bar_pts = [
        (ox + cover * scale, oy - 300),
        (ox + cover * scale, oy - 300 - u_height),
        (ox + cover * scale + u_width, oy - 300 - u_height),
        (ox + cover * scale + u_width, oy - 300),
    ]
    msp.add_lwpolyline(u_bar_pts, dxfattribs={"layer": "Reinforcement", "lineweight": 35})
    
    # Show vertical bars inside U
    for x_offset in [50, u_width - 50]:
        msp.add_line(
            (ox + cover * scale + x_offset, oy - 200),
            (ox + cover * scale + x_offset, oy - 900),
            dxfattribs={"layer": "Reinforcement", "lineweight": 30}
        )
        msp.add_circle(
            (ox + cover * scale + x_offset, oy - 550),
            radius=vert_dia * scale / 2,
            dxfattribs={"layer": "Reinforcement"}
        )
    
    # Dimensions
    dim_y = oy - 300 - u_height - 150
    msp.add_line(
        (ox + cover * scale, dim_y),
        (ox + cover * scale + u_width, dim_y),
        dxfattribs={"layer": "Dimensions"}
    )
    msp.add_text(
        f"U-BAR SPACING = {u_width/scale:.0f}mm",
        dxfattribs={"layer": "Text", "height": 50}
    ).set_placement((ox + t_scaled/2, dim_y - 80), align=TextEntityAlignment.MIDDLE_CENTER)
    
    # Add fixing bars notation
    msp.add_text(
        "TWO FIXING BARS ARE",
        dxfattribs={"layer": "Text", "height": 40}
    ).set_placement((ox - 350, oy - 400), align=TextEntityAlignment.RIGHT)
    
    msp.add_text(
        "PLACED INSIDE 'U' BARS",
        dxfattribs={"layer": "Text", "height": 40}
    ).set_placement((ox - 350, oy - 460), align=TextEntityAlignment.RIGHT)
    
    # Detail label
    circle_center = (ox - 250, oy - 200)
    msp.add_circle(circle_center, radius=100, dxfattribs={"layer": "Text", "lineweight": 25})
    msp.add_text(
        "DETAIL 'C'",
        dxfattribs={"layer": "Text", "height": 45}
    ).set_placement(circle_center, align=TextEntityAlignment.MIDDLE_CENTER)


def add_section_dimensions(msp, origin, t, h, cover):
    """Add dimensions to section view"""
    ox, oy = origin
    wall_height = min(h, 3000)
    
    # Thickness dimension
    dim_y = oy + 200
    msp.add_line((ox, dim_y), (ox + t, dim_y), dxfattribs={"layer": "Dimensions"})
    msp.add_line((ox, dim_y - 30), (ox, dim_y + 30), dxfattribs={"layer": "Dimensions"})
    msp.add_line((ox + t, dim_y - 30), (ox + t, dim_y + 30), dxfattribs={"layer": "Dimensions"})
    msp.add_text(
        f"{int(t)}",
        dxfattribs={"layer": "Dimensions", "height": 60}
    ).set_placement((ox + t/2, dim_y + 50), align=TextEntityAlignment.BOTTOM_CENTER)
    
    # Height dimension
    dim_x = ox - 300
    msp.add_line((dim_x, oy), (dim_x, oy - wall_height), dxfattribs={"layer": "Dimensions"})
    msp.add_line((dim_x - 30, oy), (dim_x + 30, oy), dxfattribs={"layer": "Dimensions"})
    msp.add_line((dim_x - 30, oy - wall_height), (dim_x + 30, oy - wall_height), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_text(
        f"{int(wall_height)}",
        dxfattribs={"layer": "Dimensions", "height": 60, "rotation": 90}
    ).set_placement((dim_x - 50, oy - wall_height/2), align=TextEntityAlignment.BOTTOM_CENTER)
    
    # Cover dimension
    cover_dim_y = oy - wall_height - 200
    msp.add_line((ox, cover_dim_y), (ox + cover, cover_dim_y), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_line((ox, cover_dim_y - 20), (ox, cover_dim_y + 20), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_line((ox + cover, cover_dim_y - 20), (ox + cover, cover_dim_y + 20), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_text(
        f"c = {int(cover)}",
        dxfattribs={"layer": "Dimensions", "height": 50}
    ).set_placement((ox + cover/2, cover_dim_y - 40), align=TextEntityAlignment.TOP_CENTER)


def add_elevation_dimensions(msp, origin, length, h):
    """Add dimensions to elevation view"""
    ox, oy = origin
    draw_height = min(h, 3000)
    
    # Length dimension
    dim_y = oy + 300
    msp.add_line((ox, dim_y), (ox + length, dim_y), dxfattribs={"layer": "Dimensions"})
    msp.add_line((ox, dim_y - 40), (ox, dim_y + 40), dxfattribs={"layer": "Dimensions"})
    msp.add_line((ox + length, dim_y - 40), (ox + length, dim_y + 40), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_text(
        f"{int(length)}mm = {length/1000:.1f}m",
        dxfattribs={"layer": "Dimensions", "height": 70}
    ).set_placement((ox + length/2, dim_y + 60), align=TextEntityAlignment.BOTTOM_CENTER)


def add_title_block(msp, params, origin):
    """Add professional title block"""
    ox, oy = origin
    
    # Title block rectangle
    tb_width = 2000
    tb_height = 400
    
    msp.add_lwpolyline([
        (ox, oy),
        (ox + tb_width, oy),
        (ox + tb_width, oy + tb_height),
        (ox, oy + tb_height),
        (ox, oy)
    ], dxfattribs={"layer": "Text", "lineweight": 40})
    
    # Dividing lines
    msp.add_line((ox, oy + tb_height - 100), (ox + tb_width, oy + tb_height - 100),
                 dxfattribs={"layer": "Text"})
    msp.add_line((ox + tb_width - 600, oy), (ox + tb_width - 600, oy + tb_height - 100),
                 dxfattribs={"layer": "Text"})
    
    # Title
    msp.add_text(
        "REINFORCED CONCRETE WALL - DETAILED DRAWING",
        dxfattribs={"layer": "Text", "height": 80, "style": "Standard"}
    ).set_placement((ox + tb_width/2, oy + tb_height - 50), align=TextEntityAlignment.MIDDLE_CENTER)
    
    # Project info
    wall_type = params.get("wall_type", "shear").upper()
    msp.add_text(
        f"Wall Type: {wall_type} WALL",
        dxfattribs={"layer": "Text", "height": 50}
    ).set_placement((ox + 50, oy + tb_height - 150), align=TextEntityAlignment.MIDDLE_LEFT)
    
    msp.add_text(
        f"Dimensions: {params.get('length', 6)}m × {params.get('height', 3.5)}m × {params.get('thickness', 200)}mm",
        dxfattribs={"layer": "Text", "height": 50}
    ).set_placement((ox + 50, oy + tb_height - 220), align=TextEntityAlignment.MIDDLE_LEFT)
    
    # Standards
    msp.add_text(
        "Design Standards:",
        dxfattribs={"layer": "Text", "height": 45}
    ).set_placement((ox + tb_width - 580, oy + tb_height - 150), align=TextEntityAlignment.MIDDLE_LEFT)
    
    msp.add_text(
        "BS EN 1992-1-1:2004",
        dxfattribs={"layer": "Text", "height": 40}
    ).set_placement((ox + tb_width - 580, oy + tb_height - 210), align=TextEntityAlignment.MIDDLE_LEFT)
    
    msp.add_text(
        "BS 8110-1:1997",
        dxfattribs={"layer": "Text", "height": 40}
    ).set_placement((ox + tb_width - 580, oy + tb_height - 260), align=TextEntityAlignment.MIDDLE_LEFT)
    
    # Date and scale
    msp.add_text(
        "Scale: 1:50",
        dxfattribs={"layer": "Text", "height": 45}
    ).set_placement((ox + 50, oy + 50), align=TextEntityAlignment.MIDDLE_LEFT)
    
    msp.add_text(
        "Drawing No: RC-WALL-001",
        dxfattribs={"layer": "Text", "height": 45}
    ).set_placement((ox + tb_width - 580, oy + 50), align=TextEntityAlignment.MIDDLE_LEFT)


def add_general_notes(msp, params, origin):
    """Add general notes and specifications"""
    ox, oy = origin
    
    msp.add_text(
        "GENERAL NOTES:",
        dxfattribs={"layer": "Text", "height": 70, "style": "Standard"}
    ).set_placement((ox, oy), align=TextEntityAlignment.MIDDLE_LEFT)
    
    notes = [
        f"1. Concrete: {params.get('concrete_grade', 'C30')} to BS 8500",
        f"2. Reinforcement: Grade {params.get('steel_grade', '460')} to BS 4449",
        f"3. Cover: {params.get('cover', 30)}mm for {params.get('exposure_class', 'XC3')}",
        "4. All dimensions in millimeters unless noted",
        "5. Refer to structural calculations for loading",
        "6. Lap lengths: 40 × bar diameter (minimum)",
        "7. U-bars at corners and openings as detailed",
        "8. Starter bars from foundation with full lap",
        "9. Check bar spacing does not exceed code limits",
        "10. Maintain concrete cover to all reinforcement"
    ]
    
    y_offset = -80
    for note in notes:
        msp.add_text(
            note,
            dxfattribs={"layer": "Text", "height": 45}
        ).set_placement((ox, oy + y_offset), align=TextEntityAlignment.MIDDLE_LEFT)
        y_offset -= 70


def add_reinforcement_schedule(msp, params, origin):
    """Add reinforcement bar schedule table"""
    ox, oy = origin
    
    # Table header
    msp.add_text(
        "REINFORCEMENT SCHEDULE:",
        dxfattribs={"layer": "Text", "height": 60, "style": "Standard"}
    ).set_placement((ox, oy), align=TextEntityAlignment.MIDDLE_LEFT)
    
    # Table
    table_width = 800
    table_height = 400
    row_height = 80
    
    # Draw table outline
    msp.add_lwpolyline([
        (ox, oy - 100),
        (ox + table_width, oy - 100),
        (ox + table_width, oy - 100 - table_height),
        (ox, oy - 100 - table_height),
        (ox, oy - 100)
    ], dxfattribs={"layer": "Text"})
    
    # Column headers
    headers = ["Bar Mark", "Diameter", "Spacing", "Location"]
    col_widths = [150, 200, 200, 250]
    
    x_pos = ox
    for i, (header, width) in enumerate(zip(headers, col_widths)):
        msp.add_line((x_pos, oy - 100), (x_pos, oy - 100 - table_height),
                     dxfattribs={"layer": "Text"})
        msp.add_text(
            header,
            dxfattribs={"layer": "Text", "height": 40}
        ).set_placement((x_pos + width/2, oy - 100 - 40), align=TextEntityAlignment.MIDDLE_CENTER)
        x_pos += width
    
    # Header bottom line
    msp.add_line((ox, oy - 100 - row_height), (ox + table_width, oy - 100 - row_height),
                 dxfattribs={"layer": "Text"})
    
    # Data rows
    vert_dia = params.get("vertical_steel", {}).get("diameter", 16)
    vert_spacing = params.get("vertical_steel", {}).get("spacing", 200)
    horiz_dia = params.get("horizontal_steel", {}).get("diameter", 12)
    horiz_spacing = params.get("horizontal_steel", {}).get("spacing", 250)
    steel_grade = params.get("steel_grade", "460")
    bar_prefix = "H" if "460" in str(steel_grade) else "R"
    
    rows = [
        ["V1", f"{bar_prefix}{vert_dia}", f"{vert_spacing}mm c/c", "Vertical - Both faces"],
        ["H1", f"{bar_prefix}{horiz_dia}", f"{horiz_spacing}mm c/c", "Horizontal - Both faces"],
        ["L1", f"{bar_prefix}{vert_dia}", "As required", "Laps - 40φ minimum"],
        ["U1", f"{bar_prefix}12", "300mm c/c", "U-bars at corners"]
    ]
    
    y_pos = oy - 100 - row_height
    for row in rows:
        y_pos -= row_height
        msp.add_line((ox, y_pos), (ox + table_width, y_pos),
                     dxfattribs={"layer": "Text"})
        
        x_pos = ox
        for i, (data, width) in enumerate(zip(row, col_widths)):
            msp.add_text(
                data,
                dxfattribs={"layer": "Text", "height": 38}
            ).set_placement((x_pos + width/2, y_pos + row_height/2), 
                           align=TextEntityAlignment.MIDDLE_CENTER)
            x_pos += width


# Example usage function
def create_wall_dxf_example():
    """Example of how to use the generator"""
    params = {
        "wall_type": "shear",
        "thickness": 200,
        "height": 3.5,
        "length": 6.0,
        "cover": 30,
        "vertical_steel": {"diameter": 16, "spacing": 200},
        "horizontal_steel": {"diameter": 12, "spacing": 250},
        "concrete_grade": "C30",
        "steel_grade": "460",
        "exposure_class": "XC3",
        "has_starter_bars": True,
        "has_kicker": True,
        "kicker_height": 75,
        "lap_length": 640  # 40 × 16mm
    }
    
    dxf_content = generate_wall_dxf(params)
    
    # Save to file
    with open("rc_wall_detail.dxf", "w") as f:
        f.write(dxf_content)
    
    return dxf_content


if __name__ == "__main__":
    # Generate example DXF
    dxf_content = create_wall_dxf_example()
    print("DXF file generated successfully!")
    print(f"Content length: {len(dxf_content)} characters")