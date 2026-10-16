// LayerPanel.tsx — Layer visibility panel with viewport-frozen layer support
import React, { useState, useMemo } from "react";
import type { ViewportDescriptor } from "./LayoutTabs";

interface LayerInfo {
  name: string;
  color: number;
  linetype: string;
  is_off: boolean;
  is_frozen: boolean;
  is_locked: boolean;
  lineweight: number;
}

interface LayerPanelProps {
  layers: LayerInfo[];
  visibility: Record<string, boolean>;
  onToggle: (name: string) => void;
  onToggleAll: (visible: boolean) => void;
  /** The active viewport for frozen-layer display */
  activeViewport?: ViewportDescriptor | null;
}

// ACI index 1–255 → approximate CSS hex
function aciToHex(aci: number): string {
  const map: Record<number, string> = {
    1: "#FF2020", 2: "#FFFF00", 3: "#00CC00", 4: "#00CCCC",
    5: "#4488FF", 6: "#CC44CC", 7: "#CCCCCC", 8: "#888888",
    9: "#BBBBBB", 30: "#FF8800", 40: "#FFBB00", 50: "#EEEE66",
    100: "#6688FF", 140: "#FF4488", 200: "#44FFBB", 250: "#AAAAAA",
  };
  if (aci in map) return map[aci];
  if (aci <= 0) return "#FFFFFF";
  if (aci >= 250) return "#AAAAAA";
  // rough interpolation for unmapped values
  const hue = (aci * 360 / 255) % 360;
  return `hsl(${hue}, 80%, 60%)`;
}

const SnowflakeIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
    style={{ flexShrink: 0 }} title="Frozen in active viewport">
    <line x1="5" y1="1" x2="5" y2="9" stroke="#88aaff" strokeWidth="1.2" />
    <line x1="1" y1="5" x2="9" y2="5" stroke="#88aaff" strokeWidth="1.2" />
    <line x1="2.2" y1="2.2" x2="7.8" y2="7.8" stroke="#88aaff" strokeWidth="1.2" />
    <line x1="7.8" y1="2.2" x2="2.2" y2="7.8" stroke="#88aaff" strokeWidth="1.2" />
  </svg>
);

const LockIcon = () => (
  <svg width="9" height="10" viewBox="0 0 9 10" fill="none" style={{ flexShrink: 0 }}>
    <rect x="1" y="4.5" width="7" height="5" rx="1" stroke="#888" strokeWidth="1" fill="none" />
    <path d="M2.5 4.5V3a2 2 0 0 1 4 0v1.5" stroke="#888" strokeWidth="1" fill="none" />
  </svg>
);

const EyeIcon = ({ open }: { open: boolean }) => (
  <svg width="13" height="10" viewBox="0 0 13 10" fill="none" style={{ flexShrink: 0 }}>
    {open ? (
      <>
        <ellipse cx="6.5" cy="5" rx="5.5" ry="4" stroke="currentColor" strokeWidth="1.1" fill="none" />
        <circle cx="6.5" cy="5" r="1.8" fill="currentColor" />
      </>
    ) : (
      <>
        <ellipse cx="6.5" cy="5" rx="5.5" ry="4" stroke="currentColor" strokeWidth="1.1" fill="none" opacity="0.3" />
        <line x1="1" y1="1" x2="12" y2="9" stroke="currentColor" strokeWidth="1.1" />
      </>
    )}
  </svg>
);

