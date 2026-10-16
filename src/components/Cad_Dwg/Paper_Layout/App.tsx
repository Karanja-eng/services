// App.tsx — CAD Viewer with full Paper Space Layout support
import React, { useState, useCallback, useRef, useMemo } from "react";
import LayoutTabs, { LayoutDescriptor, ViewportDescriptor } from "./components/LayoutTabs";
import CAD2DViewer from "./components/CAD2DViewer";
import LayerPanel from "./components/LayerPanel";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LayerInfo {
  name: string;
  color: number;
  linetype: string;
  is_off: boolean;
  is_frozen: boolean;
  is_locked: boolean;
  lineweight: number;
}

interface DXFEntity {
  type: string;
  handle: string;
  layer: string;
  color: string;
  [key: string]: any;
}

interface ParsedDXF {
  filename: string;
  layers: LayerInfo[];
  blocks: Record<string, DXFEntity[]>;
  entities: DXFEntity[];
  layouts: LayoutDescriptor[];
}

// ─── Upload area ──────────────────────────────────────────────────────────────

const UploadZone: React.FC<{ onFile: (f: File) => void; loading: boolean; error: string | null }> = ({
  onFile, loading, error,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div style={uploadStyles.root}>
      <div
        style={{
          ...uploadStyles.zone,
          borderColor: dragging ? "#7aa2ff" : "#2d2d5a",
          background: dragging ? "#1a1a3a" : "#131326",
        }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".dxf,.dwg"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />

        {loading ? (
          <div style={uploadStyles.loading}>
            <div style={uploadStyles.spinner} />
            <span>Parsing DXF…</span>
          </div>
        ) : (
          <>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ marginBottom: 16 }}>
              <rect x="8" y="4" width="24" height="32" rx="2" stroke="#4444aa" strokeWidth="2" fill="none" />
              <path d="M28 4v10h12" stroke="#4444aa" strokeWidth="2" fill="none" />
              <path d="M32 4l8 10" stroke="#4444aa" strokeWidth="1.5" fill="none" />
              <line x1="14" y1="18" x2="28" y2="18" stroke="#4444aa" strokeWidth="1.5" />
              <line x1="14" y1="24" x2="28" y2="24" stroke="#4444aa" strokeWidth="1.5" />
              <line x1="14" y1="30" x2="22" y2="30" stroke="#4444aa" strokeWidth="1.5" />
              <path d="M36 30v12M30 36l6-6 6 6" stroke="#7aa2ff" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p style={uploadStyles.headline}>Drop DXF or DWG file here</p>
            <p style={uploadStyles.sub}>or click to browse</p>
            {error && <p style={uploadStyles.error}>{error}</p>}
          </>
        )}
      </div>
    </div>
  );
};

const uploadStyles: Record<string, React.CSSProperties> = {
  root: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0d0d1a",
  },
  zone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: 420,
    height: 320,
    border: "2px dashed",
    borderRadius: 12,
    cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
    padding: 32,
    textAlign: "center",
  },
  headline: {
    color: "#9999cc",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', monospace",
    margin: "0 0 6px",
  },
  sub: {
    color: "#4444aa",
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
    margin: 0,
  },
  error: {
    color: "#ff6688",
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
    marginTop: 12,
    maxWidth: 360,
  },
  loading: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    color: "#7aa2ff",
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
  },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid #2d2d5a",
    borderTop: "3px solid #7aa2ff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};

