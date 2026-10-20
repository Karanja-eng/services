"""
Controlled storage for generated artefacts (DXF drawings and IFC models).

Rules enforced here
-------------------
* **Nothing is written inside the source tree of a generator.** The existing
  ``engineering_system`` writes into ``outputs/`` by default; the adapters must
  not. Every artefact produced by this application goes to one directory that is
  served statically by Create React App, so the browser can fetch it, and every
  path is derived from an identifier rather than supplied by the client.
* **Generated files are distinct from the reference outputs.** The reference
  DXFs committed under ``src/Backend/Cad_Generator/outputs`` are never
  overwritten; generated drawings get a drawing id and a revision.
* **Identifiers are sanitised.** A drawing/model id arriving from the browser is
  validated against a strict pattern, so a request cannot traverse out of the
  artefact directory.
* **The manifest is the truth about what exists.** ``list_artefacts`` reads the
  directory, so a deleted or externally replaced file is visible rather than
  assumed present.
"""

from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional

#: Repository root (``.../Services``), derived from this file's location.
REPO_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__)
    )))))
)

#: Directory served at ``/`` by Create React App.
#:
#: Overridable with ``FUNDI_ARTIFACT_DIR`` so the test suite can write into a
#: temporary directory instead of the repository's ``public/`` folder. Production
#: and development both use ``public/`` so the browser can fetch artefacts at
#: ``/cad/...`` and ``/ifc/...`` without the backend serving files.
PUBLIC_DIR = os.environ.get("FUNDI_ARTIFACT_DIR") or os.path.join(REPO_ROOT, "public")

#: Generated DXF drawings (served at ``/cad/...``).
CAD_DIR = os.path.join(PUBLIC_DIR, "cad")

#: Generated IFC models (served at ``/ifc/...``).
IFC_DIR = os.path.join(PUBLIC_DIR, "ifc")

#: Canonical model documents and mapping exports (served at ``/cad/...``).
DATA_DIR = os.path.join(PUBLIC_DIR, "cad")

#: Permitted characters in an artefact identifier.
_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._\-]{0,120}$")

#: Artefact extensions this module will ever serve.
ALLOWED_EXTENSIONS = ("dxf", "ifc", "json")


class StoreError(ValueError):
    """Raised for an invalid identifier or an unavailable artefact."""


def validate_id(value: str, kind: str = "identifier") -> str:
    """Validate an identifier that will become part of a file path."""
    if not isinstance(value, str) or not _ID_RE.match(value):
        raise StoreError(
            f"invalid {kind} {value!r}: only letters, digits, '.', '_' and '-' are "
            "allowed (max 120 characters)"
        )
    if ".." in value:
        raise StoreError(f"invalid {kind} {value!r}: '..' is not allowed")
    return value


def _ensure(directory: str) -> str:
    os.makedirs(directory, exist_ok=True)
    return directory


def drawing_id(identifier: str, revision: int) -> str:
    """Stable, unique drawing id for one generator run.

    Derived from the *model* id (not the generator key) so a drawing, its canonical
    model document and its IFC share one name: ``pad-footing``,
    ``pad-footing-r1.dxf``, ``pad-footing.ifc``. The revision keeps successive
    regenerations apart, so a drawing a user is editing is never overwritten.
    """
    validate_id(identifier, "model id")
    return f"{identifier}-r{int(revision)}"


def path_for(identifier: str, extension: str) -> str:
    """Absolute path of an artefact, validating both id and extension."""
    validate_id(identifier, "artefact id")
    if extension not in ALLOWED_EXTENSIONS:
        raise StoreError(
            f"unsupported artefact extension {extension!r}; allowed: "
            f"{', '.join(ALLOWED_EXTENSIONS)}"
        )
    if extension == "dxf":
        return os.path.join(_ensure(CAD_DIR), f"{identifier}.dxf")
    if extension == "ifc":
        return os.path.join(_ensure(IFC_DIR), f"{identifier}.ifc")
    return os.path.join(_ensure(DATA_DIR), f"{identifier}.json")


def url_for(identifier: str, extension: str) -> str:
    """Public URL (relative to the app root) for an artefact."""
    path_for(identifier, extension)  # validation only
    folder = {"dxf": "cad", "ifc": "ifc", "json": "cad"}[extension]
    return f"/{folder}/{identifier}.{extension}"


def exists(identifier: str, extension: str) -> bool:
    try:
        return os.path.exists(path_for(identifier, extension))
    except StoreError:
        return False


def stat(identifier: str, extension: str) -> Optional[Dict[str, Any]]:
    """Size and mtime of an artefact, or ``None`` when it does not exist."""
    path = path_for(identifier, extension)
    if not os.path.exists(path):
        return None
    info = os.stat(path)
    return {
        "path": path,
        "url": url_for(identifier, extension),
        "bytes": info.st_size,
        "mtime": info.st_mtime,
        "extension": extension,
    }


def list_artefacts(extension: str) -> List[str]:
    """Identifiers of every artefact with ``extension`` currently on disk."""
    if extension not in ALLOWED_EXTENSIONS:
        raise StoreError(f"unsupported artefact extension {extension!r}")
    folder = {"dxf": CAD_DIR, "ifc": IFC_DIR, "json": DATA_DIR}[extension]
    if not os.path.isdir(folder):
        return []
    suffix = f".{extension}"
    found = []
    for name in sorted(os.listdir(folder)):
        if not name.endswith(suffix):
            continue
        stem = name[: -len(suffix)]
        try:
            validate_id(stem)
        except StoreError:
            continue
        found.append(stem)
    return found


def describe() -> Dict[str, str]:
    """Directories in use, surfaced by the API for verification."""
    return {
        "public_dir": PUBLIC_DIR,
        "cad_dir": CAD_DIR,
        "ifc_dir": IFC_DIR,
        "cad_url": "/cad",
        "ifc_url": "/ifc",
    }
