"""
structural_steel_bim/systems/plate_girder_generator.py

Parametric generation of welded plate girders per BS 5950 and BS EN 1993.
Includes I-girders, box girders, and stiffened webs.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum
import numpy as np

from ..core.geometry import Point3D, Line3D


class GirderType(Enum):
    """Plate girder configurations."""
    I_GIRDER = "Welded I-Girder"
    BOX_GIRDER = "Welded Box Girder"
    CRANE_GIRDER = "Crane Runway Girder"


class WebStiffenerType(Enum):
    """Web stiffening configurations per BS EN 1993-1-5."""
    NO_STIFFENERS = "Unstiffened Web"
    TRANSVERSE_ONLY = "Transverse Stiffeners Only"
    LONGITUDINAL_ONLY = "Longitudinal Stiffeners Only"
    TRANSVERSE_AND_LONGITUDINAL = "Combined Stiffening"


@dataclass
class FlangePlate:
    """Flange plate definition for built-up girder."""
    width: float  # mm
    thickness: float  # mm
    grade: str = "S355"
    
    def area(self) -> float:
        """Cross-sectional area in mm²."""
        return self.width * self.thickness
    
    def mass_per_meter(self) -> float:
        """Mass per meter in kg/m."""
        area_m2 = self.area() / 1e6
        return area_m2 * 7850  # Steel density
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'width': self.width,
            'thickness': self.thickness,
            'grade': self.grade,
            'area_mm2': self.area(),
            'mass_per_meter': self.mass_per_meter()
        }


@dataclass
class WebPlate:
    """Web plate definition for built-up girder."""
    depth: float  # mm - clear depth between flanges
    thickness: float  # mm
    grade: str = "S355"
    
    def area(self) -> float:
        """Cross-sectional area in mm²."""
        return self.depth * self.thickness
    
    def mass_per_meter(self) -> float:
        """Mass per meter in kg/m."""
        area_m2 = self.area() / 1e6
        return area_m2 * 7850
    
    def slenderness_ratio(self) -> float:
        """Web slenderness d/t per BS EN 1993-1-5."""
        return self.depth / self.thickness
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'depth': self.depth,
            'thickness': self.thickness,
            'grade': self.grade,
            'area_mm2': self.area(),
            'mass_per_meter': self.mass_per_meter(),
            'slenderness': self.slenderness_ratio()
        }


@dataclass
class TransverseStiffener:
    """Transverse web stiffener per BS EN 1993-1-5."""
    width: float  # mm - projection from web face
    thickness: float  # mm
    location: float  # mm - distance from girder start
    double_sided: bool = True  # Stiffeners on both sides of web
    
    def area(self) -> float:
        """Total cross-sectional area in mm²."""
        single_area = self.width * self.thickness
        return single_area * 2 if self.double_sided else single_area
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'width': self.width,
            'thickness': self.thickness,
            'location': self.location,
            'double_sided': self.double_sided,
            'area_mm2': self.area()
        }


@dataclass
class LongitudinalStiffener:
    """Longitudinal web stiffener per BS EN 1993-1-5."""
    width: float  # mm
    thickness: float  # mm
    location_from_compression_flange: float  # mm
    
    def area(self) -> float:
        return self.width * self.thickness
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'width': self.width,
            'thickness': self.thickness,
            'location': self.location_from_compression_flange,
            'area_mm2': self.area()
        }


@dataclass
class PlateGirderParameters:
    """Complete definition of welded plate girder."""
    girder_type: GirderType
    span: float  # mm
    
    # Top flange
    top_flange: FlangePlate
    
    # Bottom flange (can be different from top)
    bottom_flange: FlangePlate
    
    # Web
    web: WebPlate
    
    # Stiffening
    stiffener_type: WebStiffenerType = WebStiffenerType.TRANSVERSE_ONLY
    transverse_stiffeners: List[TransverseStiffener] = field(default_factory=list)
    longitudinal_stiffeners: List[LongitudinalStiffener] = field(default_factory=list)
    
    # Bearing stiffeners at supports
    bearing_stiffener_thickness: float = 0.0  # mm
    bearing_stiffener_width: float = 0.0  # mm
    
    # Intermediate load positions (for stiffener placement)
    load_positions: List[float] = field(default_factory=list)  # mm from start
    
    # Camber
    camber: float = 0.0  # mm - upward deflection at center
    
    # Haunching (for non-prismatic sections)
    haunch_start: float = 0.0  # mm from support
    haunch_depth_ratio: float = 1.0  # Ratio of depth at haunch to uniform depth
    
    def overall_depth(self) -> float:
        """Total girder depth in mm."""
        return (self.top_flange.thickness + 
                self.web.depth + 
                self.bottom_flange.thickness)
    
    def calculate_second_moment_area(self) -> float:
        """
        Calculate second moment of area about major axis (Iyy) in mm⁴.
        Simplified calculation assuming straight web.
        """
        D = self.overall_depth()
        
        # Top flange contribution
        y_top = D / 2 - self.top_flange.thickness / 2
        I_top_own = (self.top_flange.width * self.top_flange.thickness**3) / 12
        I_top = I_top_own + self.top_flange.area() * y_top**2
        
        # Web contribution
        I_web = (self.web.thickness * self.web.depth**3) / 12
        
        # Bottom flange contribution
        y_bot = D / 2 - self.bottom_flange.thickness / 2
        I_bot_own = (self.bottom_flange.width * self.bottom_flange.thickness**3) / 12
        I_bot = I_bot_own + self.bottom_flange.area() * y_bot**2
        
        return I_top + I_web + I_bot


class PlateGirderGenerator:
    """Generate parametric plate girder systems."""
    
    def __init__(self, params: PlateGirderParameters):
        self.params = params
    
    def generate(self) -> Dict[str, Any]:
        """Generate complete plate girder definition."""
        
        # Generate girder geometry
        centerline_start = Point3D(0, 0, 0)
        centerline_end = Point3D(self.params.span, 0, 0)
        
        # Calculate properties
        total_mass = self._calculate_total_mass()
        section_properties = self._calculate_section_properties()
        
        # Generate stiffener positions if automatic spacing required
        if self.params.stiffener_type in [WebStiffenerType.TRANSVERSE_ONLY, 
                                         WebStiffenerType.TRANSVERSE_AND_LONGITUDINAL]:
            if not self.params.transverse_stiffeners:
                self._generate_transverse_stiffeners()
        
        return {
            'system_type': 'plate_girder',
            'girder_type': self.params.girder_type.value,
            'geometry': {
                'span': self.params.span,
                'overall_depth': self.params.overall_depth(),
                'camber': self.params.camber,
                'centerline_start': centerline_start.to_dict(),
                'centerline_end': centerline_end.to_dict()
            },
            'top_flange': self.params.top_flange.to_dict(),
            'bottom_flange': self.params.bottom_flange.to_dict(),
            'web': self.params.web.to_dict(),
            'stiffener_type': self.params.stiffener_type.value,
            'transverse_stiffeners': [s.to_dict() for s in self.params.transverse_stiffeners],
            'longitudinal_stiffeners': [s.to_dict() for s in self.params.longitudinal_stiffeners],
            'section_properties': section_properties,
            'total_mass_kg': total_mass,
            'mass_per_meter_kg': total_mass / (self.params.span / 1000.0)
        }
    
    def _calculate_total_mass(self) -> float:
        """Calculate total girder mass in kg."""
        length_m = self.params.span / 1000.0
        
        # Flange and web mass
        main_mass = (self.params.top_flange.mass_per_meter() +
                     self.params.bottom_flange.mass_per_meter() +
                     self.params.web.mass_per_meter()) * length_m
        
        # Transverse stiffener mass
        stiffener_mass = 0.0
        for stiff in self.params.transverse_stiffeners:
            # Stiffener runs full depth of web
            stiff_length_m = self.params.web.depth / 1000.0
            stiff_area_m2 = stiff.area() / 1e6
            stiffener_mass += stiff_area_m2 * stiff_length_m * 7850
        
        # Longitudinal stiffener mass
        long_stiff_mass = 0.0
        for lstiff in self.params.longitudinal_stiffeners:
            lstiff_area_m2 = lstiff.area() / 1e6
            long_stiff_mass += lstiff_area_m2 * length_m * 7850
        
        return main_mass + stiffener_mass + long_stiff_mass
    
    def _calculate_section_properties(self) -> Dict[str, float]:
        """Calculate key section properties."""
        D = self.params.overall_depth()
        Iyy = self.params.calculate_second_moment_area()
        
        # Section modulus (elastic)
        Wyy_top = Iyy / (D / 2)
        Wyy_bot = Wyy_top  # Assuming symmetric about neutral axis for simplicity
        
        # Total area
        total_area = (self.params.top_flange.area() +
                     self.params.web.area() +
                     self.params.bottom_flange.area())
        
        # Radius of gyration
        iyy = np.sqrt(Iyy / total_area) if total_area > 0 else 0
        
        return {
            'overall_depth_mm': D,
            'total_area_mm2': total_area,
            'second_moment_area_mm4': Iyy,
            'elastic_modulus_mm3': Wyy_top,
            'radius_of_gyration_mm': iyy,
            'web_slenderness': self.params.web.slenderness_ratio()
        }
    
    def _generate_transverse_stiffeners(self):
        """
        Generate transverse stiffener positions based on web shear panels.
        Per BS EN 1993-1-5, stiffener spacing typically a ≤ 1.5d for unstiffened webs.
        """
        # Maximum stiffener spacing based on web depth
        max_spacing = 1.5 * self.params.web.depth
        
        # Number of panels required
        num_panels = int(np.ceil(self.params.span / max_spacing))
        actual_spacing = self.params.span / num_panels
        
        # Stiffener dimensions (typical proportions)
        stiff_width = min(200.0, self.params.web.depth / 3)  # mm
        stiff_thickness = max(10.0, self.params.web.thickness + 2.0)  # mm
        
        # Generate stiffeners at panel points (excluding ends which have bearing stiffeners)
        for i in range(1, num_panels):
            location = i * actual_spacing
            
            # Skip if load point exists nearby (within 100mm)
            if any(abs(location - load_pos) < 100 for load_pos in self.params.load_positions):
                location = min(self.params.load_positions, 
                             key=lambda x: abs(x - location))
            
            stiffener = TransverseStiffener(
                width=stiff_width,
                thickness=stiff_thickness,
                location=location,
                double_sided=True
            )
            self.params.transverse_stiffeners.append(stiffener)
        
        # Add stiffeners at load positions
        for load_pos in self.params.load_positions:
            # Check if stiffener already exists at this location
            if not any(abs(s.location - load_pos) < 50 for s in self.params.transverse_stiffeners):
                stiffener = TransverseStiffener(
                    width=stiff_width * 1.5,  # Heavier at load points
                    thickness=stiff_thickness + 2.0,
                    location=load_pos,
                    double_sided=True
                )
                self.params.transverse_stiffeners.append(stiffener)
        
        # Sort stiffeners by location
        self.params.transverse_stiffeners.sort(key=lambda s: s.location)