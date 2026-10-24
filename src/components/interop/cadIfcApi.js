// src/components/interop/cadIfcApi.js
//
// Thin client for the Fundi CAD/IFC backend (`src/Backend/cad_ifc/router.py`,
// mounted at /api/cad-ifc by both `src/Backend/main.py` and the standalone
// launcher).
//
// Root cause fixed here
// ---------------------
// The base URL used to be `process.env.REACT_APP_API_BASE || 'http://127.0.0.1:8001'`.
// `127.0.0.1` is resolved by the *browser*, so a phone (or any second device)
// could never reach a backend running on another machine, and the resulting error
// ("Cannot reach the CAD/IFC backend at http://127.0.0.1:8001") named an address
// that could not possibly work there. The origin now comes from `src/config/runtime.js`,
// which prefers an explicit `REACT_APP_API_BASE`, then the page's own hostname on
// the backend port, and reports where the value came from.
//
// Errors keep a machine-readable `code` plus the exact startup command, so the UI
// can be actionable instead of apologetic.

import {
  API_BASE,
  API_SOURCE,
  API_SOURCE_DETAIL,
  CAD_IFC_API_ROOT,
  HEALTH_URL,
  backendStartCommands,
} from '../../config/runtime';

export { API_BASE, API_SOURCE, API_SOURCE_DETAIL, CAD_IFC_API_ROOT, HEALTH_URL };

const DEFAULT_TIMEOUT_MS = 180000;

/** Error type used for every backend failure, with an actionable message. */
export class BackendError extends Error {
  constructor(message, { code = 'backend-error', status = null, detail = null, cause = null } = {}) {
    super(message);
    this.name = 'BackendError';
    this.code = code;
    this.status = status;
    this.detail = detail;
    this.cause = cause;
  }
}

function unreachableMessage(browserMessage) {
  const commands = backendStartCommands(API_BASE);
  const originNote =
    API_SOURCE === 'page-host'
      ? `The backend address was inferred from this page's host (${API_SOURCE_DETAIL}).`
      : API_SOURCE === 'env'
        ? `The backend address comes from REACT_APP_API_BASE (${API_BASE}).`
        : API_SOURCE === 'same-origin'
          ? `The API is expected on this page's own origin (${API_BASE}).`
          : `The backend address is the loopback default (${API_BASE}).`;

  return (
    `Cannot reach the CAD/IFC backend at ${API_BASE}. ${originNote}\n\n` +
    'Start it from the repository root:\n' +
    `  ${commands.sameDevice}\n` +
    'If the browser is on a different device (phone/tablet), bind the backend to the ' +
    'network and make sure the page is opened through the host machine\'s IP address:\n' +
    `  ${commands.lanAccess}\n` +
    `Health check: ${commands.health}\n` +
    `(browser said: ${browserMessage})`
  );
}

