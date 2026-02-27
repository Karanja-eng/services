"""
steel_structure_generators.py

Self-contained, complete parametric steel structure generators.
Each generator returns a standard dict: { success, members, nodes }
where members is a list of member dicts with keys:
  id, mark, type, member_type, grade,
  centerline: { start: {x,y,z}, end: {x,y,z} },
  section: { designation, depth, width, mass_per_meter }

All coordinates in MILLIMETRES.
"""

import math
from typing import List, Dict, Any


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _node(x: float, y: float, z: float, nid: str = None) -> Dict[str, Any]:
    res = {"x": float(x), "y": float(y), "z": float(z)}
    if nid:
        res["id"] = nid
    else:
        # Fallback to unique coordinate-based ID
        res["id"] = f"N_{int(x)}_{int(y)}_{int(z)}"
    return res


def _member(mid: str, mark: str, mtype: str,
            sn: Dict[str, Any], en: Dict[str, Any],
            desig: str, depth: float, width: float, mass: float,
            grade: str = "S355") -> Dict[str, Any]:
    return {
        "id": mid,
        "mark": mark,
        "type": mtype,
        "member_type": mtype,
        "grade": grade,
        "centerline": {
            "start": sn,
            "end":   en,
        },
        "section": {
            "designation": desig,
            "depth": float(depth),
            "width": float(width),
            "mass_per_meter": float(mass),
        }
    }


# ---------------------------------------------------------------------------
# 1. PRATT TRUSS
#    X = span direction, Z = height, Y = bay spacing
#    Generates top chord, bottom chord, verticals, diagonals for each bay
# ---------------------------------------------------------------------------

def generate_pratt_truss(span=12000, depth=1500, num_panels=6,
                         pitch_angle=0.0, grade="S355",
                         bay_span=0, **kwargs) -> Dict[str, Any]:
    members: List[Dict] = []
    nodes:   List[Dict] = []
    panel_w = span / num_panels

    # Section sizes (RHS for trusses - common in UK practice)
    TC = {"desig": "200x120x8.0RHS", "depth": 200, "width": 120, "mass": 37.5}
    BC = {"desig": "200x120x8.0RHS", "depth": 200, "width": 120, "mass": 37.5}
    WB = {"desig": "150x100x6.3RHS", "depth": 150, "width": 100, "mass": 23.3}

    def panel_top_z(px: float) -> float:
        """Height of top chord at panel position px (mm)."""
        if pitch_angle > 0.0:
            # Pitched - symmetric
            half  = span / 2.0
            d_ctr = abs(px - half)
            return depth - d_ctr * math.tan(math.radians(pitch_angle))
        return float(depth)

    # Build node positions
    bot_nodes = [_node(i * panel_w, 0, 0, f"BN{i}") for i in range(num_panels + 1)]
    top_nodes = [_node(i * panel_w, 0, panel_top_z(i * panel_w), f"TN{i}")
                 for i in range(num_panels + 1)]

    nodes = bot_nodes + top_nodes
    uid = [0]

    def nxt(prefix="M"):
        uid[0] += 1
        return f"{prefix}{uid[0]}"

    # Top chord
    for i in range(num_panels):
        n1, n2 = top_nodes[i], top_nodes[i + 1]
        members.append(_member(
            nxt("TC"), f"TC{i+1}", "Truss Chord",
            n1, n2,
            TC["desig"], TC["depth"], TC["width"], TC["mass"], grade))

    # Bottom chord
    for i in range(num_panels):
        n1, n2 = bot_nodes[i], bot_nodes[i + 1]
        members.append(_member(
            nxt("BC"), f"BC{i+1}", "Truss Chord",
            n1, n2,
            BC["desig"], BC["depth"], BC["width"], BC["mass"], grade))

    half = num_panels // 2

    # Verticals (Pratt: at every internal panel point)
    for i in range(1, num_panels):
        b, t = bot_nodes[i], top_nodes[i]
        members.append(_member(
            nxt("V"), f"V{i}", "Truss Vertical",
            b, t,
            WB["desig"], WB["depth"], WB["width"], WB["mass"], grade))

    # End verticals
    for i in [0, num_panels]:
        b, t = bot_nodes[i], top_nodes[i]
        members.append(_member(
            nxt("EV"), f"EV{i}", "Truss Vertical",
            b, t,
            WB["desig"], WB["depth"], WB["width"], WB["mass"], grade))

    # Diagonals (Pratt: left half slope up-right, right half slope up-left)
    for i in range(num_panels):
        if i < half:
            # Left half: B[i] → T[i+1]
            b, t = bot_nodes[i], top_nodes[i + 1]
        else:
            # Right half: B[i+1] → T[i]
            b, t = bot_nodes[i + 1], top_nodes[i]
        members.append(_member(
            nxt("D"), f"D{i+1}", "Truss Diagonal",
            b, t,
            WB["desig"], WB["depth"], WB["width"], WB["mass"], grade))

    return {"success": True, "members": members, "nodes": nodes,
            "metadata": {"type": "pratt_truss", "span_m": span / 1000}}


