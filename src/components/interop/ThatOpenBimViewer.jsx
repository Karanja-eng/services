// src/components/interop/ThatOpenBimViewer.jsx
//
// IFC/BIM viewport for the Fundi workbench, on That Open Components 3.3.3.
//
// Root cause fixed here
// ---------------------
// Two defects made the BIM viewport useless on every platform:
//
//   1. `compat/thatOpenComponents.js` and `compat/thatOpenComponentsFront.js`
//      were hardcoded stubs (`Components` did nothing, `isAvailable` was `false`),
//      so the UI reported "That Open is optional and not installed in this mobile
//      environment" even on desktop where the pinned package is a direct
//      dependency.
//   2. This component built a world but **never loaded the IFC file**. There was
//      no `ifcUrl` loading effect at all, so even with a working engine nothing
//      would have appeared, and selection could never work.
//
// Both are repaired: the adapters re-export the real engine, and this component
// loads the served IFC, adds it to the scene, fits the camera and wires picking,
// highlight, visibility and the identity bridge (GlobalId <-> canonical element).
//
// Identity bridge
// ---------------
// * Element -> BIM: `FragmentsManager.guidsToModelIdMap([globalId])`
// * BIM -> element: pick a mesh, `model.getGuidsByLocalIds([localId])`
// Neither direction guesses: an unknown GlobalId is reported as "no matching
// canonical element" instead of being attached to a neighbour.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as OBC from './compat/thatOpenComponents';
import * as OBF from './compat/thatOpenComponentsFront';
import { bimEngineStatus } from './compat/thatOpenComponents';
import {
  AlertTriangle,
  Box,
  Eye,
  EyeOff,
  Loader2,
  MousePointerClick,
  PanelRight,
  RefreshCcw,
  Ruler,
  Scissors,
  X,
} from 'lucide-react';

const PUBLIC_URL = (typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL) || '';
const WORKER_URL = `${PUBLIC_URL}/thatopen/thatopen-fragments-worker.mjs`;
const WASM_PATH = `${PUBLIC_URL}/thatopen/`;
const HIGHLIGHT_STYLE = 'fundi-select';

const ENGINE = bimEngineStatus();

/** Guid -> canonical element, from the backend model (optional). */
function buildGuidIndex(elements) {
  const index = new Map();
  for (const element of elements || []) {
    const guid = element.ifc_guid || element.guid || element.ifcGlobalId;
    if (guid) index.set(guid, element);
  }
  return index;
}

const button =
  'inline-flex min-h-[36px] items-center gap-1 rounded border border-[#4c4d4f] bg-[#262727] ' +
  'px-2 py-1 text-[11px] text-[#e5eaf3] hover:bg-[#303030] focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-[#409eff] disabled:cursor-not-allowed disabled:opacity-40';
const buttonActive = 'bg-[#409eff] text-white border-[#409eff] hover:bg-[#66b1ff]';

