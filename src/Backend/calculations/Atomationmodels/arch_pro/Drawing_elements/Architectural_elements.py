import trimesh
import numpy as np
from typing import Optional, Tuple, List, Union
from dataclasses import dataclass
from enum import Enum
import json


# ============================================================================
# ENUMS AND DATA CLASSES
# ============================================================================

class HandleType(Enum):
    LEVER = "lever"
    KNOB = "knob"
    PULL = "pull"
    BRASS = "brass"
    MODERN = "modern"


class FrameStyle(Enum):
    MINIMAL = "minimal"
    TRADITIONAL = "traditional"
    MODERN = "modern"
    ORNATE = "ornate"


class MaterialType(Enum):
    WOOD = "wood"
    GLASS = "glass"
    METAL = "metal"
    STONE = "stone"
    CONCRETE = "concrete"
    BRICK = "brick"
    PLASTER = "plaster"
    TILE = "tile"
    CARPET = "carpet"


@dataclass
class Material:
    type: MaterialType
    color: Tuple[int, int, int, int] = (200, 200, 200, 255)
    texture: Optional[str] = None
    pattern: Optional[str] = None


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def create_box(width: float, height: float, depth: float, 
               center: Tuple[float, float, float] = (0, 0, 0)) -> trimesh.Trimesh:
    """Create a box mesh."""
    box = trimesh.creation.box(extents=[width, depth, height])
    box.apply_translation(center)
    return box


def apply_rotation(mesh: trimesh.Trimesh, rotation: float, axis: str = 'z') -> trimesh.Trimesh:
    """Apply rotation to mesh."""
    if axis == 'z':
        matrix = trimesh.transformations.rotation_matrix(
            np.radians(rotation), [0, 0, 1], [0, 0, 0]
        )
    elif axis == 'y':
        matrix = trimesh.transformations.rotation_matrix(
            np.radians(rotation), [0, 1, 0], [0, 0, 0]
        )
    else:
        matrix = trimesh.transformations.rotation_matrix(
            np.radians(rotation), [1, 0, 0], [0, 0, 0]
        )
    mesh.apply_transform(matrix)
    return mesh


def set_mesh_color(mesh: trimesh.Trimesh, color: Tuple[int, int, int, int]):
    """Set vertex colors for mesh."""
    mesh.visual.vertex_colors = np.array([color] * len(mesh.vertices))


def create_cylinder(radius: float, height: float, 
                    center: Tuple[float, float, float] = (0, 0, 0)) -> trimesh.Trimesh:
    """Create a cylinder mesh."""
    cyl = trimesh.creation.cylinder(radius=radius, height=height)
    cyl.apply_translation(center)
    return cyl


def create_textured_plane(width: float, depth: float, 
                          material: Material,
                          center: Tuple[float, float, float] = (0, 0, 0)) -> trimesh.Trimesh:
    """Create a textured plane."""
    vertices = np.array([
        [-width/2, -depth/2, 0],
        [width/2, -depth/2, 0],
        [width/2, depth/2, 0],
        [-width/2, depth/2, 0]
    ])
    faces = np.array([[0, 1, 2], [0, 2, 3]])
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
    mesh.apply_translation(center)
    set_mesh_color(mesh, material.color)
    return mesh


# ============================================================================
# DOOR CLASSES
# ============================================================================

class BaseDoor:
    """Base class for all door types."""
    
    def __init__(self, width: float = 0.9, height: float = 2.1, depth: float = 0.05,
                 rotation: float = 0, handle_type: HandleType = HandleType.LEVER,
                 material: Material = Material(MaterialType.WOOD, (139, 90, 60, 255))):
        self.width = width
        self.height = height
        self.depth = depth
        self.rotation = rotation
        self.handle_type = handle_type
        self.material = material
    
    def create_handle(self, position: Tuple[float, float, float]) -> trimesh.Trimesh:
        """Create door handle."""
        if self.handle_type == HandleType.LEVER:
            handle = create_box(0.12, 0.02, 0.02, position)
            set_mesh_color(handle, (180, 180, 180, 255))
        elif self.handle_type == HandleType.KNOB:
            handle = trimesh.creation.icosphere(radius=0.03)
            handle.apply_translation(position)
            set_mesh_color(handle, (180, 180, 180, 255))
        elif self.handle_type == HandleType.BRASS:
            handle = create_box(0.12, 0.02, 0.02, position)
            set_mesh_color(handle, (205, 127, 50, 255))
        else:
            handle = create_box(0.1, 0.02, 0.02, position)
            set_mesh_color(handle, (100, 100, 100, 255))
        return handle
    
    def generate(self) -> trimesh.Trimesh:
        """Generate the door mesh. To be overridden."""
        raise NotImplementedError


