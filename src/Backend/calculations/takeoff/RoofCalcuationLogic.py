"""
Roof Calculation Logic Module
Comprehensive calculations for roof structures following civil engineering standards
"""

import math
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field


@dataclass
class RoofDimensions:
    """Core roof dimensions"""

    building_length: float
    building_width: float
    wall_thickness: float
    overhang: float
    pitch_angle: float  # degrees
    truss_spacing: float
    rafter_spacing: float
    bearer_spacing: float = 0.6
    pitch_angle_2: float = 15.0  # For Gambrel/Mansard upper slope
    break_ratio: float = 0.6  # For Gambrel/Mansard break position (0-1)


@dataclass
class MemberSizes:
    """Sizes of roof structural members"""

    wall_plate: Tuple[float, float] = (0.1, 0.05)  # (width, height) in meters
    rafter: Tuple[float, float] = (0.15, 0.05)
    tie_beam: Tuple[float, float] = (0.15, 0.05)
    strut: Tuple[float, float] = (0.1, 0.05)
    ridge: Tuple[float, float] = (0.175, 0.025)
    purlin: Tuple[float, float] = (0.075, 0.075)
    binder: Tuple[float, float] = (0.15, 0.05)
    fascia: Tuple[float, float] = (0.2, 0.025)
    bearer: Tuple[float, float] = (0.05, 0.05)


@dataclass
class CoveringDetails:
    """Roof covering specifications"""

    type: str  # tiles, acSheets, giSheets, slate, thatch
    sheet_length: Optional[float] = None
    sheet_width: Optional[float] = None
    side_overlap: Optional[float] = None
    end_overlap: Optional[float] = None
    tile_length: Optional[float] = None
    tile_width: Optional[float] = None
    tile_lap: Optional[float] = None
    wastage_percent: float = 10.0


@dataclass
class RoofQuantities:
    """Calculated quantities for roof structure"""

    # Structural members (linear meters)
    wall_plate_m: float = 0.0
    principal_rafter_m: float = 0.0
    common_rafter_m: float = 0.0
    tie_beam_m: float = 0.0
    ties_m: float = 0.0
    struts_m: float = 0.0
    binders_m: float = 0.0
    ridge_m: float = 0.0
    purlins_m: float = 0.0
    hips_m: float = 0.0
    valleys_m: float = 0.0

    # Numbers
    num_trusses: int = 0
    num_common_rafters: int = 0
    num_bearers: int = 0

    # Covering
    covering_area_m2: float = 0.0
    num_covering_units: int = 0
    ridge_cover_m: float = 0.0
    ridge_ends_nos: int = 0

    # Eaves and verges
    fascia_m: float = 0.0
    verge_m: float = 0.0
    runner_m: float = 0.0
    bearers_m: float = 0.0
    soffit_area_m2: float = 0.0
    verge_soffit_area_m2: float = 0.0

    # Rainwater goods
    gutter_len_m: float = 0.0
    gutter_ends_nos: int = 0
    outlets_nos: int = 0
    downpipe_m: float = 0.0
    shoes_nos: int = 0

    # Additional details
    roof_height: float = 0.0
    rafter_length: float = 0.0
    effective_span: float = 0.0
    effective_length: float = 0.0


