"""
FastAPI Endpoints for Eurocode 3 Steel Design
Add these to your main FastAPI application
"""

from fastapi import APIRouter, HTTPException
from eurocode_design import (
    BeamDesignRequestEC,
    BeamDesignResponseEC,
    ColumnDesignRequestEC,
    ColumnDesignResponseEC,
    design_beam_eurocode,
    design_column_eurocode,
    EUROCODE_SECTIONS,
    STEEL_PROPERTIES_EC
)

# Create router
eurocode_router = APIRouter(prefix="/api/eurocode", tags=["Eurocode 3"])

# ============================================================================
# EUROCODE BEAM ENDPOINTS
# ============================================================================

@eurocode_router.post("/beams/design", response_model=BeamDesignResponseEC)
async def design_beam_ec3(request: BeamDesignRequestEC):
    """
    Design steel beam according to EN 1993-1-1:2005
    
    **Features:**
    - Section classification (Class 1-4)
    - Moment resistance (M_c,Rd)
    - Lateral-torsional buckling (M_b,Rd)
    - Shear resistance (V_c,Rd)
    - Deflection check (L/250)
    
    **Sections:** IPE, HEA, HEB, HEM
    **Grades:** S235, S275, S355, S420, S460
    """
    try:
        result = design_beam_eurocode(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@eurocode_router.get("/beams/sections/{section_type}")
async def get_ec3_beam_sections(section_type: str):
    """Get available Eurocode beam sections"""
    if section_type not in EUROCODE_SECTIONS:
        raise HTTPException(status_code=400, detail="Invalid section type. Use: IPE, HEA, HEB, or HEM")
    return list(EUROCODE_SECTIONS[section_type].keys())

# ============================================================================
# EUROCODE COLUMN ENDPOINTS
# ============================================================================

@eurocode_router.post("/columns/design", response_model=ColumnDesignResponseEC)
async def design_column_ec3(request: ColumnDesignRequestEC):
    """
    Design steel column according to EN 1993-1-1:2005 Section 6.3
    
    **Features:**
    - Section classification
    - Compression resistance (N_c,Rd)
    - Buckling resistance (N_b,Rd)
    - Moment resistance (M_c,Rd)
    - Buckling curves (a0, a, b, c, d)
    - Interaction check (Eq 6.61 & 6.62)
    
    **Buckling Curves (Table 6.2):**
    - Rolled I/H sections: b (major), c (minor)
    - Welded I/H sections: c (major), d (minor)
    """
    try:
        result = design_column_eurocode(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@eurocode_router.get("/columns/sections/{section_type}")
async def get_ec3_column_sections(section_type: str):
    """Get available Eurocode column sections"""
    if section_type not in EUROCODE_SECTIONS:
        raise HTTPException(status_code=400, detail="Invalid section type. Use: HEA, HEB, or HEM")
    return list(EUROCODE_SECTIONS[section_type].keys())

# ============================================================================
# SECTION PROPERTIES
# ============================================================================

@eurocode_router.get("/section-properties/{section_type}/{designation}")
async def get_ec3_section_properties(section_type: str, designation: str):
    """Get detailed section properties for Eurocode sections"""
    if section_type not in EUROCODE_SECTIONS:
        raise HTTPException(status_code=400, detail="Invalid section type")
    
    if designation not in EUROCODE_SECTIONS[section_type]:
        raise HTTPException(status_code=400, detail=f"Section {designation} not found")
    
    section = EUROCODE_SECTIONS[section_type][designation]
    return section.dict()

# ============================================================================
# MATERIAL PROPERTIES
# ============================================================================

@eurocode_router.get("/materials")
async def get_ec3_materials():
    """Get Eurocode steel grades and properties"""
    return {
        "standard": "EN 1993-1-1:2005",
        "steel_grades": {
            "S235": {
                "fy_t40": STEEL_PROPERTIES_EC["S235"]["t_40"],
                "fy_t80": STEEL_PROPERTIES_EC["S235"]["t_80"],
                "fu": STEEL_PROPERTIES_EC["S235"]["fu"],
                "E": STEEL_PROPERTIES_EC["S235"]["E"],
                "description": "Structural steel grade S235"
            },
            "S275": {
                "fy_t40": STEEL_PROPERTIES_EC["S275"]["t_40"],
                "fy_t80": STEEL_PROPERTIES_EC["S275"]["t_80"],
                "fu": STEEL_PROPERTIES_EC["S275"]["fu"],
                "E": STEEL_PROPERTIES_EC["S275"]["E"],
                "description": "Structural steel grade S275"
            },
            "S355": {
                "fy_t40": STEEL_PROPERTIES_EC["S355"]["t_40"],
                "fy_t80": STEEL_PROPERTIES_EC["S355"]["t_80"],
                "fu": STEEL_PROPERTIES_EC["S355"]["fu"],
                "E": STEEL_PROPERTIES_EC["S355"]["E"],
                "description": "High strength structural steel S355"
            },
            "S420": {
                "fy_t40": STEEL_PROPERTIES_EC["S420"]["t_40"],
                "fy_t80": STEEL_PROPERTIES_EC["S420"]["t_80"],
                "fu": STEEL_PROPERTIES_EC["S420"]["fu"],
                "E": STEEL_PROPERTIES_EC["S420"]["E"],
                "description": "High strength structural steel S420"
            },
            "S460": {
                "fy_t40": STEEL_PROPERTIES_EC["S460"]["t_40"],
                "fy_t80": STEEL_PROPERTIES_EC["S460"]["t_80"],
                "fu": STEEL_PROPERTIES_EC["S460"]["fu"],
                "E": STEEL_PROPERTIES_EC["S460"]["E"],
                "description": "Very high strength structural steel S460"
            }
        },
        "partial_factors": {
            "gamma_M0": 1.00,
            "gamma_M1": 1.00,
            "gamma_M2": 1.25
        }
    }

# ============================================================================
# INFORMATION ENDPOINT
# ============================================================================

@eurocode_router.get("/")
async def eurocode_info():
    """Get information about Eurocode 3 module"""
    return {
        "module": "Eurocode 3 Steel Design",
        "standard": "EN 1993-1-1:2005",
        "features": [
            "Beam design with lateral-torsional buckling",
            "Column design with buckling interaction",
            "Section classification (Class 1-4)",
            "Multiple section types (IPE, HEA, HEB, HEM)",
            "Steel grades S235 to S460"
        ],
        "sections": {
            "IPE": "European I-beams (standard)",
            "HEA": "European wide flange (light)",
            "HEB": "European wide flange (medium)",
            "HEM": "European wide flange (heavy)"
        },
        "documentation": "EN 1993-1-1:2005 - Eurocode 3: Design of steel structures"
    }

# ============================================================================
# BUCKLING CURVES REFERENCE
# ============================================================================

@eurocode_router.get("/buckling-curves")
async def get_buckling_curves_info():
    """
    Get buckling curve selection guide (EN 1993-1-1 Table 6.2)
    """
    return {
        "standard": "EN 1993-1-1 Table 6.2",
        "curves": {
            "a0": {
                "alpha": 0.13,
                "description": "Special quality (S < 0.5)",
                "applications": ["Specially produced hollow sections"]
            },
            "a": {
                "alpha": 0.21,
                "description": "High quality rolled sections",
                "applications": [
                    "Rolled I sections (tf ≤ 40mm)",
                    "Rolled RHS (hot finished)"
                ]
            },
            "b": {
                "alpha": 0.34,
                "description": "Standard rolled sections",
                "applications": [
                    "Rolled I sections (40mm < tf ≤ 100mm) - major axis",
                    "Welded I sections (tf ≤ 40mm) - major axis"
                ]
            },
            "c": {
                "alpha": 0.49,
                "description": "Thicker or welded sections",
                "applications": [
                    "Rolled I sections - minor axis",
                    "Welded I sections (40mm < tf ≤ 100mm) - major axis",
                    "Rolled channels and angles"
                ]
            },
            "d": {
                "alpha": 0.76,
                "description": "Heavy welded sections",
                "applications": [
                    "Welded I sections - minor axis",
                    "Welded box sections"
                ]
            }
        },
        "typical_selections": {
            "rolled_I_H_sections": {
                "major_axis": "b",
                "minor_axis": "c"
            },
            "welded_I_H_sections": {
                "major_axis": "c",
                "minor_axis": "d"
            }
        }
    }

# ============================================================================
# SECTION CLASSIFICATION GUIDE
# ============================================================================

@eurocode_router.get("/section-classification-guide")
async def get_section_classification_guide():
    """
    Get section classification guide (EN 1993-1-1 Table 5.2)
    """
    return {
        "standard": "EN 1993-1-1 Table 5.2",
        "classes": {
            "1": {
                "name": "Class 1 - Plastic",
                "description": "Cross-sections can form plastic hinge with rotation capacity",
                "plastic_analysis": "Yes",
                "section_modulus": "Plastic (Wpl)"
            },
            "2": {
                "name": "Class 2 - Compact",
                "description": "Cross-sections can develop plastic moment resistance",
                "plastic_analysis": "Limited",
                "section_modulus": "Plastic (Wpl)"
            },
            "3": {
                "name": "Class 3 - Semi-compact",
                "description": "Stress in extreme compression fibre can reach fy",
                "plastic_analysis": "No",
                "section_modulus": "Elastic (Wel)"
            },
            "4": {
                "name": "Class 4 - Slender",
                "description": "Local buckling occurs before reaching fy",
                "plastic_analysis": "No",
                "section_modulus": "Effective (Weff)"
            }
        },
        "note": "Classification depends on element slenderness (c/t ratio) and stress distribution"
    }

# ============================================================================
# Add this router to your main app
# ============================================================================
# In main.py:
# from eurocode_api import eurocode_router
# app.include_router(eurocode_router)