class DoorSwing(BaseDoor):
    """Standard swing door."""
    
    def generate(self) -> trimesh.Trimesh:
        # Main door panel
        door_panel = create_box(self.width, self.height, self.depth)
        set_mesh_color(door_panel, self.material.color)
        
        # Handle
        handle_pos = (self.width/2 - 0.1, self.height/2, self.depth/2 + 0.01)
        handle = self.create_handle(handle_pos)
        
        # Combine
        mesh = trimesh.util.concatenate([door_panel, handle])
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class DoorSliding(BaseDoor):
    """Sliding door."""
    
    def generate(self) -> trimesh.Trimesh:
        # Door panel
        door_panel = create_box(self.width, self.height, self.depth)
        set_mesh_color(door_panel, self.material.color)
        
        # Track at top
        track = create_box(self.width + 0.2, 0.05, 0.05, (0, self.height/2 + 0.025, 0))
        set_mesh_color(track, (100, 100, 100, 255))
        
        # Handle
        handle_pos = (self.width/2 - 0.15, 0, self.depth/2 + 0.01)
        handle = self.create_handle(handle_pos)
        
        mesh = trimesh.util.concatenate([door_panel, track, handle])
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class DoorDouble(BaseDoor):
    """Double door."""
    
    def generate(self) -> trimesh.Trimesh:
        # Left panel
        left_panel = create_box(self.width/2 - 0.01, self.height, self.depth, 
                               (-self.width/4 - 0.005, 0, 0))
        set_mesh_color(left_panel, self.material.color)
        
        # Right panel
        right_panel = create_box(self.width/2 - 0.01, self.height, self.depth,
                                (self.width/4 + 0.005, 0, 0))
        set_mesh_color(right_panel, self.material.color)
        
        # Handles
        handle_left = self.create_handle((-0.05, 0, self.depth/2 + 0.01))
        handle_right = self.create_handle((0.05, 0, self.depth/2 + 0.01))
        
        mesh = trimesh.util.concatenate([left_panel, right_panel, handle_left, handle_right])
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class DoorFolding(BaseDoor):
    """Folding/bifold door."""
    
    def __init__(self, *args, panels: int = 4, **kwargs):
        super().__init__(*args, **kwargs)
        self.panels = panels
    
    def generate(self) -> trimesh.Trimesh:
        panel_width = self.width / self.panels
        meshes = []
        
        for i in range(self.panels):
            x_offset = -self.width/2 + panel_width/2 + i * panel_width
            panel = create_box(panel_width - 0.01, self.height, self.depth,
                             (x_offset, 0, 0))
            set_mesh_color(panel, self.material.color)
            meshes.append(panel)
        
        # Handle on last panel
        handle = self.create_handle((self.width/2 - 0.1, 0, self.depth/2 + 0.01))
        meshes.append(handle)
        
        mesh = trimesh.util.concatenate(meshes)
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class DoorPanelled(BaseDoor):
    """Traditional panelled door."""
    
    def __init__(self, *args, panels: int = 6, **kwargs):
        super().__init__(*args, **kwargs)
        self.panels = panels
    
    def generate(self) -> trimesh.Trimesh:
        # Main door
        door_panel = create_box(self.width, self.height, self.depth)
        set_mesh_color(door_panel, self.material.color)
        
        # Raised panels
        panel_meshes = [door_panel]
        rows = 3 if self.panels == 6 else 2
        cols = 2 if self.panels >= 4 else 1
        
        panel_w = (self.width - 0.2) / cols
        panel_h = (self.height - 0.3) / rows
        
        for row in range(rows):
            for col in range(cols):
                x = -self.width/2 + 0.1 + panel_w/2 + col * panel_w
                y = -self.height/2 + 0.1 + panel_h/2 + row * panel_h
                panel = create_box(panel_w - 0.05, panel_h - 0.05, 0.01,
                                 (x, y, self.depth/2 + 0.005))
                darker_color = tuple(max(0, c - 30) for c in self.material.color[:3]) + (255,)
                set_mesh_color(panel, darker_color)
                panel_meshes.append(panel)
        
        # Handle
        handle = self.create_handle((self.width/2 - 0.1, 0, self.depth/2 + 0.01))
        panel_meshes.append(handle)
        
        mesh = trimesh.util.concatenate(panel_meshes)
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class DoorGlass(BaseDoor):
    """Glass door."""
    
    def __init__(self, *args, glass_color: Tuple[int, int, int, int] = (200, 220, 255, 180), **kwargs):
        super().__init__(*args, **kwargs)
        self.glass_color = glass_color
    
    def generate(self) -> trimesh.Trimesh:
        # Glass panel
        glass_panel = create_box(self.width, self.height, self.depth)
        set_mesh_color(glass_panel, self.glass_color)
        
        # Frame
        frame_parts = []
        frame_thickness = 0.05
        
        # Top
        top = create_box(self.width, frame_thickness, self.depth + 0.01,
                        (0, self.height/2 - frame_thickness/2, 0))
        # Bottom
        bottom = create_box(self.width, frame_thickness, self.depth + 0.01,
                           (0, -self.height/2 + frame_thickness/2, 0))
        # Left
        left = create_box(frame_thickness, self.height, self.depth + 0.01,
                         (-self.width/2 + frame_thickness/2, 0, 0))
        # Right
        right = create_box(frame_thickness, self.height, self.depth + 0.01,
                          (self.width/2 - frame_thickness/2, 0, 0))
        
        for part in [top, bottom, left, right]:
            set_mesh_color(part, (100, 100, 100, 255))
            frame_parts.append(part)
        
        # Handle
        handle = self.create_handle((self.width/2 - 0.1, 0, self.depth/2 + 0.01))
        
        mesh = trimesh.util.concatenate([glass_panel] + frame_parts + [handle])
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class DoorArched(BaseDoor):
    """Arched top door."""
    
    def generate(self) -> trimesh.Trimesh:
        # Main rectangular part
        rect_height = self.height * 0.8
        door_rect = create_box(self.width, rect_height, self.depth,
                              (0, -self.height/2 + rect_height/2, 0))
        set_mesh_color(door_rect, self.material.color)
        
        # Arch top
        arch_height = self.height * 0.2
        arch_radius = self.width / 2
        arch = trimesh.creation.cylinder(radius=arch_radius, height=self.depth,
                                        sections=32)
        arch = apply_rotation(arch, 90, 'y')
        
        # Cut the cylinder in half
        cutting_box = create_box(self.width * 2, arch_height, self.depth * 2,
                                (0, arch_height/2, 0))
        arch = arch.difference(cutting_box, engine='blender')
        arch.apply_translation((0, self.height/2 - arch_height/2, 0))
        set_mesh_color(arch, self.material.color)
        
        # Handle
        handle = self.create_handle((self.width/2 - 0.1, 0, self.depth/2 + 0.01))
        
        mesh = trimesh.util.concatenate([door_rect, arch, handle])
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class DoorModern(BaseDoor):
    """Modern minimalist door."""
    
    def generate(self) -> trimesh.Trimesh:
        # Main panel
        door_panel = create_box(self.width, self.height, self.depth)
        set_mesh_color(door_panel, self.material.color)
        
        # Accent strip
        strip = create_box(0.05, self.height * 0.8, self.depth + 0.005,
                          (self.width/2 - 0.15, 0, 0))
        set_mesh_color(strip, (50, 50, 50, 255))
        
        # Modern handle
        handle = create_box(0.02, 0.3, 0.02,
                           (self.width/2 - 0.05, 0, self.depth/2 + 0.02))
        set_mesh_color(handle, (200, 200, 200, 255))
        
        mesh = trimesh.util.concatenate([door_panel, strip, handle])
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class DoorClassic(BaseDoor):
    """Classic traditional door."""
    
    def generate(self) -> trimesh.Trimesh:
        # Main door
        door_panel = create_box(self.width, self.height, self.depth)
        set_mesh_color(door_panel, self.material.color)
        
        # Decorative panels
        panel_meshes = [door_panel]
        
        # Top panel
        top_panel = create_box(self.width - 0.15, self.height * 0.25, 0.01,
                              (0, self.height/2 - self.height * 0.125 - 0.075, self.depth/2 + 0.005))
        set_mesh_color(top_panel, self.material.color)
        panel_meshes.append(top_panel)
        
        # Bottom panels
        for i in range(2):
            y_pos = -self.height/2 + 0.2 + i * 0.35
            panel = create_box(self.width - 0.15, 0.3, 0.01,
                             (0, y_pos, self.depth/2 + 0.005))
            set_mesh_color(panel, self.material.color)
            panel_meshes.append(panel)
        
        # Handle
        handle = self.create_handle((self.width/2 - 0.1, 0, self.depth/2 + 0.01))
        panel_meshes.append(handle)
        
        mesh = trimesh.util.concatenate(panel_meshes)
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class DoorBarn(BaseDoor):
    """Barn style sliding door."""
    
    def generate(self) -> trimesh.Trimesh:
        # Main panel
        door_panel = create_box(self.width, self.height, self.depth)
        set_mesh_color(door_panel, self.material.color)
        
        # Horizontal planks
        plank_meshes = [door_panel]
        num_planks = 8
        plank_height = self.height / num_planks
        
        for i in range(num_planks + 1):
            y = -self.height/2 + i * plank_height
            plank_line = create_box(self.width, 0.02, self.depth + 0.005,
                                   (0, y, 0))
            darker_color = tuple(max(0, c - 40) for c in self.material.color[:3]) + (255,)
            set_mesh_color(plank_line, darker_color)
            plank_meshes.append(plank_line)
        
        # Diagonal brace
        brace = create_box(self.width * 1.2, 0.08, self.depth + 0.005)
        brace = apply_rotation(brace, 30, 'z')
        darker_color = tuple(max(0, c - 40) for c in self.material.color[:3]) + (255,)
        set_mesh_color(brace, darker_color)
        plank_meshes.append(brace)
        
        # Track hardware
        track = create_box(self.width + 0.4, 0.05, 0.05,
                          (0, self.height/2 + 0.1, 0))
        set_mesh_color(track, (50, 50, 50, 255))
        plank_meshes.append(track)
        
        # Handle
        handle = create_box(0.15, 0.03, 0.03,
                           (self.width/2 - 0.2, 0, self.depth/2 + 0.02))
        set_mesh_color(handle, (50, 50, 50, 255))
        plank_meshes.append(handle)
        
        mesh = trimesh.util.concatenate(plank_meshes)
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


