// src/components/interop/compat/webIfc.js
//
// web-ifc adapter (WASM IFC parser used by the lightweight fallback viewport
// and by That Open's loader).
//
// Root cause of the previous message: this was a stub with `isAvailable = false`
// and an `IfcAPI` whose `Init()` returned `false`. `IfcBimViewer` therefore could
// never parse an IFC file, on any device. web-ifc 0.0.78 is installed and its
// WASM binaries are deployed to `public/thatopen/` (single-threaded) and
// `public/web-ifc/` (kept for the fallback viewer), so the real export is used.
//
// The WASM location stays explicit: a wrong path is the most common cause of a
// silent "nothing loaded" failure, so callers must pass it (see IF C_WASM_PATH).

import { IfcAPI } from 'web-ifc';

export { IfcAPI };

export const ENGINE_NAME = 'web-ifc';
export const ENGINE_VERSION = '0.0.78';

const PUBLIC_URL = (typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL) || '';

/** Folder the single-threaded WASM build is deployed to. */
export const IFC_WASM_PATH = `${PUBLIC_URL}/web-ifc/`;
export const IFC_WASM_PATH_ABSOLUTE = true;

export const isAvailable = typeof IfcAPI === 'function';

/** @returns {{available: boolean, engine: string, version: string, wasmPath: string, reason: string|null}} */
export function webIfcStatus() {
  return {
    available: isAvailable,
    engine: ENGINE_NAME,
    version: ENGINE_VERSION,
    wasmPath: IFC_WASM_PATH,
    reason: isAvailable
      ? null
      : 'the installed web-ifc build does not export IfcAPI; run npm install',
  };
}
