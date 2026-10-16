import React, { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface GeneratedView {
  session_id: string;
  label: string;
  type: "section" | "elevation";
  cut_line_start: [number, number];
  cut_line_end: [number, number];
  entity_count: number;
}

interface GeneratedViewsPanelProps {
  views: GeneratedView[];
  activeViewId: string | null;
  onViewSelect: (sessionId: string) => void;
  onViewDelete: (sessionId: string) => void;
  onViewExport: (sessionId: string, label: string) => void;
}

// ─── Icon components ─────────────────────────────────────────────────────────
const SectionIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="4" width="14" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="8" y1="1" x2="8" y2="15" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2 1.5"/>
    <circle cx="8" cy="2" r="1.5" fill="#ef4444"/>
    <circle cx="8" cy="14" r="1.5" fill="#ef4444"/>
  </svg>
);

const ElevationIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="2" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="2"/>
    <rect x="5" y="7" width="3" height="6" fill="currentColor" opacity="0.3" rx="0.5"/>
    <rect x="10" y="5" width="3" height="8" fill="currentColor" opacity="0.5" rx="0.5"/>
  </svg>
);

const ViewIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M1 7C2.5 4 4.5 2.5 7 2.5S11.5 4 13 7C11.5 10 9.5 11.5 7 11.5S2.5 10 1 7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);

const ExportIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1v7M4 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 10v2a1 1 0 001 1h8a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M11 4l-.9 7.2a1 1 0 01-.99.8H4.89a1 1 0 01-.99-.8L3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const EmptyStateIllustration = () => (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" style={{ opacity: 0.25 }}>
    <rect x="10" y="20" width="60" height="40" rx="3" stroke="currentColor" strokeWidth="2"/>
    <line x1="40" y1="10" x2="40" y2="70" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3"/>
    <circle cx="40" cy="12" r="5" stroke="currentColor" strokeWidth="2"/>
    <circle cx="40" cy="68" r="5" stroke="currentColor" strokeWidth="2"/>
    <rect x="20" y="28" width="15" height="20" rx="1" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="45" y="28" width="15" height="20" rx="1" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────
export const GeneratedViewsPanel: React.FC<GeneratedViewsPanelProps> = ({
  views,
  activeViewId,
  onViewSelect,
  onViewDelete,
  onViewExport,
}) => {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const sections = views.filter((v) => v.type === "section");
  const elevations = views.filter((v) => v.type === "elevation");

  const formatCoord = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(2)}m` : `${n.toFixed(0)}mm`;

  const handleDeleteClick = (id: string) => {
    if (confirmDelete === id) {
      onViewDelete(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  const renderGroup = (
    title: string,
    icon: React.ReactNode,
    groupViews: GeneratedView[]
  ) => {
    if (groupViews.length === 0) return null;
    return (
      <div style={styles.group}>
        <div style={styles.groupHeader}>
          <span style={styles.groupIcon}>{icon}</span>
          <span style={styles.groupTitle}>{title}</span>
          <span style={styles.groupCount}>{groupViews.length}</span>
        </div>
        <div style={styles.viewList}>
          {groupViews.map((view) => {
            const isActive = view.session_id === activeViewId;
            const isConfirming = confirmDelete === view.session_id;
            return (
              <div
                key={view.session_id}
                style={{
                  ...styles.viewCard,
                  ...(isActive ? styles.viewCardActive : {}),
                  ...(isConfirming ? styles.viewCardDeleting : {}),
                }}
              >
                {/* Header row */}
                <div style={styles.viewCardHeader}>
                  <div style={styles.viewLabelGroup}>
                    <span style={styles.viewDot} />
                    <span style={styles.viewLabel}>{view.label}</span>
                  </div>
                  <span style={styles.entityCount}>
                    {view.entity_count.toLocaleString()} entities
                  </span>
                </div>

                {/* Coordinates */}
                <div style={styles.viewCoords}>
                  <span style={styles.coordLabel}>Start</span>
                  <span style={styles.coordValue}>
                    {formatCoord(view.cut_line_start[0])},{" "}
                    {formatCoord(view.cut_line_start[1])}
                  </span>
                  <span style={styles.coordSep}>→</span>
                  <span style={styles.coordLabel}>End</span>
                  <span style={styles.coordValue}>
                    {formatCoord(view.cut_line_end[0])},{" "}
                    {formatCoord(view.cut_line_end[1])}
                  </span>
                </div>

                {/* Actions */}
                <div style={styles.viewActions}>
                  <button
                    style={{
                      ...styles.actionBtn,
                      ...styles.actionBtnPrimary,
                      ...(isActive ? styles.actionBtnActive : {}),
                    }}
                    onClick={() => onViewSelect(view.session_id)}
                    title="Open in viewer"
                  >
                    <ViewIcon />
                    <span>{isActive ? "Viewing" : "View"}</span>
                  </button>

                  <button
                    style={{ ...styles.actionBtn, ...styles.actionBtnGhost }}
                    onClick={() => onViewExport(view.session_id, view.label)}
                    title="Export as DXF"
                  >
                    <ExportIcon />
                    <span>DXF</span>
                  </button>

                  <button
                    style={{
                      ...styles.actionBtn,
                      ...styles.actionBtnDanger,
                      ...(isConfirming ? styles.actionBtnConfirming : {}),
                    }}
                    onClick={() => handleDeleteClick(view.session_id)}
                    title={isConfirming ? "Click again to confirm" : "Delete"}
                  >
                    <TrashIcon />
                    {isConfirming && <span>Confirm?</span>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.panelHeader}>
        <span style={styles.panelTitle}>Generated Views</span>
        <span style={styles.panelBadge}>{views.length}</span>
      </div>

      {/* Content */}
      <div style={styles.panelContent}>
        {views.length === 0 ? (
          <div style={styles.emptyState}>
            <EmptyStateIllustration />
            <p style={styles.emptyTitle}>No views generated</p>
            <p style={styles.emptySubtitle}>
              Use the Section or Elevation tools to generate new views from the
              current drawing
            </p>
          </div>
        ) : (
          <>
            {renderGroup("SECTIONS", <SectionIcon />, sections)}
            {renderGroup("ELEVATIONS", <ElevationIcon />, elevations)}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#111318",
    borderLeft: "1px solid #2a2d35",
    fontFamily: "'DM Mono', 'Fira Code', 'Courier New', monospace",
    fontSize: 12,
    color: "#c8cad0",
    minWidth: 260,
    maxWidth: 320,
    overflow: "hidden",
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px",
    borderBottom: "1px solid #2a2d35",
    background: "#0e1015",
    flexShrink: 0,
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: "#7a7d8a",
  },
  panelBadge: {
    background: "#1e2330",
    color: "#6b7aff",
    borderRadius: 10,
    padding: "1px 7px",
    fontSize: 11,
    fontWeight: 700,
    border: "1px solid #2a3050",
  },
  panelContent: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "8px 0",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    gap: 12,
    textAlign: "center" as const,
  },
  emptyTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
    color: "#5a5e6b",
    letterSpacing: "0.02em",
  },
  emptySubtitle: {
    margin: 0,
    fontSize: 11,
    color: "#404450",
    lineHeight: 1.6,
    maxWidth: 200,
  },
  group: {
    marginBottom: 4,
  },
  groupHeader: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "8px 14px 5px",
    borderBottom: "1px solid #1a1d24",
  },
  groupIcon: {
    color: "#6b7aff",
    display: "flex",
    alignItems: "center",
  },
  groupTitle: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.15em",
    color: "#6b7aff",
    textTransform: "uppercase" as const,
    flex: 1,
  },
  groupCount: {
    fontSize: 10,
    color: "#404450",
    background: "#1a1d24",
    borderRadius: 8,
    padding: "1px 6px",
  },
  viewList: {
    padding: "4px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  viewCard: {
    background: "#161920",
    borderRadius: 6,
    border: "1px solid #20232b",
    padding: "9px 10px 8px",
    transition: "border-color 0.15s, background 0.15s",
    cursor: "default",
  },
  viewCardActive: {
    background: "#12182a",
    border: "1px solid #3040a0",
    boxShadow: "0 0 0 1px #2030804d",
  },
  viewCardDeleting: {
    background: "#1a0e0e",
    border: "1px solid #6b1e1e",
  },
  viewCardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  viewLabelGroup: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  viewDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#ef4444",
    flexShrink: 0,
  },
  viewLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#e0e2ea",
    letterSpacing: "0.04em",
  },
  entityCount: {
    fontSize: 10,
    color: "#404450",
  },
  viewCoords: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginBottom: 7,
    flexWrap: "wrap" as const,
    rowGap: 2,
  },
  coordLabel: {
    fontSize: 9,
    color: "#404450",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
  },
  coordValue: {
    fontSize: 10,
    color: "#7a8090",
    fontFeatureSettings: '"tnum" 1',
  },
  coordSep: {
    fontSize: 10,
    color: "#2a2d35",
    margin: "0 2px",
  },
  viewActions: {
    display: "flex",
    gap: 5,
    alignItems: "center",
  },
  actionBtn: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 8px",
    borderRadius: 4,
    border: "none",
    cursor: "pointer",
    fontSize: 11,
    fontFamily: "inherit",
    fontWeight: 500,
    transition: "all 0.12s",
    outline: "none",
    whiteSpace: "nowrap" as const,
  },
  actionBtnPrimary: {
    background: "#1e2540",
    color: "#7a9eff",
    border: "1px solid #2a3560",
    flex: 1,
    justifyContent: "center",
  },
  actionBtnActive: {
    background: "#1a2d6e",
    color: "#99baff",
  },
  actionBtnGhost: {
    background: "#1a1d24",
    color: "#7a8090",
    border: "1px solid #2a2d35",
  },
  actionBtnDanger: {
    background: "transparent",
    color: "#5a3535",
    border: "1px solid transparent",
    padding: "4px 6px",
  },
  actionBtnConfirming: {
    background: "#2a1414",
    color: "#ef6060",
    border: "1px solid #6b2a2a",
  },
};

export default GeneratedViewsPanel;
