// src/components/interop/compat/thatOpenComponentsFront.js
//
// Safe compatibility layer for @thatopen/components-front.

export class Highlighter {
  static highlightByID() {}
}

export class LengthMeasurement {
  static create() {
    return {
      delete() {},
    };
  }
}

export const isAvailable = false;