# ---------------------------------------------------------------------------
# 2. PORTAL FRAME
#    Generates columns + pitched rafters for every bay frame, plus purlins
#    X = span, Y = bay spacing, Z = height
# ---------------------------------------------------------------------------

def generate_portal_frame(span=18000, eave_height=6000, ridge_height=8500,
                           num_bays=1, bay_spacing=6000, grade="S355",
                           **kwargs) -> Dict[str, Any]:
    members: List[Dict] = []
    nodes:   List[Dict] = []

    COL = {"desig": "406x178x74UB", "depth": 412.8, "width": 179.5, "mass": 74.2}
    RAF = {"desig": "356x171x67UB", "depth": 363.4, "width": 173.2, "mass": 67.1}
    PUR = {"desig": "200x120x8.0RHS", "depth": 200, "width": 120, "mass": 37.5}

    uid = [0]
    def nxt(p="M"):
        uid[0] += 1
        return f"{p}{uid[0]}"

    num_frames = num_bays + 1
    ridge_x = span / 2.0

    for fi in range(num_frames):
        y = fi * bay_spacing
        # Frame points (x, y, z)
        lbase  = _node(0, y, 0, f"F{fi+1}_LB")
        leave  = _node(0, y, eave_height, f"F{fi+1}_LE")
        ridge  = _node(ridge_x, y, ridge_height, f"F{fi+1}_R")
        reave  = _node(span, y, eave_height, f"F{fi+1}_RE")
        rbase  = _node(span, y, 0, f"F{fi+1}_RB")

        for pt in [lbase, leave, ridge, reave, rbase]:
            nodes.append(pt)

        fm = f"F{fi+1}"

        # Left column
        members.append(_member(
            nxt("CL"), f"CL_{fm}", "Column",
            lbase, leave,
            COL["desig"], COL["depth"], COL["width"], COL["mass"], grade))

        # Left rafter
        members.append(_member(
            nxt("RL"), f"RL_{fm}", "Rafter",
            leave, ridge,
            RAF["desig"], RAF["depth"], RAF["width"], RAF["mass"], grade))

        # Right rafter
        members.append(_member(
            nxt("RR"), f"RR_{fm}", "Rafter",
            ridge, reave,
            RAF["desig"], RAF["depth"], RAF["width"], RAF["mass"], grade))

        # Right column
        members.append(_member(
            nxt("CR"), f"CR_{fm}", "Column",
            reave, rbase,
            COL["desig"], COL["depth"], COL["width"], COL["mass"], grade))

    # Purlins along Y between frames
    purlin_xs = [0, ridge_x * 0.5, ridge_x, span - ridge_x * 0.5, span]
    purlin_zs = [eave_height,
                 eave_height + (ridge_height - eave_height) * 0.5,
                 ridge_height,
                 eave_height + (ridge_height - eave_height) * 0.5,
                 eave_height]
    for bay in range(num_bays):
        y0 = bay * bay_spacing
        y1 = (bay + 1) * bay_spacing
        for pi, (px, pz) in enumerate(zip(purlin_xs, purlin_zs)):
            sn = _node(px, y0, pz, f"B{bay+1}_P{pi+1}_S")
            en = _node(px, y1, pz, f"B{bay+1}_P{pi+1}_E")
            nodes.extend([sn, en])
            members.append(_member(
                nxt("P"), f"P{bay+1}_{pi+1}", "Purlin",
                sn, en,
                PUR["desig"], PUR["depth"], PUR["width"], PUR["mass"], grade))

    return {"success": True, "members": members, "nodes": nodes,
            "metadata": {"type": "portal_frame", "span_m": span / 1000,
                         "num_bays": num_bays}}


# ---------------------------------------------------------------------------
# 3. PRATT BRIDGE TRUSS
#    Two parallel Pratt trusses (left and right at Y=0 and Y=width)
#    connected by floor beams and top lateral bracing
#    Bridge span along X axis, Z = height
# ---------------------------------------------------------------------------

