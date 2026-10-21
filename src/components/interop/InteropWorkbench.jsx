// src/components/interop/InteropWorkbench.jsx
//
// The CAD + BIM + IFC workbench for Fundi Studio.
//
// The workflow this page implements, in the order it happens:
//
//   1. pick one of the existing Python RC generators (beam, column, slab, wall,
//      retaining wall, pad footing, stair) and edit its real parameters;
//   2. POST /api/cad-ifc/generate  (Python: generator_registry + rc_model)
//        -> the generator's own DXF sheet, tagged with FUNDI identity XDATA
//        -> a canonical engineering model (JSON, metres, Z-up)
//        -> a semantic IFC4 file (IfcOpenShell)
//        -> a persistent element <-> CAD entity <-> IFC GlobalId mapping
//   3. edit the DXF in the MLightCAD editor (left tab) - the served file is the
//      real artefact, not a re-render of React state;
//   4. inspect the same elements in the That Open BIM viewer (right tab), with
//      selection, properties, clipping and measurement;
//   5. reconcile: upload the edited DXF and see exactly which entities were
//      deleted, re-handled or modified. CAD changes are *never* applied to the
//      engineering model automatically.
//
// The application's existing Konva drawing page (/drawing) and React Three Fiber
// visualiser (/visualise) are untouched: the "Existing 3D" tab only links to them.

import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FileCode2,
  Layers,
  Link2,
  Loader2,
  PanelLeft,
  PanelRight,
  ChevronLeft,
  ChevronRight,
  Play,
  RefreshCw,
  Upload,
  X,
  XCircle,
} from 'lucide-react';

import {
  API_BASE,
  artefactUrl,
  exportSeptic,
  fetchGenerators,
  fetchHealth,
  fetchLinks,
  fileToBase64,
  generate,
  reconcile,
  runAnalysis,
} from './cadIfcApi';

// The three viewers pull in large third-party stacks (MLightCAD + three,
// That Open + fragments + web-ifc). Loading them lazily keeps them out of the
// application's initial chunk, so adding this route does not slow down the rest of
// Fundi Studio — the same reason Fundi Pulse mounts MLightCAD lazily.
const CadDxfViewer = lazy(() => import('./CadDxfViewer'));
const IfcBimViewer = lazy(() => import('./IfcBimViewer'));
const ThatOpenBimViewer = lazy(() => import('./ThatOpenBimViewer'));
const AnalysisDiagram2D = lazy(() => import('./AnalysisDiagram2D'));

/** Placeholder while a viewer chunk downloads. */
function ViewerFallback({ label }) {  return (
    <div className="flex w-full h-full items-center justify-center gap-2 text-[12px] text-[#909399]">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>Loading {label}…</span>
    </div>
  );
}

const STATUS_STYLES = {
  ok: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  regenerated: 'bg-sky-900/40 text-sky-300 border-sky-800',
  added: 'bg-sky-900/40 text-sky-300 border-sky-800',
  unchanged: 'bg-neutral-800 text-neutral-300 border-neutral-700',
  deleted: 'bg-rose-900/40 text-rose-300 border-rose-800',
  stale: 'bg-amber-900/40 text-amber-300 border-amber-800',
  conflict: 'bg-rose-900/40 text-rose-200 border-rose-700',
  edited: 'bg-amber-900/40 text-amber-200 border-amber-700',
  unit_mismatch: 'bg-fuchsia-900/40 text-fuchsia-200 border-fuchsia-800',
  duplicate: 'bg-orange-900/40 text-orange-200 border-orange-800',
  new: 'bg-sky-900/40 text-sky-200 border-sky-700',
};

const TABS = [
  { id: 'cad', label: '2D CAD (MLightCAD)' },
  { id: 'bim', label: 'BIM (That Open)' },
  { id: 'ifc', label: 'IFC check (web-ifc)' },
  { id: 'analysis', label: 'Analysis (2D)' },
  { id: 'existing', label: 'Existing 3D (R3F)' },
];

