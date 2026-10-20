// src/components/interop/ThatOpenBimViewer.jsx
//
// BIM viewer for the interoperability workbench, built on That Open Components.
//
//   @thatopen/components      3.3.3
//   @thatopen/components-front 3.3.3
//   @thatopen/fragments       3.3.3
//   web-ifc                   0.0.78
//   three                     0.172.0  (shared with MLightCAD and R3F)
//
// Scope
// -----
// This is a *separate* workspace tab. It never replaces the application's React
// Three Fiber renderer (the existing `/visualise` and drawing routes keep their own
// Canvas); it creates its own WebGL renderer inside its own container.
//
// Every API used here was read from the installed type definitions rather than
// remembered, because That Open 3.x renamed a lot relative to 2.x:
//   OBC.Worlds.create()            -> SimpleWorld
//   OBC.SimpleScene(components)    -> .three is a THREE.Scene
//   OBC.SimpleCamera(components)   -> .controls (camera-controls), .fitToItems()
//   OBC.SimpleRenderer(components, container)
//   OBC.IfcLoader.load(Uint8Array, coordinate, name) -> FRAGS.FragmentsModel
//   FRAGS.FragmentsModel.object    -> the THREE.Object3D to add to the scene
//   .getLocalIdsByGuids(guids) / .getGuidsByLocalIds(ids)  -> identity bridge
//   OBF.Highlighter.highlightByID(styleName, ModelIdMap)
//   OBC.Clipper.create(world) / .deleteAll() / .enabled
//   OBF.LengthMeasurement.create() / .delete()
//
// Runtime assets (the fragments worker and the web-ifc WASM) are copied into
// `public/thatopen/` by `scripts/copy-cad-bim-assets.js`, so nothing here depends
// on a bundler-specific worker import.
//
// Honesty note: the selection / clipping / measurement controls are wired to the
// documented API and feature-detected at runtime. If a capability is missing in
// the installed build, the toolbar reports it instead of pretending it works.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import { Box, Ruler, Scissors, RefreshCcw, MousePointerClick, AlertTriangle } from 'lucide-react';

const PUBLIC_URL = process.env.PUBLIC_URL || '';
const WORKER_URL = `${PUBLIC_URL}/thatopen/thatopen-fragments-worker.mjs`;
const WASM_PATH = `${PUBLIC_URL}/thatopen/`;

/** GUID -> element name, from the backend canonical model (optional). */
function buildGuidIndex(elements) {
  const index = new Map();
  for (const element of elements || []) {
    if (element.ifc_guid) index.set(element.ifc_guid, element);
  }
  return index;
}

