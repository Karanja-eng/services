"""
Stable engineering identity for Fundi Studio CAD/BIM interoperability.

Design
------
Three identifier spaces exist in the target architecture and none of them may be
treated as the primary key of the engineering model:

* CAD entity handles (``dxf_handle``) - hexadecimal strings assigned per DXF
  file by the CAD engine. They are not stable across re-exports, and a copied
  entity receives a new handle while a deleted entity simply disappears.
* IFC ``GlobalId`` - a 22 character base64 encoding of a 128 bit GUID. IFC
  requires it to be globally unique; most exporters generate it randomly, which
  makes it useless as a join key between two regenerations of the same design.
* Internal element identity (``internal_id``) - owned by Fundi Studio, stable
  for the lifetime of an engineering element, independent of any file format.

This module defines the internal identity and derives an IFC GlobalId from it
deterministically (UUIDv5 in a fixed Fundi namespace), so that regenerating IFC
for unchanged engineering elements reproduces the same GlobalIds. That is what
makes a persistent CAD <-> IFC mapping possible at all.
"""

from __future__ import annotations

import hashlib
import json
import re
import uuid
from typing import Any, Dict

#: Fixed namespace UUID. Never change this value: doing so invalidates every
#: previously issued IFC GlobalId and therefore every stored mapping.
FUNDI_IDENTITY_NAMESPACE = uuid.UUID("8f14e45f-ceea-4a67-9a3e-2b1f0b1c9d77")

#: The 64 character alphabet defined by IFC for GlobalId encoding.
IFC_BASE64_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$"

_IFC_GUID_RE = re.compile(r"^[0-9A-Za-z_$]{22}$")

#: Characters permitted in an internal id. Kept URL-safe and XDATA-safe.
_INTERNAL_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:\-~]*$")


class IdentityError(ValueError):
    """Raised when an identifier is malformed or violates an invariant."""


def ifc_guid_from_internal_id(internal_id: str) -> str:
    """Derive a deterministic, IFC-valid 22 character GlobalId.

    The same ``internal_id`` always yields the same GlobalId, in any process and
    on any machine, which is what allows re-exported IFC to be joined back to
    the stored mapping.
    """
    if not internal_id:
        raise IdentityError("internal_id must be a non-empty string")
    value = uuid.uuid5(FUNDI_IDENTITY_NAMESPACE, internal_id).int
    chars = []
    for _ in range(22):
        chars.append(IFC_BASE64_ALPHABET[value % 64])
        value //= 64
    guid = "".join(reversed(chars))
    if not _IFC_GUID_RE.match(guid):  # pragma: no cover - defensive
        raise IdentityError(f"generated invalid IFC GlobalId: {guid!r}")
    return guid


def is_valid_ifc_guid(guid: str) -> bool:
    """Return True when ``guid`` is a syntactically valid IFC GlobalId."""
    return isinstance(guid, str) and bool(_IFC_GUID_RE.match(guid))


def make_element_id(model_id: str, role: str, index: int | None = None) -> str:
    """Build an internal element id such as ``septic-tank.wall.south``.

    ``model_id`` is the owning engineering model, ``role`` the semantic role of
    the element, and ``index`` disambiguates repeated roles (baffles, pipes).
    """
    if not model_id or not role:
        raise IdentityError("model_id and role are required")
    slug = re.sub(r"[^A-Za-z0-9._:\-]+", "-", f"{model_id}.{role}").strip("-")
    if index is not None:
        slug = f"{slug}~{index}"
    if not _INTERNAL_ID_RE.match(slug):
        raise IdentityError(f"invalid internal id derived: {slug!r}")
    return slug


def copy_suffix(internal_id: str, occurrence: int) -> str:
    """Return the identity for a *copy* of an existing element.

    Copying a CAD entity also copies its XDATA, so two entities can claim the
    same internal id. The first occurrence keeps the original identity; later
    occurrences are re-identified with a ``#copyN`` suffix so the mapping stays
    one-to-one. ``occurrence`` must be >= 1.
    """
    if occurrence < 1:
        raise IdentityError("occurrence must be >= 1 for a copy")
    if occurrence == 1:
        return internal_id
    return f"{internal_id}#copy{occurrence}"


def base_internal_id(internal_id: str) -> str:
    """Strip a ``#copyN`` suffix, returning the identity of the original."""
    return re.sub(r"#copy\d+$", "", internal_id)


def geometry_hash(payload: Any) -> str:
    """Stable SHA-256 over a canonical JSON payload.

    Used for change detection: if the hash of an element's canonical geometry
    or properties changes, downstream representations (IFC, DXF) are stale and
    must be regenerated or flagged.
    """
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def element_fingerprint(element: Dict[str, Any]) -> str:
    """Fingerprint the parts of a canonical element that affect geometry.

    Deliberately excludes names, colours and other presentation-only fields so
    that cosmetic edits do not invalidate IFC geometry.
    """
    keys = ("ifc_class", "shape", "placement", "dimensions", "rotation_z_deg")
    payload = {k: element.get(k) for k in keys}
    return geometry_hash(payload)
