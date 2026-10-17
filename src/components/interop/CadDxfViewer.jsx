// src/components/interop/CadDxfViewer.jsx
//
// MLightCAD DXF viewer for the interoperability workbench.
//
// Adapted from the proven Fundi Pulse implementation
// (siteflow-mobile/migrated-web-app/src/cad/CadViewerSpike.jsx, commit c64c098
// "cad-viewer intergration") with the same package versions:
//   @mlightcad/cad-simple-viewer@1.7.5
//   @mlightcad/cad-simple-ui-plugin@1.7.5
//
// What it does here: opens the DXF that the Python adapter generated from the
// canonical engineering model, so the drawing on screen is the real artefact -
// not a re-render of React data. Entities carry FUNDI XDATA (internal element
// id + IFC GlobalId), which is what links this drawing to the BIM model.
//
// Deliberate scope note: this is a CAD viewer/editor for DXF. It is *not* the
// BIM viewer, and the app's existing React Konva drawing page remains the
// authoring surface for Fundi's own 2D objects.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AcApDocManager, acedApplyUiTheme, AcEdOpenMode } from '@mlightcad/cad-simple-viewer';
import { Download, RefreshCcw, Crosshair } from 'lucide-react';
import { createViewerContainer } from './viewerHost';

/**
 * Try to highlight one entity by DXF handle.
 *
 * MLightCAD 1.7.5 does not document a handle -> selection API, so this probes
 * for one at runtime and reports honestly instead of pretending. Verified
 * capabilities: the DXF database, its model-space iterator and per-entity
 * handles are public; rendering highlight requires an object id plus a view
 * exposing `highlight()` (`AcTrView2d.highlight(ids: AcDbObjectId[])`).
 */
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
    if (!found) return { ok: false, reason: `handle ${handle} not present in drawing` };

    const objectId = found.objectId ?? found.id ?? found.objectID;
    const view = manager.curView ?? manager.activeView ?? manager.view;
    if (objectId !== undefined && view && typeof view.highlight === 'function') {
      view.highlight([objectId]);
      return { ok: true, reason: `highlighted handle ${handle}` };
    }
    return {
      ok: false,
      reason:
        `entity found (type ${found.constructor?.name || 'unknown'}), but this ` +
        'MLightCAD build exposes no object-id highlight API',
    };
  } catch (error) {
    return { ok: false, reason: `focus failed: ${error.message}` };
  }
}

