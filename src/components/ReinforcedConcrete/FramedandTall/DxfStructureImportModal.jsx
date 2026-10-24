/**
 * DxfStructureImportModal.jsx
 * ============================================================
 * Fundi Studio — Architectural DXF / DWG Import Modal
 * Path: src/components/ReinforcedConcrete/FramedandTall/DxfStructureImportModal.jsx
 *
 * Mounted by InteractiveStructureBuilder.jsx:
 *   <DxfStructureImportModal
 *     isOpen={showDxfImportModal}
 *     onClose={() => setShowDxfImportModal(false)}
 *     onImport={handleDxfImport}   // (elements, targetLayer) => void
 *     activeLayer="Floor 1"
 *     layers={{ 'Floor 1': { visible: true }, 'Floor 2': { visible: true } }}
 *   />
 *
 * Pipeline (all client-side, no ML):
 *   Upload → API extraction → Layer review → Element inspection
 *   → Assumption tuning → Selection → Import
 */

import React, {
  useState, useEffect, useCallback, useRef, useMemo
} from "react";
import { API_BASE } from "../../../config/runtime";

// ─── Design tokens ──────────────────────────────────────────
// Fundi Studio: precision-engineering palette.
// Blueprint navy primary, concrete slate surfaces, rebar amber accent.
const T = {
  /* Base */
  bg0:     "#0D1117",   // modal backdrop
  bg1:     "#13191F",   // modal surface
  bg2:     "#1A2230",   // panel / card
  bg3:     "#212D3A",   // elevated card / hover
  border:  "#2A3A4A",
  borderHi:"#3B5068",

  /* Primary – blueprint navy */
  navy:    "#1E4ED8",
  navyHi:  "#2563EB",
  navyLo:  "#1E3A8A",

  /* Accent – rebar amber */
  amber:   "#D97706",
  amberHi: "#F59E0B",
  amberBg: "rgba(217,119,6,0.12)",

  /* Semantic */
  green:   "#22C55E",
  greenBg: "rgba(34,197,94,0.10)",
  red:     "#EF4444",
  redBg:   "rgba(239,68,68,0.10)",
  blue:    "#38BDF8",
  blueBg:  "rgba(56,189,248,0.10)",
  slate:   "#94A3B8",
  slateHi: "#CBD5E1",
  white:   "#F0F4F8",

  /* Element type colours */
  wall:    "#7DD3FC",  // sky-300
  column:  "#BEF264",  // lime-300
  beam:    "#FCA5A5",  // red-300
  slab:    "#C4B5FD",  // violet-300
};

// ─── Element-type metadata ───────────────────────────────────
const ELEMENT_META = {
  walls:   { label: "Walls",   color: T.wall,   icon: "▬", unit: "m",  dimLabel: "Length" },
  columns: { label: "Columns", color: T.column, icon: "■", unit: "m",  dimLabel: "Width × Depth" },
  beams:   { label: "Beams",   color: T.beam,   icon: "━", unit: "m",  dimLabel: "Span" },
  slabs:   { label: "Slabs",   color: T.slab,   icon: "▪", unit: "m²", dimLabel: "Area" },
};

// ─── Steps ───────────────────────────────────────────────────
const STEPS = [
  { id: "upload",      label: "Upload" },
  { id: "layers",      label: "Layers" },
  { id: "elements",    label: "Review" },
  { id: "assumptions", label: "Assumptions" },
  { id: "confirm",     label: "Confirm" },
];

// ─── Default engineering assumptions ────────────────────────
const DEFAULT_ASSUMPTIONS = {
  storeyHeight:    3.5,
  slabThickness:   0.20,
  beamWidth:       0.30,
  beamDepth:       0.50,
  columnWidth:     0.40,
  columnDepth:     0.40,
  wallMinT:        0.08,
  wallMaxT:        0.45,
  snapTolerance:   0.05,
  defaultWallT:    0.15,
  minRoomArea:     1.0,
};

