"""
Foundation Factory Module
High-level functions to create foundations from site plan data
"""

import numpy as np
from typing import Dict, List, Tuple, Any, Optional, Union

from foundation_base import FoundationBase
from strip_foundation import StripFoundation, RCShearWallStripFoundation
from pile_foundation import Pile, PileGroup, PileCap
from raft_foundation import RaftFoundation, LiftShaftRaftFoundation


class FoundationFactory:
    """Factory class for creating foundation elements from site plan data"""
    
    @staticmethod
    def create_strip_foundations_from_walls(
        walls: List[Dict[str, Any]],
        soil_capacity: float,
        default_depth: float = 0.6,
        material: str = "C30/37"
    ) -> List[StripFoundation]:
        """
        Create strip foundations from wall definitions
        
        Args:
            walls: List of wall dictionaries with keys:
                   - start: (x, y) start point
                   - end: (x, y) end point
                   - thickness: wall thickness (m)
                   - load: line load (kN/m)
                   - type: "masonry" or "rc" (optional)
            soil_capacity: Allowable soil bearing capacity (kN/m²)
            default_depth: Default foundation depth (m)
            material: Concrete grade
            
        Returns:
            List of StripFoundation objects
        """
        foundations = []
        
        for i, wall in enumerate(walls):
            wall_type = wall.get("type", "masonry")
            
            try:
                if wall_type == "rc" or wall_type == "rc_shear_wall":
                    # RC shear wall foundation
                    foundation = RCShearWallStripFoundation(
                        wall_start=wall["start"],
                        wall_end=wall["end"],
                        wall_thickness=wall["thickness"],
                        wall_load=wall["load"],
                        moment_load=wall.get("moment", 0.0),
                        soil_capacity=soil_capacity,
                        depth=wall.get("depth", default_depth * 1.2),
                        material=wall.get("material", "C35/45")
                    )
                else:
                    # Standard strip foundation
                    foundation = StripFoundation(
                        wall_start=wall["start"],
                        wall_end=wall["end"],
                        wall_thickness=wall["thickness"],
                        wall_load=wall["load"],
                        soil_capacity=soil_capacity,
                        depth=wall.get("depth", default_depth),
                        wall_type=wall_type,
                        material=wall.get("material", material)
                    )
                
                foundations.append(foundation)
                
            except Exception as e:
                print(f"Warning: Failed to create foundation for wall {i}: {str(e)}")
        
        return foundations
    
    @staticmethod
    def create_pad_foundations_from_columns(
        columns: List[Dict[str, Any]],
        soil_capacity: float,
        default_depth: float = 0.6,
        material: str = "C30/37",
        combine_close_pads: bool = True,
        combination_threshold: float = 3.0
    ) -> List[Union[PadFoundation, CombinedPadFoundation]]:
        """
        Create pad foundations from column positions
        
        Args:
            columns: List of column dictionaries with keys:
                    - position: (x, y) location
                    - size: (width, depth) column dimensions
                    - load: column load (kN)
                    - type: column type (optional)
            soil_capacity: Allowable soil bearing capacity (kN/m²)
            default_depth: Default pad depth (m)
            material: Concrete grade
            combine_close_pads: Whether to combine closely-spaced pads
            combination_threshold: Maximum distance to combine pads (m)
            
        Returns:
            List of PadFoundation or CombinedPadFoundation objects
        """
        # Create individual pads
        individual_pads = []
        
        for i, col in enumerate(columns):
            try:
                pad = PadFoundation(
                    position=col["position"],
                    column_size=col["size"],
                    column_load=col["load"],
                    soil_capacity=soil_capacity,
                    pad_depth=col.get("depth", default_depth),
                    material=col.get("material", material),
                    column_type=col.get("type", "square")
                )
                individual_pads.append(pad)
                
            except Exception as e:
                print(f"Warning: Failed to create pad for column {i}: {str(e)}")
        
        # Combine close pads if requested
        if not combine_close_pads or len(individual_pads) <= 1:
            return individual_pads
        
        # Simple clustering based on distance
        foundations = []
        used = set()
        
        for i, pad1 in enumerate(individual_pads):
            if i in used:
                continue
            
            # Find nearby pads
            cluster = [pad1]
            used.add(i)
            
            for j, pad2 in enumerate(individual_pads):
                if j in used:
                    continue
                
                distance = np.linalg.norm(pad1.position - pad2.position)
                if distance <= combination_threshold:
                    cluster.append(pad2)
                    used.add(j)
            
            # Create combined or individual foundation
            if len(cluster) > 1:
                try:
                    combined = CombinedPadFoundation(
                        pads=cluster,
                        material=material
                    )
                    foundations.append(combined)
                except Exception as e:
                    print(f"Warning: Failed to combine pads: {str(e)}")
                    foundations.extend(cluster)
            else:
                foundations.append(pad1)
        
        return foundations
    
    # @staticmethod
    # def create_pile_foundation_from_loads(
    #     position: Tuple[float, float],
    #     total_load: float,
    #     soil_capacity: float,  # For pile cap bearing if needed
    #     pile_capacity: float = 500.0,  # Working capacity per pile (kN)
    #     pile_diameter: float = 0.5,
    #     pile_length: float = 12.0,
    #     pattern: str = "square",
    #     include_pile_cap: bool = True,
    #     column_size: Tuple[float, float] = (0.4, 0.4),
    #     material: str = "C35/45"
    # ) -> Union[PileGroup, PileCap]:
    #     """
    #     Create pile foundation with cap from load requirements
    #     
    #     Args:
    #         position: (x, y) center position
    #         total_load: Total load to be carried (kN)
    #         soil_capacity: Soil bearing capacity (for pile cap)
    #         pile_capacity: Working capacity per pile (kN)
    #         pile_diameter: Pile diameter (m)
    #         pile_length: Pile length (m)
    #         pattern: Pile arrangement pattern
    #         include_pile_cap: Whether to include pile cap
    #         column_size: Column dimensions for pile cap
    #         material: Concrete grade
    #         
    #     Returns:
    #         PileGroup or PileCap object
    #     """
    #     # Calculate spacing (3D minimum)
    #     spacing = max(3.0 * pile_diameter, 1.0)
    #     
    #     # Create pile group
    #     pile_group = PileGroup(
    #         center_position=position,
    #         pile_diameter=pile_diameter,
    #         pile_length=pile_length,
    #         pile_capacity=pile_capacity,
    #         total_load=total_load,
    #         spacing=spacing,
    #         pattern=pattern,
    #         material=material
    #     )
    #     
    #     if include_pile_cap:
    #         # Create pile cap
    #         pile_cap = PileCap(
    #             pile_group=pile_group,
    #             column_size=column_size,
    #             material=material
    #         )
    #         return pile_cap
    #     else:
    #         return pile_group
    
    @staticmethod
    def create_raft_from_building_footprint(
        footprint: List[Tuple[float, float]],
        total_load: float,
        soil_capacity: float,
        slab_thickness: float = 0.3,
        edge_beam_depth: float = 0.4,
        edge_beam_type: str = "downstand",
        internal_grid_spacing: Optional[float] = None,
        material: str = "C30/37"
    ) -> RaftFoundation:
        """
        Create raft foundation from building footprint
        
        Args:
            footprint: List of (x, y) vertices defining building boundary
            total_load: Total building load (kN)
            soil_capacity: Allowable soil bearing capacity (kN/m²)
            slab_thickness: Main slab thickness (m)
            edge_beam_depth: Depth of perimeter beam (m)
            edge_beam_type: "downstand" or "upstand"
            internal_grid_spacing: Spacing for internal rib grid (m), None for no ribs
            material: Concrete grade
            
        Returns:
            RaftFoundation object
        """
        # Generate internal ribs if spacing specified
        internal_ribs = []
        
        if internal_grid_spacing is not None:
            # Get bounding box
            points = np.array(footprint)
            min_x, min_y = points.min(axis=0)
            max_x, max_y = points.max(axis=0)
            
            # Create grid of ribs
            # X-direction ribs
            y = min_y + internal_grid_spacing
            while y < max_y:
                internal_ribs.append({
                    "start": (min_x, y),
                    "end": (max_x, y),
                    "width": 0.3,
                    "depth": 0.4,
                    "type": edge_beam_type
                })
                y += internal_grid_spacing
            
            # Y-direction ribs
            x = min_x + internal_grid_spacing
            while x < max_x:
                internal_ribs.append({
                    "start": (x, min_y),
                    "end": (x, max_y),
                    "width": 0.3,
                    "depth": 0.4,
                    "type": edge_beam_type
                })
                x += internal_grid_spacing
        
        return RaftFoundation(
            footprint=footprint,
            slab_thickness=slab_thickness,
            total_load=total_load,
            soil_capacity=soil_capacity,
            edge_beam_depth=edge_beam_depth,
            edge_beam_type=edge_beam_type,
            internal_ribs=internal_ribs,
            material=material
        )
    
    @staticmethod
    def create_lift_shaft_foundation(
        shaft_width: float,
        shaft_depth: float,
        center_position: Tuple[float, float],
        shaft_load: float,
        soil_capacity: float,
        pit_depth: float = 1.5,
        material: str = "C35/45"
    ) -> LiftShaftRaftFoundation:
        """
        Create lift shaft foundation
        
        Args:
            shaft_width: Width of lift shaft (m)
            shaft_depth: Depth of lift shaft (m)
            center_position: (x, y) center position
            shaft_load: Total load from lift (kN)
            soil_capacity: Allowable soil bearing capacity (kN/m²)
            pit_depth: Depth of lift pit below ground (m)
            material: Concrete grade
            
        Returns:
            LiftShaftRaftFoundation object
        """
        # Create rectangular footprint
        cx, cy = center_position
        hw, hd = shaft_width / 2, shaft_depth / 2
        
        footprint = [
            (cx - hw, cy - hd),
            (cx + hw, cy - hd),
            (cx + hw, cy + hd),
            (cx - hw, cy + hd)
        ]
        
        return LiftShaftRaftFoundation(
            shaft_footprint=footprint,
            shaft_load=shaft_load,
            soil_capacity=soil_capacity,
            pit_depth=pit_depth,
            material=material
        )
    
    @staticmethod
    def export_all_foundations(
        foundations: List[FoundationBase],
        output_dir: str = "."
    ) -> Dict[str, Any]:
        """
        Export all foundations to GLTF and JSON
        
        Args:
            foundations: List of foundation objects
            output_dir: Directory for output files
            
        Returns:
            Dictionary with export results
        """
        results = {
            "gltf_files": [],
            "json_files": [],
            "combined_metadata": []
        }
        
        for i, foundation in enumerate(foundations):
            # Generate unique filename
            base_name = f"{foundation.foundation_type}_{i:03d}"
            
            # Export GLTF
            gltf_path = f"{output_dir}/{base_name}.gltf"
            try:
                foundation.to_gltf_nodes(gltf_path)
                results["gltf_files"].append(gltf_path)
            except Exception as e:
                print(f"Warning: Failed to export GLTF for {base_name}: {str(e)}")
            
            # Export JSON metadata
            json_path = f"{output_dir}/{base_name}.json"
            try:
                with open(json_path, 'w') as f:
                    f.write(foundation.to_json_metadata())
                results["json_files"].append(json_path)
            except Exception as e:
                print(f"Warning: Failed to export JSON for {base_name}: {str(e)}")
            
            # Add to combined metadata
            results["combined_metadata"].append(foundation.get_metadata())
        
        # Export combined metadata
        import json
        combined_path = f"{output_dir}/all_foundations.json"
        try:
            with open(combined_path, 'w') as f:
                json.dump(results["combined_metadata"], f, indent=2)
            results["combined_json"] = combined_path
        except Exception as e:
            print(f"Warning: Failed to export combined JSON: {str(e)}")
        
        return results