"""
BS 8110 Slab Design Calculator - FastAPI Backend
Professional Structural Engineering Application
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import math

app = FastAPI(title="BS 8110 Slab Calculator", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============= DATA MODELS =============

class SlabDesignRequest(BaseModel):
    # Slab configuration
    slabType: str = Field(..., description="one-way, two-way, ribbed, waffle")
    spanType: str = Field(default="single", description="single, multiple")
    support: str = Field(..., description="simply-supported, continuous, cantilever")
    
    # Material properties
    fck: float = Field(default=30, description="Concrete strength (N/mm²)")
    fy: float = Field(default=460, description="Steel yield strength (N/mm²)")
    cover: float = Field(default=25, description="Concrete cover (mm)")
    
    # Loading
    deadLoad: float = Field(..., description="Dead load (kN/m²)")
    liveLoad: float = Field(..., description="Live load (kN/m²)")
    
    # Dimensions - One-way
    spanLength: Optional[float] = Field(default=None, description="Span length (m)")
    slabWidth: Optional[float] = Field(default=1.0, description="Slab width (m)")
    
    # Dimensions - Two-way
    lx: Optional[float] = Field(default=None, description="Short span (m)")
    ly: Optional[float] = Field(default=None, description="Long span (m)")
    
    # Cantilever
    cantileverLength: Optional[float] = Field(default=None, description="Cantilever length (m)")
    
    # Ribbed/Waffle
    ribWidth: Optional[float] = Field(default=125, description="Rib width (mm)")
    ribSpacing: Optional[float] = Field(default=500, description="Rib spacing (mm)")
    topping: Optional[float] = Field(default=50, description="Topping thickness (mm)")
    ribDepth: Optional[float] = Field(default=300, description="Total rib depth (mm)")


class DesignResults(BaseModel):
    slabType: str
    bendingMoment: Optional[float] = None
    bendingMomentX: Optional[float] = None
    bendingMomentY: Optional[float] = None
    shearForce: Optional[float] = None
    effectiveDepth: float
    totalDepth: float
    steelArea: Optional[float] = None
    steelAreaX: Optional[float] = None
    steelAreaY: Optional[float] = None
    mainReinforcement: Optional[str] = None
    distributionSteel: Optional[str] = None
    reinforcementX: Optional[str] = None
    reinforcementY: Optional[str] = None
    ribReinforcement: Optional[str] = None
    toppingReinforcement: Optional[str] = None
    checksPassed: List[str]
    designDetails: Dict


# ============= BS 8110 COEFFICIENTS AND TABLES =============

class BS8110Tables:
    """BS 8110 design tables and coefficients"""
    
    # Table 3.14: Moment coefficients for one-way spanning slabs
    ONE_WAY_MOMENT_COEFFS = {
        'simply-supported': {
            'mid_span': 0.125,
            'support': 0.0
        },
        'continuous': {
            'mid_span_end': 0.086,
            'mid_span_interior': 0.063,
            'support_interior': 0.086,
            'support_end': 0.086
        },
        'cantilever': {
            'support': 0.5,
            'mid_span': 0.0
        }
    }
    
    # Table 3.13: Shear force coefficients
    ONE_WAY_SHEAR_COEFFS = {
        'simply-supported': 0.5,
        'continuous': 0.6,
        'cantilever': 1.0
    }
    
    # Table 3.15: Moment coefficients for two-way spanning slabs (restrained)
    # Based on ly/lx ratio
    TWO_WAY_MOMENT_COEFFS_RESTRAINED = {
        1.0: {'αsx': 0.024, 'αsy': 0.024, 'αsx_neg': 0.031, 'αsy_neg': 0.031},
        1.1: {'αsx': 0.028, 'αsy': 0.023, 'αsx_neg': 0.037, 'αsy_neg': 0.030},
        1.2: {'αsx': 0.032, 