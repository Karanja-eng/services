// LayoutTabs.tsx — Horizontal scrollable tab strip for DXF layouts
import React, { useRef, useEffect } from "react";

export interface LayoutDescriptor {
  name: string;
  is_modelspace: boolean;
  paper_width: number;
  paper_height: number;
  plot_origin: [number, number];
  margins: { left: number; right: number; top: number; bottom: number };
  dxf_layout_key: string;
  paper_entities: any[];
  viewports: ViewportDescriptor[];
}

export interface ViewportDescriptor {
  id: string;
  layer: string;
  color: string;
  center_paper: [number, number];
  width_paper: number;
  height_paper: number;
  center_model: [number, number, number];
  view_target: [number, number, number];
  view_height: number;
  view_direction: [number, number, number];
  twist_angle: number;
  scale: number;
  scale_label: string;
  frozen_layers: string[];
  is_active: boolean;
  clip_boundary: [number, number][] | null;
}

interface LayoutTabsProps {
  layouts: LayoutDescriptor[];
  activeIndex: number;
  onChange: (index: number) => void;
}

const ModelIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }}>
    <rect x="1" y="1" width="4" height="4" stroke="currentColor" strokeWidth="1.2" fill="none" />
    <rect x="7" y="1" width="4" height="4" stroke="currentColor" strokeWidth="1.2" fill="none" />
    <rect x="1" y="7" width="4" height="4" stroke="currentColor" strokeWidth="1.2" fill="none" />
    <rect x="7" y="7" width="4" height="4" stroke="currentColor" strokeWidth="1.2" fill="none" />
  </svg>
);

const PageIcon = () => (
  <svg width="11" height="13" viewBox="0 0 11 13" fill="none" style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }}>
    <path d="M1 1h6l3 3v8H1V1z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
    <path d="M7 1v3h3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
    <line x1="3" y1="6" x2="8" y2="6" stroke="currentColor" strokeWidth="0.9" />
    <line x1="3" y1="8" x2="8" y2="8" stroke="currentColor" strokeWidth="0.9" />
    <line x1="3" y1="10" x2="6" y2="10" stroke="currentColor" strokeWidth="0.9" />
  </svg>
);

const LayoutTabs: React.FC<LayoutTabsProps> = ({ layouts, activeIndex, onChange }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Scroll active tab into view on change
  useEffect(() => {
    if (activeTabRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const tab = activeTabRef.current;
      const tabLeft = tab.offsetLeft;
      const tabRight = tabLeft + tab.offsetWidth;
      const cLeft = container.scrollLeft;
      const cRight = cLeft + container.offsetWidth;
      if (tabLeft < cLeft) {
        container.scrollTo({ left: tabLeft - 8, behavior: "smooth" });
      } else if (tabRight > cRight) {
        container.scrollTo({ left: tabRight - container.offsetWidth + 8, behavior: "smooth" });
      }
    }
  }, [activeIndex]);

  if (!layouts || layouts.length === 0) return null;

  return (
    <div style={styles.wrapper}>
      {/* Left fade indicator */}
      <div style={styles.fadeLeft} />

      <div ref={scrollRef} style={styles.scrollContainer}>
        {layouts.map((layout, idx) => {
          const isActive = idx === activeIndex;
          const isModel = layout.is_modelspace;
          return (
            <button
              key={layout.name}
              ref={isActive ? activeTabRef : undefined}
              onClick={() => onChange(idx)}
              title={layout.name}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : styles.tabInactive),
                ...(isModel ? styles.tabModel : {}),
              }}
            >
              {isModel ? <ModelIcon /> : <PageIcon />}
              <span style={styles.tabLabel}>{layout.name}</span>
              {!isModel && layout.viewports.length > 0 && (
                <span style={{
                  ...styles.badge,
                  ...(isActive ? styles.badgeActive : styles.badgeInactive),
                }}>
                  {layout.viewports.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Right fade indicator */}
      <div style={styles.fadeRight} />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: "relative",
    display: "flex",
    alignItems: "stretch",
    background: "#1a1a2e",
    borderBottom: "1px solid #2d2d4a",
    height: 38,
    flexShrink: 0,
  },
  fadeLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 24,
    background: "linear-gradient(to right, #1a1a2e, transparent)",
    zIndex: 2,
    pointerEvents: "none",
  },
  fadeRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 24,
    background: "linear-gradient(to left, #1a1a2e, transparent)",
    zIndex: 2,
    pointerEvents: "none",
  },
  scrollContainer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    overflowX: "auto",
    overflowY: "hidden",
    flex: 1,
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    gap: 1,
    padding: "0 24px",
  },
  tab: {
    display: "inline-flex",
    alignItems: "center",
    padding: "0 14px",
    border: "none",
    borderRadius: 0,
    cursor: "pointer",
    fontSize: 11,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontWeight: 500,
    whiteSpace: "nowrap",
    transition: "background 0.15s, color 0.15s, border-bottom 0.15s",
    outline: "none",
    gap: 4,
    minWidth: 80,
    maxWidth: 200,
    overflow: "hidden",
    borderBottom: "2px solid transparent",
  },
  tabActive: {
    background: "#12122a",
    color: "#7aa2ff",
    borderBottom: "2px solid #7aa2ff",
  },
  tabInactive: {
    background: "transparent",
    color: "#6c6c8a",
  },
  tabModel: {
    // Slight tint for model space tab
    borderRight: "1px solid #2d2d4a",
  },
  tabLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    flex: 1,
    textAlign: "left",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    fontSize: 9,
    fontWeight: 700,
    padding: "1px 5px",
    minWidth: 16,
    height: 16,
  },
  badgeActive: {
    background: "#7aa2ff22",
    color: "#7aa2ff",
  },
  badgeInactive: {
    background: "#ffffff10",
    color: "#6c6c8a",
  },
};

export default LayoutTabs;