function Badge({ status, children }) {
  const style = STATUS_STYLES[status] || 'bg-neutral-800 text-neutral-300 border-neutral-700';
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] rounded border ${style}`}>
      {children || status}
    </span>
  );
}

/** Number input that keeps a numeric string while typing but reports a number. */
function ParamInput({ item, value, onChange }) {
  if (item.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 py-0.5">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(item.name, event.target.checked)}
          className="accent-[#409eff]"
        />
        <span className="text-[11px] text-[#c8c9cc]">{item.label}</span>
      </label>
    );
  }
  if (item.type === 'string') {
    return (
      <label className="flex flex-col gap-0.5 py-0.5">
        <span className="text-[10px] text-[#909399]">
          {item.label}
          {item.unit && item.unit !== '-' ? ` (${item.unit})` : ''}
        </span>
        <input
          type="text"
          value={value ?? ''}
          onChange={(event) => onChange(item.name, event.target.value)}
          className="px-1.5 py-1 text-[11px] bg-[#141414] border border-[#4c4d4f] rounded text-[#e5eaf3]"
        />
      </label>
    );
  }
  return (
    <label className="flex flex-col gap-0.5 py-0.5">
      <span className="text-[10px] text-[#909399]">
        {item.label}
        {item.unit && item.unit !== '-' ? ` (${item.unit})` : ''}
      </span>
      <input
        type="number"
        step={item.type === 'integer' ? 1 : 'any'}
        value={value ?? ''}
        onChange={(event) =>
          onChange(item.name, event.target.value === '' ? '' : Number(event.target.value))
        }
        className="px-1.5 py-1 text-[11px] bg-[#141414] border border-[#4c4d4f] rounded text-[#e5eaf3]"
      />
    </label>
  );
}

/**
 * The Task E tab: collect the analytical inputs **explicitly** and render the resulting
 * 2D view (deformed shape, reactions, diagrams).
 *
 * Nothing is prefilled with an engineering value: `E`, the load intensity, the support
 * scheme and the subdivision count all start empty/zero, and Run stays disabled until the
 * user supplies them. That mirrors the backend, which rejects incomplete requests rather
 * than assuming a material, restraint or load.
 */
function AnalysisPanel({ report, fallbackGenerator, onStatus }) {
  const [eGpa, setEGpa] = useState('');
  const [udlKnm, setUdlKnm] = useState('');
  const [scheme, setScheme] = useState('pin-roller');
  const [subdivisions, setSubdivisions] = useState(4);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const elementId = report?.ifc?.guids ? Object.keys(report.ifc.guids)[0] : null;
  const ready =
    Boolean(elementId) &&
    Number(eGpa) > 0 &&
    Number(udlKnm) > 0 &&
    !busy;

  const run = async () => {
    setBusy(true);
    setError(null);
    if (onStatus) onStatus({ message: 'Running OpenSees analysis…' });
    try {
      const fixed = scheme === 'fixed-fixed';
      const payload = await runAnalysis({
        generator: fallbackGenerator,
        youngsModulusPa: Number(eGpa) * 1e9,
        supports: [
          { node: `${elementId}#start`, ux: true, uy: true, rz: fixed },
          { node: `${elementId}#end`, ux: false, uy: true, rz: fixed },
        ],
        elementLoads: [{ element: elementId, wy: -Number(udlKnm) * 1000 }],
        subdivisions: Number(subdivisions) || 1,
        caseId: `UDL-${scheme}`,
      });
      setResults(payload.results);
      if (onStatus) {
        onStatus({
          message:
            `Analysis complete (${payload.analytical_model.members} members, ` +
            `residual ${payload.results.cases[0].equilibrium.residualRelative.toExponential(1)})`,
        });
      }
    } catch (runError) {
      setError(runError.message);
      if (onStatus) onStatus({ message: `Analysis failed: ${runError.message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-[#1d1e1f] border-b border-[#4c4d4f] text-[11px] shrink-0">
        <span className="text-[#909399]">Analytical inputs (explicit)</span>
        <label className="flex items-center gap-1">
          <span className="text-[#909399]">E</span>
          <input
            type="number" min="0" step="1" value={eGpa} placeholder="GPa"
            onChange={(event) => setEGpa(event.target.value)}
            className="w-16 px-1 py-0.5 bg-[#141414] border border-[#4c4d4f] rounded"
          />
          <span className="text-[#909399]">GPa</span>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-[#909399]">UDL</span>
          <input
            type="number" min="0" step="0.1" value={udlKnm} placeholder="kN/m"
            onChange={(event) => setUdlKnm(event.target.value)}
            className="w-16 px-1 py-0.5 bg-[#141414] border border-[#4c4d4f] rounded"
          />
          <span className="text-[#909399]">kN/m</span>
        </label>
        <select
          value={scheme}
          onChange={(event) => setScheme(event.target.value)}
          className="px-1 py-0.5 bg-[#141414] border border-[#4c4d4f] rounded"
        >
          <option value="pin-roller">pin + roller</option>
          <option value="fixed-fixed">fixed + fixed</option>
        </select>
        <label className="flex items-center gap-1">
          <span className="text-[#909399]">elements</span>
          <input
            type="number" min="1" max="20" step="1" value={subdivisions}
            onChange={(event) => setSubdivisions(event.target.value)}
            className="w-12 px-1 py-0.5 bg-[#141414] border border-[#4c4d4f] rounded"
          />
        </label>
        <button
          onClick={run}
          disabled={!ready}
          className="px-2 py-0.5 bg-[#409eff] hover:bg-[#66b1ff] disabled:opacity-40 text-white rounded"
        >
          {busy ? 'Running…' : 'Run analysis'}
        </button>
        {!elementId && <span className="text-amber-300">generate a model first</span>}
        {error && <span className="text-rose-300 truncate max-w-[320px]">{error}</span>}
      </div>
      <div className="flex-1 min-h-0">
        <Suspense fallback={<ViewerFallback label="analysis view" />}>
          <AnalysisDiagram2D results={results} onStatus={onStatus} />
        </Suspense>
      </div>
    </div>
  );
}

export default function InteropWorkbench({ isDark = false }) {
  const [tab, setTab] = useState('cad');
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(null);
  const [generators, setGenerators] = useState([]);
  const [generatorKey, setGeneratorKey] = useState('beam');
  const [params, setParams] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [links, setLinks] = useState(null);
  const [focusHandle, setFocusHandle] = useState(null);
  const [focusGuid, setFocusGuid] = useState(null);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [reconcileResult, setReconcileResult] = useState(null);
  const uploadRef = useRef(null);

  const spec = useMemo(
    () => generators.find((entry) => entry.key === generatorKey) || null,
    [generators, generatorKey]
  );

  // --- backend discovery ---------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const healthPayload = await fetchHealth();
        if (!cancelled) setHealth(healthPayload);
        const catalogue = await fetchGenerators();
        if (cancelled) return;
        const list = catalogue.generators || [];
        setGenerators(list);
        const first = list.find((entry) => entry.key === 'beam') || list[0];
        if (first) {
          setGeneratorKey(first.key);
          setParams({ ...first.defaults });
        }
        setHealthError(null);
      } catch (err) {
        if (!cancelled) setHealthError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectGenerator = useCallback((key) => {
    const next = generators.find((entry) => entry.key === key);
    setGeneratorKey(key);
    setParams(next ? { ...next.defaults } : {});
    setReconcileResult(null);
  }, [generators]);

  const resetParams = useCallback(() => {
    if (spec) setParams({ ...spec.defaults });
  }, [spec]);

  const setParam = useCallback((name, value) => {
    setParams((previous) => ({ ...previous, [name]: value }));
  }, []);

  // --- generate -----------------------------------------------------------
  const runGenerate = useCallback(async () => {
    if (!spec) return;
    setBusy(true);
    setError(null);
    setMessage(`Generating ${spec.label}…`);
    setReconcileResult(null);
    try {
      const numericParams = {};
      for (const item of spec.parameters) {
        const value = params[item.name];
        if (value === '' || value === undefined) continue;
        if (item.editable === false) continue;
        numericParams[item.name] = value;
      }
      const report = await generate({ generator: spec.key, params: numericParams });
      setResult(report);
      setMessage(
        `Generated ${report.drawing.drawing_id}: ${report.drawing.entity_count} entities, ` +
          `${report.ifc.element_count} IFC element(s), ${report.mapping.entity_links.link_count} links.`
      );
      try {
        const entityLinks = await fetchLinks(report.model.model_id, report.drawing.drawing_id);
        setLinks(entityLinks);
      } catch (linkError) {
        setLinks(null);
        setMessage((previous) => `${previous} (entity links unavailable: ${linkError.message})`);
      }
      setSelectedElementId(report.ifc?.guids ? Object.keys(report.ifc.guids)[0] : null);
    } catch (err) {
      setError(err.message);
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }, [params, spec]);

  // --- legacy septic demo (kept working) ----------------------------------
  const runSeptic = useCallback(async () => {
    setBusy(true);
    setError(null);
    setMessage('Generating the septic tank model, drawing and IFC…');
    try {
      const report = await exportSeptic({});
      const modelId = report.model.model_id;
      setResult({
        model: { model_id: modelId, element_count: report.model.element_count },
        drawing: {
          drawing_id: `${modelId}-sheet-1`,
          url: `/ifc/${modelId}.dxf`,
          entity_count: report.dxf.replaced_entities + report.dxf.preserved_entities,
          drawing_number: 'SEPTIC-01',
          drawing_title: 'Septic tank and inspection chamber',
        },
        ifc: { url: `/ifc/${modelId}.ifc`, element_count: report.ifc.element_count },
        mapping: { entity_links: { link_count: report.mapping.link_count } },
      });
      setMessage(`Septic pipeline regenerated: ${report.model.element_count} elements.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, []);

  // --- reconcile ----------------------------------------------------------
  const runReconcile = useCallback(
    async (file) => {
      if (!result) return;
      setBusy(true);
      setError(null);
      try {
        const base64 = file ? await fileToBase64(file) : null;
        const report = await reconcile(
          result.model.model_id,
          result.drawing.drawing_id,
          base64
        );
        setReconcileResult(report);
        setMessage(
          report.requires_reconciliation
            ? 'Drift detected — review the reconciliation report below.'
            : 'Drawing matches the mapping: no drift detected.'
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [result]
  );

  const drawingUrl = result?.drawing?.url ? `${artefactUrl(result.drawing.url)}?v=${encodeURIComponent(result.drawing.drawing_id)}` : null;
  const ifcUrl = result?.ifc?.url ? `${artefactUrl(result.ifc.url)}?v=${encodeURIComponent(result.model.model_id)}` : null;

  const elements = useMemo(() => {
    if (!result?.model) return [];
    const list = result.model.elements || [];
    if (list.length) return list;
    // /generate returns statistics rather than every element; the preview from
    // /generators carries the element list.
    return spec?.canonical_preview?.elements || [];
  }, [result, spec]);

  const elementRows = useMemo(() => {
    const guids = result?.ifc?.guids || {};
    const entityLinks = links?.elements || {};
    return elements.map((element) => ({
      id: element.id,
      name: element.name || element.role || element.id,
      ifcClass: element.ifc_class,
      guid: guids[element.id] || null,
      handles: (entityLinks[element.id] || []).map((link) => link.handle),
      warnings: element.validation?.warnings || element.warnings || [],
    }));
  }, [elements, result, links]);

  const focusElement = useCallback((row) => {
    setSelectedElementId(row.id);
    if (row.handles?.length) setFocusHandle(row.handles[0]);
    if (row.guid) setFocusGuid(row.guid);
  }, []);

  const [showLeftSidebar, setShowLeftSidebar] = useState(
    typeof window !== 'undefined' ? window.innerWidth > 900 : true
  );
  const [showRightSidebar, setShowRightSidebar] = useState(
    typeof window !== 'undefined' ? window.innerWidth > 1100 : true
  );

  return (
    <div className="flex flex-col w-full h-full bg-[#181818] text-[#e5eaf3] overflow-hidden">
      {/* ---- header ------------------------------------------------------ */}
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#1d1e1f] border-b border-[#4c4d4f] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-[#409eff]" />
          <h1 className="text-[13px] font-medium">CAD · BIM · IFC workbench</h1>
          <span className="text-[10px] text-[#909399]">
            generators → canonical model → DXF + IFC → mapping
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#141414] p-0.5 rounded border border-[#333]">
            <button
              onClick={() => setShowLeftSidebar((v) => !v)}
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded transition-colors ${
                showLeftSidebar
                  ? 'bg-[#409eff] text-white font-medium'
                  : 'text-[#909399] hover:text-[#e5eaf3]'
              }`}
              title={showLeftSidebar ? 'Hide Generator panel' : 'Show Generator panel'}
            >
              <PanelLeft className="w-3 h-3" />
              <span>Generators</span>
            </button>
            <button
              onClick={() => setShowRightSidebar((v) => !v)}
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded transition-colors ${
                showRightSidebar
                  ? 'bg-[#409eff] text-white font-medium'
                  : 'text-[#909399] hover:text-[#e5eaf3]'
              }`}
              title={showRightSidebar ? 'Hide Elements panel' : 'Show Elements panel'}
            >
              <PanelRight className="w-3 h-3" />
              <span>Elements</span>
            </button>
          </div>
          {health && (
            <span className="flex items-center gap-1 text-[10px] text-[#909399]">
              <Database className="w-3 h-3" />
              IfcOpenShell {health.ifcopenshell?.available ? 'ok' : 'missing'}
              {health.ifcopenshell?.available ? ` · ${health.ifcopenshell.schema}` : ''}
              {` · ezdxf ${health.ezdxf?.version || '?'}`}
            </span>
          )}
          <a
            href="/visualise"
            className="flex items-center gap-1 px-2 py-1 text-[11px] bg-[#262727] hover:bg-[#303030] border border-[#4c4d4f] rounded"
            title="The existing React Three Fiber route, unchanged"
          >
            <ExternalLink className="w-3 h-3" />
            <span>/visualise</span>
          </a>
        </div>
      </header>

      {healthError && (
        <div className="px-3 py-2 bg-rose-950/60 border-b border-rose-800 text-[11px] text-rose-200 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{healthError}</span>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* ---- generator panel ------------------------------------------- */}
        {showLeftSidebar && (
          <aside className="w-[290px] max-w-[85vw] shrink-0 border-r border-[#4c4d4f] bg-[#1a1b1c] overflow-y-auto">
            <div className="px-3 py-2 border-b border-[#4c4d4f] flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wide text-[#909399]">
                Engineering generator
              </div>
              <button
                onClick={() => setShowLeftSidebar(false)}
                className="text-[#909399] hover:text-[#e5eaf3] p-0.5 rounded"
                title="Hide generator panel"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            <select
              value={generatorKey}
              onChange={(event) => selectGenerator(event.target.value)}
              className="mt-1 w-full px-2 py-1 text-[11px] bg-[#141414] border border-[#4c4d4f] rounded text-[#e5eaf3]"
            >
              {generators.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.label}
                </option>
              ))}
              {!generators.length && <option value="beam">beam (backend offline)</option>}
            </select>
            {spec && (
              <p className="mt-1 text-[10px] text-[#909399] leading-snug">{spec.description}</p>
            )}
            {spec && (
              <div className="mt-1 flex items-center gap-1 text-[10px] text-[#909399]">
                <FileCode2 className="w-3 h-3" />
                <span>
                  {spec.drawing_number} · {spec.scale} · views {spec.views.join(', ')}
                </span>
              </div>
            )}
          </div>

          {spec && (
            <div className="px-3 py-2 border-b border-[#4c4d4f]">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-wide text-[#909399]">
                  Parameters ({spec.parameters.filter((p) => p.editable !== false).length})
                </div>
                <button
                  onClick={resetParams}
                  className="text-[10px] text-[#409eff] hover:underline"
                >
                  reset
                </button>
              </div>
              <div className="mt-1 max-h-[46vh] overflow-y-auto pr-1">
                {spec.parameters.map((item) => (
                  <ParamInput
                    key={item.name}
                    item={item}
                    value={params[item.name]}
                    onChange={setParam}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="px-3 py-2 space-y-1.5">
            <button
              onClick={runGenerate}
              disabled={busy || !spec}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium bg-[#409eff] hover:bg-[#66b1ff] disabled:opacity-50 text-white rounded"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>Generate DXF + IFC</span>
            </button>
            <button
              onClick={runSeptic}
              disabled={busy}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1 text-[10px] bg-[#262727] hover:bg-[#303030] disabled:opacity-50 border border-[#4c4d4f] rounded"
              title="The earlier septic-tank pipeline, kept working"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Regenerate septic demo</span>
            </button>
          </div>

          {result && (
            <div className="px-3 py-2 border-t border-[#4c4d4f] text-[10px] text-[#909399] space-y-1">
              <div className="uppercase tracking-wide">Current artefacts</div>
              <div>drawing: {result.drawing?.drawing_id}</div>
              <div>model: {result.model?.model_id}</div>
              <div>links: {result.mapping?.entity_links?.link_count ?? 0}</div>
              {result.ifc?.classes?.length ? (
                <div>ifc: {result.ifc.classes.join(', ')}</div>
              ) : null}
              {result.model?.elements_with_warnings > 0 && (
                <div className="text-amber-300">
                  {result.model.elements_with_warnings} element(s) carry modelling warnings
                </div>
              )}
              <div className="flex flex-wrap gap-1 pt-1">
                {result.drawing?.url && (
                  <a
                    href={artefactUrl(result.drawing.url)}
                    download
                    className="flex items-center gap-1 px-1.5 py-0.5 bg-[#262727] border border-[#4c4d4f] rounded hover:bg-[#303030]"
                  >
                    <Download className="w-3 h-3" /> DXF
                  </a>
                )}
                {result.ifc?.url && (
                  <a
                    href={artefactUrl(result.ifc.url)}
                    download
                    className="flex items-center gap-1 px-1.5 py-0.5 bg-[#262727] border border-[#4c4d4f] rounded hover:bg-[#303030]"
                  >
                    <Download className="w-3 h-3" /> IFC
                  </a>
                )}
              </div>
            </div>
          )}
        </aside>
        )}

        {/* ---- viewers --------------------------------------------------- */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex items-center gap-1 px-2 py-1 bg-[#1d1e1f] border-b border-[#4c4d4f] shrink-0">
            {TABS.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setTab(entry.id)}
                className={`px-2.5 py-1 text-[11px] rounded ${
                  tab === entry.id
                    ? 'bg-[#409eff] text-white'
                    : 'bg-[#262727] hover:bg-[#303030] border border-[#4c4d4f]'
                }`}
              >
                {entry.label}
              </button>
            ))}
            <div className="flex-1" />
            {result?.drawing?.drawing_number && (
              <span className="text-[10px] text-[#909399]">
                {result.drawing.drawing_number} · {result.drawing.drawing_title}
              </span>
            )}
          </div>

          <div className="flex-1 min-h-0">
            {tab === 'cad' && (
              <Suspense fallback={<ViewerFallback label="MLightCAD" />}>
                <CadDxfViewer
                  dxfUrl={drawingUrl}
                  focusHandle={focusHandle}
                  onStatus={({ message: statusMessage }) => setMessage(statusMessage)}
                  onLoaded={(info) =>
                    setMessage(
                      `MLightCAD parsed ${info.fileName}: ${info.entityCount} entities, ` +
                        `${info.layers.length} layers in ${info.durationMs} ms`
                    )
                  }
                />
              </Suspense>
            )}
            {tab === 'bim' && (
              <Suspense fallback={<ViewerFallback label="That Open Components" />}>
                <ThatOpenBimViewer
                  ifcUrl={ifcUrl}
                  elements={elements}
                  focusGuid={focusGuid}
                  onStatus={({ message: statusMessage }) => setMessage(statusMessage)}
                  onSelect={(selection) => {
                    if (selection?.element) setSelectedElementId(selection.element.id);
                  }}
                />
              </Suspense>
            )}
            {tab === 'ifc' && (
              <Suspense fallback={<ViewerFallback label="web-ifc" />}>
                <IfcBimViewer
                  ifcUrl={ifcUrl}
                  onStatus={({ message: statusMessage }) => setMessage(statusMessage)}
                />
              </Suspense>
            )}
            {tab === 'analysis' && (
              <AnalysisPanel
                report={result}
                fallbackGenerator={spec?.key}
                onStatus={({ message: statusMessage }) => setMessage(statusMessage)}
              />
            )}
            {tab === 'existing' && (
              <div className="p-4 text-[12px] text-[#c8c9cc] space-y-2">
                <p>
                  The application&apos;s original three-dimensional workflow is a separate
                  React Three Fiber route and has not been modified, replaced or wrapped by
                  this workbench.
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[11px] text-[#909399]">
                  <li>
                    <a className="text-[#409eff] hover:underline" href="/visualise">
                      /visualise
                    </a>{' '}
                    — the R3F visualiser with its generator registry (QS and RC scenes)
                  </li>
                  <li>
                    <a className="text-[#409eff] hover:underline" href="/drawing">
                      /drawing
                    </a>{' '}
                    — the existing React Konva 2D authoring page
                  </li>
                </ul>
                <p className="text-[11px] text-[#909399]">
                  The BIM viewer above runs in its own container with its own renderer, so
                  the two stacks never share a canvas. They share only the canonical
                  engineering model and the identity mapping.
                </p>
              </div>
            )}
          </div>
        </main>

        {/* ---- identity / mapping panel ---------------------------------- */}
        {showRightSidebar && (
          <aside className="w-[320px] max-w-[85vw] shrink-0 border-l border-[#4c4d4f] bg-[#1a1b1c] overflow-y-auto">
            <div className="px-3 py-2 border-b border-[#4c4d4f] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-[#409eff]" />
                <span className="text-[10px] uppercase tracking-wide text-[#909399]">
                  Canonical elements
                </span>
              </div>
              <button
                onClick={() => setShowRightSidebar(false)}
                className="text-[#909399] hover:text-[#e5eaf3] p-0.5 rounded"
                title="Hide elements panel"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {!elementRows.length && (
              <p className="mt-1 text-[11px] text-[#909399]">
                Generate a drawing to populate the engineering model.
              </p>
            )}
            <ul className="mt-1 space-y-1">
              {elementRows.map((row) => (
                <li key={row.id}>
                  <button
                    onClick={() => focusElement(row)}
                    className={`w-full text-left px-2 py-1 rounded border ${
                      selectedElementId === row.id
                        ? 'border-[#409eff] bg-[#1f2b3a]'
                        : 'border-[#333] bg-[#202122] hover:bg-[#262727]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] truncate">{row.name}</span>
                      <Badge status={row.ifcClass ? 'ok' : 'stale'}>
                        {row.ifcClass || 'unmapped'}
                      </Badge>
                    </div>
                    <div className="text-[9px] text-[#909399] break-all">{row.id}</div>
                    <div className="text-[9px] text-[#909399] break-all">
                      guid {row.guid || '—'}
                    </div>
                    <div className="text-[9px] text-[#909399]">
                      {row.handles.length} CAD entit{row.handles.length === 1 ? 'y' : 'ies'}
                      {row.handles.length ? `: ${row.handles.slice(0, 4).join(', ')}` : ''}
                      {row.handles.length > 4 ? '…' : ''}
                    </div>
                    {row.warnings.length > 0 && (
                      <div className="mt-0.5 flex items-start gap-1 text-[9px] text-amber-300">
                        <AlertTriangle className="w-2.5 h-2.5 mt-0.5 shrink-0" />
                        <span>{row.warnings[0]}</span>
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="px-3 py-2 border-b border-[#4c4d4f]">
            <div className="text-[10px] uppercase tracking-wide text-[#909399]">
              Reconcile CAD edits
            </div>
            <p className="mt-1 text-[10px] text-[#909399]">
              Export the edited DXF from the CAD tab, then upload it here. Only differences
              are reported; the engineering model is never changed automatically.
            </p>
            <div className="mt-1 flex gap-1">
              <button
                onClick={() => uploadRef.current?.click()}
                disabled={busy || !result}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] bg-[#262727] hover:bg-[#303030] disabled:opacity-50 border border-[#4c4d4f] rounded"
              >
                <Upload className="w-3 h-3" /> Upload edited DXF
              </button>
              <input
                ref={uploadRef}
                type="file"
                accept=".dxf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) runReconcile(file);
                }}
              />
              <button
                onClick={() => runReconcile(null)}
                disabled={busy || !result}
                className="px-2 py-1 text-[10px] bg-[#262727] hover:bg-[#303030] disabled:opacity-50 border border-[#4c4d4f] rounded"
                title="Re-read the drawing currently in the store"
              >
                Re-scan
              </button>
            </div>
            {reconcileResult && (
              <div className="mt-2 text-[10px] space-y-1">
                <div className="flex items-center gap-1 font-medium">
                  {reconcileResult.requires_reconciliation ? (
                    <>
                      <XCircle className="w-3 h-3 text-amber-400" />
                      <span className="text-amber-300">Drift detected</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-300">No drift</span>
                    </>
                  )}
                  {reconcileResult.drawing?.uploaded && (
                    <Badge status="new">uploaded</Badge>
                  )}
                </div>
                <ul className="space-y-0.5">
                  {Object.entries(reconcileResult.summary || {}).map(([key, value]) => (
                    <li key={key} className="flex justify-between gap-2">
                      <span className="text-[#909399]">{key}</span>
                      <span>{value}</span>
                    </li>
                  ))}
                </ul>
                {reconcileResult.missing?.length > 0 && (
                  <div>
                    <div className="text-rose-300">missing entities</div>
                    <div className="text-[#909399] break-all">
                      {reconcileResult.missing
                        .slice(0, 6)
                        .map((item) => `${item.handle} (${item.internal_id})`)
                        .join(', ')}
                    </div>
                  </div>
                )}
                {reconcileResult.rehandled?.length > 0 && (
                  <div>
                    <div className="text-sky-300">re-handled (identity kept)</div>
                    <div className="text-[#909399] break-all">
                      {reconcileResult.rehandled
                        .slice(0, 6)
                        .map((item) => `${item.old_handle}→${item.new_handle}`)
                        .join(', ')}
                    </div>
                  </div>
                )}
                {reconcileResult.edited?.length > 0 && (
                  <div>
                    <div className="text-amber-300">edited geometry</div>
                    <div className="text-[#909399] break-all">
                      {reconcileResult.edited.slice(0, 6).map((item) => item.handle).join(', ')}
                    </div>
                  </div>
                )}
                {reconcileResult.unmapped_entities?.length > 0 && (
                  <div>
                    <div className="text-[#909399]">
                      unmapped entities (not guessed): {reconcileResult.unmapped_entities.length}
                    </div>
                  </div>
                )}
                {reconcileResult.unknown_element_ids?.length > 0 && (
                  <div>
                    <div className="text-rose-300">unknown element ids</div>
                    <div className="text-[#909399] break-all">
                      {reconcileResult.unknown_element_ids.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-3 py-2 text-[10px] text-[#909399]">
            <div className="uppercase tracking-wide">Backend</div>
            <div className="break-all">{API_BASE}/api/cad-ifc</div>
            {result?.validation && (
              <div className="mt-1 space-y-0.5">
                <div>
                  canonical schema:{' '}
                  {result.validation.canonical?.ok ? (
                    <span className="text-emerald-400">valid</span>
                  ) : (
                    <span className="text-rose-400">invalid</span>
                  )}
                </div>
                <div>
                  IfcOpenShell validator:{' '}
                  {result.validation.ifc_schema?.ok ? (
                    <span className="text-emerald-400">0 statements</span>
                  ) : (
                    <span className="text-rose-400">
                      {result.validation.ifc_schema?.statement_count} statements
                    </span>
                  )}
                </div>
                <div>
                  DXF units:{' '}
                  {result.validation.dxf_units?.ok ? (
                    <span className="text-emerald-400">mm ($INSUNITS=4)</span>
                  ) : (
                    <span className="text-rose-400">mismatch</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>
        )}
      </div>

      {/* ---- status bar --------------------------------------------------- */}
      <footer className="px-3 py-1 bg-[#1d1e1f] border-t border-[#4c4d4f] text-[10px] shrink-0">
        {error ? (
          <span className="flex items-start gap-1 text-rose-300">
            <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
            <span>{error}</span>
          </span>
        ) : (
          <span className="text-[#909399] truncate block">{message || 'Ready.'}</span>
        )}
      </footer>
    </div>
  );
}
