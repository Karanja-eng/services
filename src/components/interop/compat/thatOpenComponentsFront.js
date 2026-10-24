// src/components/interop/compat/thatOpenComponentsFront.js
//
// That Open Components-Front adapter (selection highlighting, measurement).
// This file used to be a hardcoded stub whose `Highlighter.highlightByID` was a
// no-op, which is why the BIM viewport could never highlight a picked element.
// It now re-exports the real package.

import { Highlighter, LengthMeasurement } from '@thatopen/components-front';

export * from '@thatopen/components-front';

export const ENGINE_VERSION = '3.3.3';

export const isAvailable =
  typeof Highlighter === 'function' && typeof LengthMeasurement === 'function';

/** Capability report for the viewer's "Capabilities" panel. */
export function frontCapabilities() {
  return {
    highlighter: typeof Highlighter === 'function',
    measurement: typeof LengthMeasurement === 'function',
  };
}
