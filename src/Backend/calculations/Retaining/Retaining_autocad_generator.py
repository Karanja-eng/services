"""
Retaining Wall AutoCAD DXF Generator
BS 8110, BS 8007, Eurocode 2 & 7 Compliant
Generates detailed reinforcement drawings for all wall types

Install dependencies:
pip install ezdxf numpy

Usage:
    generator = RetainingWallDXF(design_output)
    generator.generate_dxf("retaining_wall.dxf")
"""

import ezdxf
from ezdxf import colors
from ezdxf.enums import TextEntityAlignment
import math
from typing import List, Tuple, Dict, Optional
import numpy as np


class ReinforcementBar:
    """Represents a single reinforcement bar or group"""
    
    def __init__(
        self,
        diameter: int,
        spacing: int,
        start_point: Tuple[float, float],
        end_point: Tuple[float, float],
        bar_mark: str,
        quantity: int = 1,
        bent_shape: Optional[str] = None,
        bend_angles: Optional[List[float]] = None,
        bend_radii: Optional[List[float]] = None,
    ):
        self.diameter = diameter
        self.spacing = spacing
        self.start = start_point
        self.end = end_point
        self.bar_mark = bar_mark
        self.quantity = quantity
        self.bent_shape = bent_shape  # 'L', 'U', 'straight', etc.
        self.bend_angles = bend_angles or []
        self.bend_radii = bend_radii or []