# ============================================================================
# WINDOW CLASSES
# ============================================================================

class BaseWindow:
    """Base class for all window types."""
    
    def __init__(self, width: float = 1.2, height: float = 1.5, 
                 sill_height: float = 0.9, rotation: float = 0,
                 frame_style: FrameStyle = FrameStyle.MODERN,
                 glass_color: Tuple[int, int, int, int] = (200, 220, 255, 180)):
        self.width = width
        self.height = height
        self.sill_height = sill_height
        self.rotation = rotation
        self.frame_style = frame_style
        self.glass_color = glass_color
        self.frame_thickness = 0.08 if frame_style == FrameStyle.TRADITIONAL else 0.05
    
    def create_frame(self) -> List[trimesh.Trimesh]:
        """Create window frame."""
        frame_parts = []
        depth = 0.1
        
        # Top
        top = create_box(self.width, self.frame_thickness, depth,
                        (0, self.height/2 - self.frame_thickness/2, 0))
        # Bottom
        bottom = create_box(self.width, self.frame_thickness, depth,
                           (0, -self.height/2 + self.frame_thickness/2, 0))
        # Left
        left = create_box(self.frame_thickness, self.height, depth,
                         (-self.width/2 + self.frame_thickness/2, 0, 0))
        # Right
        right = create_box(self.frame_thickness, self.height, depth,
                          (self.width/2 - self.frame_thickness/2, 0, 0))
        
        frame_color = (255, 255, 255, 255) if self.frame_style == FrameStyle.MODERN else (139, 90, 60, 255)
        
        for part in [top, bottom, left, right]:
            set_mesh_color(part, frame_color)
            frame_parts.append(part)
        
        return frame_parts
    
    def generate(self) -> trimesh.Trimesh:
        """Generate the window mesh. To be overridden."""
        raise NotImplementedError