export default function CadDxfViewer({ dxfUrl, onStatus, onLoaded, focusHandle, dark = true }) {
  const hostRef = useRef(null);
  const containerRef = useRef(null);
  const managerRef = useRef(null);
  const fileInputRef = useRef(null);

  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Initializing CAD viewer…');
  const [activeFileName, setActiveFileName] = useState('');

  const publish = useCallback(
    (message, extra = {}) => {
      setStatusMessage(message);
      if (onStatus) onStatus({ message, ...extra });
    },
    [onStatus]
  );

  const openBuffer = useCallback(
    async (fileName, arrayBuffer) => {
      const manager = managerRef.current;
      if (!manager) return;
      setIsLoading(true);
      publish(`Parsing ${fileName}…`);
      const started = performance.now();
      try {
        const ok = await manager.openDocument(fileName, arrayBuffer, {
          mode: AcEdOpenMode.Write,
          progressiveRendering: false,
        });
        const durationMs = Math.round(performance.now() - started);
        if (!ok) {
          publish(`Failed to open ${fileName}`);
          return;
        }
        setActiveFileName(fileName);

        // Count entities so the UI can prove the real drawing was parsed.
        let entityCount = 0;
        const layerNames = new Set();
        try {
          const modelSpace = manager.curDocument?.database?.tables?.blockTable?.modelSpace;
          if (modelSpace) {
            for (const entity of modelSpace.newIterator()) {
              entityCount += 1;
              const layer = entity.layer ?? entity.layerName;
              if (layer) layerNames.add(String(layer));
            }
          }
        } catch {
          /* counting is best effort */
        }

        manager.sendStringToExecute('zoom\ne\n');
        publish(`Loaded ${fileName} in ${durationMs} ms (${entityCount} entities)`);
        if (onLoaded) {
          onLoaded({ fileName, entityCount, durationMs, layers: [...layerNames] });
        }
      } catch (error) {
        console.error('[Fundi CAD] openDocument failed:', error);
        publish(`Error loading DXF: ${error.message || error}`);
      } finally {
        setIsLoading(false);
      }
    },
    [onLoaded, publish]
  );

  const loadFromUrl = useCallback(
    async (url) => {
      if (!url) return;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        const name = url.split('/').pop() || 'drawing.dxf';
        await openBuffer(name, buffer);
      } catch (error) {
        publish(`Could not fetch ${url}: ${error.message}`);
        setIsLoading(false);
      }
    },
    [openBuffer, publish]
  );

  const handleExportDxf = useCallback(() => {
    const doc = managerRef.current?.curDocument;
    if (!doc?.database) {
      publish('No drawing database available to export.');
      return;
    }
    try {
      const content = doc.database.dxfOut(undefined, 6);
      const blob = new Blob([content], { type: 'application/dxf;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = (activeFileName.replace(/\.[^.]+$/, '') || 'drawing') + '_exported.dxf';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      publish(`Exported ${anchor.download}`);
    } catch (error) {
      publish(`Export failed: ${error.message}`);
    }
  }, [activeFileName, publish]);

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

  // --- initialise once ------------------------------------------------------
  useEffect(() => {
    let disposed = false;

    async function init() {
      if (!hostRef.current) return;
      try {
        const existing = AcApDocManager.tryGetInstance();
        if (existing) await existing.destroy();

        if (dark) acedApplyUiTheme('dark', hostRef.current);

        containerRef.current = createViewerContainer(hostRef.current);
        const manager = AcApDocManager.createInstance({
          container: containerRef.current,
          autoResize: true,
          useMainThreadDraw: true,
          disableExport: false,
        });
        managerRef.current = manager;

        const { acuiRegisterSimpleUiPlugin } = await import(
          '@mlightcad/cad-simple-ui-plugin/register'
        );
        if (!disposed) {
          await acuiRegisterSimpleUiPlugin(manager.pluginManager, {
            host: hostRef.current,
            dockPanel: { defaultOpen: false, defaultSide: 'left', defaultWidth: 280 },
            toolbar: { placement: 'right', items: 'default', collapsible: true },
          });
        }
        if (!disposed) await loadFromUrl(dxfUrl);
      } catch (error) {
        console.error('[Fundi CAD] init error:', error);
        setStatusMessage(`Viewer initialization failed: ${error.message}`);
        setIsLoading(false);
      }
    }

    init();

    return () => {
      disposed = true;
      if (managerRef.current) {
        managerRef.current.destroy().catch(() => {});
        managerRef.current = null;
      }
      containerRef.current?.remove();
      containerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when the caller supplies a new drawing URL (after regeneration).
  useEffect(() => {
    if (!managerRef.current || !dxfUrl) return;
    loadFromUrl(dxfUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dxfUrl]);

  // Focus request from the linkage panel.
  useEffect(() => {
    if (!focusHandle || !managerRef.current) return;
    const result = tryFocusEntity(managerRef.current, focusHandle);
    publish(result.reason, { focus: result });
  }, [focusHandle, publish]);

  return (
    <div className="flex flex-col w-full h-full bg-[#141414] overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#1d1e1f] border-b border-[#4c4d4f] shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] text-[#909399]">Drawing:</span>
          <span className="text-[11px] text-[#e5eaf3] truncate max-w-[260px]">
            {activeFileName || 'none'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 text-[11px] bg-[#262727] hover:bg-[#303030] border border-[#4c4d4f] rounded text-[#e5eaf3]"
            title="Open a local DXF file"
          >
            <Crosshair className="w-3 h-3 text-[#409eff]" />
            <span>Open DXF</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".dxf"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => loadFromUrl(dxfUrl)}
            className="flex items-center gap-1 px-2 py-1 text-[11px] bg-[#262727] hover:bg-[#303030] border border-[#4c4d4f] rounded text-[#e5eaf3]"
            title="Reload the generated drawing"
          >
            <RefreshCcw className="w-3 h-3 text-[#909399]" />
            <span>Reload</span>
          </button>
          <button
            onClick={handleExportDxf}
            className="flex items-center gap-1 px-2 py-1 text-[11px] bg-[#409eff] hover:bg-[#66b1ff] text-white rounded font-medium"
            title="Export the current drawing as DXF"
          >
            <Download className="w-3 h-3" />
            <span>Export DXF</span>
          </button>
        </div>
      </header>

      <div style={{ position: 'relative', flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}>
        {/* React renders this host EMPTY on purpose (see viewerHost.js). */}
        <div
          ref={hostRef}
          style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            minHeight: 0,
            overflow: 'hidden',
          }}
        />
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(20,20,20,0.82)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
              color: '#e5eaf3',
              fontSize: 13,
              padding: 16,
              textAlign: 'center',
            }}
          >
            {statusMessage}
          </div>
        )}
      </div>

      <footer className="px-3 py-1 bg-[#1d1e1f] border-t border-[#4c4d4f] text-[10px] text-[#909399] truncate shrink-0">
        {statusMessage}
      </footer>
    </div>
  );
}
