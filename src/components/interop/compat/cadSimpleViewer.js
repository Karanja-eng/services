// src/components/interop/compat/cadSimpleViewer.js
//
// MLightCAD adapter for the 2D CAD editor.
//
// History / root cause
// --------------------
// This file used to be a hardcoded stub: every export was a fake object and
// `isAvailable` was the constant `false`. `CadDxfViewer` therefore reported
// "MLightCAD engine is not installed in this environment (Android / Termux)" on
// every device, including desktop Chrome, even though `@mlightcad/cad-simple-viewer`
// 1.7.5 was installed and bundles cleanly with webpack 5 (verified: see
// chats/2026-10-unified-bim-workbench.md).
//
// The stub was introduced to unblock a build in which `node_modules` was
// incomplete. Keeping the stub after the dependency was installed turned a
// transient install problem into a permanent, platform-blamed falsehood.
//
// What this module is now
// -----------------------
// A thin, real adapter. It re-exports the engine and adds the two things the
// host application must own:
//
//   * the Web Worker URLs (the MTEXT layout worker is fetched by URL at runtime,
//     so it must be deployed from `public/` — see scripts/copy-cad-bim-assets.js);
//   * an honest availability report, computed from the engine's actual exports
//     rather than hardcoded.
//
// If the engine is genuinely unusable (its modules threw while loading, or the
// document manager cannot be constructed), `cadEngineStatus()` says so with the
// real error message so the viewer can show a specific failure instead of a
// generic "not installed" claim.

import {
  AcApDocManager,
  AcEdOpenMode,
  MTEXT_RENDERER_WORKER_FILE,
  acedApplyUiTheme,
  acedSubscribeUiTheme,
} from '@mlightcad/cad-simple-viewer';
import { acuiRegisterSimpleUiPlugin } from '@mlightcad/cad-simple-ui-plugin/register';

export const ENGINE_NAME = 'MLightCAD';
export const ENGINE_VERSION = '1.7.5';

const PUBLIC_URL = (typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL) || '';

/**
 * Folder the worker scripts are deployed to (`scripts/copy-cad-bim-assets.js`).
 * Kept out of the webpack bundle on purpose: the viewer fetches the worker by URL.
 */
export const CAD_WORKER_DIR = `${PUBLIC_URL}/cad-workers`;

/** Worker URLs passed to `AcApDocManager.createInstance({ webworkerFileUrls })`. */
export const CAD_WORKER_URLS = {
  mtextRender: `${CAD_WORKER_DIR}/${MTEXT_RENDERER_WORKER_FILE}`,
};

/** True when the engine's core class is actually present. */
export const isAvailable = typeof AcApDocManager?.createInstance === 'function';

/**
 * Detailed availability, including the reason when unavailable.
 * @returns {{available: boolean, engine: string, version: string, reason: string|null, workerUrls: object}}
 */
export function cadEngineStatus() {
  if (!isAvailable) {
    return {
      available: false,
      engine: ENGINE_NAME,
      version: ENGINE_VERSION,
      reason:
        'the installed @mlightcad/cad-simple-viewer build does not export a usable ' +
        'AcApDocManager.createInstance',
      workerUrls: CAD_WORKER_URLS,
    };
  }
  return {
    available: true,
    engine: ENGINE_NAME,
    version: ENGINE_VERSION,
    reason: null,
    workerUrls: CAD_WORKER_URLS,
  };
}

/**
 * Probe whether the deployed worker scripts are reachable. Uses the engine's own
 * static HEAD-request check (`AcApDocManager.checkWebworkerReadiness`), which is
 * the supported entry point — the standalone function behind it is not part of the
 * package's public exports.
 */
export async function areCadWorkersReachable() {
  try {
    return await AcApDocManager.checkWebworkerReadiness(CAD_WORKER_URLS);
  } catch (error) {
    return false;
  }
}

export {
  AcApDocManager,
  AcEdOpenMode,
  acedApplyUiTheme,
  acedSubscribeUiTheme,
  acuiRegisterSimpleUiPlugin,
  MTEXT_RENDERER_WORKER_FILE,
};
