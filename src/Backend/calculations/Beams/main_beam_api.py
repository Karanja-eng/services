"""
Complete Structural Engineering Suite
Integrated Three-Moment Theorem, Moment Distribution Method, and BS 8110 Design
Professional structural analysis and design platform
"""

from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import uvicorn

# Import all analysis modules
from .threemain import (
    # Three-Moment Theorem
    ThreeMomentSolver,
    BeamModel,
    # BeamResponse removed to avoid duplication, or keep if needed locally
    router as three_moment_router
)

from .rc_beam_design import (
    # BS 8110 Design models
    BS8110Designer,
    BeamDesignRequest,
    BeamDesignResponse,
    BeamType,
    SupportCondition,
    MaterialProperties,
    RectangularBeamGeometry,
    TBeamGeometry,
    LBeamGeometry,
    BS8110CoefficientsSolver,
    router as design_router
)

from .moment_distribution_backend import (
    # Moment Distribution Method
    MomentDistributionSolver,
    FrameMD,
    MomentDistributionResponse,
    JointMD,
    MemberMD,
    LoadMD,
    MemberType,
    EndCondition,
    JointType,
)

# Create the main router for this module
router = APIRouter()

# Include routers on the module's router
router.include_router(three_moment_router, prefix="/three_analysis", tags=["Three-Moment"])
router.include_router(design_router, prefix="/rc_design", tags=["RC Design"])

# Create the main FastAPI application for standalone test/dev
app = FastAPI(
    title="Professional Structural Engineering Suite",
    version="3.0.0",
    description="Complete structural analysis and design platform",
)

# Include routers
app.include_router(router)
app.include_router(three_moment_router, prefix="/three_analysis", tags=["Three-Moment"])
app.include_router(design_router, prefix="/rc_design", tags=["RC Design"])

# Enable CORS for local development (adjust origins if needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# No startup debug logging; endpoints below are defined on `router` which is
# included on `app` above. The frontend should call the paths defined here.


# ============================================================================
# ROOT ENDPOINT
# ============================================================================


@router.get("/")
async def root():
    """Main API information endpoint"""
    return {
        "name": "Professional Structural Engineering Suite",
        "version": "3.0.0",
        "description": "Complete structural analysis and design platform",
        "features": {
            "analysis_methods": [
                "Three-Moment Theorem (Continuous Beams)",
                "Moment Distribution Method (Hardy Cross for Frames)",
                "Matrix Analysis (Future Enhancement)",
            ],
            "design_codes": [
                "BS 8110 (British Standard for Reinforced Concrete)",
                "Eurocode 2 (Future Enhancement)",
                "ACI 318 (Future Enhancement)",
            ],
            "beam_sections": [
                "Rectangular Sections",
                "T-Beam Sections",
                "L-Beam Sections",
            ],
            "load_types": [
                "Point Loads",
                "Uniformly Distributed Loads (UDL)",
                "Partial UDL",
                "Triangular Loads",
                "Trapezoidal Loads",
            ],
        },
        "capabilities": [
            "Continuous beam analysis with multiple spans",
            "Frame analysis with beams and columns",
            "Reinforced concrete design with complete checks",
            "Professional diagram generation (SFD, BMD, deflection)",
            "Integrated design workflows",
            "Cost estimation and material optimization",
        ],
    }


# ============================================================================
# UTILITY ENDPOINTS
# ============================================================================


