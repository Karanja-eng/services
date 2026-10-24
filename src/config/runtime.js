/**
 * Fundi Studio — runtime configuration.
 *
 * Why this module exists
 * ----------------------
 * The application used to hardcode `http://127.0.0.1:8001` in several components.
 * `127.0.0.1` is resolved by the *browser*, so it only reaches a backend running on
 * the same device as the browser:
 *
 *   - desktop development        browser and backend on the same PC  -> works
 *   - phone on the same Wi-Fi    browser on the phone, backend on PC  -> fails
 *   - Android/Termux, same box   browser + backend on the phone       -> works
 *
 * This module resolves one API origin once, from the environment, and explains
 * *where the value came from* so a failure can be reported with an actionable
 * message instead of a generic "cannot reach" string.
 *
 * Resolution order (first match wins)
 * -----------------------------------
 * 1. `REACT_APP_API_BASE` — explicit override, always wins. Use it for a backend
 *    on another host, a tunnel, or a production deployment.
 * 2. Same origin — when the page itself is served by the backend (port 8001, or
 *    any host that also serves `/api/cad-ifc`).
 * 3. The page's own hostname on the backend port — this is what makes a phone
 *    that opened `http://192.168.1.20:3000` reach `http://192.168.1.20:8001`
 *    instead of its own loopback interface.
 * 4. `http://127.0.0.1:8001` — last resort (documented default).
 *
 * Nothing here performs I/O; `resolveApiOrigin` is pure so it can be unit-tested
 * with an injected `location`/`env`.
 */

/** Default port of `src/Backend/main.py` and `src/Backend/cad_ifc/standalone.py`. */
export const DEFAULT_BACKEND_PORT = '8001';

/** Prefix the CAD/BIM/IFC router is mounted at in both backend entry points. */
export const CAD_IFC_PREFIX = '/api/cad-ifc';

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

/**
 * Resolve the backend origin.
 *
 * @param {object} [options]
 * @param {string} [options.explicit] Override value; defaults to `REACT_APP_API_BASE`
 * @param {object} [options.location] `window.location`-like object
 * @param {string} [options.port]     backend port to assume (defaults to 8001)
 * @returns {{origin: string, source: string, detail: string, sameOrigin: boolean}}
 */
export function resolveApiOrigin(options = {}) {
  const location =
    options.location ||
    (typeof window !== 'undefined' ? window.location : undefined) ||
    {};
  const port = options.port || DEFAULT_BACKEND_PORT;

  // The literal below is what Create React App's DefinePlugin replaces at build
  // time, so it must stay written out as `process.env.REACT_APP_API_BASE`.
  const envOverride =
    typeof process !== 'undefined' && process.env
      ? process.env.REACT_APP_API_BASE
      : undefined;
  const explicit =
    typeof options.explicit === 'string'
      ? options.explicit.trim()
      : typeof envOverride === 'string'
        ? envOverride.trim()
        : '';

  if (explicit) {
    return {
      origin: trimTrailingSlash(explicit),
      source: 'env',
      detail: 'REACT_APP_API_BASE',
      sameOrigin: false,
    };
  }

  const protocol = location.protocol === 'https:' ? 'https:' : 'http:';
  const hostname = typeof location.hostname === 'string' ? location.hostname : '';
  const locationPort = typeof location.port === 'string' ? location.port : '';

  // Served by the backend itself (or behind the same reverse proxy).
  if (locationPort && locationPort === port) {
    const host = location.host || `${hostname}:${port}`;
    return {
      origin: trimTrailingSlash(`${protocol}//${host}`),
      source: 'same-origin',
      detail: `the page is served on port ${port}, so the API is assumed to be the same origin`,
      sameOrigin: true,
    };
  }

  if (hostname) {
    // Keep the page's host (localhost, 127.0.0.1, a LAN IP, or a Termux hostname)
    // but talk to the backend port.
    const host = hostname.includes(':') ? `[${hostname}]` : hostname;
    const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    return {
      origin: `${protocol}//${host}:${port}`,
      source: isLoopback ? 'loopback' : 'page-host',
      detail: isLoopback
        ? `the page runs on this device, so the backend is assumed to be on ${hostname}:${port}`
        : `the backend is assumed to be on the same host as this page (${hostname}:${port}) — ` +
          'start it with --host 0.0.0.0 to accept connections from another device',
      sameOrigin: false,
    };
  }

  return {
    origin: `http://127.0.0.1:${port}`,
    source: 'fallback',
    detail: 'no browser location available, using the documented loopback default',
    sameOrigin: false,
  };
}

/**
 * Resolved configuration for the running bundle.
 *
 * `REACT_APP_*` values are inlined by Create React App at build time, which is why
 * they are read here (once) rather than inside the resolver.
 */
const resolved = resolveApiOrigin();

/** Backend origin without a trailing slash, e.g. `http://192.168.1.20:8001`. */
export const API_BASE = resolved.origin;

/** Where the origin came from (`env` | `same-origin` | `loopback` | `page-host` | `fallback`). */
export const API_SOURCE = resolved.source;

/** Human-readable explanation of the resolved origin, safe to show in the UI. */
export const API_SOURCE_DETAIL = resolved.detail;

/** Root URL of the CAD/BIM/IFC router. */
export const CAD_IFC_API_ROOT = `${API_BASE}${CAD_IFC_PREFIX}`;

/** Backend liveness endpoint (served by both backend entry points). */
export const HEALTH_URL = `${CAD_IFC_API_ROOT}/health`;

/** Absolute URL of a generated artefact served from the frontend's `public/` folder. */
export function artefactUrl(relativeUrl) {
  if (!relativeUrl) return null;
  const base = (typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL) || '';
  return `${base}${relativeUrl}`;
}

/**
 * The exact commands that start the backend for the current environment.
 * Used by the failure UI, so the message matches this machine's virtualenv layout
 * on Windows and stays generic elsewhere.
 */
export function backendStartCommands(origin = API_BASE) {
  const isWindows = /^win/i.test(
    (typeof navigator !== 'undefined' && navigator.platform) || ''
  );
  const python = isWindows
    ? '.venv-ifc\\Scripts\\python.exe'
    : '.venv-ifc/bin/python';
  return {
    sameDevice: `${python} -m src.Backend.cad_ifc.standalone --host 127.0.0.1 --port 8001`,
    lanAccess: `${python} -m src.Backend.cad_ifc.standalone --host 0.0.0.0 --port 8001`,
    fullBackend: `cd src/Backend && ..\\..\\${python} -m uvicorn main:app --host 127.0.0.1 --port 8001`,
    health: `${origin}${CAD_IFC_PREFIX}/health`,
  };
}

const runtimeConfig = {
  API_BASE,
  API_SOURCE,
  API_SOURCE_DETAIL,
  CAD_IFC_API_ROOT,
  HEALTH_URL,
  DEFAULT_BACKEND_PORT,
  CAD_IFC_PREFIX,
  resolveApiOrigin,
  artefactUrl,
  backendStartCommands,
};

export default runtimeConfig;
