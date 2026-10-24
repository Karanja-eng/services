// src/components/interop/InteropWorkbench.jsx
//
// The unified CAD / BIM / IFC / structural workbench of Fundi Studio.
//
// One workspace, one model, several engines
// -----------------------------------------
// The views are capabilities of the same engineering model, not separate apps:
//
//   2D CAD          MLightCAD editor            (drawing authoring, DXF in/out)
//   BIM / IFC       That Open Components        (IFC inspection, GlobalIds)
//   Structure 3D    React Three Fiber           (canonical model + solver results)
//   Analysis        OpenSees via the backend    (2D run + diagram view)
//   IFC check       web-ifc + three.js          (independent parse check)
//   Tall builder    Framed & Tall builder       (existing R3F workflow, unchanged)
//
// Shared state (see src/state/engineeringModel):
//   model revision, selection, visibility, unsaved changes, analysis results and
//   their staleness. Switching views preserves the building, the selected member,
//   the active load case and unsaved edits.
//
// Responsive contract
// -------------------
// * Desktop (>=1024 px): collapsible project panel, resizable viewport, properties
//   panel, resizable diagnostics panel.
// * Phone (360–430 px): compact header with a *view selector* instead of a row of
//   tabs, a full-bleed viewport, panels as drawers/bottom sheet, 44 px targets and
//   no horizontal page overflow.
//
// The workbench never fabricates engineering data: every number displayed comes
// from the backend generator, the canonical model or the solver result document.

import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Activity,
  AlertTriangle,
  Box,
  Building2,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  FileSearch,
  Layers,
  Link2,
  Loader2,
  PanelLeft,
  PanelRight,
  PencilRuler,
  Play,
  RefreshCw,
  Save,
  Upload,
  X,
  XCircle,
} from 'lucide-react';

import {
  API_BASE,
  API_SOURCE,
  API_SOURCE_DETAIL,
  CAD_IFC_API_ROOT,
  artefactUrl,
  exportSeptic,
  fetchGenerators,
  fetchLinks,
  fetchModel,
  fileToBase64,
  generate,
  probeBackend,
  reconcile,
  runAnalysis,
} from './cadIfcApi';
import {
  EngineeringModelProvider,
  useEngineeringModel,
} from '../../state/engineeringModel/EngineeringModelContext';
import { analysisStatus } from '../../state/engineeringModel/core';
import { useIsPhone } from '../../hooks/useMediaQuery';
import { action, control, surface, text } from '../shared/ui/tokens';

/* ----------------------------------------------------------------- lazy views */

const CadDxfViewer = lazy(() => import('./CadDxfViewer'));
const IfcBimViewer = lazy(() => import('./IfcBimViewer'));
const ThatOpenBimViewer = lazy(() => import('./ThatOpenBimViewer'));
const AnalysisDiagram2D = lazy(() => import('./AnalysisDiagram2D'));
const Structure3DView = lazy(() => import('./Structure3DView'));
// The existing Framed & Tall structure builder, unchanged. It owns its own R3F
// scene, toolbar and member editing; the workbench only provides a host frame.
const InteractiveStructureBuilder = lazy(() =>
  import('../ReinforcedConcrete/FramedandTall/InteractiveStructureBuilder')
);

/* ------------------------------------------------------------------- constants */

const VIEWS = [
  { id: 'cad', label: '2D CAD', title: '2D CAD editor (MLightCAD)', icon: PencilRuler },
  { id: 'bim', label: 'BIM / IFC', title: 'BIM viewer (That Open)', icon: Box },
  { id: 'structure', label: 'Structure 3D', title: 'Structure and results (R3F)', icon: Layers },
  { id: 'analysis', label: 'Analysis', title: 'Structural analysis (OpenSees)', icon: Activity },
  { id: 'ifc', label: 'IFC check', title: 'IFC parse check (web-ifc)', icon: FileSearch },
  { id: 'builder', label: 'Tall builder', title: 'Framed & Tall Buildings builder', icon: Building2 },
];

/** Views kept mounted once visited, so switching does not reload an engine. */
const KEEP_ALIVE = new Set(['cad', 'bim']);

const STATUS_TONE = {
  ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  stale: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
  error: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  idle: 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300',
};

function Badge({ tone = 'idle', children, title }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_TONE[tone] || STATUS_TONE.idle}`}
    >
      {children}
    </span>
  );
}

function ViewerFallback({ label }) {
  return (
    <div className="flex h-full w-full items-center justify-center gap-2 bg-[#141414] text-[12px] text-[#909399]">
      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      <span>Loading {label}…</span>
    </div>
  );
}

/* --------------------------------------------------------------- split handle */

/**
 * Drag/keyboard splitter. `orientation` is the divider's own axis:
 * "vertical" resizes horizontally (side panels), "horizontal" resizes vertically
 * (the diagnostics panel).
 */
function SplitHandle({ orientation, onDelta, label }) {
  const dragging = useRef(null);

  const handlePointerDown = (event) => {
    event.preventDefault();
    dragging.current = { start: orientation === 'vertical' ? event.clientX : event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragging.current) return;
    const current = orientation === 'vertical' ? event.clientX : event.clientY;
    const delta = current - dragging.current.start;
    if (delta !== 0) {
      dragging.current.start = current;
      onDelta(delta);
    }
  };

  const end = (event) => {
    dragging.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const onKeyDown = (event) => {
    const decrease = orientation === 'vertical' ? 'ArrowLeft' : 'ArrowUp';
    const increase = orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown';
    if (event.key === decrease) {
      event.preventDefault();
      onDelta(-16);
    } else if (event.key === increase) {
      event.preventDefault();
      onDelta(16);
    }
  };

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onDelta(0, true)}
      className={`hidden shrink-0 touch-none bg-transparent transition-colors hover:bg-blue-500/40 focus-visible:bg-blue-500/60 focus-visible:outline-none lg:block ${
        orientation === 'vertical' ? 'w-1.5 cursor-col-resize' : 'h-1.5 w-full cursor-row-resize'
      }`}
    />
  );
}

/* ------------------------------------------------------------- drawer (mobile) */

function Drawer({ open, onClose, side = 'left', title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div
        className={`absolute top-0 flex h-full w-[86vw] max-w-sm flex-col border-gray-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 ${
          side === 'left' ? 'left-0 border-r' : 'right-0 border-l'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-slate-800">
          <h2 className="truncate text-sm font-bold text-gray-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ parameters */

/** Number/boolean/text input that keeps the raw string while typing. */
function ParamInput({ item, value, onChange }) {
  if (item.type === 'boolean') {
    return (
      <label className="flex min-h-[40px] items-center gap-2 py-0.5">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(item.name, event.target.checked)}
          className="h-4 w-4 accent-blue-600"
        />
        <span className={`text-xs ${text.label}`}>{item.label}</span>
      </label>
    );
  }
  const unit = item.unit && item.unit !== '-' ? item.unit : null;
  return (
    <label className="block py-0.5">
      <span className={`flex items-baseline justify-between gap-1 text-[11px] ${text.helper}`}>
        <span className="truncate">{item.label}</span>
        {unit && <span className="font-mono text-[10px]">{unit}</span>}
      </span>
      <input
        type={item.type === 'string' ? 'text' : 'number'}
        step={item.type === 'integer' ? 1 : 'any'}
        inputMode={item.type === 'string' ? undefined : 'decimal'}
        value={value ?? ''}
        onChange={(event) =>
          onChange(
            item.name,
            item.type === 'string'
              ? event.target.value
              : event.target.value === ''
                ? ''
                : Number(event.target.value)
          )
        }
        className={`${control.base} mt-0.5 py-1 text-xs`}
      />
    </label>
  );
}