async function request(path, { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${CAD_IFC_API_ROOT}${path}`;
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const detail =
        (payload && (payload.detail || payload.message)) ||
        text.slice(0, 300) ||
        `HTTP ${response.status}`;
      throw new BackendError(
        typeof detail === 'string' ? detail : JSON.stringify(detail),
        { code: 'http-error', status: response.status, detail: payload }
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof BackendError) throw error;
    if (error.name === 'AbortError') {
      throw new BackendError(
        `The backend did not answer within ${Math.round(timeoutMs / 1000)}s. ` +
          'Generating a detailing sheet and an IFC model can take a few seconds. ' +
          `Check that it is running on ${API_BASE} (${HEALTH_URL}).`,
        { code: 'timeout', cause: error }
      );
    }
    if (error instanceof TypeError) {
      // fetch rejects with TypeError for network/CORS failures.
      throw new BackendError(unreachableMessage(error.message), {
        code: 'unreachable',
        cause: error,
      });
    }
    throw new BackendError(error.message || 'unknown backend error', {
      code: 'client-error',
      cause: error,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Generator catalogue with parameter schemas and canonical previews. */
export function fetchGenerators() {
  return request('/generators');
}

/** Dependency / store health of the interoperability layer. */
export function fetchHealth() {
  return request('/health', { timeoutMs: 20000 });
}

/**
 * Health probe used by the UI banner. Never throws: returns
 * `{ok, payload}` or `{ok: false, error, code, hint}` so the banner can show the
 * exact startup commands instead of a generic failure.
 */
export async function probeBackend() {
  try {
    const payload = await fetchHealth();
    return {
      ok: true,
      payload,
      origin: API_BASE,
      source: API_SOURCE,
      healthUrl: HEALTH_URL,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      code: error.code || 'unreachable',
      origin: API_BASE,
      source: API_SOURCE,
      healthUrl: HEALTH_URL,
      commands: backendStartCommands(API_BASE),
    };
  }
}

/** Run a generator: produces the DXF, the IFC and the mapping in one call. */
export function generate({ generator, params, modelId, levelElevationM = 0 }) {
  return request('/generate', {
    method: 'POST',
    body: {
      generator,
      params: params || {},
      model_id: modelId || undefined,
      level_elevation_m: levelElevationM,
      include_validation: true,
    },
  });
}

/** Element <-> CAD entity <-> IFC GlobalId registry for a model. */
export function fetchLinks(modelId, drawingId) {
  const query = drawingId ? `?drawing_id=${encodeURIComponent(drawingId)}` : '';
  return request(`/entities/${encodeURIComponent(modelId)}${query}`);
}

/** Canonical engineering model document. */
export function fetchModel(modelId) {
  return request(`/model/${encodeURIComponent(modelId)}`);
}

/**
 * Diff a drawing against the stored mapping.
 *
 * `dxfBase64` reconciles an edited drawing uploaded from the browser; without it
 * the drawing already in the store is re-read.
 */
export function reconcile(modelId, drawingId, dxfBase64) {
  return request(`/reconcile/${encodeURIComponent(modelId)}`, {
    method: 'POST',
    body: { drawing_id: drawingId, dxf_base64: dxfBase64 || undefined },
  });
}

/** Legacy septic-tank pipeline (kept so the earlier demo still works). */
export function exportSeptic(params) {
  return request('/export', { method: 'POST', body: { params: params || {} } });
}

/**
 * Run a 2D structural analysis for a canonical model.
 *
 * The analytical inputs are explicit — `youngsModulusPa`, `supports` and either
 * `loads` or `elementLoads`. Nothing is defaulted here or on the backend: a missing
 * input is rejected with the reason. Returns `{ ok, model_id, case_id, results,
 * analytical_model }`.
 */
export function runAnalysis({
  generator,
  modelId,
  youngsModulusPa,
  supports,
  loads = [],
  elementLoads = [],
  subdivisions = 1,
  caseId = 'ULS-1',
  memberId,
  section,
}) {
  return request('/analysis', {
    method: 'POST',
    timeoutMs: 300000,
    body: {
      generator,
      model_id: modelId,
      youngs_modulus_pa: youngsModulusPa,
      supports,
      loads,
      element_loads: elementLoads,
      subdivisions,
      case_id: caseId,
      member_id: memberId,
      section,
    },
  });
}

/** Whether the OpenSees engine (separate Python process) is usable. */
export function fetchAnalysisEngine() {
  return request('/analysis/engine', { timeoutMs: 30000 });
}

/**
 * Run a **3D** linear-elastic frame analysis.
 *
 * The analytical model is explicit: nodes with x/y/z, members with E, A, Iy, Iz, J,
 * G and a `vecxz` reference direction, six-DOF restraints and six-component nodal
 * loads. Nothing is inferred — a missing section constant is rejected by the backend
 * with the reason, which is why there is no default here.
 *
 * The response contains a `fundi.analysis.results/1` document with
 * `dimensionality: 3`, which `src/analysis/viewModel3D.mjs` renders.
 */
export function runAnalysis3D({
  modelId,
  nodes,
  members,
  supports,
  loads,
  caseId = '3D-1',
  description,
  analysis,
}) {
  return request('/analysis', {
    method: 'POST',
    timeoutMs: 300000,
    body: {
      dimensions: 3,
      model_id: modelId,
      nodes,
      members,
      supports,
      loads,
      case_id: caseId,
      description,
      analysis,
    },
  });
}

/** Absolute URL for a generated artefact served from public/. */
export function artefactUrl(relativeUrl) {
  if (!relativeUrl) return null;
  const base = (typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL) || '';
  return `${base}${relativeUrl}`;
}

/** Read a File as base64 (no data: prefix), for the reconcile upload. */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

const cadIfcApi = {
  API_BASE,
  API_SOURCE,
  API_SOURCE_DETAIL,
  CAD_IFC_API_ROOT,
  HEALTH_URL,
  BackendError,
  probeBackend,
  fetchGenerators,
  fetchHealth,
  generate,
  fetchLinks,
  fetchModel,
  reconcile,
  exportSeptic,
  runAnalysis,
  runAnalysis3D,
  fetchAnalysisEngine,
  artefactUrl,
  fileToBase64,
};

export default cadIfcApi;
