"""
Landscaping and soft works module
Trees, grass, shrubs, and planted areas with service clearances
"""

from dataclasses import dataclass
from typing import List, Tuple, Dict, Optional
from enum import Enum
import numpy as np
from geometry_utils import Mesh, MeshBuilder, Vector3, Transform
import json


class PlantType(Enum):
    TREE = "tree"
    SHRUB = "shrub"
    GRASS = "grass"
    FLOWER_BED = "flower_bed"
    GROUND_COVER = "ground_cover"


class TreeSpecies(Enum):
    GENERIC_SMALL = "generic_small"  # 3-5m mature
    GENERIC_MEDIUM = "generic_medium"  # 5-10m mature
    GENERIC_LARGE = "generic_large"  # 10-20m mature
    PALM = "palm"
    EVERGREEN = "evergreen"
    DECIDUOUS = "deciduous"


@dataclass
class TreeClearances:
    """Required clearances for trees"""
    min_distance_from_building: float = 3.0  # meters
    min_distance_from_drain: float = 2.0
    min_distance_from_road: float = 1.5
    min_distance_from_underground_service: float = 3.0
    min_spacing_between_trees: float = 4.0
    
    def validate_position(self, tree_pos: Vector3, obstacles: List[Vector3]) -> Tuple[bool, str]:
        """Check if tree position meets clearance requirements"""
        for obs in obstacles:
            distance = (tree_pos - obs).length()
            if distance < self.min_distance_from_building:
                return False, f"Tree too close to obstacle ({distance:.2f}m < {self.min_distance_from_building}m)"
        return True, ""


class Tree:
    """Tree element with growth characteristics"""
    
    def __init__(self, tree_id: str, position: Vector3, species: TreeSpecies):
        self.tree_id = tree_id
        self.position = position
        self.species = species
        
        # Size parameters
        self.trunk_diameter = 0.3
        self.trunk_height = 2.0
        self.canopy_radius = 2.0
        self.canopy_height = 3.0
        
        # Adjust based on species
        self._set_species_parameters()
        
        # Root zone (for service clearance)
        self.root_radius = self.canopy_radius * 1.5
        
        self.clearances = TreeClearances()
    
    def _set_species_parameters(self):
        """Set size parameters based on species"""
        if self.species == TreeSpecies.GENERIC_SMALL:
            self.trunk_diameter = 0.2
            self.trunk_height = 1.5
            self.canopy_radius = 1.5
            self.canopy_height = 2.5
        
        elif self.species == TreeSpecies.GENERIC_MEDIUM:
            self.trunk_diameter = 0.3
            self.trunk_height = 2.5
            self.canopy_radius = 2.5
            self.canopy_height = 4.0
        
        elif self.species == TreeSpecies.GENERIC_LARGE:
            self.trunk_diameter = 0.5
            self.trunk_height = 4.0
            self.canopy_radius = 4.0
            self.canopy_height = 6.0
        
        elif self.species == TreeSpecies.PALM:
            self.trunk_diameter = 0.4
            self.trunk_height = 6.0
            self.canopy_radius = 2.0
            self.canopy_height = 2.0
    
    def generate_mesh(self) -> Mesh:
        """Generate simplified tree mesh"""
        mesh = Mesh()
        
        # Trunk
        trunk = MeshBuilder.create_cylinder(self.trunk_diameter / 2, self.trunk_height, 8)
        trunk_transform = Transform(
            position=Vector3(self.position.x, self.position.y + self.trunk_height / 2, self.position.z),
            rotation=Vector3(0, 0, 0),
            scale=Vector3(1, 1, 1)
        )
        trunk.transform(trunk_transform)
        trunk.material_name = "tree_trunk"
        mesh.merge(trunk)
        
        # Canopy (simplified as sphere/ellipsoid)
        if self.species == TreeSpecies.PALM:
            # Palm fronds - simplified as cone
            canopy = MeshBuilder.create_cylinder(0.1, self.canopy_height, 6)
            for i in range(6):
                angle = i * np.pi / 3
                offset_x = np.cos(angle) * self.canopy_radius
                offset_z = np.sin(angle) * self.canopy_radius
                
                frond_transform = Transform(
                    position=Vector3(
                        self.position.x + offset_x * 0.5,
                        self.position.y + self.trunk_height + self.canopy_height / 2,
                        self.position.z + offset_z * 0.5
                    ),
                    rotation=Vector3(np.pi / 6, angle, 0),
                    scale=Vector3(1, 1, 1)
                )
                frond = MeshBuilder.create_cylinder(0.1, self.canopy_height, 6)
                frond.transform(frond_transform)
                frond.material_name = "tree_foliage"
                mesh.merge(frond)
        else:
            # Regular tree canopy
            canopy_segments = 12
            canopy = MeshBuilder.create_cylinder(self.canopy_radius, self.canopy_height, canopy_segments)
            canopy_transform = Transform(
                position=Vector3(
                    self.position.x,
                    self.position.y + self.trunk_height + self.canopy_height / 2,
                    self.position.z
                ),
                rotation=Vector3(0, 0, 0),
                scale=Vector3(1, 1, 1)
            )
            canopy.transform(canopy_transform)
            canopy.material_name = "tree_foliage"
            mesh.merge(canopy)
        
        return mesh
    
    def get_clearance_zone(self) -> Mesh:
        """Generate clearance zone visualization"""
        mesh = MeshBuilder.create_cylinder(self.root_radius, 0.1, 16)
        transform = Transform(
            position=Vector3(self.position.x, self.position.y - 0.05, self.position.z),
            rotation=Vector3(0, 0, 0),
            scale=Vector3(1, 1, 1)
        )
        mesh.transform(transform)
        mesh.material_name = "clearance_zone"
        return mesh
    
    def to_json(self) -> Dict:
        """Export tree metadata"""
        return {
            "tree_id": self.tree_id,
            "position": {"x": self.position.x, "y": self.position.y, "z": self.position.z},
            "species": self.species.value,
            "dimensions": {
                "trunk_diameter": self.trunk_diameter,
                "trunk_height": self.trunk_height,
                "canopy_radius": self.canopy_radius,
                "canopy_height": self.canopy_height,
                "root_radius": self.root_radius
            }
        }