const LayerPanel: React.FC<LayerPanelProps> = ({
  layers,
  visibility,
  onToggle,
  onToggleAll,
  activeViewport,
}) => {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const frozenInViewport = useMemo(
    () => new Set(activeViewport?.frozen_layers ?? []),
    [activeViewport]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return layers;
    const q = search.toLowerCase();
    return layers.filter((l) => l.name.toLowerCase().includes(q));
  }, [layers, search]);

  const allVisible = layers.every((l) => visibility[l.name] !== false);

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>LAYERS</span>
        {activeViewport && (
          <span style={styles.vpTag} title={`Viewport ${activeViewport.id} · ${activeViewport.scale_label}`}>
            VP {activeViewport.scale_label}
          </span>
        )}
        <button
          style={styles.headerBtn}
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? "▸" : "▾"}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Search */}
          <div style={styles.searchRow}>
            <input
              style={styles.search}
              placeholder="Filter layers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Toggle all */}
          <div style={styles.toggleAllRow}>
            <button style={styles.toggleAllBtn} onClick={() => onToggleAll(true)}>All On</button>
            <button style={styles.toggleAllBtn} onClick={() => onToggleAll(false)}>All Off</button>
            <span style={styles.count}>{filtered.length}/{layers.length}</span>
          </div>

          {/* Layer list */}
          <div style={styles.list}>
            {filtered.length === 0 && (
              <div style={styles.empty}>No layers match</div>
            )}
            {filtered.map((layer) => {
              const isVisible = visibility[layer.name] !== false;
              const isFrozenGlobal = layer.is_frozen;
              const isFrozenVP = frozenInViewport.has(layer.name);
              const isLocked = layer.is_locked;
              const colorHex = aciToHex(layer.color);

              return (
                <div
                  key={layer.name}
                  style={{
                    ...styles.row,
                    opacity: (!isVisible || isFrozenGlobal) ? 0.4 : 1,
                  }}
                  title={layer.name}
                >
                  {/* Visibility toggle */}
                  <button
                    style={{
                      ...styles.eyeBtn,
                      color: isVisible ? "#9999bb" : "#333355",
                    }}
                    onClick={() => onToggle(layer.name)}
                  >
                    <EyeIcon open={isVisible && !isFrozenGlobal} />
                  </button>

                  {/* Color swatch */}
                  <div
                    style={{
                      ...styles.swatch,
                      background: colorHex,
                      border: `1px solid ${colorHex}66`,
                    }}
                  />

                  {/* Name */}
                  <span style={styles.name}>{layer.name}</span>

                  {/* Status icons */}
                  <div style={styles.icons}>
                    {isFrozenVP && <SnowflakeIcon />}
                    {isLocked && <LockIcon />}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    background: "#131326",
    borderLeft: "1px solid #2d2d4a",
    width: 220,
    flexShrink: 0,
    fontFamily: "'JetBrains Mono', monospace",
    overflow: "hidden",
    userSelect: "none",
  },
  header: {
    display: "flex",
    alignItems: "center",
    padding: "8px 10px",
    borderBottom: "1px solid #2d2d4a",
    gap: 6,
    flexShrink: 0,
  },
  title: {
    fontSize: 10,
    fontWeight: 700,
    color: "#5555aa",
    letterSpacing: "0.1em",
    flex: 1,
  },
  vpTag: {
    fontSize: 9,
    background: "#1e1e40",
    color: "#7aa2ff",
    borderRadius: 3,
    padding: "1px 5px",
    border: "1px solid #4466cc33",
  },
  headerBtn: {
    background: "none",
    border: "none",
    color: "#5555aa",
    cursor: "pointer",
    fontSize: 12,
    padding: "0 2px",
  },
  searchRow: {
    padding: "6px 8px 4px",
    flexShrink: 0,
  },
  search: {
    width: "100%",
    background: "#1a1a35",
    border: "1px solid #2d2d4a",
    borderRadius: 4,
    color: "#9999cc",
    fontSize: 10,
    padding: "4px 8px",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "'JetBrains Mono', monospace",
  },
  toggleAllRow: {
    display: "flex",
    alignItems: "center",
    padding: "2px 8px 6px",
    gap: 4,
    flexShrink: 0,
    borderBottom: "1px solid #1e1e3a",
  },
  toggleAllBtn: {
    fontSize: 9,
    padding: "2px 6px",
    background: "#1e1e35",
    border: "1px solid #2d2d4a",
    borderRadius: 3,
    color: "#7777aa",
    cursor: "pointer",
    fontFamily: "'JetBrains Mono', monospace",
  },
  count: {
    marginLeft: "auto",
    fontSize: 9,
    color: "#4444aa",
  },
  list: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
  },
  empty: {
    padding: "12px 10px",
    fontSize: 10,
    color: "#4444aa",
    textAlign: "center",
  },
  row: {
    display: "flex",
    alignItems: "center",
    padding: "3px 8px",
    gap: 6,
    cursor: "default",
    transition: "background 0.1s",
    minHeight: 24,
  },
  eyeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    flexShrink: 0,
  },
  name: {
    flex: 1,
    fontSize: 10,
    color: "#9999bb",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  icons: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
};

export default LayerPanel;
