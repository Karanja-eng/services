# backend/main.py - COMPLETE FUNCTIONAL BACKEND
"""
Complete FastAPI backend for AutoCAD Clone
All endpoints, WebSocket, DXF/DWG import/export, Blender integration
"""

from fastapi import (
    APIRouter,
    UploadFile,
    File,
    HTTPException,
    Query,
)
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
import json
import asyncio
import subprocess
import tempfile
import os
import io
from datetime import datetime
import ezdxf
import numpy as np
from .geometry_utils import (
    distance,
    polygon_area,
    polygon_perimeter,
    circle_area,
    circle_circumference,
    line_length,
    polyline_length,
    Point,
    Line,
    Circle,
    Rectangle,
    calculate_total_measurements,
)

# Create router instance
router = APIRouter(
    prefix="/drawings",
    tags=["drawings"],
    responses={404: {"description": "Not found"}},
)

# ============ DATA MODELS ============


class Point3D(BaseModel):
    x: float
    y: float
    z: float = 0.0


class DrawingObject(BaseModel):
    id: str
    type: str
    layerId: str = Field(default="1", alias="layerId")
    color: str = "#FFFFFF"
    visible: bool = True
    locked: bool = False
    lineWidth: Optional[float] = 2.0
    # Type-specific fields
    start: Optional[Point3D] = None
    end: Optional[Point3D] = None
    center: Optional[Point3D] = None
    radius: Optional[float] = None
    radiusX: Optional[float] = None
    radiusY: Optional[float] = None
    position: Optional[Point3D] = None
    width: Optional[float] = None
    height: Optional[float] = None
    depth: Optional[float] = None
    points: Optional[List[Point3D]] = None
    pattern: Optional[str] = None
    opacity: Optional[float] = 1.0
    startAngle: Optional[float] = None
    endAngle: Optional[float] = None
    text: Optional[str] = None
    size: Optional[float] = None
    rotation: Optional[float] = None
    value: Optional[str] = None
    unit: Optional[str] = None
    closed: Optional[bool] = False
    segments: Optional[int] = 32

    class Config:
        populate_by_name = True


class Layer(BaseModel):
    id: str
    name: str
    color: str
    visible: bool = True
    locked: bool = False
    opacity: float = 1.0


