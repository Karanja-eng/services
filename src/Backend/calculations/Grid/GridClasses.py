
from pydantic import BaseModel



class GridData(BaseModel):
    rows: int
    cols: int
    panelDimensions: dict
    columnDimensions: dict
    beamDimensions: dict

class SlabData(BaseModel):
    id: str
    width: float
    height: float

class ColumnData(BaseModel):
    id: str
    width: float
    height: float
    # rotation: Optional[float] = 0.0

class BeamData(BaseModel):
    id: str
    width: float
    depth: float
    breadth: float

class FoundationData(BaseModel):
    id: str
    width: float
    height: float
    column_id: str