class GrassArea:
    """Grass / lawn area"""
    
    def __init__(self, area_id: str, boundary: List[Vector3], elevation: float = 0.0):
        self.area_id = area_id
        self.boundary = boundary
        self.elevation = elevation
        
        # Grass parameters
        self.requires_irrigation = True
        self.mowing_access_required = True
    
    def generate_mesh(self) -> Mesh:
        """Generate grass surface mesh"""
        mesh = Mesh()
        mesh.material_name = "grass"
        
        if len(self.boundary) < 3:
            return mesh
        
        # Triangulate polygon (simplified - assumes convex)
        center_idx = mesh.add_vertex(
            self._calculate_centroid(),
            Vector3(0, 1, 0),
            (0.5, 0.5)
        )
        
        for i, point in enumerate(self.boundary):
            u = i / len(self.boundary)
            idx = mesh.add_vertex(point, Vector3(0, 1, 0), (u, 1.0))
        
        # Create triangles from center to boundary
        for i in range(len(self.boundary)):
            next_i = (i + 1) % len(self.boundary)
            mesh.add_triangle(center_idx, i + 1, next_i + 1)
        
        return mesh
    
    def _calculate_centroid(self) -> Vector3:
        """Calculate polygon centroid"""
        if not self.boundary:
            return Vector3(0, 0, 0)
        
        sum_x = sum(p.x for p in self.boundary)
        sum_y = sum(p.y for p in self.boundary)
        sum_z = sum(p.z for p in self.boundary)
        n = len(self.boundary)
        
        return Vector3(sum_x / n, sum_y / n, sum_z / n)
    
    def to_json(self) -> Dict:
        """Export grass area metadata"""
        return {
            "area_id": self.area_id,
            "system": "external_works",
            "subsystem": "landscape",
            "type": "grass",
            "boundary_points": len(self.boundary),
            "elevation": self.elevation,
            "irrigation": self.requires_irrigation
        }


