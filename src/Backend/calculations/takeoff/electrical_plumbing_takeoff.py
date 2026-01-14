from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Tuple, Dict
import math

router = APIRouter()

# --- Data Models ---

class Point3D(BaseModel):
    x: float
    y: float
    z: float

class TakeoffItem(BaseModel):
    item_no: str
    description: str
    category: str  # "Electrical" or "Plumbing"
    unit: str
    quantity: float
    rate: float = 0.0
    amount: float = 0.0

class NormalizedDetection(BaseModel):
    class_name: str
    confidence: float = 0.0
    bbox: List[float] = [] # x1, y1, x2, y2
    centroid: Optional[List[float]] = None # x, y

class WallData(BaseModel):
    start: List[float] # x, y
    end: List[float] # x, y
    thickness: float = 0.15
    type: str = "internal" # internal, external

class RoomData(BaseModel):
    name: str # e.g. "Bedroom 1", "Kitchen"
    room_type: str # mapped from YOLO class e.g. "space_bedroom"
    polygon: List[List[float]] # List of [x, y]
    walls_indices: List[int] = [] # Indices into the global wall list
    detected_objects: List[NormalizedDetection] = []

class MEPEnginePayload(BaseModel):
    rooms: List[RoomData]
    walls: List[WallData]
    doors: List[NormalizedDetection]
    windows: List[NormalizedDetection]
    global_objects: List[NormalizedDetection] = []
    level_height: float = 3.0

class MEPEngineResult(BaseModel):
    items: List[TakeoffItem]
    visualization_points: List[Dict] # {type: "socket", pos: {x,y,z}, parent: "room1"}
    visualization_lines: List[Dict] # {type: "conduit", path: [[x,y,z], ...]}

# --- Geometric Helpers ---

def get_distance(p1, p2):
    return math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)

def get_centroid(polygon):
    if not polygon: return [0, 0]
    x_list = [p[0] for p in polygon]
    y_list = [p[1] for p in polygon]
    return [sum(x_list)/len(polygon), sum(y_list)/len(polygon)]

def project_point_to_line(point, line_start, line_end):
    # Vector arithmetic to find nearest point on line segment
    x, y = point
    x1, y1 = line_start
    x2, y2 = line_end
    
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return [x1, y1]
    
    t = ((x - x1) * dx + (y - y1) * dy) / (dx*dx + dy*dy)
    t = max(0, min(1, t)) # Clamp to segment
    
    return [x1 + t * dx, y1 + t * dy]

def find_nearest_wall(point, walls: List[WallData]) -> Tuple[List[float], WallData]:
    best_dist = float('inf')
    best_pt = None
    best_wall = None
    
    for w in walls:
        proj = project_point_to_line(point, w.start, w.end)
        dist = get_distance(point, proj)
        if dist < best_dist:
            best_dist = dist
            best_pt = proj
            best_wall = w
    return best_pt, best_wall

# --- Logic Engines ---

