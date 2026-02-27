"""
portal_frame_generator.py

Generates single and multi-bay steel portal frames with haunch detailing.
Per BS 5950 design requirements.
"""

from typing import List, Dict, Any, Optional
import numpy as np
import uuid
from .geometry import Point3D, Line3D
from .member import Member, MemberType, EndCondition
from .section_properties import SectionProperties, SectionType, get_section_properties
from .drawing_primitives import MemberVisualization

class PortalFrameGenerator:
    def __init__(self, span: float, eave_height: float, ridge_height: float, 
                 num_bays: int = 1, bay_spacing: float = 6000, 
                 grade: str = "S355"):
        self.span = span
        self.eave_height = eave_height
        self.ridge_height = ridge_height
        self.num_bays = num_bays
        self.bay_spacing = bay_spacing
        self.grade = grade
        # Use dicts for nodes if referenced by id, or just objects
        self.nodes: Dict[str, Point3D] = {}
        self.members: List[Member] = []
        self.additional_primitives = []

    def generate(self) -> Dict[str, Any]:
        """Generate the portal frame system."""
        for bay in range(self.num_bays + 1):
            y = bay * self.bay_spacing
            self._generate_frame(y)
            
        self._generate_longitudinals()
        
        return self._serialize()

    def _generate_frame(self, y: float):
        # Create Point3D objects
        p1 = Point3D(0, y, 0)
        p2 = Point3D(0, y, self.eave_height)
        p3 = Point3D(self.span / 2, y, self.ridge_height)
        p4 = Point3D(self.span, y, self.eave_height)
        p5 = Point3D(self.span, y, 0)
        
        # Store in dict for easy access
        f_prefix = f"F{int(y)}_"
        self.nodes[f"{f_prefix}1"] = p1
        self.nodes[f"{f_prefix}2"] = p2
        self.nodes[f"{f_prefix}3"] = p3
        self.nodes[f"{f_prefix}4"] = p4
        self.nodes[f"{f_prefix}5"] = p5
        
        # Sections
        col_sec = get_section_properties("406x178x74UB")
        raf_sec = get_section_properties("356x171x67UB")
        
        # Members
        self.members.append(Member(centerline=Line3D(p1, p2), section=col_sec, member_type=MemberType.COLUMN, mark=f"ColL_{y}", grade=self.grade))
        self.members.append(Member(centerline=Line3D(p2, p3), section=raf_sec, member_type=MemberType.RAFTER, mark=f"RafL_{y}", grade=self.grade))
        self.members.append(Member(centerline=Line3D(p3, p4), section=raf_sec, member_type=MemberType.RAFTER, mark=f"RafR_{y}", grade=self.grade))
        self.members.append(Member(centerline=Line3D(p4, p5), section=col_sec, member_type=MemberType.COLUMN, mark=f"ColR_{y}", grade=self.grade))

        # Add connection detailing primitives
        self._add_detailing(p1, p2, p3, p4, p5)

    def _add_detailing(self, p1, p2, p3, p4, p5):
        # Baseplates
        for pt in [p1, p5]:
            self.additional_primitives.append({
                "type": "Plate",
                "position": pt.to_dict(),
                "dimensions": {"width": 400, "length": 400, "thickness": 25},
                "label": "Baseplate BP1"
            })
        
        # Eave Haunches
        for pt in [p2, p4]:
            self.additional_primitives.append({
                "type": "Haunch",
                "position": pt.to_dict(),
                "length": 1200,
                "depth": 300,
                "label": "Eave Haunch EH1"
            })
            
        # Apex Haunch
        self.additional_primitives.append({
            "type": "Haunch",
            "position": p3.to_dict(),
            "length": 1000,
            "depth": 200,
            "label": "Apex Haunch AH1"
        })

    def _generate_longitudinals(self):
        # Implementation postponed
        pass

    def _serialize(self) -> Dict[str, Any]:
        """Convert to the standard BIMModel dict schema."""
        # 1. Standard member visualization primitives
        all_primitives = []
        for m in self.members:
            all_primitives.extend(MemberVisualization.member_to_3d_primitives(m))
        
        # 2. Add custom detailing primitives
        all_primitives.extend(self.additional_primitives)
        
        return {
            "nodes": [n.to_dict() for n in self.nodes.values()],
            "members": [m.to_dict() for m in self.members],
            "draw_3d": all_primitives,
            "metadata": {
                "type": "portal_frame",
                "span": self.span,
                "bays": self.num_bays
            }
        }
