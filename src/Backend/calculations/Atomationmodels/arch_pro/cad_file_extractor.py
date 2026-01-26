import os
import io
import json
import logging
from typing import List, Optional, Dict, Tuple
from pathlib import Path

# Optional libraries for CAD formats
try:
    import ezdxf
    EZDXF_OK = True
except ImportError:
    EZDXF_OK = False

try:
    import ifcopenshell
    import ifcopenshell.util.element
    IFC_OK = True
except ImportError:
    IFC_OK = False

from .models import Wall, Opening, Room, FloorPlan, WallSegment

logger = logging.getLogger(__name__)

class CADFileProcessor:
    def __init__(self):
        self.ppm = 100 
        self.unit_factor = 1.0 # Default to meters

    def _auto_detect_unit(self, dims: List[float]) -> float:
        # Heuristic: if dimensions are very large (thousands), assume mm
        if any(d > 500 for d in dims):
            return 0.001
        return 1.0

    def extract_from_file(self, file_path: str) -> Optional[FloorPlan]:
        suffix = Path(file_path).suffix.lower()
        if suffix == '.dxf':
            result = self.extract_from_dxf(file_path)
            return [result] if result else []
        elif suffix in ['.ifc']:
            return self.extract_from_ifc(file_path)
        else:
            logger.error(f"Unsupported CAD file format: {suffix}")
            return None

    def extract_from_dxf(self, file_path: str) -> Optional[FloorPlan]:
        if not EZDXF_OK:
            logger.error("ezdxf not installed")
            return None
        
        try:
            doc = ezdxf.readfile(file_path)
            msp = doc.modelspace()
            
            # Detect unit from bounds
            limits = doc.header.get('$LIMMAX', [10, 10])
            self.unit_factor = self._auto_detect_unit([limits[0], limits[1]])
            
            walls, doors, windows, rooms = [], [], [], []
            
            # Refined layer patterns
            WALL_PATTERNS = ["WALL", "STRUCT", "BRICK", "PARTITION"]
            DOOR_PATTERNS = ["DOOR", "OPENING", "ENTRY"]
            WINDOW_PATTERNS = ["WIND", "GLAZ", "SASH"]

            def matches(layer, patterns):
                return any(p in layer.upper() for p in patterns)

            for entity in msp.query('LINE LWPOLYLINE POLYLINE'):
                layer = entity.dxf.layer.upper()
                
                if matches(layer, WALL_PATTERNS):
                    if entity.dxftype() == 'LINE':
                        start = [entity.dxf.start.x * self.unit_factor, entity.dxf.start.y * self.unit_factor]
                        end = [entity.dxf.end.x * self.unit_factor, entity.dxf.end.y * self.unit_factor]
                        length = ((start[0]-end[0])**2 + (start[1]-end[1])**2)**0.5
                        walls.append(Wall(
                            id=f"wall_dxf_{len(walls)}",
                            start=start,
                            end=end,
                            thickness=0.15,
                            length=round(length, 2)
                        ))
            
            for block_ref in msp.query('INSERT'):
                name = block_ref.dxf.name.upper()
                pos = [block_ref.dxf.insert.x * self.unit_factor, block_ref.dxf.insert.y * self.unit_factor]
                rot = block_ref.dxf.rotation
                
                if matches(name, DOOR_PATTERNS):
                    doors.append(Opening(
                        id=f"door_dxf_{len(doors)}",
                        position=pos,
                        width=0.9, height=2.1, rotation=rot, type="door"
                    ))
                elif matches(name, WINDOW_PATTERNS):
                    windows.append(Opening(
                        id=f"window_dxf_{len(windows)}",
                        position=pos,
                        width=1.2, height=1.2, rotation=rot, type="window"
                    ))

            return FloorPlan(
                level=0,
                walls=walls,
                doors=doors,
                windows=windows,
                rooms=rooms
            )
        except Exception as e:
            logger.exception(f"Error parsing DXF: {e}")
            return None

    def extract_from_ifc(self, file_path: str) -> List[FloorPlan]:
        if not IFC_OK:
            logger.error("ifcopenshell not installed")
            return []
        
        try:
            import ifcopenshell.geom
            model = ifcopenshell.open(file_path)
            
            settings = ifcopenshell.geom.settings()
            settings.set(settings.USE_WORLD_COORDS, True)
            
            storeys = model.by_type("IfcBuildingStorey")
            if not storeys:
                # Fallback if no storey defined
                return []

            floor_plans = []
            
            # Helper to get centroid and dimensions from shape
            def get_geom_info(element):
                try:
                    shape = ifcopenshell.geom.create_shape(settings, element)
                    verts = shape.geometry.verts
                    pts = [verts[i:i+3] for i in range(0, len(verts), 3)]
                    if not pts: return None
                    xs, ys, zs = [p[0] for p in pts], [p[1] for p in pts], [p[2] for p in pts]
                    center = [(min(xs)+max(xs))/2, (min(ys)+max(ys))/2, (min(zs)+max(zs))/2]
                    dims = [max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs)]
                    return {"center": center, "dims": dims, "bounds": [[min(xs), min(ys)], [max(xs), max(ys)]]}
                except: return None

            for storey in storeys:
                walls, doors, windows, rooms, columns, beams, furniture = [], [], [], [], [], [], []
                
                # Get elements contained in this storey
                elements = ifcopenshell.util.element.get_decomposition(storey)
                
                for element in elements:
                    info = get_geom_info(element)
                    if not info: continue
                    
                    if element.is_a("IfcWall"):
                        dx, dy = info["dims"][0], info["dims"][1]
                        if dx > dy:
                            start, end = [info["bounds"][0][0], info["center"][1]], [info["bounds"][1][0], info["center"][1]]
                        else:
                            start, end = [info["center"][0], info["bounds"][0][1]], [info["center"][0], info["bounds"][1][1]]
                        walls.append(Wall(id=f"wall_{element.GlobalId}", start=start, end=end, thickness=min(dx, dy), length=max(dx, dy)))
                        
                    elif element.is_a("IfcDoor"):
                        doors.append(Opening(id=f"door_{element.GlobalId}", position=[info["center"][0], info["center"][1]], width=max(info["dims"][:2]), height=info["dims"][2], type="door"))
                        
                    elif element.is_a("IfcWindow"):
                        windows.append(Opening(id=f"window_{element.GlobalId}", position=[info["center"][0], info["center"][1]], width=max(info["dims"][:2]), height=info["dims"][2], type="window"))
                    
                    elif element.is_a("IfcSpace"):
                        area = 0.0
                        for prop in ifcopenshell.util.element.get_psets(element).get("BaseQuantities", {}).values():
                            if isinstance(prop, (int, float)) and prop > 0: area = prop; break
                        rooms.append(Room(id=f"room_{element.GlobalId}", name=element.LongName or element.Name or "Room", center=[info["center"][0], info["center"][1]], type="room", area=round(area or (info["dims"][0]*info["dims"][1]), 2)))

                    elif element.is_a("IfcColumn"):
                        columns.append({"id": element.GlobalId, "position": [info["center"][0], info["center"][1]], "size": max(info["dims"][:2])})

                    elif element.is_a("IfcBeam"):
                        beams.append({"id": element.GlobalId, "length": max(info["dims"]), "width": min(info["dims"][:2])})
                    
                    elif element.is_a("IfcFurnishingElement"):
                        furniture.append({"id": element.GlobalId, "type": element.Name or "Furniture", "position": [info["center"][0], info["center"][1]]})

                floor_plans.append(FloorPlan(
                    level=storey.Name or "0",
                    walls=walls,
                    doors=doors,
                    windows=windows,
                    rooms=rooms,
                    columns=columns,
                    beams=beams,
                    furniture=furniture
                ))

            return floor_plans
        except Exception as e:
            logger.exception(f"Error parsing IFC multi-storey: {e}")
            return []
