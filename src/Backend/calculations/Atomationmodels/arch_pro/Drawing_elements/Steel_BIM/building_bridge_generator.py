"""
building_bridge_generator.py

Generates residential house frames with truss roofs and truss bridges.
Focuses on connection detailing at supports and joints.
"""

from typing import List, Dict, Any, Optional
import uuid
import math

from typing import List, Dict, Any, Optional
import uuid
import math
from .geometry import Point3D, Line3D
from .member import Member, MemberType, EndCondition
from .section_properties import SectionProperties, get_section_properties
from .drawing_primitives import MemberVisualization

class BuildingBridgeGenerator:
    def __init__(self, mode: str = "house", span: float = 12000, spacing: float = 3000):
        self.mode = mode # "house" or "bridge"
        self.span = span
        self.spacing = spacing
        self.nodes: Dict[str, Point3D] = {}
        self.members: List[Member] = []
        self.additional_primitives = []

    def generate(self) -> Dict[str, Any]:
        if self.mode == "house":
            self._generate_house_with_trusses()
        elif self.mode == "bridge":
            self._generate_truss_bridge()
        
        return self._serialize()

    def _generate_house_with_trusses(self):
        depth = 8000
        height = 3000
        
        # Wall nodes (represented as primitives)
        for y in [0, depth]:
            for x in [0, self.span]:
                pt = Point3D(x, y, height)
                self.nodes[f"W_{x}_{y}"] = pt
                self.additional_primitives.append({
                    "type": "Foundation",
                    "position": pt.to_dict(),
                    "dimensions": {"width": 600, "length": 600, "depth": 600},
                    "label": "Pad Footing F1"
                })

        num_trusses = 5
        truss_spacing = depth / (num_trusses - 1)
        
        for i in range(num_trusses):
            y = i * truss_spacing
            self._generate_pitched_truss(y)

    def _generate_pitched_truss(self, y: float):
        truss_id = f"T_{int(y)}"
        h_apex = 1500
        
        p_left = Point3D(0, y, 3000)
        p_right = Point3D(self.span, y, 3000)
        p_apex = Point3D(self.span/2, y, 3000 + h_apex)
        
        self.nodes[f"{truss_id}_L"] = p_left
        self.nodes[f"{truss_id}_R"] = p_right
        self.nodes[f"{truss_id}_A"] = p_apex
        
        sec = get_section_properties("100x100x12EA")
        
        self.members.append(Member(centerline=Line3D(p_left, p_right), section=sec, member_type=MemberType.CHORD, mark=f"{truss_id}_BC"))
        self.members.append(Member(centerline=Line3D(p_left, p_apex), section=sec, member_type=MemberType.CHORD, mark=f"{truss_id}_TC1"))
        self.members.append(Member(centerline=Line3D(p_apex, p_right), section=sec, member_type=MemberType.CHORD, mark=f"{truss_id}_TC2"))
        
        self.additional_primitives.append({"type": "Gusset", "position": p_apex.to_dict(), "label": "Apex Gusset GA1"})
        self.additional_primitives.append({"type": "Cleat", "position": p_left.to_dict(), "label": "Bearing Cleat C1"})

    def _generate_truss_bridge(self):
        b_width = 3000
        t_height = 2500
        num_panels = 6
        panel_w = self.span / num_panels
        
        sec_main = get_section_properties("200x200x24EA")
        
        for side in [0, b_width]:
            prefix = "L" if side == 0 else "R"
            pts_b = []
            pts_t = []
            for i in range(num_panels + 1):
                pb = Point3D(i * panel_w, side, 0)
                pt = Point3D(i * panel_w, side, t_height)
                self.nodes[f"{prefix}B_{i}"] = pb
                self.nodes[f"{prefix}T_{i}"] = pt
                pts_b.append(pb)
                pts_t.append(pt)
            
            # Simple Chords for demonstration
            for i in range(num_panels):
                self.members.append(Member(Line3D(pts_b[i], pts_b[i+1]), sec_main, MemberType.CHORD, f"{prefix}BC{i}"))
                self.members.append(Member(Line3D(pts_t[i], pts_t[i+1]), sec_main, MemberType.CHORD, f"{prefix}TC{i}"))
                # Verticals
                self.members.append(Member(Line3D(pts_b[i], pts_t[i]), sec_main, MemberType.VERTICAL, f"{prefix}V{i}"))
        
        for x in [0, self.span]:
            for y in [0, b_width]:
                self.additional_primitives.append({
                    "type": "Bearing",
                    "position": {"x": x, "y": y, "z": 0},
                    "label": "Elastomeric Bearing EB1"
                })

    def _serialize(self) -> Dict[str, Any]:
        all_primitives = []
        for m in self.members:
            all_primitives.extend(MemberVisualization.member_to_3d_primitives(m))
        all_primitives.extend(self.additional_primitives)
        
        return {
            "nodes": [n.to_dict() for n in self.nodes.values()],
            "members": [m.to_dict() for m in self.members],
            "draw_3d": all_primitives,
            "metadata": {"type": self.mode}
        }

            # Members... (simplified for template demonstration)
            # This would use full Pratt logic
        
        # Connection detailing - Bridge Bearings
        for x in [0, self.span]:
            for y in [0, b_width]:
                self.primitives.append({
                    "type": "Bearing",
                    "position": {"x": x, "y": y, "z": 0},
                    "label": "Elastomeric Bearing EB1"
                })