class WindowCasement(BaseWindow):
    """Casement window (hinged at side)."""
    
    def generate(self) -> trimesh.Trimesh:
        # Glass pane
        glass = create_box(self.width - self.frame_thickness, 
                          self.height - self.frame_thickness, 
                          0.02)
        set_mesh_color(glass, self.glass_color)
        
        # Frame
        frame_parts = self.create_frame()
        
        # Hinge
        hinge = create_box(0.03, 0.15, 0.03,
                          (-self.width/2 + 0.02, self.height/4, 0.06))
        set_mesh_color(hinge, (100, 100, 100, 255))
        
        mesh = trimesh.util.concatenate([glass] + frame_parts + [hinge])
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class WindowSliding(BaseWindow):
    """Horizontal sliding window."""
    
    def generate(self) -> trimesh.Trimesh:
        meshes = []
        
        # Left pane
        left_glass = create_box(self.width/2 - self.frame_thickness, 
                               self.height - self.frame_thickness, 
                               0.02,
                               (-self.width/4, 0, 0))
        set_mesh_color(left_glass, self.glass_color)
        meshes.append(left_glass)
        
        # Right pane
        right_glass = create_box(self.width/2 - self.frame_thickness, 
                                self.height - self.frame_thickness, 
                                0.02,
                                (self.width/4, 0, 0))
        set_mesh_color(right_glass, self.glass_color)
        meshes.append(right_glass)
        
        # Frame
        frame_parts = self.create_frame()
        meshes.extend(frame_parts)
        
        # Center divider
        divider = create_box(self.frame_thickness, self.height, 0.1)
        set_mesh_color(divider, (200, 200, 200, 255))
        meshes.append(divider)
        
        mesh = trimesh.util.concatenate(meshes)
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class WindowBay(BaseWindow):
    """Bay window (protruding)."""
    
    def __init__(self, *args, projection: float = 0.5, **kwargs):
        super().__init__(*args, **kwargs)
        self.projection = projection
    
    def generate(self) -> trimesh.Trimesh:
        meshes = []
        
        # Center pane
        center_glass = create_box(self.width * 0.4, self.height - self.frame_thickness, 0.02,
                                 (0, 0, -self.projection))
        set_mesh_color(center_glass, self.glass_color)
        meshes.append(center_glass)
        
        # Left pane (angled)
        left_glass = create_box(self.width * 0.3, self.height - self.frame_thickness, 0.02,
                               (-self.width * 0.35, 0, -self.projection/2))
        left_glass = apply_rotation(left_glass, 30, 'y')
        set_mesh_color(left_glass, self.glass_color)
        meshes.append(left_glass)
        
        # Right pane (angled)
        right_glass = create_box(self.width * 0.3, self.height - self.frame_thickness, 0.02,
                                (self.width * 0.35, 0, -self.projection/2))
        right_glass = apply_rotation(right_glass, -30, 'y')
        set_mesh_color(right_glass, self.glass_color)
        meshes.append(right_glass)
        
        # Frame
        frame_parts = self.create_frame()
        for part in frame_parts:
            part.apply_translation((0, 0, -self.projection))
        meshes.extend(frame_parts)
        
        mesh = trimesh.util.concatenate(meshes)
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class WindowArched(BaseWindow):
    """Arched top window."""
    
    def generate(self) -> trimesh.Trimesh:
        meshes = []
        
        # Rectangular glass part
        rect_height = self.height * 0.7
        rect_glass = create_box(self.width - self.frame_thickness, 
                               rect_height, 
                               0.02,
                               (0, -self.height/2 + rect_height/2, 0))
        set_mesh_color(rect_glass, self.glass_color)
        meshes.append(rect_glass)
        
        # Arched glass top
        arch_height = self.height * 0.3
        arch_radius = self.width / 2
        
        # Create arch shape (simplified as wedge)
        arch_glass = create_box(self.width - self.frame_thickness, 
                               arch_height, 
                               0.02,
                               (0, self.height/2 - arch_height/2, 0))
        set_mesh_color(arch_glass, self.glass_color)
        meshes.append(arch_glass)
        
        # Frame
        frame_parts = self.create_frame()
        meshes.extend(frame_parts)
        
        mesh = trimesh.util.concatenate(meshes)
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class WindowLouvered(BaseWindow):
    """Louvered window with slats."""
    
    def __init__(self, *args, num_slats: int = 8, **kwargs):
        super().__init__(*args, **kwargs)
        self.num_slats = num_slats
    
    def generate(self) -> trimesh.Trimesh:
        meshes = []
        
        # Frame
        frame_parts = self.create_frame()
        meshes.extend(frame_parts)
        
        # Slats
        slat_height = (self.height - self.frame_thickness * 2) / self.num_slats
        slat_spacing = slat_height * 0.2
        
        for i in range(self.num_slats):
            y = -self.height/2 + self.frame_thickness + slat_height/2 + i * slat_height
            slat = create_box(self.width - self.frame_thickness * 2, 
                            slat_height - slat_spacing, 
                            0.02,
                            (0, y, 0))
            slat = apply_rotation(slat, 15, 'x')
            set_mesh_color(slat, self.glass_color)
            meshes.append(slat)
        
        mesh = trimesh.util.concatenate(meshes)
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class WindowFixed(BaseWindow):
    """Fixed picture window."""
    
    def generate(self) -> trimesh.Trimesh:
        # Large single pane
        glass = create_box(self.width - self.frame_thickness, 
                          self.height - self.frame_thickness, 
                          0.02)
        set_mesh_color(glass, self.glass_color)
        
        # Frame
        frame_parts = self.create_frame()
        
        mesh = trimesh.util.concatenate([glass] + frame_parts)
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class WindowSkylight(BaseWindow):
    """Skylight window (horizontal/angled)."""
    
    def __init__(self, *args, angle: float = 15, **kwargs):
        super().__init__(*args, **kwargs)
        self.angle = angle
    
    def generate(self) -> trimesh.Trimesh:
        # Glass pane
        glass = create_box(self.width, self.height, 0.05)
        set_mesh_color(glass, self.glass_color)
        
        # Frame
        frame_parts = []
        depth = 0.15
        
        for x, y in [(-self.width/2, 0), (self.width/2, 0), (0, -self.height/2), (0, self.height/2)]:
            if x != 0:
                frame = create_box(self.frame_thickness, self.height, depth, (x, y, 0))
            else:
                frame = create_box(self.width, self.frame_thickness, depth, (x, y, 0))
            set_mesh_color(frame, (100, 100, 100, 255))
            frame_parts.append(frame)
        
        mesh = trimesh.util.concatenate([glass] + frame_parts)
        mesh = apply_rotation(mesh, self.angle, 'x')
        mesh = apply_rotation(mesh, self.rotation, 'z')
        
        return mesh


