import React, { useState, useCallback, useRef } from "react";
import { CAD2DViewer, CadDrawing } from "./components/CAD2DViewer";
import {
  GeneratedViewsPanel,
  GeneratedView,
} from "./components/GeneratedViewsPanel";

const API_BASE = "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Tab {
  id: string;
  label: string;
  drawing: CadDrawing;
  isGenerated: boolean;
}

// ─── Upload zone ──────────────────────────────────────────────────────────────
interface UploadZoneProps {
  onUpload: (drawing: CadDrawing, sessionId: string) => void;
}

const UploadZone: React.FC<UploadZoneProps> = ({ onUpload }) => {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".dxf")) {
      setError("Only .dxf files are supported");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const resp = await fetch(`${API_BASE}/api/cad/upload`, {
        method: "POST",
        body: form,
      });
      if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
      const meta = await resp.json();

      // Fetch full drawing data
      const drawingResp = await fetch(
        `${API_BASE}/api/cad/drawing/${meta.session_id}`
      );
      if (!drawingResp.ok) throw new Error("Failed to load drawing");
      const drawing: CadDrawing = await drawingResp.json();
      onUpload(drawing, meta.session_id);
    } catch (e: any) {
      setError(e.message ?? "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={uploadStyles.wrapper}>
      <div
        style={{
          ...uploadStyles.zone,
          ...(dragging ? uploadStyles.zoneDragging : {}),
        }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".dxf"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {loading ? (
          <>
            <div style={uploadStyles.spinner} />
            <p style={uploadStyles.hint}>Parsing DXF file…</p>
          </>
        ) : (
          <>
            <DxfIllustration />
            <p style={uploadStyles.title}>Drop a DXF file here</p>
            <p style={uploadStyles.hint}>or click to browse</p>
            {error && <p style={uploadStyles.error}>{error}</p>}
          </>
        )}
      </div>
    </div>
  );
};

const DxfIllustration = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ opacity: 0.4 }}>
    <rect x="8" y="6" width="36" height="48" rx="3" stroke="#6b7aff" strokeWidth="2"/>
    <path d="M44 6l8 8H44V6Z" fill="#6b7aff" opacity="0.4"/>
    <path d="M44 6v8h8" stroke="#6b7aff" strokeWidth="1.5"/>
    <line x1="14" y1="22" x2="38" y2="22" stroke="#6b7aff" strokeWidth="1.5" opacity="0.6"/>
    <line x1="14" y1="29" x2="38" y2="29" stroke="#6b7aff" strokeWidth="1.5" opacity="0.4"/>
    <line x1="14" y1="36" x2="28" y2="36" stroke="#6b7aff" strokeWidth="1.5" opacity="0.3"/>
    <line x1="14" y1="43" x2="34" y2="43" stroke="#6b7aff" strokeWidth="1.5" opacity="0.2"/>
    <text x="12" y="17" fontSize="7" fill="#6b7aff" fontFamily="monospace">DXF</text>
  </svg>
);

