/**
 * LayerPanel.tsx
 * CAD layer panel with per-layer:
 *  - Visibility toggle
 *  - Color swatch
 *  - Lineweight visual bar (thin → thick)
 *  - Linetype preview (mini canvas)
 *  - Expandable "LAYER PROPERTIES" section
 */

import React, { useState } from "react";
import type { LayerMeta } from "./CAD2DViewer";
import { LinetypePreview } from "./CAD2DViewer";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface LineweightBarProps {
  lw_mm: number;
}

/** Renders a visual bar whose height maps lineweight (0.05mm → 2mm). */
const LineweightBar: React.FC<LineweightBarProps> = ({ lw_mm }) => {
  const MAX_MM = 2.0;
  const MIN_PX = 1;
  const MAX_PX = 10;
  const px = Math.round(MIN_PX + ((lw_mm / MAX_MM) * (MAX_PX - MIN_PX)));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        minWidth: "72px",
      }}
    >
      <div
        style={{
          width: "40px",
          height: `${Math.min(px, MAX_PX)}px`,
          background: "currentColor",
          borderRadius: "1px",
          opacity: 0.85,
        }}
      />
      <span style={{ fontSize: "10px", opacity: 0.6, whiteSpace: "nowrap" }}>
        {lw_mm.toFixed(2)}mm
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Layer row
// ─────────────────────────────────────────────────────────────────────────────

interface LayerRowProps {
  layer: LayerMeta;
  isHidden: boolean;
  showProperties: boolean;
  onToggleVisibility: () => void;
}

const LayerRow: React.FC<LayerRowProps> = ({
  layer,
  isHidden,
  showProperties,
  onToggleVisibility,
}) => {
  const dimmed = isHidden || layer.is_off || layer.is_frozen;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        opacity: dimmed ? 0.38 : 1,
        transition: "opacity 0.15s",
      }}
    >
      {/* Main row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "5px 10px",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={onToggleVisibility}
        title={`${isHidden ? "Show" : "Hide"} layer "${layer.name}"`}
      >
        {/* Visibility eye icon */}
        <span
          style={{
            fontSize: "13px",
            color: isHidden ? "#555" : "#aaa",
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          {isHidden ? "○" : "●"}
        </span>

        {/* Color swatch */}
        <div
          style={{
            width: "12px",
            height: "12px",
            borderRadius: "2px",
            background: layer.color,
            border: "1px solid rgba(255,255,255,0.2)",
            flexShrink: 0,
          }}
        />

        {/* Layer name */}
        <span
          style={{
            flex: 1,
            fontSize: "11px",
            fontFamily: "monospace",
            color: "#ccc",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {layer.name}
        </span>

        {/* Frozen / off indicator */}
        {layer.is_frozen && (
          <span style={{ fontSize: "10px", color: "#5599ff", opacity: 0.7 }}>FROZEN</span>
        )}
        {layer.is_off && !layer.is_frozen && (
          <span style={{ fontSize: "10px", color: "#ffaa33", opacity: 0.7 }}>OFF</span>
        )}
      </div>

      {/* Expanded properties section */}
      {showProperties && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "90px 1fr",
            gap: "4px 10px",
            padding: "4px 10px 8px 30px",
            fontSize: "10px",
            color: layer.color,
          }}
        >
          {/* Lineweight */}
          <span style={{ color: "#888", alignSelf: "center" }}>WEIGHT</span>
          <LineweightBar lw_mm={layer.lineweight_mm} />

          {/* Linetype name + preview */}
          <span style={{ color: "#888", alignSelf: "center" }}>LINETYPE</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <LinetypePreview
              pattern={layer.linetype_pattern}
              ltscale={1}
              color={layer.color}
              width={60}
              height={14}
            />
            <span
              style={{
                fontSize: "9px",
                color: "#666",
                fontFamily: "monospace",
                whiteSpace: "nowrap",
              }}
            >
              {layer.linetype_name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LayerPanel
// ─────────────────────────────────────────────────────────────────────────────

interface LayerPanelProps {
  layers: LayerMeta[];
  hiddenLayers: Set<string>;
  onToggleLayer: (name: string) => void;
}

const LayerPanel: React.FC<LayerPanelProps> = ({
  layers,
  hiddenLayers,
  onToggleLayer,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = layers.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  const allVisible = layers.every((l) => !hiddenLayers.has(l.name));

  function toggleAll() {
    if (allVisible) {
      layers.forEach((l) => {
        if (!hiddenLayers.has(l.name)) onToggleLayer(l.name);
      });
    } else {
      layers.forEach((l) => {
        if (hiddenLayers.has(l.name)) onToggleLayer(l.name);
      });
    }
  }

  return (
    <div
      style={{
        background: "#0f1623",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "6px",
        overflow: "hidden",
        userSelect: "none",
        width: "260px",
        maxHeight: "calc(100vh - 120px)",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          cursor: "pointer",
          background: "rgba(255,255,255,0.03)",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            color: "#8bb4d9",
            fontFamily: "monospace",
          }}
        >
          LAYERS ({layers.length})
        </span>
        <span style={{ color: "#555", fontSize: "10px" }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {expanded && (
        <>
          {/* Search + controls */}
          <div
            style={{
              padding: "6px 10px",
              display: "flex",
              gap: "6px",
              alignItems: "center",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter layers…"
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "3px",
                color: "#ccc",
                fontSize: "11px",
                padding: "3px 7px",
                outline: "none",
              }}
            />
            <button
              onClick={toggleAll}
              title={allVisible ? "Hide all" : "Show all"}
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "3px",
                color: "#aaa",
                fontSize: "11px",
                padding: "3px 7px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {allVisible ? "Hide all" : "Show all"}
            </button>
          </div>

          {/* Properties toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "5px 10px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              cursor: "pointer",
              background: propertiesOpen ? "rgba(100,160,255,0.07)" : "transparent",
            }}
            onClick={() => setPropertiesOpen((v) => !v)}
          >
            <span
              style={{
                fontSize: "10px",
                letterSpacing: "0.08em",
                color: propertiesOpen ? "#8bb4d9" : "#556",
                fontFamily: "monospace",
              }}
            >
              LAYER PROPERTIES
            </span>
            <span style={{ color: "#444", fontSize: "10px" }}>
              {propertiesOpen ? "▲" : "▼"}
            </span>
          </div>

          {/* Layer list */}
          <div style={{ overflow: "auto", flex: 1, minHeight: 0 }}>
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: "12px",
                  color: "#444",
                  fontSize: "11px",
                  textAlign: "center",
                }}
              >
                No layers match
              </div>
            ) : (
              filtered.map((layer) => (
                <LayerRow
                  key={layer.name}
                  layer={layer}
                  isHidden={hiddenLayers.has(layer.name)}
                  showProperties={propertiesOpen}
                  onToggleVisibility={() => onToggleLayer(layer.name)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default LayerPanel;
