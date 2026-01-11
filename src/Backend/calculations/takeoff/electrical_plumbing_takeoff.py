from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class TakeoffItem(BaseModel):
    item_no: str
    description: str
    unit: str
    quantity: float
    rate: float = 0.0
    amount: float = 0.0

class ElectricalPlumbingPayload(BaseModel):
    electrical_points: List[dict]
    plumbing_points: List[dict]
    conduits: List[dict]
    wall_height: float = 3.0

@router.post("/api/calculate")
async def calculate_electrical_plumbing(payload: ElectricalPlumbingPayload):
    try:
        items = []
        
        # 1. Electrical
        sockets = [p for p in payload.electrical_points if p.get("type") == "power_socket"]
        db_panels = [p for p in payload.electrical_points if p.get("type") == "db_panel"]
        
        if db_panels:
            items.append(TakeoffItem(
                item_no="E1.1",
                description=f"Supply and install {len(db_panels)} No. Consumer Unit / DB Panel as per specification.",
                unit="Nr",
                quantity=len(db_panels)
            ))
            
        if sockets:
            items.append(TakeoffItem(
                item_no="E1.2",
                description=f"Supply and install {len(sockets)} No. 13A Twin Power Sockets including faceplates and wiring.",
                unit="Nr",
                quantity=len(sockets)
            ))
            
        # Conduits
        elec_conduit_len = sum([sum([((c['path'][i][0]-c['path'][i-1][0])**2 + (c['path'][i][1]-c['path'][i-1][1])**2 + (c['path'][i][2]-c['path'][i-1][2])**2)**0.5 for i in range(1, len(c['path']))]) for c in payload.conduits if c.get("type") == "electrical"])
        
        if elec_conduit_len > 0:
            items.append(TakeoffItem(
                item_no="E1.3",
                description="20mm Heavy Duty PVC conduits for electrical wiring, concealed in walls/ceilings.",
                unit="m",
                quantity=round(elec_conduit_len, 2)
            ))

        # 2. Plumbing
        sinks = [p for p in payload.plumbing_points if "sink" in p.get("type", "").lower()]
        taps = [p for p in payload.plumbing_points if p.get("type") == "water_inlet"]
        
        if sinks:
            items.append(TakeoffItem(
                item_no="P1.1",
                description=f"Supply and fix {len(sinks)} No. Stainless steel kitchen sinks / wash hand basins.",
                unit="Nr",
                quantity=len(sinks)
            ))
            
        # Pipes
        plumbing_pipe_len = sum([sum([((c['path'][i][0]-c['path'][i-1][0])**2 + (c['path'][i][1]-c['path'][i-1][1])**2 + (c['path'][i][2]-c['path'][i-1][2])**2)**0.5 for i in range(1, len(c['path']))]) for c in payload.conduits if c.get("type") == "water" or c.get("type") == "plumbing"])
        
        if plumbing_pipe_len > 0:
            items.append(TakeoffItem(
                item_no="P1.2",
                description="PPR/PVC Water distribution pipes and waste lines, including all fittings.",
                unit="m",
                quantity=round(plumbing_pipe_len, 2)
            ))

        return {"items": [item.dict() for item in items]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