class RoofCalculator:
    """Main roof calculation engine"""

    def __init__(
        self,
        roof_type: str,
        dimensions: RoofDimensions,
        member_sizes: MemberSizes,
        material: str = "timber",
        covering: Optional[CoveringDetails] = None,
        has_valley: bool = False,
        valley_length: float = 0.0,
        downpipe_length: float = 3.0,
    ):
        self.roof_type = roof_type.lower()
        self.dims = dimensions
        self.sizes = member_sizes
        self.material = material
        self.covering = covering
        self.has_valley = has_valley
        self.valley_length = valley_length
        self.downpipe_length = downpipe_length

    def calculate_all(self) -> RoofQuantities:
        """Calculate all roof quantities"""
        q = RoofQuantities()
        pitch_rad = math.radians(self.dims.pitch_angle)
        
        # Effective dimensions
        q.effective_span = (
            self.dims.building_width
            + 2 * self.dims.wall_thickness
            + 2 * self.dims.overhang
        )
        q.effective_length = (
            self.dims.building_length
            + 2 * self.dims.wall_thickness
            + 2 * self.dims.overhang
        )

        # Resource counts (Used by specialized calculators)
        q.num_trusses = (
            math.floor(self.dims.building_length / self.dims.truss_spacing) + 1
        )
        total_rafter_positions = (
            math.floor(self.dims.building_length / self.dims.rafter_spacing) + 1
        )
        q.num_common_rafters = total_rafter_positions - q.num_trusses

        if self.roof_type == "gable":
            self._calculate_gable(q, pitch_rad)
        elif self.roof_type == "hipped":
            self._calculate_hipped(q, pitch_rad)
        elif self.roof_type == "lean-to":
            self._calculate_lean_to(q, pitch_rad)
        elif self.roof_type == "gambrel":
            self._calculate_gambrel(q, pitch_rad)
        elif self.roof_type == "mansard":
            self._calculate_mansard(q, pitch_rad)

        # Wall plates
        wall_plate_length = self.dims.building_length + 2 * self.dims.wall_thickness
        if self.roof_type == "lean-to":
            q.wall_plate_m = 2 * wall_plate_length # Top and bottom
        else:
            q.wall_plate_m = 2 * wall_plate_length # Usually 2 sides

        # Purlins
        num_purlin_rows = 2 if q.effective_span < 6 else 4
        if self.roof_type == "lean-to":
            q.purlins_m = (num_purlin_rows / 2) * q.effective_length
        else:
            q.purlins_m = num_purlin_rows * q.effective_length

        # Ridge board (except lean-to)
        if self.roof_type != "lean-to":
            q.ridge_m = q.effective_length

        # Covering calculations
        if self.covering:
            q = self._calculate_covering(q, pitch_rad)

        # Eaves and verges
        q = self._calculate_eaves_verges(q)

        # Rainwater goods
        q = self._calculate_rainwater_goods(q)

        return q

    def _calculate_gable(self, q: RoofQuantities, pitch_rad: float):
        """Gable roof specifics"""
        half_span = q.effective_span / 2
        q.roof_height = half_span * math.tan(pitch_rad)
        q.rafter_length = half_span / math.cos(pitch_rad)
        
        q.principal_rafter_m = 2 * q.num_trusses * q.rafter_length
        q.common_rafter_m = 2 * (q.num_common_rafters if q.num_common_rafters > 0 else 0) * q.rafter_length
        q.tie_beam_m = q.num_trusses * q.effective_span
        
        # Struts
        if q.effective_span < 8:
            q.struts_m = q.num_trusses * (q.roof_height - self.sizes.tie_beam[1])
        else:
            strut_height = q.roof_height * 0.6
            q.ties_m = 2 * q.num_trusses * (q.roof_height * 0.4)
            q.struts_m = 2 * q.num_trusses * math.sqrt(strut_height**2 + (q.effective_span/4)**2)

    def _calculate_hipped(self, q: RoofQuantities, pitch_rad: float):
        """Hipped roof specifics"""
        self._calculate_gable(q, pitch_rad)
        
        # Adjust ridge for hips
        ridge_length = q.effective_length - q.effective_span
        if ridge_length < 0: ridge_length = 0
        q.ridge_m = ridge_length
        
        # Hips
        hip_h = q.roof_height
        hip_base_diag = math.sqrt((q.effective_span/2)**2 + (q.effective_span/2)**2)
        hip_len = math.sqrt(hip_h**2 + hip_base_diag**2)
        q.hips_m = 4 * hip_len

    def _calculate_lean_to(self, q: RoofQuantities, pitch_rad: float):
        """Lean-to roof specifics"""
        q.roof_height = q.effective_span * math.tan(pitch_rad)
        q.rafter_length = q.effective_span / math.cos(pitch_rad)
        
        q.principal_rafter_m = q.num_trusses * q.rafter_length
        q.common_rafter_m = (q.num_common_rafters if q.num_common_rafters > 0 else 0) * q.rafter_length
        # No tie beam in basic lean-to usually, or it's a floor beam
        q.tie_beam_m = 0 

    def _calculate_gambrel(self, q: RoofQuantities, pitch_rad: float):
        """Gambrel roof specifics (Two slopes per side)"""
        # pitch_rad is the lower (steeper) slope
        pitch2_rad = math.radians(self.dims.pitch_angle_2)
        
        half_span = q.effective_span / 2
        break_w = half_span * self.dims.break_ratio
        break_h = break_w * math.tan(pitch_rad)
        
        upper_w = half_span - break_w
        upper_h = upper_w * math.tan(pitch2_rad)
        
        q.roof_height = break_h + upper_h
        
        lower_rafter = break_w / math.cos(pitch_rad)
        upper_rafter = upper_w / math.cos(pitch2_rad)
        q.rafter_length = lower_rafter + upper_rafter
        
        q.principal_rafter_m = 2 * q.num_trusses * q.rafter_length
        q.common_rafter_m = 2 * q.num_common_rafters * q.rafter_length
        q.tie_beam_m = q.num_trusses * q.effective_span
        
        # Extra strut for the break point
        q.struts_m = q.num_trusses * (break_h * 2 + upper_h)

    def _calculate_mansard(self, q: RoofQuantities, pitch_rad: float):
        """Mansard roof specifics (Hipped gambrel)"""
        self._calculate_gambrel(q, pitch_rad)
        
        # Adjust ridge
        ridge_length = q.effective_length - q.effective_span
        if ridge_length < 0: ridge_length = 0
        q.ridge_m = ridge_length
        
        # Hips are segmented
        lower_h = (q.effective_span/2 * self.dims.break_ratio) * math.tan(pitch_rad)
        lower_diag = math.sqrt(2 * (q.effective_span/2 * self.dims.break_ratio)**2)
        lower_hip = math.sqrt(lower_h**2 + lower_diag**2)
        
        upper_h = q.roof_height - lower_h
        upper_diag = math.sqrt(2 * (q.effective_span/2 * (1 - self.dims.break_ratio))**2)
        upper_hip = math.sqrt(upper_h**2 + upper_diag**2)
        
        q.hips_m = 4 * (lower_hip + upper_hip)

    def _calculate_covering(
        self, q: RoofQuantities, pitch_rad: float
    ) -> RoofQuantities:
        """Calculate roof covering quantities"""
        # Area calculation (in plan and then adjusted for pitch)
        plan_area = q.effective_length * q.effective_span
        sec_pitch = 1 / math.cos(pitch_rad)
        q.covering_area_m2 = plan_area * sec_pitch

        if self.covering.type in ["acSheets", "giSheets", "slate"]:
            # Sheet or Slate covering
            sw = self.covering.sheet_width or (0.9 if self.covering.type != "slate" else 0.3)
            sl = self.covering.sheet_length or (3.0 if self.covering.type != "slate" else 0.6)
            so = self.covering.side_overlap or 0.1
            eo = self.covering.end_overlap or 0.15
            
            effective_width = sw - so
            effective_length = sl - eo
            effective_area = effective_width * effective_length
            
            # Avoid division by zero
            if effective_area <= 0: effective_area = 1.0

            q.num_covering_units = math.ceil(
                q.covering_area_m2
                / effective_area
                * (1 + self.covering.wastage_percent / 100)
            )
        elif self.covering.type == "tiles":
            # Tile covering
            tl = self.covering.tile_length or 0.265
            tw = self.covering.tile_width or 0.165
            tlap = self.covering.tile_lap or 0.065
            
            gauge = (tl - tlap) / 2
            if gauge <= 0: gauge = 0.1
            
            tiles_per_m2 = 1 / (gauge * tw)

            q.num_covering_units = math.ceil(
                q.covering_area_m2
                * tiles_per_m2
                * (1 + self.covering.wastage_percent / 100)
            )

        # Ridge covering
        q.ridge_cover_m = q.effective_length
        q.ridge_ends_nos = 2

        return q

    def _calculate_eaves_verges(self, q: RoofQuantities) -> RoofQuantities:
        """Calculate eaves and verge quantities"""
        # Fascia (2 long sides)
        fascia_length = q.effective_length - 0.25  # Adjustment at corners
        q.fascia_m = 2 * fascia_length

        # Verges (gable ends or hips)
        if self.roof_type == "gable":
            q.verge_m = 4 * q.rafter_length  # 2 gable ends, 2 sides each
        elif self.roof_type == "hipped":
            q.verge_m = 2 * q.rafter_length  # Reduced for hipped
        else:
            q.verge_m = 2 * q.rafter_length

        # Runners (along wall top)
        runner_length = self.dims.building_length + 2 * self.dims.wall_thickness
        q.runner_m = 2 * runner_length

        # Bearers (supporting soffit)
        q.num_bearers = (
            math.floor(self.dims.building_length / self.dims.bearer_spacing) + 1
        )
        bearer_length = self.dims.overhang - self.sizes.fascia[0]
        q.bearers_m = bearer_length * q.num_bearers * 2

        # Soffit areas
        q.soffit_area_m2 = fascia_length * bearer_length
        q.verge_soffit_area_m2 = q.rafter_length * bearer_length * 2

        return q

    def _calculate_rainwater_goods(self, q: RoofQuantities) -> RoofQuantities:
        """Calculate rainwater goods quantities"""
        # Gutters (2 long sides)
        q.gutter_len_m = 2 * q.effective_length
        q.gutter_ends_nos = 4
        q.outlets_nos = 4

        # Downpipes (typically 4 corners)
        q.downpipe_m = 4 * self.downpipe_length
        q.shoes_nos = 4

        return q

    def generate_takeoff_sheet(self, quantities: RoofQuantities) -> List[Dict]:
        """Generate SMM7 compliant takeoff sheet data"""
        takeoff = []

        # Structural timber
        takeoff.append(
            {
                "section": "A - ROOF STRUCTURE",
                "items": [
                    {
                        "timesing": 2,
                        "dimension": f"{self.dims.building_length + 2 * self.dims.wall_thickness:.2f}",
                        "squaring": f"{quantities.wall_plate_m:.2f}",
                        "description": f"Wall Plate\n{int(self.sizes.wall_plate[0]*1000)}x{int(self.sizes.wall_plate[1]*1000)}mm sawn softwood\nbedded in c.m. (1:3)",
                        "quantity": f"{quantities.wall_plate_m:.2f} m",
                        "unit": "m",
                    },
                    {
                        "timesing": quantities.num_trusses * 2,
                        "dimension": f"{quantities.rafter_length:.2f}",
                        "squaring": f"{quantities.principal_rafter_m:.2f}",
                        "description": f"Principal Rafters\n{int(self.sizes.rafter[0]*1000)}x{int(self.sizes.rafter[1]*1000)}mm sawn softwood\nnotched to wall plate",
                        "quantity": f"{quantities.principal_rafter_m:.2f} m",
                        "unit": "m",
                    },
                    {
                        "timesing": quantities.num_common_rafters * 2,
                        "dimension": f"{quantities.rafter_length:.2f}",
                        "squaring": f"{quantities.common_rafter_m:.2f}",
                        "description": f"Common Rafters\n{int(self.sizes.rafter[0]*1000)}x{int(self.sizes.rafter[1]*1000)}mm sawn softwood\nfixed to purlins",
                        "quantity": f"{quantities.common_rafter_m:.2f} m",
                        "unit": "m",
                    },
                    {
                        "timesing": quantities.num_trusses,
                        "dimension": f"{quantities.effective_span:.2f}",
                        "squaring": f"{quantities.tie_beam_m:.2f}",
                        "description": f"Tie Beams\n{int(self.sizes.tie_beam[0]*1000)}x{int(self.sizes.tie_beam[1]*1000)}mm sawn softwood\nbolted to rafters",
                        "quantity": f"{quantities.tie_beam_m:.2f} m",
                        "unit": "m",
                    },
                    {
                        "timesing": (
                            quantities.num_trusses * 2
                            if quantities.ties_m > 0
                            else quantities.num_trusses
                        ),
                        "dimension": f"{quantities.ties_m / (quantities.num_trusses * 2) if quantities.ties_m > 0 else quantities.roof_height:.2f}",
                        "squaring": f"{quantities.ties_m + quantities.struts_m:.2f}",
                        "description": f"Struts and Ties\n{int(self.sizes.strut[0]*1000)}x{int(self.sizes.strut[1]*1000)}mm sawn softwood\nbolted connections",
                        "quantity": f"{quantities.ties_m + quantities.struts_m:.2f} m",
                        "unit": "m",
                    },
                    {
                        "timesing": 2,
                        "dimension": f"{quantities.effective_length:.2f}",
                        "squaring": f"{quantities.purlins_m:.2f}",
                        "description": f"Purlins\n{int(self.sizes.purlin[0]*1000)}x{int(self.sizes.purlin[1]*1000)}mm sawn softwood\nsupported on struts",
                        "quantity": f"{quantities.purlins_m:.2f} m",
                        "unit": "m",
                    },
                    {
                        "timesing": 1,
                        "dimension": f"{quantities.effective_length:.2f}",
                        "squaring": f"{quantities.ridge_m:.2f}",
                        "description": f"Ridge Board\n{int(self.sizes.ridge[0]*1000)}x{int(self.sizes.ridge[1]*1000)}mm sawn softwood\nfixed to rafters",
                        "quantity": f"{quantities.ridge_m:.2f} m",
                        "unit": "m",
                    },
                ],
            }
        )

        # Hips and valleys
        if quantities.hips_m > 0 or quantities.valleys_m > 0:
            hip_valley_items = []
            if quantities.hips_m > 0:
                hip_valley_items.append(
                    {
                        "timesing": 4,
                        "dimension": f"{quantities.hips_m / 4:.2f}",
                        "squaring": f"{quantities.hips_m:.2f}",
                        "description": "Hip Rafters\n175x38mm sawn softwood\nmitred at ridge",
                        "quantity": f"{quantities.hips_m:.2f} m",
                        "unit": "m",
                    }
                )
            if quantities.valleys_m > 0:
                hip_valley_items.append(
                    {
                        "timesing": 1,
                        "dimension": f"{quantities.valleys_m:.2f}",
                        "squaring": f"{quantities.valleys_m:.2f}",
                        "description": "Valley Rafters\n175x38mm sawn softwood\nsupported on bearers",
                        "quantity": f"{quantities.valleys_m:.2f} m",
                        "unit": "m",
                    }
                )
            takeoff.append(
                {"section": "B - HIPS AND VALLEYS", "items": hip_valley_items}
            )

        # Covering
        if self.covering and quantities.num_covering_units > 0:
            covering_name = {
                "tiles": "Clay Tiles",
                "acSheets": "A.C. Corrugated Sheets",
                "giSheets": "G.I. Corrugated Sheets",
                "slate": "Natural Slate",
                "thatch": "Thatch",
            }.get(self.covering.type, "Roof Covering")

            unit = "No" if self.covering.type in ["tiles", "slate"] else "No"

            takeoff.append(
                {
                    "section": "C - ROOF COVERING",
                    "items": [
                        {
                            "timesing": 1,
                            "dimension": f"{quantities.covering_area_m2:.2f}",
                            "squaring": f"{quantities.covering_area_m2:.2f}",
                            "description": f"{covering_name}\nArea on slope\nincl. {self.covering.wastage_percent}% wastage",
                            "quantity": f"{quantities.covering_area_m2:.2f} m²",
                            "unit": "m²",
                        },
                        {
                            "timesing": quantities.num_covering_units,
                            "dimension": "1",
                            "squaring": str(quantities.num_covering_units),
                            "description": f"{covering_name} Units\nComplete with fixings\nto manufacturer's spec",
                            "quantity": f"{quantities.num_covering_units} {unit}",
                            "unit": unit,
                        },
                        {
                            "timesing": 1,
                            "dimension": f"{quantities.ridge_cover_m:.2f}",
                            "squaring": f"{quantities.ridge_cover_m:.2f}",
                            "description": "Ridge Capping\nBedded in c.m. (1:3)\nincl. end caps",
                            "quantity": f"{quantities.ridge_cover_m:.2f} m",
                            "unit": "m",
                        },
                    ],
                }
            )

        # Eaves and verges
        if quantities.fascia_m > 0:
            takeoff.append(
                {
                    "section": "D - EAVES AND VERGES",
                    "items": [
                        {
                            "timesing": 2,
                            "dimension": f"{quantities.fascia_m / 2:.2f}",
                            "squaring": f"{quantities.fascia_m:.2f}",
                            "description": f"Fascia Board\n{int(self.sizes.fascia[0]*1000)}x{int(self.sizes.fascia[1]*1000)}mm sawn softwood\ntreated with preservative",
                            "quantity": f"{quantities.fascia_m:.2f} m",
                            "unit": "m",
                        },
                        {
                            "timesing": (
                                int(quantities.verge_m / quantities.rafter_length)
                                if quantities.rafter_length > 0
                                else 1
                            ),
                            "dimension": f"{quantities.rafter_length:.2f}",
                            "squaring": f"{quantities.verge_m:.2f}",
                            "description": "Verge Boards\n200x25mm sawn softwood\nwith tile undercloak",
                            "quantity": f"{quantities.verge_m:.2f} m",
                            "unit": "m",
                        },
                        {
                            "timesing": quantities.num_bearers * 2,
                            "dimension": f"{quantities.bearers_m / (quantities.num_bearers * 2):.2f}",
                            "squaring": f"{quantities.bearers_m:.2f}",
                            "description": f"Eaves Bearers\n{int(self.sizes.bearer[0]*1000)}x{int(self.sizes.bearer[1]*1000)}mm sawn softwood\nat {int(self.dims.bearer_spacing * 1000)}mm centres",
                            "quantity": f"{quantities.bearers_m:.2f} m",
                            "unit": "m",
                        },
                        {
                            "timesing": 1,
                            "dimension": f"{quantities.soffit_area_m2:.2f}",
                            "squaring": f"{quantities.soffit_area_m2:.2f}",
                            "description": "Soffit Boarding\n25mm T&G softwood\nvented at 10mm intervals",
                            "quantity": f"{quantities.soffit_area_m2:.2f} m²",
                            "unit": "m²",
                        },
                    ],
                }
            )

        # Rainwater goods
        if quantities.gutter_len_m > 0:
            takeoff.append(
                {
                    "section": "E - RAINWATER GOODS",
                    "items": [
                        {
                            "timesing": 2,
                            "dimension": f"{quantities.gutter_len_m / 2:.2f}",
                            "squaring": f"{quantities.gutter_len_m:.2f}",
                            "description": "PVC Gutters\n100mm half round\nincl. brackets at 1m c/c",
                            "quantity": f"{quantities.gutter_len_m:.2f} m",
                            "unit": "m",
                        },
                        {
                            "timesing": quantities.gutter_ends_nos,
                            "dimension": "1",
                            "squaring": str(quantities.gutter_ends_nos),
                            "description": "Gutter Stop Ends\n100mm PVC",
                            "quantity": f"{quantities.gutter_ends_nos} No",
                            "unit": "No",
                        },
                        {
                            "timesing": quantities.outlets_nos,
                            "dimension": "1",
                            "squaring": str(quantities.outlets_nos),
                            "description": "Gutter Outlets\n100mm to 75mm PVC",
                            "quantity": f"{quantities.outlets_nos} No",
                            "unit": "No",
                        },
                        {
                            "timesing": 4,
                            "dimension": f"{self.downpipe_length:.2f}",
                            "squaring": f"{quantities.downpipe_m:.2f}",
                            "description": "Downpipes\n75mm diameter PVC\nincl. fixings",
                            "quantity": f"{quantities.downpipe_m:.2f} m",
                            "unit": "m",
                        },
                        {
                            "timesing": quantities.shoes_nos,
                            "dimension": "1",
                            "squaring": str(quantities.shoes_nos),
                            "description": "Downpipe Shoes\n75mm PVC",
                            "quantity": f"{quantities.shoes_nos} No",
                            "unit": "No",
                        },
                    ],
                }
            )

        return takeoff

    def generate_boq(self, quantities: RoofQuantities) -> Dict:
        """Generate detailed Bill of Quantities with rates"""
        # Standard rates in KES (Kenya Shillings)
        rates = {
            "wall_plate": 850.00,
            "rafter": 1200.00,
            "tie_beam": 1200.00,
            "strut": 850.00,
            "purlin": 600.00,
            "ridge": 750.00,
            "hip": 1000.00,
            "valley": 1000.00,
            "fascia": 650.00,
            "verge": 700.00,
            "bearer": 400.00,
            "soffit": 1500.00,  # per m²
            "battens": 180.00,
            "tiles": 2500.00,  # per m²
            "acSheets": 1200.00,  # per m²
            "giSheets": 1500.00,  # per m²
            "slate": 3000.00,  # per m²
            "ridge_cover": 800.00,
            "gutter": 450.00,
            "gutter_fitting": 250.00,
            "downpipe": 380.00,
            "preliminaries": 50000.00,
        }

        boq = {
            "project": f"{self.roof_type.upper()} ROOF - {self.material.upper()}",
            "date": "",
            "sections": [],
        }

        # Preliminaries
        boq["sections"].append(
            {
                "section": "A",
                "title": "PRELIMINARIES",
                "items": [
                    {
                        "item_no": "A.1",
                        "description": "Site establishment and clearance",
                        "unit": "Item",
                        "quantity": 1,
                        "rate": rates["preliminaries"],
                        "amount": rates["preliminaries"],
                    }
                ],
            }
        )

        # Roof structure
        structure_items = []
        item_no = 1

        if quantities.wall_plate_m > 0:
            structure_items.append(
                {
                    "item_no": f"B.{item_no}",
                    "description": f"Wall plates, {int(self.sizes.wall_plate[0]*1000)}x{int(self.sizes.wall_plate[1]*1000)}mm sawn softwood, treated, bedded in c.m. (1:3)",
                    "unit": "m",
                    "quantity": round(quantities.wall_plate_m, 2),
                    "rate": rates["wall_plate"],
                    "amount": round(quantities.wall_plate_m * rates["wall_plate"], 2),
                }
            )
            item_no += 1

        if quantities.principal_rafter_m > 0:
            structure_items.append(
                {
                    "item_no": f"B.{item_no}",
                    "description": f"Principal rafters, {int(self.sizes.rafter[0]*1000)}x{int(self.sizes.rafter[1]*1000)}mm sawn softwood GS grade, notched, fixed",
                    "unit": "m",
                    "quantity": round(quantities.principal_rafter_m, 2),
                    "rate": rates["rafter"],
                    "amount": round(quantities.principal_rafter_m * rates["rafter"], 2),
                }
            )
            item_no += 1

        if quantities.common_rafter_m > 0:
            structure_items.append(
                {
                    "item_no": f"B.{item_no}",
                    "description": f"Common rafters, {int(self.sizes.rafter[0]*1000)}x{int(self.sizes.rafter[1]*1000)}mm sawn softwood, fixed to purlins",
                    "unit": "m",
                    "quantity": round(quantities.common_rafter_m, 2),
                    "rate": rates["rafter"],
                    "amount": round(quantities.common_rafter_m * rates["rafter"], 2),
                }
            )
            item_no += 1

        if quantities.tie_beam_m > 0:
            structure_items.append(
                {
                    "item_no": f"B.{item_no}",
                    "description": f"Tie beams, {int(self.sizes.tie_beam[0]*1000)}x{int(self.sizes.tie_beam[1]*1000)}mm sawn softwood, bolted to rafters",
                    "unit": "m",
                    "quantity": round(quantities.tie_beam_m, 2),
                    "rate": rates["tie_beam"],
                    "amount": round(quantities.tie_beam_m * rates["tie_beam"], 2),
                }
            )
            item_no += 1

        total_struts = quantities.ties_m + quantities.struts_m
        if total_struts > 0:
            structure_items.append(
                {
                    "item_no": f"B.{item_no}",
                    "description": f"Struts and ties, {int(self.sizes.strut[0]*1000)}x{int(self.sizes.strut[1]*1000)}mm sawn softwood, bolted connections",
                    "unit": "m",
                    "quantity": round(total_struts, 2),
                    "rate": rates["strut"],
                    "amount": round(total_struts * rates["strut"], 2),
                }
            )
            item_no += 1

        if quantities.purlins_m > 0:
            structure_items.append(
                {
                    "item_no": f"B.{item_no}",
                    "description": f"Purlins, {int(self.sizes.purlin[0]*1000)}x{int(self.sizes.purlin[1]*1000)}mm sawn softwood, supported on struts",
                    "unit": "m",
                    "quantity": round(quantities.purlins_m, 2),
                    "rate": rates["purlin"],
                    "amount": round(quantities.purlins_m * rates["purlin"], 2),
                }
            )
            item_no += 1

        if quantities.ridge_m > 0:
            structure_items.append(
                {
                    "item_no": f"B.{item_no}",
                    "description": f"Ridge board, {int(self.sizes.ridge[0]*1000)}x{int(self.sizes.ridge[1]*1000)}mm sawn softwood, fixed to rafters",
                    "unit": "m",
                    "quantity": round(quantities.ridge_m, 2),
                    "rate": rates["ridge"],
                    "amount": round(quantities.ridge_m * rates["ridge"], 2),
                }
            )
            item_no += 1

        if quantities.hips_m > 0:
            structure_items.append(
                {
                    "item_no": f"B.{item_no}",
                    "description": "Hip rafters, 175x38mm sawn softwood, mitred at ridge",
                    "unit": "m",
                    "quantity": round(quantities.hips_m, 2),
                    "rate": rates["hip"],
                    "amount": round(quantities.hips_m * rates["hip"], 2),
                }
            )
            item_no += 1

        if quantities.valleys_m > 0:
            structure_items.append(
                {
                    "item_no": f"B.{item_no}",
                    "description": "Valley rafters, 175x38mm sawn softwood, supported on bearers",
                    "unit": "m",
                    "quantity": round(quantities.valleys_m, 2),
                    "rate": rates["valley"],
                    "amount": round(quantities.valleys_m * rates["valley"], 2),
                }
            )
            item_no += 1

        boq["sections"].append(
            {"section": "B", "title": "ROOF STRUCTURE", "items": structure_items}
        )

        # Roof covering
        if self.covering and quantities.covering_area_m2 > 0:
            covering_items = []
            item_no = 1

            # Battens
            batten_length = quantities.covering_area_m2 / 0.35  # 350mm centres
            covering_items.append(
                {
                    "item_no": f"C.{item_no}",
                    "description": "Roof battens, 40x20mm sawn softwood, fixed at 350mm centres",
                    "unit": "m",
                    "quantity": round(batten_length, 2),
                    "rate": rates["battens"],
                    "amount": round(batten_length * rates["battens"], 2),
                }
            )
            item_no += 1

            # Covering material
            covering_rate = rates.get(self.covering.type, 1500.00)
            covering_description = {
                "tiles": "Clay roof tiles, machine made, laid to half bond",
                "acSheets": "A.C. corrugated sheets, 26 gauge, fixed with J-bolts",
                "giSheets": "G.I. corrugated sheets, 28 gauge, galvanised, fixed with J-bolts",
                "slate": "Natural slate, 500x250mm, centre nailed",
                "thatch": "Thatch covering, 200mm thick, tied to battens",
            }.get(self.covering.type, "Roof covering")

            area_with_wastage = quantities.covering_area_m2 * (
                1 + self.covering.wastage_percent / 100
            )
            covering_items.append(
                {
                    "item_no": f"C.{item_no}",
                    "description": f"{covering_description}, including {self.covering.wastage_percent}% wastage",
                    "unit": "m²",
                    "quantity": round(area_with_wastage, 2),
                    "rate": covering_rate,
                    "amount": round(area_with_wastage * covering_rate, 2),
                }
            )
            item_no += 1

            # Ridge covering
            if quantities.ridge_cover_m > 0:
                covering_items.append(
                    {
                        "item_no": f"C.{item_no}",
                        "description": "Ridge capping, bedded in c.m. (1:3), including end caps",
                        "unit": "m",
                        "quantity": round(quantities.ridge_cover_m, 2),
                        "rate": rates["ridge_cover"],
                        "amount": round(
                            quantities.ridge_cover_m * rates["ridge_cover"], 2
                        ),
                    }
                )
                item_no += 1

            boq["sections"].append(
                {"section": "C", "title": "ROOF COVERING", "items": covering_items}
            )

        # Eaves and verges
        if quantities.fascia_m > 0:
            eaves_items = []
            item_no = 1

            eaves_items.append(
                {
                    "item_no": f"D.{item_no}",
                    "description": f"Fascia board, {int(self.sizes.fascia[0]*1000)}x{int(self.sizes.fascia[1]*1000)}mm sawn softwood, treated",
                    "unit": "m",
                    "quantity": round(quantities.fascia_m, 2),
                    "rate": rates["fascia"],
                    "amount": round(quantities.fascia_m * rates["fascia"], 2),
                }
            )
            item_no += 1

            if quantities.verge_m > 0:
                eaves_items.append(
                    {
                        "item_no": f"D.{item_no}",
                        "description": "Verge boards, 200x25mm sawn softwood, with tile undercloak",
                        "unit": "m",
                        "quantity": round(quantities.verge_m, 2),
                        "rate": rates["verge"],
                        "amount": round(quantities.verge_m * rates["verge"], 2),
                    }
                )
                item_no += 1

            if quantities.bearers_m > 0:
                eaves_items.append(
                    {
                        "item_no": f"D.{item_no}",
                        "description": f"Eaves bearers, {int(self.sizes.bearer[0]*1000)}x{int(self.sizes.bearer[1]*1000)}mm sawn softwood, at {int(self.dims.bearer_spacing * 1000)}mm centres",
                        "unit": "m",
                        "quantity": round(quantities.bearers_m, 2),
                        "rate": rates["bearer"],
                        "amount": round(quantities.bearers_m * rates["bearer"], 2),
                    }
                )
                item_no += 1

            total_soffit = quantities.soffit_area_m2 + quantities.verge_soffit_area_m2
            if total_soffit > 0:
                eaves_items.append(
                    {
                        "item_no": f"D.{item_no}",
                        "description": "Soffit boarding, 25mm T&G softwood, vented at 10mm intervals",
                        "unit": "m²",
                        "quantity": round(total_soffit, 2),
                        "rate": rates["soffit"],
                        "amount": round(total_soffit * rates["soffit"], 2),
                    }
                )
                item_no += 1

            boq["sections"].append(
                {"section": "D", "title": "EAVES AND VERGES", "items": eaves_items}
            )

        # Rainwater goods
        if quantities.gutter_len_m > 0:
            rainwater_items = []
            item_no = 1

            rainwater_items.append(
                {
                    "item_no": f"E.{item_no}",
                    "description": "PVC gutters, 100mm half round, including brackets at 1m c/c",
                    "unit": "m",
                    "quantity": round(quantities.gutter_len_m, 2),
                    "rate": rates["gutter"],
                    "amount": round(quantities.gutter_len_m * rates["gutter"], 2),
                }
            )
            item_no += 1

            total_fittings = quantities.gutter_ends_nos + quantities.outlets_nos
            if total_fittings > 0:
                rainwater_items.append(
                    {
                        "item_no": f"E.{item_no}",
                        "description": "Gutter fittings (stop ends, outlets)",
                        "unit": "No",
                        "quantity": total_fittings,
                        "rate": rates["gutter_fitting"],
                        "amount": round(total_fittings * rates["gutter_fitting"], 2),
                    }
                )
                item_no += 1

            if quantities.downpipe_m > 0:
                rainwater_items.append(
                    {
                        "item_no": f"E.{item_no}",
                        "description": "Downpipes, 75mm diameter PVC, including fixings and shoes",
                        "unit": "m",
                        "quantity": round(quantities.downpipe_m, 2),
                        "rate": rates["downpipe"],
                        "amount": round(quantities.downpipe_m * rates["downpipe"], 2),
                    }
                )
                item_no += 1

            boq["sections"].append(
                {"section": "E", "title": "RAINWATER GOODS", "items": rainwater_items}
            )

        # Calculate totals
        subtotal = 0
        for section in boq["sections"]:
            for item in section["items"]:
                subtotal += item["amount"]

        vat = subtotal * 0.16
        total = subtotal + vat

        boq["summary"] = {
            "subtotal": round(subtotal, 2),
            "vat": round(vat, 2),
            "total": round(total, 2),
        }

        return boq