/* ------------------------------------------------- element property editing */

/**
 * Geometry editor for the selected canonical element.
 *
 * This is the member-property edit path of the workspace: it writes through
 * `editElement` (core `editElementGeometry`), which validates first, bumps the
 * revision on success, moves the derived member nodes, and therefore makes any
 * attached solver results stale. A rejected edit shows the exact validation error
 * and leaves the model untouched.
 *
 * It does not regenerate the DXF/IFC: those artefacts then describe an older
 * revision, which the header reports as out of date instead of pretending the
 * files were updated.
 */
function ElementGeometryEditor({ element }) {
  const { editElement } = useEngineeringModel();
  const [dimensions, setDimensions] = useState(() =>
    Object.fromEntries(
      Object.entries(element.dimensions || {}).map(([key, value]) => [key, String(value)])
    )
  );
  const [placement, setPlacement] = useState(() => ({
    x: String(element.placement?.x ?? 0),
    y: String(element.placement?.y ?? 0),
    z: String(element.placement?.z ?? 0),
  }));
  const [rotation, setRotation] = useState(String(element.rotationZdeg ?? 0));
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const dimensionKeys = Object.keys(element.dimensions || {});
  const canEdit = dimensionKeys.length > 0 || Boolean(element.placement);

  const apply = () => {
    setError(null);
    setNotice(null);
    const patch = {};
    if (dimensionKeys.length) {
      patch.dimensions = Object.fromEntries(
        Object.entries(dimensions).map(([key, value]) => [key, Number(value)])
      );
    }
    if (element.placement) {
      patch.placement = {
        x: Number(placement.x),
        y: Number(placement.y),
        z: Number(placement.z),
      };
    }
    patch.rotationZdeg = Number(rotation);

    const outcome = editElement(element.id, patch);
    if (!outcome.ok) {
      setError((outcome.report.errors || ['the edit was rejected']).join('; '));
      return;
    }
    setNotice(
      `Accepted as revision ${outcome.model.revision.index}: the 3D view is updated, ` +
        'analysis results are now stale, and the DXF/IFC artefacts are older than this revision.'
    );
  };

  const revert = () => {
    setDimensions(
      Object.fromEntries(
        Object.entries(element.dimensions || {}).map(([key, value]) => [key, String(value)])
      )
    );
    setPlacement({
      x: String(element.placement?.x ?? 0),
      y: String(element.placement?.y ?? 0),
      z: String(element.placement?.z ?? 0),
    });
    setRotation(String(element.rotationZdeg ?? 0));
    setError(null);
    setNotice(null);
  };

  if (!canEdit) {
    return (
      <p className="mt-1 text-amber-700 dark:text-amber-300">
        This element carries no editable geometry in the canonical model.
      </p>
    );
  }

  const inputClass =
    'mt-0.5 w-full min-h-[32px] rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] ' +
    'text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ' +
    'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

  return (
    <div className="mt-2 border-t border-gray-200 pt-1.5 dark:border-slate-800">
      <div className="font-bold uppercase tracking-wider">Edit geometry (m)</div>

      {dimensionKeys.length > 0 && (
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {dimensionKeys.map((key) => (
            <label key={key} className="block">
              <span className="text-[10px]">{key}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={dimensions[key] ?? ''}
                onChange={(event) =>
                  setDimensions((previous) => ({ ...previous, [key]: event.target.value }))
                }
                className={inputClass}
              />
            </label>
          ))}
        </div>
      )}

      {element.placement && (
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          {['x', 'y', 'z'].map((axis) => (
            <label key={axis} className="block">
              <span className="text-[10px]">centre {axis}</span>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={placement[axis]}
                onChange={(event) =>
                  setPlacement((previous) => ({ ...previous, [axis]: event.target.value }))
                }
                className={inputClass}
              />
            </label>
          ))}
        </div>
      )}

      <label className="mt-1 block">
        <span className="text-[10px]">rotation about Z (deg)</span>
        <input
          type="number"
          step="1"
          inputMode="decimal"
          value={rotation}
          onChange={(event) => setRotation(event.target.value)}
          className={inputClass}
        />
      </label>

      <div className="mt-1.5 flex gap-1">
        <button type="button" onClick={apply} className={`${action.base} ${action.primary} flex-1 py-1 text-[10px]`}>
          Apply edit
        </button>
        <button type="button" onClick={revert} className={`${action.base} ${action.secondary} px-2 py-1 text-[10px]`}>
          Revert
        </button>
      </div>

      {error && <p className="mt-1 text-rose-700 dark:text-rose-300">Rejected: {error}</p>}
      {notice && <p className="mt-1 text-emerald-700 dark:text-emerald-300">{notice}</p>}
    </div>
  );
}

/* ------------------------------------------------------------- analysis panel */

/**
 * Analytical inputs are explicit. Nothing is prefilled with an engineering value:
 * E, the load intensity, the support scheme and the subdivision count are user
 * inputs because the canonical model does not carry them, and inventing them would
 * produce results that look verified but are not.
 *
 * Support references: `analysis.canonical_to_analysis()` accepts both the
 * `#start` / `#end` aliases and the explicit subdivision node ids
 * (`<element>#n0 … <element>#nN`). This panel uses the explicit ids because they
 * are exactly the `canonicalId`s that appear in the returned result document, so
 * the UI → solver mapping is visible rather than implied. Both forms were executed
 * against the running backend and produce identical results (see the journal).
 *
 * The panel also attaches the result to the shared canonical model revision
 * (`recordAnalysis`), which is what makes stale results detectable.
 */