// ─── Tab bar ──────────────────────────────────────────────────────────────────
interface TabBarProps {
  tabs: Tab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

const TabBar: React.FC<TabBarProps> = ({ tabs, activeId, onSelect, onClose }) => (
  <div style={tabStyles.bar}>
    {tabs.map((tab) => (
      <div
        key={tab.id}
        style={{
          ...tabStyles.tab,
          ...(tab.id === activeId ? tabStyles.tabActive : {}),
          ...(tab.isGenerated ? tabStyles.tabGenerated : {}),
        }}
        onClick={() => onSelect(tab.id)}
      >
        <span style={tabStyles.tabIcon}>
          {tab.isGenerated ? (
            tab.label.startsWith("SECTION") ? "⊤" : "⊞"
          ) : "⬜"}
        </span>
        <span style={tabStyles.tabLabel}>{tab.label}</span>
        <button
          style={tabStyles.tabClose}
          onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
          title="Close"
        >
          ×
        </button>
      </div>
    ))}
  </div>
);

// ─── App ──────────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [sourceSessionId, setSourceSessionId] = useState<string | null>(null);
  const [generatedViews, setGeneratedViews] = useState<GeneratedView[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  // ── Upload handler ─────────────────────────────────────────────────────
  const handleUpload = useCallback((drawing: CadDrawing, sessionId: string) => {
    const tab: Tab = {
      id: sessionId,
      label: drawing.filename ?? "Drawing",
      drawing,
      isGenerated: false,
    };
    setTabs((prev) => {
      const existing = prev.find((t) => t.id === sessionId);
      if (existing) return prev;
      return [...prev, tab];
    });
    setActiveTabId(sessionId);
    setSourceSessionId(sessionId);
    setGeneratedViews([]);
  }, []);

  // ── Generated view handlers ────────────────────────────────────────────
  const handleSectionGenerated = useCallback((data: CadDrawing) => {
    const meta = data.section_meta!;
    const view: GeneratedView = {
      session_id: data.session_id,
      label: meta.cut_direction_label,
      type: "section",
      cut_line_start: meta.cut_line_start as [number, number],
      cut_line_end: meta.cut_line_end as [number, number],
      entity_count: data.entities.length,
    };
    setGeneratedViews((prev) => {
      const exists = prev.find((v) => v.session_id === data.session_id);
      if (exists) return prev;
      return [...prev, view];
    });
    // Auto-open the generated section in a new tab
    openGeneratedTab(data);
  }, []);

  const handleElevationGenerated = useCallback((data: CadDrawing) => {
    const meta = data.section_meta!;
    const view: GeneratedView = {
      session_id: data.session_id,
      label: meta.cut_direction_label,
      type: "elevation",
      cut_line_start: meta.cut_line_start as [number, number],
      cut_line_end: meta.cut_line_end as [number, number],
      entity_count: data.entities.length,
    };
    setGeneratedViews((prev) => {
      const exists = prev.find((v) => v.session_id === data.session_id);
      if (exists) return prev;
      return [...prev, view];
    });
    openGeneratedTab(data);
  }, []);

  const openGeneratedTab = (data: CadDrawing) => {
    const meta = data.section_meta!;
    const typePrefix = meta.type === "section" ? "SECTION" : "ELEVATION";
    const tab: Tab = {
      id: data.session_id,
      label: `${typePrefix} ${meta.cut_direction_label}`,
      drawing: data,
      isGenerated: true,
    };
    setTabs((prev) => {
      const exists = prev.find((t) => t.id === data.session_id);
      if (exists) return prev;
      return [...prev, tab];
    });
    setActiveTabId(data.session_id);
  };

  // ── View select from panel ─────────────────────────────────────────────
  const handleViewSelect = useCallback(async (sessionId: string) => {
    // Check if already open as tab
    const existing = tabs.find((t) => t.id === sessionId);
    if (existing) {
      setActiveTabId(sessionId);
      return;
    }
    // Fetch the drawing
    try {
      const resp = await fetch(`${API_BASE}/api/cad/drawing/${sessionId}`);
      if (!resp.ok) throw new Error("Not found");
      const drawing: CadDrawing = await resp.json();
      openGeneratedTab(drawing);
    } catch {
      // Session may already be in tabs via local state
    }
  }, [tabs]);

  // ── View delete ────────────────────────────────────────────────────────
  const handleViewDelete = useCallback(async (sessionId: string) => {
    try {
      await fetch(`${API_BASE}/api/cad/section/${sessionId}`, { method: "DELETE" });
    } catch { /* best-effort */ }
    setGeneratedViews((prev) => prev.filter((v) => v.session_id !== sessionId));
    setTabs((prev) => prev.filter((t) => t.id !== sessionId));
    if (activeTabId === sessionId) {
      setActiveTabId(tabs.find((t) => t.id !== sessionId)?.id ?? null);
    }
  }, [activeTabId, tabs]);

  // ── View export ────────────────────────────────────────────────────────
  const handleViewExport = useCallback(async (sessionId: string, label: string) => {
    try {
      const resp = await fetch(`${API_BASE}/api/cad/export/${sessionId}`, { method: "POST" });
      if (!resp.ok) throw new Error("Export failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${label.replace(/\s+/g, "_")}.dxf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    }
  }, []);

  // ── Tab close ──────────────────────────────────────────────────────────
  const handleTabClose = useCallback((id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeTabId === id) {
        setActiveTabId(next[next.length - 1]?.id ?? null);
      }
      return next;
    });
  }, [activeTabId]);

  // ── Render ─────────────────────────────────────────────────────────────
  const showUpload = tabs.length === 0;

