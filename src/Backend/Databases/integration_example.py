"""
Database Integration Example
This file shows how to integrate database operations into existing routers

Example: Surveying Module Integration
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict

# Import database dependencies
from Databases import get_db
from Databases.operations import (
    save_levelling_calculation,
    save_traverse_calculation,
    save_tacheometry_calculation,
    save_column_design,
    save_foundation_design,
    save_manhole_takeoff,
    get_user_calculations,
    get_calculation_by_id
)
from Databases.models import (
    LevellingCalculation,
    ColumnDesign,
    FoundationDesign,
    ManholeTakeoff
)

router = APIRouter()


# ============================================================================
# EXAMPLE 1: Levelling Calculation with Database
# ============================================================================

class LevellingRequest(BaseModel):
    method: str
    benchmark_rl: float
    rows: List[Dict]
    user_id: Optional[str] = None
    project_id: Optional[str] = None


@router.post("/levelling/calculate")
async def calculate_levelling_with_db(
    request: LevellingRequest,
    db: Session = Depends(get_db)
):
    """
    Calculate levelling AND save to database
    
    This wraps the existing calculation logic and adds database persistence
    """
    try:
        # 1. Perform the calculation (existing logic)
        # Import your existing calculation function
        from calculations.surveying.surveying_backend import calculate_levelling
        
        # Call existing calculation
        result = calculate_levelling(request)
        
        # 2. Save to database
        try:
            db_record = save_levelling_calculation(
                db=db,
                method=request.method,
                benchmark_rl=request.benchmark_rl,
                rows_data=[row.dict() for row in request.rows],
                calculated_rows=result['rows'],
                arithmetic_checks=result['arithmetic_checks'],
                is_valid=result['is_valid'],
                user_id=request.user_id,
                project_id=request.project_id
            )
            
            # 3. Add database ID to response
            result['calculation_id'] = str(db_record.id)
            result['saved_at'] = db_record.created_at.isoformat()
            
        except Exception as db_error:
            # Log error but don't fail the request
            print(f"Database save error: {str(db_error)}")
            result['database_saved'] = False
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/levelling/history/{user_id}")
async def get_levelling_history(
    user_id: str,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get user's levelling calculation history"""
    try:
        calculations = get_user_calculations(
            db=db,
            model_class=LevellingCalculation,
            user_id=user_id,
            limit=limit
        )
        
        return {
            "user_id": user_id,
            "count": len(calculations),
            "calculations": [
                {
                    "id": str(calc.id),
                    "method": calc.method,
                    "benchmark_rl": calc.benchmark_rl,
                    "is_valid": calc.is_valid,
                    "created_at": calc.created_at.isoformat()
                }
                for calc in calculations
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/levelling/{calculation_id}")
async def get_levelling_calculation(
    calculation_id: str,
    db: Session = Depends(get_db)
):
    """Retrieve a specific levelling calculation"""
    calc = get_calculation_by_id(db, LevellingCalculation, calculation_id)
    
    if not calc:
        raise HTTPException(status_code=404, detail="Calculation not found")
    
    return {
        "id": str(calc.id),
        "method": calc.method,
        "benchmark_rl": calc.benchmark_rl,
        "rows": calc.calculated_rows,
        "arithmetic_checks": calc.arithmetic_checks,
        "is_valid": calc.is_valid,
        "created_at": calc.created_at.isoformat(),
        "updated_at": calc.updated_at.isoformat()
    }


# ============================================================================
# EXAMPLE 2: Column Design with Database
# ============================================================================

@router.post("/column/design")
async def design_column_with_db(
    data: dict,
    db: Session = Depends(get_db)
):
    """
    Design column AND save to database
    """
    try:
        # 1. Perform calculation (existing logic)
        from calculations.Columns.Interactio import design_column_endpoint
        
        result = await design_column_endpoint(data)
        
        # 2. Save to database if successful
        if result.get('status') == 'success':
            try:
                db_record = save_column_design(
                    db=db,
                    design_mode=data.get('mode', 'uniaxial'),
                    input_data=data,
                    results=result,
                    user_id=data.get('user_id'),
                    project_id=data.get('project_id')
                )
                
                result['calculation_id'] = str(db_record.id)
                result['saved_at'] = db_record.created_at.isoformat()
                
            except Exception as db_error:
                print(f"Database save error: {str(db_error)}")
                result['database_saved'] = False
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# EXAMPLE 3: Foundation Design with Database
# ============================================================================

@router.post("/foundation/design")
async def design_foundation_with_db(
    inputs: dict,
    db: Session = Depends(get_db)
):
    """
    Design foundation AND save to database
    """
    try:
        # 1. Perform calculation
        from calculations.Foundations.foundation_backend_api import design_pad_foundation
        
        result = design_pad_foundation(inputs)
        
        # 2. Save to database
        try:
            db_record = save_foundation_design(
                db=db,
                foundation_type=inputs.get('foundation_type', 'pad'),
                input_data=inputs,
                results=result.dict() if hasattr(result, 'dict') else result,
                user_id=inputs.get('user_id'),
                project_id=inputs.get('project_id')
            )
            
            # Add to response
            if isinstance(result, dict):
                result['calculation_id'] = str(db_record.id)
            else:
                result = result.dict()
                result['calculation_id'] = str(db_record.id)
                
        except Exception as db_error:
            print(f"Database save error: {str(db_error)}")
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# EXAMPLE 4: Manhole Takeoff with Database
# ============================================================================

@router.post("/manholes/calculate")
async def calculate_manholes_with_db(
    project: dict,
    db: Session = Depends(get_db)
):
    """
    Calculate manhole takeoff AND save to database
    """
    try:
        # 1. Perform calculation
        from calculations.takeoff.ManholesBackend import calculate_takeoff
        
        result = calculate_takeoff(project)
        
        # 2. Save to database
        try:
            db_record = save_manhole_takeoff(
                db=db,
                project_name=project.get('project_name', 'Unnamed Project'),
                project_data=project,
                manhole_quantities=result.get('manhole_quantities', {}),
                pipe_quantities=result.get('pipe_quantities', {}),
                total_quantities=result.get('total_quantities', {}),
                boq_items=result.get('boq_items', []),
                user_id=project.get('user_id'),
                project_id=project.get('project_id')
            )
            
            result['calculation_id'] = str(db_record.id)
            result['saved_at'] = db_record.created_at.isoformat()
            
        except Exception as db_error:
            print(f"Database save error: {str(db_error)}")
            result['database_saved'] = False
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# GENERIC PATTERN FOR ANY ENDPOINT
# ============================================================================

"""
GENERIC PATTERN TO ADD DATABASE TO ANY ENDPOINT:

1. Add db: Session = Depends(get_db) parameter
2. Call existing calculation function
3. Save result using appropriate save_* function
4. Add calculation_id to response
5. Handle database errors gracefully (don't break existing functionality)

Example:

@router.post("/any-calculation")
async def calculate_something(
    request: RequestModel,
    db: Session = Depends(get_db)
):
    try:
        # Existing calculation
        result = existing_calculation_function(request)
        
        # Save to database
        try:
            db_record = save_appropriate_model(
                db=db,
                input_data=request.dict(),
                results=result,
                user_id=request.user_id,
                project_id=request.project_id
            )
            result['calculation_id'] = str(db_record.id)
        except Exception as db_error:
            print(f"Database error: {db_error}")
            # Continue without database
        
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
"""


# ============================================================================
# UTILITY ENDPOINTS
# ============================================================================

@router.get("/calculations/recent")
async def get_recent_calculations(
    user_id: Optional[str] = None,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """Get recent calculations across all types"""
    results = {}
    
    if user_id:
        # Get from each model
        results['levelling'] = len(get_user_calculations(db, LevellingCalculation, user_id, limit))
        results['columns'] = len(get_user_calculations(db, ColumnDesign, user_id, limit))
        results['foundations'] = len(get_user_calculations(db, FoundationDesign, user_id, limit))
        results['manholes'] = len(get_user_calculations(db, ManholeTakeoff, user_id, limit))
    
    return results


@router.get("/statistics")
async def get_statistics(db: Session = Depends(get_db)):
    """Get overall statistics"""
    try:
        stats = {
            "total_levelling": db.query(LevellingCalculation).count(),
            "total_columns": db.query(ColumnDesign).count(),
            "total_foundations": db.query(FoundationDesign).count(),
            "total_manholes": db.query(ManholeTakeoff).count(),
        }
        return stats
    except Exception as e:
        return {"error": str(e)}
