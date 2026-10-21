// src/components/interop/compat/webIfc.js
//
// Safe compatibility layer for web-ifc WASM parser.
// Ensures the application compiles and Three.js 3D viewport functions
// even when web-ifc was not installed in node_modules.

export class IfcAPI {
  constructor() {
    this.isAvailable = false;
  }
  async Init() {
    return false;
  }
  OpenModel() {
    return 0;
  }
  CloseModel() {}
  GetLine() {
    return null;
  }
  GetFlatMesh() {
    return null;
  }
  SetWasmPath() {}
}

export const isAvailable = false;