export default function ThatOpenBimViewer({
  ifcUrl,
  elements = [],
  focusGuid = null,
  onStatus,
  onSelect,
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
    modelId: null,
    guidIndex: new Map(),
    disposed: false,
  });

  const [status, setStatus] = useState('Initialising That Open viewer…');
  const [isLoading, setIsLoading] = useState(false);
  const [capabilities, setCapabilities] = useState({
    highlighter: false,
    clipper: false,
    measure: false,
  });
  const [selection, setSelection] = useState(null);
  const [activeTool, setActiveTool] = useState(null);

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

  // --- viewer lifecycle ----------------------------------------------------
  useEffect(() => {
    const state = stateRef.current;
    state.disposed = false;
    let cancelled = false;

    async function init() {
      const container = containerRef.current;
      if (!container) return;
      try {
        const components = new OBC.Components();
        const worlds = components.get(OBC.Worlds);
        const world = worlds.create();
        world.scene = new OBC.SimpleScene(components);
        world.renderer = new OBC.SimpleRenderer(components, container);
        world.camera = new OBC.SimpleCamera(components);

        components.init();
        world.scene.setup();

        // Look at the origin from a convenient isometric-ish position; the real
        // framing happens after the model loads (fitToItems).
        await world.camera.controls.setLookAt(8, 6, 8, 0, 0, 0);

        const fragments = components.get(OBC.FragmentsManager);
        fragments.init(WORKER_URL);

        const loader = components.get(OBC.IfcLoader);
        loader.settings.autoSetWasm = false;
        loader.settings.wasm = { path: WASM_PATH, absolute: true };
        await loader.setup();

        state.components = components;
        state.world = world;
        state.fragments = fragments;
        state.loader = loader;

        // Optional capabilities, each feature-detected.
        try {
          const highlighter = components.get(OBF.Highlighter);
          highlighter.setup({ world });
          highlighter.zoomToSelection = false;
          highlighter.add('fundi-select');
          state.highlighter = highlighter;
        } catch (error) {
          console.warn('[That Open] Highlighter unavailable:', error);
        }
        try {
          const clipper = components.get(OBC.Clipper);
          clipper.setup({ world });
          clipper.enabled = false;
          state.clipper = clipper;
        } catch (error) {
          console.warn('[That Open] Clipper unavailable:', error);
        }
        try {
          const measure = components.get(OBF.LengthMeasurement);
          measure.world = world;
          measure.enabled = false;
          state.measure = measure;
        } catch (error) {
          console.warn('[That Open] Measurement unavailable:', error);
        }

        if (cancelled || state.disposed) return;
        setCapabilities({
          highlighter: Boolean(state.highlighter),
          clipper: Boolean(state.clipper),
          measure: Boolean(state.measure),
        });
        publish('That Open viewer ready');
      } catch (error) {
        console.error('[That Open] init failed:', error);
        publish(`That Open initialisation failed: ${error.message}`);
      }
    }

    init();

    return () => {
      cancelled = true;
      state.disposed = true;
      try {
        state.components?.dispose();
      } catch (error) {
        console.warn('[That Open] dispose failed:', error);
      }
      state.components = null;
      state.world = null;
      state.fragments = null;
      state.loader = null;
      state.highlighter = null;
      state.clipper = null;
      state.measure = null;
      state.model = null;
    };
  }, [publish]);

  // --- IFC loading ---------------------------------------------------------
  const loadIfc = useCallback(
    async (url) => {
      const state = stateRef.current;
      if (!url || !state.loader || !state.world) return;
      setIsLoading(true);
      publish(`Fetching ${url.split('/').pop()}…`);
      const started = performance.now();
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = new Uint8Array(await response.arrayBuffer());
        publish(`Converting IFC (${Math.round(buffer.byteLength / 1024)} KiB)…`);

        const model = await state.loader.load(buffer, false, url.split('/').pop());
        const durationMs = Math.round(performance.now() - started);

        // Replace any previous model so reloading does not stack copies.
        if (state.model?.object) {
          state.world.scene.three.remove(state.model.object);
          try {
            await state.model.dispose();
          } catch {
            /* best effort */
          }
        }
        state.model = model;
        state.modelId = model.modelId;
        state.world.scene.three.add(model.object);

        let itemCount = 0;
        try {
          itemCount = (await model.getItemsWithGeometry()).length;
        } catch {
          /* counting is best effort */
        }
        try {
          await state.world.camera.fitToItems();
        } catch {
          /* framing is best effort */
        }
        state.world.renderer.needsUpdate = true;

        publish(`Loaded IFC in ${durationMs} ms (${itemCount} geometry items)`);
        return { model, durationMs, itemCount };
      } catch (error) {
        console.error('[That Open] IFC load failed:', error);
        publish(`Could not load IFC: ${error.message}`);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [publish]
  );

  // Reload whenever the caller supplies a new IFC URL (e.g. after regeneration).
  const loadedUrlRef = useRef(null);
  useEffect(() => {
    const state = stateRef.current;
    if (!ifcUrl || !state.loader) return;
    if (loadedUrlRef.current === ifcUrl) return;
    // The loader is only available after init; poll briefly rather than failing.
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (stateRef.current.loader) {
        clearInterval(timer);
        loadedUrlRef.current = ifcUrl;
        loadIfc(ifcUrl);
      } else if (tries > 60) {
        clearInterval(timer);
        publish('That Open viewer did not become ready in time');
      }
    }, 100);
    return () => clearInterval(timer);
  }, [ifcUrl, loadIfc, publish]);

  // --- selection ----------------------------------------------------------
  const selectByGuid = useCallback(
    async (guid, { zoom = false } = {}) => {
      const state = stateRef.current;
      if (!state.model || !state.highlighter) return false;
      try {
        const localIds = await state.model.getLocalIdsByGuids([guid]);
        const ids = (localIds || []).filter((value) => value !== null && value !== undefined);
        if (!ids.length) return false;
        const map = { [state.modelId]: ids };
        await state.highlighter.highlightByID('fundi-select', map, false, zoom);
        const element = state.guidIndex.get(guid) || null;
        setSelection({ guid, element, localIds: ids });
        if (onSelect) onSelect({ guid, element, source: 'bim' });
        return true;
      } catch (error) {
        console.warn('[That Open] selection failed:', error);
        return false;
      }
    },
    [onSelect]
  );

  // Click-to-select: raycast, then map the local id back to an IFC GlobalId.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const onClick = async (event) => {
      const state = stateRef.current;
      if (!state.fragments || !state.world || !state.model) return;
      const canvas =
        state.world.renderer?.three?.domElement || container.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      try {
        const hit = await state.fragments.raycast({
          camera: state.world.camera.three,
          mouse,
          dom: canvas,
        });
        if (!hit) return;
        const guids = await hit.fragments.getGuidsByLocalIds([hit.localId]);
        const guid = (guids || [])[0];
        if (!guid) {
          publish(`Picked item ${hit.localId} has no IFC GlobalId in the fragments model`);
          return;
        }
        await selectByGuid(guid);
      } catch (error) {
        console.warn('[That Open] pick failed:', error);
      }
    };

    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  }, [selectByGuid, publish]);

  // Focus request from the mapping panel (element -> BIM).
  const lastFocusRef = useRef(null);
  useEffect(() => {
    if (!focusGuid || focusGuid === lastFocusRef.current) return;
    lastFocusRef.current = focusGuid;
    selectByGuid(focusGuid, { zoom: true }).then((ok) => {
      if (!ok) publish('That element is not present in the loaded IFC');
    });
  }, [focusGuid, selectByGuid, publish]);

  // --- tools --------------------------------------------------------------
  const toggleTool = useCallback(
    async (tool) => {
      const state = stateRef.current;
      if (!state.world) return;
      try {
        if (activeTool === tool) {
          if (tool === 'clip') {
            state.clipper.deleteAll();
            state.clipper.enabled = false;
          }
          if (tool === 'measure') {
            state.measure.cancelCreation?.();
            state.measure.enabled = false;
          }
          setActiveTool(null);
          publish(`${tool} tool off`);
          return;
        }
        if (tool === 'clip' && state.clipper) {
          state.clipper.enabled = true;
          const plane = await state.clipper.create(state.world);
          publish(plane ? 'Clipping plane created' : 'Clipping cancelled');
        }
        if (tool === 'measure' && state.measure) {
          state.measure.enabled = true;
          await state.measure.create();
          publish('Pick two points to measure');
        }
        setActiveTool(tool);
      } catch (error) {
        publish(`${tool} failed: ${error.message}`);
      }
    },
    [activeTool, publish]
  );

  const clearSelection = useCallback(async () => {
    const state = stateRef.current;
    try {
      await state.highlighter?.clear('fundi-select');
    } catch {
      /* best effort */
    }
    setSelection(null);
    if (onSelect) onSelect(null);
  }, [onSelect]);

  const resetView = useCallback(async () => {
    const state = stateRef.current;
    try {
      await state.world?.camera.fitToItems();
      publish('View fitted to model');
    } catch (error) {
      publish(`Fit failed: ${error.message}`);
    }
  }, [publish]);

  const selectedElement = selection?.element || null;

  return (
    <div className="flex flex-col w-full h-full bg-[#141414] overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#1d1e1f] border-b border-[#4c4d4f] shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <Box className="w-3.5 h-3.5 text-[#409eff] shrink-0" />
          <span className="text-[11px] text-[#e5eaf3]">That Open Components</span>
          <span className="text-[10px] text-[#909399]">IFC 4 · fragments</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={resetView}
            className="flex items-center gap-1 px-2 py-1 text-[11px] bg-[#262727] hover:bg-[#303030] border border-[#4c4d4f] rounded text-[#e5eaf3]"
            title="Fit the camera to the model"
          >
            <RefreshCcw className="w-3 h-3" />
            <span>Fit</span>
          </button>
          <button
            onClick={() => toggleTool('clip')}
            disabled={!capabilities.clipper}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] border rounded ${
              activeTool === 'clip'
                ? 'bg-[#409eff] text-white border-[#409eff]'
                : 'bg-[#262727] hover:bg-[#303030] border-[#4c4d4f] text-[#e5eaf3]'
            } ${capabilities.clipper ? '' : 'opacity-40 cursor-not-allowed'}`}
            title={capabilities.clipper ? 'Add a clipping plane' : 'Clipper unavailable in this build'}
          >
            <Scissors className="w-3 h-3" />
            <span>Clip</span>
          </button>
          <button
            onClick={() => toggleTool('measure')}
            disabled={!capabilities.measure}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] border rounded ${
              activeTool === 'measure'
                ? 'bg-[#409eff] text-white border-[#409eff]'
                : 'bg-[#262727] hover:bg-[#303030] border-[#4c4d4f] text-[#e5eaf3]'
            } ${capabilities.measure ? '' : 'opacity-40 cursor-not-allowed'}`}
            title={capabilities.measure ? 'Measure a length' : 'Measurement unavailable in this build'}
          >
            <Ruler className="w-3 h-3" />
            <span>Measure</span>
          </button>
          <button
            onClick={clearSelection}
            className="flex items-center gap-1 px-2 py-1 text-[11px] bg-[#262727] hover:bg-[#303030] border border-[#4c4d4f] rounded text-[#e5eaf3]"
            title="Clear the highlight"
          >
            <MousePointerClick className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <div ref={containerRef} className="relative flex-1 min-w-0 min-h-0 overflow-hidden" />

        <aside className="w-64 shrink-0 bg-[#1a1b1c] border-l border-[#4c4d4f] overflow-y-auto">
          <div className="px-3 py-2 border-b border-[#4c4d4f]">
            <div className="text-[10px] uppercase tracking-wide text-[#909399]">Selection</div>
            {!selection && (
              <p className="mt-1 text-[11px] text-[#909399]">
                Click an element in the model, or pick one in the linkage panel.
              </p>
            )}
            {selection && (
              <div className="mt-1 space-y-1">
                <div className="text-[11px] text-[#e5eaf3] break-all">{selection.guid}</div>
                <div className="text-[10px] text-[#909399]">
                  local ids: {selection.localIds?.join(', ')}
                </div>
                {selectedElement ? (
                  <div className="mt-1 text-[11px] text-[#e5eaf3]">
                    <div>{selectedElement.name}</div>
                    <div className="text-[10px] text-[#909399]">
                      {selectedElement.id} · {selectedElement.ifc_class}
                    </div>
                    {selectedElement.dimensions && (
                      <div className="text-[10px] text-[#909399]">
                        {Object.entries(selectedElement.dimensions)
                          .map(([k, v]) => `${k}=${v} m`)
                          .join(' ')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-1 flex items-start gap-1 text-[10px] text-amber-300">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>
                      This GlobalId has no matching element in the canonical model
                      served by the API.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-3 py-2 border-b border-[#4c4d4f]">
            <div className="text-[10px] uppercase tracking-wide text-[#909399]">Capabilities</div>
            <ul className="mt-1 space-y-0.5 text-[11px]">
              <li className={capabilities.highlighter ? 'text-emerald-400' : 'text-rose-400'}>
                {capabilities.highlighter ? '✓' : '✕'} selection highlight
              </li>
              <li className={capabilities.clipper ? 'text-emerald-400' : 'text-rose-400'}>
                {capabilities.clipper ? '✓' : '✕'} clipping planes
              </li>
              <li className={capabilities.measure ? 'text-emerald-400' : 'text-rose-400'}>
                {capabilities.measure ? '✓' : '✕'} length measurement
              </li>
            </ul>
          </div>

          <div className="px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-[#909399]">Model</div>
            <p className="mt-1 text-[10px] text-[#909399] break-all">{ifcUrl || 'no IFC loaded'}</p>
          </div>
        </aside>
      </div>

      <footer className="px-3 py-1 bg-[#1d1e1f] border-t border-[#4c4d4f] text-[10px] text-[#909399] truncate shrink-0">
        {isLoading ? `Working… ${status}` : status}
      </footer>
    </div>
  );
}