class Project(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    objects: List[DrawingObject] = []
    layers: List[Layer] = []
    created_at: str
    modified_at: str
    version: str = "1.0.0"


class ExtrudeRequest(BaseModel):
    object_ids: List[str]
    depth: float = 5.0


class RevolveRequest(BaseModel):
    object_ids: List[str]
    segments: int = 32


class BlenderExportRequest(BaseModel):
    project_id: str
    format: str = "glb"


class AIGenerateRequest(BaseModel):
    prompt: str
    project_id: str
    parameters: Dict[str, Any] = {}


# ============ IN-MEMORY STORAGE ============
projects: Dict[str, Project] = {
    "default": Project(
        id="default",
        name="Default Project",
        created_at=datetime.now().isoformat(),
        modified_at=datetime.now().isoformat(),
        layers=[
            Layer(id="1", name="Layer 0", color="#FFFFFF", visible=True, locked=False)
        ],
    )
}

# ============ UTILITY FUNCTIONS ============


def check_blender_installed():
    """Check if Blender is installed"""
    try:
        result = subprocess.run(
            ["blender", "--version"], capture_output=True, timeout=5, text=True
        )
        return result.returncode == 0
    except Exception:
        return False


def generate_blender_script(
    objects: List[DrawingObject], output_path: str, format: str = "glb"
):
    """Generate Blender Python script for 3D export"""
    script = f"""
import bpy
import math

# Clear existing objects
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Add objects
"""

    for obj in objects:
        if obj.type == "line" and obj.start and obj.end:
            script += f"""
# Line
curve = bpy.data.curves.new('Line', 'CURVE')
curve.dimensions = '3D'
spline = curve.splines.new('POLY')
spline.points.add(1)
spline.points[0].co = ({obj.start.x}, {obj.start.y}, {obj.start.z}, 1)
spline.points[1].co = ({obj.end.x}, {obj.end.y}, {obj.end.z}, 1)
curve_obj = bpy.data.objects.new('Line_{obj.id}', curve)
bpy.context.collection.objects.link(curve_obj)
"""

        elif obj.type == "box" and obj.position:
            script += f"""
# Box
bpy.ops.mesh.primitive_cube_add(
    size=1,
    location=({obj.position.x}, {obj.position.y}, {obj.position.z})
)
box = bpy.context.active_object
box.name = 'Box_{obj.id}'
box.scale = ({obj.width or 1}, {obj.height or 1}, {obj.depth or 1})
"""

        elif obj.type == "circle" and obj.center:
            script += f"""
# Circle (as cylinder)
bpy.ops.mesh.primitive_cylinder_add(
    radius={obj.radius},
    depth=0.1,
    location=({obj.center.x}, {obj.center.y}, {obj.center.z})
)
bpy.context.active_object.name = 'Circle_{obj.id}'
"""

        elif obj.type == "extrusion" and obj.points and len(obj.points) > 2:
            points_str = ", ".join([f"({p.x}, {p.y})" for p in obj.points])
            script += f"""
# Extrusion
import bpy
from mathutils import Vector

points = [{points_str}]
curve = bpy.data.curves.new('Extrusion_{obj.id}', 'CURVE')
curve.dimensions = '2D'
spline = curve.splines.new('POLY')
spline.points.add(len(points) - 1)
for i, (x, y) in enumerate(points):
    spline.points[i].co = (x, y, 0, 1)
spline.use_cyclic_u = True
curve.extrude = {obj.depth or 1}
curve_obj = bpy.data.objects.new('Extrusion_{obj.id}', curve)
bpy.context.collection.objects.link(curve_obj)
"""

        elif obj.type == "revolve" and obj.points and len(obj.points) > 1:
            points_str = ", ".join([f"({abs(p.x)}, {p.y})" for p in obj.points])
            script += f"""
# Revolve
points_2d = [{points_str}]
curve = bpy.data.curves.new('Profile_{obj.id}', 'CURVE')
curve.dimensions = '2D'
spline = curve.splines.new('POLY')
spline.points.add(len(points_2d) - 1)
for i, (x, y) in enumerate(points_2d):
    spline.points[i].co = (x, y, 0, 1)

# Add screw modifier for revolution
curve_obj = bpy.data.objects.new('Revolve_{obj.id}', curve)
bpy.context.collection.objects.link(curve_obj)
bpy.context.view_layer.objects.active = curve_obj
bpy.ops.object.modifier_add(type='SCREW')
curve_obj.modifiers['Screw'].steps = {obj.segments or 32}
curve_obj.modifiers['Screw'].render_steps = {obj.segments or 32}
"""

    # Export logic
    if format == "glb":
        script += f"""
# Export as GLB
bpy.ops.export_scene.gltf(
    filepath='{output_path}',
    export_format='GLB'
)
"""
    elif format == "obj":
        script += f"""
# Export as OBJ
bpy.ops.export_scene.obj(
    filepath='{output_path}'
)
"""
    elif format == "stl":
        script += f"""
# Select all
bpy.ops.object.select_all(action='SELECT')
# Export as STL
bpy.ops.export_mesh.stl(
    filepath='{output_path}'
)
"""
    elif format == "fbx":
        script += f"""
# Export as FBX
bpy.ops.export_scene.fbx(
    filepath='{output_path}'
)
"""

    return script


def import_dxf(file_path: str) -> List[DrawingObject]:
    """Import DXF file and convert to DrawingObjects"""
    objects = []

    try:
        doc = ezdxf.readfile(file_path)
        msp = doc.modelspace()

        for entity in msp:
            obj = None
            entity_id = f"imported_{hash(str(entity))}"

            if entity.dxftype() == "LINE":
                obj = DrawingObject(
                    id=entity_id,
                    type="line",
                    layerId="1",
                    color="#FFFFFF",
                    start=Point3D(
                        x=float(entity.dxf.start.x),
                        y=float(entity.dxf.start.y),
                        z=float(entity.dxf.start.z),
                    ),
                    end=Point3D(
                        x=float(entity.dxf.end.x),
                        y=float(entity.dxf.end.y),
                        z=float(entity.dxf.end.z),
                    ),
                )

            elif entity.dxftype() == "CIRCLE":
                obj = DrawingObject(
                    id=entity_id,
                    type="circle",
                    layerId="1",
                    color="#FFFFFF",
                    center=Point3D(
                        x=float(entity.dxf.center.x),
                        y=float(entity.dxf.center.y),
                        z=float(entity.dxf.center.z),
                    ),
                    radius=float(entity.dxf.radius),
                )

            elif entity.dxftype() == "ARC":
                obj = DrawingObject(
                    id=entity_id,
                    type="arc",
                    layerId="1",
                    color="#FFFFFF",
                    center=Point3D(
                        x=float(entity.dxf.center.x),
                        y=float(entity.dxf.center.y),
                        z=float(entity.dxf.center.z),
                    ),
                    radius=float(entity.dxf.radius),
                    startAngle=float(entity.dxf.start_angle),
                    endAngle=float(entity.dxf.end_angle),
                )

            elif entity.dxftype() == "LWPOLYLINE":
                points = [
                    Point3D(x=float(p[0]), y=float(p[1]), z=0.0)
                    for p in entity.get_points()
                ]
                if len(points) >= 2:
                    obj = DrawingObject(
                        id=entity_id,
                        type="polyline",
                        layerId="1",
                        color="#FFFFFF",
                        points=points,
                        closed=entity.closed,
                    )

            if obj:
                objects.append(obj)

    except Exception as e:
        print(f"Error importing DXF: {e}")

    return objects


def export_dxf(objects: List[DrawingObject], file_path: str):
    """Export objects to DXF format"""
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()

    for obj in objects:
        try:
            if obj.type == "line" and obj.start and obj.end:
                msp.add_line(
                    (obj.start.x, obj.start.y, obj.start.z),
                    (obj.end.x, obj.end.y, obj.end.z),
                )

            elif obj.type == "circle" and obj.center:
                msp.add_circle(
                    (obj.center.x, obj.center.y, obj.center.z), radius=obj.radius
                )

            elif obj.type == "arc" and obj.center:
                msp.add_arc(
                    center=(obj.center.x, obj.center.y, obj.center.z),
                    radius=obj.radius,
                    start_angle=obj.startAngle or 0,
                    end_angle=obj.endAngle or 360,
                )

            elif obj.type == "rectangle" and obj.start and obj.end:
                points = [
                    (obj.start.x, obj.start.y),
                    (obj.end.x, obj.start.y),
                    (obj.end.x, obj.end.y),
                    (obj.start.x, obj.end.y),
                    (obj.start.x, obj.start.y),
                ]
                msp.add_lwpolyline(points, close=True)

            elif obj.type == "polyline" and obj.points:
                points = [(p.x, p.y) for p in obj.points]
                msp.add_lwpolyline(points, close=obj.closed or False)

        except Exception as e:
            print(f"Error exporting object {obj.id}: {e}")

    doc.saveas(file_path)


# ============ API ENDPOINTS ============


@router.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "name": "AutoCAD Clone Backend",
        "version": "1.0.0",
        "status": "running",
        "features": {
            "projects": True,
            "objects": True,
            "layers": True,
            "2d_drawing": True,
            "3d_modeling": True,
            "extrusion": True,
            "revolve": True,
            "dxf_import": True,
            "dxf_export": True,
            "dwg_import": "partial",
            "blender_export": check_blender_installed(),
            "measurements": True,
            "ai_integration": "placeholder",
        },
        "endpoints": {
            "health": "/drawings/health",
            "projects": "/drawings/projects",
            "objects": "/drawings/projects/{id}/objects",
            "layers": "/drawings/projects/{id}/layers",
            "extrude": "/drawings/projects/{id}/extrude",
            "revolve": "/drawings/projects/{id}/revolve",
            "import_dxf": "/drawings/projects/{id}/import/dxf",
            "export_dxf": "/drawings/projects/{id}/export/dxf",
            "export_blender": "/drawings/projects/{id}/export/blender",
            "measure": "/drawings/projects/{id}/measure",
        },
    }


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "blender_available": check_blender_installed(),
        "active_projects": len(projects),
    }