  return (
    <div style={appStyles.root}>
      {/* ── Global CSS injections ──────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0c0e12; color: #c8cad0; overflow: hidden; }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0e1015; }
        ::-webkit-scrollbar-thumb { background: #2a2d35; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #3a3d50; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.4; }
        select option { background: #111318; }
      `}</style>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header style={appStyles.header}>
        <div style={appStyles.headerLogo}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="1" y="1" width="20" height="20" rx="4" stroke="#6b7aff" strokeWidth="1.5"/>
            <path d="M5 17L8 5h2l3 8 2-5h2" stroke="#6b7aff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={appStyles.headerTitle}>CAD Section Engine</span>
        </div>

        {tabs.length > 0 && (
          <TabBar
            tabs={tabs}
            activeId={activeTabId}
            onSelect={setActiveTabId}
            onClose={handleTabClose}
          />
        )}

        <div style={appStyles.headerRight}>
          {/* Upload new file button */}
          <label style={appStyles.uploadBtn} title="Open DXF file">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v7M4 4l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1 10v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>Open DXF</span>
            <input
              type="file"
              accept=".dxf"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const form = new FormData();
                form.append("file", file);
                fetch(`${API_BASE}/api/cad/upload`, { method: "POST", body: form })
                  .then((r) => r.json())
                  .then(async (meta) => {
                    const dr = await fetch(`${API_BASE}/api/cad/drawing/${meta.session_id}`);
                    const drawing = await dr.json();
                    handleUpload(drawing, meta.session_id);
                  })
                  .catch(console.error);
              }}
            />
          </label>

          {/* Sidebar toggle */}
          <button
            style={{
              ...appStyles.sidebarToggle,
              ...(sidebarOpen ? appStyles.sidebarToggleActive : {}),
            }}
            onClick={() => setSidebarOpen((v) => !v)}
            title="Toggle generated views panel"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="9" y1="1" x2="9" y2="13" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── Main area ─────────────────────────────────────────────────── */}
      <div style={appStyles.main}>
        {/* Viewer area */}
        <div style={appStyles.viewerArea}>
          {showUpload ? (
            <UploadZone onUpload={handleUpload} />
          ) : (
            <CAD2DViewer
              drawing={activeTab?.drawing ?? null}
              sessionId={
                activeTab?.isGenerated
                  ? sourceSessionId   // use source session for section/elev gen
                  : (activeTab?.id ?? null)
              }
              onSectionGenerated={handleSectionGenerated}
              onElevationGenerated={handleElevationGenerated}
              apiBase={API_BASE}
            />
          )}
        </div>

        {/* Generated views sidebar */}
        {sidebarOpen && !showUpload && (
          <GeneratedViewsPanel
            views={generatedViews}
            activeViewId={activeTabId}
            onViewSelect={handleViewSelect}
            onViewDelete={handleViewDelete}
            onViewExport={handleViewExport}
          />
        )}
      </div>
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const appStyles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    width: "100vw",
    background: "#0c0e12",
    fontFamily: "'DM Mono', 'Fira Code', 'Courier New', monospace",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 0,
    height: 44,
    background: "#0e1015",
    borderBottom: "1px solid #1e2130",
    flexShrink: 0,
    overflow: "hidden",
  },
  headerLogo: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "0 16px",
    borderRight: "1px solid #1e2130",
    height: "100%",
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: "#7a8aaa",
    letterSpacing: "0.06em",
    whiteSpace: "nowrap" as const,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginLeft: "auto",
    padding: "0 12px",
    flexShrink: 0,
  },
  uploadBtn: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 10px",
    background: "#1a1d28",
    border: "1px solid #2a3050",
    borderRadius: 5,
    color: "#7a9eff",
    cursor: "pointer",
    fontSize: 11,
    fontFamily: "'DM Mono', monospace",
    transition: "all 0.12s",
    whiteSpace: "nowrap" as const,
  },
  sidebarToggle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 30,
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: 5,
    color: "#5a6080",
    cursor: "pointer",
    transition: "all 0.12s",
  },
  sidebarToggleActive: {
    background: "#1a1d28",
    border: "1px solid #2a2d40",
    color: "#8a9aff",
  },
  main: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  viewerArea: {
    flex: 1,
    overflow: "hidden",
    position: "relative" as const,
  },
};

const tabStyles: Record<string, React.CSSProperties> = {
  bar: {
    display: "flex",
    alignItems: "stretch",
    height: "100%",
    overflowX: "auto" as const,
    flex: 1,
    gap: 1,
    padding: "0 4px",
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "0 10px 0 8px",
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    borderRight: "1px solid #1e2130",
    color: "#5a6070",
    fontSize: 11,
    whiteSpace: "nowrap" as const,
    transition: "all 0.12s",
    userSelect: "none" as const,
    flexShrink: 0,
  },
  tabActive: {
    color: "#c8d0e0",
    borderBottomColor: "#6b7aff",
    background: "#111318",
  },
  tabGenerated: {
    borderBottomColor: "transparent",
  },
  tabIcon: {
    fontSize: 11,
    opacity: 0.6,
  },
  tabLabel: {
    letterSpacing: "0.04em",
    fontWeight: 500,
  },
  tabClose: {
    background: "transparent",
    border: "none",
    color: "inherit",
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1,
    padding: "0 2px",
    opacity: 0.4,
    marginLeft: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

const uploadStyles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    padding: 40,
    background: "#0c0e12",
  },
  zone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    width: "100%",
    maxWidth: 440,
    aspectRatio: "4/3",
    background: "#0e1015",
    border: "2px dashed #2a2d40",
    borderRadius: 12,
    cursor: "pointer",
    transition: "all 0.15s",
    padding: 32,
    textAlign: "center" as const,
  },
  zoneDragging: {
    background: "#12152a",
    border: "2px dashed #6b7aff",
    boxShadow: "0 0 0 4px #6b7aff18",
  },
  title: {
    fontSize: 15,
    fontWeight: 600,
    color: "#7a8aaa",
    letterSpacing: "0.03em",
  },
  hint: {
    fontSize: 12,
    color: "#404460",
  },
  error: {
    fontSize: 11,
    color: "#ef6060",
    background: "#2a1414",
    border: "1px solid #5a2a2a",
    borderRadius: 4,
    padding: "5px 12px",
  },
  spinner: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "2px solid #2a2d40",
    borderTop: "2px solid #6b7aff",
    animation: "spin 0.8s linear infinite",
  },
};

export default App;
