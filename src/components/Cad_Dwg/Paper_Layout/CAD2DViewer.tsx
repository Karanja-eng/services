// CAD2DViewer.tsx — Konva-based 2D viewer with Paper Space and Model Space support
import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  Stage,
  Layer,
  Group,
  Rect,
  Text,
  Line,
  Circle,
} from "react-konva";
import Konva from "konva";
import type { LayoutDescriptor, ViewportDescriptor } from "./LayoutTabs";
import ViewportRenderer, { EntityRenderer } from "./ViewportRenderer";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DXFEntity {
  type: string;
  handle: string;
  layer: string;
  color: string;
  linetype?: string;
  lineweight?: number;
  visible?: boolean;
  [key: string]: any;
}

interface CAD2DViewerProps {
  /** Active layout to display */
  layout: LayoutDescriptor;
  /** Model space entities (always the first layout's paper_entities) */
  modelEntities: DXFEntity[];
  /** Block definitions */
  blocks: Record<string, DXFEntity[]>;
  /** Layer visibility keyed by name */
  layerVisibility: Record<string, boolean>;
  /** Currently hovered/selected entity handle */
  selectedHandle?: string | null;
  onEntityClick?: (entity: DXFEntity | null) => void;
  /** Active viewport id for frozen layer display */
  activeViewportId?: string | null;
  onActiveViewportChange?: (id: string | null) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MIN_SCALE = 0.001;
const MAX_SCALE = 500;
const SCROLL_SENSITIVITY = 1.08;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeModelBounds(entities: DXFEntity[]): {
  minX: number; minY: number; maxX: number; maxY: number;
} {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const expand = (x: number, y: number) => {
    if (!isFinite(x) || !isFinite(y)) return;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const e of entities) {
    if (e.type === "LINE") {
      expand(e.start[0], e.start[1]);
      expand(e.end[0], e.end[1]);
    } else if (e.type === "CIRCLE" || e.type === "ARC") {
      expand(e.center[0] - e.radius, e.center[1] - e.radius);
      expand(e.center[0] + e.radius, e.center[1] + e.radius);
    } else if (e.type === "LWPOLYLINE" || e.type === "POLYLINE") {
      for (const p of (e.points || [])) expand(p.x, p.y);
    } else if (e.type === "TEXT" || e.type === "MTEXT") {
      expand(e.position[0], e.position[1]);
    } else if (e.type === "INSERT") {
      expand(e.insert[0], e.insert[1]);
    }
  }
  if (!isFinite(minX)) return { minX: -500, minY: -500, maxX: 500, maxY: 500 };
  return { minX, minY, maxX, maxY };
}

// ─── Component ───────────────────────────────────────────────────────────────

const CAD2DViewer: React.FC<CAD2DViewerProps> = ({
  layout,
  modelEntities,
  blocks,
  layerVisibility,
  selectedHandle,
  onEntityClick,
  activeViewportId,
  onActiveViewportChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 900, height: 600 });
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [showBorders, setShowBorders] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const isPaperMode = !layout.is_modelspace;

  // ── Measure container ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Fit-to-view helper ─────────────────────────────────────────────────────
  const fitToView = useCallback(
    (targetW: number, targetH: number, contentW: number, contentH: number,
     offsetX = 0, offsetY = 0, padding = 40) => {
      const scaleX = (targetW - padding * 2) / contentW;
      const scaleY = (targetH - padding * 2) / contentH;
      const scale = Math.min(scaleX, scaleY, MAX_SCALE);
      const x = (targetW - contentW * scale) / 2 - offsetX * scale;
      const y = (targetH - contentH * scale) / 2 - offsetY * scale;
      return { x, y, scale };
    },
    []
  );

  // ── Initial fit on layout change ───────────────────────────────────────────
  useEffect(() => {
    setInitialized(false);
    const { width, height } = size;
    if (isPaperMode) {
      const pw = layout.paper_width || 841;
      const ph = layout.paper_height || 594;
      const t = fitToView(width, height, pw, ph, 0, 0);
      setTransform(t);
    } else {
      const bounds = computeModelBounds(modelEntities);
      const w = bounds.maxX - bounds.minX;
      const h = bounds.maxY - bounds.minY;
      if (w > 0 && h > 0) {
        const t = fitToView(width, height, w, h, bounds.minX, -bounds.maxY);
        setTransform(t);
      }
    }
    setTimeout(() => setInitialized(true), 50);
  }, [layout.name, size.width, size.height]); // eslint-disable-line