function AnalysisPanel({ model, element, onResult, onStatus, analysisStatus }) {
  const [eGpa, setEGpa] = useState('');
  const [udlKnm, setUdlKnm] = useState('');
  const [scheme, setScheme] = useState('pin-roller');
  const [subdivisions, setSubdivisions] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [engine, setEngine] = useState(null);

  const elementId = element?.id || null;
  const subdivisionsNumber = Math.max(1, Number(subdivisions) || 1);
  const ready =
    Boolean(elementId) && Number(eGpa) > 0 && Number(udlKnm) > 0 && !busy;

  useEffect(() => {
    let cancelled = false;
    // The solver runs in a separate Python process; whether it exists is a fact the
    // backend reports, and it is shown rather than assumed.
    import('./cadIfcApi').then(({ fetchAnalysisEngine }) =>
      fetchAnalysisEngine()
        .then((payload) => {
          if (!cancelled) setEngine(payload);
        })
        .catch(() => {
          if (!cancelled) setEngine({ available: false });
        })
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const run = async () => {
    setBusy(true);
    setError(null);
    if (onStatus) onStatus({ message: 'Running the OpenSees analysis…' });
    try {
      const fixed = scheme === 'fixed-fixed';
      const supports = [
        { node: `${elementId}#n0`, ux: true, uy: true, rz: fixed },
        { node: `${elementId}#n${subdivisionsNumber}`, ux: false, uy: true, rz: fixed },
      ];
      const payload = await runAnalysis({
        generator: model?.generator || undefined,
        modelId: model?.modelId,
        youngsModulusPa: Number(eGpa) * 1e9,
        supports,
        elementLoads: [{ element: elementId, wy: -Number(udlKnm) * 1000 }],
        subdivisions: subdivisionsNumber,
        caseId: `UDL-${scheme}`,
      });
      if (onResult) onResult(payload);
      if (onStatus) {
        const residual = payload?.results?.cases?.[0]?.equilibrium?.residualRelative;
        onStatus({
          message:
            `Analysis complete — ${payload.analytical_model.members} elements, ` +
            `case ${payload.case_id}` +
            (Number.isFinite(residual) ? `, relative residual ${residual.toExponential(1)}` : ''),
        });
      }
    } catch (runError) {
      setError(runError.message);
      if (onStatus) onStatus({ message: `Analysis failed: ${runError.message}` });
    } finally {
      setBusy(false);
    }
  };

  const results = model?.analysis?.results || null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#141414]">
      <div className="shrink-0 border-b border-[#4c4d4f] bg-[#1d1e1f] px-2 py-1.5">
        <div className="flex flex-wrap items-end gap-2 text-[11px] text-[#c8c9cc]">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[#909399]">E (GPa)</span>
            <input
              type="number"
              min="0"
              step="1"
              value={eGpa}
              onChange={(event) => setEGpa(event.target.value)}
              placeholder="required"
              className="min-h-[36px] w-24 rounded border border-[#4c4d4f] bg-[#141414] px-1.5 text-[11px]"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[#909399]">UDL (kN/m)</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={udlKnm}
              onChange={(event) => setUdlKnm(event.target.value)}
              placeholder="required"
              className="min-h-[36px] w-24 rounded border border-[#4c4d4f] bg-[#141414] px-1.5 text-[11px]"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[#909399]">supports</span>
            <select
              value={scheme}
              onChange={(event) => setScheme(event.target.value)}
              className="min-h-[36px] rounded border border-[#4c4d4f] bg-[#141414] px-1.5 text-[11px]"
            >
              <option value="pin-roller">pin + roller</option>
              <option value="fixed-fixed">fixed + fixed</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[#909399]">elements</span>
            <input
              type="number"
              min="1"
              max="20"
              step="1"
              value={subdivisions}
              onChange={(event) => setSubdivisions(event.target.value)}
              className="min-h-[36px] w-16 rounded border border-[#4c4d4f] bg-[#141414] px-1.5 text-[11px]"
            />
          </label>
          <button
            type="button"
            onClick={run}
            disabled={!ready}
            className="inline-flex min-h-[36px] items-center gap-1 rounded bg-[#409eff] px-3 text-[11px] font-medium text-white hover:bg-[#66b1ff] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {busy ? 'Running…' : 'Run analysis'}
          </button>
          <div className="flex-1" />
          <span className="text-[10px] text-[#909399]">
            engine:{' '}
            {engine === null
              ? 'checking…'
              : engine.available
                ? 'OpenSees available'
                : 'OpenSees not available'}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[#909399]">
          <span>element: {elementId || 'none generated'}</span>
          <span>model: {model?.modelId || '—'}</span>
          <span>rev: {model?.revision?.index ?? '—'}</span>
          {analysisStatus?.state === 'stale' && (
            <span className="text-amber-300">results are stale — {analysisStatus.reason}</span>
          )}
          {error && <span className="text-rose-300">{error}</span>}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <Suspense fallback={<ViewerFallback label="analysis view" />}>
          <AnalysisDiagram2D results={results} onStatus={onStatus} height="100%" />
        </Suspense>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- workbench */

function Workbench({ isDark = false }) {
  const {
    model,
    selection,
    select,
    clearSelection,
    loadFromCanonicalDocument,
    recordAnalysis,
    registerIdentity,
    save,
    dirty,
    revision,
    validation,
    readiness,
    analysisStatus,
    conflict,
    dismissConflict,
    setVisibility,
  } = useEngineeringModel();

  const isPhone = useIsPhone();

  const [view, setView] = useState('cad');
  const [visited, setVisited] = useState(() => new Set(['cad']));
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
  // `{ handle, nonce }` rather than a bare handle so that selecting the *same*
  // element twice still re-issues the focus request to the CAD viewport.
  const [focusRequest, setFocusRequest] = useState(null);
  const [reconcileResult, setReconcileResult] = useState(null);
  const [engineInfo, setEngineInfo] = useState(null);
  // The model revision the current DXF/IFC artefacts were generated from. When the
  // model is edited afterwards the artefacts are older than the model, which is
  // reported instead of silently pretending the files changed.
  const [artefactRevision, setArtefactRevision] = useState(null);
  // Which model the artefacts belong to. A builder-published model replaces the
  // generated one, so the 'artefacts are older' badge must not carry across models.
  const [artefactModelId, setArtefactModelId] = useState(null);

  // Stable handler identities: the viewers register DOM listeners in effects that
  // depend on `onStatus`, so a new function on every parent render would re-bind
  // them continuously.
  const handleStatus = useCallback(({ message: statusMessage }) => {
    if (statusMessage) setMessage(statusMessage);
  }, []);
  const handleLoaded = useCallback((info) => {
    setMessage(
      `MLightCAD opened ${info.fileName}: ${info.entityCount} entities, ` +
        `${info.layers.length} layers in ${info.durationMs} ms`
    );
  }, []);

  // Panels
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(320);
  const [diagnosticsHeight, setDiagnosticsHeight] = useState(190);
  const [drawer, setDrawer] = useState(null); // 'left' | 'right' | 'diagnostics' | null

  const uploadRef = useRef(null);

  const spec = useMemo(
    () => generators.find((entry) => entry.key === generatorKey) || null,
    [generators, generatorKey]
  );

  const generatorElements = useMemo(() => model?.generatorElements || [], [model]);

  /**
   * Which result set the 3D viewport shows. A recorded 3D frame set takes precedence
   * over the 2D one because it is the richer document (six DOF, local axes per
   * member); if only the 2D set exists, that is displayed with its own declared
   * frame mapping. The state always belongs to the set being shown.
   */
  const { activeResultSet, activeResultState, activeResultKind } = useMemo(() => {
    const threeD = model?.analyses?.['opensees-3d'] || null;
    if (threeD) {
      return { activeResultSet: threeD, activeResultState: analysisStatus(model, 'opensees-3d').state, activeResultKind: 'opensees-3d' };
    }
    const twoD = model?.analysis || null;
    return { activeResultSet: twoD, activeResultState: analysisStatus(model).state, activeResultKind: 'opensees-2d' };
  }, [model]);

  const artefactsStale =
    artefactRevision != null &&
    revision != null &&
    revision !== artefactRevision &&
    // A builder-published model replaces the generated one; the badge must not
    // carry across models.
    (!artefactModelId || !model || artefactModelId === model.modelId);
  const selectedId = selection.primary || null;
  const selectedRow = useMemo(
    () => generatorElements.find((element) => element.id === selectedId) || null,
    [generatorElements, selectedId]
  );

  /* ------------------------------------------------------- backend discovery */

  const loadCatalogue = useCallback(async () => {
    try {
      const probe = await probeBackend();
      if (!probe.ok) {
        setHealth(null);
        setHealthError(probe.error);
        return;
      }
      setHealth(probe.payload);
      setHealthError(null);
      const catalogue = await fetchGenerators();
      const list = catalogue.generators || [];
      setGenerators(list);
      if (!spec) {
        const first = list.find((entry) => entry.key === 'beam') || list[0];
        if (first) {
          setGeneratorKey(first.key);
          setParams({ ...first.defaults });
        }
      }
    } catch (err) {
      setHealthError(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadCatalogue();
  }, [loadCatalogue]);

  // The analysis engine question is a separate fact from the generator catalogue.
  useEffect(() => {
    let cancelled = false;
    import('./cadIfcApi')
      .then(({ fetchAnalysisEngine }) =>
        fetchAnalysisEngine().then((payload) => {
          if (!cancelled) setEngineInfo({ ok: true, payload });
        })
      )
      .catch((err) => {
        if (!cancelled) setEngineInfo({ ok: false, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* --------------------------------------------------------------- generators */

  const selectGenerator = useCallback(
    (key) => {
      const next = generators.find((entry) => entry.key === key);
      setGeneratorKey(key);
      setParams(next ? { ...next.defaults } : {});
      setReconcileResult(null);
    },
    [generators]
  );

  const setParam = useCallback((name, value) => {
    setParams((previous) => ({ ...previous, [name]: value }));
  }, []);

  const resetParams = useCallback(() => {
    if (spec) setParams({ ...spec.defaults });
  }, [spec]);

  const showView = useCallback((next) => {
    setView(next);
    setVisited((current) => {
      if (current.has(next)) return current;
      const updated = new Set(current);
      updated.add(next);
      return updated;
    });
  }, []);

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
        `Generated ${report.drawing.drawing_id}: ${report.drawing.entity_count} CAD entities, ` +
          `${report.ifc.element_count} IFC element(s), ${report.mapping.entity_links.link_count} links.`
      );

      // The canonical document is the source of truth for every view. Without it
      // the model view and the analysis cannot be trusted, so a failure here is
      // reported instead of silently falling back to the preview.
      try {
        const document = await fetchModel(report.model.model_id);
        const outcome = loadFromCanonicalDocument(document);
        if (outcome?.opened === false) {
          setMessage(
            (previous) =>
              `${previous} The previously open model was kept because it has unsaved changes.`
          );
        } else {
          // The DXF/IFC just written describe the revision that was loaded.
          setArtefactRevision(outcome.model?.revision?.index ?? 0);
          setArtefactModelId(outcome.model?.modelId ?? null);
        }
      } catch (modelError) {
        setError(
          `The generator ran, but the canonical model could not be loaded: ${modelError.message}`
        );
      }

      try {
        const entityLinks = await fetchLinks(report.model.model_id, report.drawing.drawing_id);
        setLinks(entityLinks);
        // Complete the identity index: GlobalIds from the IFC report and the
        // element -> CAD handle links. This is identifier metadata only, so it does
        // not change the model revision or invalidate analysis results.
        const handlesById = {};
        for (const [elementId, entries] of Object.entries(entityLinks?.elements || {})) {
          handlesById[elementId] = (entries || [])
            .map((entry) => entry.handle)
            .filter((handle) => handle != null);
        }
        registerIdentity({ guids: report.ifc?.guids || {}, handles: handlesById });
      } catch (linkError) {
        setLinks(null);
        setMessage((previous) => `${previous} (entity links unavailable: ${linkError.message})`);
      }

      if (report.ifc?.guids) {
        const firstId = Object.keys(report.ifc.guids)[0];
        if (firstId) select(firstId, { source: 'generate' });
      }
    } catch (err) {
      setError(err.message);
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }, [params, spec, loadFromCanonicalDocument, registerIdentity, select]);

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

  /* --------------------------------------------------------------- reconcile */

  const runReconcile = useCallback(
    async (file) => {
      if (!result) return;
      setBusy(true);
      setError(null);
      try {
        const base64 = file ? await fileToBase64(file) : null;
        const report = await reconcile(result.model.model_id, result.drawing.drawing_id, base64);
        setReconcileResult(report);
        setDiagnosticsOpen(true);
        setMessage(
          report.requires_reconciliation
            ? 'Drift detected — review the reconciliation report in the diagnostics panel.'
            : 'The drawing matches the mapping: no drift detected.'
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [result]
  );

  /* ----------------------------------------------------------------- linkage */

  const drawingUrl = result?.drawing?.url
    ? `${artefactUrl(result.drawing.url)}?v=${encodeURIComponent(result.drawing.drawing_id)}`
    : null;
  const ifcUrl = result?.ifc?.url
    ? `${artefactUrl(result.ifc.url)}?v=${encodeURIComponent(result.model.model_id)}`
    : null;

  const elementRows = useMemo(() => {
    const entityLinks = links?.elements || {};
    const guids = result?.ifc?.guids || {};
    const rows = generatorElements.length
      ? generatorElements.map((element) => ({
          id: element.id,
          name: element.name,
          ifcClass: element.ifcClass,
          guid: element.guid || guids[element.id] || null,
          handles: (entityLinks[element.id] || []).map((link) => link.handle),
          warnings: element.warnings || [],
        }))
      : (spec?.canonical_preview?.elements || []).map((element) => ({
          id: element.id,
          name: element.name || element.role || element.id,
          ifcClass: element.ifc_class,
          guid: guids[element.id] || null,
          handles: [],
          warnings: element.validation?.warnings || [],
        }));
    return rows;
  }, [generatorElements, links, result, spec]);

  const focusElement = useCallback(
    (row) => {
      select(row.id, { source: 'list' });
      if (row.handles?.length) setFocusRequest({ handle: row.handles[0], nonce: Date.now() });
    },
    [select]
  );

  // A CAD selection (DXF handles) resolves to canonical elements through the
  // identity index, so the same element lights up in the BIM and 3D views.
  const handleCadSelection = useCallback(
    (handles) => {
      const id = handles
        .map((handle) => model?.identity?.byHandle?.[String(handle)])
        .find(Boolean);
      if (id) {
        select(id, { source: 'cad' });
        setFocusRequest({ handle: handles[0], nonce: Date.now() });
        setMessage(`CAD selection → ${id}`);
      } else {
        setMessage(`CAD selection ${handles.join(', ')} is not mapped to a canonical element`);
      }
    },
    [model, select]
  );

  const handleBimSelection = useCallback(
    (payload) => {
      if (!payload) {
        clearSelection();
        return;
      }
      const { guid, element } = payload;
      const id =
        element?.id ||
        (guid ? model?.identity?.byGlobalId?.[guid] : null) ||
        null;
      if (id) select(id, { source: 'bim' });
      else if (guid) setMessage(`IFC element ${guid} has no canonical counterpart`);
    },
    [model, select, clearSelection]
  );

  const handleAnalysisResult = useCallback(
    (payload) => {
      try {
        recordAnalysis(payload.results, {
          caseId: payload.case_id,
          engine: payload.results?.engine?.name,
        });
        showView('structure');
      } catch (attachError) {
        setError(`Analysis ran but its results could not be attached: ${attachError.message}`);
      }
    },
    [recordAnalysis, showView]
  );

  /* --------------------------------------------------------------- responsive */

  const togglePanel = useCallback(
    (panel) => {
      if (isPhone) {
        setDrawer((current) => (current === panel ? null : panel));
        return;
      }
      if (panel === 'left') setLeftOpen((value) => !value);
      if (panel === 'right') setRightOpen((value) => !value);
      if (panel === 'diagnostics') setDiagnosticsOpen((value) => !value);
    },
    [isPhone]
  );

  useEffect(() => {
    if (!isPhone && drawer) setDrawer(null);
  }, [isPhone, drawer]);

  const activeView = VIEWS.find((entry) => entry.id === view) || VIEWS[0];

  /* -------------------------------------------------------------- sub-panels */

  const generatorPanel = (
    <div className="flex min-h-0 flex-col">
      <div className="border-b border-gray-200 px-3 py-2 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
            Engineering generator
          </span>
          <Badge tone={health ? 'ok' : healthError ? 'error' : 'idle'}>
            {health ? 'online' : healthError ? 'offline' : 'checking'}
          </Badge>
        </div>
        <select
          value={generatorKey}
          onChange={(event) => selectGenerator(event.target.value)}
          className={`${control.base} mt-1.5 py-1 text-xs`}
          aria-label="Engineering generator"
        >
          {generators.map((entry) => (
            <option key={entry.key} value={entry.key}>
              {entry.label}
            </option>
          ))}
          {!generators.length && <option value="beam">beam (backend offline)</option>}
        </select>
        {spec && (
          <p className={`mt-1 text-[11px] leading-snug ${text.helper}`}>{spec.description}</p>
        )}
        {spec && (
          <div className={`mt-1 flex items-center gap-1 text-[10px] ${text.helper}`}>
            <FileCode2 size={11} aria-hidden="true" />
            <span>
              {spec.drawing_number} · {spec.scale} · views {spec.views.join(', ')}
            </span>
          </div>
        )}
      </div>

      {spec && (
        <div className="border-b border-gray-200 px-3 py-2 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Parameters ({spec.parameters.filter((p) => p.editable !== false).length})
            </span>
            <button
              type="button"
              onClick={resetParams}
              className="text-[10px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
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

      <div className="space-y-1.5 px-3 py-2">
        <button
          type="button"
          onClick={runGenerate}
          disabled={busy || !spec}
          className={`${action.base} ${action.primary} w-full py-1.5 text-xs`}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Generate DXF + IFC
        </button>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={save}
            disabled={!model || !dirty}
            className={`${action.base} ${action.secondary} flex-1 py-1 text-[11px]`}
            title="Mark the current revision as saved"
          >
            <Save size={12} /> Save rev
          </button>
          <button
            type="button"
            onClick={runSeptic}
            disabled={busy}
            className={`${action.base} ${action.secondary} flex-1 py-1 text-[11px]`}
            title="The earlier septic-tank pipeline, kept working"
          >
            <RefreshCw size={12} /> Septic demo
          </button>
        </div>
      </div>

      {result && (
        <div className={`space-y-1 border-t border-gray-200 px-3 py-2 text-[10px] ${text.helper} dark:border-slate-800`}>
          <div className="font-bold uppercase tracking-wider">Current artefacts</div>
          <div className="break-all">drawing: {result.drawing?.drawing_id}</div>
          <div className="break-all">model: {result.model?.model_id}</div>
          <div>links: {result.mapping?.entity_links?.link_count ?? 0}</div>
          {result.ifc?.classes?.length ? <div>ifc: {result.ifc.classes.join(', ')}</div> : null}
          <div className="flex flex-wrap gap-1 pt-1">
            {result.drawing?.url && (
              <a
                href={artefactUrl(result.drawing.url)}
                download
                className={`${action.base} ${action.secondary} px-2 py-1 text-[10px]`}
              >
                <Download size={11} /> DXF
              </a>
            )}
            {result.ifc?.url && (
              <a
                href={artefactUrl(result.ifc.url)}
                download
                className={`${action.base} ${action.secondary} px-2 py-1 text-[10px]`}
              >
                <Download size={11} /> IFC
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const elementsPanel = (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-1.5 border-b border-gray-200 px-3 py-2 dark:border-slate-800">
        <Link2 size={13} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
          Canonical elements
        </span>
        <span className={`ml-auto text-[10px] ${text.helper}`}>{elementRows.length}</span>
      </div>

      {!elementRows.length && (
        <p className={`px-3 py-2 text-[11px] ${text.helper}`}>
          Generate a drawing to populate the engineering model.
        </p>
      )}

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {elementRows.map((row) => {
          const isSelected = selectedId === row.id;
          const hidden = (model?.hidden || []).includes(row.id);
          return (
            <li key={row.id}>
              <div
                className={`flex items-start gap-1 border-b border-gray-100 px-2 py-1.5 dark:border-slate-800 ${
                  isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => focusElement(row)}
                  className="min-h-[36px] min-w-0 flex-1 text-left"
                  aria-pressed={isSelected}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`truncate text-[11px] font-medium ${text.title}`}>{row.name}</span>
                    <Badge tone={row.ifcClass ? 'ok' : 'stale'}>{row.ifcClass || 'unmapped'}</Badge>
                  </div>
                  <div className={`break-all text-[9px] ${text.helper}`}>{row.id}</div>
                  <div className={`break-all text-[9px] ${text.helper}`}>guid {row.guid || '—'}</div>
                  <div className={`text-[9px] ${text.helper}`}>
                    {row.handles.length} CAD {row.handles.length === 1 ? 'entity' : 'entities'}
                    {row.handles.length ? `: ${row.handles.slice(0, 3).join(', ')}` : ''}
                    {row.handles.length > 3 ? '…' : ''}
                  </div>
                  {row.warnings.length > 0 && (
                    <div className="mt-0.5 flex items-start gap-1 text-[9px] text-amber-700 dark:text-amber-300">
                      <AlertTriangle size={10} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{row.warnings[0]}</span>
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility(row.id, hidden)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  title={hidden ? 'Show element' : 'Hide element'}
                  aria-label={hidden ? 'Show element' : 'Hide element'}
                >
                  {hidden ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-gray-200 px-3 py-2 dark:border-slate-800">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
          Reconcile CAD edits
        </div>
        <p className={`mt-1 text-[10px] leading-snug ${text.helper}`}>
          Upload an edited DXF to see exactly which entities were deleted, re-handled or
          modified. CAD changes are never applied to the engineering model automatically.
        </p>
        <div className="mt-1 flex gap-1">
          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            disabled={busy || !result}
            className={`${action.base} ${action.secondary} flex-1 px-2 py-1 text-[10px]`}
          >
            <Upload size={11} /> Upload DXF
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
            type="button"
            onClick={() => runReconcile(null)}
            disabled={busy || !result}
            className={`${action.base} ${action.secondary} px-2 py-1 text-[10px]`}
            title="Re-read the drawing currently in the store"
          >
            Re-scan
          </button>
        </div>
      </div>

      <div className={`px-3 py-2 text-[10px] ${text.helper}`}>
        <div className="font-bold uppercase tracking-wider">Backend</div>
        <div className="break-all">{CAD_IFC_API_ROOT}</div>
        <div>
          source: {API_SOURCE} — {API_SOURCE_DETAIL}
        </div>
        {/* The two legacy entry points stay first-class routes; they are linked, not
            replaced, so a user can step out to the original Konva page or the full
            R3F visualiser without losing this workspace's session model. */}
        <div className="mt-1 border-t border-gray-200 pt-1 dark:border-slate-800">
          <div className="font-bold uppercase tracking-wider">Other entry points</div>
          <div className="flex flex-wrap gap-1 pt-0.5">
            <a href="/visualise" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
              /visualise
            </a>
            <span aria-hidden="true">·</span>
            <a href="/drawing" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
              /drawing
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="/structural/manual/eurocode_structural_app"
              className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Framed &amp; Tall
            </a>
          </div>
        </div>
        {selectedRow && (
          <div className="mt-1 border-t border-gray-200 pt-1 dark:border-slate-800">
            <div className="font-bold uppercase tracking-wider">Selected</div>
            <div className="break-all">{selectedRow.id}</div>
            <div>{selectedRow.name}</div>
            <div>class: {selectedRow.ifcClass || '—'}</div>
            {selectedRow.material && <div>material: {selectedRow.material}</div>}
            {selectedRow.warnings?.length > 0 && (
              <div className="mt-1 text-amber-700 dark:text-amber-300">{selectedRow.warnings[0]}</div>
            )}
            <ElementGeometryEditor key={selectedRow.id} element={selectedRow} />
          </div>
        )}
      </div>
    </div>
  );

  /* --------------------------------------------------------------- diagnostics */

  const diagnostics = (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 text-[11px] md:grid-cols-2 xl:grid-cols-3">
      <section className={`rounded-lg border p-2.5 ${surface.card}`}>
        <h3 className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${text.helper}`}>
          Model revision
        </h3>
        <dl className={`space-y-0.5 ${text.subtitle}`}>
          <div className="flex justify-between gap-2">
            <dt>model</dt>
            <dd className="truncate font-mono">{model?.modelId || '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>revision</dt>
            <dd className="font-mono">{revision ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>fingerprint</dt>
            <dd className="font-mono">{model?.revision?.fingerprint || '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>unsaved</dt>
            <dd>{dirty ? 'yes' : 'no'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>DXF/IFC from rev</dt>
            <dd className={artefactsStale ? 'text-amber-700 dark:text-amber-300' : undefined}>
              {artefactRevision ?? '—'}
              {artefactsStale ? ' (older than model)' : ''}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>nodes / members</dt>
            <dd className="font-mono">
              {model?.nodes?.length ?? 0} / {model?.members?.length ?? 0}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>ifc ids</dt>
            <dd className="font-mono">{Object.keys(model?.identity?.byGlobalId || {}).length}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>cad handles</dt>
            <dd className="font-mono">{Object.keys(model?.identity?.byHandle || {}).length}</dd>
          </div>
        </dl>
      </section>

      <section className={`rounded-lg border p-2.5 ${surface.card}`}>
        <h3 className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${text.helper}`}>
          Validation
        </h3>
        {validation ? (
          <>
            <div className={validation.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
              {validation.ok ? 'canonical model valid' : `${validation.errors.length} error(s)`}
            </div>
            <ul className="mt-1 space-y-0.5">
              {validation.errors.slice(0, 6).map((entry) => (
                <li key={entry} className="break-words text-rose-600 dark:text-rose-400">
                  • {entry}
                </li>
              ))}
              {validation.warnings.slice(0, 8).map((entry) => (
                <li key={entry} className="break-words text-amber-700 dark:text-amber-300">
                  • {entry}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className={text.helper}>No model loaded.</p>
        )}
      </section>

      <section className={`rounded-lg border p-2.5 ${surface.card}`}>
        <h3 className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${text.helper}`}>
          Analysis
        </h3>
        <div className="space-y-0.5">
          <div>
            state:{' '}
            <span
              className={
                analysisStatus.state === 'current'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : analysisStatus.state === 'stale'
                    ? 'text-amber-700 dark:text-amber-300'
                    : text.helper
              }
            >
              {analysisStatus.state}
            </span>{' '}
            — {analysisStatus.reason}
          </div>
          <div>engine: {engineInfo ? (engineInfo.ok ? (engineInfo.payload.available ? 'OpenSees available' : 'OpenSees not available') : engineInfo.error) : 'checking…'}</div>
          {engineInfo?.ok && engineInfo.payload.interpreter && (
            <div className="break-all font-mono text-[10px]">{engineInfo.payload.interpreter}</div>
          )}
          <div className="pt-0.5">3D view shows: <span className="font-mono">{activeResultKind}</span></div>
          <div className="pt-1 font-semibold">Readiness</div>
          {readiness.ready ? (
            <div className="text-emerald-600 dark:text-emerald-400">
              the model has everything the solver needs
            </div>
          ) : (
            <ul className="space-y-0.5 text-amber-700 dark:text-amber-300">
              {readiness.blockers.slice(0, 6).map((entry) => (
                <li key={entry}>• {entry}</li>
              ))}
            </ul>
          )}
          {model?.analysis && (
            <div className="pt-1">
              results rev {model.analysis.modelRevision} · case {model.analysis.caseId} · engine{' '}
              {model.analysis.engine || 'unknown'}
            </div>
          )}

          {/* Every result set the model carries, with its own revision + schema.
              A pipeline's results are never presented under another pipeline's name. */}
          {model?.analyses && Object.keys(model.analyses).length > 0 && (
            <div className="mt-1 border-t border-gray-200 pt-1 dark:border-slate-800">
              <div className="font-semibold">Result sets</div>
              {Object.entries(model.analyses).map(([kind, entry]) => {
                const status = analysisStatus(model, kind);
                return (
                  <div key={kind} className="flex flex-wrap justify-between gap-x-2">
                    <span className="truncate font-mono">{kind}</span>
                    <span
                      className={
                        status.state === 'current'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-700 dark:text-amber-300'
                      }
                      title={`${entry.schema} · case ${entry.caseId} · ${status.reason}`}
                    >
                      {status.state} · rev {entry.modelRevision} ·{' '}
                      {entry.schema?.split('/').pop() || 'schema?'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className={`rounded-lg border p-2.5 ${surface.card}`}>
        <h3 className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${text.helper}`}>
          Backend
        </h3>
        <div className="break-all font-mono text-[10px]">{API_BASE}</div>
        <div className={text.helper}>
          source {API_SOURCE} — {API_SOURCE_DETAIL}
        </div>
        {health ? (
          <ul className="mt-1 space-y-0.5">
            <li>ifcopenshell: {health.ifcopenshell?.available ? health.ifcopenshell.schema : 'missing'}</li>
            <li>ezdxf: {health.ezdxf?.version || '?'}</li>
            <li>generators: {health.engineering_generators?.count ?? 0}</li>
          </ul>
        ) : (
          <p className="mt-1 text-rose-600 dark:text-rose-400">{healthError || 'not checked'}</p>
        )}
        <button
          type="button"
          onClick={loadCatalogue}
          className={`${action.base} ${action.secondary} mt-1 px-2 py-1 text-[10px]`}
        >
          <RefreshCw size={11} /> Re-check backend
        </button>
      </section>

      <section className={`rounded-lg border p-2.5 ${surface.card}`}>
        <h3 className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${text.helper}`}>
          Artefact validation
        </h3>
        {result?.validation ? (
          <ul className="space-y-0.5">
            <li>
              canonical schema:{' '}
              {result.validation.canonical?.ok ? 'valid' : `${result.validation.canonical?.errors?.length || 0} error(s)`}
            </li>
            <li>
              IFC schema:{' '}
              {result.validation.ifc_schema?.ok
                ? '0 statements'
                : `${result.validation.ifc_schema?.statement_count} statements`}
            </li>
            <li>
              DXF units: {result.validation.dxf_units?.ok ? 'mm ($INSUNITS=4)' : 'mismatch'}
            </li>
          </ul>
        ) : (
          <p className={text.helper}>Generate a model to validate its artefacts.</p>
        )}
      </section>

      <section className={`rounded-lg border p-2.5 ${surface.card}`}>
        <h3 className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${text.helper}`}>
          Reconcile
        </h3>
        {reconcileResult ? (
          <div className="space-y-1">
            <div className={reconcileResult.requires_reconciliation ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-400'}>
              {reconcileResult.requires_reconciliation ? 'drift detected' : 'no drift'}
            </div>
            {Object.entries(reconcileResult.summary || {}).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-2">
                <span className={text.helper}>{key}</span>
                <span>{value}</span>
              </div>
            ))}
            {reconcileResult.missing?.length > 0 && (
              <div className="break-all text-rose-600 dark:text-rose-400">
                missing: {reconcileResult.missing.slice(0, 5).map((item) => item.handle).join(', ')}
              </div>
            )}
            {reconcileResult.rehandled?.length > 0 && (
              <div className="break-all text-sky-600 dark:text-sky-400">
                re-handled: {reconcileResult.rehandled.slice(0, 5).map((item) => `${item.old_handle}→${item.new_handle}`).join(', ')}
              </div>
            )}
          </div>
        ) : (
          <p className={text.helper}>
            No reconcile run yet. Upload an edited DXF from the properties panel.
          </p>
        )}
      </section>
    </div>
  );

  /* ------------------------------------------------------------------- render */

  return (
    <div
      className={`flex h-full min-h-0 w-full flex-col overflow-hidden ${surface.page}`}
      data-workbench-view={view}
    >
      {/* ------------------------------------------------------------- header */}
      <header className="shrink-0 border-b border-gray-200 bg-white/95 px-2 py-1.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <Layers size={15} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <h1 className={`truncate text-sm font-bold ${text.title}`}>CAD · BIM · IFC</h1>
            {model && (
              <Badge tone={dirty ? 'stale' : 'ok'} title={dirty ? 'unsaved changes' : 'saved revision'}>
                {dirty ? 'unsaved' : `rev ${revision}`}
              </Badge>
            )}
            {analysisStatus.state === 'stale' && <Badge tone="stale">results stale</Badge>}
            {analysisStatus.state === 'current' && <Badge tone="ok">results current</Badge>}
            {artefactsStale && (
              <Badge
                tone="stale"
                title={`The DXF/IFC files were generated from revision ${artefactRevision}; the model is now at revision ${revision}. Regenerate to refresh the files.`}
              >
                DXF/IFC older than model
              </Badge>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => togglePanel('left')}
              className={action.icon}
              aria-label="Toggle generator and model panel"
              aria-expanded={isPhone ? drawer === 'left' : leftOpen}
            >
              <PanelLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => togglePanel('right')}
              className={action.icon}
              aria-label="Toggle element properties panel"
              aria-expanded={isPhone ? drawer === 'right' : rightOpen}
            >
              <PanelRight size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => togglePanel('diagnostics')}
              className={action.icon}
              aria-label="Toggle diagnostics panel"
              aria-expanded={isPhone ? drawer === 'diagnostics' : diagnosticsOpen}
            >
              <Activity size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* View switcher: a select on phones, segmented buttons on >=md */}
        <div className="mt-1.5">
          <label className="block md:hidden">
            <span className="sr-only">Active view</span>
            <select
              value={view}
              onChange={(event) => showView(event.target.value)}
              className={`${control.base} py-1 text-xs`}
            >
              {VIEWS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.title}
                </option>
              ))}
            </select>
          </label>
          <div className="hidden flex-wrap items-center gap-1 md:flex" role="tablist" aria-label="Workbench views">
            {VIEWS.map((entry) => {
              const Icon = entry.icon;
              const active = view === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => showView(entry.id)}
                  className={`inline-flex min-h-[32px] items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon size={13} aria-hidden="true" />
                  {entry.label}
                </button>
              );
            })}
            <div className="flex-1" />
            {result?.drawing?.drawing_number && (
              <span className={`truncate text-[10px] ${text.helper}`}>
                {result.drawing.drawing_number} · {result.drawing.drawing_title}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Conflict banner: unsaved work is never discarded silently */}
      {conflict && (
        <div className="flex shrink-0 items-start gap-2 border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{conflict.message}</span>
          <button type="button" onClick={dismissConflict} className="shrink-0 font-semibold underline">
            keep current
          </button>
        </div>
      )}

      {healthError && (
        <div className="flex shrink-0 items-start gap-2 border-b border-rose-300 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-900 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-100">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="whitespace-pre-line break-words leading-snug">{healthError}</p>
            <button
              type="button"
              onClick={loadCatalogue}
              className="mt-1 font-semibold underline"
            >
              retry connection
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------- body */}
      <div className="relative flex min-h-0 flex-1">
        {/* desktop: generator panel */}
        {leftOpen && (
          <aside
            className="hidden min-h-0 shrink-0 overflow-y-auto border-r border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block"
            style={{ width: leftWidth }}
            aria-label="Generator and model panel"
          >
            {generatorPanel}
          </aside>
        )}
        {leftOpen && (
          <SplitHandle
            orientation="vertical"
            label="Resize the generator panel"
            onDelta={(delta, reset) =>
              setLeftWidth((width) => (reset ? 300 : Math.min(460, Math.max(240, width + delta))))
            }
          />
        )}

        {/* viewport */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            {(KEEP_ALIVE.has('cad') || visited.has('cad')) && (
              <div className={view === 'cad' ? 'absolute inset-0' : 'hidden'}>
                <Suspense fallback={<ViewerFallback label="MLightCAD" />}>
                  <CadDxfViewer
                    dxfUrl={drawingUrl}
                    focusHandle={focusRequest}
                    onStatus={handleStatus}
                    onSelectHandles={handleCadSelection}
                    onLoaded={handleLoaded}
                  />
                </Suspense>
              </div>
            )}

            {(KEEP_ALIVE.has('bim') || visited.has('bim')) && (
              <div className={view === 'bim' ? 'absolute inset-0' : 'hidden'}>
                <Suspense fallback={<ViewerFallback label="That Open Components" />}>
                  <ThatOpenBimViewer
                    ifcUrl={ifcUrl}
                    elements={generatorElements}
                    focusGuid={
                      model?.identity?.byElementId?.[selectedId]?.globalId ||
                      result?.ifc?.guids?.[selectedId] ||
                      null
                    }
                    selectedGuid={
                      model?.identity?.byElementId?.[selectedId]?.globalId ||
                      result?.ifc?.guids?.[selectedId] ||
                      null
                    }
                    onStatus={handleStatus}
                    onSelect={handleBimSelection}
                  />
                </Suspense>
              </div>
            )}

            {view === 'structure' && (
              <div className="absolute inset-0">
                <Suspense fallback={<ViewerFallback label="structure view" />}>
                  <Structure3DView
                    model={model}
                    analysis={activeResultSet}
                    analysisState={activeResultState}
                    selectedId={selectedId}
                    onSelect={(id) => (id ? select(id, { source: 'structure' }) : clearSelection())}
                    onStatus={handleStatus}
                  />
                </Suspense>
              </div>
            )}

            {view === 'analysis' && (
              <div className="absolute inset-0">
                <AnalysisPanel
                  model={model}
                  element={selectedRow || generatorElements[0] || null}
                  analysisStatus={analysisStatus}
                  onResult={handleAnalysisResult}
                  onStatus={handleStatus}
                />
              </div>
            )}

            {view === 'ifc' && (
              <div className="absolute inset-0">
                <Suspense fallback={<ViewerFallback label="web-ifc" />}>
                  <IfcBimViewer
                    ifcUrl={ifcUrl}
                    onStatus={handleStatus}
                  />
                </Suspense>
              </div>
            )}

            {view === 'builder' && (
              <div className="absolute inset-0 overflow-auto bg-gray-50 dark:bg-slate-950">
                <Suspense fallback={<ViewerFallback label="Framed & Tall builder" />}>
                  <InteractiveStructureBuilder publishToWorkspace />
                </Suspense>
              </div>
            )}

            {/* Mobile view label, so the active tool is always identifiable */}
            <div className="pointer-events-none absolute right-2 top-2 z-10 md:hidden">
              <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {activeView.title}
              </span>
            </div>
          </div>
        </main>

        {/* desktop: elements panel */}
        {rightOpen && (
          <SplitHandle
            orientation="vertical"
            label="Resize the elements panel"
            onDelta={(delta, reset) =>
              setRightWidth((width) => (reset ? 320 : Math.min(480, Math.max(260, width - delta))))
            }
          />
        )}
        {rightOpen && (
          <aside
            className="hidden min-h-0 shrink-0 overflow-y-auto border-l border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block"
            style={{ width: rightWidth }}
            aria-label="Canonical elements and properties"
          >
            {elementsPanel}
          </aside>
        )}
      </div>

      {/* --------------------------------------------------------- diagnostics */}
      {diagnosticsOpen && !isPhone && (
        <SplitHandle
          orientation="horizontal"
          label="Resize the diagnostics panel"
          onDelta={(delta, reset) =>
            setDiagnosticsHeight((height) =>
              reset ? 190 : Math.min(420, Math.max(120, height - delta))
            )
          }
        />
      )}
      {diagnosticsOpen && !isPhone && (
        <section
          className="flex shrink-0 flex-col overflow-hidden border-t border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-950"
          style={{ height: diagnosticsHeight }}
          aria-label="Diagnostics"
        >
          <div className="flex shrink-0 items-center gap-2 px-3 py-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${text.helper}`}>
              Diagnostics
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setDiagnosticsOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Close diagnostics"
            >
              <ChevronDown size={15} aria-hidden="true" />
            </button>
          </div>
          {diagnostics}
        </section>
      )}

      {/* --------------------------------------------------------------- footer */}
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-white/95 px-2 py-1 text-[10px] dark:border-slate-800 dark:bg-slate-900/95">
        {error ? (
          <span className="flex min-w-0 items-start gap-1 text-rose-600 dark:text-rose-400">
            <XCircle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{error}</span>
          </span>
        ) : (
          <span className={`min-w-0 truncate ${text.helper}`}>{message || 'Ready.'}</span>
        )}
        <span className={`shrink-0 ${text.helper}`}>
          {selectedId ? `sel ${selectedId}` : 'no selection'}
          {isPhone ? '' : ` · ${activeView.label}`}
        </span>
      </footer>

      {/* -------------------------------------------------------- mobile drawers */}
      <Drawer open={drawer === 'left'} onClose={() => setDrawer(null)} side="left" title="Generator and model">
        {generatorPanel}
      </Drawer>
      <Drawer open={drawer === 'right'} onClose={() => setDrawer(null)} side="right" title="Elements and properties">
        {elementsPanel}
      </Drawer>
      {drawer === 'diagnostics' && (
        <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label="Diagnostics">
          <button type="button" aria-label="Close diagnostics" onClick={() => setDrawer(null)} className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[80dvh] flex-col rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Diagnostics</h2>
              <button
                type="button"
                onClick={() => setDrawer(null)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Close"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{diagnostics}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Route entry point: provides the shared canonical model to every view. */
export default function InteropWorkbench({ isDark = false }) {
  return (
    <EngineeringModelProvider>
      <Workbench isDark={isDark} />
    </EngineeringModelProvider>
  );
}
