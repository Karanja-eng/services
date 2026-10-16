/**
 * App.tsx
 * Root application component for the CAD 2D Viewer.
 * Manages: DXF upload, toolbar controls, layer visibility,
 *          animate-linetypes toggle, plot-preview toggle.
 */

import React, { useCallback, useRef, useState } from "react";
import Konva from "konva";
import type { DrawingData } from "./components/CAD2DViewer";
import { CAD2DViewer } from "./components/CAD2DViewer";
import LayerPanel from "./components/LayerPanel";

// ─────────────────────────────────────────────────────────────────────────────
// Toolbar
// ─────────────────────────────────────────────────────────────────────────────

interface ToolbarProps {
  filename: string | null;
  animateLinetypes: boolean;
  onToggleAnimate: () => void;
  plotPreview: boolean;
  onTogglePlotPreview: () => void;
  onUpload: (file: File) => void;
  onExportPNG: () => void;
  loading: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
  filename,
  animateLinetypes,
  onToggleAnimate,
  plotPreview,
  onTogglePlotPreview,
  onUpload,
  onExportPNG,
  loading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 14px",
        background: "#0a0e1a",
        borderBottom: "1px solid rgba(100,150,255,0.15)",
        flexWrap: "wrap",
        zIndex: 10,
        flexShrink: 0,
      }}
    >
      {/* Wordmark */}
      <span
        style={{
          fontFamily: "'Courier New', monospace",
          fontSize: "13px",
          fontWeight: 700,
          color: "#4a90d9",
          letterSpacing: "0.15em",
          marginRight: "6px",
          whiteSpace: "nowrap",
        }}
      >
        ⬡ CAD VIEWER
      </span>

      <Divider />

      {/* Open DXF */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".dxf"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
      <ToolButton
        onClick={() => fileInputRef.current?.click()}
        title="Open DXF file"
        active={false}
        disabled={loading}
      >
        {loading ? "⟳ Loading…" : "⊞ Open DXF"}
      </ToolButton>

      {/* Filename */}
      {filename && (
        <span
          style={{
            fontSize: "11px",
            color: "#556",
            fontFamily: "monospace",
            maxWidth: "180px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={filename}
        >
          {filename}
        </span>
      )}

      <Divider />

      {/* Animate Linetypes */}
      <ToolButton
        onClick={onToggleAnimate}
        active={animateLinetypes}
        title="Animate CENTER / PHANTOM linetypes (subtle scroll)"
      >
        ∿ Animate Linetypes
      </ToolButton>

      {/* Plot Preview */}
      <ToolButton
        onClick={onTogglePlotPreview}
        active={plotPreview}
        title="Plot preview: white background, print-weight line widths"
      >
        ⎙ Plot Preview
      </ToolButton>

      <Divider />

      {/* Export PNG */}
      <ToolButton
        onClick={onExportPNG}
        active={false}
        disabled={false}
        title="Export visible canvas as PNG"
      >
        ↓ Export PNG
      </ToolButton>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Small utilities
// ─────────────────────────────────────────────────────────────────────────────

const Divider = () => (
  <div
    style={{
      width: "1px",
      height: "20px",
      background: "rgba(255,255,255,0.1)",
      flexShrink: 0,
    }}
  />
);

interface ToolButtonProps {
  onClick: () => void;
  active: boolean;
  title?: string;
  disabled?: boolean;
  children: React.ReactNode;
}

const ToolButton: React.FC<ToolButtonProps> = ({
  onClick,
  active,
  title,
  disabled,
  children,
}) => (
  <button
    onClick={onClick}
    title={title}
    disabled={disabled}
    style={{
      background: active ? "rgba(74,144,217,0.18)" : "rgba(255,255,255,0.04)",
      border: active
        ? "1px solid rgba(74,144,217,0.5)"
        : "1px solid rgba(255,255,255,0.1)",
      borderRadius: "4px",
      color: active ? "#7bbfff" : "#9aa",
      fontSize: "11px",
      padding: "4px 10px",
      cursor: disabled ? "not-allowed" : "pointer",
      whiteSpace: "nowrap",
      transition: "all 0.15s",
      opacity: disabled ? 0.5 : 1,
      fontFamily: "monospace",
      letterSpacing: "0.04em",
    }}
  >
    {children}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate readout
// ─────────────────────────────────────────────────────────────────────────────

interface CoordBarProps {
  coords: { x: number; y: number } | null;
  scale: number;
}

const CoordBar: React.FC<CoordBarProps> = ({ coords, scale }) => (
  <div
    style={{
      padding: "3px 14px",
      background: "#070b14",
      borderTop: "1px solid rgba(255,255,255,0.06)",
      fontSize: "10px",
      color: "#445",
      fontFamily: "monospace",
      display: "flex",
      gap: "20px",
      flexShrink: 0,
    }}
  >
    {coords ? (
      <>
        <span>X: {coords.x.toFixed(3)}</span>
        <span>Y: {coords.y.toFixed(3)}</span>
      </>
    ) : (
      <span>Move mouse over drawing</span>
    )}
    <span style={{ marginLeft: "auto" }}>Zoom: {(scale * 100).toFixed(0)}%</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Status / error overlay
// ─────────────────────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ error: string | null }> = ({ error }) => (
  <div
    style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      color: "#334",
      gap: "12px",
      padding: "40px",
    }}
  >
    {error ? (
      <>
        <span style={{ fontSize: "28px" }}>⚠</span>
        <span style={{ color: "#c55", fontFamily: "monospace", fontSize: "13px", textAlign: "center" }}>
          {error}
        </span>
      </>
    ) : (
      <>
        <span style={{ fontSize: "40px", opacity: 0.3 }}>⬡</span>
        <span style={{ fontFamily: "monospace", fontSize: "13px", letterSpacing: "0.1em" }}>
          Open a DXF file to begin
        </span>
        <span style={{ fontSize: "11px", opacity: 0.5 }}>
          Supports lineweights, linetypes, layers, and plot preview
        </span>
      </>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const App: React.FC = () => {
  const [data, setData] = useState<DrawingData | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());
  const [animateLinetypes, setAnimateLinetypes] = useState(false);
  const [plotPreview, setPlotPreview] = useState(false);

  // Zoom level for coord bar
  const [zoom, setZoom] = useState(1);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  const stageRef = useRef<Konva.Stage>(null);

  // ── Upload ───────────────────────────────────────────────────────────────

  const handleUpload = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setFilename(file.name);
    setHiddenLayers(new Set());

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/api/parse-dxf`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `Server error ${res.status}`);
      }
      const json: DrawingData = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Layer toggle ─────────────────────────────────────────────────────────

  const handleToggleLayer = useCallback((name: string) => {
    setHiddenLayers((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }, []);

  // ── Export PNG ───────────────────────────────────────────────────────────

  const handleExportPNG = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const uri = stage.toDataURL({ pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = uri;
    a.download = filename ? filename.replace(/\.dxf$/i, ".png") : "cad-export.png";
    a.click();
  }, [filename]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#0a0e1a",
        color: "#ccc",
        fontFamily: "system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      <Toolbar
        filename={filename}
        animateLinetypes={animateLinetypes}
        onToggleAnimate={() => setAnimateLinetypes((v) => !v)}
        plotPreview={plotPreview}
        onTogglePlotPreview={() => setPlotPreview((v) => !v)}
        onUpload={handleUpload}
        onExportPNG={handleExportPNG}
        loading={loading}
      />

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, position: "relative" }}>
        {/* Canvas */}
        <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
          {!data || loading ? (
            loading ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "#446",
                  fontSize: "13px",
                  fontFamily: "monospace",
                  letterSpacing: "0.1em",
                }}
              >
                ⟳ Parsing DXF…
              </div>
            ) : (
              <EmptyState error={error} />
            )
          ) : (
            <CAD2DViewer
              data={data}
              hiddenLayers={hiddenLayers}
              animateLinetypes={animateLinetypes}
              plotPreview={plotPreview}
              stageRef={stageRef}
            />
          )}
        </div>

        {/* Layer panel — floating over canvas */}
        {data && (
          <div
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              zIndex: 100,
            }}
          >
            <LayerPanel
              layers={data.layers}
              hiddenLayers={hiddenLayers}
              onToggleLayer={handleToggleLayer}
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      <CoordBar coords={coords} scale={zoom} />
    </div>
  );
};

export default App;