class PlantBed:
    """Flower bed or shrub planting area"""
    
    def __init__(self, bed_id: str, position: Vector3, width: float, length: float,
                 plant_type: PlantType = PlantType.FLOWER_BED):
        
        self.bed_id = bed_id
        self.position = position
        self.width = width
        self.length = length
        self.plant_type = plant_type
        
        # Bed construction
        self.soil_depth = 0.3  # meters
        self.edging_height = 0.2
        self.mulch_depth = 0.05
    
    def generate_mesh(self) -> Mesh:
        """Generate planter bed"""
        mesh = Mesh()
        
        # Soil bed
        soil = MeshBuilder.create_box(self.width, self.soil_depth, self.length)
        soil_transform = Transform(
            position=Vector3(
                self.position.x,
                self.position.y + self.soil_depth / 2,
                self.position.z
            ),
            rotation=Vector3(0, 0, 0),
            scale=Vector3(1, 1, 1)
        )
        soil.transform(soil_transform)
        soil.material_name = "planting_soil"
        mesh.merge(soil)
        
        # Edging (all four sides)
        edging_width = 0.1
        
        # Front and back
        for z_offset in [-self.length/2, self.length/2]:
            edge = MeshBuilder.create_box(self.width + 2*edging_width, self.edging_height, edging_width)
            edge_transform = Transform(
                position=Vector3(
                    self.position.x,
                    self.position.y + self.edging_height / 2,
                    self.position.z + z_offset
                ),
                rotation=Vector3(0, 0, 0),
                scale=Vector3(1, 1, 1)
            )
            edge.transform(edge_transform)
            edge.material_name = "bed_edging"
            mesh.merge(edge)
        
        # Left and right
        for x_offset in [-self.width/2, self.width/2]:
            edge = MeshBuilder.create_box(edging_width, self.edging_height, self.length)
            edge_transform = Transform(
                position=Vector3(
                    self.position.x + x_offset,
                    self.position.y + self.edging_height / 2,
                    self.position.z
                ),
                rotation=Vector3(0, 0, 0),
                scale=Vector3(1, 1, 1)
            )
            edge.transform(edge_transform)
            edge.material_name = "bed_edging"
            mesh.merge(edge)
        
        return mesh
    
    def to_json(self) -> Dict:
        """Export planter bed metadata"""
        return {
            "bed_id": self.bed_id,
            "position": {"x": self.position.x, "y": self.position.y, "z": self.position.z},
            "dimensions": {
                "width": self.width,
                "length": self.length,
                "soil_depth": self.soil_depth
            },
            "plant_type": self.plant_type.value
        }


class LandscapeNetwork:
    """Manager for all landscape elements"""
    
    def __init__(self, site_name: str):
        self.site_name = site_name
        self.trees: List[Tree] = []
        self.grass_areas: List[GrassArea] = []
        self.plant_beds: List[PlantBed] = []
        
        # Service line positions for clearance checking
        self.service_lines: List[Vector3] = []
        self.drainage_positions: List[Vector3] = []
    
    def add_tree(self, tree: Tree):
        """Add tree with clearance validation"""
        # Check clearances
        obstacles = self.service_lines + self.drainage_positions
        obstacles.extend([t.position for t in self.trees])
        
        valid, msg = tree.clearances.validate_position(tree.position, obstacles)
        if not valid:
            raise ValueError(f"Tree clearance violation: {msg}")
        
        # Check spacing from existing trees
        for existing_tree in self.trees:
            distance = (tree.position - existing_tree.position).length()
            if distance < tree.clearances.min_spacing_between_trees:
                raise ValueError(f"Trees too close together ({distance:.2f}m)")
        
        self.trees.append(tree)
    
    def add_grass_area(self, grass: GrassArea):
        """Add grass area"""
        self.grass_areas.append(grass)
    
    def add_plant_bed(self, bed: PlantBed):
        """Add planter bed"""
        self.plant_beds.append(bed)
    
    def register_service_line(self, position: Vector3):
        """Register underground service for clearance checking"""
        self.service_lines.append(position)
    
    def register_drainage(self, position: Vector3):
        """Register drainage element for clearance checking"""
        self.drainage_positions.append(position)
    
    def validate_network(self) -> Tuple[bool, List[str]]:
        """Validate landscape design"""
        errors = []
        
        # Check tree clearances
        for tree in self.trees:
            # Check against services
            for service in self.service_lines:
                distance = (tree.position - service).length()
                if distance < tree.clearances.min_distance_from_underground_service:
                    errors.append(f"{tree.tree_id}: Too close to underground service")
            
            # Check against drainage
            for drain in self.drainage_positions:
                distance = (tree.position - drain).length()
                if distance < tree.clearances.min_distance_from_drain:
                    errors.append(f"{tree.tree_id}: Too close to drainage element")
        
        return len(errors) == 0, errors
    
    def generate_all_meshes(self) -> List[Mesh]:
        """Generate all landscape meshes"""
        meshes = []
        
        for tree in self.trees:
            meshes.append(tree.generate_mesh())
        
        for grass in self.grass_areas:
            meshes.append(grass.generate_mesh())
        
        for bed in self.plant_beds:
            meshes.append(bed.generate_mesh())
        
        return meshes
    
    def export_metadata(self, filename: str):
        """Export landscape network metadata"""
        valid, errors = self.validate_network()
        
        data = {
            "site_name": self.site_name,
            "system": "landscape_network",
            "validation": {
                "valid": valid,
                "errors": errors
            },
            "trees": [tree.to_json() for tree in self.trees],
            "grass_areas": [grass.to_json() for grass in self.grass_areas],
            "plant_beds": [bed.to_json() for bed in self.plant_beds]
        }
        
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        
        return filename