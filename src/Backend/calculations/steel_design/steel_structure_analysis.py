
#Steel Structure Analysis Backend
#Handles frame analysis for steel structures using existing analysis engine


from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import sys
import os

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

class SteelStructureAnalysisRequest(BaseModel):
    elements: List[StructuralElement]
    method: str = "moment_distribution"
    slab_load: float = 5.0

class AnalysisResult(BaseModel):
    element_id: str
    element_type: str
    N_max: float
    M_max: float
    V_max: float
    sections: Optional[Dict[str, Any]] = None

@router.post("/api/steel_structure/analyze-full")
async def analyze_steel_structure(request: SteelStructureAnalysisRequest):
    """
    Analyze steel frame structure
    Reuses existing frame analysis engine but with steel section properties
    """
    try:
        # Import the existing frame analysis function
        from ..tall_framed.full_building_analysis import analyze_full_building, BuildingAnalysisRequest
        
        # Transform steel elements to format expected by analysis engine
        transformed_elements = []
        for el in request.elements:
            element_dict = {
                "id": el.id,
                "type": el.type,
                "properties": {
                    "width": el.properties.width or 0.3,
                    "depth": el.properties.depth or 0.3,
                    "height": el.properties.height or 3.5,
                    "material_grade": el.properties.material or "S275",
                    "section": el.properties.section,
                    "sectionType": el.properties.sectionType,
                    "load_combined": el.properties.load_combined or el.properties.load or 0.0
                },
                "layer": el.layer or "Floor 1"
            }
            
            # Add position data
            if el.type in ["beam", "wall"]:
                element_dict["start"] = {
                    "x": el.start.x if el.start else 0,
                    "y": el.start.y if el.start else 0,
                    "z": el.start.z if el.start else 0
                }
                element_dict["end"] = {
                    "x": el.end.x if el.end else 5,
                    "y": el.end.y if el.end else 0,
                    "z": el.end.z if el.end else 0
                }
            elif el.type == "column":
                pos = el.position or Position(x=0, y=0, z=0)
                h = el.properties.height or 3.5
                element_dict["start"] = {"x": pos.x, "y": pos.y, "z": pos.z}
                element_dict["end"] = {"x": pos.x, "y": pos.y, "z": pos.z + h}
            else:
                pos = el.position or Position(x=0, y=0, z=0)
                element_dict["position"] = {"x": pos.x, "y": pos.y, "z": pos.z}
            
            transformed_elements.append(element_dict)
        
        # Create analysis request in expected format
        analysis_request = {
            "elements": transformed_elements,
            "method": request.method,
            "slab_load": request.slab_load
        }
        
        # Call existing analysis function
        analysis_obj = BuildingAnalysisRequest(**analysis_request)
        results = await analyze_full_building(analysis_obj)
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Steel structure analysis failed: {str(e)}")

@router.get("/api/steel_structure/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "steel_structure_analysis"}
