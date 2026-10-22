// src/components/interop/compat/thatOpenComponents.js
//
// Safe compatibility layer for @thatopen/components.
// Allows compilation and clean UI fallback when That Open is not installed.

export class Components {
  constructor() {
    this.init = () => {};
  }
}

export class SimpleWorld {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
  }
}

export class SimpleScene {}
export class SimpleCamera {}
export class SimpleRenderer {}

export class IfcLoader {
  constructor() {
    this.settings = { wasm: {} };
  }
  async load() {
    return null;
  }
}

// `ThatOpenBimViewer.jsx` resolves the fragments manager through the component
// container. The export is required for the module graph to compile in
// checkouts where the optional That Open engine is unavailable; the viewer's own
// availability guard and error state decide what the user sees at runtime.
export class FragmentsManager {
  constructor() {
    this.list = new Map();
  }
  async dispose() {}
}

export class Clipper {
  static create() {
    return {
      enabled: false,
      deleteAll() {},
    };
  }
}

export class Worlds {
  create() {
    return new SimpleWorld();
  }
}

export const isAvailable = false;
