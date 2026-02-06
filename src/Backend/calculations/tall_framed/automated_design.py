
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import math

from .full_building_analysis import FullBuildingAnalyzer, BuildingAnalysisRequest, BuildingElement

# Import design modules
try:
    from ..Beams.rc_beam_design import BS8110Designer, BeamDesignRequest, BeamType, MaterialProperties, ConcreteGrade, SteelGrade, SupportCondition
    from ..Columns.Interactio import ColumnDesignBS8110
    from ..Foundations.New_foundation import BSFoundationDesigner, FoundationInput
    from ..Walls.New_wall import RCWallDesigner, WallInput
    from ..Slabs.enhanced_slab_backend import EnhancedSlabDesigner, SlabDesignRequest
except ImportError:
    # Fallbacks for local dev or different paths
    from calculations.Beams.rc_beam_design import BS8110Designer, BeamDesignRequest, BeamType, MaterialProperties, ConcreteGrade, SteelGrade, SupportCondition
    from calculations.Columns.Interactio import ColumnDesignBS8110
    from calculations.Foundations.New_foundation import BSFoundationDesigner, FoundationInput
    from calculations.Walls.New_wall import RCWallDesigner, WallInput
    from calculations.Slabs.enhanced_slab_backend import EnhancedSlabDesigner, SlabDesignRequest

router = APIRouter()

class DesignSuiteRequest(BuildingAnalysisRequest):
    # Inherits elements, method, etc.
    concrete_grade: str = "C30/37"
    steel_grade: str = "Grade 460"
    soil_bearing: float = 200.0 # kN/m2

class FullDesignReport(BaseModel):
    beams: List[Dict[str, Any]]
    columns: List[Dict[str, Any]]
    slabs: List[Dict[str, Any]]
    walls: List[Dict[str, Any]]
    foundations: List[Dict[str, Any]]
    summary: Dict[str, Any]

