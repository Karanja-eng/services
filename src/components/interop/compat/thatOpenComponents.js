// src/components/interop/compat/thatOpenComponents.js
//
// That Open Components adapter for the BIM viewport.
//
// Root cause of the previous "That Open is optional and not installed" message:
// this module was a hardcoded stub (`Components` was a class whose `init` was a
// no-op, `isAvailable` was the constant `false`). The real package has been a
// direct dependency (`@thatopen/components` 3.3.3, pinned) since the integration
// commit, so the message was wrong on every platform — desktop included.
//
// This module now re-exports the real engine and publishes an availability
// report derived from the engine's own exports.

import {
  Components,
  Worlds,
  SimpleScene,
  SimpleRenderer,
  SimpleCamera,
  IfcLoader,
  FragmentsManager,
  Clipper,
} from '@thatopen/components';

// Re-export the engine namespace so views can use `OBC.*` without importing the
// package directly (and without a stub layer that can lie about availability).
export * from '@thatopen/components';

export const ENGINE_NAME = 'That Open Components';
export const ENGINE_VERSION = '3.3.3';

/** Every symbol the viewer needs, checked on the real namespace. */
const REQUIRED = {
  Components,
  Worlds,
  SimpleScene,
  SimpleRenderer,
  SimpleCamera,
  IfcLoader,
  FragmentsManager,
  Clipper,
};

export const isAvailable = Object.values(REQUIRED).every(
  (value) => typeof value === 'function'
);

/** @returns {{available: boolean, engine: string, version: string, missing: string[], reason: string|null}} */
export function bimEngineStatus() {
  const missing = Object.entries(REQUIRED)
    .filter(([, value]) => typeof value !== 'function')
    .map(([name]) => name);
  if (missing.length) {
    return {
      available: false,
      engine: ENGINE_NAME,
      version: ENGINE_VERSION,
      missing,
      reason:
        `the installed @thatopen/components build is missing ${missing.join(', ')}; ` +
        'run `npm run verify:thatopen-three` and check the pinned versions',
    };
  }
  return { available: true, engine: ENGINE_NAME, version: ENGINE_VERSION, missing: [], reason: null };
}
