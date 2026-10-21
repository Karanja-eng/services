// src/components/interop/ThatOpenBimViewer.jsx
//
// BIM viewer for the interoperability workbench, built on That Open Components.
// Safe fallback layer prevents Webpack compilation crashes in mobile / Termux.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as OBC from './compat/thatOpenComponents';
import * as OBF from './compat/thatOpenComponentsFront';
import {
  Box,
  Ruler,
  Scissors,
  RefreshCcw,
  MousePointerClick,
  AlertTriangle,
  PanelRight,
  X,
} from 'lucide-react';

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
    guidIndex: new Map(),
    disposed: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('Initializing BIM viewer…');
  const [activeTool, setActiveTool] = useState(null); // 'clip' | 'measure' | null
  const [capabilities, setCapabilities] = useState({
    highlighter: false,
    clipper: false,
    measure: false,
  });
  const [selection, setSelection] = useState(null);
  const [showDetails, setShowDetails] = useState(
    typeof window !== 'undefined' ? window.innerWidth > 768 : false
  );

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
        if (!OBC.Components || typeof OBC.Components !== 'function') {
          setIsLoading(false);
          publish('That Open BIM engine is not installed in this environment (Termux/mobile).');
          return;
        }

        const components = new OBC.Components();
        if (!components.get) {
          setIsLoading(false);
          publish('That Open BIM engine is not installed in this environment (Termux/mobile).');
          return;
        }

        const worlds = components.get(OBC.Worlds);
        const world = worlds.create();
        world.scene = new OBC.SimpleScene(components);
        world.renderer = new OBC.SimpleRenderer(components, container);
        world.camera = new OBC.SimpleCamera(components);

        components.init();
        world.scene.setup();

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

        publish('That Open Components ready');
      } catch (error) {
        console.warn('[That Open] init error:', error);
        publish(`That Open BIM engine is not active in this environment: ${error.message}`);
        setIsLoading(false);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetView = useCallback(async () => {
    const state = stateRef.current;
    try {
      await state.world?.camera?.fitToItems?.();
      publish('View fitted to model');
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
    const state = stateRef.current;
    try {
      await state.highlighter?.clear('fundi-select');
    } catch {
      /* best effort */
    }
    setSelection(null);
    if (onSelect) onSelect(null);
  }, [onSelect]);

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
          <button
            onClick={() => setShowDetails((prev) => !prev)}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded border transition-colors ${
              showDetails
                ? 'bg-[#409eff]/20 text-[#409eff] border-[#409eff]/50'
                : 'bg-[#262727] text-[#909399] border-[#4c4d4f] hover:text-[#e5eaf3]'
            }`}
            title={showDetails ? 'Hide details sidebar' : 'Show details sidebar'}
          >
            <PanelRight className="w-3 h-3" />
            <span className="hidden sm:inline">Details</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 relative">
        <div ref={containerRef} className="relative flex-1 min-w-0 min-h-0 overflow-hidden">
          {!capabilities.highlighter && !stateRef.current.world && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#141414] text-[#cdd3dd] z-10">
              <div className="max-w-md p-6 bg-[#1f2022] border border-[#4c4d4f] rounded-xl shadow-xl space-y-3">
                <Box className="w-8 h-8 text-[#409eff] mx-auto mb-1" />
                <h3 className="text-base font-semibold text-[#e5eaf3]">That Open BIM Viewer</h3>
                <p className="text-xs text-[#909399] leading-relaxed">
                  The That Open Components engine is optional and not installed in this mobile environment.
                  You can inspect the 3D model via the <strong>Existing 3D (R3F)</strong> tab or navigate to{' '}
                  <a href="/visualise" className="text-[#409eff] underline">
                    /visualise
                  </a>
                  .
                </p>
                {ifcUrl && (
                  <div className="pt-2">
                    <a
                      href={ifcUrl}
                      download
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#409eff] hover:bg-[#66b1ff] text-white rounded font-medium"
                    >
                      Download IFC File
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {showDetails && (
          <aside className="w-64 max-w-[80vw] shrink-0 bg-[#1a1b1c] border-l border-[#4c4d4f] overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#4c4d4f]">
              <span className="text-[10px] uppercase tracking-wide text-[#909399]">Selection</span>
              <button
                onClick={() => setShowDetails(false)}
                className="text-[#909399] hover:text-[#e5eaf3] p-1"
                title="Hide details"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            {!selection && (
              <p className="p-3 text-[11px] text-[#909399]">
                Click an element in the model, or pick one in the linkage panel.
              </p>
            )}
            {selection && (
              <div className="p-3 space-y-1">
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
                      This GlobalId has no matching element in the canonical model served by the API.
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="px-3 py-2 border-t border-[#4c4d4f]">
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

            <div className="px-3 py-2 border-t border-[#4c4d4f]">
              <div className="text-[10px] uppercase tracking-wide text-[#909399]">Model</div>
              <p className="mt-1 text-[10px] text-[#909399] break-all">{ifcUrl || 'no IFC loaded'}</p>
            </div>
          </aside>
        )}
      </div>

      <footer className="px-3 py-1 bg-[#1d1e1f] border-t border-[#4c4d4f] text-[10px] text-[#909399] truncate shrink-0">
        {isLoading ? `Working… ${status}` : status}
      </footer>
    </div>
  );
}