@router.post("/run-design")
async def run_automated_design(request: DesignSuiteRequest):
    try:
        # 1. Run Analysis
        analyzer = FullBuildingAnalyzer(request)
        analyzer.analyze()  # This populates analyzer.results
        analysis_results = analyzer.results
        
        design_report = {
            "beams": [],
            "columns": [],
            "slabs": [],
            "walls": [],
            "foundations": [],
            "summary": {"total_members": len(request.elements), "passed": 0, "failed": 0}
        }

        def get_floor_name(z):
            level = round(z / 3.5) + 1
            if level <= 1: return "Ground Floor"
            return f"Floor {level-1}"

        # 2. Design Beams
        beam_designer = BS8110Designer()
        for beam in analyzer.beams:
            res = analysis_results.get(beam.id)
            if not res: continue
            
            # Prepare Beam Design Request
            span_len = math.sqrt((beam.end.x - beam.start.x)**2 + (beam.end.y - beam.start.y)**2)
            beam_req = BeamDesignRequest(
                beam_type=BeamType.RECTANGULAR,
                span_length=span_len,
                rectangular_geometry={"width": beam.properties.width * 1000, "depth": beam.properties.depth * 1000, "cover": 25},
                materials=MaterialProperties(concrete_grade=ConcreteGrade(request.concrete_grade), steel_grade=SteelGrade(request.steel_grade)),
                design_moments=[res["M_max"]],
                design_shears=[res["V_max"]],
                support_condition=SupportCondition.CONTINUOUS,
                moment_positions=[0],
                shear_positions=[0]
            )
            
            design_res = beam_designer.design_beam(beam_req)
            beam_data = design_res.dict()
            beam_data["id"] = beam.id
            beam_data["floor"] = get_floor_name(beam.start.z)
            
            # Add a summarized detailing string
            if design_res.span_designs:
                sd = design_res.span_designs[0]
                beam_data["detailing_summary"] = f"Bot: {sd.sagging_bars_count}H{sd.sagging_bars_diameter}, Top: {sd.hogging_bars_count}H{sd.hogging_bars_diameter}, Links: H{sd.shear_links_diameter}@{sd.shear_links_spacing}"
            else:
                beam_data["detailing_summary"] = "Designed"
                
            design_report["beams"].append(beam_data)
            
            if design_res.summary.all_designs_ok:
                design_report["summary"]["passed"] += 1
            else:
                design_report["summary"]["failed"] += 1

        # 3. Design Columns
        for col in analyzer.columns:
            res = analysis_results.get(col.id)
            if not res: continue
            
            col_design = ColumnDesignBS8110(
                b=col.properties.width * 1000,
                h=col.properties.depth * 1000,
                fcu=30,
                fy=460,
                N=res["N_max"] * 1000,
                Mx=res["M_max"] * 1e6,
                lo=abs(col.end.z - col.start.z) * 1000
            )
            
            col_data = {
                "id": col.id,
                "floor": get_floor_name(min(col.start.z, col.end.z)),
                "classification": col_design.classification,
                "Asc_req": col_design.Asc_req,
                "steel_percentage": col_design.rho * 100,
                "bar_selection": col_design.num_bars,
                "bar_dia": col_design.bar_dia,
                "links_dia": col_design.links_dia,
                "links_spacing": col_design.links_spacing,
                "status": "PASS" if col_design.rho <= 0.04 else "FAIL"
            }
            design_report["columns"].append(col_data)
            if col_data["status"] == "PASS":
                design_report["summary"]["passed"] += 1
            else:
                design_report["summary"]["failed"] += 1

        # 4. Design Foundations
        base_columns = [c for c in analyzer.columns if min(c.start.z, c.end.z) < 0.1]
        for col in base_columns:
            res = analysis_results.get(col.id)
            if not res: continue
            
            f_input = FoundationInput(
                foundation_type="pad",
                dead_load=max(1.0, res["N_max"]), 
                live_load=1.0, 
                column_width=col.properties.width * 1000,
                column_depth=col.properties.depth * 1000,
                soil_bearing=request.soil_bearing,
                concrete_fck=30,
                steel_fyk=460
            )
            f_designer = BSFoundationDesigner(f_input)
            f_res = f_designer.design_pad_foundation()
            
            f_data = f_res.dict()
            f_data["id"] = f"FND-{col.id}"
            f_data["floor"] = "Foundation"
            f_data["status"] = f_res.design_summary["status"]
            # Ensure detailing for foundations is clear
            if "reinforcement" in f_data:
                f_data["detailing_summary"] = f"Main: {f_data['reinforcement']['main_bars_x']}, Dist: {f_data['reinforcement']['main_bars_y']}"
            
            design_report["foundations"].append(f_data)
            
            if f_res.design_summary["status"] == "PASS":
                design_report["summary"]["passed"] += 1
            else:
                design_report["summary"]["failed"] += 1

        # 5. Design Slabs
        for slab in analyzer.slabs:
            s_type = "two-way" if slab.properties.width > 1.0 and slab.properties.depth > 1.0 else "one-way"
            s_req = SlabDesignRequest(
                slabType=s_type,
                spanType="single",
                support="continuous",
                deadLoad=slab.properties.load_combined or 5.0,
                liveLoad=2.5,
                lx=slab.properties.width if s_type == "two-way" else None,
                ly=slab.properties.depth if s_type == "two-way" else None,
                spanLength=max(slab.properties.width, slab.properties.depth) if s_type == "one-way" else None,
                fck=30,
                fy=460
            )
            s_designer = EnhancedSlabDesigner(s_req)
            if s_req.slabType == "two-way":
                s_res = s_designer.design_two_way_slab()
            else:
                s_res = s_designer.design_one_way_slab()
            
            s_data = s_res.dict()
            s_data["id"] = slab.id
            s_data["floor"] = get_floor_name(slab.position.z)
            s_data["status"] = "PASS" # Default for now
            
            # Summarize slab detailing
            if s_type == "two-way":
                s_data["detailing_summary"] = f"X: {s_data.get('reinforcementX')}, Y: {s_data.get('reinforcementY')}"
            else:
                s_data["detailing_summary"] = f"Main: {s_data.get('mainReinforcement')}, Dist: {s_data.get('distributionSteel')}"
                
            design_report["slabs"].append(s_data)
            design_report["summary"]["passed"] += 1

        # 6. Design Walls
        for wall in analyzer.walls:
            res = analysis_results.get(wall.id)
            if not res: continue
            
            w_input = WallInput(
                height=abs(wall.end.z - wall.start.z) * 1000,
                length=math.sqrt((wall.end.x - wall.start.x)**2 + (wall.end.y - wall.start.y)**2) * 1000,
                thickness=wall.properties.width * 1000,
                fcu=30,
                fy=460,
                N_uz=res["N_max"] * 1000
            )
            w_designer = RCWallDesigner(w_input)
            w_res = w_designer.design_wall()
            
            w_data = w_res.dict()
            w_data["id"] = wall.id
            w_data["floor"] = get_floor_name(min(wall.start.z, wall.end.z))
            
            if "reinforcement" in w_data:
                rv = w_data["reinforcement"].get("vertical", {})
                rh = w_data["reinforcement"].get("horizontal", {})
                w_data["detailing_summary"] = f"V: H{rv.get('diameter')}@{rv.get('spacing')}, H: H{rh.get('diameter')}@{rh.get('spacing')}"
            
            design_report["walls"].append(w_data)
            if w_res.status == "PASS":
                design_report["summary"]["passed"] += 1
            else:
                design_report["summary"]["failed"] += 1

        return design_report

    except Exception as e:
        import traceback
        traceback.print_exc()