  // ── Fit-to-sheet button ────────────────────────────────────────────────────
  const handleFitToSheet = useCallback(() => {
    if (isPaperMode) {
      const pw = layout.paper_width || 841;
      const ph = layout.paper_height || 594;
      const t = fitToView(size.width, size.height, pw, ph, 0, 0);
      setTransform(t);
    } else {
      const bounds = computeModelBounds(modelEntities);
      const w = bounds.maxX - bounds.minX;
      const h = bounds.maxY - bounds.minY;
      if (w > 0 && h > 0) {
        const t = fitToView(size.width, size.height, w, h, bounds.minX, -bounds.maxY);
        setTransform(t);
      }
    }
  }, [isPaperMode, layout, size, modelEntities, fitToView]);

  // ── Mouse wheel zoom ───────────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const direction = e.deltaY < 0 ? 1 : -1;
    const factor = direction > 0 ? SCROLL_SENSITIVITY : 1 / SCROLL_SENSITIVITY;

    setTransform((prev) => {
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale * factor));
      const scaleDiff = newScale / prev.scale;
      const newX = pointer.x - (pointer.x - prev.x) * scaleDiff;
      const newY = pointer.y - (pointer.y - prev.y) * scaleDiff;
      return { x: newX, y: newY, scale: newScale };
    });
  }, []);

  // ── Pan ────────────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 1 && e.button !== 0) return;
    if (e.button === 0 && !e.altKey && !e.ctrlKey) return; // only pan with alt+drag or middle button
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setTransform((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // ── Filtered model entities for this view ──────────────────────────────────
  const visibleModelEntities = useMemo(
    () => modelEntities.filter((e) => {
      if (e.visible === false) return false;
      return layerVisibility[e.layer || "0"] !== false;
    }),
    [modelEntities, layerVisibility]
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={styles.root}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <button style={styles.toolBtn} onClick={handleFitToSheet} title="Fit to view (F)">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="5" height="5" stroke="currentColor" strokeWidth="1.3" fill="none" />
            <rect x="8" y="1" width="5" height="5" stroke="currentColor" strokeWidth="1.3" fill="none" />
            <rect x="1" y="8" width="5" height="5" stroke="currentColor" strokeWidth="1.3" fill="none" />
            <rect x="8" y="8" width="5" height="5" stroke="currentColor" strokeWidth="1.3" fill="none" />
          </svg>
          {isPaperMode ? "Fit Sheet" : "Fit Model"}
        </button>

        {isPaperMode && (
          <button
            style={{ ...styles.toolBtn, ...(showBorders ? styles.toolBtnActive : {}) }}
            onClick={() => setShowBorders((v) => !v)}
            title="Toggle viewport borders"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="2" width="10" height="10" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 2" fill="none" />
            </svg>
            VP Borders
          </button>
        )}

        {isPaperMode && (
          <span style={styles.paperInfo}>
            {layout.paper_width.toFixed(0)} × {layout.paper_height.toFixed(0)} mm
            {layout.viewports.length > 0 && ` · ${layout.viewports.length} viewport${layout.viewports.length > 1 ? "s" : ""}`}
          </span>
        )}

        <span style={styles.zoomLabel}>
          {(transform.scale * 100).toFixed(0)}%
        </span>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        style={{ ...styles.canvas, cursor: isDragging.current ? "grabbing" : "grab" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          style={{ background: "#0d0d1a" }}
        >
          <Layer
            x={transform.x}
            y={transform.y}
            scaleX={transform.scale}
            scaleY={transform.scale}
          >
            {isPaperMode ? (
              /* ── PAPER SPACE MODE ───────────────────────────────────────── */
              <Group>
                {/* Sheet shadow */}
                <Rect
                  x={4 / transform.scale}
                  y={4 / transform.scale}
                  width={layout.paper_width}
                  height={layout.paper_height}
                  fill="#00000055"
                  listening={false}
                />
                {/* Sheet background */}
                <Rect
                  x={0}
                  y={0}
                  width={layout.paper_width}
                  height={layout.paper_height}
                  fill="#f5f5f0"
                  listening={false}
                />

                {/* Paper-space entities (title block, annotations) */}
                {layout.paper_entities.map((entity: DXFEntity) => {
                  if (entity.type === "VIEWPORT") return null;
                  if (layerVisibility[entity.layer || "0"] === false) return null;
                  // Paper entities use DXF coordinates but Y is flipped relative to paper top
                  // For paper space, Y=0 is bottom of sheet; Konva Y=0 is top
                  // Transform: ky = paper_height - dy
                  const paperVP: ViewportDescriptor = {
                    id: "__paper__",
                    layer: "0",
                    color: "#000",
                    center_paper: [0, layout.paper_height],
                    width_paper: layout.paper_width,
                    height_paper: layout.paper_height,
                    center_model: [0, 0, 0],
                    view_target: [0, 0, 0],
                    view_height: layout.paper_height,
                    view_direction: [0, 0, 1],
                    twist_angle: 0,
                    scale: 1,
                    scale_label: "1:1",
                    frozen_layers: [],
                    is_active: true,
                    clip_boundary: null,
                  };
                  return (
                    <EntityRenderer
                      key={entity.handle}
                      entity={entity}
                      vp={paperVP}
                      blocks={blocks}
                    />
                  );
                })}

                {/* Viewports */}
                {layout.viewports.map((vp: ViewportDescriptor) => {
                  // Convert paper-space DXF coords (origin at bottom-left) to Konva coords
                  // Konva sheet: x=0,y=0 is top-left; DXF paper: x=0,y=0 is bottom-left
                  const konvaVP: ViewportDescriptor = {
                    ...vp,
                    center_paper: [vp.center_paper[0], layout.paper_height - vp.center_paper[1]],
                  };
                  return (
                    <ViewportRenderer
                      key={vp.id}
                      viewport={konvaVP}
                      modelEntities={modelEntities}
                      blocks={blocks}
                      layerVisibility={layerVisibility}
                      canvasScale={transform.scale}
                      showBorder={showBorders}
                    />
                  );
                })}

                {/* Sheet border */}
                <Rect
                  x={0}
                  y={0}
                  width={layout.paper_width}
                  height={layout.paper_height}
                  stroke="#9999bb"
                  strokeWidth={1 / transform.scale}
                  fill="transparent"
                  listening={false}
                />
              </Group>
            ) : (
              /* ── MODEL SPACE MODE ───────────────────────────────────────── */
              <Group
                scaleY={-1}  // Flip Y for DXF coordinate system
                y={0}
              >
                {visibleModelEntities.map((entity) => {
                  // In model space mode, render at world coordinates with Y-flip
                  const modelVP: ViewportDescriptor = {
                    id: "__model__",
                    layer: "0",
                    color: "#fff",
                    center_paper: [0, 0],
                    width_paper: 1e9,
                    height_paper: 1e9,
                    center_model: [0, 0, 0],
                    view_target: [0, 0, 0],
                    view_height: 1,
                    view_direction: [0, 0, 1],
                    twist_angle: 0,
                    scale: 1,
                    scale_label: "1:1",
                    frozen_layers: [],
                    is_active: true,
                    clip_boundary: null,
                  };
                  return (
                    <EntityRenderer
                      key={entity.handle}
                      entity={entity}
                      vp={modelVP}
                      blocks={blocks}
                    />
                  );
                })}
              </Group>
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#0d0d1a",
    overflow: "hidden",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    background: "#131326",
    borderBottom: "1px solid #2d2d4a",
    flexShrink: 0,
    height: 34,
  },
  toolBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 10px",
    border: "1px solid #3d3d5a",
    borderRadius: 4,
    background: "transparent",
    color: "#9999bb",
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
    cursor: "pointer",
    transition: "background 0.12s, color 0.12s",
  },
  toolBtnActive: {
    background: "#1e1e40",
    color: "#7aa2ff",
    borderColor: "#7aa2ff55",
  },
  paperInfo: {
    marginLeft: 8,
    fontSize: 10,
    color: "#5555aa",
    fontFamily: "'JetBrains Mono', monospace",
  },
  zoomLabel: {
    marginLeft: "auto",
    fontSize: 10,
    color: "#5555aa",
    fontFamily: "'JetBrains Mono', monospace",
    minWidth: 45,
    textAlign: "right",
  },
  canvas: {
    flex: 1,
    overflow: "hidden",
    position: "relative",
  },
};

export default CAD2DViewer;