def generate_bridge(span=25000, width=3500, depth=3000, num_panels=8,
                    grade="S355", **kwargs) -> Dict[str, Any]:
    members: List[Dict] = []
    nodes:   List[Dict] = []

    CHORD  = {"desig": "300x200x10.0RHS", "depth": 300, "width": 200, "mass": 73.9}
    WEB    = {"desig": "200x120x8.0RHS",  "depth": 200, "width": 120, "mass": 37.5}
    FLOOR  = {"desig": "406x178x74UB",    "depth": 412, "width": 179, "mass": 74.2}
    BRACE  = {"desig": "150x100x6.3RHS",  "depth": 150, "width": 100, "mass": 23.3}

    panel_w = span / num_panels
    uid = [0]

    def nxt(p="M"):
        uid[0] += 1
        return f"{p}{uid[0]}"

    # Build each truss (y=0 and y=width)
    for side_idx, y in enumerate([0, width]):
        sfx = "L" if side_idx == 0 else "R"

        bot = [_node(i * panel_w, y, 0, f"B{sfx}{i}") for i in range(num_panels + 1)]
        top = [_node(i * panel_w, y, depth, f"T{sfx}{i}") for i in range(num_panels + 1)]
        nodes += bot + top

        # Top chord
        for i in range(num_panels):
            members.append(_member(
                nxt(f"TC{sfx}"), f"TC{sfx}{i+1}", "Truss Chord",
                top[i], top[i+1],
                CHORD["desig"], CHORD["depth"], CHORD["width"], CHORD["mass"], grade))

        # Bottom chord
        for i in range(num_panels):
            members.append(_member(
                nxt(f"BC{sfx}"), f"BC{sfx}{i+1}", "Truss Chord",
                bot[i], bot[i+1],
                CHORD["desig"], CHORD["depth"], CHORD["width"], CHORD["mass"], grade))

        half = num_panels // 2
        # Verticals
        for i in range(num_panels + 1):
            members.append(_member(
                nxt(f"V{sfx}"), f"V{sfx}{i+1}", "Truss Vertical",
                bot[i], top[i],
                WEB["desig"], WEB["depth"], WEB["width"], WEB["mass"], grade))

        # Pratt diagonals
        for i in range(num_panels):
            if i < half:
                members.append(_member(
                    nxt(f"D{sfx}"), f"D{sfx}{i+1}", "Truss Diagonal",
                    bot[i], top[i+1],
                    WEB["desig"], WEB["depth"], WEB["width"], WEB["mass"], grade))
            else:
                members.append(_member(
                    nxt(f"D{sfx}"), f"D{sfx}{i+1}", "Truss Diagonal",
                    bot[i+1], top[i],
                    WEB["desig"], WEB["depth"], WEB["width"], WEB["mass"], grade))

    # Floor beams (cross-beams at bottom chord panel points)
    for i in range(num_panels + 1):
        bl, br = _node(i * panel_w, 0, 0, f"BL{i}"), _node(i * panel_w, width, 0, f"BR{i}")
        members.append(_member(
            nxt("FB"), f"FB{i+1}", "Beam",
            bl, br,
            FLOOR["desig"], FLOOR["depth"], FLOOR["width"], FLOOR["mass"], grade))

    # Top lateral bracing
    for i in range(num_panels):
        tl0 = _node(i * panel_w, 0, depth, f"TL{i}")
        tl1 = _node((i + 1) * panel_w, 0, depth, f"TL{i+1}")
        tr0 = _node(i * panel_w, width, depth, f"TR{i}")
        tr1 = _node((i + 1) * panel_w, width, depth, f"TR{i+1}")
        
        # Diagonal 1
        members.append(_member(
            nxt("LB"), f"LB{i+1}A", "Bracing",
            tl0, tr1,
            BRACE["desig"], BRACE["depth"], BRACE["width"], BRACE["mass"], grade))
        # Diagonal 2
        members.append(_member(
            nxt("LB"), f"LB{i+1}B", "Bracing",
            tr0, tl1,
            BRACE["desig"], BRACE["depth"], BRACE["width"], BRACE["mass"], grade))

    return {"success": True, "members": members, "nodes": nodes,
            "metadata": {"type": "bridge", "span_m": span / 1000,
                         "width_m": width / 1000}}


# ---------------------------------------------------------------------------
# 4. LATTICE TOWER (Square cross-section, X-braced panels)
#    4 legs tapering from base_width to top_width as Z increases
#    Each panel: 4 leg segments + 8 diagonal braces + 4 horizontal ties
# ---------------------------------------------------------------------------