@router.get("/methods/comparison")
async def get_methods_comparison():
    """Compare different structural analysis methods"""
    return {
        "analysis_methods": {
            "three_moment_theorem": {
                "name": "Three-Moment Theorem",
                "best_for": "Continuous beams",
                "advantages": [
                    "Direct solution for continuous beams",
                    "Clear physical interpretation",
                    "Suitable for hand calculations",
                    "Excellent for teaching",
                ],
                "limitations": [
                    "Limited to beams only",
                    "Cannot handle frames with columns",
                    "Manual setup for complex loading",
                ],
                "typical_applications": [
                    "Bridge analysis",
                    "Building floor beams",
                    "Continuous girders",
                ],
            },
            "moment_distribution": {
                "name": "Moment Distribution Method (Hardy Cross)",
                "best_for": "Frames with beams and columns",
                "advantages": [
                    "Handles complex frame geometries",
                    "Iterative convergence provides insight",
                    "Can analyze frames with rigid joints",
                    "No matrix operations required",
                ],
                "limitations": [
                    "Slower convergence for large structures",
                    "Manual iteration can be tedious",
                    "Less efficient than matrix methods for large systems",
                ],
                "typical_applications": [
                    "Portal frames",
                    "Multi-story buildings",
                    "Industrial frames",
                    "Bridge bents",
                ],
            },
            "matrix_methods": {
                "name": "Matrix Methods (Direct Stiffness)",
                "best_for": "Large complex structures",
                "advantages": [
                    "Handles any structural configuration",
                    "Direct solution - no iteration",
                    "Easily automated",
                    "Basis for modern FEA software",
                ],
                "limitations": [
                    "Requires matrix operations",
                    "Less physical insight",
                    "Complex for hand calculations",
                ],
                "typical_applications": [
                    "High-rise buildings",
                    "Complex space frames",
                    "Finite element analysis",
                ],
            },
        },
        "selection_guide": {
            "continuous_beams": "Use Three-Moment Theorem",
            "simple_frames": "Use Moment Distribution Method",
            "complex_structures": "Use Matrix Methods",
            "educational_purposes": "Three-Moment Theorem or Moment Distribution",
            "professional_design": "Any method - choose based on complexity",
        },
    }


@router.get("/design_codes/comparison")
async def get_design_codes_comparison():
    """Compare different concrete design codes"""
    return {
        "design_codes": {
            "bs_8110": {
                "name": "BS 8110 (British Standard)",
                "status": "Legacy but still used",
                "region": "UK and former British territories",
                "key_features": [
                    "Permissible stress approach",
                    "Simple design procedures",
                    "Conservative safety factors",
                    "Well-established methods",
                ],
                "typical_usage": "Existing projects, simple structures",
            },
            "eurocode_2": {
                "name": "Eurocode 2 (EN 1992)",
                "status": "Current European standard",
                "region": "European Union and many international projects",
                "key_features": [
                    "Limit state design approach",
                    "Advanced analysis methods",
                    "Performance-based design",
                    "Harmonized across Europe",
                ],
                "typical_usage": "New projects in Europe",
            },
            "aci_318": {
                "name": "ACI 318 (American Concrete Institute)",
                "status": "Current US standard",
                "region": "United States and American-influenced regions",
                "key_features": [
                    "Strength design method",
                    "Regular updates",
                    "Extensive research backing",
                    "Performance-based provisions",
                ],
                "typical_usage": "Projects in Americas",
            },
        },
        "implementation_status": {
            "implemented": ["BS 8110"],
            "planned": ["Eurocode 2", "ACI 318"],
            "under_consideration": ["CSA A23.3 (Canadian)", "AS 3600 (Australian)"],
        },
    }


@router.get("/health")
async def health_check():
    """API health check endpoint"""
    return {
        "status": "healthy",
        "version": "3.0.0",
        "services": {
            "three_moment_analysis": "operational",
            "moment_distribution_analysis": "operational",
            "bs8110_design": "operational",
            "integration_services": "operational",
        },
        "last_updated": "2024-12-20",
    }