export default function ThatOpenBimViewer({
  ifcUrl,
  elements = [],
  focusGuid = null,
  onStatus,
  onSelect,
  selectedGuid = null,
}) {
  const containerRef = useRef(null);
  const stateRef = useRef({
    components: null,
    world: null,
    fragments: null,
    loader: null,
    highlighter: null,
    clipper: null,
    measure: null,
    model: null,
    guidIndex: new Map(),
    disposed: false,
    loadedUrl: null,
  });

  const [engineReady, setEngineReady] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | loading | ready | error | unavailable
  const [status, setStatus] = useState(
    ENGINE.available ? 'Initializing the BIM engine…' : ENGINE.reason
  );
  const [failure, setFailure] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [capabilities, setCapabilities] = useState({
    highlighter: false,
    clipper: false,
    measure: false,
    visibility: false,
  });
  const [selection, setSelection] = useState(null);
  const [geometryItems, setGeometryItems] = useState(null);
  const [hiddenIds, setHiddenIds] = useState([]);
  const [showDetails, setShowDetails] = useState(
    typeof window !== 'undefined' ? window.innerWidth > 900 : false
  );
  const [retryNonce, setRetryNonce] = useState(0);

  const publish = useCallback(
    (message, extra = {}) => {
      setStatus(message);
      if (onStatus) onStatus({ message, ...extra });
    },
    [onStatus]
  );

  // Keep the GUID index current without rebuilding the viewer.
  useEffect(() => {
    stateRef.current.guidIndex = buildGuidIndex(elements);
  }, [elements]);

  /* ---------------------------------------------------------- viewer lifecycle */

  useEffect(() => {
    const state = stateRef.current;
    state.disposed = false;
    let cancelled = false;

    async function init() {
      const container = containerRef.current;
      if (!container) return;
      if (!ENGINE.available) {
        setPhase('unavailable');
        return;
      }
      try {
        const components = new OBC.Components();
        if (!components.get) {
          throw new Error('@thatopen/components returned no component container');
        }

        const worlds = components.get(OBC.Worlds);
        const world = worlds.create();
        world.scene = new OBC.SimpleScene(components);
        world.renderer = new OBC.SimpleRenderer(components, container);
        world.camera = new OBC.SimpleCamera(components);

        components.init();
        world.scene.setup?.();

        await world.camera.controls?.setLookAt?.(8, 6, 8, 0, 0, 0);

        const fragments = components.get(OBC.FragmentsManager);
        fragments.init(WORKER_URL);
        state.fragments = fragments;

        const loader = components.get(OBC.IfcLoader);
        loader.settings.autoSetWasm = false;
        loader.settings.wasm = { path: WASM_PATH, absolute: true };
        await loader.setup();

        state.components = components;
        state.world = world;
        state.loader = loader;

        // Optional capabilities, each feature-detected and reported honestly.
        const detector = { highlighter: false, clipper: false, measure: false, visibility: false };
        try {
          const highlighter = components.get(OBF.Highlighter);
          highlighter.setup({ world });
          highlighter.zoomToSelection = false;
          highlighter.add(HIGHLIGHT_STYLE);
          state.highlighter = highlighter;
          detector.highlighter = true;

          // Selection event from the engine itself (covers clicks that the raycast
          // below does not see, e.g. after a camera move). The payload is either
          // `{ selection: { [styleName]: ModelIdMap } }` or the map itself,
          // depending on the event bus version, so both shapes are accepted.
          const selectEvent = highlighter.events?.select;
          const addListener =
            selectEvent?.addEventListener?.bind(selectEvent) || selectEvent?.add?.bind(selectEvent);
          if (addListener) {
            addListener(async (selected) => {
              try {
                const map =
                  selected?.selection?.[HIGHLIGHT_STYLE] ?? selected?.[HIGHLIGHT_STYLE] ?? null;
                if (!map) return;
                const guids = await fragments.modelIdMapToGuids(map);
                const guid = guids?.[0] || null;
                const element = guid ? state.guidIndex.get(guid) || null : null;
                setSelection({ guid, element, localIds: null, source: 'engine' });
                if (onSelect) onSelect({ guid, element });
              } catch (error) {
                console.warn('[That Open] selection event mapping failed:', error);
              }
            });
          }
        } catch (error) {
          publish(`Selection highlight unavailable: ${error.message}`);
        }
        try {
          const clipper = components.get(OBC.Clipper);
          clipper.setup({ world });
          clipper.enabled = false;
          state.clipper = clipper;
          detector.clipper = true;
        } catch (error) {
          console.warn('[That Open] Clipper unavailable:', error);
        }
        try {
          const measure = components.get(OBF.LengthMeasurement);
          measure.world = world;
          measure.enabled = false;
          state.measure = measure;
          detector.measure = true;
        } catch (error) {
          console.warn('[That Open] Measurement unavailable:', error);
        }

        if (typeof state.model?.setVisible === 'function') detector.visibility = true;

        if (cancelled || state.disposed) return;
        setCapabilities(detector);
        setEngineReady(true);
        setPhase(ifcUrl ? 'loading' : 'idle');
        publish(
          ifcUrl
            ? 'BIM engine ready — loading the IFC model…'
            : 'BIM engine ready — generate a model to load an IFC file'
        );
      } catch (error) {
        console.error('[That Open] init error:', error);
        setPhase('error');
        setFailure(error.message || String(error));
        publish(`BIM engine failed to initialise: ${error.message || error}`);
      }
    }

    init();

    return () => {
      cancelled = true;
      state.disposed = true;
      try {
        state.world?.dispose?.();
        state.components?.dispose?.();
      } catch {
        /* best effort */
      }
      state.model = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------------- load model */

  const loadIfc = useCallback(
    async (url) => {
      const state = stateRef.current;
      if (!state.loader || !state.world) return;
      if (!url) return;
      setPhase('loading');
      setFailure(null);
      publish('Downloading the IFC file…');
      const started = performance.now();
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        const data = new Uint8Array(await response.arrayBuffer());
        if (!data.byteLength) throw new Error('the IFC file is empty');

        publish(`Parsing ${(data.byteLength / 1024).toFixed(0)} kB of IFC…`);
        const name = url.split('/').pop()?.split('?')[0] || 'model.ifc';
        const model = await state.loader.load(data, true, name);
        if (!model) throw new Error('the IFC loader returned no model');

        // Replace a previously loaded model rather than stacking renderers.
        if (state.model) {
          try {
            state.world.scene.three.remove(state.model.object);
            await state.fragments?.list?.delete?.(state.model.modelId);
            state.model.dispose?.();
          } catch {
            /* best effort; a stale model in the scene is not fatal */
          }
        }

        state.world.scene.three.add(model.object);
        state.model = model;
        state.loadedUrl = url;
        try {
          state.fragments?.list?.set?.(model.modelId ?? name, model);
        } catch {
          /* the list is a convenience index, not required for rendering */
        }

        const durationMs = Math.round(performance.now() - started);
        try {
          await state.world.camera.fitToItems?.();
        } catch (error) {
          publish(`Model loaded, but fitting the camera failed: ${error.message}`);
        }

        let items = null;
        try {
          items = model.getItemsCount?.() ?? null;
        } catch {
          items = null;
        }
        setGeometryItems(items);
        setCapabilities((current) => ({
          ...current,
          visibility: typeof model.setVisible === 'function',
        }));
        setHiddenIds([]);
        setPhase('ready');
        publish(`Loaded ${name} in ${durationMs} ms${items ? ` (${items} geometry items)` : ''}`);
      } catch (error) {
        console.error('[That Open] IFC load error:', error);
        setPhase('error');
        setFailure(error.message || String(error));
        publish(`Could not load the IFC model: ${error.message || error}`);
      }
    },
    [publish]
  );

  // Load whenever a new IFC URL appears (and after a retry).
  useEffect(() => {
    if (!engineReady || !ifcUrl) return;
    const state = stateRef.current;
    if (state.loadedUrl === ifcUrl && retryNonce === 0) return;
    loadIfc(ifcUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineReady, ifcUrl, retryNonce]);

  /* -------------------------------------------------------------- interactions */

  const applyHighlight = useCallback(
    async (guid, { zoom = false } = {}) => {
      const state = stateRef.current;
      if (!state.highlighter || !state.fragments) return { ok: false, reason: 'no highlighter' };
      try {
        if (!guid) {
          await state.highlighter.clear(HIGHLIGHT_STYLE);
          return { ok: true };
        }
        const map = await state.fragments.guidsToModelIdMap([guid]);
        const entries = map ? Object.keys(map).length : 0;
        if (!entries) {
          return { ok: false, reason: `GlobalId ${guid} is not present in the loaded IFC model` };
        }
        await state.highlighter.highlightByID(HIGHLIGHT_STYLE, map, true, zoom);
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: `highlight failed: ${error.message}` };
      }
    },
    []
  );

  // Model/3D -> BIM focus request (element selected in another view).
  useEffect(() => {
    if (!focusGuid || !engineReady) return;
    applyHighlight(focusGuid).then((result) => {
      if (result.ok) publish(`Highlighted ${focusGuid}`);
      else publish(result.reason);
    });
  }, [focusGuid, engineReady, applyHighlight, publish]);

  // Clear the highlight when the shared selection is cleared elsewhere.
  useEffect(() => {
    if (selectedGuid || !engineReady) return;
    applyHighlight(null);
  }, [selectedGuid, engineReady, applyHighlight]);

  const pickAt = useCallback(
    async (event) => {
      const state = stateRef.current;
      if (!state.fragments || !state.world || !engineReady) return;
      const dom = state.world.renderer?.three?.domElement;
      const camera = state.world.camera?.three;
      if (!dom || !camera) return;
      const rect = dom.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      try {
        const hit = await state.fragments.raycast({ camera, mouse, dom });
        if (!hit) {
          setSelection(null);
          if (onSelect) onSelect(null);
          return;
        }
        const guids = await hit.fragments?.getGuidsByLocalIds?.([hit.localId]);
        const guid = guids?.[0] || null;
        const element = guid ? state.guidIndex.get(guid) || null : null;
        setSelection({ guid, element, localIds: [hit.localId], source: 'pick' });
        if (onSelect) onSelect({ guid, element, localIds: [hit.localId] });
        if (guid) await applyHighlight(guid);
        publish(
          element
            ? `Selected ${element.name || element.id} (${guid})`
            : guid
              ? `Selected ${guid} — no matching element in the canonical model`
              : 'Clicked empty space'
        );
      } catch (error) {
        publish(`Picking failed: ${error.message}`);
      }
    },
    [engineReady, onSelect, applyHighlight, publish]
  );

  // Pointer picking. Registered on the renderer canvas once it exists.
  useEffect(() => {
    if (!engineReady) return;
    const state = stateRef.current;
    const dom = state.world?.renderer?.three?.domElement;
    if (!dom) return;
    let down = null;
    const onDown = (event) => {
      down = { x: event.clientX, y: event.clientY, at: Date.now() };
    };
    const onUp = (event) => {
      if (!down) return;
      const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
      const elapsed = Date.now() - down.at;
      down = null;
      // Only a click, not an orbit/pan drag.
      if (moved > 6 || elapsed > 700) return;
      pickAt(event);
    };
    dom.addEventListener('pointerdown', onDown);
    dom.addEventListener('pointerup', onUp);
    return () => {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointerup', onUp);
    };
  }, [engineReady, pickAt]);

  const resetView = useCallback(async () => {
    const state = stateRef.current;
    try {
      await state.world?.camera?.fitToItems?.();
      publish('Camera fitted to the model');
    } catch (error) {
      publish(`Fit failed: ${error.message}`);
    }
  }, [publish]);

  const toggleTool = useCallback(
    (tool) => {
      const state = stateRef.current;
      const next = activeTool === tool ? null : tool;
      setActiveTool(next);
      try {
        if (state.clipper) state.clipper.enabled = next === 'clip';
        if (state.measure) state.measure.enabled = next === 'measure';
        publish(next ? `Active tool: ${next}` : 'Tools disabled');
      } catch (error) {
        publish(`${tool} failed: ${error.message}`);
      }
    },
    [activeTool, publish]
  );

  const clearSelection = useCallback(async () => {
    await applyHighlight(null);
    setSelection(null);
    if (onSelect) onSelect(null);
  }, [applyHighlight, onSelect]);

  /** Hide or show the selected element (real `FragmentsModel.setVisible`). */
  const toggleSelectedVisibility = useCallback(async () => {
    const state = stateRef.current;
    const model = state.model;
    if (!model || typeof model.setVisible !== 'function') {
      publish('Visibility control is not available in this build');
      return;
    }
    const guid = selection?.guid;
    if (!guid) {
      publish('Select an element first');
      return;
    }
    try {
      const map = await state.fragments.guidsToModelIdMap([guid]);
      const modelKey = Object.keys(map || {})[0];
      const localIds = modelKey ? Array.from(map[modelKey] || []) : [];
      if (!localIds.length) {
        publish(`GlobalId ${guid} has no geometry to hide`);
        return;
      }
      const isHidden = hiddenIds.includes(guid);
      await model.setVisible(localIds, isHidden);
      setHiddenIds((current) =>
        isHidden ? current.filter((entry) => entry !== guid) : [...current, guid]
      );
      publish(`${isHidden ? 'Shown' : 'Hidden'} ${guid}`);
    } catch (error) {
      publish(`Visibility change failed: ${error.message}`);
    }
  }, [selection, hiddenIds, publish]);

  const showAll = useCallback(async () => {
    const state = stateRef.current;
    try {
      await state.model?.resetVisible?.();
      setHiddenIds([]);
      publish('All elements shown');
    } catch (error) {
      publish(`Could not reset visibility: ${error.message}`);
    }
  }, [publish]);

  const retry = useCallback(() => {
    setFailure(null);
    setRetryNonce((value) => value + 1);
  }, []);

  const selectedElement = selection?.element || null;

  /* ------------------------------------------------------------------- render */

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#141414]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-1.5 border-b border-[#4c4d4f] bg-[#1d1e1f] px-2 py-1.5 select-none">
        <div className="flex min-w-0 items-center gap-2">
          <Box size={14} className="shrink-0 text-[#409eff]" aria-hidden="true" />
          <span className="truncate text-[11px] text-[#e5eaf3]">That Open · IFC 4</span>
          {geometryItems != null && (
            <span className="hidden shrink-0 text-[10px] text-[#909399] sm:inline">
              {geometryItems} items
            </span>
          )}
          {hiddenIds.length > 0 && (
            <span className="shrink-0 rounded bg-amber-900/40 px-1 text-[10px] text-amber-300">
              {hiddenIds.length} hidden
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <button type="button" onClick={resetView} className={button} title="Fit the camera to the model">
            <RefreshCcw size={12} aria-hidden="true" />
            <span className="hidden sm:inline">Fit</span>
          </button>
          <button
            type="button"
            onClick={() => toggleTool('clip')}
            disabled={!capabilities.clipper}
            className={`${button} ${activeTool === 'clip' ? buttonActive : ''}`}
            title={capabilities.clipper ? 'Add a clipping plane' : 'Clipper unavailable in this build'}
          >
            <Scissors size={12} aria-hidden="true" />
            <span className="hidden sm:inline">Clip</span>
          </button>
          <button
            type="button"
            onClick={() => toggleTool('measure')}
            disabled={!capabilities.measure}
            className={`${button} ${activeTool === 'measure' ? buttonActive : ''}`}
            title={capabilities.measure ? 'Measure a length' : 'Measurement unavailable in this build'}
          >
            <Ruler size={12} aria-hidden="true" />
            <span className="hidden sm:inline">Measure</span>
          </button>
          <button
            type="button"
            onClick={toggleSelectedVisibility}
            disabled={!selection?.guid || !capabilities.visibility}
            className={button}
            title="Hide or show the selected element"
          >
            {selection?.guid && hiddenIds.includes(selection.guid) ? (
              <Eye size={12} aria-hidden="true" />
            ) : (
              <EyeOff size={12} aria-hidden="true" />
            )}
            <span className="hidden sm:inline">Hide</span>
          </button>
          <button type="button" onClick={clearSelection} className={button} title="Clear the selection">
            <MousePointerClick size={12} aria-hidden="true" />
            <span className="hidden sm:inline">Clear</span>
          </button>
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            className={`${button} ${showDetails ? buttonActive : ''}`}
            title={showDetails ? 'Hide details' : 'Show details'}
            aria-pressed={showDetails}
          >
            <PanelRight size={12} aria-hidden="true" />
            <span className="hidden sm:inline">Details</span>
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div ref={containerRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden" />

        {(phase === 'unavailable' || phase === 'error') && (
          <div className="absolute inset-0 z-20 flex items-center justify-center overflow-auto bg-[#141414] p-4 text-[#cdd3dd]">
            <div className="w-full max-w-md space-y-3 rounded-xl border border-[#4c4d4f] bg-[#1f2022] p-4 shadow-xl">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#e5eaf3]">
                    {phase === 'unavailable' ? 'BIM engine unavailable' : 'The IFC model could not be loaded'}
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#909399]">
                    {failure || ENGINE.reason}
                  </p>
                </div>
              </div>
              <ul className="list-disc space-y-0.5 pl-5 text-[10px] text-[#909399]">
                <li>engine: {ENGINE.engine} {ENGINE.version}</li>
                <li>worker: {WORKER_URL}</li>
                <li>wasm: {WASM_PATH}</li>
                <li>model: {ifcUrl || 'none generated yet'}</li>
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={retry} className={button} disabled={!ifcUrl}>
                  <RefreshCcw size={13} aria-hidden="true" /> Retry loading
                </button>
                {ifcUrl && (
                  <a
                    href={ifcUrl}
                    download
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded bg-[#409eff] px-3 text-[11px] font-medium text-white"
                  >
                    Download IFC
                  </a>
                )}
              </div>
              <p className="text-[10px] leading-relaxed text-[#909399]">
                This panel does not substitute another renderer for the BIM engine. If the IFC
                parse fails, the failure and its cause are shown here.
              </p>
            </div>
          </div>
        )}

        {phase === 'loading' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#141414]/80 px-4 text-center text-[12px] text-[#e5eaf3]">
            <Loader2 size={18} className="animate-spin text-[#409eff]" aria-hidden="true" />
            <span>{status}</span>
          </div>
        )}
      </div>

      {showDetails && (
        <div className="absolute bottom-16 right-2 z-30 max-h-[55%] w-72 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-[#4c4d4f] bg-[#1a1b1c]/95 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#4c4d4f] px-3 py-2">
            <span className="text-[10px] uppercase tracking-wide text-[#909399]">Selection</span>
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              className="p-1 text-[#909399] hover:text-[#e5eaf3]"
              aria-label="Hide details"
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
          {!selection && (
            <p className="p-3 text-[11px] text-[#909399]">
              Click an element in the model, or pick one in the canonical elements list.
            </p>
          )}
          {selection && (
            <div className="space-y-1 p-3">
              <div className="break-all text-[11px] text-[#e5eaf3]">{selection.guid || 'no GlobalId'}</div>
              {selection.localIds && (
                <div className="text-[10px] text-[#909399]">local ids: {selection.localIds.join(', ')}</div>
              )}
              {selectedElement ? (
                <div className="mt-1 text-[11px] text-[#e5eaf3]">
                  <div>{selectedElement.name || selectedElement.id}</div>
                  <div className="text-[10px] text-[#909399]">
                    {selectedElement.id} · {selectedElement.ifc_class || selectedElement.ifcClass || 'class unknown'}
                  </div>
                  {selectedElement.dimensions && (
                    <div className="text-[10px] text-[#909399]">
                      {Object.entries(selectedElement.dimensions)
                        .map(([key, value]) => `${key}=${value} m`)
                        .join(' ')}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-1 flex items-start gap-1 text-[10px] text-amber-300">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>This GlobalId has no matching element in the canonical model.</span>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-[#4c4d4f] px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-[#909399]">Capabilities</div>
            <ul className="mt-1 space-y-0.5 text-[11px]">
              {[
                ['selection highlight', capabilities.highlighter],
                ['clipping planes', capabilities.clipper],
                ['length measurement', capabilities.measure],
                ['visibility control', capabilities.visibility],
              ].map(([label, ok]) => (
                <li key={label} className={ok ? 'text-emerald-400' : 'text-rose-400'}>
                  {ok ? '✓' : '✕'} {label}
                </li>
              ))}
            </ul>
            <button type="button" onClick={showAll} className="mt-2 w-full text-[10px] text-[#409eff] hover:underline">
              Show all hidden elements
            </button>
          </div>
        </div>
      )}

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-[#4c4d4f] bg-[#1d1e1f] px-2 py-1 text-[10px] text-[#909399]">
        <span className="min-w-0 truncate">{status}</span>
        <span className="shrink-0">{phase}</span>
      </footer>
    </div>
  );
}