# Example usage function
def example_calculation():
    """Example of how to use the RoofCalculator"""

    # Define roof dimensions
    dims = RoofDimensions(
        building_length=12.0,
        building_width=8.0,
        wall_thickness=0.3,
        overhang=0.6,
        pitch_angle=30.0,
        truss_spacing=1.8,
        rafter_spacing=0.6,
        bearer_spacing=0.6,
    )

    # Define member sizes (using defaults)
    sizes = MemberSizes()

    # Define covering details
    covering = CoveringDetails(
        type="tiles",
        tile_length=0.265,
        tile_width=0.165,
        tile_lap=0.065,
        wastage_percent=10.0,
    )

    # Create calculator
    calculator = RoofCalculator(
        roof_type="gable",
        dimensions=dims,
        member_sizes=sizes,
        material="timber",
        covering=covering,
        has_valley=False,
        downpipe_length=3.0,
    )

    # Calculate quantities
    quantities = calculator.calculate_all()

    # Generate takeoff sheet
    takeoff = calculator.generate_takeoff_sheet(quantities)

    # Generate BOQ
    boq = calculator.generate_boq(quantities)

    return {"quantities": quantities, "takeoff": takeoff, "boq": boq}


if __name__ == "__main__":
    result = example_calculation()
    print("Roof Calculations Complete")
    print(f"Ridge length: {result['quantities'].ridge_m:.2f} m")
    print(f"Total covering area: {result['quantities'].covering_area_m2:.2f} m²")
    print(f"Estimated cost: KES {result['boq']['summary']['total']:,.2f}")
