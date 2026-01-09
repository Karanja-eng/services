
import ezdxf
import io
from ezdxf.gfxattribs import GfxAttribs

def generate_beam_dxf(params):
    """
    Generates a DXF file for a beam section based on parameters.
    
    params: dict containing:
        - beam_type: "Rectangular", "T-Beam", "L-Beam"
        - width: mm (web width for T/L)
        - depth: mm (total depth)
        - flange_width: mm (optional)
        - flange_thickness: mm (optional)
        - cover: mm
        - top_steel: {"count": int, "diameter": int}
        - bot_steel: {"count": int, "diameter": int}
        - link_diameter: int (default 10)
        - link_spacing: int (default 200)
    
    Returns: Bytes of the DXF file.
    """
    
    # Extract Parameters
    beam_type = params.get("beam_type", "Rectangular")
    
    # Dimensions
    h = float(params.get("depth", 500))
    b = float(params.get("width", 300))  # This is bw for T/L
    c = float(params.get("cover", 25))
    
    # Flange dimensions (defaults if missing)
    bf = float(params.get("flange_width", 1000))
    hf = float(params.get("flange_thickness", 150))
    
    # Steel
    top_n = int(params.get("top_steel", {}).get("count", 2))
    top_d = int(params.get("top_steel", {}).get("diameter", 16))
    bot_n = int(params.get("bot_steel", {}).get("count", 3))
    bot_d = int(params.get("bot_steel", {}).get("diameter", 20))
    
    link_d = int(params.get("link_diameter", 10))
    link_s = int(params.get("link_spacing", 200))

    # --- Setup DXF ---
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    
    # Setup styles
    if "Standard" not in doc.styles:
        doc.styles.new("Standard", dxfattribs={"font": "Arial"})

    # Layers
    layers = {
        "Concrete": 7,       # White/Black
        "Stirrups": 1,       # Red
        "MainBars": 5,       # Blue
        "Dimensions": 3,     # Green
        "Text": 2            # Yellow
    }
    
    for name, color in layers.items():
        if name not in doc.layers:
            doc.layers.new(name=name, dxfattribs={"color": color})

    # --- Geometry Calculation ---
    points = []
    
    # Origin is Top-Left of the bounding box roughly
    # Let's center the web on X=0 for symmetry in T-beams, or define specific drawing logic
    
    # x coordinates relative to an origin (0,0) at top-left of web (or similar)
    
    if beam_type == "T-Beam":
        # T-Beam Geometry
        # Flange centered on web
        flange_overhang = (bf - b) / 2
        
        # Points (Clockwise from top-left of flange)
        p1 = (-flange_overhang, 0)
        p2 = (b + flange_overhang, 0)
        p3 = (b + flange_overhang, -hf)
        p4 = (b, -hf)
        p5 = (b, -h)
        p6 = (0, -h)
        p7 = (0, -hf)
        p8 = (-flange_overhang, -hf)
        
        points = [p1, p2, p3, p4, p5, p6, p7, p8]
        
        # Stirrup Bounds (in web mostly)
        # Stirrup usually goes into flange for T-beams? Or just web? 
        # Usually web stirrup + flange reinforcement. Assuming simple web stirrup for now.
        # Stirrup outer measures
        s_left = c
        s_right = b - c
        s_top = -c # From top of flange? No, commonly from top of beam
        s_bot = -h + c
        
    elif beam_type == "L-Beam":
        # L-Beam Geometry (Flange on RIGHT for this example)
        flange_overhang = bf - b
        
        p1 = (0, 0)
        p2 = (b + flange_overhang, 0)
        p3 = (b + flange_overhang, -hf)
        p4 = (b, -hf)
        p5 = (b, -h)
        p6 = (0, -h)
        
        points = [p1, p2, p3, p4, p5, p6]
        
        s_left = c
        s_right = b - c
        s_top = -c
        s_bot = -h + c
        
    else: # Rectangular
        # Rect Geometry
        p1 = (0, 0)
        p2 = (b, 0)
        p3 = (b, -h)
        p4 = (0, -h)
        
        points = [p1, p2, p3, p4]
        
        s_left = c
        s_right = b - c
        s_top = -c
        s_bot = -h + c

    # Draw Concrete Outline
    msp.add_lwpolyline(points, close=True, dxfattribs={"layer": "Concrete", "lw": 0.3})
    
    # Draw Stirrup
    # NOTE: Coordinate adjustments for section drawn at (0,0)
    # The 'points' above define 0,0 at Top-Left of Left-most element or Web?
    # Let's ensure stirrups are relative to the WEB part.
    # In my logic:
    # Rect: 0 to b. Stp: c to b-c.
    # T-Beam: Web is 0 to b? No, I defined p1 = -overhang.
    # Let's adjust T-Beam stirrups.
    # Web X range: 0 to b is logical for calculations.
    # In T-Beam above, I did p1...p8. Width of web is p6(0) to p5(b).
    # So Web X is 0 to b.
    
    stirrup_pts = [
        (s_left, s_top),
        (s_right, s_top),
        (s_right, s_bot),
        (s_left, s_bot),
        (s_left, s_top)
    ]
    msp.add_lwpolyline(stirrup_pts, close=True, dxfattribs={"layer": "Stirrups"})

    # --- Bars ---
    
    # Top Bars (Hangers)
    # Spacing
    if top_n > 1:
        top_space = ((s_right - link_d) - (s_left + link_d) - top_d) / (top_n - 1)
        start_x_top = s_left + link_d + top_d/2
        
        for i in range(top_n):
            bx = start_x_top + i * top_space
            by = s_top - link_d - top_d/2
            msp.add_circle((bx, by), radius=top_d/2, dxfattribs={"layer": "MainBars"})
            # Add fill/hatch later if needed, circle is fine
    elif top_n == 1:
         bx = (s_left + s_right) / 2
         by = s_top - link_d - top_d/2
         msp.add_circle((bx, by), radius=top_d/2, dxfattribs={"layer": "MainBars"})

    # Bottom Bars (Main Tension)
    if bot_n > 1:
        bot_space = ((s_right - link_d) - (s_left + link_d) - bot_d) / (bot_n - 1)
        start_x_bot = s_left + link_d + bot_d/2
        
        for i in range(bot_n):
            bx = start_x_bot + i * bot_space
            by = s_bot + link_d + bot_d/2
            msp.add_circle((bx, by), radius=bot_d/2, dxfattribs={"layer": "MainBars"})
    elif bot_n == 1:
         bx = (s_left + s_right) / 2
         by = s_bot + link_d + bot_d/2
         msp.add_circle((bx, by), radius=bot_d/2, dxfattribs={"layer": "MainBars"})

    # --- Detailing Labels (BS 8110 / EC2 Style) ---
    # Scale text based on beam depth
    text_height = h / 20
    if text_height < 15: text_height = 15
    dim_offset = 50
    
    # Steel Grade Prefix
    steel_grade = params.get("steel_grade", "Grade 460")
    bar_prefix = "H" if "460" in steel_grade else "R"
    
    # 1. Section Label
    msp.add_text(
        f"SECTION: {beam_type.upper()}", 
        dxfattribs={"layer": "Text", "height": text_height * 1.5}
    ).set_placement((b/2, -h - 150), align=ezdxf.enums.TextEntityAlignment.CENTER)
    
    # Design Notes
    fcu_label = params.get("concrete_grade", "C30")
    cover_label = params.get("cover", 25)
    
    notes = [
        "DESIGN NOTES:",
        f"Concrete: {fcu_label}", 
        f"Steel: {steel_grade}",
        f"Cover: {cover_label}mm",
        "Ref: BS 8110 / EC2"
    ]
    
    for i, note in enumerate(notes):
        msp.add_text(
            note, 
            dxfattribs={"layer": "Text", "height": text_height * 0.7}
        ).set_placement((b + 250, - i * (text_height * 1.2)), align=ezdxf.enums.TextEntityAlignment.LEFT)

    # 2. Top Steel Label
    label_top = f"{top_n}{bar_prefix}{top_d}"
    msp.add_text(
        label_top, 
        dxfattribs={"layer": "Text", "height": text_height}
    ).set_placement((b + 100, -c - 20), align=ezdxf.enums.TextEntityAlignment.LEFT)
    
    # Leader for Top Steel
    msp.add_leader(
        vertices=[(b + 90, -c - 20 + text_height/2), (b-c, -c - top_d)],
        dxfattribs={"layer": "Dimensions"}
    )

    # 3. Bottom Steel Label
    label_bot = f"{bot_n}{bar_prefix}{bot_d}"
    msp.add_text(
        label_bot, 
        dxfattribs={"layer": "Text", "height": text_height}
    ).set_placement((b + 100, -h + c + 20), align=ezdxf.enums.TextEntityAlignment.LEFT)
    
    # Leader for Bottom Steel
    msp.add_leader(
        vertices=[(b + 90, -h + c + 20 + text_height/2), (b-c, -h + c + bot_d)],
        dxfattribs={"layer": "Dimensions"}
    )
    
    # 4. Stirrup Label
    label_link = f"{bar_prefix}{link_d} @ {link_s} c/c"
    msp.add_text(
        label_link, 
        dxfattribs={"layer": "Text", "height": text_height}
    ).set_placement((-b/2, -h/2), align=ezdxf.enums.TextEntityAlignment.RIGHT)
    
    # Leader for Links
    msp.add_leader(
        vertices=[(-b/2 + 10, -h/2 + text_height/2), (c, -h/2)],
        dxfattribs={"layer": "Dimensions"}
    )

    # 5. Dimensions
    # Using simple lines and text for dimensions to allow maximum compatibility
    
    # Width Dim
    msp.add_line((0, 50), (b, 50), dxfattribs={"layer": "Dimensions"})
    msp.add_line((0, 10), (0, 60), dxfattribs={"layer": "Dimensions"}) # Tick
    msp.add_line((b, 10), (b, 60), dxfattribs={"layer": "Dimensions"}) # Tick
    msp.add_text(
        f"{int(b)}",
        dxfattribs={"layer": "Dimensions", "height": text_height * 0.8}
    ).set_placement((b/2, 55), align=ezdxf.enums.TextEntityAlignment.BOTTOM_CENTER)
    
    # Depth Dim
    msp.add_line((-50, 0), (-50, -h), dxfattribs={"layer": "Dimensions"})
    msp.add_line((-40, 0), (-60, 0), dxfattribs={"layer": "Dimensions"}) # Tick
    msp.add_line((-40, -h), (-60, -h), dxfattribs={"layer": "Dimensions"}) # Tick
    msp.add_text(
        f"{int(h)}",
        dxfattribs={"layer": "Dimensions", "height": text_height * 0.8, "rotation": 90}
    ).set_placement((-55, -h/2), align=ezdxf.enums.TextEntityAlignment.BOTTOM_CENTER)

    # --- Output ---
    stream = io.StringIO()
    doc.write(stream)
    return stream.getvalue()
