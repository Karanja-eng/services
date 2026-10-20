"""
Standalone launcher for the CAD / BIM / IFC interoperability layer.

Why this exists
---------------
The full backend (``src/Backend/main.py``) imports ~30 routers, several of which
pull in heavy machine-learning dependencies (torch/transformers). That makes it slow
to start and impossible to run in a lean environment that only needs the CAD/BIM
feature set. It also cannot be imported as ``src.Backend.main`` from the repository
root, because it uses top-level imports (``from Databases import …``,
``from cad_ifc.router import …``) and therefore needs ``src/Backend`` on ``sys.path``.

This module mounts **only** the interoperability router, so the
``/interop/cad-bim`` workbench can be exercised with nothing but
fastapi + uvicorn + ezdxf + ifcopenshell:

    # from the repository root
    .venv-ifc\\Scripts\\python.exe -m src.Backend.cad_ifc.standalone

    # or from src/Backend
    ..\\..\\.venv-ifc\\Scripts\\python.exe -m cad_ifc.standalone

    # options
    ... --host 127.0.0.1 --port 8001 --no-reload

The endpoint surface is exactly what ``docs/integration/ifc_that_open.md`` §6
documents; nothing is added or hidden here. When the full backend is running instead,
``main.py`` mounts the same router at the same prefix, so the frontend does not care
which one is serving it.
"""

from __future__ import annotations

import argparse
from typing import List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import ifc_export
from . import router as cad_ifc_router

#: Same prefix the full backend uses (``main.py``), so the frontend is agnostic.
API_PREFIX = "/api/cad-ifc"

DESCRIPTION = """
CAD, BIM and IFC interoperability for Fundi Studio.

Runs the existing Python RC detailing generators and projects one canonical
engineering model into two representations:

* **DXF** — the generator's own detailing sheet, tagged with Fundi element identity
* **IFC4** — a semantic model written with IfcOpenShell

The persistent mapping records which CAD entity and which IFC GlobalId belong to
which engineering element. Nothing here re-implements detailing rules, and CAD
geometry is never written back into the engineering model automatically.
"""


def create_app() -> FastAPI:
    """Build the minimal ASGI app that serves the interoperability router."""
    app = FastAPI(
        title="Fundi Studio — CAD/BIM/IFC",
        description=DESCRIPTION.strip(),
        version="1.0.0",
    )
    # The workbench runs on the Create React App dev server (a different origin),
    # exactly like the full backend, so the same permissive policy applies. This is
    # a local engineering tool; it is not exposed publicly by this launcher.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(cad_ifc_router.router, prefix=API_PREFIX, tags=["cad_ifc"])
    return app


app = create_app()


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Run only the Fundi CAD/BIM/IFC API (no heavy backend routers)."
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8001)
    parser.add_argument(
        "--reload",
        dest="reload",
        action="store_true",
        default=False,
        help="auto-reload on source changes (needs a module path, disables the "
        "programmatic app object)",
    )
    parser.add_argument("--no-reload", dest="reload", action="store_false")
    args = parser.parse_args(argv)

    import uvicorn

    if not ifc_export.IFC_AVAILABLE:
        # Fail loudly and early: the /generate endpoint cannot work without it, and a
        # silent 503 later is much harder to diagnose than a startup message.
        print(
            "[cad_ifc] WARNING: IfcOpenShell is not importable "
            f"({ifc_export.IFC_IMPORT_ERROR})."
        )
        print(
            "[cad_ifc] DXF generation will work; POST /api/cad-ifc/generate will "
            "return 503 until it is installed. Install with: "
            ".venv-ifc\\Scripts\\python.exe -m pip install ifcopenshell"
        )

    print(f"[cad_ifc] serving {API_PREFIX} on http://{args.host}:{args.port}")
    print(f"[cad_ifc] docs: http://{args.host}:{args.port}/docs")
    print(f"[cad_ifc] health: http://{args.host}:{args.port}{API_PREFIX}/health")

    if args.reload:
        uvicorn.run(
            "src.Backend.cad_ifc.standalone:app" if __package__ else "cad_ifc.standalone:app",
            host=args.host,
            port=args.port,
            reload=True,
        )
    else:
        uvicorn.run(app, host=args.host, port=args.port)
    return 0


if __name__ == "__main__":  # pragma: no cover - process entry point
    raise SystemExit(main())