class ElectricalDesigner:
    def __init__(self, data: MEPEnginePayload):
        self.data = data
        self.items = []
        self.viz_points = []
        self.viz_lines = []
        self.cu_location = None # Consumer Unit location

    def process(self):
        # 1. Locate Consumer Unit (CU)
        self.locate_cu()
        
        # 2. Process Rooms
        for room in self.data.rooms:
            self.process_room_lighting(room)
            self.process_room_power(room)
        
        # 3. Calculate Cabling (Approximate Home Runs)
        self.calculate_cabling()

        return self.items, self.viz_points, self.viz_lines

    def locate_cu(self):
        # Default to Kitchen, or Utility, or Entry
        kitchens = [r for r in self.data.rooms if "kitchen" in r.room_type.lower()]
        entries = [r for r in self.data.rooms if "entry" in r.room_type.lower() or "lobby" in r.room_type.lower()]
        
        target_room = None
        if kitchens: target_room = kitchens[0]
        elif entries: target_room = entries[0]
        elif self.data.rooms: target_room = self.data.rooms[0]
        
        if target_room:
            # Place on a wall randomly or near start
            center = get_centroid(target_room.polygon)
            pt, _ = find_nearest_wall(center, self.data.walls)
            self.cu_location = [pt[0], pt[1], 1.5] # 1.5m high
            
            self.viz_points.append({
                "type": "db_panel",
                "pos": {"x": self.cu_location[0], "y": self.cu_location[1], "z": 1.5},
                "meta": "Consumer Unit 12-Way"
            })
            self.items.append(TakeoffItem(
                item_no="E-DB",
                category="Electrical",
                description="Supply and Install 12-Way SPN Consumer Unit inc. breakers",
                unit="Nr", quantity=1
            ))

    def process_room_lighting(self, room: RoomData):
        # A. Center Light
        center = get_centroid(room.polygon)
        light_z = self.data.level_height
        
        self.viz_points.append({
            "type": "light_ceiling",
            "pos": {"x": center[0], "y": center[1], "z": light_z},
            "meta": "LED Pendant"
        })
        self.items.append(TakeoffItem(
            item_no="E-L1", category="Electrical", description="Lighting Point (Ceiling Rose + Flex)", unit="Nr", quantity=1
        ))

        # B. Wall Lights (Living/Bed/Bath)
        if any(x in room.room_type for x in ["living", "bed", "bath"]):
             # Add arbitrary wall lights or based on logic? User said "wall bracket lights too"
            wall_pt, _ = find_nearest_wall(center, self.data.walls)
            self.viz_points.append({
                "type": "light_wall",
                "pos": {"x": wall_pt[0], "y": wall_pt[1], "z": 2.0},
                "meta": "Wall Bracket"
            })
            self.items.append(TakeoffItem(
                item_no="E-L2", category="Electrical", description="Wall Bracket Light Point", unit="Nr", quantity=1
            ))

        # C. Switches (at Doors)
        # Find doors intersecting or inside this room
        # Simple heuristic: find doors close to room centroid (or better, strictly matching geometry)
        # For now, we assume global door list and check proximity to room polygon.
        for door in self.data.doors:
            d_center = door.centroid or [(door.bbox[0]+door.bbox[2])/2, (door.bbox[1]+door.bbox[3])/2]
            # Check if door is near this room
            dist = get_distance(d_center, center)
            # This is a weak check. Ideally we check if door is on room boundary.
            # IMPROVED: Check distance to any point in polygon or wall
            
            # Logic: Place switch on nearest wall to the door latch side.
            # We place it 1.2m high
            switch_pt, _ = find_nearest_wall(d_center, self.data.walls)
            
            # Only add if it's "close enough" and we consider this door "belonging" to this room (entry)
            # A door belongs to 2 rooms usually. We add a switch in EACH room? 
            # Usually strict rule: Switch inside the room.
            pass # Skipping complex point-in-poly for brevity, just placing one switch per room near door for now.
        
        # Simpler: Place 1 switch near the door "closest" to centroid
        best_door_pt = None
        min_dist = float('inf')
        for door in self.data.doors:
            d_c = door.centroid or [(door.bbox[0]+door.bbox[2])/2, (door.bbox[1]+door.bbox[3])/2]
            dst = get_distance(d_c, center)
            if dst < min_dist:
                min_dist = dst
                best_door_pt = d_c
        
        if best_door_pt and min_dist < 5.0: # If reasonably close
             sw_pt, _ = find_nearest_wall(best_door_pt, self.data.walls)
             self.viz_points.append({
                "type": "switch",
                "pos": {"x": sw_pt[0], "y": sw_pt[1], "z": 1.2},
                "meta": "1-Gang 2-Way Switch"
            })
             self.items.append(TakeoffItem(
                item_no="E-SW", category="Electrical", description="10AX Light Switch", unit="Nr", quantity=1
            ))

    def process_room_power(self, room: RoomData):
        # User Logic:
        # Living Room: 1 double socket per wall > ?
        # Kitchen: 3 sockets + cooker
        # Beds: Bedside sockets
        
        center = get_centroid(room.polygon)
        
        sockets_to_add = 0
        is_kitchen = "kitchen" in room.room_type
        is_living = "living" in room.room_type
        is_bed = "bed" in room.room_type
        
        # Detect Beds in the room
        beds = [obj for obj in room.detected_objects if "bed" in obj.class_name.lower()]
        
        if is_bed:
            if beds:
                # Place sockets on either side of bed
                for bed in beds:
                    # Heuristic: bed is a box. Sockets at left/right of headboard.
                    # We treat bed center as anchor.
                    b_c = bed.centroid or [(bed.bbox[0]+bed.bbox[2])/2, (bed.bbox[1]+bed.bbox[3])/2]
                    # Snap to nearest wall (headboard wall)
                    wall_pt, wall = find_nearest_wall(b_c, self.data.walls)
                    
                    # Offset slightly along wall for left/right
                    # Simplification: Just add 2 sockets at that wall point
                    self.viz_points.append({"type": "socket", "pos": {"x": wall_pt[0]-0.5, "y": wall_pt[1], "z": 0.45}, "meta": "Twin Socket (Bed L)"})
                    self.viz_points.append({"type": "socket", "pos": {"x": wall_pt[0]+0.5, "y": wall_pt[1], "z": 0.45}, "meta": "Twin Socket (Bed R)"})
                    self.viz_points.append({"type": "switch", "pos": {"x": wall_pt[0]-0.6, "y": wall_pt[1], "z": 0.9}, "meta": "Bed Switch"}) # Bed switch usually higher or bedside
                    
                    sockets_to_add += 2
                    self.items.append(TakeoffItem(item_no="E-SW-Bed", category="Electrical", description="Bed Head Switch", unit="Nr", quantity=2))
            else:
                # No bed detected, default 2 sockets
                sockets_to_add += 2
                
        elif is_kitchen:
            sockets_to_add = 3
            # Cooker Unit
            c_pt, _ = find_nearest_wall(center, self.data.walls)
            self.viz_points.append({"type": "cooker_unit", "pos": {"x": c_pt[0]+1.0, "y": c_pt[1], "z": 1.2}, "meta": "45A Cooker Switch"})
            self.items.append(TakeoffItem(item_no="E-CKR", category="Electrical", description="45A Cooker Control Unit + Outlet", unit="Nr", quantity=1))
            self.items.append(TakeoffItem(item_no="E-CAB-4", category="Electrical", description="6.0mm² Twin+E Cable (Cooker)", unit="m", quantity=15)) # Guestimate length
            
        elif is_living:
            # 1 per wall? Let's just say 4 for average living room
            sockets_to_add = 4
        
        else:
            # Generic room
            sockets_to_add = 1
            
        # Add Generic Sockets Visualization (distributed)
        if sockets_to_add > 0 and len(room.walls_indices) > 0:
             # Just place them for BOM. visual placement is hard without precise wall loop.
             # We stack them at the "nearest wall" logic for visualization simple
             w_pt, _ = find_nearest_wall(center, self.data.walls)
             for i in range(sockets_to_add):
                 self.viz_points.append({"type": "socket", "pos": {"x": w_pt[0] + (i*0.2), "y": w_pt[1], "z": 0.45}, "meta": "Twin Socket"})
        
        if sockets_to_add > 0:
            self.items.append(TakeoffItem(
                item_no="E-SKT", category="Electrical", description="13A Twin Switched Socket Outlet", unit="Nr", quantity=sockets_to_add
            ))

    def calculate_cabling(self):
        # Rough estimation:
        # Lighting: 1.5mm - Loop in loop out. Perimeter of room / 2 * items
        light_pts = [p for p in self.viz_points if "light" in p['type']]
        socket_pts = [p for p in self.viz_points if "socket" in p['type']]
        
        # 1. Lighting Cabling
        if light_pts:
            # Estimate: Sum of distances between lights + drop to switches
            # Heuristic: 10m per light point average
            total_light_cable = len(light_pts) * 12.0
            self.items.append(TakeoffItem(
                item_no="E-CAB-1.5", category="Electrical", description="1.5mm² Twin+E PVC Cable (Lighting)", unit="m", quantity=total_light_cable
            ))
            
            # Conduits
            self.items.append(TakeoffItem(
                item_no="E-CON-20", category="Electrical", description="20mm PVC Conduit (Lighting)", unit="m", quantity=total_light_cable
            ))

        # 2. Power Cabling (Ring Main)
        if socket_pts:
             # Ring main: Perimeter of house approx.
             # Heuristic: 5m per socket average
             total_pwr_cable = len(socket_pts) * 7.0 
             self.items.append(TakeoffItem(
                item_no="E-CAB-2.5", category="Electrical", description="2.5mm² Twin+E PVC Cable (Power)", unit="m", quantity=total_pwr_cable
            ))
             self.items.append(TakeoffItem(
                item_no="E-CON-25", category="Electrical", description="25mm PVC Conduit (Power)", unit="m", quantity=total_pwr_cable
            ))