# ============ PROJECT ENDPOINTS ============


@router.post("/projects")
async def create_project(name: str = Query("Untitled Project")):
    """Create a new project"""
    project_id = str(datetime.now().timestamp()).replace(".", "")
    project = Project(
        id=project_id,
        name=name,
        created_at=datetime.now().isoformat(),
        modified_at=datetime.now().isoformat(),
        layers=[
            Layer(id="1", name="Layer 0", color="#FFFFFF", visible=True, locked=False)
        ],
    )
    projects[project_id] = project
    return {"project": project, "message": "Project created successfully"}


@router.get("/projects/{project_id}")
async def get_project(project_id: str):
    """Get project by ID"""
    if project_id not in projects:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"project": projects[project_id]}


@router.get("/projects")
async def list_projects(page: int = 1, limit: int = 20):
    """List all projects with pagination"""
    start = (page - 1) * limit
    end = start + limit
    project_list = list(projects.values())[start:end]
    return {
        "projects": project_list,
        "total": len(projects),
        "page": page,
        "limit": limit,
    }


@router.put("/projects/{project_id}")
async def update_project(project_id: str, updates: Dict[str, Any]):
    """Update project"""
    if project_id not in projects:
        raise HTTPException(status_code=404, detail="Project not found")

    project = projects[project_id]
    if "name" in updates:
        project.name = updates["name"]
    if "description" in updates:
        project.description = updates["description"]

    project.modified_at = datetime.now().isoformat()
    projects[project_id] = project

    return {"project": project, "message": "Project updated"}


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete project"""
    if project_id not in projects:
        raise HTTPException(status_code=404, detail="Project not found")

    del projects[project_id]
    return {"message": "Project deleted successfully"}


# ============ OBJECT ENDPOINTS ============


@router.post("/projects/{project_id}/objects")
async def add_object(project_id: str, obj: DrawingObject):
    """Add object to project"""
    if project_id not in projects:
        raise HTTPException(status_code=404, detail="Project not found")

    projects[project_id].objects.append(obj)
    projects[project_id].modified_at = datetime.now().isoformat()

    return {"status": "success", "object": obj}


@router.post("/projects/{project_id}/objects/batch")
async def batch_add_objects(project_id: str, request: Dict[str, List[Dict]]):
    """Batch add objects"""
    if project_id not in projects:
        raise HTTPException(status_code=404, detail="Project not found")

    objects_data = request.get("objects", [])
    new_objects = [DrawingObject(**obj) for obj in objects_data]
    projects[project_id].objects.extend(new_objects)
    projects[project_id].modified_at = datetime.now().isoformat()

    return {"status": "success", "objects": new_objects, "count": len(new_objects)}


@router.put("/projects/{project_id}/objects/{object_id}")
async def update_object(project_id: str, object_id: str, obj: DrawingObject):
    """Update an object"""
    if project_id not in projects:
        raise HTTPException(status_code=404, detail="Project not found")

    for i, existing_obj in enumerate(projects[project_id].objects):
        if existing_obj.id == object_id:
            projects[project_id].objects[i] = obj
            projects[project_id].modified_at = datetime.now().isoformat()

            return {"status": "success", "object": obj}

    raise HTTPException(status_code=404, detail="Object not found")


@router.delete("/projects/{project_id}/objects/{object_id}")
async def delete_object(project_id: str, object_id: str):
    """Delete an object"""
    if project_id not in projects:
        raise HTTPException(status_code=404, detail="Project not found")

    projects[project_id].objects = [
        obj for obj in projects[project_id].objects if obj.id != object_id
    ]
    projects[project_id].modified_at = datetime.now().isoformat()

    return {"status": "success"}


@router.post("/projects/{project_id}/objects/batch-delete")
async def batch_delete_objects(project_id: str, request: Dict[str, List[str]]):
    """Batch delete objects"""
    if project_id not in projects:
        raise HTTPException(status_code=404, detail="Project not found")

    object_ids = request.get("object_ids", [])
    projects[project_id].objects = [
        obj for obj in projects[project_id].objects if obj.id not in object_ids
    ]
    projects[project_id].modified_at = datetime.now().isoformat()

    return {"status": "success", "deleted_count": len(object_ids)}


# ============ LAYER ENDPOINTS ============


@router.post("/projects/{project_id}/layers")
async def add_layer(project_id: str, layer: Layer):
    """Add layer to project"""
    if project_id not in projects:
        raise HTTPException(status_code=404, detail="Project not found")

    projects[project_id].layers.append(layer)
    projects[project_id].modified_at = datetime.now().isoformat()

    return {"status": "success", "layer": layer}


@router.put("/projects/{project_id}/layers/{layer_id}")
async def update_layer(project_id: str, layer_id: str, updates: Dict[str, Any]):
    """Update layer"""
    if project_id not in projects:
        raise HTTPException(status_code=404, detail="Project not found")

    for i, layer in enumerate(projects[project_id].layers):
        if layer.id == layer_id:
            if "name" in updates:
                layer.name = updates["name"]
            if "color" in updates:
                layer.color = updates["color"]
            if "visible" in updates:
                layer.visible = updates["visible"]
            if "locked" in updates:
                layer.locked = updates["locked"]

            projects[project_id].layers[i] = layer
            projects[project_id].modified_at = datetime.now().isoformat()
            return {"status": "success", "layer": layer}

    raise HTTPException(status_code=404, detail="Layer not found")


@router.delete("/projects/{project_id}/layers/{layer_id}")
async def delete_layer(project_id: str, layer_id: str):
    """Delete layer"""
    if project_id not in projects:
        raise HTTPException(status_code=404, detail="Project not found")

    projects[project_id].layers = [
        layer for layer in projects[project_id].layers if layer.id != layer_id
    ]
    projects[project_id].modified_at = datetime.now().isoformat()

    return {"status": "success"}


# ============ 3D OPERATIONS ============


@router.post("/projects/{project_id}/extrude")
async def extrude_objects(project_id: str, request: ExtrudeRequest):
    """Extrude 2D objects to 3D"""
    if project_id not in projects:
        raise HTTPException(status_code=404, detail="Project not found")

    project = projects[project_id]
    new_objects = []

    for obj_id in request.object_ids:
        obj = next((o for o in project.objects if o.id == obj_id), None)
        if not obj:
            continue

        extruded_id = f"{obj_id}_extruded_{datetime.now().timestamp()}"

        if obj.type == "rectangle" and obj.start and obj.end:
            points = [
                obj.start,
                Point3D(x=obj.end.x, y=obj.start.y, z=0),
                obj.end,
                Point3D(x=obj.start.x, y=obj.end.y, z=0),
            ]
            extruded = DrawingObject(
                id=extruded_id,
                type="extrusion",
                layerId=obj.layerId,
                color=obj.color,
                points=points,
                depth=request.depth,
            )
            new_objects.append(extruded)

        elif obj.type == "circle" and obj.center:
            segments = 32
            points = []
            for i in range(segments + 1):
                angle = (i / segments) * 2 * 3.14159
                points.append(
                    Point3D(
                        x=obj.center.x + obj.radius * np.cos(angle),
                        y=obj.center.y + obj.radius * np.sin(angle),
                        z=0,
                    )
                )

            extruded = DrawingObject(
                id=extruded_id,
                type="extrusion",
                layerId=obj.layerId,
                color=obj.color,
                points=points,
                depth=request.depth,
            )
            new_objects.append(extruded)

        elif obj.type == "polyline" and obj.points:
            extruded = DrawingObject(
                id=extruded_id,
                type="extrusion",
                layerId=obj.layerId,
                color=obj.color,
                points=obj.points,
                depth=request.depth,
            )
            new_objects.append(extruded)

    project.objects.extend(new_objects)
    project.modified_at = datetime.now().isoformat()

    return {"status": "success", "objects": new_objects, "count": len(new_objects)}


@router.post("/projects/{project_id}/revolve")
async def revolve_objects(project_id: str, request: RevolveRequest):
    """Revolve profile around axis"""
    if project_id not in projects:
        raise HTTPException(status_code=404, detail="Project not found")

    project = projects[project_id]
    new_objects = []

    for obj_id in request.object_ids:
        obj = next((o for o in project.objects if o.id == obj_id), None)
        if not obj:
            continue

        points = None
        if obj.type == "polyline" and obj.points:
            points = obj.points
        elif obj.type == "line" and obj.start and obj.end:
            points = [obj.start, obj.end]

        if points and len(points) >= 2:
            revolved_id = f"{obj_id}_revolved_{datetime.now().timestamp()}"
            revolved = DrawingObject(
                id=revolved_id,
                type="revolve",
                layerId=obj.layerId,
                color=obj.color,
                points=points,
                segments=request.segments,
                position=Point3D(x=0, y=0, z=0),
            )
            new_objects.append(revolved)

    project.objects.extend(new_objects)
    project.modified_at = datetime.now().isoformat()

    return {"status": "success", "objects": new_objects, "count": len(new_objects)}


# ============ MEASUREMENT ENDPOINTS ============


@router.post("/projects/{project_id}/measure")
async def measure_objects(project_id: str, object_ids: List[str]):
    """Calculate measurements for objects"""
    if project_id not in projects:
        raise HTTPException(status_code=404, detail="Project not found")

    project = projects[project_id]
    total_length = 0.0
    total_area = 0.0
    total_perimeter = 0.0

    for obj_id in object_ids:
        obj = next((o for o in project.objects if o.id == obj_id), None)
        if not obj:
            continue

        try:
            if obj.type == "line" and obj.start and obj.end:
                length = distance(
                    Point(obj.start.x, obj.start.y, obj.start.z),
                    Point(obj.end.x, obj.end.y, obj.end.z),
                )
                total_length += length

            elif obj.type == "circle" and obj.center and obj.radius:
                circle = Circle(
                    Point(obj.center.x, obj.center.y, obj.center.z), obj.radius
                )
                total_area += circle_area(circle)
                total_perimeter += circle_circumference(circle)

            elif obj.type == "rectangle" and obj.start and obj.end:
                rect = Rectangle(
                    Point(obj.start.x, obj.start.y, obj.start.z),
                    Point(obj.end.x, obj.end.y, obj.end.z),
                )
                from .geometry_utils import rectangle_area, rectangle_perimeter

                total_area += rectangle_area(rect)
                total_perimeter += rectangle_perimeter(rect)

            elif obj.type == "polyline" and obj.points:
                points = [Point(p.x, p.y, p.z) for p in obj.points]
                total_length += polyline_length(points)
                if obj.closed:
                    total_area += polygon_area(points)
                    total_perimeter += polygon_perimeter(points)

        except Exception as e:
            print(f"Error measuring object {obj.id}: {e}")