def generate_lattice_tower(total_height=30000, base_width=3000,
                            num_panels=6, grade="S355", **kwargs) -> Dict[str, Any]:
    members: List[Dict] = []
    nodes:   List[Dict] = []

    LEG   = {"desig": "150x150x12.5SHS", "depth": 150, "width": 150, "mass": 55.7}
    BRACE = {"desig": "100x100x8.0SHS",  "depth": 100, "width": 100, "mass": 23.6}
    TIE   = {"desig": "100x100x6.3SHS",  "depth": 100, "width": 100, "mass": 18.7}

    # Ensure SHS sections exist in DB or use RHS fallback handled by get_section_properties
    # Use RHS that we know exists
    LEG   = {"desig": "400x200x12.5RHS", "depth": 400, "width": 200, "mass": 111.0}
    BRACE = {"desig": "150x100x6.3RHS",  "depth": 150, "width": 100, "mass": 23.3}
    TIE   = {"desig": "150x100x6.3RHS",  "depth": 150, "width": 100, "mass": 23.3}

    panel_h = total_height / num_panels
    uid = [0]

    def nxt(p="M"):
        uid[0] += 1
        return f"{p}{uid[0]}"

    def panel_half_width(panel_idx: float) -> float:
        """Half-width of the tower at the given panel (tapers linearly)."""
        ratio = panel_idx / num_panels
        # Taper from base_width at ground to base_width/3 at top
        return (base_width / 2) * (1.0 - ratio * 0.65)

    # Leg positions at each panel level
    # Tower legs: NW, NE, SW, SE corners
    def leg_corner(panel_idx, corner):
        hw = panel_half_width(panel_idx)
        z = panel_idx * panel_h
        offsets = {"NW": (-hw, -hw), "NE": (hw, -hw),
                   "SE": (hw, hw),   "SW": (-hw, hw)}
        ox, oy = offsets[corner]
        return _node(ox + base_width / 2, oy + base_width / 2, z)

    corners = ["NW", "NE", "SE", "SW"]

    for pi in range(num_panels):
        # Bot and top ring of this panel
        bot = {c: leg_corner(pi, c)     for c in corners}
        top = {c: leg_corner(pi + 1, c) for c in corners}
        
        # Set explicit IDs for ring nodes
        for c in corners:
            bot[c]["id"] = f"P{pi}_{c}"
            top[c]["id"] = f"P{pi+1}_{c}"

        for pt_dict in list(bot.values()) + list(top.values()):
            nodes.append(pt_dict)

        # Leg segments
        for c in corners:
            members.append(_member(
                nxt("LG"), f"LG{pi+1}_{c}", "Lattice Tower Leg",
                bot[c], top[c],
                LEG["desig"], LEG["depth"], LEG["width"], LEG["mass"], grade))

        # Horizontal ties
        for i, c in enumerate(corners):
            nxt_c = corners[(i + 1) % 4]
            members.append(_member(
                nxt("TI"), f"TI{pi+1}_{c}_{nxt_c}", "Tie",
                bot[c], bot[nxt_c],
                TIE["desig"], TIE["depth"], TIE["width"], TIE["mass"], grade))

        # X-bracing
        faces = [("NW", "NE"), ("NE", "SE"), ("SE", "SW"), ("SW", "NW")]
        for c1, c2 in faces:
            members.append(_member(
                nxt("BR"), f"BR{pi+1}_{c1}A", "Bracing",
                bot[c1], top[c2],
                BRACE["desig"], BRACE["depth"], BRACE["width"], BRACE["mass"], grade))
            members.append(_member(
                nxt("BR"), f"BR{pi+1}_{c2}B", "Bracing",
                bot[c2], top[c1],
                BRACE["desig"], BRACE["depth"], BRACE["width"], BRACE["mass"], grade))

    return {"success": True, "members": members, "nodes": nodes,
            "metadata": {"type": "lattice_tower",
                         "height_m": total_height / 1000,
                         "num_panels": num_panels}}


# ---------------------------------------------------------------------------
# 5. NORTH LIGHT (SHED) TRUSS
#    Asymmetric truss: steep north face (glazing), shallow south face (opaque)
#    Standard industrial form used in UK factories
# ---------------------------------------------------------------------------