class PlumbingDesigner:
    def __init__(self, data: MEPEnginePayload):
        self.data = data
        self.items = []
        self.viz_points = []
        self.viz_lines = []
        
    def process(self):
        # 1. Identify Wet Areas
        for room in self.data.rooms:
            self.scan_fixtures(room)
            
        return self.items, self.viz_points, self.viz_lines
        
    def scan_fixtures(self, room: RoomData):
        # Look for sinks, showers, toilets in detected objects
        # "fixedfurniture sink", "fixedfurniture doublesink", "space bath"
        
        has_sink = False
        has_shower = False
        has_toilet = False # "commode" or infer from bath room type if not detected explicitly?
        
        # Check Room Type
        if "bath" in room.room_type or "toilet" in room.room_type:
            has_shower = True # Assume shower/tub in bath
            
        if "kitchen" in room.room_type:
            has_sink = True
            
        # Check Objects (override/add)
        for obj in room.detected_objects:
            cn = obj.class_name.lower()
            if "sink" in cn: has_sink = True
            if "shower" in cn or "tub" in cn: has_shower = True
            if "toilet" in cn or "wc" in cn: has_toilet = True

        center = get_centroid(room.polygon)
        wall_pt, _ = find_nearest_wall(center, self.data.walls)

        if has_sink:
            self.add_point(wall_pt, "sink", "Kitchen Sink / Basin")
            self.items.append(TakeoffItem(item_no="P-SNK", category="Plumbing", description="Sink/Basin Installation (Waste+Traps)", unit="Nr", quantity=1))
            self.add_piping("Draw-off", 6) # Hot/Cold lengths
            self.add_piping("Waste", 6)

        if has_shower:
            self.add_point([wall_pt[0]+1, wall_pt[1]], "shower", "Shower Mixer Unit")
            self.items.append(TakeoffItem(item_no="P-SHW", category="Plumbing", description="Shower Mixer + Rose", unit="Nr", quantity=1))
            self.add_piping("Draw-off", 5)
            self.add_piping("Waste", 5)
            
        # Boilers / Solar
        # Heuristic: If it's a house (many rooms), add 1 Solar Water Heating provision
        pass

    def add_point(self, loc, ptype, meta):
        self.viz_points.append({
            "type": ptype,
            "pos": {"x": loc[0], "y": loc[1], "z": 0.8}, # Standard plumbing height
            "meta": meta
        })
        
    def add_piping(self, sys_type, length):
        if sys_type == "Draw-off":
            self.items.append(TakeoffItem(item_no="P-PIP-15", category="Plumbing", description="15mm PPR Hot/Cold Pipework", unit="m", quantity=length))
        else:
            self.items.append(TakeoffItem(item_no="P-PIP-40", category="Plumbing", description="40mm PVC Waste Pipework", unit="m", quantity=length))
            

# --- API Endpoint ---

@router.post("/api/calculate")
async def calculate_electrical_plumbing(payload: MEPEnginePayload):
    try:
        # Run Electrical Engine
        elec_eng = ElectricalDesigner(payload)
        e_items, e_pts, e_lines = elec_eng.process()
        
        # Run Plumbing Engine
        plumb_eng = PlumbingDesigner(payload)
        p_items, p_pts, p_lines = plumb_eng.process()
        
        all_items = e_items + p_items
        all_pts = e_pts + p_pts
        all_lines = e_lines + p_lines
        
        return {
            "items": [item.dict() for item in all_items],
            "visualization": {
                "points": all_pts,
                "lines": all_lines
            }
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
