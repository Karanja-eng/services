"""Install OpenSeesPy without pip's metadata step.

Why: `pip install openseespy` fails in this environment with
`PermissionError: [Errno 13] ... openseespy-3.8.0.0-py3-none-any.whl.metadata`
— the sandbox denies creating `*.whl.metadata` files, which is a pip-internal
step, not a wheel-compatibility problem. The published wheel is `py3-none-any`
(universal), so it does not need a Python-3.13-specific build.

This script therefore:
  1. asks the PyPI JSON API for the release file list,
  2. downloads the `py3-none-any` wheel with urllib,
  3. unzips it straight into the virtualenv's site-packages,
  4. verifies that `openseespy.opensees` imports and a 2D model can be created.

Run with the backend interpreter:
    .venv-ifc\\Scripts\\python.exe scripts/install_openseespy.py
"""
from __future__ import annotations

import json
import os
import ssl
import sys
import urllib.request
import zipfile

VERSION = "3.8.0.0"
#: `openseespy` itself is a 2.8 KB stub on PyPI; the Windows binary is shipped in
#: `openseespywin` as a `py3-none-win_amd64` wheel (universal across Python 3, so it
#: works on 3.13). Both are extracted, mirroring what pip would install.
PACKAGES = ("openseespy", "openseespywin")
SITE_PACKAGES = os.path.abspath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".venv-ifc", "Lib", "site-packages")
)
CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".pip-dl"))


def fetch_wheel(package: str, context) -> str:
    """Download the wheel for ``package`` and return its local path."""
    url = f"https://pypi.org/pypi/{package}/{VERSION}/json"
    print(f"fetching {url}")
    with urllib.request.urlopen(url, timeout=120, context=context) as response:
        payload = json.load(response)

    wheels = [item for item in payload["urls"] if item["filename"].endswith(".whl")]
    if not wheels:
        raise SystemExit(f"{package}: no wheel published for {VERSION}")
    wheel = next(
        (item for item in wheels if "py3-none-any" in item["filename"]),
        next(
            (item for item in wheels if "win_amd64" in item["filename"]),
            wheels[0],
        ),
    )
    print(f"  wheel: {wheel['filename']} ({wheel['size'] / 1024 / 1024:.1f} MB)")

    os.makedirs(CACHE_DIR, exist_ok=True)
    wheel_path = os.path.join(CACHE_DIR, wheel["filename"])
    if not os.path.exists(wheel_path) or os.path.getsize(wheel_path) != wheel["size"]:
        print("  downloading…")
        with urllib.request.urlopen(wheel["url"], timeout=900, context=context) as response:
            data = response.read()
        with open(wheel_path, "wb") as handle:
            handle.write(data)
        print(f"  saved {len(data)} bytes")
    else:
        print("  already downloaded")
    return wheel_path


def main() -> int:
    context = ssl.create_default_context()
    os.makedirs(SITE_PACKAGES, exist_ok=True)

    for package in PACKAGES:
        wheel_path = fetch_wheel(package, context)
        print(f"  extracting into {SITE_PACKAGES}")
        with zipfile.ZipFile(wheel_path) as archive:
            archive.extractall(SITE_PACKAGES)

    # Verify by importing in this interpreter (the script must run under .venv-ifc).
    sys.path.insert(0, SITE_PACKAGES)
    try:
        import openseespy.opensees as ops  # noqa: F401
    except Exception as exc:  # noqa: BLE001
        print(f"IMPORT FAILED: {type(exc).__name__}: {exc}")
        return 1

    ops.wipe()
    ops.model("basic", "-ndm", 2, "-ndf", 3)
    ops.node(1, 0.0, 0.0)
    ops.node(2, 1.0, 0.0)
    ops.fix(1, 1, 1, 1)
    ops.fix(2, 1, 1, 1)
    print(f"opensees OK: nodes {ops.getNodeTags()}, version {ops.version()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
