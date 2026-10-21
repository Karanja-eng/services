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
