"""
bim_orchestrator.py

Orchestration engine for structural steel BIM and design pipeline.
Provides a registry for modules and manages the 5-step data flow:
1. Topology Generation
2. Structural Analysis (Legacy)
3. Member Design Checks (New)
4. Connection Design (New)
5. Detail & Drawing Generation (New)
"""

import uuid
from typing import List, Dict, Any, Callable, Optional, Type
from dataclasses import dataclass, field
from .Steel_BIM import Point3D, Line3D, Vector3D

# Registry for different module types
class SteelModuleRegistry:
    def __init__(self):
        self.generators: Dict[str, Callable] = {}
        self.analysis_engines: Dict[str, Callable] = {}
        self.design_engines: Dict[str, Callable] = {}
        self.connection_engines: Dict[str, Callable] = {}
        self.drawing_engines: Dict[str, Callable] = {}

    def register_generator(self, name: str, func: Callable):
        self.generators[name] = func

    def register_analysis_engine(self, name: str, func: Callable):
        self.analysis_engines[name] = func

    def register_design_engine(self, name: str, func: Callable):
        self.design_engines[name] = func

    def register_connection_engine(self, name: str, func: Callable):
        self.connection_engines[name] = func

    def register_drawing_engine(self, name: str, func: Callable):
        self.drawing_engines[name] = func

# Global registry instance
registry = SteelModuleRegistry()

@dataclass
class BIMModel:
    """Core BIM model structure to pass through the pipeline."""
    nodes: List[Dict[str, Any]] = field(default_factory=list)
    members: List[Dict[str, Any]] = field(default_factory=list)
    analysis_results: Optional[Dict[str, Any]] = None
    design_results: Optional[Dict[str, Any]] = None
    connection_results: Optional[Dict[str, Any]] = None
    drawing_data: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

class SteelBIMPipeline:
    def __init__(self, registry: SteelModuleRegistry):
        self.registry = registry

    async def execute(self, generator_name: str, params: Dict[str, Any], 
                analysis_method: str = 'matrix_stiffness',
                design_code: str = 'BS5950') -> BIMModel:
        """Executes the full BIM pipeline - now async."""
        
        # 1. Topology Generation
        if generator_name not in self.registry.generators:
            raise ValueError(f"Generator '{generator_name}' not registered")
        
        # Generators are typically sync, but we support both
        gen_func = self.registry.generators[generator_name]
        bim_data = gen_func(**params)
        model = BIMModel(**bim_data)
        
        # 2. Structural Analysis (Legacy) - likely async
        if analysis_method in self.registry.analysis_engines:
            analysis_func = self.registry.analysis_engines[analysis_method]
            if asyncio.iscoroutinefunction(analysis_func):
                model.analysis_results = await analysis_func(model)
            else:
                model.analysis_results = analysis_func(model)
        
        # 3. Member Design Checks - likely async
        if design_code in self.registry.design_engines:
            design_func = self.registry.design_engines[design_code]
            if asyncio.iscoroutinefunction(design_func):
                model.design_results = await design_func(model)
            else:
                model.design_results = design_func(model)
            
        # 4. Connection Design
        for conn_engine in self.registry.connection_engines.values():
            if asyncio.iscoroutinefunction(conn_engine):
                model.connection_results = await conn_engine(model)
            else:
                model.connection_results = conn_engine(model)
            
        # 5. Detail & Drawing Generation
        for draw_engine in self.registry.drawing_engines.values():
            if asyncio.iscoroutinefunction(draw_engine):
                model.drawing_data = await draw_engine(model)
            else:
                model.drawing_data = draw_engine(model)
            
        return model

# Factory helper for pipeline execution
async def run_steel_pipeline(generator_name: str, params: Dict[str, Any], **kwargs):
    pipeline = SteelBIMPipeline(registry)
    return await pipeline.execute(generator_name, params, **kwargs)
