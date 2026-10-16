/**
 * LayerPanel.tsx
 * Sidebar panel with Layer toggles + collapsible Block Sources filter.
 */

import React, { useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CadEntity {
  id: string;
  type: string;
  layer: string;
  color: string;
  block_source?: string | null;
  [key: string]: unknown;
}

export interface LayerPanelProps {
  entities: CadEntity[];
  /** Set of currently visible layer names */
  visibleLayers: Set<string>;
  onLayerToggle: (layer: string) => void;
  /** Set of currently visible block source names */
  visibleBlockSources: Set<string>;
  onBlockSourceToggle: (blockSource: string) => void;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const CheckIcon: React.FC<{ checked: boolean; color?: string }> = ({ checked, color }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 14,
      height: 14,
      borderRadius: 2,
      border: `2px solid ${color ?? "#888"}`,
      backgroundColor: checked ? (color ?? "#888") : "transparent",
      flexShrink: 0,
      transition: "background-color 0.15s",
    }}
  >
    {checked && (
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
        <path d="M1 4l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )}
  </span>
);

const CollapseArrow: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    style={{
      transform: open ? "rotate(90deg)" : "rotate(0deg)",
      transition: "transform 0.2s",
      flexShrink: 0,
    }}
  >
    <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
  </svg>
);

// Deterministic color from a block name for the swatch
function blockColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 65%, 55%)`;
}

// ---------------------------------------------------------------------------
// LayerPanel component
// ---------------------------------------------------------------------------

export const LayerPanel: React.FC<LayerPanelProps> = ({
  entities,
  visibleLayers,
  onLayerToggle,
  visibleBlockSources,
  onBlockSourceToggle,
}) => {
  const [blockSectionOpen, setBlockSectionOpen] = useState(true);
  const [layerSearch, setLayerSearch] = useState("");
  const [blockSearch, setBlockSearch] = useState("");

  // Derive unique layers with entity counts
  const layers = useMemo(() => {
    const map = new Map<string, { color: string; count: number }>();
    for (const e of entities) {
      const l = e.layer ?? "0";
      const prev = map.get(l);
      if (prev) {
        prev.count++;
      } else {
        map.set(l, { color: e.color, count: 1 });
      }
    }
    return Array.from(map.entries())
      .map(([name, { color, count }]) => ({ name, color, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entities]);

  // Derive unique block sources with entity counts
  const blockSources = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entities) {
      if (e.block_source) {
        map.set(e.block_source, (map.get(e.block_source) ?? 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entities]);

  const filteredLayers = useMemo(
    () =>
      layerSearch
        ? layers.filter((l) => l.name.toLowerCase().includes(layerSearch.toLowerCase()))
        : layers,
    [layers, layerSearch]
  );

  const filteredBlocks = useMemo(
    () =>
      blockSearch
        ? blockSources.filter((b) => b.name.toLowerCase().includes(blockSearch.toLowerCase()))
        : blockSources,
    [blockSources, blockSearch]
  );

  const allLayersVisible = layers.every((l) => visibleLayers.has(l.name));
  const allBlocksVisible = blockSources.every((b) => visibleBlockSources.has(b.name));

  function toggleAllLayers() {
    const target = !allLayersVisible;
    layers.forEach((l) => {
      if (visibleLayers.has(l.name) !== target) onLayerToggle(l.name);
    });
  }

  function toggleAllBlocks() {
    const target = !allBlocksVisible;
    blockSources.forEach((b) => {
      if (visibleBlockSources.has(b.name) !== target) onBlockSourceToggle(b.name);
    });
  }

  return (
    <aside
      style={{
        width: 240,
        minWidth: 200,
        height: "100%",
        overflowY: "auto",
        backgroundColor: "#1a1a2e",
        color: "#e0e0e0",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        fontSize: 12,
        borderRight: "1px solid #2e2e4e",
        display: "flex",
        flexDirection: "column",
        userSelect: "none",
      }}
    >
      {/* ── Header ───────────────────────────────────── */}
      <div
        style={{
          padding: "12px 14px 8px",
          borderBottom: "1px solid #2e2e4e",
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: "0.05em",
          color: "#a0a8ff",
        }}
      >
        LAYERS & BLOCKS
      </div>

      {/* ── LAYERS section ───────────────────────────── */}
      <div style={{ padding: "10px 14px 4px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <span style={{ fontWeight: 600, color: "#9090bb", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Layers
          </span>
          <button
            onClick={toggleAllLayers}
            style={toggleAllBtnStyle}
            title={allLayersVisible ? "Hide all layers" : "Show all layers"}
          >
            {allLayersVisible ? "Hide all" : "Show all"}
          </button>
        </div>

        <input
          value={layerSearch}
          onChange={(e) => setLayerSearch(e.target.value)}
          placeholder="Filter layers…"
          style={searchInputStyle}
        />
      </div>

      <div style={{ flex: "0 1 auto", overflowY: "auto", maxHeight: 280 }}>
        {filteredLayers.length === 0 && (
          <div style={{ padding: "6px 14px", color: "#666" }}>No layers found</div>
        )}
        {filteredLayers.map((layer) => {
          const visible = visibleLayers.has(layer.name);
          return (
            <LayerRow
              key={layer.name}
              label={layer.name}
              color={layer.color}
              count={layer.count}
              visible={visible}
              onToggle={() => onLayerToggle(layer.name)}
            />
          );
        })}
      </div>

      <div style={{ borderTop: "1px solid #2e2e4e", margin: "4px 0" }} />

      {/* ── BLOCK SOURCES section ────────────────────── */}
      {blockSources.length > 0 && (
        <>
          <div style={{ padding: "8px 14px 4px" }}>
            <button
              onClick={() => setBlockSectionOpen((o) => !o)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "none",
                border: "none",
                color: "#9090bb",
                cursor: "pointer",
                padding: 0,
                fontWeight: 600,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                width: "100%",
                justifyContent: "space-between",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <CollapseArrow open={blockSectionOpen} />
                Block Sources
                <span
                  style={{
                    background: "#2a2a4e",
                    borderRadius: 10,
                    padding: "1px 6px",
                    fontSize: 10,
                    color: "#7070aa",
                  }}
                >
                  {blockSources.length}
                </span>
              </span>
              {blockSectionOpen && (
                <button
                  onClick={(ev) => { ev.stopPropagation(); toggleAllBlocks(); }}
                  style={toggleAllBtnStyle}
                  title={allBlocksVisible ? "Hide all blocks" : "Show all blocks"}
                >
                  {allBlocksVisible ? "Hide all" : "Show all"}
                </button>
              )}
            </button>
          </div>

          {blockSectionOpen && (
            <>
              <div style={{ padding: "2px 14px 6px" }}>
                <input
                  value={blockSearch}
                  onChange={(e) => setBlockSearch(e.target.value)}
                  placeholder="Filter blocks…"
                  style={searchInputStyle}
                />
              </div>

              <div style={{ flex: "0 1 auto", overflowY: "auto", maxHeight: 300 }}>
                {filteredBlocks.length === 0 && (
                  <div style={{ padding: "6px 14px", color: "#666" }}>No blocks found</div>
                )}
                {filteredBlocks.map((block) => {
                  const visible = visibleBlockSources.has(block.name);
                  return (
                    <LayerRow
                      key={block.name}
                      label={block.name}
                      color={blockColor(block.name)}
                      count={block.count}
                      visible={visible}
                      onToggle={() => onBlockSourceToggle(block.name)}
                      isBlock
                    />
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      <div style={{ flex: 1 }} />

      {/* ── Footer stats ─────────────────────────────── */}
      <div
        style={{
          padding: "8px 14px",
          borderTop: "1px solid #2e2e4e",
          color: "#555577",
          fontSize: 11,
        }}
      >
        {entities.length.toLocaleString()} entities · {layers.length} layers
        {blockSources.length > 0 && ` · ${blockSources.length} blocks`}
      </div>
    </aside>
  );
};

// ---------------------------------------------------------------------------
// LayerRow sub-component (shared by layers and block sources)
// ---------------------------------------------------------------------------

const LayerRow: React.FC<{
  label: string;
  color: string;
  count: number;
  visible: boolean;
  onToggle: () => void;
  isBlock?: boolean;
}> = ({ label, color, count, visible, onToggle, isBlock }) => (
  <div
    onClick={onToggle}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "4px 14px",
      cursor: "pointer",
      opacity: visible ? 1 : 0.4,
      transition: "background 0.1s, opacity 0.15s",
      borderLeft: isBlock ? `3px solid ${color}` : "3px solid transparent",
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLDivElement).style.backgroundColor = "#22224a";
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent";
    }}
  >
    <CheckIcon checked={visible} color={color} />

    {/* Color swatch */}
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: isBlock ? 2 : "50%",
        backgroundColor: color,
        flexShrink: 0,
      }}
    />

    <span
      style={{
        flex: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        color: "#d0d0e8",
        fontSize: 12,
      }}
      title={label}
    >
      {label}
    </span>

    <span style={{ color: "#555577", fontSize: 10, flexShrink: 0 }}>
      {count.toLocaleString()}
    </span>
  </div>
);

// ---------------------------------------------------------------------------
// Shared micro-styles
// ---------------------------------------------------------------------------

const toggleAllBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid #3a3a6a",
  borderRadius: 4,
  color: "#7070aa",
  cursor: "pointer",
  fontSize: 10,
  padding: "2px 6px",
  lineHeight: 1.4,
};

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#12122a",
  border: "1px solid #2e2e4e",
  borderRadius: 4,
  color: "#d0d0e8",
  fontSize: 11,
  padding: "4px 8px",
  outline: "none",
};

export default LayerPanel;
