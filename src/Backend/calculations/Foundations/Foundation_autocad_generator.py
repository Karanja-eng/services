

import ezdxf
import io
from ezdxf.gfxattribs import GfxAttribs
import math


def generate_pad_foundation_dxf(params):
    """
    Generate DXF for pad foundation with reinforcement detailing
    
    params: dict containing:
        - length: mm (foundation length)
        - width: mm (foundation width)
        - depth: mm (foundation depth)
        - column_width: mm
        - column_depth: mm
        - cover: mm (bottom cover, typically 75mm)
        - side_cover: mm (side cover, typically 75mm)
        - top_cover: mm (top cover, typically 50mm)
        - main_bars_x: {"count": int, "diameter": int, "spacing": int}
        - main_bars_y: {"count": int, "diameter": int, "spacing": int}
        - steel_grade: str (e.g., "Grade 460")
        - concrete_grade: str (e.g., "C30")
    """
    
    # Extract parameters
    L = float(params.get("length", 2000))
    B = float(params.get("width", 2000))
    D = float(params.get("depth", 500))
    
    col_w = float(params.get("column_width", 400))
    col_d = float(params.get("column_depth", 400))
    
    cover_bot = float(params.get("cover", 75))
    cover_side = float(params.get("side_cover", 75))
    cover_top = float(params.get("top_cover", 50))
    
    # Main bars
    bars_x = params.get("main_bars_x", {})
    bars_x_n = int(bars_x.get("count", 8))
    bars_x_dia = int(bars_x.get("diameter", 16))
    bars_x_spacing = int(bars_x.get("spacing", 200))
    
    bars_y = params.get("main_bars_y", {})
    bars_y_n = int(bars_y.get("count", 8))
    bars_y_dia = int(bars_y.get("diameter", 16))
    bars_y_spacing = int(bars_y.get("spacing", 200))
    
    steel_grade = params.get("steel_grade", "Grade 460")
    concrete_grade = params.get("concrete_grade", "C30")
    
    # Bar prefix
    bar_prefix = "H" if "460" in steel_grade else "R"
    
    # Setup DXF
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    
    # Layers
    layers = {
        "Concrete": 7,
        "Reinforcement": 1,
        "Dimensions": 3,
        "Text": 2,
        "Column": 6,
        "Hatching": 8
    }
    
    for name, color in layers.items():
        if name not in doc.layers:
            doc.layers.new(name=name, dxfattribs={"color": color})
    
    # --- PLAN VIEW ---
    plan_offset_x = 0
    plan_offset_y = 0
    
    # Foundation outline
    foundation_plan = [
        (plan_offset_x, plan_offset_y),
        (plan_offset_x + L, plan_offset_y),
        (plan_offset_x + L, plan_offset_y + B),
        (plan_offset_x, plan_offset_y + B)
    ]
    msp.add_lwpolyline(foundation_plan, close=True, 
                       dxfattribs={"layer": "Concrete", "lineweight": 50})
    
    # Column outline (centered)
    col_x = plan_offset_x + (L - col_w) / 2
    col_y = plan_offset_y + (B - col_d) / 2
    column_plan = [
        (col_x, col_y),
        (col_x + col_w, col_y),
        (col_x + col_w, col_y + col_d),
        (col_x, col_y + col_d)
    ]
    msp.add_lwpolyline(column_plan, close=True, 
                       dxfattribs={"layer": "Column", "lineweight": 35})
    
    # Hatch column
    hatch = msp.add_hatch(color=256, dxfattribs={"layer": "Column"})
    hatch.paths.add_polyline_path(column_plan, is_closed=True)
    hatch.set_pattern_fill("ANSI31", scale=0.5)
    
    # Main bars X-direction (bottom layer)
    bar_start_x = plan_offset_x + cover_side + bars_x_dia/2
    bar_end_x = plan_offset_x + L - cover_side - bars_x_dia/2
    
    for i in range(bars_x_n):
        bar_y = plan_offset_y + cover_side + bars_y_dia + i * bars_x_spacing
        if bar_y <= plan_offset_y + B - cover_side:
            msp.add_line(
                (bar_start_x, bar_y),
                (bar_end_x, bar_y),
                dxfattribs={"layer": "Reinforcement", "lineweight": 25}
            )
            # Bar markers
            msp.add_circle((bar_start_x, bar_y), radius=bars_x_dia/2, 
                          dxfattribs={"layer": "Reinforcement"})
            msp.add_circle((bar_end_x, bar_y), radius=bars_x_dia/2, 
                          dxfattribs={"layer": "Reinforcement"})
    
    # Main bars Y-direction (top layer)
    bar_start_y = plan_offset_y + cover_side + bars_y_dia/2
    bar_end_y = plan_offset_y + B - cover_side - bars_y_dia/2
    
    for i in range(bars_y_n):
        bar_x = plan_offset_x + cover_side + bars_x_dia + i * bars_y_spacing
        if bar_x <= plan_offset_x + L - cover_side:
            msp.add_line(
                (bar_x, bar_start_y),
                (bar_x, bar_end_y),
                dxfattribs={"layer": "Reinforcement", "lineweight": 25, "linetype": "DASHED"}
            )
    
    # --- SECTION A-A (Through center, showing X-bars) ---
    section_offset_x = L + 1000
    section_offset_y = 0
    
    # Foundation outline
    section_foundation = [
        (section_offset_x, section_offset_y),
        (section_offset_x + L, section_offset_y),
        (section_offset_x + L, section_offset_y - D),
        (section_offset_x, section_offset_y - D)
    ]
    msp.add_lwpolyline(section_foundation, close=True, 
                       dxfattribs={"layer": "Concrete", "lineweight": 50})
    
    # Ground level line
    msp.add_line(
        (section_offset_x - 200, section_offset_y),
        (section_offset_x + L + 200, section_offset_y),
        dxfattribs={"layer": "Dimensions", "linetype": "DASHDOT"}
    )
    
    # Column
    col_sect_x = section_offset_x + (L - col_w) / 2
    column_section = [
        (col_sect_x, section_offset_y),
        (col_sect_x + col_w, section_offset_y),
        (col_sect_x + col_w, section_offset_y + 300),  # Column height shown
        (col_sect_x, section_offset_y + 300)
    ]
    msp.add_lwpolyline(column_section, close=True, 
                       dxfattribs={"layer": "Column", "lineweight": 35})
    
    # Bottom reinforcement (X-bars in section)
    bar_y_level = section_offset_y - D + cover_bot + bars_x_dia/2
    
    for i in range(bars_x_n):
        bar_x = section_offset_x + cover_side + i * bars_x_spacing
        if bar_x <= section_offset_x + L - cover_side:
            msp.add_circle((bar_x, bar_y_level), radius=bars_x_dia/2, 
                          dxfattribs={"layer": "Reinforcement"})
            # Fill circle
            hatch = msp.add_hatch(color=1, dxfattribs={"layer": "Reinforcement"})
            path = hatch.paths.add_edge_path()
            path.add_arc((bar_x, bar_y_level), radius=bars_x_dia/2, 
                        start_angle=0, end_angle=360)
            hatch.set_solid_fill()
    
    # Y-bars shown as crosses (perpendicular to section)
    bar_y_level_perp = section_offset_y - D + cover_bot + bars_x_dia + bars_y_dia/2
    
    # Draw a few representative Y-bars
    for i in range(0, bars_y_n, 2):  # Every other bar
        bar_x = section_offset_x + L/2
        cross_size = bars_y_dia * 0.7
        # Draw cross
        msp.add_line(
            (bar_x - cross_size/2, bar_y_level_perp - cross_size/2),
            (bar_x + cross_size/2, bar_y_level_perp + cross_size/2),
            dxfattribs={"layer": "Reinforcement"}
        )
        msp.add_line(
            (bar_x - cross_size/2, bar_y_level_perp + cross_size/2),
            (bar_x + cross_size/2, bar_y_level_perp - cross_size/2),
            dxfattribs={"layer": "Reinforcement"}
        )
    
    # --- DIMENSIONS ---
    text_height = 60
    
    # Plan dimensions
    # Length
    dim_y = plan_offset_y + B + 200
    msp.add_line((plan_offset_x, dim_y), (plan_offset_x + L, dim_y), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_line((plan_offset_x, dim_y - 30), (plan_offset_x, dim_y + 30), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_line((plan_offset_x + L, dim_y - 30), (plan_offset_x + L, dim_y + 30), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_text(f"{int(L)}", dxfattribs={"layer": "Dimensions", "height": text_height}
                ).set_placement((plan_offset_x + L/2, dim_y + 50), 
                               align=ezdxf.enums.TextEntityAlignment.BOTTOM_CENTER)
    
    # Depth dimension in section
    dim_x_sect = section_offset_x - 200
    msp.add_line((dim_x_sect, section_offset_y), (dim_x_sect, section_offset_y - D), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_line((dim_x_sect - 30, section_offset_y), (dim_x_sect + 30, section_offset_y), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_line((dim_x_sect - 30, section_offset_y - D), (dim_x_sect + 30, section_offset_y - D), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_text(f"{int(D)}", dxfattribs={"layer": "Dimensions", "height": text_height, "rotation": 90}
                ).set_placement((dim_x_sect - 50, section_offset_y - D/2), 
                               align=ezdxf.enums.TextEntityAlignment.BOTTOM_CENTER)
    
    # --- LABELS ---
    msp.add_text("PILE CAP DETAIL", 
                dxfattribs={"layer": "Text", "height": text_height * 1.5}
               ).set_placement((plan_offset_x, plan_offset_y + B + 500), 
                              align=ezdxf.enums.TextEntityAlignment.LEFT)
    
    msp.add_text("PLAN", 
                dxfattribs={"layer": "Text", "height": text_height * 1.2}
               ).set_placement((plan_offset_x + L/2, plan_offset_y - 200), 
                              align=ezdxf.enums.TextEntityAlignment.CENTER)
    
    msp.add_text("SECTION", 
                dxfattribs={"layer": "Text", "height": text_height * 1.2}
               ).set_placement((section_offset_x + L/2, section_offset_y - D - 250), 
                              align=ezdxf.enums.TextEntityAlignment.CENTER)
    
    # Notes
    notes_x = plan_offset_x
    notes_y = plan_offset_y - 600
    
    notes = [
        "REINFORCEMENT SCHEDULE:",
        f"Main bars: {main_bars_n}{bar_prefix}{main_bars_dia} @ {bar_spacing}mm each way (bottom)",
        f"Links: {bar_prefix}{link_dia} @ {link_spacing}mm (2 layers)",
        f"Piles: {pile_count} No. Ø{int(pile_dia)}mm @ {int(pile_spacing)}mm c/c",
        f"Cover: {int(cover_bot)}mm bottom, {int(cover_side)}mm sides",
        f"Concrete: {concrete_grade}",
        f"Steel: {steel_grade}",
        "Bars rest on pile heads - 100mm allowance",
        "Main bars bent at ends",
        "Ref: BS EN 1992-1-1:2004"
    ]
    
    for i, note in enumerate(notes):
        msp.add_text(note, dxfattribs={"layer": "Text", "height": text_height * 0.65}
                    ).set_placement((notes_x, notes_y - i * 70), 
                                   align=ezdxf.enums.TextEntityAlignment.LEFT)
    
    # Output
    stream = io.StringIO()
    doc.write(stream)
    return stream.getvalue()


def generate_strip_foundation_dxf(params):
    """
    Generate DXF for strip foundation
    """
    # Extract parameters
    width = float(params.get("width", 900))
    depth = float(params.get("depth", 450))
    wall_width = float(params.get("wall_width", 300))
    
    cover_bot = float(params.get("cover", 75))
    cover_side = float(params.get("side_cover", 75))
    
    # Main bars
    main_bars = params.get("main_bars", {})
    main_bars_n = int(main_bars.get("count", 5))
    main_bars_dia = int(main_bars.get("diameter", 16))
    
    # Distribution bars
    dist_bars = params.get("distribution_bars", {})
    dist_bars_dia = int(dist_bars.get("diameter", 12))
    dist_bars_spacing = int(dist_bars.get("spacing", 300))
    
    steel_grade = params.get("steel_grade", "Grade 460")
    concrete_grade = params.get("concrete_grade", "C30")
    
    bar_prefix = "H" if "460" in steel_grade else "R"
    
    # Setup DXF
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    
    # Layers
    layers = {
        "Concrete": 7,
        "Reinforcement": 1,
        "Wall": 6,
        "Dimensions": 3,
        "Text": 2
    }
    
    for name, color in layers.items():
        if name not in doc.layers:
            doc.layers.new(name=name, dxfattribs={"color": color})
    
    # --- SECTION VIEW (per meter length) ---
    section_offset_x = 0
    section_offset_y = 0
    
    # Foundation outline
    foundation_section = [
        (section_offset_x, section_offset_y),
        (section_offset_x + width, section_offset_y),
        (section_offset_x + width, section_offset_y - depth),
        (section_offset_x, section_offset_y - depth)
    ]
    msp.add_lwpolyline(foundation_section, close=True, 
                       dxfattribs={"layer": "Concrete", "lineweight": 50})
    
    # Wall
    wall_x = section_offset_x + (width - wall_width) / 2
    wall_section = [
        (wall_x, section_offset_y),
        (wall_x + wall_width, section_offset_y),
        (wall_x + wall_width, section_offset_y + 600),
        (wall_x, section_offset_y + 600)
    ]
    msp.add_lwpolyline(wall_section, close=True, 
                       dxfattribs={"layer": "Wall", "lineweight": 35})
    
    # Ground level
    msp.add_line(
        (section_offset_x - 200, section_offset_y),
        (section_offset_x + width + 200, section_offset_y),
        dxfattribs={"layer": "Dimensions", "linetype": "DASHDOT"}
    )
    
    # Main reinforcement bars
    bar_level = section_offset_y - depth + cover_bot + main_bars_dia/2
    bar_spacing = (width - 2 * cover_side - main_bars_dia) / (main_bars_n - 1)
    
    for i in range(main_bars_n):
        bar_x = section_offset_x + cover_side + main_bars_dia/2 + i * bar_spacing
        msp.add_circle((bar_x, bar_level), radius=main_bars_dia/2, 
                      dxfattribs={"layer": "Reinforcement"})
        # Fill
        hatch = msp.add_hatch(color=1, dxfattribs={"layer": "Reinforcement"})
        path = hatch.paths.add_edge_path()
        path.add_arc((bar_x, bar_level), radius=main_bars_dia/2, 
                    start_angle=0, end_angle=360)
        hatch.set_solid_fill()
    
    # Distribution bars (shown as crosses)
    dist_bar_level = bar_level + main_bars_dia + dist_bars_dia/2
    cross_size = dist_bars_dia * 0.7
    
    for i in range(3):  # Show 3 distribution bars
        bar_x = section_offset_x + width/4 + i * width/4
        msp.add_line(
            (bar_x - cross_size/2, dist_bar_level - cross_size/2),
            (bar_x + cross_size/2, dist_bar_level + cross_size/2),
            dxfattribs={"layer": "Reinforcement"}
        )
        msp.add_line(
            (bar_x - cross_size/2, dist_bar_level + cross_size/2),
            (bar_x + cross_size/2, dist_bar_level - cross_size/2),
            dxfattribs={"layer": "Reinforcement"}
        )
    
    # --- DIMENSIONS ---
    text_height = 60
    
    # Width
    dim_y = section_offset_y + 100
    msp.add_line((section_offset_x, dim_y), (section_offset_x + width, dim_y), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_line((section_offset_x, dim_y - 30), (section_offset_x, dim_y + 30), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_line((section_offset_x + width, dim_y - 30), (section_offset_x + width, dim_y + 30), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_text(f"{int(width)}", dxfattribs={"layer": "Dimensions", "height": text_height}
                ).set_placement((section_offset_x + width/2, dim_y + 40), 
                               align=ezdxf.enums.TextEntityAlignment.BOTTOM_CENTER)
    
    # Depth
    dim_x = section_offset_x - 150
    msp.add_line((dim_x, section_offset_y), (dim_x, section_offset_y - depth), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_line((dim_x - 30, section_offset_y), (dim_x + 30, section_offset_y), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_line((dim_x - 30, section_offset_y - depth), (dim_x + 30, section_offset_y - depth), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_text(f"{int(depth)}", dxfattribs={"layer": "Dimensions", "height": text_height, "rotation": 90}
                ).set_placement((dim_x - 40, section_offset_y - depth/2), 
                               align=ezdxf.enums.TextEntityAlignment.BOTTOM_CENTER)
    
    # Cover dimension
    msp.add_text(f"{int(cover_bot)}", dxfattribs={"layer": "Text", "height": text_height * 0.7}
                ).set_placement((section_offset_x - 100, section_offset_y - depth + cover_bot/2), 
                               align=ezdxf.enums.TextEntityAlignment.MIDDLE_RIGHT)
    
    # --- LABELS ---
    msp.add_text("STRIP FOUNDATION DETAIL", 
                dxfattribs={"layer": "Text", "height": text_height * 1.5}
               ).set_placement((section_offset_x, section_offset_y + 300), 
                              align=ezdxf.enums.TextEntityAlignment.LEFT)
    
    msp.add_text("SECTION (per meter length)", 
                dxfattribs={"layer": "Text", "height": text_height * 1.2}
               ).set_placement((section_offset_x + width/2, section_offset_y - depth - 200), 
                              align=ezdxf.enums.TextEntityAlignment.CENTER)
    
    # Notes
    notes_x = section_offset_x + width + 300
    notes_y = section_offset_y
    
    notes = [
        "REINFORCEMENT:",
        f"Main bars: {main_bars_n}{bar_prefix}{main_bars_dia} continuous",
        f"Distribution: {bar_prefix}{dist_bars_dia} @ {dist_bars_spacing}mm",
        f"Cover: {int(cover_bot)}mm",
        f"Concrete: {concrete_grade}",
        f"Steel: {steel_grade}",
        "Ref: BS 8004:2015"
    ]
    
    for i, note in enumerate(notes):
        msp.add_text(note, dxfattribs={"layer": "Text", "height": text_height * 0.7}
                    ).set_placement((notes_x, notes_y - i * 70), 
                                   align=ezdxf.enums.TextEntityAlignment.LEFT)
    
    # Output
    stream = io.StringIO()
    doc.write(stream)
    return stream.getvalue()


def generate_raft_foundation_dxf(params):
    """
    Generate DXF for raft foundation
    """
    # Extract parameters
    L = float(params.get("length", 10000))
    B = float(params.get("width", 10000))
    D = float(params.get("depth", 500))
    
    col_spacing_x = float(params.get("column_spacing_x", 5000))
    col_spacing_y = float(params.get("column_spacing_y", 5000))
    col_width = float(params.get("column_width", 450))
    
    cover = float(params.get("cover", 50))
    
    # Reinforcement
    top_bars = params.get("top_bars", {})
    top_bars_dia = int(top_bars.get("diameter", 16))
    top_bars_spacing = int(top_bars.get("spacing", 200))
    
    bot_bars = params.get("bot_bars", {})
    bot_bars_dia = int(bot_bars.get("diameter", 20))
    bot_bars_spacing = int(bot_bars.get("spacing", 150))
    
    steel_grade = params.get("steel_grade", "Grade 460")
    concrete_grade = params.get("concrete_grade", "C30")
    
    bar_prefix = "H" if "460" in steel_grade else "R"
    
    # Setup DXF
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    
    # Layers
    layers = {
        "Concrete": 7,
        "Reinforcement": 1,
        "Columns": 6,
        "Dimensions": 3,
        "Text": 2,
        "Grid": 8
    }
    
    for name, color in layers.items():
        if name not in doc.layers:
            doc.layers.new(name=name, dxfattribs={"color": color})
    
    # --- PLAN VIEW (Simplified - showing grid) ---
    plan_offset_x = 0
    plan_offset_y = 0
    
    # Raft outline
    raft_plan = [
        (plan_offset_x, plan_offset_y),
        (plan_offset_x + L, plan_offset_y),
        (plan_offset_x + L, plan_offset_y + B),
        (plan_offset_x, plan_offset_y + B)
    ]
    msp.add_lwpolyline(raft_plan, close=True, 
                       dxfattribs={"layer": "Concrete", "lineweight": 50})
    
    # Column grid
    n_cols_x = int(L / col_spacing_x) + 1
    n_cols_y = int(B / col_spacing_y) + 1
    
    for i in range(n_cols_x):
        for j in range(n_cols_y):
            col_x = plan_offset_x + i * col_spacing_x
            col_y = plan_offset_y + j * col_spacing_y
            
            if col_x <= plan_offset_x + L and col_y <= plan_offset_y + B:
                # Column outline
                col_rect = [
                    (col_x - col_width/2, col_y - col_width/2),
                    (col_x + col_width/2, col_y - col_width/2),
                    (col_x + col_width/2, col_y + col_width/2),
                    (col_x - col_width/2, col_y + col_width/2)
                ]
                msp.add_lwpolyline(col_rect, close=True, 
                                   dxfattribs={"layer": "Columns", "lineweight": 25})
    
    # Reinforcement mesh indication (simplified)
    # Bottom bars X
    n_bars_x = int(L / bot_bars_spacing)
    for i in range(0, n_bars_x, 5):  # Every 5th bar shown
        bar_x = plan_offset_x + i * bot_bars_spacing
        msp.add_line(
            (bar_x, plan_offset_y),
            (bar_x, plan_offset_y + B),
            dxfattribs={"layer": "Reinforcement", "lineweight": 15, "linetype": "DASHED"}
        )
    
    # Bottom bars Y
    n_bars_y = int(B / bot_bars_spacing)
    for i in range(0, n_bars_y, 5):  # Every 5th bar shown
        bar_y = plan_offset_y + i * bot_bars_spacing
        msp.add_line(
            (plan_offset_x, bar_y),
            (plan_offset_x + L, bar_y),
            dxfattribs={"layer": "Reinforcement", "lineweight": 15, "linetype": "DASHED"}
        )
    
    # --- SECTION VIEW ---
    section_offset_x = L + 2000
    section_offset_y = 0
    
    # Simplified section showing typical bay
    section_width = col_spacing_x * 2
    
    # Raft slab
    slab_section = [
        (section_offset_x, section_offset_y),
        (section_offset_x + section_width, section_offset_y),
        (section_offset_x + section_width, section_offset_y - D),
        (section_offset_x, section_offset_y - D)
    ]
    msp.add_lwpolyline(slab_section, close=True, 
                       dxfattribs={"layer": "Concrete", "lineweight": 50})
    
    # Columns
    for i in range(3):  # Show 3 columns
        col_x = section_offset_x + i * col_spacing_x
        if col_x <= section_offset_x + section_width:
            col_sect = [
                (col_x - col_width/2, section_offset_y),
                (col_x + col_width/2, section_offset_y),
                (col_x + col_width/2, section_offset_y + 600),
                (col_x - col_width/2, section_offset_y + 600)
            ]
            msp.add_lwpolyline(col_sect, close=True, 
                               dxfattribs={"layer": "Columns", "lineweight": 35})
    
    # Bottom reinforcement
    bot_bar_level = section_offset_y - D + cover + bot_bars_dia/2
    n_bars_sect = int(section_width / bot_bars_spacing)
    
    for i in range(n_bars_sect):
        bar_x = section_offset_x + cover + i * bot_bars_spacing
        if bar_x <= section_offset_x + section_width - cover:
            msp.add_circle((bar_x, bot_bar_level), radius=bot_bars_dia/2, 
                          dxfattribs={"layer": "Reinforcement"})
    
    # Top reinforcement
    top_bar_level = section_offset_y - cover - top_bars_dia/2
    
    for i in range(n_bars_sect):
        bar_x = section_offset_x + cover + i * top_bars_spacing
        if bar_x <= section_offset_x + section_width - cover:
            msp.add_circle((bar_x, top_bar_level), radius=top_bars_dia/2, 
                          dxfattribs={"layer": "Reinforcement"})
    
    # --- DIMENSIONS & LABELS ---
    text_height = 80
    
    msp.add_text("RAFT FOUNDATION", 
                dxfattribs={"layer": "Text", "height": text_height * 1.5}
               ).set_placement((plan_offset_x, plan_offset_y + B + 400), 
                              align=ezdxf.enums.TextEntityAlignment.LEFT)
    
    msp.add_text("TYPICAL SECTION", 
                dxfattribs={"layer": "Text", "height": text_height * 1.2}
               ).set_placement((section_offset_x + section_width/2, section_offset_y - D - 250), 
                              align=ezdxf.enums.TextEntityAlignment.CENTER)
    
    # Notes
    notes_x = plan_offset_x
    notes_y = plan_offset_y - 600
    
    notes = [
        "REINFORCEMENT:",
        f"Bottom: {bar_prefix}{bot_bars_dia} @ {bot_bars_spacing}mm both ways",
        f"Top: {bar_prefix}{top_bars_dia} @ {top_bars_spacing}mm both ways",
        f"Slab depth: {int(D)}mm",
        f"Cover: {int(cover)}mm (40mm exposed, 50mm buried)",
        f"Concrete: {concrete_grade}",
        f"Steel: {steel_grade}",
        f"Column grid: {int(col_spacing_x)}mm × {int(col_spacing_y)}mm",
        "Ref: BS EN 1992-1-1:2004"
    ]
    
    for i, note in enumerate(notes):
        msp.add_text(note, dxfattribs={"layer": "Text", "height": text_height * 0.65}
                    ).set_placement((notes_x, notes_y - i * 75), 
                                   align=ezdxf.enums.TextEntityAlignment.LEFT)
    
    # Output
    stream = io.StringIO()
    doc.write(stream)
    return stream.getvalue()(f"{int(L)}", dxfattribs={"layer": "Dimensions", "height": text_height}
                ).set_placement((plan_offset_x + L/2, dim_y + 40), 
                               align=ezdxf.enums.TextEntityAlignment.BOTTOM_CENTER)
    
    # Width
    dim_x = plan_offset_x + L + 200
    msp.add_line((dim_x, plan_offset_y), (dim_x, plan_offset_y + B), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_line((dim_x - 30, plan_offset_y), (dim_x + 30, plan_offset_y), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_line((dim_x - 30, plan_offset_y + B), (dim_x + 30, plan_offset_y + B), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_text(f"{int(B)}", dxfattribs={"layer": "Dimensions", "height": text_height, "rotation": 90}
                ).set_placement((dim_x + 40, plan_offset_y + B/2), 
                               align=ezdxf.enums.TextEntityAlignment.BOTTOM_CENTER)
    
    # Section depth dimension
    dim_x_sect = section_offset_x - 150
    msp.add_line((dim_x_sect, section_offset_y), (dim_x_sect, section_offset_y - D), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_line((dim_x_sect - 30, section_offset_y), (dim_x_sect + 30, section_offset_y), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_line((dim_x_sect - 30, section_offset_y - D), (dim_x_sect + 30, section_offset_y - D), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_text(f"{int(D)}", dxfattribs={"layer": "Dimensions", "height": text_height, "rotation": 90}
                ).set_placement((dim_x_sect - 40, section_offset_y - D/2), 
                               align=ezdxf.enums.TextEntityAlignment.BOTTOM_CENTER)
    
    # Cover dimension
    msp.add_line((section_offset_x, section_offset_y - D), 
                 (section_offset_x, bar_y_level), 
                 dxfattribs={"layer": "Dimensions", "linetype": "DASHED"})
    msp.add_text(f"75", dxfattribs={"layer": "Text", "height": text_height * 0.8}
                ).set_placement((section_offset_x - 100, section_offset_y - D + cover_bot/2), 
                               align=ezdxf.enums.TextEntityAlignment.MIDDLE_RIGHT)
    
    # --- LABELS AND NOTES ---
    # Title
    msp.add_text("PAD FOUNDATION DETAIL", 
                dxfattribs={"layer": "Text", "height": text_height * 1.5}
               ).set_placement((plan_offset_x, plan_offset_y + B + 400), 
                              align=ezdxf.enums.TextEntityAlignment.LEFT)
    
    # Plan label
    msp.add_text("PLAN", 
                dxfattribs={"layer": "Text", "height": text_height * 1.2}
               ).set_placement((plan_offset_x + L/2, plan_offset_y - 150), 
                              align=ezdxf.enums.TextEntityAlignment.CENTER)
    
    # Section label
    msp.add_text("SECTION A-A", 
                dxfattribs={"layer": "Text", "height": text_height * 1.2}
               ).set_placement((section_offset_x + L/2, section_offset_y - D - 200), 
                              align=ezdxf.enums.TextEntityAlignment.CENTER)
    
    # Reinforcement schedule
    schedule_x = plan_offset_x
    schedule_y = plan_offset_y - 500
    
    notes = [
        "REINFORCEMENT SCHEDULE:",
        f"Bottom bars (X): {bars_x_n}{bar_prefix}{bars_x_dia} @ {bars_x_spacing}mm c/c",
        f"Bottom bars (Y): {bars_y_n}{bar_prefix}{bars_y_dia} @ {bars_y_spacing}mm c/c",
        f"Cover: 75mm bottom, 75mm sides, 50mm top",
        f"Concrete: {concrete_grade}",
        f"Steel: {steel_grade}",
        "Ref: BS EN 1992-1-1:2004"
    ]
    
    for i, note in enumerate(notes):
        msp.add_text(note, dxfattribs={"layer": "Text", "height": text_height * 0.7}
                    ).set_placement((schedule_x, schedule_y - i * 80), 
                                   align=ezdxf.enums.TextEntityAlignment.LEFT)
    
    # Ground level label
    msp.add_text("Foundation level", 
                dxfattribs={"layer": "Text", "height": text_height * 0.8}
               ).set_placement((section_offset_x + L + 250, section_offset_y + 20), 
                              align=ezdxf.enums.TextEntityAlignment.LEFT)
    
    # Leader for ground level
    msp.add_leader(
        vertices=[(section_offset_x + L + 240, section_offset_y + 20), 
                 (section_offset_x + L + 50, section_offset_y)],
        dxfattribs={"layer": "Dimensions"}
    )
    
    # Section cut line on plan
    section_line_y = plan_offset_y + B/2
    msp.add_line((plan_offset_x - 100, section_line_y), 
                 (plan_offset_x + L + 100, section_line_y), 
                 dxfattribs={"layer": "Dimensions", "linetype": "DASHDOT", "lineweight": 25})
    
    # Section markers
    marker_size = 100
    # Left marker
    msp.add_line((plan_offset_x - 100, section_line_y - marker_size/2), 
                 (plan_offset_x - 100, section_line_y + marker_size/2), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_text("A", dxfattribs={"layer": "Text", "height": text_height}
                ).set_placement((plan_offset_x - 100, section_line_y + marker_size/2 + 50), 
                               align=ezdxf.enums.TextEntityAlignment.MIDDLE_CENTER)
    
    # Right marker
    msp.add_line((plan_offset_x + L + 100, section_line_y - marker_size/2), 
                 (plan_offset_x + L + 100, section_line_y + marker_size/2), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_text("A", dxfattribs={"layer": "Text", "height": text_height}
                ).set_placement((plan_offset_x + L + 100, section_line_y + marker_size/2 + 50), 
                               align=ezdxf.enums.TextEntityAlignment.MIDDLE_CENTER)
    
    # Output
    stream = io.StringIO()
    doc.write(stream)
    return stream.getvalue()


def generate_pile_cap_dxf(params):
    """
    Generate DXF for pile cap foundation with reinforcement detailing
    Following BS EN 1992-1-1:2004
    """
    
    # Extract parameters
    L = float(params.get("length", 3000))
    B = float(params.get("width", 3000))
    D = float(params.get("depth", 800))
    
    col_w = float(params.get("column_width", 450))
    col_d = float(params.get("column_depth", 450))
    
    pile_dia = float(params.get("pile_diameter", 450))
    pile_count = int(params.get("pile_count", 4))
    pile_spacing = float(params.get("pile_spacing", 1350))
    
    cover_bot = float(params.get("cover", 75))
    cover_side = float(params.get("side_cover", 75))
    
    # Main bars
    main_bars = params.get("main_bars", {})
    main_bars_n = int(main_bars.get("count", 8))
    main_bars_dia = int(main_bars.get("diameter", 20))
    
    # Links/Lacers
    link_dia = int(params.get("link_diameter", 12))
    link_spacing = int(params.get("link_spacing", 300))
    
    steel_grade = params.get("steel_grade", "Grade 460")
    concrete_grade = params.get("concrete_grade", "C30")
    
    bar_prefix = "H" if "460" in steel_grade else "R"
    
    # Setup DXF
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    
    # Layers
    layers = {
        "Concrete": 7,
        "Reinforcement": 1,
        "Piles": 5,
        "Dimensions": 3,
        "Text": 2,
        "Column": 6,
        "Hatching": 8
    }
    
    for name, color in layers.items():
        if name not in doc.layers:
            doc.layers.new(name=name, dxfattribs={"color": color})
    
    # Calculate pile positions (assuming square arrangement)
    rows = cols = int(math.sqrt(pile_count))
    pile_positions = []
    
    start_x = (L - (cols - 1) * pile_spacing) / 2
    start_y = (B - (rows - 1) * pile_spacing) / 2
    
    for i in range(rows):
        for j in range(cols):
            pile_x = start_x + j * pile_spacing
            pile_y = start_y + i * pile_spacing
            pile_positions.append((pile_x, pile_y))
    
    # --- PLAN VIEW ---
    plan_offset_x = 0
    plan_offset_y = 0
    
    # Pile cap outline
    cap_plan = [
        (plan_offset_x, plan_offset_y),
        (plan_offset_x + L, plan_offset_y),
        (plan_offset_x + L, plan_offset_y + B),
        (plan_offset_x, plan_offset_y + B)
    ]
    msp.add_lwpolyline(cap_plan, close=True, 
                       dxfattribs={"layer": "Concrete", "lineweight": 50})
    
    # Column
    col_x = plan_offset_x + (L - col_w) / 2
    col_y = plan_offset_y + (B - col_d) / 2
    column_plan = [
        (col_x, col_y),
        (col_x + col_w, col_y),
        (col_x + col_w, col_y + col_d),
        (col_x, col_y + col_d)
    ]
    msp.add_lwpolyline(column_plan, close=True, 
                       dxfattribs={"layer": "Column", "lineweight": 35})
    
    # Piles
    for pile_pos in pile_positions:
        px = plan_offset_x + pile_pos[0]
        py = plan_offset_y + pile_pos[1]
        msp.add_circle((px, py), radius=pile_dia/2, 
                      dxfattribs={"layer": "Piles", "lineweight": 30})
        
        # Hatch pile
        hatch = msp.add_hatch(color=5, dxfattribs={"layer": "Piles"})
        path = hatch.paths.add_edge_path()
        path.add_arc((px, py), radius=pile_dia/2, start_angle=0, end_angle=360)
        hatch.set_pattern_fill("ANSI31", scale=0.3)
        
        # Pile centerlines
        cross_size = pile_dia * 0.3
        msp.add_line((px - cross_size, py), (px + cross_size, py), 
                     dxfattribs={"layer": "Piles", "linetype": "CENTER"})
        msp.add_line((px, py - cross_size), (px, py + cross_size), 
                     dxfattribs={"layer": "Piles", "linetype": "CENTER"})
    
    # Main reinforcement (bottom bars - both directions)
    bar_spacing = 200
    
    # X-direction bars
    for i in range(main_bars_n):
        bar_y = plan_offset_y + cover_side + i * bar_spacing
        if bar_y <= plan_offset_y + B - cover_side:
            msp.add_line(
                (plan_offset_x + cover_side, bar_y),
                (plan_offset_x + L - cover_side, bar_y),
                dxfattribs={"layer": "Reinforcement", "lineweight": 25}
            )
    
    # Y-direction bars
    for i in range(main_bars_n):
        bar_x = plan_offset_x + cover_side + i * bar_spacing
        if bar_x <= plan_offset_x + L - cover_side:
            msp.add_line(
                (bar_x, plan_offset_y + cover_side),
                (bar_x, plan_offset_y + B - cover_side),
                dxfattribs={"layer": "Reinforcement", "lineweight": 25, "linetype": "DASHED"}
            )
    
    # --- SECTION VIEW ---
    section_offset_x = L + 1500
    section_offset_y = 0
    
    # Pile cap outline
    cap_section = [
        (section_offset_x, section_offset_y),
        (section_offset_x + L, section_offset_y),
        (section_offset_x + L, section_offset_y - D),
        (section_offset_x, section_offset_y - D)
    ]
    msp.add_lwpolyline(cap_section, close=True, 
                       dxfattribs={"layer": "Concrete", "lineweight": 50})
    
    # Ground/pile cap level
    msp.add_line(
        (section_offset_x - 200, section_offset_y),
        (section_offset_x + L + 200, section_offset_y),
        dxfattribs={"layer": "Dimensions", "linetype": "DASHDOT"}
    )
    
    # Column in section
    col_sect_x = section_offset_x + (L - col_w) / 2
    column_section = [
        (col_sect_x, section_offset_y),
        (col_sect_x + col_w, section_offset_y),
        (col_sect_x + col_w, section_offset_y + 450),
        (col_sect_x, section_offset_y + 450)
    ]
    msp.add_lwpolyline(column_section, close=True, 
                       dxfattribs={"layer": "Column", "lineweight": 35})
    
    # Piles in section (showing 2 piles)
    for pile_pos in pile_positions[:2]:  # Show first row of piles
        px = section_offset_x + pile_pos[0]
        pile_top = section_offset_y - D
        pile_bottom = pile_top - 800  # 800mm into ground
        
        # Pile outline
        pile_section = [
            (px - pile_dia/2, pile_top),
            (px + pile_dia/2, pile_top),
            (px + pile_dia/2, pile_bottom),
            (px - pile_dia/2, pile_bottom)
        ]
        msp.add_lwpolyline(pile_section, close=True, 
                           dxfattribs={"layer": "Piles", "lineweight": 30})
        
        # Hatch pile
        hatch = msp.add_hatch(color=5, dxfattribs={"layer": "Piles"})
        hatch.paths.add_polyline_path(pile_section, is_closed=True)
        hatch.set_pattern_fill("ANSI31", scale=0.5)
    
    # Bottom reinforcement bars
    bar_level = section_offset_y - D + cover_bot + main_bars_dia/2
    
    for i in range(main_bars_n):
        bar_x = section_offset_x + cover_side + i * bar_spacing
        if bar_x <= section_offset_x + L - cover_side:
            msp.add_circle((bar_x, bar_level), radius=main_bars_dia/2, 
                          dxfattribs={"layer": "Reinforcement"})
            # Fill circle
            hatch = msp.add_hatch(color=1, dxfattribs={"layer": "Reinforcement"})
            path = hatch.paths.add_edge_path()
            path.add_arc((bar_x, bar_level), radius=main_bars_dia/2, 
                        start_angle=0, end_angle=360)
            hatch.set_solid_fill()
    
    # Links/Lacers (2 layers shown)
    link_positions = [section_offset_x + L/3, section_offset_x + 2*L/3]
    
    for link_x in link_positions:
        # Vertical links
        link_outline = [
            (link_x - cover_side + link_dia/2, section_offset_y - cover_bot),
            (link_x + cover_side - link_dia/2, section_offset_y - cover_bot),
            (link_x + cover_side - link_dia/2, bar_level - main_bars_dia/2 - link_dia),
            (link_x - cover_side + link_dia/2, bar_level - main_bars_dia/2 - link_dia)
        ]
        msp.add_lwpolyline(link_outline, close=True, 
                           dxfattribs={"layer": "Reinforcement", "lineweight": 15})
    
    # --- DIMENSIONS ---
    text_height = 70
    
    # Plan dimensions
    dim_y = plan_offset_y + B + 250
    msp.add_line((plan_offset_x, dim_y), (plan_offset_x + L, dim_y), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_line((plan_offset_x, dim_y - 30), (plan_offset_x, dim_y + 30), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_line((plan_offset_x + L, dim_y - 30), (plan_offset_x + L, dim_y + 30), 
                 dxfattribs={"layer": "Dimensions"})
    msp.add_text