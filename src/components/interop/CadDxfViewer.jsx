// src/components/interop/CadDxfViewer.jsx
//
// MLightCAD 2D CAD editor for the Fundi workbench.
//
// Root cause fixed here
// ---------------------
// The viewer used to import a hardcoded stub (`compat/cadSimpleViewer.js`) whose
// `isAvailable` was the constant `false`. The message "MLightCAD engine is not
// installed in this environment (Android / Termux)" was therefore shown on every
// platform, including desktop Chrome, while the real engine was installed.
// The adapter now re-exports the real package and reports availability from the
// engine's own exports, so this viewer either really runs or reports the real
// construction error.
//
// What the viewer actually does
// -----------------------------
// * Opens the served DXF artefact (the Python generator's own sheet) in a real
//   MLightCAD document, with write mode so editing commands are available.
// * Registers the MTEXT layout worker from `public/cad-workers/` (fetched by URL,
//   not bundled) and checks readiness instead of assuming it works.
// * Lets the user draw/edit with the engine's own command system, and the simple
//   UI plugin's toolbar/dock (desktop) or phone toolbar (small screens).
// * Maps a CAD selection back to canonical element ids through the DXF handle:
//   `selectionSet` object ids are resolved to handles with the same iteration the
//   export mapping used, and handed to `onSelectHandles`.
// * Exports the edited database back to DXF.
//
// Honest failure states: if the engine cannot be constructed, or the drawing
// cannot be parsed, the panel says exactly what failed and offers a retry and the
// generated DXF download. It never pretends an editor is available when it is not.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AcApDocManager,
  AcEdOpenMode,
  acuiRegisterSimpleUiPlugin,
  acedApplyUiTheme,
  cadEngineStatus,
  CAD_WORKER_URLS,
} from './compat/cadSimpleViewer';
import {
  AlertTriangle,
  Crosshair,
  Download,
  Loader2,
  RefreshCcw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { createViewerContainer } from './viewerHost';

const ENGINE_STATUS = cadEngineStatus();

/** Index every entity's objectId -> handle so a CAD selection can be mapped. */
function indexEntityHandles(manager) {
  const index = new Map();
  try {
    const modelSpace = manager?.curDocument?.database?.tables?.blockTable?.modelSpace;
    if (!modelSpace) return index;
    for (const entity of modelSpace.newIterator()) {
      const objectId = entity.objectId ?? entity.id ?? entity.objectID;
      if (objectId !== undefined && entity.handle !== undefined) {
        index.set(String(objectId), String(entity.handle));
      }
    }
  } catch {
    /* mapping is best-effort; the viewer still works without it */
  }
  return index;
}

/** Highlight one entity by DXF handle. Returns why it could not, when it could not. */
function tryFocusEntity(manager, handle) {
  try {
    const database = manager?.curDocument?.database;
    const modelSpace = database?.tables?.blockTable?.modelSpace;
    if (!modelSpace) return { ok: false, reason: 'no model space in document' };

    let found = null;
    for (const entity of modelSpace.newIterator()) {
      if (String(entity.handle) === String(handle)) {
        found = entity;
        break;
      }
    }
    if (!found) return { ok: false, reason: `handle ${handle} is not in this drawing` };

    const objectId = found.objectId ?? found.id ?? found.objectID;
    const view = manager.curView ?? manager.activeView ?? manager.view;
    if (objectId !== undefined && view && typeof view.highlight === 'function') {
      view.highlight([objectId]);
      return { ok: true, reason: `highlighted handle ${handle}` };
    }
    return {
      ok: false,
      reason:
        `entity ${handle} exists (${found.constructor?.name || 'unknown type'}) but this ` +
        'MLightCAD build exposes no highlight API for it',
    };
  } catch (error) {
    return { ok: false, reason: `highlight failed: ${error.message}` };
  }
}

const toolbarButton =
  'inline-flex min-h-[36px] items-center gap-1 rounded border border-[#4c4d4f] bg-[#262727] ' +
  'px-2 py-1 text-[11px] text-[#e5eaf3] hover:bg-[#303030] focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-[#409eff] disabled:cursor-not-allowed disabled:opacity-40';

export default function CadDxfViewer({
  dxfUrl,
  onStatus,
  onLoaded,
  focusHandle,
  onSelectHandles,
  dark = true,
  height = '100%',
}) {
  const hostRef = useRef(null);
  const containerRef = useRef(null);
  const managerRef = useRef(null);
  const fileInputRef = useRef(null);
  const handleIndexRef = useRef(new Map());
  const selectionBindingRef = useRef(null);

  const [phase, setPhase] = useState(ENGINE_STATUS.available ? 'idle' : 'unavailable');
  const [statusMessage, setStatusMessage] = useState(
    ENGINE_STATUS.available ? 'Initializing the CAD editor…' : ENGINE_STATUS.reason
  );
  const [activeFileName, setActiveFileName] = useState('');
  const [entityCount, setEntityCount] = useState(0);
  const [workersReady, setWorkersReady] = useState(null);
  const [failure, setFailure] = useState(null);

  const publish = useCallback(
    (message, extra = {}) => {
      setStatusMessage(message);
      if (onStatus) onStatus({ message, ...extra });
    },
    [onStatus]
  );

  /* -------------------------------------------------------------- open file */

  const openBuffer = useCallback(
    async (fileName, arrayBuffer) => {
      const manager = managerRef.current;
      if (!manager) {
        setFailure('the CAD engine is not initialised');
        return;
      }
      setPhase('loading');
      publish(`Opening ${fileName}…`);
      const started = performance.now();
      try {
        const ok = await manager.openDocument(fileName, arrayBuffer, {
          mode: AcEdOpenMode.Write,
          progressiveRendering: false,
        });
        const durationMs = Math.round(performance.now() - started);
        if (!ok) {
          setPhase('error');
          setFailure(`${fileName} could not be parsed as a DXF drawing`);
          publish(`Failed to open ${fileName}`);
          return;
        }

        let count = 0;
        const layerNames = new Set();
        try {
          const modelSpace = manager.curDocument?.database?.tables?.blockTable?.modelSpace;
          if (modelSpace) {
            for (const entity of modelSpace.newIterator()) {
              count += 1;
              const layer = entity.layer ?? entity.layerName;
              if (layer) layerNames.add(String(layer));
            }
          }
        } catch {
          /* counting is best effort and never blocks the open */
        }

        handleIndexRef.current = indexEntityHandles(manager);
        manager.sendStringToExecute('zoom\ne\n');
        setActiveFileName(fileName);
        setEntityCount(count);
        setFailure(null);
        setPhase('ready');
        publish(`Loaded ${fileName} in ${durationMs} ms (${count} entities)`);
        if (onLoaded) {
          onLoaded({ fileName, entityCount: count, durationMs, layers: [...layerNames] });
        }
      } catch (error) {
        console.error('[Fundi CAD] openDocument failed:', error);
        setPhase('error');
        setFailure(error.message || String(error));
        publish(`Could not open the drawing: ${error.message || error}`);
      }
    },
    [onLoaded, publish]
  );

  const loadFromUrl = useCallback(
    async (url) => {
      if (!url) return;
      setPhase('loading');
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        const buffer = await response.arrayBuffer();
        const name = url.split('/').pop()?.split('?')[0] || 'drawing.dxf';
        await openBuffer(name, buffer);
      } catch (error) {
        setPhase('error');
        setFailure(error.message);
        publish(`Could not fetch the drawing: ${error.message}`);
      }
    },
    [openBuffer, publish]
  );

  /* ------------------------------------------------------------- init engine */

  useEffect(() => {
    let disposed = false;
    let instance = null;

    async function init() {
      if (!ENGINE_STATUS.available) {
        setPhase('unavailable');
        return;
      }
      if (!hostRef.current) return;
      try {
        const existing = AcApDocManager.tryGetInstance();
        if (existing) await existing.destroy();

        if (dark) acedApplyUiTheme('dark', hostRef.current);

        containerRef.current = createViewerContainer(hostRef.current);
        const manager = AcApDocManager.createInstance({
          container: containerRef.current,
          autoResize: true,
          // Main-thread drawing uses less memory; the worker URL below enables the
          // MTEXT layout worker, which is what text-heavy detailing sheets need.
          useMainThreadDraw: true,
          disableExport: false,
          webworkerFileUrls: CAD_WORKER_URLS,
          checkWorkersOnInit: true,
        });
        if (!manager) {
          throw new Error('AcApDocManager.createInstance returned no document manager');
        }
        managerRef.current = manager;
        instance = manager;

        manager.events?.workersReady?.addEventListener?.(({ ready }) => {
          if (!disposed) setWorkersReady(Boolean(ready));
        });

        // CAD -> canonical selection bridge. The selection set is a public getter
        // on the view; the objectId -> handle index is built after each open.
        try {
          const selectionSet = manager.curView?.selectionSet;
          if (selectionSet?.events?.selectionAdded) {
            const handler = ({ ids }) => {
              if (!onSelectHandles) return;
              const handles = (ids || [])
                .map((id) => handleIndexRef.current.get(String(id)))
                .filter(Boolean);
              if (handles.length) onSelectHandles(handles);
            };
            selectionSet.events.selectionAdded.addEventListener(handler);
            selectionBindingRef.current = { selectionSet, handler };
          }
        } catch (error) {
          console.warn('[Fundi CAD] selection bridge unavailable:', error);
        }

        if (!disposed && acuiRegisterSimpleUiPlugin) {
          // The plugin owns its own dock/toolbar DOM inside the host element, which
          // is why the host is rendered childless by React (see viewerHost.js).
          await acuiRegisterSimpleUiPlugin(manager.pluginManager, {
            host: hostRef.current,
            dockPanel: { defaultOpen: false, defaultSide: 'left', defaultWidth: 280 },
            toolbar: { placement: 'right', items: 'default', collapsible: true },
          });
        }

        if (!disposed) {
          setPhase('ready');
          if (dxfUrl) await loadFromUrl(dxfUrl);
          else publish('Cad editor ready — open a DXF file to begin');
        }
      } catch (error) {
        console.error('[Fundi CAD] init error:', error);
        setPhase('error');
        setFailure(error.message || String(error));
        publish(`CAD editor initialization failed: ${error.message || error}`);
      }
    }

    init();

    return () => {
      disposed = true;
      try {
        const binding = selectionBindingRef.current;
        if (binding?.selectionSet?.events?.selectionAdded?.removeEventListener) {
          binding.selectionSet.events.selectionAdded.removeEventListener(binding.handler);
        }
      } catch {
        /* best effort */
      }
      selectionBindingRef.current = null;
      if (instance) instance.destroy().catch(() => {});
      managerRef.current = null;
      containerRef.current?.remove();
      containerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when the caller supplies a new drawing URL (a regeneration).
  const lastUrlRef = useRef(null);
  useEffect(() => {
    if (!dxfUrl || dxfUrl === lastUrlRef.current) return;
    lastUrlRef.current = dxfUrl;
    if (!managerRef.current) return;
    loadFromUrl(dxfUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dxfUrl]);

  // Focus request coming from another view (element selected in BIM/3D/list).
  // Accepts either a bare handle or a `{ handle, nonce }` request object so that
  // selecting the same element twice still re-focuses it.
  useEffect(() => {
    if (!focusHandle || !managerRef.current) return;
    const handle = typeof focusHandle === 'string' ? focusHandle : focusHandle.handle;
    if (!handle) return;
    const result = tryFocusEntity(managerRef.current, handle);
    publish(result.reason, { focus: result });
  }, [focusHandle, publish]);

  /* ---------------------------------------------------------------- commands */

  const zoomExtents = useCallback(() => {
    const manager = managerRef.current;
    if (!manager) return;
    try {
      manager.sendStringToExecute('zoom\ne\n');
      publish('Zoomed to drawing extents');
    } catch (error) {
      publish(`Zoom failed: ${error.message}`);
    }
  }, [publish]);

  const nudgeZoom = useCallback(
    (direction) => {
      // The engine zooms on wheel input; synthesising the same event keeps a single
      // zoom code path instead of guessing an internal API.
      const canvas = containerRef.current?.querySelector('canvas');
      if (!canvas) {
        publish('Zoom is unavailable until a drawing is open');
        return;
      }
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: direction === 'in' ? -240 : 240,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          bubbles: true,
          cancelable: true,
        })
      );
      publish(`Zoom ${direction}`);
    },
    [publish]
  );

  const handleExportDxf = useCallback(() => {
    const manager = managerRef.current;
    const doc = manager?.curDocument;
    try {
      if (!doc?.database?.dxfOut) {
        throw new Error('the editor has no drawing database to export');
      }
      const content = doc.database.dxfOut(undefined, 6);
      const blob = new Blob([content], { type: 'application/dxf;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${(activeFileName || 'drawing').replace(/\.[^.]+$/, '')}_edited.dxf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      publish(`Exported ${anchor.download}`);
    } catch (error) {
      // Never fake an export: fall back to the generated artefact and say so.
      if (dxfUrl) {
        publish(`Editor export failed (${error.message}); downloading the generated DXF instead`);
        const anchor = document.createElement('a');
        anchor.href = dxfUrl;
        anchor.download = activeFileName || 'drawing.dxf';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        return;
      }
      publish(`Export failed: ${error.message}`);
    }
  }, [activeFileName, dxfUrl, publish]);

  const handleFileUpload = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) openBuffer(file.name, evt.target.result);
      };
      reader.readAsArrayBuffer(file);
      event.target.value = '';
    },
    [openBuffer]
  );

  const [retryNonce, setRetryNonce] = useState(0);
  const retry = useCallback(() => {
    setFailure(null);
    setPhase('idle');
    setRetryNonce((value) => value + 1);
    if (dxfUrl) loadFromUrl(`${dxfUrl}${dxfUrl.includes('?') ? '&' : '?'}retry=${Date.now()}`);
  }, [dxfUrl, loadFromUrl]);

  const statusTone = useMemo(() => {
    if (phase === 'error' || phase === 'unavailable') return 'text-rose-300';
    if (phase === 'loading') return 'text-amber-300';
    return 'text-[#909399]';
  }, [phase]);

  /* ------------------------------------------------------------------ render */

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#141414]" style={{ height }}>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-1.5 border-b border-[#4c4d4f] bg-[#1d1e1f] px-2 py-1.5 select-none">
        <div className="flex min-w-0 items-center gap-2">
          <Crosshair size={14} className="shrink-0 text-[#409eff]" aria-hidden="true" />
          <span className="truncate text-[11px] text-[#e5eaf3]">
            {activeFileName || (dxfUrl ? dxfUrl.split('/').pop()?.split('?')[0] : 'no drawing')}
          </span>
          {entityCount > 0 && (
            <span className="hidden shrink-0 text-[10px] text-[#909399] sm:inline">
              {entityCount} entities
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <button type="button" onClick={zoomExtents} className={toolbarButton} title="Zoom to extents (ZOOM → E)">
            <RotateCcw size={12} aria-hidden="true" />
            <span className="hidden sm:inline">Extents</span>
          </button>
          <button type="button" onClick={() => nudgeZoom('in')} className={toolbarButton} title="Zoom in" aria-label="Zoom in">
            <ZoomIn size={12} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => nudgeZoom('out')} className={toolbarButton} title="Zoom out" aria-label="Zoom out">
            <ZoomOut size={12} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className={toolbarButton} title="Open a local DXF file">
            <Crosshair size={12} aria-hidden="true" />
            <span className="hidden sm:inline">Open DXF</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".dxf" onChange={handleFileUpload} className="hidden" />
          <button type="button" onClick={retry} className={toolbarButton} title="Reload the generated drawing">
            <RefreshCcw size={12} aria-hidden="true" />
            <span className="hidden sm:inline">Reload</span>
          </button>
          <button
            type="button"
            onClick={handleExportDxf}
            disabled={phase !== 'ready'}
            className="inline-flex min-h-[36px] items-center gap-1 rounded bg-[#409eff] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#66b1ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-40"
            title="Export the edited drawing as DXF"
          >
            <Download size={12} aria-hidden="true" />
            <span className="hidden sm:inline">Export DXF</span>
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Unavailable / failed: say what actually happened, offer a retry + download. */}
        {(phase === 'unavailable' || phase === 'error') && (
          <div className="absolute inset-0 z-20 flex items-center justify-center overflow-auto bg-[#141414] p-4 text-[#cdd3dd]">
            <div className="w-full max-w-md space-y-3 rounded-xl border border-[#4c4d4f] bg-[#1f2022] p-4 shadow-xl">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#e5eaf3]">
                    {phase === 'unavailable' ? '2D CAD engine unavailable' : 'The drawing could not be opened'}
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#909399]">
                    {failure || ENGINE_STATUS.reason}
                  </p>
                </div>
              </div>
              <ul className="list-disc space-y-0.5 pl-5 text-[10px] text-[#909399]">
                <li>engine: {ENGINE_STATUS.engine} {ENGINE_STATUS.version}</li>
                <li>worker: {CAD_WORKER_URLS.mtextRender}</li>
                <li>drawing: {dxfUrl || 'none generated yet'}</li>
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                {dxfUrl && (
                  <a href={dxfUrl} download className="inline-flex min-h-[36px] items-center gap-1.5 rounded bg-[#409eff] px-3 text-[11px] font-medium text-white">
                    <Download size={13} aria-hidden="true" /> Download generated DXF
                  </a>
                )}
                <button type="button" onClick={retry} className={toolbarButton}>
                  <RefreshCcw size={13} aria-hidden="true" /> Retry
                </button>
              </div>
              <p className="text-[10px] leading-relaxed text-[#909399]">
                A downloaded DXF is not an editor. This panel will not claim CAD editing is
                available until the engine has actually opened a drawing.
              </p>
            </div>
          </div>
        )}

        <div
          ref={hostRef}
          data-fundi-cad-host="true"
          style={{
            position: 'relative',
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            minHeight: 0,
            overflow: 'hidden',
          }}
        />

        {phase === 'loading' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#141414]/85 px-4 text-center text-[12px] text-[#e5eaf3]">
            <Loader2 size={18} className="animate-spin text-[#409eff]" aria-hidden="true" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      <footer className={`flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#4c4d4f] bg-[#1d1e1f] px-2 py-1 text-[10px] ${statusTone}`}>
        <span className="min-w-0 truncate">{statusMessage}</span>
        <span className="shrink-0 text-[#909399]">
          workers {workersReady === null ? 'not checked' : workersReady ? 'ready' : 'unreachable'}
          {retryNonce > 1 ? ` · retries ${retryNonce - 1}` : ''}
        </span>
      </footer>
    </div>
  );
}
