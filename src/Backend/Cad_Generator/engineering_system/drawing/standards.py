"""
CAD Drawing Standards, Layers, Line Weights, and Sheet Conventions.
Based on IStructE/Concrete Society Standard Method of Detailing Structural Concrete (Chapters 3 & 4).
"""

from typing import Dict, Any, Tuple


# Standard AutoCAD / DXF ACI Colors
# 1: Red, 2: Yellow, 3: Green, 4: Cyan, 5: Blue, 6: Magenta, 7: White/Black, 8: Dark Grey, 9: Light Grey

STANDARD_LAYERS: Dict[str, Dict[str, Any]] = {
    # Layer name: {color, lineweight_mm, linetype, description}
    "CONCRETE":       {"color": 4, "lineweight": 0.35, "linetype": "Continuous", "desc": "Concrete outline (plan, elev, sec)"},
    "OUTLINE":        {"color": 4, "lineweight": 0.35, "linetype": "Continuous", "desc": "Alias for CONCRETE"},
    "REBAR_MAIN":     {"color": 1, "lineweight": 0.70, "linetype": "Continuous", "desc": "Main reinforcing bars (tension/comp)"},
    "REBAR_TOP":      {"color": 1, "lineweight": 0.70, "linetype": "Continuous", "desc": "Top reinforcement"},
    "REBAR_BOT":      {"color": 3, "lineweight": 0.70, "linetype": "Continuous", "desc": "Bottom reinforcement"},
    "REBAR_LINKS":    {"color": 6, "lineweight": 0.35, "linetype": "Continuous", "desc": "Shear links / stirrups / ties"},
    "REBAR_STIRRUP":  {"color": 6, "lineweight": 0.35, "linetype": "Continuous", "desc": "Alias for REBAR_LINKS"},
    "REBAR_LACER":    {"color": 6, "lineweight": 0.35, "linetype": "Continuous", "desc": "Secondary / distribution / lacer bars"},
    "DIMENSIONS":     {"color": 2, "lineweight": 0.25, "linetype": "Continuous", "desc": "Dimension lines, witness lines, ticks"},
    "DIM":            {"color": 2, "lineweight": 0.25, "linetype": "Continuous", "desc": "Alias for DIMENSIONS"},
    "ANNOTATIONS":    {"color": 7, "lineweight": 0.25, "linetype": "Continuous", "desc": "Text, notes, bar marks, callouts"},
    "TEXT":           {"color": 7, "lineweight": 0.25, "linetype": "Continuous", "desc": "Alias for ANNOTATIONS"},
    "CENTRELINES":    {"color": 2, "lineweight": 0.25, "linetype": "DASHDOT",    "desc": "Gridlines and member centrelines"},
    "GRID":           {"color": 8, "lineweight": 0.25, "linetype": "DASHDOT",    "desc": "Alias for CENTRELINES"},
    "HIDDEN":         {"color": 8, "lineweight": 0.25, "linetype": "DASHED",     "desc": "Hidden detail / members behind cut"},
    "HATCH":          {"color": 8, "lineweight": 0.18, "linetype": "Continuous", "desc": "Concrete sectional hatch fill"},
    "BORDER_TITLE":   {"color": 7, "lineweight": 0.70, "linetype": "Continuous", "desc": "Drawing sheet border and title block"},
    "SECTION":        {"color": 6, "lineweight": 0.50, "linetype": "DASHDOT",    "desc": "Section cut indicators and markers"},
    "TENDON":         {"color": 1, "lineweight": 0.70, "linetype": "Continuous", "desc": "Prestressing tendons"},
    "DUCT":           {"color": 4, "lineweight": 0.35, "linetype": "Continuous", "desc": "Prestressing ducts"},
    "BURSTING":       {"color": 6, "lineweight": 0.35, "linetype": "Continuous", "desc": "Bursting / end-block reinforcement"},
    "FABRIC":         {"color": 3, "lineweight": 0.50, "linetype": "DASHDOT",    "desc": "Fabric mesh reinforcement on plan (chain double-dashed per §6.2.2)"},
}

RECOMMENDED_SCALES = {
    "GENERAL_ARRANGEMENT": 100,  # 1:100
    "SLAB_PLAN": 50,             # 1:50
    "BEAM_ELEVATION": 20,        # 1:20
    "BEAM_SECTION": 20,          # 1:20 (or 1:10)
    "COLUMN_ELEVATION": 20,      # 1:20
    "COLUMN_SECTION": 20,        # 1:20 (or 1:10)
    "DETAIL": 10,                # 1:10 (or 1:5)
    "CORBEL": 10,                # 1:10
}

STANDARD_TEXT_HEIGHTS_MM = {
    "TITLE": 5.0,
    "SUBTITLE": 3.5,
    "BAR_CALLOUT": 3.5,
    "DIMENSION": 2.5,
    "NOTE": 2.5,
}

SHEET_DIMENSIONS_MM: Dict[str, Tuple[float, float]] = {
    "A0": (1189.0, 841.0),
    "A1": (841.0, 594.0),
    "A2": (594.0, 420.0),
    "A3": (420.0, 297.0),
    "A4": (297.0, 210.0),
}
