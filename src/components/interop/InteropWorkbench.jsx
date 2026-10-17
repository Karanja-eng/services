// src/components/interop/InteropWorkbench.jsx
//
// The 2D CAD + 3D BIM + IFC workbench.
//
// This is the smallest end-to-end demonstration of the target workflow that the
// repository supports today:
//
//   septic tank parameters (the real generator's own inputs)
//        -> canonical engineering model   (Python: septic_model)
//        -> IFC4 file                     (Python: ifc_export / IfcOpenShell)
//        -> DXF drawing                   (Python: dxf_export / ezdxf)
//        -> persistent element mapping    (Python: mapping / SQLite)
//        -> MLightCAD renders the DXF     (this page, left tab)
//        -> web-ifc renders the IFC       (this page, right tab)
//        -> one element selected in one view is identified in the other
//
// It does not replace the existing Konva drawing page (/drawing) or the existing
// R3F visualiser (/visualise); it is an additional, isolated route.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Layers, Link2, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import CadDxfViewer from './CadDxfViewer';
import IfcBimViewer from './IfcBimViewer';

const STATIC_BASE = process.env.PUBLIC_URL || '';
const MODEL_ID = 'septic-system';
const API_BASE = process.env.REACT_APP_API_BASE || 'http://127.0.0.1:8001';

const STATUS_STYLES = {
  ok: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  regenerated: 'bg-sky-900/40 text-sky-300 border-sky-800',
  deleted: 'bg-rose-900/40 text-rose-300 border-rose-800',
  stale: 'bg-amber-900/40 text-amber-300 border-amber-800',
  conflict: 'bg-rose-900/40 text-rose-200 border-rose-700',
  unit_mismatch: 'bg-fuchsia-900/40 text-fuchsia-200 border-fuchsia-800',
};