def generate_north_light(span=15000, depth=2500, num_panels=8,
                          grade="S355", **kwargs) -> Dict[str, Any]:
    members: List[Dict] = []
    nodes:   List[Dict] = []

    TC = {"desig": "200x120x8.0RHS", "depth": 200, "width": 120, "mass": 37.5}
    BC = {"desig": "200x120x8.0RHS", "depth": 200, "width": 120, "mass": 37.5}
    WB = {"desig": "150x100x6.3RHS", "depth": 150, "width": 100, "mass": 23.3}

    uid = [0]
    def nxt(p="M"):
        uid[0] += 1
        return f"{p}{uid[0]}"

    # North light: panels repeat a sawtooth unit
    # Each unit: shallow slope (3/4 of panel) + steep vertical north face (1/4)
    # We approximate with 2:1 asymmetry: 2 panels shallow + 1 panel steep
    panel_w = span / num_panels

    # Build sawtooth profile for top chord
    # Sawtooth period = every 2 panels: up 2500mm over 2 panels then drops back
    top_pts = []
    bot_pts = []

    for i in range(num_panels + 1):
        x = i * panel_w
        bot_pts.append(_node(x, 0, 0))
        # Sawtooth: mod pattern rising 2 panels + reset
        phase = i % 3  # period of 3 panels
        if phase == 0:
            z = 0
        elif phase == 1:
            z = depth * 0.5
        elif phase == 2:
            z = depth
        else:
            z = 0
        top_pts.append(_node(x, 0, z))

    # Clamp last node
    top_pts[-1] = _node(span, 0, 0)
    nodes = bot_pts + top_pts

    # Top chord
    for i in range(num_panels):
        members.append(_member(
            nxt("TC"), f"TC{i+1}", "Truss Chord",
            top_pts[i], top_pts[i + 1],
            TC["desig"], TC["depth"], TC["width"], TC["mass"], grade))

    # Bottom chord
    for i in range(num_panels):
        members.append(_member(
            nxt("BC"), f"BC{i+1}", "Truss Chord",
            bot_pts[i], bot_pts[i + 1],
            BC["desig"], BC["depth"], BC["width"], BC["mass"], grade))

    # Verticals
    for i in range(num_panels + 1):
        members.append(_member(
            nxt("V"), f"V{i}", "Truss Vertical",
            bot_pts[i], top_pts[i],
            WB["desig"], WB["depth"], WB["width"], WB["mass"], grade))

    # Diagonals
    for i in range(num_panels):
        members.append(_member(
            nxt("D"), f"D{i+1}", "Truss Diagonal",
            bot_pts[i], top_pts[i + 1],
            WB["desig"], WB["depth"], WB["width"], WB["mass"], grade))

    return {"success": True, "members": members, "nodes": nodes,
            "metadata": {"type": "north_light_truss",
                         "span_m": span / 1000}}


# ---------------------------------------------------------------------------
# 6. PLATE GIRDER FRAME (same topology as portal but with deeper sections)
# ---------------------------------------------------------------------------

def generate_plate_girder_frame(span=30000, eave_height=12000,
                                 ridge_height=14000, num_bays=1,
                                 bay_spacing=7500, grade="S355",
                                 **kwargs) -> Dict[str, Any]:
    """Heavy portal frame using deep plate girder sections."""
    COL = {"desig": "610x229x125UB", "depth": 612.2, "width": 229.0, "mass": 125.1}
    RAF = {"desig": "610x229x101UB", "depth": 602.6, "width": 227.6, "mass": 101.0}
    PUR = {"desig": "250x150x10.0RHS", "depth": 250, "width": 150, "mass": 58.3}

    # Use portal frame logic but with heavier sections
    result = generate_portal_frame(
        span=span, eave_height=eave_height, ridge_height=ridge_height,
        num_bays=num_bays, bay_spacing=bay_spacing, grade=grade)

    # Replace section details with plate girder sizes
    for m in result["members"]:
        mtype = m["member_type"]
        if mtype == "Column":
            m["section"] = {
                "designation": COL["desig"], "depth": COL["depth"],
                "width": COL["width"], "mass_per_meter": COL["mass"]}
        elif mtype == "Rafter":
            m["section"] = {
                "designation": RAF["desig"], "depth": RAF["depth"],
                "width": RAF["width"], "mass_per_meter": RAF["mass"]}
        elif mtype == "Purlin":
            m["section"] = {
                "designation": PUR["desig"], "depth": PUR["depth"],
                "width": PUR["width"], "mass_per_meter": PUR["mass"]}
        m["section"]["mass_per_meter"] = m["section"].get("mass_per_meter",
            m["section"].get("mass", 74.0))

    result["metadata"]["type"] = "plate_girder_frame"
    return result