# ============================================================================
# MAIN APPLICATION ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    print("=" * 80)
    print("PROFESSIONAL STRUCTURAL ENGINEERING SUITE")
    print("=" * 80)
    print("Starting comprehensive structural analysis and design platform...")
    print("")
    print("Available Analysis Methods:")
    print("  • Three-Moment Theorem (Continuous Beams)")
    print("  • Moment Distribution Method (Hardy Cross for Frames)")
    print("")
    print("Available Design Codes:")
    print("  • BS 8110 (British Standard for Reinforced Concrete)")
    print("")
    print("Supported Sections:")
    print("  • Rectangular Beams")
    print("  • T-Beams")
    print("  • L-Beams")
    print("")
    print("Integration Features:")
    print("  • Complete analysis-to-design workflows")
    print("  • Professional diagram generation")
    print("  • Cost estimation and optimization")
    print("=" * 80)

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001,
        reload=True,
    )

# ============================================================================
# MOMENT DISTRIBUTION METHOD ENDPOINTS
# ============================================================================


@router.post("/moment_distribution/analyze", response_model=MomentDistributionResponse)
async def analyze_moment_distribution(frame: FrameMD):
    """Analyze frame using Moment Distribution Method (Hardy Cross)"""
    try:
        solver = MomentDistributionSolver(frame)
        return solver.solve()
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Moment Distribution analysis failed: {str(e)}"
        )


@router.get("/moment_distribution/examples")
async def get_moment_distribution_examples():
    """Get Moment Distribution Method example configurations"""
    examples = [
        {
            "name": "Two-Span Continuous Beam",
            "description": "Continuous beam analyzed with Hardy Cross method",
            "method": "Moment Distribution (Hardy Cross)",
            "joints": [
                {
                    "joint_id": "A",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 0.0,
                    "y_coordinate": 0.0,
                    "is_support": True,
                },
                {
                    "joint_id": "B",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 6.0,
                    "y_coordinate": 0.0,
                    "is_support": True,
                },
                {
                    "joint_id": "C",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 12.0,
                    "y_coordinate": 0.0,
                    "is_support": True,
                },
            ],
            "members": [
                {
                    "member_id": "AB",
                    "member_type": "Beam",
                    "start_joint_id": "A",
                    "end_joint_id": "B",
                    "length": 6.0,
                    "E": 200e9,
                    "I": 8.33e-6,
                    "loads": [{"load_type": "UDL", "magnitude": 20.0}],
                },
                {
                    "length": 6.0,
                    "E": 200e9,
                    "I": 8.33e-6,
                    "loads": [
                        {"load_type": "Point Load", "magnitude": 50.0, "position": 3.0}
                    ],
                },
                {
                    "length": 8.0,
                    "E": 200e9,
                    "I": 8.33e-6,
                    "loads": [
                        {"load_type": "Point Load", "magnitude": 30.0, "position": 4.0}
                    ],
                },
            ],
            "supports": [
                {"support_type": "Pinned", "position": 0.0},
                {"support_type": "Pinned", "position": 6.0},
                {"support_type": "Pinned", "position": 14.0},
            ],
        },
        {
            "name": "UDL Three-Span Beam",
            "description": "Three spans with uniform loads",
            "method": "Three-Moment Theorem",
            "spans": [
                {
                    "length": 4.0,
                    "E": 200e9,
                    "I": 1e-5,
                    "loads": [
                        {"load_type": "Uniformly Distributed Load", "magnitude": 20.0}
                    ],
                },
                {
                    "length": 6.0,
                    "E": 200e9,
                    "I": 1e-5,
                    "loads": [
                        {"load_type": "Uniformly Distributed Load", "magnitude": 20.0}
                    ],
                },
                {
                    "length": 4.0,
                    "E": 200e9,
                    "I": 1e-5,
                    "loads": [
                        {"load_type": "Uniformly Distributed Load", "magnitude": 20.0}
                    ],
                },
            ],
            "supports": [
                {"support_type": "Pinned", "position": 0.0},
                {"support_type": "Pinned", "position": 4.0},
                {"support_type": "Pinned", "position": 10.0},
                {"support_type": "Pinned", "position": 14.0},
            ],
        },
    ]
    return examples
