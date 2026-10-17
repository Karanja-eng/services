"""
CAD + BIM + IFC interoperability layer for Fundi Studio.

Modules
-------
``identity``     stable internal element identity and derived IFC GlobalIds
``units``        canonical units, coordinate conventions and conversions
``septic_model`` canonical engineering model for the septic system generator
``ifc_export``   semantic IFC4 generation/validation (IfcOpenShell, server side)
``dxf_export``   DXF plan/section generation and XDATA link extraction (ezdxf)
``mapping``      persistent element <-> CAD entity <-> IFC element mapping
``pipeline``     end-to-end generation used by the API, the CLI and the tests

The engineering generators themselves are *not* modified by any of this: the
canonical model restates their parameters and geometry derivation so that IFC
and DXF can be produced without changing how the application renders.
"""

from .identity import (  # noqa: F401
    copy_suffix,
    element_fingerprint,
    ifc_guid_from_internal_id,
    make_element_id,
)
from .septic_model import build_model, default_parameters, model_hash  # noqa: F401
from .pipeline import run_pipeline  # noqa: F401

__all__ = [
    "build_model",
    "default_parameters",
    "model_hash",
    "run_pipeline",
    "copy_suffix",
    "element_fingerprint",
    "ifc_guid_from_internal_id",
    "make_element_id",
]