class WindowModern(BaseWindow):
    """Modern floor-to-ceiling window."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.frame_thickness = 0.03  # Minimal frame
    
    def generate(self) -> trimesh.Trimesh:
        # Large glass pane
        glass = create_box(self.width, self.height, 0.02)
        set_mesh_color(glass, self.glass_color)
        
        # Minimal frame
        frame_parts = []
        depth = 0.06
        
        # Just edges
        top = create_box(self.width, self.frame_thickness, depth,
                        (0, self.height/2, 0))
        bottom = create_box(self.width, self.frame_thickness, depth,
                           (0, -self.height/2, 0))
        left = create_box(self.frame_thickness, self.height, depth,
                         (-self.width/2, 0, 0))
        right = create_box(self.frame_thickness, self.height, depth,
                          (self.width/2, 0, 0))
        
        for part in [top, bottom, left, right]:
            set_mesh_color(part, (50, 50, 50, 255))
            frame_parts.append(part)
        
        mesh = trimesh.util.concatenate([glass] + frame_parts)
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class WindowClassic(BaseWindow):
    """Classic multi-pane window."""
    
    def __init__(self, *args, rows: int = 2, cols: int = 2, **kwargs):
        super().__init__(*args, **kwargs)
        self.rows = rows
        self.cols = cols
    
    def generate(self) -> trimesh.Trimesh:
        meshes = []
        
        # Frame
        frame_parts = self.create_frame()
        meshes.extend(frame_parts)
        
        # Panes
        pane_width = (self.width - self.frame_thickness * 2) / self.cols
        pane_height = (self.height - self.frame_thickness * 2) / self.rows
        
        for row in range(self.rows):
            for col in range(self.cols):
                x = -self.width/2 + self.frame_thickness + pane_width/2 + col * pane_width
                y = -self.height/2 + self.frame_thickness + pane_height/2 + row * pane_height
                
                pane = create_box(pane_width - 0.02, pane_height - 0.02, 0.02, (x, y, 0))
                set_mesh_color(pane, self.glass_color)
                meshes.append(pane)
                
                # Muntins (dividers)
                if col < self.cols - 1:
                    muntin_v = create_box(0.02, pane_height, 0.03,
                                         (x + pane_width/2, y, 0))
                    set_mesh_color(muntin_v, (200, 200, 200, 255))
                    meshes.append(muntin_v)
                
                if row < self.rows - 1:
                    muntin_h = create_box(pane_width, 0.02, 0.03,
                                         (x, y + pane_height/2, 0))
                    set_mesh_color(muntin_h, (200, 200, 200, 255))
                    meshes.append(muntin_h)
        
        mesh = trimesh.util.concatenate(meshes)
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class WindowGlassWall(BaseWindow):
    """Floor-to-ceiling glass wall panel."""
    
    def __init__(self, width: float = 3.0, height: float = 2.7, **kwargs):
        super().__init__(width=width, height=height, **kwargs)
        self.frame_thickness = 0.04
    
    def generate(self) -> trimesh.Trimesh:
        # Very large glass pane
        glass = create_box(self.width, self.height, 0.02)
        set_mesh_color(glass, self.glass_color)
        
        # Minimal structural frame
        frame_parts = []
        
        # Vertical supports every meter
        num_supports = int(self.width / 1.0) + 1
        for i in range(num_supports):
            x = -self.width/2 + i * 1.0
            support = create_box(self.frame_thickness, self.height, 0.05, (x, 0, 0))
            set_mesh_color(support, (100, 100, 100, 255))
            frame_parts.append(support)
        
        # Top and bottom
        top = create_box(self.width, self.frame_thickness, 0.05,
                        (0, self.height/2, 0))
        bottom = create_box(self.width, self.frame_thickness, 0.05,
                           (0, -self.height/2, 0))
        
        for part in [top, bottom]:
            set_mesh_color(part, (100, 100, 100, 255))
            frame_parts.append(part)
        
        mesh = trimesh.util.concatenate([glass] + frame_parts)
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


# ============================================================================
# WALL CLASSES
# ============================================================================

class BaseWall:
    """Base class for all wall types."""
    
    def __init__(self, length: float = 4.0, height: float = 2.7, 
                 thickness: float = 0.2, rotation: float = 0,
                 material: Material = Material(MaterialType.PLASTER, (245, 245, 245, 255))):
        self.length = length
        self.height = height
        self.thickness = thickness
        self.rotation = rotation
        self.material = material
    
    def generate(self) -> trimesh.Trimesh:
        """Generate the wall mesh. To be overridden."""
        raise NotImplementedError


class WallPlain(BaseWall):
    """Plain plaster wall."""
    
    def generate(self) -> trimesh.Trimesh:
        wall = create_box(self.length, self.height, self.thickness)
        set_mesh_color(wall, self.material.color)
        wall = apply_rotation(wall, self.rotation)
        return wall


class WallBrick(BaseWall):
    """Brick wall with visible brick pattern."""
    
    def __init__(self, *args, brick_color: Tuple[int, int, int, int] = (180, 90, 60, 255),
                 mortar_color: Tuple[int, int, int, int] = (200, 200, 200, 255), **kwargs):
        super().__init__(*args, **kwargs)
        self.brick_color = brick_color
        self.mortar_color = mortar_color
    
    def generate(self) -> trimesh.Trimesh:
        # Base wall
        wall = create_box(self.length, self.height, self.thickness)
        set_mesh_color(wall, self.brick_color)
        
        # Brick pattern (simplified as lines)
        meshes = [wall]
        
        brick_height = 0.08
        brick_length = 0.25
        mortar_thickness = 0.01
        
        # Horizontal mortar lines
        num_rows = int(self.height / brick_height)
        for i in range(num_rows):
            y = -self.height/2 + i * brick_height
            mortar = create_box(self.length, mortar_thickness, self.thickness + 0.005,
                              (0, y, 0))
            set_mesh_color(mortar, self.mortar_color)
            meshes.append(mortar)
        
        # Vertical mortar lines (running bond pattern)
        num_cols = int(self.length / brick_length)
        for row in range(num_rows):
            offset = brick_length/2 if row % 2 == 1 else 0
            for col in range(num_cols + 1):
                x = -self.length/2 + col * brick_length + offset
                y = -self.height/2 + row * brick_height + brick_height/2
                if -self.length/2 <= x <= self.length/2:
                    mortar = create_box(mortar_thickness, brick_height, self.thickness + 0.005,
                                      (x, y, 0))
                    set_mesh_color(mortar, self.mortar_color)
                    meshes.append(mortar)
        
        mesh = trimesh.util.concatenate(meshes)
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class WallStone(BaseWall):
    """Stone wall with irregular pattern."""
    
    def __init__(self, *args, stone_color: Tuple[int, int, int, int] = (150, 140, 130, 255), **kwargs):
        super().__init__(*args, **kwargs)
        self.stone_color = stone_color
    
    def generate(self) -> trimesh.Trimesh:
        # Base wall
        wall = create_box(self.length, self.height, self.thickness)
        set_mesh_color(wall, self.stone_color)
        
        meshes = [wall]
        
        # Add random stone blocks
        np.random.seed(42)
        num_stones = 30
        
        for _ in range(num_stones):
            stone_w = np.random.uniform(0.2, 0.5)
            stone_h = np.random.uniform(0.15, 0.4)
            x = np.random.uniform(-self.length/2 + stone_w/2, self.length/2 - stone_w/2)
            y = np.random.uniform(-self.height/2 + stone_h/2, self.height/2 - stone_h/2)
            
            stone = create_box(stone_w, stone_h, self.thickness + 0.01, (x, y, 0))
            
            # Vary color slightly
            color_var = np.random.randint(-20, 20, 3)
            stone_col = tuple(np.clip(np.array(self.stone_color[:3]) + color_var, 0, 255).tolist()) + (255,)
            set_mesh_color(stone, stone_col)
            meshes.append(stone)
        
        mesh = trimesh.util.concatenate(meshes)
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class WallConcrete(BaseWall):
    """Concrete wall."""
    
    def __init__(self, *args, **kwargs):
        material = Material(MaterialType.CONCRETE, (160, 160, 160, 255))
        super().__init__(*args, material=material, **kwargs)
    
    def generate(self) -> trimesh.Trimesh:
        wall = create_box(self.length, self.height, self.thickness)
        set_mesh_color(wall, self.material.color)
        
        # Add subtle panel lines
        meshes = [wall]
        
        panel_width = 1.0
        num_panels = int(self.length / panel_width)
        
        for i in range(1, num_panels):
            x = -self.length/2 + i * panel_width
            line = create_box(0.01, self.height, self.thickness + 0.005, (x, 0, 0))
            darker = tuple(max(0, c - 30) for c in self.material.color[:3]) + (255,)
            set_mesh_color(line, darker)
            meshes.append(line)
        
        mesh = trimesh.util.concatenate(meshes)
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class WallHalfTimbered(BaseWall):
    """Half-timbered wall with exposed wooden beams."""
    
    def __init__(self, *args, 
                 plaster_color: Tuple[int, int, int, int] = (240, 235, 220, 255),
                 timber_color: Tuple[int, int, int, int] = (90, 60, 40, 255), **kwargs):
        super().__init__(*args, **kwargs)
        self.plaster_color = plaster_color
        self.timber_color = timber_color
    
    def generate(self) -> trimesh.Trimesh:
        # Base plaster
        wall = create_box(self.length, self.height, self.thickness)
        set_mesh_color(wall, self.plaster_color)
        
        meshes = [wall]
        
        timber_width = 0.15
        timber_depth = self.thickness + 0.01
        
        # Vertical posts
        num_posts = 4
        for i in range(num_posts):
            x = -self.length/2 + (i / (num_posts - 1)) * self.length
            post = create_box(timber_width, self.height, timber_depth, (x, 0, 0))
            set_mesh_color(post, self.timber_color)
            meshes.append(post)
        
        # Horizontal beams
        top_beam = create_box(self.length, timber_width, timber_depth,
                             (0, self.height/2 - timber_width/2, 0))
        bottom_beam = create_box(self.length, timber_width, timber_depth,
                                (0, -self.height/2 + timber_width/2, 0))
        mid_beam = create_box(self.length, timber_width, timber_depth, (0, 0, 0))
        
        for beam in [top_beam, bottom_beam, mid_beam]:
            set_mesh_color(beam, self.timber_color)
            meshes.append(beam)
        
        # Diagonal braces
        for i in range(num_posts - 1):
            x_start = -self.length/2 + (i / (num_posts - 1)) * self.length
            x_end = -self.length/2 + ((i + 1) / (num_posts - 1)) * self.length
            x_mid = (x_start + x_end) / 2
            
            brace_length = np.sqrt((x_end - x_start)**2 + (self.height/2)**2)
            angle = np.degrees(np.arctan2(self.height/2, x_end - x_start))
            
            brace = create_box(brace_length, timber_width * 0.7, timber_depth,
                             (x_mid, self.height/4, 0))
            brace = apply_rotation(brace, angle, 'z')
            set_mesh_color(brace, self.timber_color)
            meshes.append(brace)
        
        mesh = trimesh.util.concatenate(meshes)
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


# ============================================================================
# FLOOR/SLAB CLASSES
# ============================================================================

class BaseFloor:
    """Base class for all floor types."""
    
    def __init__(self, width: float = 4.0, depth: float = 4.0, 
                 thickness: float = 0.1, rotation: float = 0,
                 material: Material = Material(MaterialType.CONCRETE, (180, 180, 180, 255))):
        self.width = width
        self.depth = depth
        self.thickness = thickness
        self.rotation = rotation
        self.material = material
    
    def generate(self) -> trimesh.Trimesh:
        """Generate the floor mesh. To be overridden."""
        raise NotImplementedError


class FloorConcrete(BaseFloor):
    """Concrete floor slab."""
    
    def generate(self) -> trimesh.Trimesh:
        floor = create_box(self.width, self.depth, self.thickness,
                          (0, 0, -self.thickness/2))
        set_mesh_color(floor, self.material.color)
        floor = apply_rotation(floor, self.rotation)
        return floor


class FloorWood(BaseFloor):
    """Wooden plank floor."""
    
    def __init__(self, *args, plank_width: float = 0.15,
                 wood_color: Tuple[int, int, int, int] = (160, 110, 70, 255), **kwargs):
        super().__init__(*args, **kwargs)
        self.plank_width = plank_width
        self.wood_color = wood_color
    
    def generate(self) -> trimesh.Trimesh:
        # Base floor
        floor = create_box(self.width, self.depth, self.thickness,
                          (0, 0, -self.thickness/2))
        set_mesh_color(floor, self.wood_color)
        
        meshes = [floor]
        
        # Plank lines
        num_planks = int(self.width / self.plank_width)
        
        for i in range(1, num_planks):
            x = -self.width/2 + i * self.plank_width
            line = create_box(0.005, self.depth, self.thickness + 0.002,
                            (x, 0, -self.thickness/2))
            darker = tuple(max(0, c - 40) for c in self.wood_color[:3]) + (255,)
            set_mesh_color(line, darker)
            meshes.append(line)
        
        # Random plank ends
        np.random.seed(42)
        for i in range(num_planks):
            x = -self.width/2 + i * self.plank_width + self.plank_width/2
            
            num_ends = np.random.randint(2, 5)
            for j in range(num_ends):
                y = -self.depth/2 + np.random.uniform(0.3, self.depth - 0.3)
                end_line = create_box(self.plank_width * 0.9, 0.005, self.thickness + 0.002,
                                    (x, y, -self.thickness/2))
                darker = tuple(max(0, c - 40) for c in self.wood_color[:3]) + (255,)
                set_mesh_color(end_line, darker)
                meshes.append(end_line)
        
        mesh = trimesh.util.concatenate(meshes)
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class FloorTile(BaseFloor):
    """Tiled floor."""
    
    def __init__(self, *args, tile_size: float = 0.3,
                 tile_color: Tuple[int, int, int, int] = (220, 220, 220, 255),
                 grout_color: Tuple[int, int, int, int] = (180, 180, 180, 255), **kwargs):
        super().__init__(*args, **kwargs)
        self.tile_size = tile_size
        self.tile_color = tile_color
        self.grout_color = grout_color
    
    def generate(self) -> trimesh.Trimesh:
        # Base floor
        floor = create_box(self.width, self.depth, self.thickness,
                          (0, 0, -self.thickness/2))
        set_mesh_color(floor, self.tile_color)
        
        meshes = [floor]
        
        grout_thickness = 0.01
        
        # Grout lines - vertical
        num_cols = int(self.width / self.tile_size)
        for i in range(1, num_cols):
            x = -self.width/2 + i * self.tile_size
            grout = create_box(grout_thickness, self.depth, self.thickness + 0.002,
                             (x, 0, -self.thickness/2))
            set_mesh_color(grout, self.grout_color)
            meshes.append(grout)
        
        # Grout lines - horizontal
        num_rows = int(self.depth / self.tile_size)
        for i in range(1, num_rows):
            y = -self.depth/2 + i * self.tile_size
            grout = create_box(self.width, grout_thickness, self.thickness + 0.002,
                             (0, y, -self.thickness/2))
            set_mesh_color(grout, self.grout_color)
            meshes.append(grout)
        
        mesh = trimesh.util.concatenate(meshes)
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class FloorStone(BaseFloor):
    """Natural stone floor with irregular pattern."""
    
    def __init__(self, *args, stone_color: Tuple[int, int, int, int] = (140, 130, 120, 255), **kwargs):
        super().__init__(*args, **kwargs)
        self.stone_color = stone_color
    
    def generate(self) -> trimesh.Trimesh:
        # Base floor
        floor = create_box(self.width, self.depth, self.thickness,
                          (0, 0, -self.thickness/2))
        set_mesh_color(floor, self.stone_color)
        
        meshes = [floor]
        
        # Random stone tiles
        np.random.seed(42)
        num_stones = 40
        
        for _ in range(num_stones):
            stone_w = np.random.uniform(0.3, 0.6)
            stone_d = np.random.uniform(0.3, 0.6)
            x = np.random.uniform(-self.width/2 + stone_w/2, self.width/2 - stone_w/2)
            y = np.random.uniform(-self.depth/2 + stone_d/2, self.depth/2 - stone_d/2)
            
            stone = create_box(stone_w, stone_d, self.thickness + 0.005,
                             (x, y, -self.thickness/2))
            
            # Vary color slightly
            color_var = np.random.randint(-15, 15, 3)
            stone_col = tuple(np.clip(np.array(self.stone_color[:3]) + color_var, 0, 255).tolist()) + (255,)
            set_mesh_color(stone, stone_col)
            meshes.append(stone)
        
        mesh = trimesh.util.concatenate(meshes)
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


class FloorCarpet(BaseFloor):
    """Carpeted floor."""
    
    def __init__(self, *args, carpet_color: Tuple[int, int, int, int] = (180, 140, 100, 255), **kwargs):
        super().__init__(*args, **kwargs)
        self.carpet_color = carpet_color
        self.thickness = 0.02  # Carpet is thinner
    
    def generate(self) -> trimesh.Trimesh:
        floor = create_box(self.width, self.depth, self.thickness,
                          (0, 0, -self.thickness/2))
        set_mesh_color(floor, self.carpet_color)
        
        # Add subtle texture variation
        meshes = [floor]
        
        np.random.seed(42)
        for _ in range(20):
            x = np.random.uniform(-self.width/2, self.width/2)
            y = np.random.uniform(-self.depth/2, self.depth/2)
            patch = create_box(0.1, 0.1, self.thickness + 0.001,
                             (x, y, -self.thickness/2))
            
            # Slight color variation
            color_var = np.random.randint(-10, 10, 3)
            patch_col = tuple(np.clip(np.array(self.carpet_color[:3]) + color_var, 0, 255).tolist()) + (255,)
            set_mesh_color(patch, patch_col)
            meshes.append(patch)
        
        mesh = trimesh.util.concatenate(meshes)
        mesh = apply_rotation(mesh, self.rotation)
        
        return mesh


# ============================================================================
# EXPORT UTILITIES
# ============================================================================

def export_to_gltf(mesh: trimesh.Trimesh, filename: str):
    """Export mesh to GLTF format."""
    mesh.export(filename)


def export_to_obj(mesh: trimesh.Trimesh, filename: str):
    """Export mesh to OBJ format."""
    mesh.export(filename)


# ============================================================================
# EXAMPLE USAGE AND TESTING
# ============================================================================

def generate_examples():
    """Generate example instances of all components."""
    
    print("Generating example architectural elements...")
    
    # Create output directory
    import os
    os.makedirs('/home/claude/architectural_elements', exist_ok=True)
    
    examples = []
    
    # DOORS
    print("\n=== DOORS ===")
    
    door1 = DoorSwing(width=0.9, height=2.1, rotation=0,
                     material=Material(MaterialType.WOOD, (139, 90, 60, 255)))
    examples.append(("door_swing", door1.generate()))
    print("✓ DoorSwing(width=0.9, height=2.1, handle=LEVER, color=(139,90,60))")
    
    door2 = DoorSliding(width=1.5, height=2.2,
                       material=Material(MaterialType.GLASS, (200, 220, 255, 180)))
    examples.append(("door_sliding", door2.generate()))
    print("✓ DoorSliding(width=1.5, height=2.2)")
    
    door3 = DoorDouble(width=1.8, height=2.3,
                      material=Material(MaterialType.WOOD, (120, 80, 50, 255)))
    examples.append(("door_double", door3.generate()))
    print("✓ DoorDouble(width=1.8, height=2.3)")
    
    door4 = DoorFolding(width=2.0, height=2.1, panels=4)
    examples.append(("door_folding", door4.generate()))
    print("✓ DoorFolding(width=2.0, height=2.1, panels=4)")
    
    door5 = DoorPanelled(width=0.9, height=2.1, panels=6,
                        material=Material(MaterialType.WOOD, (100, 60, 40, 255)))
    examples.append(("door_panelled", door5.generate()))
    print("✓ DoorPanelled(width=0.9, height=2.1, panels=6)")
    
    door6 = DoorGlass(width=1.0, height=2.2, glass_color=(180, 200, 240, 150))
    examples.append(("door_glass", door6.generate()))
    print("✓ DoorGlass(width=1.0, height=2.2, glass_color=(180,200,240,150))")
    
    door7 = DoorArched(width=1.1, height=2.5)
    examples.append(("door_arched", door7.generate()))
    print("✓ DoorArched(width=1.1, height=2.5)")
    
    door8 = DoorModern(width=1.0, height=2.3,
                      material=Material(MaterialType.WOOD, (60, 60, 60, 255)))
    examples.append(("door_modern", door8.generate()))
    print("✓ DoorModern(width=1.0, height=2.3, color=(60,60,60))")
    
    door9 = DoorClassic(width=0.95, height=2.2,
                       material=Material(MaterialType.WOOD, (150, 100, 70, 255)))
    examples.append(("door_classic", door9.generate()))
    print("✓ DoorClassic(width=0.95, height=2.2)")
    
    door10 = DoorBarn(width=1.2, height=2.0,
                     material=Material(MaterialType.WOOD, (130, 80, 50, 255)))
    examples.append(("door_barn", door10.generate()))
    print("✓ DoorBarn(width=1.2, height=2.0)")
    
    # WINDOWS
    print("\n=== WINDOWS ===")
    
    win1 = WindowCasement(width=1.2, height=1.5)
    examples.append(("window_casement", win1.generate()))
    print("✓ WindowCasement(width=1.2, height=1.5)")
    
    win2 = WindowSliding(width=1.8, height=1.5)
    examples.append(("window_sliding", win2.generate()))
    print("✓ WindowSliding(width=1.8, height=1.5)")
    
    win3 = WindowBay(width=2.5, height=1.8, projection=0.6)
    examples.append(("window_bay", win3.generate()))
    print("✓ WindowBay(width=2.5, height=1.8, projection=0.6)")
    
    win4 = WindowArched(width=1.0, height=1.8)
    examples.append(("window_arched", win4.generate()))
    print("✓ WindowArched(width=1.0, height=1.8)")
    
    win5 = WindowLouvered(width=1.0, height=1.2, num_slats=8)
    examples.append(("window_louvered", win5.generate()))
    print("✓ WindowLouvered(width=1.0, height=1.2, num_slats=8)")
    
    win6 = WindowFixed(width=2.0, height=1.5)
    examples.append(("window_fixed", win6.generate()))
    print("✓ WindowFixed(width=2.0, height=1.5)")
    
    win7 = WindowSkylight(width=1.2, height=1.2, angle=15)
    examples.append(("window_skylight", win7.generate()))
    print("✓ WindowSkylight(width=1.2, height=1.2, angle=15)")
    
    win8 = WindowModern(width=1.5, height=2.4)
    examples.append(("window_modern", win8.generate()))
    print("✓ WindowModern(width=1.5, height=2.4)")
    
    win9 = WindowClassic(width=1.2, height=1.6, rows=2, cols=2)
    examples.append(("window_classic", win9.generate()))
    print("✓ WindowClassic(width=1.2, height=1.6, rows=2, cols=2)")
    
    win10 = WindowGlassWall(width=3.0, height=2.7)
    examples.append(("window_glass_wall", win10.generate()))
    print("✓ WindowGlassWall(width=3.0, height=2.7)")
    
    # WALLS
    print("\n=== WALLS ===")
    
    wall1 = WallPlain(length=4.0, height=2.7)
    examples.append(("wall_plain", wall1.generate()))
    print("✓ WallPlain(length=4.0, height=2.7)")
    
    wall2 = WallBrick(length=4.0, height=2.7)
    examples.append(("wall_brick", wall2.generate()))
    print("✓ WallBrick(length=4.0, height=2.7)")
    
    wall3 = WallStone(length=4.0, height=2.7)
    examples.append(("wall_stone", wall3.generate()))
    print("✓ WallStone(length=4.0, height=2.7)")
    
    wall4 = WallConcrete(length=4.0, height=2.7)
    examples.append(("wall_concrete", wall4.generate()))
    print("✓ WallConcrete(length=4.0, height=2.7)")
    
    wall5 = WallHalfTimbered(length=4.0, height=2.7)
    examples.append(("wall_half_timbered", wall5.generate()))
    print("✓ WallHalfTimbered(length=4.0, height=2.7)")
    
    # FLOORS
    print("\n=== FLOORS ===")
    
    floor1 = FloorConcrete(width=4.0, depth=4.0)
    examples.append(("floor_concrete", floor1.generate()))
    print("✓ FloorConcrete(width=4.0, depth=4.0)")
    
    floor2 = FloorWood(width=4.0, depth=4.0, plank_width=0.15)
    examples.append(("floor_wood", floor2.generate()))
    print("✓ FloorWood(width=4.0, depth=4.0, plank_width=0.15)")
    
    floor3 = FloorTile(width=4.0, depth=4.0, tile_size=0.3)
    examples.append(("floor_tile", floor3.generate()))
    print("✓ FloorTile(width=4.0, depth=4.0, tile_size=0.3)")
    
    floor4 = FloorStone(width=4.0, depth=4.0)
    examples.append(("floor_stone", floor4.generate()))
    print("✓ FloorStone(width=4.0, depth=4.0)")
    
    floor5 = FloorCarpet(width=4.0, depth=4.0,
                        carpet_color=(180, 140, 100, 255))
    examples.append(("floor_carpet", floor5.generate()))
    print("✓ FloorCarpet(width=4.0, depth=4.0, carpet_color=(180,140,100))")
    
    # Export all examples
    print("\n=== EXPORTING ===")
    for name, mesh in examples:
        gltf_path = f'/home/claude/architectural_elements/{name}.glb'
        obj_path = f'/home/claude/architectural_elements/{name}.obj'
        
        mesh.export(gltf_path)
        mesh.export(obj_path)
        print(f"✓ Exported {name}")
    
    print(f"\n✅ Generated {len(examples)} architectural elements")
    print(f"📁 Files saved to: /home/claude/architectural_elements/")
    
    return examples


if __name__ == "__main__":
    examples = generate_examples()
    
    # Create a comprehensive scene example
    print("\n=== CREATING SAMPLE SCENE ===")
    
    # Room with walls, floor, door, and window
    scene_meshes = []
    
    # Floor
    floor = FloorWood(width=5.0, depth=5.0).generate()
    scene_meshes.append(floor)
    
    # Walls
    wall_front = WallPlain(length=5.0, height=2.7, thickness=0.2)
    wall_front.material = Material(MaterialType.PLASTER, (240, 240, 235, 255))
    wall_front_mesh = wall_front.generate()
    wall_front_mesh.apply_translation((0, -2.5, 1.35))
    scene_meshes.append(wall_front_mesh)
    
    wall_back = WallBrick(length=5.0, height=2.7, thickness=0.2).generate()
    wall_back.apply_translation((0, 2.5, 1.35))
    scene_meshes.append(wall_back)
    
    # Door in front wall
    door = DoorSwing(width=0.9, height=2.1).generate()
    door.apply_translation((1.5, -2.5, 1.05))
    scene_meshes.append(door)
    
    # Window in back wall
    window = WindowCasement(width=1.2, height=1.5).generate()
    window.apply_translation((-1.5, 2.5, 1.5))
    scene_meshes.append(window)
    
    # Combine scene
    scene = trimesh.util.concatenate(scene_meshes)
    scene.export('/home/claude/architectural_elements/sample_room_scene.glb')
    print("✓ Created sample room scene")
    
    print("\n🎉 All architectural elements generated successfully!")
    print("📦 Total components: 10 doors + 10 windows + 5 walls + 5 floors = 30 types")