// ─── Real API extraction with offline fallback ──────────────
function getSimulatedExtraction(file, assumptions) {
  const z = 0;
  const h = assumptions.storeyHeight;

  return {
    status: "success",
    units: { unit_name: "Metres", scale_factor: 1.0 },
    layers: [
      { name: "A-WALL",     entity_count: 48 },
      { name: "A-COLS",     entity_count: 12 },
      { name: "A-SLAB",     entity_count:  6 },
      { name: "A-BEAM",     entity_count: 20 },
      { name: "ANNOTATION", entity_count: 34 },
      { name: "DIMENSION",  entity_count: 22 },
      { name: "GRID",       entity_count: 18 },
      { name: "0",          entity_count:  5 },
    ],
    elements: {
      walls: Array.from({ length: 12 }, (_, i) => ({
        id: `W${i + 1}`,
        type: "wall",
        start: [i * 1.5, 0, z],
        end:   [i * 1.5 + 5, 0, z],
        thickness: 0.20,
        length: 5.0,
        is_paired: i % 4 !== 3,
        is_single_line_fallback: i % 4 === 3,
        confidence: i % 4 === 3 ? 0.5 : 0.92,
        source_handles: [`${10 + i}A`, `${10 + i}B`],
      })),
      columns: Array.from({ length: 6 }, (_, i) => ({
        id: `C${i + 1}`,
        type: "column",
        position: [i * 3, 0, z],
        start: [i * 3, 0, z],
        end:   [i * 3, 0, z + h],
        width: assumptions.columnWidth,
        depth: assumptions.columnDepth,
        height: h,
        detection_type: i < 4 ? "explicit_block" : "inferred_junction",
        source_handle: i < 4 ? `BLK_${i}` : "inferred",
      })),
      beams: Array.from({ length: 8 }, (_, i) => ({
        id: `B${i + 1}`,
        type: "beam",
        start: [i * 2, 0, z + h],
        end:   [i * 2 + 3.5, 0, z + h],
        width: assumptions.beamWidth,
        depth: assumptions.beamDepth,
        span: 3.5,
        supporting_wall_id: `W${i + 1}`,
      })),
      slabs: Array.from({ length: 4 }, (_, i) => ({
        id: `S${i + 1}`,
        type: "slab",
        name: ["LIVING", "KITCHEN", "BEDROOM 1", "CORRIDOR"][i],
        polygon: [[0,0],[5,0],[5,4],[0,4]].map(([x,y]) => [x + i*6, y]),
        bbox: { xmin: i*6, ymin: 0, xmax: i*6+5, ymax: 4, width: 5, depth: 4 },
        area_m2: [20.0, 12.5, 16.0, 6.0][i],
        aspect_ratio: [1.25, 1.67, 1.6, 2.4][i],
        slab_type: i < 3 ? "two-way" : "one-way",
        elevation: z + h,
      })),
    },
    diagnostics: {
      unpaired_wall_lines:   3,
      snapped_intersections: 18,
      cycles_found:          4,
      warnings: [
        "3 single-line walls could not be paired — using default thickness 0.15 m.",
      ],
    },
  };
}

async function callExtractionAPI(file, assumptions, targetLayer, activeLayers) {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const uploadRes = await fetch(`${API_BASE}/arch_pro/upload`, {
      method: "POST",
      body: formData,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Upload failed (${uploadRes.status}): ${errText}`);
    }

    const uploadData = await uploadRes.json();
    const fileId = uploadData.file_id;

    const layerList = activeLayers && activeLayers.size > 0 ? Array.from(activeLayers) : null;
    const storeyLevel = parseInt(String(targetLayer || "Floor 1").replace("Floor ", "")) || 1;

    const extractRes = await fetch(`${API_BASE}/arch_pro/api/extract-structural-cad`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_id: fileId,
        storey_level: storeyLevel,
        storey_height: assumptions.storeyHeight,
        snap_tolerance: assumptions.snapTolerance,
        min_wall_thickness: assumptions.wallMinT,
        max_wall_thickness: assumptions.wallMaxT,
        wall_layers: layerList,
      }),
    });

    if (!extractRes.ok) {
      const errText = await extractRes.text();
      throw new Error(`Extraction failed (${extractRes.status}): ${errText}`);
    }

    return await extractRes.json();
  } catch (apiErr) {
    console.warn("Backend CAD extraction unavailable or failed:", apiErr);
    if (String(apiErr).includes("Failed to fetch") || String(apiErr).includes("NetworkError")) {
      const sim = getSimulatedExtraction(file, assumptions);
      sim.diagnostics.warnings.unshift(
        `Backend server not reachable at ${API_BASE}. Displaying local preview mode.`
      );
      return sim;
    }
    throw apiErr;
  }
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

// ─── Step indicator ──────────────────────────────────────────
function StepBar({ currentStep }) {
  const idx = STEPS.findIndex(s => s.id === currentStep);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 0,
      padding: "0 2px",
    }}>
      {STEPS.map((step, i) => {
        const done    = i < idx;
        const active  = i === idx;
        const future  = i > idx;
        return (
          <React.Fragment key={step.id}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, letterSpacing: "0.01em",
                background: done   ? T.green
                           : active ? T.navy
                           : T.bg3,
                border: `2px solid ${done ? T.green : active ? T.navyHi : T.border}`,
                color: done || active ? T.white : T.slate,
                transition: "all 0.2s",
              }}>
                {done ? "✓" : i + 1}
              </div>
              <span style={{
                fontSize: 10, fontWeight: active ? 600 : 400,
                color: active ? T.white : done ? T.green : T.slate,
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
              }}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                height: 2, flex: 1, margin: "0 4px", marginBottom: 18,
                background: done ? T.green : T.border,
                transition: "background 0.3s",
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Confidence badge ─────────────────────────────────────────
function ConfBadge({ value }) {
  const pct = Math.round((value ?? 1) * 100);
  const color = pct >= 85 ? T.green : pct >= 60 ? T.amberHi : T.red;
  return (
    <span style={{
      display: "inline-block",
      padding: "1px 6px", borderRadius: 3,
      fontSize: 10, fontWeight: 700,
      background: pct >= 85 ? T.greenBg : pct >= 60 ? T.amberBg : T.redBg,
      color,
      border: `1px solid ${color}30`,
    }}>
      {pct}%
    </span>
  );
}

// ─── Detection type badge ─────────────────────────────────────
function DetBadge({ type }) {
  const map = {
    explicit_block:    { label: "Block",    color: T.green  },
    explicit_polyline: { label: "Polyline", color: T.blue   },
    inferred_junction: { label: "Inferred", color: T.amber  },
  };
  const m = map[type] || { label: type, color: T.slate };
  return (
    <span style={{
      padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600,
      background: `${m.color}18`, color: m.color,
      border: `1px solid ${m.color}30`,
    }}>{m.label}</span>
  );
}

// ─── Number input with label ──────────────────────────────────
function NumField({ label, value, onChange, min, max, step = 0.01, unit }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: T.slate, letterSpacing: "0.02em" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="number"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          min={min} max={max} step={step}
          style={{
            width: 80, padding: "5px 8px",
            background: T.bg0, border: `1px solid ${T.border}`,
            borderRadius: 4, color: T.white, fontSize: 13,
            outline: "none",
          }}
          onFocus={e => e.target.style.borderColor = T.navyHi}
          onBlur={e  => e.target.style.borderColor = T.border}
        />
        {unit && <span style={{ fontSize: 11, color: T.slate }}>{unit}</span>}
      </div>
    </label>
  );
}

// ─── Toggle checkbox row ─────────────────────────────────────
function CheckRow({ label, checked, onChange, color }) {
  return (
    <label style={{
      display: "flex", alignItems: "center", gap: 8,
      cursor: "pointer", padding: "4px 0",
    }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 16, height: 16, borderRadius: 3, flexShrink: 0,
          background: checked ? (color || T.navy) : "transparent",
          border: `2px solid ${checked ? (color || T.navy) : T.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "all 0.15s",
        }}
      >
        {checked && <span style={{ color: T.white, fontSize: 10, lineHeight: 1 }}>✓</span>}
      </div>
      <span style={{ fontSize: 13, color: checked ? T.slateHi : T.slate }}>{label}</span>
    </label>
  );
}

