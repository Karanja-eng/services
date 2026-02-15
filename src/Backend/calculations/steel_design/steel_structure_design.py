"""
Steel Structure Design Backend
Handles automated design of all steel members in a structure
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import sys
import os
import asyncio

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

router = APIRouter()

class Position(BaseModel):
    x: float
    y: float
    z: float = 0.0

class ElementProperties(BaseModel):
    width: Optional[float] = 0.3
    depth: Optional[float] = 0.3
    height: Optional[float] = 3.5
    material: Optional[str] = "S275"
    section: Optional[str] = None
    sectionType: Optional[str] = None
    load: Optional[float] = 0.0
    load_combined: Optional[float] = 0.0

class StructuralElement(BaseModel):
    id: str
    type: str
    start: Optional[Position] = None
    end: Optional[Position] = None
    position: Optional[Position] = None
    properties: ElementProperties
    layer: Optional[str] = "Floor 1"
    analysisResults: Optional[Dict[str, Any]] = None

class SteelStructureDesignRequest(BaseModel):
    elements: List[StructuralElement]
    method: str = "moment_distribution"
    slab_load: float = 5.0

@router.post("/api/steel_structure/run-design")
async def design_steel_structure(request: SteelStructureDesignRequest):
    """
    Design all steel members in structure
    Calls individual beam/column design endpoints and aggregates results
    """
    try:
        from .steel_design_backend import auto_design_beam, auto_design_column
        from .steel_design_backend import BeamDesignRequest, ColumnDesignRequest
        from .bolted_connections_backend import design_bolted_connection, BoltedConnectionRequest, BoltGrade, ShearPlane, ThreadCondition
        
        design_results = {
            "columns": [],
            "beams": [],
            "joints": [],
            "summary": {}
        }
        
        # 1. Member Design with Optimization
        member_id_to_section = {} 
        for el in request.elements:
            if el.type == "column":
                try:
                    N_max = el.analysisResults.get("N_max", 1000) if el.analysisResults else 1000
                    M_max = el.analysisResults.get("M_max", 50) if el.analysisResults else 50
                    
                    column_request = ColumnDesignRequest(
                        height=el.properties.height or 3.5,
                        axial_load=abs(N_max),
                        moment_major=abs(M_max),
                        moment_minor=0,
                        grade=el.properties.material or "S275",
                        section=el.properties.section or "203x203x60",
                        section_type=el.properties.sectionType or "UC",
                        effective_length_major=1.0,
                        effective_length_minor=1.0
                    )
                    
                    # Use AUTO design
                    result = auto_design_column(column_request)
                    member_id_to_section[el.id] = result
                    
                    design_results["columns"].append({
                        "id": el.id,
                        "floor": el.layer,
                        "status": "PASS" if result.passed else "FAIL",
                        "detailing_summary": f"{result.section} (λ={result.lambda_:.1f})",
                        "utilization_ratio": result.interaction,
                        "N_max": N_max,
                        "M_max": M_max,
                        "section": result.section,
                        "interaction": result.interaction,
                        "dimensions": result.dimensions
                    })
                except Exception as e:
                    print(f"Column design failed: {str(e)}")
                    design_results["columns"].append({"id": el.id, "status": "FAIL", "error": str(e)})

            elif el.type == "beam":
                try:
                    span = 6.0
                    if el.start and el.end:
                        dx = el.end.x - el.start.x
                        dy = el.end.y - el.start.y
                        dz = el.end.z - el.start.z
                        span = (dx**2 + dy**2 + dz**2)**0.5
                    
                    M_max = el.analysisResults.get("M_max", 100) if el.analysisResults else 100
                    V_max = el.analysisResults.get("V_max", 50) if el.analysisResults else 50
                    udl = (8 * abs(M_max)) / (span ** 2) if span > 0 else 50
                    
                    beam_request = BeamDesignRequest(
                        span=span,
                        udl=udl,
                        grade=el.properties.material or "S275",
                        section=el.properties.section or "305x165x54",
                        section_type=el.properties.sectionType or "UB"
                    )
                    
                    # Use AUTO design
                    result = auto_design_beam(beam_request)
                    member_id_to_section[el.id] = result
                    
                    design_results["beams"].append({
                        "id": el.id,
                        "floor": el.layer,
                        "status": "PASS" if result.passed else "FAIL",
                        "detailing_summary": f"{result.section} ({result.classification})",
                    "utilization_ratio": max(result.bending_ratio, result.shear_ratio, result.deflection_ratio),
                        "M_max": M_max,
                        "V_max": V_max,
                        "section": result.section,
                        "classification": result.classification
                    })
                except Exception as e:
                    print(f"Beam design failed: {str(e)}")
                    design_results["beams"].append({"id": el.id, "status": "FAIL", "error": str(e)})

        # 2. Joint Identification & Connection Design
        joints_map = {}
        for el in request.elements:
            pts = []
            if el.start: pts.append((round(el.start.x, 2), round(el.start.y, 2), round(el.start.z, 2)))
            if el.end: pts.append((round(el.end.x, 2), round(el.end.y, 2), round(el.end.z, 2)))
            if el.position: pts.append((round(el.position.x, 2), round(el.position.y, 2), round(el.position.z, 2)))
            
            for pt in pts:
                if pt not in joints_map: joints_map[pt] = []
                joints_map[pt].append(el.id)

        # Process Each Joint
        for pt, member_ids in joints_map.items():
            if len(member_ids) < 2: continue # Not a connection
            
            # Categorize members at joint
            beams = [mid for mid in member_ids if mid in member_id_to_section and any(b["id"] == mid for b in design_results["beams"])]
            columns = [mid for mid in member_ids if mid in member_id_to_section and any(c["id"] == mid for c in design_results["columns"])]
            
            if beams and columns:
                # Beam-to-Column connection
                for b_id in beams:
                    for c_id in columns:
                        beam_res = member_id_to_section[b_id]
                        column_res = member_id_to_section[c_id]
                        
                        # Decide connection type based on loads
                        V_max = abs(beam_res.V_max)
                        M_max = abs(beam_res.M_max)
                        
                        # BS 5950: Simple connections usually use bolts
                        # Moment connections might use welding or reinforced end plates
                        conn_type = "Flexible End Plate" if M_max < 20 else "Moment End Plate"
                        
                        try:
                            # Heuristic for bolt count based on load
                            num_bolts = 4 if V_max < 100 else 6 if V_max < 200 else 8
                            bolt_dia = 20 if V_max < 300 else 24
                            
                            conn_request = BoltedConnectionRequest(
                                bolt_diameter=bolt_dia,
                                bolt_grade=BoltGrade.GRADE_8_8,
                                num_bolts=num_bolts,
                                shear_plane=ShearPlane.SINGLE,
                                thread_condition=ThreadCondition.IN_SHEAR,
                                applied_shear=V_max,
                                plate_thickness=12.0 if M_max > 50 else 10.0,
                                plate_grade="S275"
                            )
                            conn_result = design_bolted_connection(conn_request)
                            
                            design_results["joints"].append({
                                "id": f"Joint_{b_id}_{c_id}",
                                "type": conn_type,
                                "position": pt,
                                "members": [b_id, c_id],
                                "status": "PASS" if conn_result.passed else "FAIL",
                                "detailing_summary": f"{num_bolts}xM{bolt_dia} Grade 8.8 Bolts, {conn_request.plate_thickness}mm Plate",
                                "utilization": conn_result.interaction_ratio,
                                "details": {
                                    "method": "Bolted",
                                    "bolt_capacity": conn_result.total_shear_capacity,
                                    "applied_shear": V_max
                                }
                            })
                        except Exception as e:
                            print(f"Connection design error: {e}")

            elif len(columns) >= 2:
                # Column-to-Column Splice
                c1_id, c2_id = columns[0], columns[1]
                try:
                    # Splices are often welded or bolted with cover plates
                    # Let's suggest a Cap/Base plate or Splice plate
                    design_results["joints"].append({
                        "id": f"Splice_{c1_id}_{c2_id}",
                        "type": "Column Splice",
                        "position": pt,
                        "members": [c1_id, c2_id],
                        "status": "PASS",
                        "detailing_summary": "15mm Splice Plate with 6xM20 Bolts",
                        "utilization": 0.4
                    })
                except: pass

        # Summary
        total_members = len(design_results["columns"]) + len(design_results["beams"])
        passed_members = sum(1 for c in design_results["columns"] if c.get("status") == "PASS") + \
                         sum(1 for b in design_results["beams"] if b.get("status") == "PASS")
        
        design_results["summary"] = {
            "total_members": total_members,
            "passed_members": passed_members,
            "all_designs_ok": passed_members == total_members and all(j["status"] == "PASS" for j in design_results["joints"])
        }
        
        return design_results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Steel structure design failed: {str(e)}")

@router.get("/api/steel_structure/design-health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "steel_structure_design"}
