/**
 * Fundi Studio — recent tools history (local only).
 *
 * Scope is deliberately small: remember which tools were opened, most recent
 * first, so the navigation drawer can show real activity instead of the static
 * sample list it used to display.
 *
 * Privacy / safety rules:
 * - Only the route path, tool title, discipline group and a timestamp are
 *   stored. Engineering inputs, project data and calculation results are never
 *   written.
 * - Storage is `localStorage` (the app has no history backend and this task must
 *   not add one). Reads are defensive: malformed JSON, wrong shapes, non-app
 *   paths and future timestamps are dropped rather than trusted.
 * - Recording is idempotent per path: opening the same tool twice moves it to
 *   the top instead of adding a duplicate entry.
 */

export const RECENT_TOOLS_STORAGE_KEY = "fundi.recentTools.v1";
export const RECENT_TOOLS_LIMIT = 8;

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A path we are willing to show as history: absolute, non-empty, no protocol. */
export const isValidToolPath = (path) =>
  typeof path === "string" &&
  path.startsWith("/") &&
  !path.startsWith("//") &&
  !path.includes("://") &&
  path.length <= 200;

/**
 * Normalise one stored entry. Returns `null` when the entry cannot be trusted.
 */
export function normaliseEntry(entry) {
  if (!isPlainObject(entry)) return null;
  const { path, title, group, visitedAt } = entry;
  if (!isValidToolPath(path)) return null;
  if (typeof title !== "string" || title.trim().length === 0 || title.length > 120) {
    return null;
  }

  const timestamp = Number(visitedAt);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  // Reject timestamps far in the future (clock skew or corrupted data).
  if (timestamp > Date.now() + 24 * 60 * 60 * 1000) return null;

  return {
    path,
    title: title.trim(),
    group: typeof group === "string" && group.length <= 60 ? group : "",
    visitedAt: timestamp,
  };
}

/**
 * Add a visit to the list.
 *
 * @param {Array<object>} entries Current entries (any order).
 * @param {{path: string, title: string, group?: string}} tool
 * @param {number} [now] Injectable clock for tests.
 * @returns {Array<object>} New list, newest first, capped and de-duplicated.
 */
export function recordToolVisit(entries, tool, now = Date.now()) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const clean = safeEntries.map(normaliseEntry).filter(Boolean);

  if (!tool || !isValidToolPath(tool.path)) return clean.slice(0, RECENT_TOOLS_LIMIT);
  const title = typeof tool.title === "string" ? tool.title.trim() : "";
  if (!title) return clean.slice(0, RECENT_TOOLS_LIMIT);

  const entry = {
    path: tool.path,
    title: title.slice(0, 120),
    group: typeof tool.group === "string" ? tool.group.slice(0, 60) : "",
    visitedAt: now,
  };

  // A path appears at most once; re-visiting moves it to the top.
  const withoutPath = clean.filter((item) => item.path !== entry.path);
  return [entry, ...withoutPath].slice(0, RECENT_TOOLS_LIMIT);
}

/** Parse a raw JSON string into a safe list (never throws). */
export function parseStoredHistory(raw) {
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normaliseEntry)
      .filter(Boolean)
      .sort((a, b) => b.visitedAt - a.visitedAt)
      .slice(0, RECENT_TOOLS_LIMIT);
  } catch {
    return [];
  }
}

/* --------------------------------------------------------------- storage API */

const getStorage = () => {
  try {
    // Guard for SSR / privacy modes where localStorage throws on access.
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

/** Read history; returns [] when storage is unavailable or corrupt. */
export function readRecentTools() {
  const storage = getStorage();
  if (!storage) return [];
  try {
    return parseStoredHistory(storage.getItem(RECENT_TOOLS_STORAGE_KEY));
  } catch {
    return [];
  }
}

/** Write history; silently no-ops when storage is unavailable or full. */
export function writeRecentTools(entries) {
  const storage = getStorage();
  if (!storage) return false;
  try {
    const clean = (Array.isArray(entries) ? entries : [])
      .map(normaliseEntry)
      .filter(Boolean)
      .sort((a, b) => b.visitedAt - a.visitedAt)
      .slice(0, RECENT_TOOLS_LIMIT);
    storage.setItem(RECENT_TOOLS_STORAGE_KEY, JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}

/**
 * Record a tool visit end-to-end (read → merge → write).
 * Returns the new list so a caller can update its own state.
 */
export function rememberToolVisit(tool, now = Date.now()) {
  const next = recordToolVisit(readRecentTools(), tool, now);
  writeRecentTools(next);
  return next;
}

/** Clear history (used by settings if wired later; also handy for tests). */
export function clearRecentTools() {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.removeItem(RECENT_TOOLS_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