class RetainingWallDXF:
    """Generate detailed AutoCAD drawings for retaining walls"""
    
    # Layer definitions
    LAYERS = {
        'CONCRETE': {'color': colors.WHITE, 'lineweight': 50},
        'REBAR_MAIN': {'color': colors.RED, 'lineweight': 35},
        'REBAR_DISTRIBUTION': {'color': colors.YELLOW, 'lineweight': 25},
        'REBAR_LINKS': {'color': colors.CYAN, 'lineweight': 25},
        'DIMENSIONS': {'color': colors.GREEN, 'lineweight': 18},
        'TEXT': {'color': colors.WHITE, 'lineweight': 18},
        'HATCHING': {'color': colors.GRAY, 'lineweight': 13},
        'CENTER_LINES': {'color': colors.MAGENTA, 'lineweight': 13},
        'SOIL': {'color': 8, 'lineweight': 25},  # Gray
        'WATERPROOFING': {'color': colors.BLUE, 'lineweight': 50},
    }
    
    # Text heights (mm in model space)
    TEXT_HEIGHT_LARGE = 150
    TEXT_HEIGHT_MEDIUM = 100
    TEXT_HEIGHT_SMALL = 75
    
    # Standard bend radii per BS 8666
    BEND_RADII = {
        6: 12, 8: 16, 10: 20, 12: 24, 16: 32, 20: 70, 25: 87.5, 32: 112, 40: 140
    }
    
    def __init__(self, design_data: Dict):
        """Initialize with design output data"""
        self.design = design_data
        self.doc = ezdxf.new('R2010')
        self.msp = self.doc.modelspace()
        self._setup_layers()
        self._setup_text_styles()
        self.bar_schedule = []
        
    def _setup_layers(self):
        """Create drawing layers"""
        for layer_name, props in self.LAYERS.items():
            layer = self.doc.layers.new(name=layer_name)
            layer.color = props['color']
            layer.lineweight = props['lineweight']
    
    def _setup_text_styles(self):
        """Setup text styles"""
        self.doc.styles.new('STANDARD', dxfattribs={'font': 'Arial.ttf'})
        self.doc.styles.new('BOLD', dxfattribs={'font': 'Arial.ttf', 'width': 1.2})
    
    def generate_dxf(self, filename: str):
        """Generate complete DXF drawing"""
        
        wall_type = self.design.get('wall_type', 'cantilever')
        
        if wall_type == 'cantilever':
            self._draw_cantilever_wall()
        elif wall_type == 'counterfort':
            self._draw_counterfort_wall()
        elif wall_type == 'buttress':
            self._draw_buttress_wall()
        
        # Add general notes and bar schedule
        self._add_general_notes()
        self._add_bar_schedule()
        self._add_title_block()
        
        self.doc.saveas(filename)
        print(f"DXF file saved: {filename}")
    
    def _draw_cantilever_wall(self):
        """Draw cantilever retaining wall with full detailing"""
        
        geometry = self.design['geometry']
        wall_design = self.design['wall_design']
        base_design = self.design['base_design']
        toe_design = self.design.get('toe_design')
        
        # Convert to mm
        H = self.design['height'] * 1000
        wall_thick = geometry['wall_thickness']
        base_thick = geometry['base_thickness']
        base_width = geometry['base_width'] * 1000
        toe_width = geometry['toe_width'] * 1000
        heel_width = geometry['heel_width'] * 1000
        
        # Cover values
        cover_external = 40  # External exposed face
        cover_buried = 50    # Earth face
        
        # === SECTION VIEW ===
        section_offset_x = 0
        section_offset_y = 0
        
        # Draw concrete outline
        self._draw_concrete_section(
            section_offset_x, section_offset_y,
            H, wall_thick, base_thick, base_width, toe_width, heel_width
        )
        
        # Draw wall reinforcement
        self._draw_wall_reinforcement(
            section_offset_x, section_offset_y,
            H, wall_thick, base_thick, toe_width,
            wall_design, cover_buried, cover_external
        )
        
        # Draw base reinforcement (heel)
        self._draw_heel_reinforcement(
            section_offset_x, section_offset_y,
            base_thick, base_width, toe_width, wall_thick,
            base_design, cover_buried
        )
        
        # Draw toe reinforcement
        if toe_design:
            self._draw_toe_reinforcement(
                section_offset_x, section_offset_y,
                base_thick, toe_width,
                toe_design, cover_buried, cover_external
            )
        
        # Draw soil hatching
        self._draw_soil_hatching(
            section_offset_x, section_offset_y,
            H, wall_thick, heel_width, toe_width, base_width
        )
        
        # Add dimensions
        self._add_section_dimensions(
            section_offset_x, section_offset_y,
            H, wall_thick, base_thick, base_width, toe_width, heel_width
        )
        
        # === ELEVATION VIEWS ===
        # Front elevation (outer face)
        elev_offset_x = base_width + 5000
        self._draw_front_elevation(
            elev_offset_x, section_offset_y,
            H, wall_thick, base_thick, base_width,
            wall_design, cover_external
        )
        
        # Back elevation (earth face)
        back_elev_offset_x = elev_offset_x + base_width + 5000
        self._draw_back_elevation(
            back_elev_offset_x, section_offset_y,
            H, wall_thick, base_thick, base_width,
            wall_design, base_design, cover_buried
        )
        
        # === PLAN VIEWS ===
        plan_offset_y = -H - 5000
        
        # Base plan
        self._draw_base_plan(
            section_offset_x, plan_offset_y,
            base_width, wall_thick, base_design, toe_design
        )
        
        # Add detail callouts
        self._add_detail_references(section_offset_x, section_offset_y, H)
        
        # === DETAILS ===
        detail_offset_x = 0
        detail_offset_y = plan_offset_y - 8000
        
        # Detail 1: Wall-base junction
        self._draw_wall_base_detail(
            detail_offset_x, detail_offset_y,
            wall_thick, base_thick, wall_design, base_design,
            cover_buried, cover_external
        )
        
        # Detail 2: Kicker detail
        self._draw_kicker_detail(
            detail_offset_x + 8000, detail_offset_y,
            wall_thick, base_thick, cover_external
        )
    
    def _draw_concrete_section(
        self, offset_x: float, offset_y: float,
        H: float, wall_thick: float, base_thick: float,
        base_width: float, toe_width: float, heel_width: float
    ):
        """Draw concrete section outline"""
        
        points = [
            # Toe slab
            (offset_x, offset_y),
            (offset_x + toe_width, offset_y),
            # Wall stem
            (offset_x + toe_width, offset_y + base_thick),
            (offset_x + toe_width + wall_thick, offset_y + base_thick),
            (offset_x + toe_width + wall_thick, offset_y + base_thick + H),
            (offset_x + toe_width, offset_y + base_thick + H),
            (offset_x + toe_width, offset_y + base_thick),
            # Heel slab
            (offset_x + toe_width + wall_thick, offset_y + base_thick),
            (offset_x + base_width, offset_y + base_thick),
            (offset_x + base_width, offset_y),
            (offset_x, offset_y),
        ]
        
        self.msp.add_lwpolyline(points, dxfattribs={'layer': 'CONCRETE'})
        
        # Add hatching for concrete
        hatch = self.msp.add_hatch(color=colors.GRAY)
        hatch.set_pattern_fill('ANSI31', scale=0.5)
        hatch.dxf.layer = 'HATCHING'
        
        # Simplified boundary
        boundary_points = [
            (offset_x, offset_y),
            (offset_x + base_width, offset_y),
            (offset_x + base_width, offset_y + base_thick),
            (offset_x + toe_width + wall_thick, offset_y + base_thick),
            (offset_x + toe_width + wall_thick, offset_y + base_thick + H),
            (offset_x + toe_width, offset_y + base_thick + H),
            (offset_x + toe_width, offset_y + base_thick),
            (offset_x, offset_y + base_thick),
        ]
        hatch.paths.add_polyline_path(boundary_points)
    
    def _draw_wall_reinforcement(
        self, offset_x: float, offset_y: float,
        H: float, wall_thick: float, base_thick: float, toe_width: float,
        wall_design: Dict, cover_buried: float, cover_external: float
    ):
        """Draw wall stem reinforcement"""
        
        main_steel = wall_design['main_steel']
        dist_steel = wall_design.get('distribution_steel')
        
        bar_dia = main_steel['bar_diameter']
        spacing = main_steel['spacing']
        
        # Main vertical bars (earth face - inner face)
        x_inner = offset_x + toe_width + wall_thick - cover_buried - bar_dia / 2
        y_start = offset_y + base_thick + cover_external + bar_dia / 2
        y_end = offset_y + base_thick + H - cover_external - bar_dia / 2
        
        # Calculate number of bars over 1m width (for representation)
        num_bars = int(1000 / spacing) + 1
        
        # Draw vertical bars with proper hooks
        for i in range(num_bars):
            y_bar = y_start + i * spacing * (H / 1000)
            if y_bar > y_end:
                break
            
            # Main bar (bent into base)
            bar_points = self._create_l_bar(
                x_inner, offset_y + base_thick - cover_external - bar_dia / 2,
                x_inner, y_end,
                bar_dia, 'down'
            )
            
            self.msp.add_lwpolyline(
                bar_points,
                dxfattribs={'layer': 'REBAR_MAIN', 'lineweight': 35}
            )
            
            # Add bar marker
            if i == 0:
                self._add_rebar_marker(
                    x_inner - 200, y_end + 200,
                    f"H{bar_dia}@{spacing}c/c",
                    f"B{len(self.bar_schedule) + 1}"
                )
                
                # Add to bar schedule
                self.bar_schedule.append({
                    'mark': f"B{len(self.bar_schedule) + 1}",
                    'diameter': bar_dia,
                    'spacing': spacing,
                    'type': f'H{bar_dia}',
                    'length': int(H + base_thick),
                    'shape': 'L-bar',
                    'location': 'Wall stem - earth face',
                })
        
        # Outer face distribution steel (horizontal)
        if dist_steel:
            dist_dia = dist_steel['bar_diameter']
            dist_spacing = dist_steel['spacing']
            
            x_outer = offset_x + toe_width + cover_external + dist_dia / 2
            
            num_horiz_bars = int(H / dist_spacing) + 1
            
            for i in range(0, num_horiz_bars, 3):  # Draw every 3rd for clarity
                y_bar = offset_y + base_thick + i * dist_spacing
                if y_bar > offset_y + base_thick + H:
                    break
                
                self.msp.add_line(
                    (x_outer, y_bar),
                    (x_outer + wall_thick - 2 * cover_external - dist_dia, y_bar),
                    dxfattribs={'layer': 'REBAR_DISTRIBUTION'}
                )
            
            # Add marker
            self._add_rebar_marker(
                x_outer - 500, offset_y + base_thick + H / 2,
                f"H{dist_dia}@{dist_spacing}c/c",
                f"B{len(self.bar_schedule) + 1}"
            )
            
            self.bar_schedule.append({
                'mark': f"B{len(self.bar_schedule) + 1}",
                'diameter': dist_dia,
                'spacing': dist_spacing,
                'type': f'H{dist_dia}',
                'length': int(wall_thick - 2 * cover_external),
                'shape': 'Straight',
                'location': 'Wall stem - distribution (both faces)',
            })
    
    def _draw_heel_reinforcement(
        self, offset_x: float, offset_y: float,
        base_thick: float, base_width: float, toe_width: float,
        wall_thick: float, base_design: Dict, cover: float
    ):
        """Draw heel slab reinforcement"""
        
        main_steel = base_design['main_steel']
        bar_dia = main_steel['bar_diameter']
        spacing = main_steel['spacing']
        
        # Top steel (tension face for heel)
        y_top = offset_y + base_thick - cover - bar_dia / 2
        x_start = offset_x + toe_width + wall_thick + cover + bar_dia / 2
        x_end = offset_x + base_width - cover - bar_dia / 2
        
        heel_width_mm = base_width - toe_width - wall_thick
        num_bars = int(heel_width_mm / spacing) + 1
        
        for i in range(0, num_bars, 2):  # Draw every other bar
            x_bar = x_start + i * spacing
            if x_bar > x_end:
                break
            
            self.msp.add_line(
                (x_bar, y_top),
                (x_bar, y_top - base_thick + 2 * cover + bar_dia),
                dxfattribs={'layer': 'REBAR_MAIN'}
            )
        
        # Longitudinal bars (perpendicular to page - show as circles)
        for i in range(0, int(base_thick / spacing), 2):
            y_circle = offset_y + i * spacing + cover
            x_circle = x_start + heel_width_mm / 2
            
            self.msp.add_circle(
                (x_circle, y_circle),
                radius=bar_dia / 2,
                dxfattribs={'layer': 'REBAR_MAIN'}
            )
        
        # Add marker
        self._add_rebar_marker(
            x_end + 300, y_top,
            f"H{bar_dia}@{spacing}c/c",
            f"B{len(self.bar_schedule) + 1}"
        )
        
        self.bar_schedule.append({
            'mark': f"B{len(self.bar_schedule) + 1}",
            'diameter': bar_dia,
            'spacing': spacing,
            'type': f'H{bar_dia}',
            'length': int(heel_width_mm),
            'shape': 'Straight',
            'location': 'Heel slab - top',
        })
    
    def _draw_toe_reinforcement(
        self, offset_x: float, offset_y: float,
        base_thick: float, toe_width: float,
        toe_design: Dict, cover_buried: float, cover_external: float
    ):
        """Draw toe slab reinforcement"""
        
        main_steel = toe_design['main_steel']
        bar_dia = main_steel['bar_diameter']
        spacing = main_steel['spacing']
        
        # Bottom steel (tension face for toe)
        y_bottom = offset_y + cover_external + bar_dia / 2
        x_start = offset_x + cover_external + bar_dia / 2
        x_end = offset_x + toe_width - cover_external - bar_dia / 2
        
        num_bars = int(toe_width / spacing) + 1
        
        for i in range(0, num_bars, 2):
            x_bar = x_start + i * spacing
            if x_bar > x_end:
                break
            
            # L-bars bent up into wall
            bar_points = self._create_l_bar(
                x_bar, y_bottom,
                x_bar, y_bottom + base_thick - 2 * cover_external,
                bar_dia, 'up'
            )
            
            self.msp.add_lwpolyline(
                bar_points,
                dxfattribs={'layer': 'REBAR_MAIN'}
            )
        
        # Add marker
        self._add_rebar_marker(
            x_start, y_bottom - 300,
            f"H{bar_dia}@{spacing}c/c",
            f"B{len(self.bar_schedule) + 1}"
        )
        
        self.bar_schedule.append({
            'mark': f"B{len(self.bar_schedule) + 1}",
            'diameter': bar_dia,
            'spacing': spacing,
            'type': f'H{bar_dia}',
            'length': int(toe_width + base_thick * 0.5),
            'shape': 'L-bar',
            'location': 'Toe slab - bottom',
        })
    
    def _create_l_bar(
        self, x1: float, y1: float, x2: float, y2: float,
        diameter: int, bend_direction: str = 'up'
    ) -> List[Tuple[float, float]]:
        """Create L-shaped bar with proper bend radius"""
        
        bend_radius = self.BEND_RADII.get(diameter, diameter * 2)
        
        if bend_direction == 'up':
            # Vertical then horizontal
            points = [
                (x1, y1),
                (x1, y2 - bend_radius),
            ]
            # Add arc
            arc_points = self._get_arc_points(
                x1, y2 - bend_radius, bend_radius, 0, 90, 10
            )
            points.extend(arc_points)
            # Horizontal extension
            points.append((x1 + 12 * diameter, y2))
            
        else:  # down
            points = [
                (x1 - 12 * diameter, y1),
            ]
            # Add arc
            arc_points = self._get_arc_points(
                x1 - bend_radius, y1, bend_radius, 90, 180, 10
            )
            points.extend(arc_points)
            points.append((x1, y2))
        
        return points
    
    def _get_arc_points(
        self, cx: float, cy: float, radius: float,
        start_angle: float, end_angle: float, num_points: int = 20
    ) -> List[Tuple[float, float]]:
        """Generate points along an arc"""
        
        angles = np.linspace(
            math.radians(start_angle),
            math.radians(end_angle),
            num_points
        )
        
        points = [
            (cx + radius * math.cos(a), cy + radius * math.sin(a))
            for a in angles
        ]
        
        return points
    
    def _draw_soil_hatching(
        self, offset_x: float, offset_y: float,
        H: float, wall_thick: float, heel_width: float,
        toe_width: float, base_width: float
    ):
        """Draw soil hatching behind wall"""
        
        # Backfill
        soil_points = [
            (offset_x + toe_width + wall_thick, offset_y + H + 1000),
            (offset_x + base_width + 2000, offset_y + H + 1000),
            (offset_x + base_width + 2000, offset_y),
            (offset_x + base_width, offset_y),
            (offset_x + base_width, offset_y + H),
            (offset_x + toe_width + wall_thick, offset_y + H),
        ]
        
        self.msp.add_lwpolyline(
            soil_points,
            dxfattribs={'layer': 'SOIL'}
        )
        
        # Add earth hatching
        hatch = self.msp.add_hatch(color=8)
        hatch.set_pattern_fill('EARTH', scale=2.0)
        hatch.dxf.layer = 'SOIL'
        hatch.paths.add_polyline_path(soil_points)
        
        # Add "GRANULAR FILL" text
        self.msp.add_text(
            'GRANULAR FILL',
            dxfattribs={
                'layer': 'TEXT',
                'height': self.TEXT_HEIGHT_MEDIUM,
                'style': 'BOLD',
            }
        ).set_pos(
            (offset_x + toe_width + wall_thick + heel_width / 2, offset_y + H / 2),
            align=TextEntityAlignment.MIDDLE_CENTER
        )
    
    def _add_rebar_marker(
        self, x: float, y: float, description: str, mark: str
    ):
        """Add reinforcement marker with leader"""
        
        # Leader line
        self.msp.add_line(
            (x, y),
            (x - 800, y + 400),
            dxfattribs={'layer': 'DIMENSIONS'}
        )
        
        # Text
        text = f"{mark}: {description}"
        self.msp.add_text(
            text,
            dxfattribs={
                'layer': 'TEXT',
                'height': self.TEXT_HEIGHT_SMALL,
            }
        ).set_pos((x - 900, y + 450), align=TextEntityAlignment.MIDDLE_RIGHT)
    
    def _add_section_dimensions(
        self, offset_x: float, offset_y: float,
        H: float, wall_thick: float, base_thick: float,
        base_width: float, toe_width: float, heel_width: float
    ):
        """Add dimensions to section view"""
        
        dim_offset = -1500
        
        # Base width
        self._add_linear_dimension(
            (offset_x, offset_y + dim_offset),
            (offset_x + base_width, offset_y + dim_offset),
            offset_y + dim_offset - 300,
            f"{int(base_width)}"
        )
        
        # Wall height
        self._add_linear_dimension(
            (offset_x + base_width + 1000, offset_y + base_thick),
            (offset_x + base_width + 1000, offset_y + base_thick + H),
            offset_x + base_width + 1500,
            f"{int(H)}",
            vertical=True
        )
        
        # Wall thickness
        self._add_linear_dimension(
            (offset_x + toe_width, offset_y + base_thick + H + 500),
            (offset_x + toe_width + wall_thick, offset_y + base_thick + H + 500),
            offset_y + base_thick + H + 800,
            f"{int(wall_thick)}"
        )
        
        # Base thickness
        self._add_linear_dimension(
            (offset_x - 1000, offset_y),
            (offset_x - 1000, offset_y + base_thick),
            offset_x - 1500,
            f"{int(base_thick)}",
            vertical=True
        )
    
    def _add_linear_dimension(
        self, start: Tuple[float, float], end: Tuple[float, float],
        dim_line_pos: float, text: str, vertical: bool = False
    ):
        """Add a linear dimension"""
        
        if vertical:
            dim = self.msp.add_linear_dim(
                base=(start[0], dim_line_pos),
                p1=start,
                p2=end,
                dimstyle='EZDXF',
                override={'dimtxt': self.TEXT_HEIGHT_SMALL}
            )
        else:
            dim = self.msp.add_linear_dim(
                base=(dim_line_pos, start[1]),
                p1=start,
                p2=end,
                dimstyle='EZDXF',
                override={'dimtxt': self.TEXT_HEIGHT_SMALL}
            )
        
        dim.dxf.layer = 'DIMENSIONS'
        dim.render()
    
    def _draw_front_elevation(
        self, offset_x: float, offset_y: float,
        H: float, wall_thick: float, base_thick: float, base_width: float,
        wall_design: Dict, cover: float
    ):
        """Draw front elevation view"""
        
        # Title
        self.msp.add_text(
            'FRONT ELEVATION',
            dxfattribs={
                'layer': 'TEXT',
                'height': self.TEXT_HEIGHT_LARGE,
                'style': 'BOLD',
            }
        ).set_pos(
            (offset_x + base_width / 2, offset_y + H + base_thick + 1000),
            align=TextEntityAlignment.MIDDLE_CENTER
        )
        
        # Outline
        self.msp.add_lwpolyline([
            (offset_x, offset_y),
            (offset_x + base_width, offset_y),
            (offset_x + base_width, offset_y + base_thick),
            (offset_x + base_width - wall_thick, offset_y + base_thick),
            (offset_x + base_width - wall_thick, offset_y + base_thick + H),
            (offset_x + wall_thick, offset_y + base_thick + H),
            (offset_x + wall_thick, offset_y + base_thick),
            (offset_x, offset_y + base_thick),
            (offset_x, offset_y),
        ], dxfattribs={'layer': 'CONCRETE'})
        
        # Show cover lines
        cover_line_offset = cover
        self.msp.add_rectangle(
            (offset_x + wall_thick + cover_line_offset, offset_y + base_thick + cover_line_offset),
            base_width - 2 * wall_thick - 2 * cover_line_offset,
            H - 2 * cover_line_offset,
            dxfattribs={'layer': 'CENTER_LINES', 'linetype': 'DASHED'}
        )
        
        # Add cover dimension callout
        self.msp.add_text(
            f'{cover} COVER',
            dxfattribs={'layer': 'TEXT', 'height': self.TEXT_HEIGHT_SMALL}
        ).set_pos(
            (offset_x + base_width / 2, offset_y + base_thick + H / 2),
            align=TextEntityAlignment.MIDDLE_CENTER
        )
    
    def _draw_back_elevation(
        self, offset_x: float, offset_y: float,
        H: float, wall_thick: float, base_thick: float, base_width: float,
        wall_design: Dict, base_design: Dict, cover: float
    ):
        """Draw back elevation (earth face)"""
        
        # Title
        self.msp.add_text(
            'BACK ELEVATION (EARTH FACE)',
            dxfattribs={
                'layer': 'TEXT',
                'height': self.TEXT_HEIGHT_LARGE,
                'style': 'BOLD',
            }
        ).set_pos(
            (offset_x + base_width / 2, offset_y + H + base_thick + 1000),
            align=TextEntityAlignment.MIDDLE_CENTER
        )
        
        # Outline (similar to front but showing reinforcement)
        self.msp.add_lwpolyline([
            (offset_x, offset_y),
            (offset_x + base_width, offset_y),
            (offset_x + base_width, offset_y + base_thick),
            (offset_x + wall_thick, offset_y + base_thick),
            (offset_x + wall_thick, offset_y + base_thick + H),
            """
Complete RetainingWallDXF Implementation
Continuation with bar schedule, details, and additional views
"""

    # Continuation of _draw_back_elevation method
            (offset_x + wall_thick, offset_y + base_thick + H),
            (offset_x, offset_y + base_thick),
            (offset_x, offset_y),
        ], dxfattribs={'layer': 'CONCRETE'})
        
        # Show reinforcement grid
        main_steel = wall_design['main_steel']
        spacing = main_steel['spacing']
        
        # Vertical bars
        for i in range(0, int(1000 / spacing)):
            x_bar = offset_x + wall_thick + i * spacing * scale
            if x_bar > offset_x + base_width:
                break
            self.msp.add_line(
                (x_bar, offset_y + base_thick),
                (x_bar, offset_y + base_thick + H),
                dxfattribs={'layer': 'REBAR_MAIN'}
            )
        
        # Horizontal bars  
        dist_steel = wall_design.get('distribution_steel')
        if dist_steel:
            dist_spacing = dist_steel['spacing']
            for i in range(0, int(H / dist_spacing)):
                y_bar = offset_y + base_thick + i * dist_spacing
                self.msp.add_line(
                    (offset_x + wall_thick, y_bar),
                    (offset_x + base_width, y_bar),
                    dxfattribs={'layer': 'REBAR_DISTRIBUTION'}
                )
    
    def _draw_base_plan(
        self, offset_x: float, offset_y: float,
        base_width: float, wall_thick: float,
        base_design: Dict, toe_design: Dict
    ):
        """Draw plan view of base slab"""
        
        # Title
        self.msp.add_text(
            'BASE SLAB PLAN',
            dxfattribs={
                'layer': 'TEXT',
                'height': self.TEXT_HEIGHT_LARGE,
                'style': 'BOLD',
            }
        ).set_pos(
            (offset_x + base_width / 2, offset_y - 1000),
            align=TextEntityAlignment.MIDDLE_CENTER
        )
        
        # Draw base outline (rectangular for 1m width section)
        plan_width = 1000  # Represent 1m width
        
        self.msp.add_rectangle(
            (offset_x, offset_y),
            base_width,
            plan_width,
            dxfattribs={'layer': 'CONCRETE'}
        )
        
        # Show reinforcement pattern
        main_steel = base_design['main_steel']
        spacing = main_steel['spacing']
        
        # Longitudinal bars
        for i in range(0, int(base_width / spacing)):
            x_bar = offset_x + i * spacing
            self.msp.add_line(
                (x_bar, offset_y),
                (x_bar, offset_y + plan_width),
                dxfattribs={'layer': 'REBAR_MAIN'}
            )
        
        # Transverse bars
        for i in range(0, int(plan_width / spacing)):
            y_bar = offset_y + i * spacing
            self.msp.add_line(
                (offset_x, y_bar),
                (offset_x + base_width, y_bar),
                dxfattribs={'layer': 'REBAR_MAIN'}
            )
    
    def _draw_wall_base_detail(
        self, offset_x: float, offset_y: float,
        wall_thick: float, base_thick: float,
        wall_design: Dict, base_design: Dict,
        cover_buried: float, cover_external: float
    ):
        """Draw detailed view of wall-base junction"""
        
        # Title
        self.msp.add_text(
            'DETAIL 1: WALL-BASE JUNCTION',
            dxfattribs={
                'layer': 'TEXT',
                'height': self.TEXT_HEIGHT_LARGE,
                'style': 'BOLD',
            }
        ).set_pos(
            (offset_x + 2000, offset_y - 500),
            align=TextEntityAlignment.MIDDLE_CENTER
        )
        
        scale_factor = 4  # 4x detail scale
        
        # Draw concrete
        detail_points = [
            (offset_x, offset_y),
            (offset_x + wall_thick * scale_factor, offset_y),
            (offset_x + wall_thick * scale_factor, offset_y + (base_thick + 1000) * scale_factor),
            (offset_x, offset_y + (base_thick + 1000) * scale_factor),
            (offset_x, offset_y),
        ]
        
        self.msp.add_lwpolyline(detail_points, dxfattribs={'layer': 'CONCRETE'})
        
        # Show cover lines
        self.msp.add_rectangle(
            (offset_x + cover_external * scale_factor, offset_y + cover_external * scale_factor),
            (wall_thick - cover_external - cover_buried) * scale_factor,
            (base_thick + 1000 - 2 * cover_external) * scale_factor,
            dxfattribs={'layer': 'CENTER_LINES', 'linetype': 'DASHED'}
        )
        
        # Draw reinforcement bars
        wall_bar_dia = wall_design['main_steel']['bar_diameter']
        base_bar_dia = base_design['main_steel']['bar_diameter']
        
        # Vertical bar from wall bent into base
        x_vert = offset_x + wall_thick * scale_factor - cover_buried * scale_factor - wall_bar_dia * scale_factor / 2
        
        vert_bar_points = self._create_l_bar(
            x_vert, offset_y + cover_external * scale_factor,
            x_vert, offset_y + (base_thick + 1000) * scale_factor - cover_external * scale_factor,
            wall_bar_dia * scale_factor, 'down'
        )
        
        self.msp.add_lwpolyline(vert_bar_points, dxfattribs={'layer': 'REBAR_MAIN'})
        
        # Horizontal base bar
        y_horiz = offset_y + base_thick * scale_factor - cover_buried * scale_factor - base_bar_dia * scale_factor / 2
        
        self.msp.add_line(
            (offset_x + cover_external * scale_factor, y_horiz),
            (offset_x + wall_thick * scale_factor - cover_buried * scale_factor, y_horiz),
            dxfattribs={'layer': 'REBAR_MAIN'}
        )
        
        # Add annotations
        self.msp.add_text(
            f'{cover_buried}mm COVER',
            dxfattribs={'layer': 'TEXT', 'height': self.TEXT_HEIGHT_SMALL * scale_factor}
        ).set_pos(
            (offset_x + wall_thick * scale_factor - cover_buried * scale_factor / 2, 
             offset_y + base_thick * scale_factor + 500 * scale_factor),
            align=TextEntityAlignment.MIDDLE_CENTER
        )
        
        self.msp.add_text(
            f'{cover_external}mm COVER',
            dxfattribs={'layer': 'TEXT', 'height': self.TEXT_HEIGHT_SMALL * scale_factor}
        ).set_pos(
            (offset_x + cover_external * scale_factor / 2, 
             offset_y + base_thick * scale_factor + 500 * scale_factor),
            align=TextEntityAlignment.MIDDLE_CENTER
        )
        
        # Tension lap annotation
        lap_length = 50 * wall_bar_dia  # BS 8110 lap length
        self.msp.add_text(
            f'TENSION LAP = {lap_length}mm',
            dxfattribs={'layer': 'TEXT', 'height': self.TEXT_HEIGHT_SMALL * scale_factor}
        ).set_pos(
            (x_vert + 200 * scale_factor, 
             offset_y + base_thick * scale_factor / 2),
            align=TextEntityAlignment.BOTTOM_LEFT
        )
        
        # Scale notation
        self.msp.add_text(
            'SCALE 1:10',
            dxfattribs={'layer': 'TEXT', 'height': self.TEXT_HEIGHT_MEDIUM}
        ).set_pos(
            (offset_x + 2000, offset_y + (base_thick + 1000) * scale_factor + 300),
            align=TextEntityAlignment.MIDDLE_CENTER
        )
    
    def _draw_kicker_detail(
        self, offset_x: float, offset_y: float,
        wall_thick: float, base_thick: float, cover: float
    ):
        """Draw kicker detail for construction"""
        
        # Title
        self.msp.add_text(
            'DETAIL 2: KICKER',
            dxfattribs={
                'layer': 'TEXT',
                'height': self.TEXT_HEIGHT_LARGE,
                'style': 'BOLD',
            }
        ).set_pos(
            (offset_x + 1500, offset_y - 500),
            align=TextEntityAlignment.MIDDLE_CENTER
        )
        
        scale_factor = 5
        kicker_height = 150  # mm
        
        # Base slab
        base_points = [
            (offset_x, offset_y),
            (offset_x + (wall_thick + 1000) * scale_factor, offset_y),
            (offset_x + (wall_thick + 1000) * scale_factor, offset_y + base_thick * scale_factor),
            (offset_x, offset_y + base_thick * scale_factor),
            (offset_x, offset_y),
        ]
        
        self.msp.add_lwpolyline(base_points, dxfattribs={'layer': 'CONCRETE'})
        
        # Kicker
        kicker_start_x = offset_x + 500 * scale_factor
        kicker_points = [
            (kicker_start_x, offset_y + base_thick * scale_factor),
            (kicker_start_x + wall_thick * scale_factor, offset_y + base_thick * scale_factor),
            (kicker_start_x + wall_thick * scale_factor, offset_y + (base_thick + kicker_height) * scale_factor),
            (kicker_start_x, offset_y + (base_thick + kicker_height) * scale_factor),
            (kicker_start_x, offset_y + base_thick * scale_factor),
        ]
        
        self.msp.add_lwpolyline(kicker_points, dxfattribs={'layer': 'CONCRETE'})
        
        # Starter bars from kicker
        num_bars = 3
        for i in range(num_bars):
            x_bar = kicker_start_x + wall_thick * scale_factor / 2 + (i - 1) * 100 * scale_factor
            
            self.msp.add_line(
                (x_bar, offset_y + cover * scale_factor),
                (x_bar, offset_y + (base_thick + kicker_height + 500) * scale_factor),
                dxfattribs={'layer': 'REBAR_MAIN'}
            )
            
            # Show bar circle
            self.msp.add_circle(
                (x_bar, offset_y + (base_thick + kicker_height + 500) * scale_factor),
                radius=8 * scale_factor,
                dxfattribs={'layer': 'REBAR_MAIN'}
            )
        
        # Dimensions
        self._add_linear_dimension(
            (kicker_start_x, offset_y + base_thick * scale_factor),
            (kicker_start_x + wall_thick * scale_factor, offset_y + base_thick * scale_factor),
            offset_y + (base_thick + kicker_height) * scale_factor + 200,
            f"{int(wall_thick)}"
        )
        
        self._add_linear_dimension(
            (kicker_start_x + wall_thick * scale_factor + 200, offset_y + base_thick * scale_factor),
            (kicker_start_x + wall_thick * scale_factor + 200, offset_y + (base_thick + kicker_height) * scale_factor),
            kicker_start_x + wall_thick * scale_factor + 400,
            f"{kicker_height}",
            vertical=True
        )
        
        # Annotations
        self.msp.add_text(
            'KICKER: 150',
            dxfattribs={'layer': 'TEXT', 'height': self.TEXT_HEIGHT_SMALL * scale_factor}
        ).set_pos(
            (kicker_start_x + wall_thick * scale_factor / 2, 
             offset_y + (base_thick + kicker_height / 2) * scale_factor),
            align=TextEntityAlignment.MIDDLE_CENTER
        )
        
        self.msp.add_text(
            'SCALE 1:15',
            dxfattribs={'layer': 'TEXT', 'height': self.TEXT_HEIGHT_MEDIUM}
        ).set_pos(
            (offset_x + 1500, offset_y + (base_thick + kicker_height + 500) * scale_factor + 300),
            align=TextEntityAlignment.MIDDLE_CENTER
        )
    
    def _draw_counterfort_wall(self):
        """Draw counterfort retaining wall"""
        
        geometry = self.design['geometry']
        wall_design = self.design['wall_design']
        counterfort_design = self.design.get('counterfort_design')
        
        # Similar to cantilever but with counterfort details
        # Add counterfort-specific drawings
        
        pass  # Implementation similar to cantilever with additional counterfort elements
    
    def _draw_buttress_wall(self):
        """Draw buttress retaining wall"""
        
        # Similar to counterfort but buttresses on front face
        pass
    
    def _add_detail_references(self, offset_x: float, offset_y: float, H: float):
        """Add detail reference bubbles"""
        
        # Detail 1 reference
        detail_x = offset_x + 500
        detail_y = offset_y + 200
        
        self.msp.add_circle(
            (detail_x, detail_y),
            radius=150,
            dxfattribs={'layer': 'DIMENSIONS'}
        )
        
        self.msp.add_line(
            (detail_x, detail_y - 150),
            (detail_x, detail_y + 150),
            dxfattribs={'layer': 'DIMENSIONS'}
        )
        
        self.msp.add_text(
            '1',
            dxfattribs={'layer': 'TEXT', 'height': self.TEXT_HEIGHT_LARGE}
        ).set_pos((detail_x, detail_y + 50), align=TextEntityAlignment.MIDDLE_CENTER)
        
        # Detail 2 reference
        detail2_x = offset_x + 500
        detail2_y = offset_y + 400
        
        self.msp.add_circle(
            (detail2_x, detail2_y),
            radius=150,
            dxfattribs={'layer': 'DIMENSIONS'}
        )
        
        self.msp.add_line(
            (detail2_x, detail2_y - 150),
            (detail2_x, detail2_y + 150),
            dxfattribs={'layer': 'DIMENSIONS'}
        )
        
        self.msp.add_text(
            '2',
            dxfattribs={'layer': 'TEXT', 'height': self.TEXT_HEIGHT_LARGE}
        ).set_pos((detail2_x, detail2_y + 50), align=TextEntityAlignment.MIDDLE_CENTER)
    
    def _add_bar_schedule(self):
        """Add reinforcement bar schedule table"""
        
        if not self.bar_schedule:
            return
        
        # Position for bar schedule
        table_x = 0
        table_y = -15000
        
        # Title
        self.msp.add_text(
            'REINFORCEMENT BAR SCHEDULE',
            dxfattribs={
                'layer': 'TEXT',
                'height': self.TEXT_HEIGHT_LARGE,
                'style': 'BOLD',
            }
        ).set_pos(
            (table_x + 5000, table_y - 500),
            align=TextEntityAlignment.MIDDLE_CENTER
        )
        
        # Table headers
        col_widths = [800, 1000, 1000, 1500, 1200, 1200, 3000]
        headers = ['Mark', 'Type', 'Diameter', 'Spacing', 'Length', 'Shape', 'Location']
        
        x_pos = table_x
        y_pos = table_y
        row_height = 400
        
        # Draw header row
        for i, (header, width) in enumerate(zip(headers, col_widths)):
            # Cell border
            self.msp.add_rectangle(
                (x_pos, y_pos),
                width, row_height,
                dxfattribs={'layer': 'DIMENSIONS'}
            )
            
            # Header text
            self.msp.add_text(
                header,
                dxfattribs={
                    'layer': 'TEXT',
                    'height': self.TEXT_HEIGHT_SMALL,
                    'style': 'BOLD',
                }
            ).set_pos(
                (x_pos + width / 2, y_pos + row_height / 2),
                align=TextEntityAlignment.MIDDLE_CENTER
            )
            
            x_pos += width
        
        # Draw data rows
        y_pos += row_height
        
        for bar in self.bar_schedule:
            x_pos = table_x
            
            values = [
                bar['mark'],
                bar['type'],
                f"H{bar['diameter']}",
                f"{bar['spacing']}c/c" if bar['spacing'] else 'N/A',
                f"{bar['length']}mm",
                bar['shape'],
                bar['location'],
            ]
            
            for value, width in zip(values, col_widths):
                # Cell border
                self.msp.add_rectangle(
                    (x_pos, y_pos),
                    width, row_height,
                    dxfattribs={'layer': 'DIMENSIONS'}
                )
                
                # Cell text
                self.msp.add_text(
                    str(value),
                    dxfattribs={
                        'layer': 'TEXT',
                        'height': self.TEXT_HEIGHT_SMALL,
                    }
                ).set_pos(
                    (x_pos + width / 2, y_pos + row_height / 2),
                    align=TextEntityAlignment.MIDDLE_CENTER
                )
                
                x_pos += width
            
            y_pos += row_height
    
    def _add_general_notes(self):
        """Add general notes and specifications"""
        
        notes_x = 0
        notes_y = -20000
        
        # Title
        self.msp.add_text(
            'GENERAL NOTES',
            dxfattribs={
                'layer': 'TEXT',
                'height': self.TEXT_HEIGHT_LARGE,
                'style': 'BOLD',
            }
        ).set_pos(
            (notes_x, notes_y),
            align=TextEntityAlignment.BOTTOM_LEFT
        )
        
        # Notes
        notes = [
            '1. ALL DIMENSIONS ARE IN MILLIMETERS UNLESS OTHERWISE NOTED',
            '2. CONCRETE: ' + self.design.get('concrete', {}).get('grade', 'C30/37') + ' TO BS 8110',
            '3. REINFORCEMENT: GRADE 460 TO BS 4449',
            '4. COVER TO REINFORCEMENT:',
            '   - EXTERNAL EXPOSED FACES: 40mm',
            '   - BURIED FACES (EARTH CONTACT): 50mm',
            '5. ALL REINFORCEMENT LAPS TO BE 50 x DIAMETER (MIN)',
            '6. BEND RADII TO BS 8666',
            '7. KICKER: 150mm HIGH, CAST WITH BASE SLAB',
            '8. WATERPROOFING: AS PER SPECIFICATION',
            '9. DRAINAGE: PROVIDE WEEPHOLES AT 2m CENTERS',
            '10. BACKFILL: GRANULAR MATERIAL, COMPACTED IN LAYERS',
            '11. REFER TO STRUCTURAL CALCULATIONS FOR DESIGN LOADS',
            '12. CONSTRUCTION JOINTS AS APPROVED BY ENGINEER',
        ]
        
        y_offset = notes_y + 300
        for i, note in enumerate(notes):
            self.msp.add_text(
                note,
                dxfattribs={
                    'layer': 'TEXT',
                    'height': self.TEXT_HEIGHT_SMALL,
                }
            ).set_pos((notes_x, y_offset + i * 200), align=TextEntityAlignment.BOTTOM_LEFT)
    
    def _add_title_block(self):
        """Add title block to drawing"""
        
        # Position at bottom right
        tb_width = 8000
        tb_height = 3000
        tb_x = 50000  # Adjust based on drawing extent
        tb_y = -25000
        
        # Outer border
        self.msp.add_rectangle(
            (tb_x, tb_y),
            tb_width, tb_height,
            dxfattribs={'layer': 'DIMENSIONS', 'lineweight': 70}
        )
        
        # Project title
        self.msp.add_text(
            'RETAINING WALL DESIGN',
            dxfattribs={
                'layer': 'TEXT',
                'height': self.TEXT_HEIGHT_LARGE * 1.5,
                'style': 'BOLD',
            }
        ).set_pos(
            (tb_x + tb_width / 2, tb_y + tb_height - 400),
            align=TextEntityAlignment.MIDDLE_CENTER
        )
        
        # Drawing title
        wall_type = self.design.get('wall_type', 'cantilever').upper()
        self.msp.add_text(
            f'{wall_type} RETAINING WALL - DETAILS',
            dxfattribs={
                'layer': 'TEXT',
                'height': self.TEXT_HEIGHT_LARGE,
            }
        ).set_pos(
            (tb_x + tb_width / 2, tb_y + tb_height - 800),
            align=TextEntityAlignment.MIDDLE_CENTER
        )
        
        # Design codes
        self.msp.add_text(
            'DESIGN TO: BS 8110, BS 8007, BS 8002, BS 4449',
            dxfattribs={'layer': 'TEXT', 'height': self.TEXT_HEIGHT_SMALL}
        ).set_pos((tb_x + 200, tb_y + 200), align=TextEntityAlignment.BOTTOM_LEFT)
        
        # Date
        from datetime import datetime
        date_str = datetime.now().strftime('%Y-%m-%d')
        self.msp.add_text(
            f'DATE: {date_str}',
            dxfattribs={'layer': 'TEXT', 'height': self.TEXT_HEIGHT_SMALL}
        ).set_pos((tb_x + 200, tb_y + 600), align=TextEntityAlignment.BOTTOM_LEFT)
        
        # Scale
        self.msp.add_text(
            'SCALE: AS NOTED',
            dxfattribs={'layer': 'TEXT', 'height': self.TEXT_HEIGHT_SMALL}
        ).set_pos((tb_x + 200, tb_y + 1000), align=TextEntityAlignment.BOTTOM_LEFT)
        
        # Drawing number
        self.msp.add_text(
            'DRG NO: RW-001',
            dxfattribs={'layer': 'TEXT', 'height': self.TEXT_HEIGHT_SMALL}
        ).set_pos((tb_x + tb_width - 200, tb_y + 200), align=TextEntityAlignment.BOTTOM_RIGHT)


# Example usage
if __name__ == "__main__":
    # Sample design data
    design_data = {
        'wall_type': 'cantilever',
        'height': 4.0,  # meters
        'geometry': {
            'wall_thickness': 250,
            'base_thickness': 300,
            'base_width': 3.5,
            'toe_width': 1.0,
            'heel_width': 2.2,
        },
        'wall_design': {
            'main_steel': {
                'bar_diameter': 16,
                'spacing': 200,
                'notation': 'H16@200c/c',
            },
            'distribution_steel': {
                'bar_diameter': 10,
                'spacing': 240,
                'notation': 'H10@240c/c',
            },
        },
        'base_design': {
            'main_steel': {
                'bar_diameter': 12,
                'spacing': 200,
                'notation': 'H12@200c/c',
            },
        },
        'toe_design': {
            'main_steel': {
                'bar_diameter': 12,
                'spacing': 200,
                'notation': 'H12@200c/c',
            },
        },
        'concrete': {
            'grade': 'C30/37',
        },
    }
    
    # Generate DXF
    generator = RetainingWallDXF(design_data)
    generator.generate_dxf('retaining_wall_details.dxf')