// ─── Diagnostic banner ────────────────────────────────────────
function DiagBanner({ diagnostics }) {
  if (!diagnostics) return null;
  const { warnings = [], unpaired_wall_lines, snapped_intersections, cycles_found } = diagnostics;
  return (
    <div style={{
      background: T.amberBg, border: `1px solid ${T.amber}40`,
      borderRadius: 6, padding: "10px 14px",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: warnings.length ? 8 : 0,
      }}>
        <span style={{ color: T.amberHi, fontSize: 12, fontWeight: 700 }}>⚠ Extraction notes</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: T.slate }}>
          {unpaired_wall_lines} unpaired · {snapped_intersections} snapped · {cycles_found} rooms
        </span>
      </div>
      {warnings.map((w, i) => (
        <p key={i} style={{ margin: 0, fontSize: 12, color: T.amberHi, lineHeight: 1.5 }}>
          {w}
        </p>
      ))}
    </div>
  );
}

// ─── Element row inside the review table ────────────────────
function ElementRow({ el, type, selected, onToggle }) {
  const meta = ELEMENT_META[type];
  const isLowConf = (el.confidence ?? 1) < 0.7;
  const isInferred = el.detection_type === "inferred_junction" ||
                     el.is_single_line_fallback;

  const primaryValue = () => {
    if (type === "walls")   return `${el.length?.toFixed(2)} m`;
    if (type === "columns") return `${el.width?.toFixed(2)} × ${el.depth?.toFixed(2)} m`;
    if (type === "beams")   return `${el.span?.toFixed(2)} m`;
    if (type === "slabs")   return `${el.area_m2?.toFixed(2)} m²`;
    return "—";
  };

  const secondaryLabel = () => {
    if (type === "walls")   return el.is_single_line_fallback ? "single-line" : `t = ${el.thickness?.toFixed(3)} m`;
    if (type === "columns") return <DetBadge type={el.detection_type} />;
    if (type === "beams")   return `${el.width?.toFixed(2)} × ${el.depth?.toFixed(2)} m`;
    if (type === "slabs")   return el.name || "—";
    return null;
  };

  return (
    <div
      onClick={() => onToggle(el.id)}
      style={{
        display: "grid",
        gridTemplateColumns: "20px 36px 1fr auto auto",
        alignItems: "center", gap: 8,
        padding: "7px 10px",
        borderRadius: 5,
        background: selected ? `${meta.color}10` : "transparent",
        border: `1px solid ${selected ? `${meta.color}35` : "transparent"}`,
        cursor: "pointer",
        transition: "background 0.12s, border 0.12s",
        opacity: isLowConf && !selected ? 0.65 : 1,
      }}
    >
      {/* Checkbox */}
      <div style={{
        width: 14, height: 14, borderRadius: 2, flexShrink: 0,
        background: selected ? meta.color : "transparent",
        border: `2px solid ${selected ? meta.color : T.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {selected && <span style={{ color: "#000", fontSize: 9, lineHeight: 1 }}>✓</span>}
      </div>

      {/* Icon */}
      <span style={{ fontSize: 16, color: meta.color, textAlign: "center" }}>{meta.icon}</span>

      {/* ID + secondary */}
      <div>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.white,
                       fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
          {el.id}
        </span>
        <span style={{ marginLeft: 8, fontSize: 11, color: T.slate }}>
          {secondaryLabel()}
        </span>
        {isInferred && (
          <span style={{ marginLeft: 6, fontSize: 10, color: T.amber }}>inferred</span>
        )}
      </div>

      {/* Primary dimension */}
      <span style={{ fontSize: 12, color: T.slateHi, textAlign: "right",
                     fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
        {primaryValue()}
      </span>

      {/* Confidence */}
      {el.confidence !== undefined
        ? <ConfBadge value={el.confidence} />
        : <span style={{ fontSize: 10, color: T.slate }}>—</span>}
    </div>
  );
}

// ─── Slab detail card ─────────────────────────────────────────
function SlabCard({ slab, meta }) {
  return (
    <div style={{
      background: T.bg2, border: `1px solid ${T.border}`,
      borderRadius: 6, padding: "10px 12px",
      display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px",
    }}>
      <div style={{ gridColumn: "1/-1", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>
          {slab.id}
        </span>
        <span style={{
          marginLeft: 8, fontSize: 13, fontWeight: 500, color: T.white,
        }}>{slab.name}</span>
        <span style={{
          marginLeft: 8, fontSize: 11, padding: "1px 6px", borderRadius: 3,
          background: slab.slab_type === "two-way" ? T.greenBg : T.amberBg,
          color: slab.slab_type === "two-way" ? T.green : T.amberHi,
          border: `1px solid ${slab.slab_type === "two-way" ? T.green : T.amber}30`,
          fontWeight: 600,
        }}>{slab.slab_type}</span>
      </div>
      {[
        ["Area",         `${slab.area_m2?.toFixed(2)} m²`],
        ["Aspect ratio", `${slab.aspect_ratio?.toFixed(2)}`],
        ["Elevation",    `${slab.elevation?.toFixed(2)} m`],
        ["Polygon pts",  `${slab.polygon?.length || 0}`],
      ].map(([k, v]) => (
        <React.Fragment key={k}>
          <span style={{ fontSize: 11, color: T.slate }}>{k}</span>
          <span style={{ fontSize: 12, color: T.slateHi,
                         fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>{v}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function DxfStructureImportModal({
  isOpen,
  onClose,
  onImport,
  activeLayer = "Floor 1",
  layers = {},
}) {
  // ── State ──────────────────────────────────────────────────
  const [step,        setStep]        = useState("upload");
  const [file,        setFile]        = useState(null);
  const [dragging,    setDragging]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [extraction,  setExtraction]  = useState(null);
  const [targetLayer, setTargetLayer] = useState(activeLayer);
  const [assumptions, setAssumptions] = useState({ ...DEFAULT_ASSUMPTIONS });

  // Layer & element visibility / selection
  const [activeLayers,  setActiveLayers]  = useState(new Set());   // layers selected for import
  const [selectedIds,   setSelectedIds]   = useState({             // per-type set of selected IDs
    walls: new Set(), columns: new Set(), beams: new Set(), slabs: new Set(),
  });
  const [activeType,    setActiveType]    = useState("walls");      // tab in Review step
  const [filterConf,    setFilterConf]    = useState(false);        // hide low-confidence
  const [showInferred,  setShowInferred]  = useState(true);

  const fileInputRef = useRef(null);
  const modalRef     = useRef(null);

  // ── Reset on close ─────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setStep("upload"); setFile(null); setLoading(false);
      setError(null); setExtraction(null);
      setAssumptions({ ...DEFAULT_ASSUMPTIONS });
      setActiveLayers(new Set()); setActiveType("walls");
      setFilterConf(false); setShowInferred(true);
    }
  }, [isOpen]);

  // ── Keyboard close ─────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // ── File acceptance ────────────────────────────────────────
  const acceptFile = useCallback(f => {
    if (!f) return;
    const ext = f.name.split(".").pop().toLowerCase();
    if (!["dxf", "dwg"].includes(ext)) {
      setError(`Unsupported format ".${ext}". Upload a .dxf or .dwg file.`);
      return;
    }
    setError(null);
    setFile(f);
  }, []);

  const handleDrop = useCallback(e => {
    e.preventDefault(); setDragging(false);
    acceptFile(e.dataTransfer.files[0]);
  }, [acceptFile]);

  const handleFileChange = e => acceptFile(e.target.files[0]);

  // ── Extract ────────────────────────────────────────────────
  const handleExtract = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const result = await callExtractionAPI(file, assumptions, targetLayer, activeLayers);
      if (result.status !== "success") throw new Error(result.error || "Extraction failed.");
      setExtraction(result);
      // Auto-select layers that contain structural content
      const structKeywords = ["WALL","COL","SLAB","BEAM","STRUCT","A-"];
      const autoLayers = new Set(
        result.layers
          .filter(l => structKeywords.some(k => l.name.toUpperCase().includes(k)))
          .map(l => l.name)
      );
      setActiveLayers(autoLayers);
      // Auto-select all elements
      const sel = { walls: new Set(), columns: new Set(), beams: new Set(), slabs: new Set() };
      for (const type of Object.keys(sel)) {
        (result.elements[type] || []).forEach(el => sel[type].add(el.id));
      }
      setSelectedIds(sel);
      setStep("layers");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Re-extract with new assumptions ───────────────────────
  const handleReextract = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const result = await callExtractionAPI(file, assumptions, targetLayer, activeLayers);
      if (result.status !== "success") throw new Error(result.error || "Re-extraction failed.");
      setExtraction(result);
      const sel = { walls: new Set(), columns: new Set(), beams: new Set(), slabs: new Set() };
      for (const type of Object.keys(sel)) {
        (result.elements[type] || []).forEach(el => sel[type].add(el.id));
      }
      setSelectedIds(sel);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Selection helpers ──────────────────────────────────────
  const toggleElement = (type, id) => {
    setSelectedIds(prev => {
      const next = new Set(prev[type]);
      next.has(id) ? next.delete(id) : next.add(id);
      return { ...prev, [type]: next };
    });
  };

  const toggleAllOfType = (type, elements) => {
    setSelectedIds(prev => {
      const ids = elements.map(e => e.id);
      const allSelected = ids.every(id => prev[type].has(id));
      const next = allSelected ? new Set() : new Set(ids);
      return { ...prev, [type]: next };
    });
  };

  // ── Import ─────────────────────────────────────────────────
  const handleImport = () => {
    if (!extraction) return;
    const confirmed = {};
    for (const type of Object.keys(selectedIds)) {
      confirmed[type] = (extraction.elements[type] || [])
        .filter(el => selectedIds[type].has(el.id));
    }
    onImport(confirmed, targetLayer);
    onClose();
  };

  // ── Selection counts ───────────────────────────────────────
  const selCount = useMemo(() => {
    let total = 0;
    for (const s of Object.values(selectedIds)) total += s.size;
    return total;
  }, [selectedIds]);

  const totalCount = useMemo(() => {
    if (!extraction) return 0;
    return Object.values(extraction.elements).reduce((s, arr) => s + arr.length, 0);
  }, [extraction]);

  // ── Filtered elements for Review tab ──────────────────────
  const filteredElements = useMemo(() => {
    if (!extraction) return [];
    const all = extraction.elements[activeType] || [];
    return all.filter(el => {
      if (filterConf && (el.confidence ?? 1) < 0.7) return false;
      if (!showInferred && (el.is_single_line_fallback || el.detection_type === "inferred_junction")) return false;
      return true;
    });
  }, [extraction, activeType, filterConf, showInferred]);

  if (!isOpen) return null;

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import DXF structure"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(3px)",
        padding: 16,
      }}
    >
      <div
        ref={modalRef}
        style={{
          width: "100%", maxWidth: 780,
          maxHeight: "92vh",
          display: "flex", flexDirection: "column",
          background: T.bg1,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          overflow: "hidden",
          fontFamily: "-apple-system, 'Segoe UI', system-ui, sans-serif",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: `1px solid ${T.border}`,
          background: T.bg2,
          flexShrink: 0,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 32, height: 32, borderRadius: 6,
                background: T.navyLo, border: `1px solid ${T.navyHi}40`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16,
              }}>⚙</span>
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.white }}>
                  Import from DXF / DWG
                </h2>
                <p style={{ margin: 0, fontSize: 12, color: T.slate }}>
                  Deterministic extraction · No ML
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none", border: "none",
              color: T.slate, fontSize: 18, cursor: "pointer",
              padding: "4px 8px", borderRadius: 4,
              transition: "color 0.15s",
            }}
            onMouseEnter={e => e.target.style.color = T.white}
            onMouseLeave={e => e.target.style.color = T.slate}
          >✕</button>
        </div>

        {/* ── Step bar ── */}
        <div style={{
          padding: "14px 24px 10px",
          borderBottom: `1px solid ${T.border}`,
          background: T.bg2,
          flexShrink: 0,
        }}>
          <StepBar currentStep={step} />
        </div>

        {/* ── Body (scrollable) ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* ──────────────────────────────────────────────── */}
          {/* STEP: UPLOAD                                    */}
          {/* ──────────────────────────────────────────────── */}
          {step === "upload" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? T.navyHi : file ? T.green : T.border}`,
                  borderRadius: 8, padding: "36px 24px",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 12,
                  cursor: "pointer",
                  background: dragging ? `${T.navy}08` : file ? T.greenBg : T.bg2,
                  transition: "all 0.18s",
                }}
              >
                <div style={{
                  fontSize: 36, lineHeight: 1,
                  filter: file ? "none" : "grayscale(0.5)",
                }}>
                  {file ? "📐" : "⬆"}
                </div>
                {file ? (
                  <>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.white }}>
                      {file.name}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: T.slate }}>
                      {(file.size / 1024).toFixed(1)} KB · Click to replace
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.slateHi }}>
                      Drop your architectural drawing here
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: T.slate }}>
                      .dxf or .dwg · AutoCAD R12 through 2024
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".dxf,.dwg"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
              </div>

              {error && (
                <div style={{
                  padding: "10px 14px", borderRadius: 6,
                  background: T.redBg, border: `1px solid ${T.red}40`,
                  fontSize: 13, color: T.red,
                }}>⚠ {error}</div>
              )}

              {/* Target layer */}
              <div>
                <label style={{ display: "block", fontSize: 12, color: T.slate, marginBottom: 6 }}>
                  Import into layer
                </label>
                <select
                  value={targetLayer}
                  onChange={e => setTargetLayer(e.target.value)}
                  style={{
                    background: T.bg2, border: `1px solid ${T.border}`,
                    borderRadius: 5, padding: "7px 10px",
                    color: T.white, fontSize: 13,
                    outline: "none", cursor: "pointer",
                    minWidth: 180,
                  }}
                >
                  {Object.keys(layers).map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              {/* Quick assumption preview */}
              <div style={{
                background: T.bg2, border: `1px solid ${T.border}`,
                borderRadius: 6, padding: "12px 16px",
              }}>
                <p style={{ margin: "0 0 10px", fontSize: 12, color: T.slate, fontWeight: 600 }}>
                  Extraction assumptions (editable in step 4)
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 16px" }}>
                  {[
                    ["Storey height",  `${assumptions.storeyHeight} m`],
                    ["Slab thickness", `${assumptions.slabThickness} m`],
                    ["Wall thickness", `${assumptions.wallMinT}–${assumptions.wallMaxT} m`],
                    ["Beam section",   `${assumptions.beamWidth}×${assumptions.beamDepth} m`],
                    ["Column section", `${assumptions.columnWidth}×${assumptions.columnDepth} m`],
                    ["Snap tolerance", `${assumptions.snapTolerance} m`],
                  ].map(([k, v]) => (
                    <React.Fragment key={k}>
                      <span style={{ fontSize: 11, color: T.slate }}>{k}</span>
                      <span style={{
                        fontSize: 11, color: T.slateHi, fontFamily: "monospace",
                        gridColumn: "2 / span 2",
                      }}>{v}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────── */}
          {/* STEP: LAYERS                                    */}
          {/* ──────────────────────────────────────────────── */}
          {step === "layers" && extraction && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: T.white }}>
                  Detected layers
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: T.slate }}>
                  Select the layers to extract elements from. Pre-selected layers match structural naming patterns.
                </p>
              </div>

              <div style={{
                background: T.bg2, border: `1px solid ${T.border}`,
                borderRadius: 6, overflow: "hidden",
              }}>
                {extraction.layers.map((l, i) => (
                  <div
                    key={l.name}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "24px 1fr auto",
                      alignItems: "center", gap: 12,
                      padding: "9px 14px",
                      borderBottom: i < extraction.layers.length - 1
                        ? `1px solid ${T.border}` : "none",
                      background: activeLayers.has(l.name) ? `${T.navy}08` : "transparent",
                      cursor: "pointer",
                      transition: "background 0.12s",
                    }}
                    onClick={() => setActiveLayers(prev => {
                      const n = new Set(prev);
                      n.has(l.name) ? n.delete(l.name) : n.add(l.name);
                      return n;
                    })}
                  >
                    <div style={{
                      width: 14, height: 14, borderRadius: 3,
                      background: activeLayers.has(l.name) ? T.navy : "transparent",
                      border: `2px solid ${activeLayers.has(l.name) ? T.navyHi : T.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {activeLayers.has(l.name) && (
                        <span style={{ color: T.white, fontSize: 9, lineHeight: 1 }}>✓</span>
                      )}
                    </div>

                    <span style={{
                      fontSize: 13, color: activeLayers.has(l.name) ? T.white : T.slate,
                      fontFamily: "'JetBrains Mono','Fira Code',monospace",
                      fontWeight: activeLayers.has(l.name) ? 600 : 400,
                    }}>
                      {l.name}
                    </span>

                    <span style={{
                      fontSize: 11, color: T.slate,
                      background: T.bg3, padding: "2px 8px", borderRadius: 10,
                    }}>
                      {l.entity_count} entities
                    </span>
                  </div>
                ))}
              </div>

              <DiagBanner diagnostics={extraction.diagnostics} />

              <div style={{
                background: T.bg2, border: `1px solid ${T.border}`,
                borderRadius: 6, padding: "10px 14px",
                display: "flex", gap: 20, flexWrap: "wrap",
              }}>
                <span style={{ fontSize: 12, color: T.slate }}>Units:</span>
                <span style={{ fontSize: 12, color: T.slateHi, fontWeight: 600 }}>
                  {extraction.units.unit_name}
                </span>
                <span style={{ fontSize: 12, color: T.slate }}>Scale:</span>
                <span style={{ fontSize: 12, color: T.slateHi, fontFamily: "monospace" }}>
                  {extraction.units.scale_factor}
                </span>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────── */}
          {/* STEP: ELEMENTS (review)                         */}
          {/* ──────────────────────────────────────────────── */}
          {step === "elements" && extraction && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Type tabs */}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {Object.entries(ELEMENT_META).map(([type, meta]) => {
                  const elements = extraction.elements[type] || [];
                  const selected = selectedIds[type].size;
                  const isActive = activeType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setActiveType(type)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "6px 12px", borderRadius: 5, cursor: "pointer",
                        border: `1px solid ${isActive ? meta.color + "60" : T.border}`,
                        background: isActive ? `${meta.color}12` : T.bg2,
                        color: isActive ? meta.color : T.slate,
                        fontSize: 13, fontWeight: isActive ? 700 : 400,
                        transition: "all 0.14s",
                      }}
                    >
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                      <span style={{
                        fontSize: 11, padding: "0 5px", borderRadius: 8,
                        background: isActive ? `${meta.color}25` : T.bg3,
                        color: isActive ? meta.color : T.slate,
                      }}>
                        {selected}/{elements.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Filters */}
              <div style={{
                display: "flex", gap: 16, alignItems: "center",
                padding: "8px 12px", background: T.bg2,
                border: `1px solid ${T.border}`, borderRadius: 6,
                flexWrap: "wrap",
              }}>
                <span style={{ fontSize: 12, color: T.slate, fontWeight: 600 }}>Filter:</span>
                <CheckRow
                  label="Hide low-confidence (< 70%)"
                  checked={filterConf}
                  onChange={setFilterConf}
                />
                <CheckRow
                  label="Show inferred elements"
                  checked={showInferred}
                  onChange={setShowInferred}
                />
                <button
                  onClick={() => toggleAllOfType(activeType, filteredElements)}
                  style={{
                    marginLeft: "auto",
                    background: "none", border: `1px solid ${T.border}`,
                    borderRadius: 4, padding: "4px 10px",
                    color: T.slate, fontSize: 11, cursor: "pointer",
                    transition: "color 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={e => {
                    e.target.style.color = T.white;
                    e.target.style.borderColor = T.borderHi;
                  }}
                  onMouseLeave={e => {
                    e.target.style.color = T.slate;
                    e.target.style.borderColor = T.border;
                  }}
                >
                  {filteredElements.every(el => selectedIds[activeType].has(el.id))
                    ? "Deselect all" : "Select all"}
                </button>
              </div>

              {/* Element list */}
              <div style={{
                display: "flex", flexDirection: "column", gap: 3,
                maxHeight: 320, overflowY: "auto",
                padding: "4px 2px",
              }}>
                {filteredElements.length === 0 ? (
                  <div style={{
                    textAlign: "center", padding: "32px 0",
                    color: T.slate, fontSize: 13,
                  }}>
                    No {ELEMENT_META[activeType].label.toLowerCase()} match the current filters.
                  </div>
                ) : filteredElements.map(el => (
                  <ElementRow
                    key={el.id}
                    el={el}
                    type={activeType}
                    selected={selectedIds[activeType].has(el.id)}
                    onToggle={id => toggleElement(activeType, id)}
                  />
                ))}
              </div>

              {/* Slab detail grid */}
              {activeType === "slabs" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {filteredElements
                    .filter(el => selectedIds.slabs.has(el.id))
                    .map(sl => (
                      <SlabCard key={sl.id} slab={sl} meta={ELEMENT_META.slabs} />
                    ))}
                </div>
              )}

              <DiagBanner diagnostics={extraction.diagnostics} />
            </div>
          )}

          {/* ──────────────────────────────────────────────── */}
          {/* STEP: ASSUMPTIONS                               */}
          {/* ──────────────────────────────────────────────── */}
          {step === "assumptions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: T.white }}>
                  Engineering assumptions
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: T.slate }}>
                  Adjust defaults and re-run extraction. Changes affect element dimensions
                  and wall pairing tolerances.
                </p>
              </div>

              {/* Sections */}
              {[
                {
                  title: "Structural geometry",
                  fields: [
                    { key: "storeyHeight",  label: "Storey height",    unit: "m",  min: 2.0, max: 12.0 },
                    { key: "slabThickness", label: "Slab thickness",   unit: "m",  min: 0.10, max: 0.40 },
                  ],
                },
                {
                  title: "Beam & column defaults",
                  fields: [
                    { key: "beamWidth",   label: "Beam width",    unit: "m", min: 0.15, max: 0.60 },
                    { key: "beamDepth",   label: "Beam depth",    unit: "m", min: 0.20, max: 0.90 },
                    { key: "columnWidth", label: "Column width",  unit: "m", min: 0.20, max: 1.00 },
                    { key: "columnDepth", label: "Column depth",  unit: "m", min: 0.20, max: 1.00 },
                  ],
                },
                {
                  title: "Wall pairing tolerances",
                  fields: [
                    { key: "wallMinT",       label: "Minimum wall thickness", unit: "m", min: 0.04, max: 0.20 },
                    { key: "wallMaxT",       label: "Maximum wall thickness", unit: "m", min: 0.20, max: 0.80 },
                    { key: "defaultWallT",   label: "Single-line fallback",   unit: "m", min: 0.08, max: 0.30 },
                    { key: "snapTolerance",  label: "Snap tolerance",         unit: "m", min: 0.01, max: 0.15, step: 0.005 },
                    { key: "minRoomArea",    label: "Min room area",          unit: "m²", min: 0.5, max: 10.0 },
                  ],
                },
              ].map(section => (
                <div key={section.title} style={{
                  background: T.bg2, border: `1px solid ${T.border}`,
                  borderRadius: 6, padding: "14px 16px",
                }}>
                  <p style={{ margin: "0 0 12px", fontSize: 12, color: T.slate, fontWeight: 700 }}>
                    {section.title}
                  </p>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: 12,
                  }}>
                    {section.fields.map(f => (
                      <NumField
                        key={f.key}
                        label={f.label}
                        value={assumptions[f.key]}
                        onChange={v => setAssumptions(prev => ({ ...prev, [f.key]: v }))}
                        min={f.min} max={f.max}
                        step={f.step || 0.01}
                        unit={f.unit}
                      />
                    ))}
                  </div>
                </div>
              ))}

              <button
                onClick={handleReextract}
                disabled={loading}
                style={{
                  padding: "9px 20px",
                  background: loading ? T.bg3 : T.bg2,
                  border: `1px solid ${T.border}`,
                  borderRadius: 6, color: loading ? T.slate : T.slateHi,
                  fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "all 0.15s",
                }}
              >
                {loading ? "Re-extracting…" : "↺ Re-run extraction with these values"}
              </button>

              {error && (
                <div style={{
                  padding: "10px 14px", borderRadius: 6,
                  background: T.redBg, border: `1px solid ${T.red}40`,
                  fontSize: 13, color: T.red,
                }}>⚠ {error}</div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────── */}
          {/* STEP: CONFIRM                                   */}
          {/* ──────────────────────────────────────────────── */}
          {step === "confirm" && extraction && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: T.white }}>
                  Ready to import
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: T.slate }}>
                  Review the summary below, then import into <strong
                    style={{ color: T.white }}>{targetLayer}</strong>.
                </p>
              </div>

              {/* Summary cards */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10,
              }}>
                {Object.entries(ELEMENT_META).map(([type, meta]) => {
                  const total    = (extraction.elements[type] || []).length;
                  const selected = selectedIds[type].size;
                  return (
                    <div key={type} style={{
                      background: T.bg2, border: `1px solid ${T.border}`,
                      borderRadius: 6, padding: "12px 16px",
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <span style={{ fontSize: 22, color: meta.color }}>{meta.icon}</span>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: T.white,
                                      fontFamily: "monospace", lineHeight: 1 }}>
                          {selected}
                        </div>
                        <div style={{ fontSize: 11, color: T.slate, marginTop: 2 }}>
                          {meta.label} of {total}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Target */}
              <div style={{
                background: T.greenBg, border: `1px solid ${T.green}40`,
                borderRadius: 6, padding: "10px 14px",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ color: T.green, fontSize: 16 }}>✓</span>
                <span style={{ fontSize: 13, color: T.green }}>
                  {selCount} elements will be added to <strong>{targetLayer}</strong>
                </span>
              </div>

              {/* Warnings */}
              {extraction.diagnostics?.warnings?.length > 0 && (
                <DiagBanner diagnostics={extraction.diagnostics} />
              )}

              {/* Assumptions summary */}
              <div style={{
                background: T.bg2, border: `1px solid ${T.border}`,
                borderRadius: 6, padding: "10px 14px",
              }}>
                <p style={{ margin: "0 0 8px", fontSize: 11, color: T.slate, fontWeight: 700 }}>
                  Applied assumptions
                </p>
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px",
                }}>
                  {[
                    ["Storey height",  `${assumptions.storeyHeight} m`],
                    ["Slab thickness", `${assumptions.slabThickness} m`],
                    ["Beam section",   `${assumptions.beamWidth} × ${assumptions.beamDepth} m`],
                    ["Column section", `${assumptions.columnWidth} × ${assumptions.columnDepth} m`],
                    ["Wall range",     `${assumptions.wallMinT}–${assumptions.wallMaxT} m`],
                    ["Snap",           `${assumptions.snapTolerance} m`],
                  ].map(([k, v]) => (
                    <React.Fragment key={k}>
                      <span style={{ fontSize: 11, color: T.slate }}>{k}</span>
                      <span style={{ fontSize: 11, color: T.slateHi, fontFamily: "monospace" }}>{v}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>{/* /body */}

        {/* ── Footer ── */}
        <div style={{
          borderTop: `1px solid ${T.border}`,
          padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: T.bg2, flexShrink: 0,
          flexWrap: "wrap", gap: 10,
        }}>
          {/* Left: status */}
          <div style={{ fontSize: 12, color: T.slate }}>
            {step === "upload" && (file ? `${file.name} ready` : "No file selected")}
            {step === "layers" && `${activeLayers.size} layer${activeLayers.size !== 1 ? "s" : ""} selected`}
            {step === "elements" && `${selCount} / ${totalCount} elements selected`}
            {step === "assumptions" && "Adjust values then re-extract"}
            {step === "confirm" && `${selCount} elements · ${targetLayer}`}
          </div>

          {/* Right: nav */}
          <div style={{ display: "flex", gap: 8 }}>
            {step !== "upload" && (
              <button
                onClick={() => {
                  const idx = STEPS.findIndex(s => s.id === step);
                  if (idx > 0) setStep(STEPS[idx - 1].id);
                }}
                style={{
                  padding: "7px 16px", borderRadius: 5,
                  background: "none", border: `1px solid ${T.border}`,
                  color: T.slate, fontSize: 13, cursor: "pointer",
                  transition: "color 0.14s, border-color 0.14s",
                }}
                onMouseEnter={e => {
                  e.target.style.color = T.white;
                  e.target.style.borderColor = T.borderHi;
                }}
                onMouseLeave={e => {
                  e.target.style.color = T.slate;
                  e.target.style.borderColor = T.border;
                }}
              >
                ← Back
              </button>
            )}

            {step === "upload" && (
              <button
                onClick={handleExtract}
                disabled={!file || loading}
                style={{
                  padding: "7px 20px", borderRadius: 5,
                  background: !file || loading ? T.bg3 : T.navy,
                  border: `1px solid ${!file || loading ? T.border : T.navyHi}`,
                  color: !file || loading ? T.slate : T.white,
                  fontSize: 13, fontWeight: 600,
                  cursor: !file || loading ? "not-allowed" : "pointer",
                  transition: "all 0.14s",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {loading
                  ? <><span style={{ animation: "spin 1s linear infinite" }}>⟳</span> Extracting…</>
                  : "Extract →"}
              </button>
            )}

            {["layers", "elements", "assumptions"].includes(step) && (
              <button
                onClick={() => {
                  const idx = STEPS.findIndex(s => s.id === step);
                  setStep(STEPS[idx + 1].id);
                }}
                style={{
                  padding: "7px 20px", borderRadius: 5,
                  background: T.navy, border: `1px solid ${T.navyHi}`,
                  color: T.white, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", transition: "background 0.14s",
                }}
                onMouseEnter={e => e.target.style.background = T.navyHi}
                onMouseLeave={e => e.target.style.background = T.navy}
              >
                Next →
              </button>
            )}

            {step === "confirm" && (
              <button
                onClick={handleImport}
                disabled={selCount === 0}
                style={{
                  padding: "7px 24px", borderRadius: 5,
                  background: selCount === 0 ? T.bg3 : T.green,
                  border: `1px solid ${selCount === 0 ? T.border : T.green}`,
                  color: selCount === 0 ? T.slate : "#000",
                  fontSize: 13, fontWeight: 700,
                  cursor: selCount === 0 ? "not-allowed" : "pointer",
                  transition: "all 0.14s",
                }}
              >
                Import {selCount} elements
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
