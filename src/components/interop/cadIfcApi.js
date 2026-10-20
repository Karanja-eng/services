// src/components/interop/cadIfcApi.js
//
// Thin client for the Fundi CAD/IFC backend (`src/Backend/cad_ifc/router.py`,
// mounted at /api/cad-ifc by src/Backend/main.py).
//
// Why a module instead of `fetch` scattered through components: every call needs
// the same three things — the configurable base URL, a JSON body, and an error
// message that survives a non-JSON error response (FastAPI returns
// `{"detail": ...}` for handled failures but HTML for a crash). Doing that in one
// place means a broken endpoint reports *why* instead of rendering `undefined`.

export const API_BASE =
  process.env.REACT_APP_API_BASE || 'http://127.0.0.1:8001';

const API_ROOT = `${API_BASE}/api/cad-ifc`;

async function request(path, { method = 'GET', body, timeoutMs = 180000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_ROOT}${path}`, {
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
      throw new Error(
        typeof detail === 'string' ? detail : JSON.stringify(detail)
      );
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        `The backend did not answer within ${Math.round(timeoutMs / 1000)}s. ` +
          'Generating a detailing sheet and an IFC model can take a few seconds; ' +
          'check that uvicorn is running on ' + API_BASE
      );
    }
    if (error instanceof TypeError) {
      // fetch rejects with TypeError for network/CORS failures.
      throw new Error(
        `Cannot reach the CAD/IFC backend at ${API_BASE}. Start it with ` +
          '`.venv-ifc\\Scripts\\python.exe -m uvicorn src.Backend.main:app --port 8001`. ' +
          `(browser said: ${error.message})`
      );
    }
    throw error;
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

/** Absolute URL for a generated artefact served from public/. */
export function artefactUrl(relativeUrl) {
  if (!relativeUrl) return null;
  const base = process.env.PUBLIC_URL || '';
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

export default {
  API_BASE,
  fetchGenerators,
  fetchHealth,
  generate,
  fetchLinks,
  fetchModel,
  reconcile,
  exportSeptic,
  artefactUrl,
  fileToBase64,
};