export default function InteropWorkbench({ isDark = false }) {
  const [tab, setTab] = useState('cad');
  const [links, setLinks] = useState([]);
  const [model, setModel] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [cadFocus, setCadFocus] = useState(null);
  const [cadLoaded, setCadLoaded] = useState(null);
  const [bimStatus, setBimStatus] = useState(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenMessage, setRegenMessage] = useState(null);
  const [revision, setRevision] = useState(0);
  const [params, setParams] = useState({ tank_int_l: 3.0, tank_int_w: 2.5, tank_depth_int: 2.0 });

  // Artifacts are written by: python -m src.Backend.cad_ifc.pipeline
  const urls = useMemo(
    () => ({
      dxf: `${STATIC_BASE}/ifc/${MODEL_ID}.dxf?v=${revision}`,
      ifc: `${STATIC_BASE}/ifc/${MODEL_ID}.ifc?v=${revision}`,
      links: `${STATIC_BASE}/ifc/${MODEL_ID}.links.json?v=${revision}`,
      model: `${STATIC_BASE}/ifc/${MODEL_ID}.model.json?v=${revision}`,
    }),
    [revision]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [linksResponse, modelResponse] = await Promise.all([
          fetch(urls.links),
          fetch(urls.model),
        ]);
        if (!linksResponse.ok) throw new Error(`links.json: HTTP ${linksResponse.status}`);
        if (!modelResponse.ok) throw new Error(`model.json: HTTP ${modelResponse.status}`);
        const linksDocument = await linksResponse.json();
        const modelDocument = await modelResponse.json();
        if (cancelled) return;
        setLinks(linksDocument.links || []);
        setModel({ ...modelDocument, revision: linksDocument.revision });
        setLoadError(null);
        setParams((prev) => ({
          ...prev,
          tank_int_l: modelDocument.parameters?.tank_int_l ?? prev.tank_int_l,
          tank_int_w: modelDocument.parameters?.tank_int_w ?? prev.tank_int_w,
          tank_depth_int: modelDocument.parameters?.tank_depth_int ?? prev.tank_depth_int,
        }));
      } catch (error) {
        if (!cancelled) setLoadError(error.message);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [urls.links, urls.model]);

  const selected = useMemo(
    () => links.find((link) => link.internal_id === selectedId) || null,
    [links, selectedId]
  );

  const statusCounts = useMemo(() => {
    const counts = {};
    links.forEach((link) => {
      counts[link.status] = (counts[link.status] || 0) + 1;
    });
    return counts;
  }, [links]);

  const onBimSelect = useCallback(
    (picked) => {
      if (!picked?.globalId) {
        setSelectedId(null);
        return;
      }
      const match = links.find((link) => link.ifc_guid === picked.globalId);
      setSelectedId(match ? match.internal_id : null);
      setBimStatus(
        match
          ? `IFC element ${picked.globalId} -> ${match.internal_id} (handle ${match.dxf_handle})`
          : `IFC element ${picked.globalId} is not in the Fundi mapping`
      );
    },
    [links]
  );

  const pickLink = useCallback((link) => {
    setSelectedId(link.internal_id);
    setCadFocus(link.dxf_handle);
    setBimStatus(`Selected ${link.internal_id} — linked to DXF handle ${link.dxf_handle}`);
  }, []);

  const regenerate = useCallback(async () => {
    setRegenerating(true);
    setRegenMessage(null);
    try {
      const response = await fetch(`${API_BASE}/api/cad-ifc/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const report = await response.json();
      setRegenMessage(
        `Regenerated revision ${report?.model?.revision ?? '?'} — ` +
          `${report?.model?.element_count ?? '?'} elements, ` +
          `${report?.mapping?.link_count ?? '?'} links`
      );
      setRevision((value) => value + 1);
    } catch (error) {
      setRegenMessage(
        `Backend not reachable (${error.message}). Start it with ` +
          `uvicorn src.Backend.main:app --port 8001 — the static artifacts are ` +
          `regenerated by python -m src.Backend.cad_ifc.pipeline`
      );
    } finally {
      setRegenerating(false);
    }
  }, [params]);

  return (
    <div className={`flex h-screen flex-col ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/50 bg-slate-900 px-4 py-2 text-slate-100 shrink-0">
        <div className="flex items-center gap-3">
          <Link2 className="h-5 w-5 text-sky-400" />
          <div>
            <h1 className="text-sm font-semibold">CAD · BIM · IFC Interoperability Workbench</h1>
            <p className="text-[11px] text-slate-400">
              Septic tank generator · canonical model rev {model?.revision ?? '—'} ·{' '}
              {model?.statistics?.element_count ?? links.length} elements
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          {Object.entries(statusCounts).map(([status, count]) => (
            <span
              key={status}
              className={`rounded border px-1.5 py-0.5 ${STATUS_STYLES[status] || 'border-slate-600 text-slate-300'}`}
            >
              {status}: {count}
            </span>
          ))}
        </div>
      </header>

      {loadError && (
        <div className="flex items-center gap-2 bg-rose-950/60 px-4 py-2 text-[12px] text-rose-200">
          <AlertTriangle className="h-4 w-4" />
          Generated artifacts not found ({loadError}). Run:{' '}
          <code className="rounded bg-black/40 px-1">
            python -m src.Backend.cad_ifc.pipeline
          </code>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Left: element / link browser */}
        <aside className="flex w-[330px] shrink-0 flex-col border-r border-slate-700/50 bg-slate-900/95 text-slate-200">
          <div className="border-b border-slate-700/50 px-3 py-2 text-[10px] uppercase tracking-wide text-slate-400">
            Persistent element links ({links.length})
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {links.length === 0 && (
              <p className="px-3 py-3 text-[11px] text-slate-500">
                No links loaded. Generate the artifacts with the Python pipeline.
              </p>
            )}
            {links.map((link) => (
              <button
                key={link.internal_id}
                onClick={() => pickLink(link)}
                className={`block w-full border-b border-slate-800/70 px-3 py-1.5 text-left hover:bg-slate-800/70 ${
                  selectedId === link.internal_id ? 'bg-slate-800' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[11px]">{link.internal_id}</span>
                  <span
                    className={`shrink-0 rounded border px-1 text-[9px] ${STATUS_STYLES[link.status] || 'border-slate-600'}`}
                  >
                    {link.status}
                  </span>
                </div>
                <div className="truncate text-[10px] text-slate-500">
                  {link.ifc_class} · DXF {link.dxf_handle || '—'} · {link.ifc_guid}
                </div>
              </button>
            ))}
          </div>

          {/* Controlled regeneration */}
          <div className="border-t border-slate-700/50 p-3">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">
              Engineering parameters
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[
                ['tank_int_l', 'Length'],
                ['tank_int_w', 'Width'],
                ['tank_depth_int', 'Depth'],
              ].map(([key, label]) => (
                <label key={key} className="text-[10px] text-slate-400">
                  {label} (m)
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    value={params[key]}
                    onChange={(event) =>
                      setParams((prev) => ({ ...prev, [key]: Number(event.target.value) }))
                    }
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[11px] text-slate-100"
                  />
                </label>
              ))}
            </div>
            <button
              onClick={regenerate}
              disabled={regenerating}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded bg-sky-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${regenerating ? 'animate-spin' : ''}`} />
              Regenerate IFC + DXF
            </button>
            {regenMessage && (
              <p className="mt-2 flex items-start gap-1 text-[10px] leading-snug text-amber-300">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                {regenMessage}
              </p>
            )}
          </div>
        </aside>

        {/* Right: viewers */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1 border-b border-slate-700/50 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 shrink-0">
            <TabButton active={tab === 'cad'} onClick={() => setTab('cad')} icon={Layers}>
              2D CAD (MLightCAD, DXF)
            </TabButton>
            <TabButton active={tab === 'bim'} onClick={() => setTab('bim')} icon={Box}>
              3D BIM (IFC, web-ifc)
            </TabButton>
            <span className="ml-2 truncate text-[10px] text-slate-500">
              {selected
                ? `linked: ${selected.internal_id} · handle ${selected.dxf_handle} · ${selected.ifc_guid}`
                : 'no element selected'}
            </span>
          </div>

          <div className="min-h-0 flex-1">
            {tab === 'cad' ? (
              <CadDxfViewer
                dxfUrl={urls.dxf}
                focusHandle={cadFocus}
                isDark
                onLoaded={setCadLoaded}
              />
            ) : (
              <IfcBimViewer
                ifcUrl={urls.ifc}
                selectedGuid={selected?.ifc_guid || null}
                onSelect={onBimSelect}
                onStatus={(status) => setBimStatus(status.message)}
              />
            )}
          </div>

          {/* Footer diagnostics: what the viewers actually loaded */}
          <footer className="flex flex-wrap items-center gap-3 border-t border-slate-700/50 bg-slate-900 px-3 py-1 text-[10px] text-slate-400 shrink-0">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              DXF: {cadLoaded ? `${cadLoaded.entityCount} entities, ${cadLoaded.durationMs} ms` : 'not loaded'}
            </span>
            <span className="truncate">BIM: {bimStatus || 'not loaded'}</span>
            <span className="ml-auto">
              units: model {model?.units?.canonical || 'm'} · IFC {model?.units?.ifc || 'm'} · DXF{' '}
              {model?.units?.dxf || 'mm'}
            </span>
          </footer>
        </section>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded px-2 py-1 ${
        active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60'
      }`}
    >
      <Icon className="h-3 w-3" />
      {children}
    </button>
  );
}