// ─── Main App ─────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const [dxf, setDxf] = useState<ParsedDXF | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeLayoutIndex, setActiveLayoutIndex] = useState(0);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});
  const [activeViewportId, setActiveViewportId] = useState<string | null>(null);

  // ── Upload handler ────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setActiveLayoutIndex(0);
    setActiveViewportId(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(body.detail || `HTTP ${res.status}`);
      }
      const data: ParsedDXF = await res.json();
      setDxf(data);

      // Initialise layer visibility from server flags
      const vis: Record<string, boolean> = {};
      for (const layer of data.layers) {
        vis[layer.name] = !layer.is_off && !layer.is_frozen;
      }
      setLayerVisibility(vis);
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Active layout ─────────────────────────────────────────────────────────
  const activeLayout = dxf?.layouts[activeLayoutIndex] ?? null;

  // Model space entities (always from layout[0])
  const modelEntities = useMemo(
    () => dxf?.layouts.find((l) => l.is_modelspace)?.paper_entities ?? [],
    [dxf]
  );

  // ── Active viewport (for layer panel) ─────────────────────────────────────
  const activeViewport = useMemo((): ViewportDescriptor | null => {
    if (!activeLayout || activeLayout.is_modelspace) return null;
    if (!activeViewportId && activeLayout.viewports.length > 0)
      return activeLayout.viewports[0];
    return activeLayout.viewports.find((v) => v.id === activeViewportId) ?? null;
  }, [activeLayout, activeViewportId]);

  // ── Layer visibility handlers ─────────────────────────────────────────────
  const handleToggleLayer = useCallback((name: string) => {
    setLayerVisibility((prev) => ({ ...prev, [name]: !(prev[name] ?? true) }));
  }, []);

  const handleToggleAll = useCallback((visible: boolean) => {
    setLayerVisibility((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) next[k] = visible;
      return next;
    });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!dxf || loading) {
    return (
      <div style={appStyles.root}>
        <div style={appStyles.topbar}>
          <span style={appStyles.brand}>CAD Viewer</span>
          {dxf && (
            <button style={appStyles.newBtn} onClick={() => setDxf(null)}>
              Open Another
            </button>
          )}
        </div>
        <UploadZone onFile={handleFile} loading={loading} error={error} />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          @keyframes spin { to { transform: rotate(360deg); } }
          ::-webkit-scrollbar { width: 4px; height: 4px; }
          ::-webkit-scrollbar-track { background: #0d0d1a; }
          ::-webkit-scrollbar-thumb { background: #2d2d4a; border-radius: 2px; }
        `}</style>
      </div>
    );
  }

  return (
    <div style={appStyles.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0d0d1a; }
        ::-webkit-scrollbar-thumb { background: #2d2d4a; border-radius: 2px; }
      `}</style>

      {/* Top bar */}
      <div style={appStyles.topbar}>
        <span style={appStyles.brand}>CAD Viewer</span>
        <span style={appStyles.filename}>{dxf.filename}</span>
        <span style={appStyles.stats}>
          {dxf.layouts.length} layout{dxf.layouts.length !== 1 ? "s" : ""}
          {" · "}
          {dxf.layers.length} layers
          {" · "}
          {modelEntities.length} entities
        </span>
        <button style={appStyles.newBtn} onClick={() => setDxf(null)}>
          Open
        </button>
      </div>

      {/* Layout tabs */}
      <LayoutTabs
        layouts={dxf.layouts}
        activeIndex={activeLayoutIndex}
        onChange={(i) => {
          setActiveLayoutIndex(i);
          setActiveViewportId(null);
        }}
      />

      {/* Main content */}
      <div style={appStyles.content}>
        {activeLayout && (
          <CAD2DViewer
            layout={activeLayout}
            modelEntities={modelEntities}
            blocks={dxf.blocks}
            layerVisibility={layerVisibility}
            activeViewportId={activeViewportId}
            onActiveViewportChange={setActiveViewportId}
          />
        )}

        <LayerPanel
          layers={dxf.layers}
          visibility={layerVisibility}
          onToggle={handleToggleLayer}
          onToggleAll={handleToggleAll}
          activeViewport={activeViewport}
        />
      </div>
    </div>
  );
};

const appStyles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "#0d0d1a",
    fontFamily: "'JetBrains Mono', monospace",
    overflow: "hidden",
  },
  topbar: {
    display: "flex",
    alignItems: "center",
    padding: "0 14px",
    height: 42,
    background: "#0d0d1a",
    borderBottom: "1px solid #1e1e3a",
    flexShrink: 0,
    gap: 12,
  },
  brand: {
    fontSize: 13,
    fontWeight: 700,
    color: "#7aa2ff",
    letterSpacing: "0.05em",
  },
  filename: {
    fontSize: 11,
    color: "#5555aa",
    maxWidth: 320,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  stats: {
    fontSize: 10,
    color: "#3d3d6a",
    flex: 1,
  },
  newBtn: {
    fontSize: 11,
    padding: "4px 12px",
    background: "transparent",
    border: "1px solid #3d3d5a",
    borderRadius: 4,
    color: "#6677aa",
    cursor: "pointer",
    fontFamily: "'JetBrains Mono', monospace",
  },
  content: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
};

export default App;
