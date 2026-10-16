import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Stage, Layer, Line, Circle, Arc, Text, Rect, Group } from "react-konva";
import Konva from "konva";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CadEntity {
  type: string;
  layer: string;
  color: string;
  lineweight: number;
  linetype: string;
  // LINE
  x1?: number; y1?: number; z1?: number;
  x2?: number; y2?: number; z2?: number;
  // CIRCLE / ARC
  cx?: number; cy?: number; cz?: number; radius?: number;
  start_angle?: number; end_angle?: number;
  // POLYLINE
  points?: number[][];
  closed?: boolean;
  // TEXT
  text?: string; x?: number; y?: number; height?: number;
}

export interface CadLayer {
  name: string;
  color: string;
  on: boolean;
  frozen: boolean;
}

export interface SectionMeta {
  cut_line_start: [number, number];
  cut_line_end: [number, number];
  cut_direction_label: string;
  view_direction: string;
  scale: number;
  type: "section" | "elevation";
}

export interface CadDrawing {
  session_id: string;
  filename: string;
  entities: CadEntity[];
  layers: CadLayer[];
  section_meta?: SectionMeta;
}

type ToolMode = "pan" | "select" | "section" | "elevation";

interface Point2D { x: number; y: number; }

interface SectionState {
  phase: "idle" | "first_click" | "second_click" | "configuring";
  startPt: Point2D | null;
  endPt: Point2D | null;
  viewSide: "left" | "right";
  cutDepth: number;
  cutHeight: number;
}

interface ElevationState {
  phase: "idle" | "first_click" | "second_click" | "configuring";
  startPt: Point2D | null;
  endPt: Point2D | null;
  viewWidth: number;
  viewHeight: number;
  viewName: string;
}

interface CAD2DViewerProps {
  drawing: CadDrawing | null;
  sessionId: string | null;
  onSectionGenerated?: (data: CadDrawing) => void;
  onElevationGenerated?: (data: CadDrawing) => void;
  apiBase?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:8000";
const ZOOM_FACTOR = 1.15;
const MIN_SCALE = 0.0001;
const MAX_SCALE = 500;

// ─── Utility helpers ──────────────────────────────────────────────────────────
function boundingBox(entities: CadEntity[]): {
  minX: number; minY: number; maxX: number; maxY: number;
} {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const expand = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  for (const e of entities) {
    if (e.type === "LINE") {
      expand(e.x1!, e.y1!); expand(e.x2!, e.y2!);
    } else if (e.type === "CIRCLE" || e.type === "ARC") {
      const r = e.radius ?? 0;
      expand(e.cx! - r, e.cy! - r); expand(e.cx! + r, e.cy! + r);
    } else if (e.type === "LWPOLYLINE" || e.type === "POLYLINE") {
      for (const p of e.points ?? []) expand(p[0], p[1]);
    } else if (e.type === "TEXT") {
      expand(e.x ?? 0, e.y ?? 0);
    }
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 1000; maxY = 1000; }
  return { minX, minY, maxX, maxY };
}

function lineDash(linetype: string): number[] {
  const lt = (linetype ?? "").toUpperCase();
  if (lt.includes("DASH") || lt === "HIDDEN") return [10, 5];
  if (lt.includes("CENTER")) return [20, 5, 5, 5];
  if (lt.includes("DOT")) return [2, 5];
  return [];
}

function lwToPixels(lw: number): number {
  if (lw <= 0) return 1;
  return Math.max(0.5, lw / 25);
}

function perpendicular(dx: number, dy: number): [number, number] {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-9) return [0, 1];
  return [-dy / len, dx / len];
}

function sign2D(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

// ─── Main component ───────────────────────────────────────────────────────────
export const CAD2DViewer: React.FC<CAD2DViewerProps> = ({
  drawing,
  sessionId,
  onSectionGenerated,
  onElevationGenerated,
  apiBase = API_BASE,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [tool, setTool] = useState<ToolMode>("pan");

  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});
  const [cursorPos, setCursorPos] = useState<Point2D | null>(null);

  // Section tool state
  const [sectionState, setSectionState] = useState<SectionState>({
    phase: "idle", startPt: null, endPt: null,
    viewSide: "left", cutDepth: 1000, cutHeight: 3000,
  });

  // Elevation tool state
  const [elevState, setElevState] = useState<ElevationState>({
    phase: "idle", startPt: null, endPt: null,
    viewWidth: 30000, viewHeight: 15000, viewName: "ELEVATION",
  });

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // ── Resize observer ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setStageSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setStageSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ── Fit drawing on load ──────────────────────────────────────────────────
  useEffect(() => {
    if (!drawing || drawing.entities.length === 0) return;
    const bb = boundingBox(drawing.entities);
    const { width, height } = stageSize;
    const pad = 0.1;
    const dwgW = bb.maxX - bb.minX;
    const dwgH = bb.maxY - bb.minY;
    if (dwgW < 1e-6 || dwgH < 1e-6) return;
    const scaleX = (width * (1 - pad * 2)) / dwgW;
    const scaleY = (height * (1 - pad * 2)) / dwgH;
    const scale = Math.min(scaleX, scaleY);
    // DXF Y is inverted compared to canvas Y
    const offsetX = (width - dwgW * scale) / 2 - bb.minX * scale;
    const offsetY = (height + dwgH * scale) / 2 + bb.minY * scale;
    setStageScale(scale);
    setStagePos({ x: offsetX, y: offsetY });
  }, [drawing]);

  // ── Layer visibility init ────────────────────────────────────────────────
  useEffect(() => {
    if (!drawing) return;
    const vis: Record<string, boolean> = {};
    for (const l of drawing.layers) vis[l.name] = l.on !== false;
    setLayerVisibility(vis);
  }, [drawing]);

  // ── Stage → world coordinate conversion ─────────────────────────────────
  const stageToWorld = useCallback(
    (sx: number, sy: number): Point2D => ({
      x: (sx - stagePos.x) / stageScale,
      y: -((sy - stagePos.y) / stageScale), // flip Y
    }),
    [stagePos, stageScale],
  );

  // ── Mouse handlers ───────────────────────────────────────────────────────
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition()!;
    const direction = e.evt.deltaY < 0 ? 1 : -1;
    const factor = direction > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, stageScale * factor));
    const mouseX = pointer.x;
    const mouseY = pointer.y;
    const newX = mouseX - (mouseX - stagePos.x) * (newScale / stageScale);
    const newY = mouseY - (mouseY - stagePos.y) * (newScale / stageScale);
    setStageScale(newScale);
    setStagePos({ x: newX, y: newY });
  }, [stageScale, stagePos]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const ptr = stage.getPointerPosition();
    if (ptr) setCursorPos(stageToWorld(ptr.x, ptr.y));
  }, [stageToWorld]);

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const ptr = stage.getPointerPosition();
    if (!ptr) return;
    const worldPt = stageToWorld(ptr.x, ptr.y);

    if (tool === "section") {
      setSectionState((prev) => {
        if (prev.phase === "idle" || prev.phase === "first_click") {
          return { ...prev, phase: "first_click", startPt: worldPt, endPt: null };
        }
        if (prev.phase === "first_click" && prev.startPt) {
          return { ...prev, phase: "configuring", endPt: worldPt };
        }
        return prev;
      });
    } else if (tool === "elevation") {
      setElevState((prev) => {
        if (prev.phase === "idle" || prev.phase === "first_click") {
          return { ...prev, phase: "first_click", startPt: worldPt, endPt: null };
        }
        if (prev.phase === "first_click" && prev.startPt) {
          return { ...prev, phase: "configuring", endPt: worldPt };
        }
        return prev;
      });
    }
  }, [tool, stageToWorld]);

  // When in "first_click" state, update end point on mouse move for live preview
  const handleMouseMoveOnStage = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    handleMouseMove(e);
    const stage = stageRef.current;
    if (!stage) return;
    const ptr = stage.getPointerPosition();
    if (!ptr) return;
    const worldPt = stageToWorld(ptr.x, ptr.y);

    if (tool === "section" && sectionState.phase === "first_click") {
      setSectionState((prev) => ({ ...prev, endPt: worldPt }));
    }
    if (tool === "elevation" && elevState.phase === "first_click") {
      setElevState((prev) => ({ ...prev, endPt: worldPt }));
    }
  }, [handleMouseMove, tool, sectionState.phase, elevState.phase, stageToWorld]);

  // ── API calls ────────────────────────────────────────────────────────────
  const generateSection = async () => {
    if (!sessionId || !sectionState.startPt || !sectionState.endPt) return;
    setGenerating(true);
    setGenError(null);
    try {
      const resp = await fetch(`${apiBase}/api/cad/section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          cut_line: {
            start: [sectionState.startPt.x, sectionState.startPt.y],
            end: [sectionState.endPt.x, sectionState.endPt.y],
          },
          cut_depth: sectionState.cutDepth,
          cut_height: sectionState.cutHeight,
          view_direction: sectionState.viewSide,
        }),
      });
      if (!resp.ok) throw new Error(`Server error ${resp.status}`);
      const data: CadDrawing = await resp.json();
      onSectionGenerated?.(data);
      setSectionState({
        phase: "idle", startPt: null, endPt: null,
        viewSide: "left", cutDepth: 1000, cutHeight: 3000,
      });
    } catch (err: any) {
      setGenError(err.message ?? "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const generateElevation = async () => {
    if (!sessionId || !elevState.startPt || !elevState.endPt) return;
    setGenerating(true);
    setGenError(null);
    try {
      const dx = elevState.endPt.x - elevState.startPt.x;
      const dy = elevState.endPt.y - elevState.startPt.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      // View direction is perpendicular to the drawn line (looking "into" building)
      const viewDir: [number, number, number] = [dy / len, -dx / len, 0];

      const resp = await fetch(`${apiBase}/api/cad/elevation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          view_direction: viewDir,
          view_plane_origin: [elevState.startPt.x, elevState.startPt.y],
          view_width: elevState.viewWidth,
          view_height: elevState.viewHeight,
          view_name: elevState.viewName,
        }),
      });
      if (!resp.ok) throw new Error(`Server error ${resp.status}`);
      const data: CadDrawing = await resp.json();
      onElevationGenerated?.(data);
      setElevState({
        phase: "idle", startPt: null, endPt: null,
        viewWidth: 30000, viewHeight: 15000, viewName: "ELEVATION",
      });
    } catch (err: any) {
      setGenError(err.message ?? "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  // ── Layer toggle ─────────────────────────────────────────────────────────
  const toggleLayer = (name: string) => {
    setLayerVisibility((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  // ── Canvas coordinate helper ─────────────────────────────────────────────
  // DXF uses Y-up, canvas Y-down — we flip Y via scale(-1) on the layer
  const wx = (x: number) => x;
  const wy = (y: number) => y; // flipped via layer scaleY={-1}

  // ── Rendered entities ────────────────────────────────────────────────────
  const renderedEntities = useMemo(() => {
    if (!drawing) return null;
    const layerVis = layerVisibility;

    return drawing.entities.map((ent, idx) => {
      if (layerVis[ent.layer] === false) return null;
      const color = ent.color ?? "#FFFFFF";
      const lw = lwToPixels(ent.lineweight) / stageScale;
      const dash = lineDash(ent.linetype);
      const dashScaled = dash.map((d) => d / stageScale);
      const key = `${idx}-${ent.type}`;

      if (ent.type === "LINE") {
        return (
          <Line
            key={key}
            points={[wx(ent.x1!), wy(ent.y1!), wx(ent.x2!), wy(ent.y2!)]}
            stroke={color}
            strokeWidth={lw}
            dash={dashScaled}
            listening={false}
          />
        );
      }
      if (ent.type === "CIRCLE") {
        return (
          <Circle
            key={key}
            x={wx(ent.cx!)} y={wy(ent.cy!)}
            radius={ent.radius!}
            stroke={color}
            strokeWidth={lw}
            fill="transparent"
            dash={dashScaled}
            listening={false}
          />
        );
      }
      if (ent.type === "ARC") {
        const sa = ent.start_angle! * (Math.PI / 180);
        const ea = ent.end_angle! * (Math.PI / 180);
        const r = ent.radius!;
        const segs = 64;
        let angle = sa;
        let span = ea - sa;
        if (span < 0) span += 2 * Math.PI;
        const pts: number[] = [];
        for (let i = 0; i <= segs; i++) {
          const a = sa + (span * i) / segs;
          pts.push(wx(ent.cx!) + r * Math.cos(a), wy(ent.cy!) + r * Math.sin(a));
        }
        return (
          <Line
            key={key}
            points={pts}
            stroke={color}
            strokeWidth={lw}
            dash={dashScaled}
            listening={false}
          />
        );
      }
      if (ent.type === "LWPOLYLINE" || ent.type === "POLYLINE") {
        const pts = (ent.points ?? []).flatMap((p) => [wx(p[0]), wy(p[1])]);
        if (ent.closed && pts.length >= 4) {
          pts.push(pts[0], pts[1]);
        }
        return (
          <Line
            key={key}
            points={pts}
            stroke={color}
            strokeWidth={lw}
            dash={dashScaled}
            closed={false}
            listening={false}
          />
        );
      }
      if (ent.type === "TEXT") {
        const fontSize = Math.max(ent.height ?? 2.5, 0.1);
        return (
          <Text
            key={key}
            x={wx(ent.x ?? 0)}
            y={wy(ent.y ?? 0)}
            text={ent.text ?? ""}
            fontSize={fontSize}
            fill={color}
            scaleY={-1}
            listening={false}
          />
        );
      }
      return null;
    });
  }, [drawing, layerVisibility, stageScale]);

  // ── Section cut line overlay ─────────────────────────────────────────────
  const sectionOverlay = useMemo(() => {
    if (tool !== "section") return null;
    const { startPt, endPt, phase, viewSide } = sectionState;
    if (!startPt) return null;
    const ep = endPt ?? startPt;
    const scale = stageScale;
    const lw = 2 / scale;

    const dx = ep.x - startPt.x;
    const dy = ep.y - startPt.y;
    const [px, py] = perpendicular(dx, dy);
    const arrowLen = 800 / scale;
    const arrowSide = viewSide === "left" ? 1 : -1;
    const midX = (startPt.x + ep.x) / 2;
    const midY = (startPt.y + ep.y) / 2;

    return (
      <Group key="section-overlay">
        {/* Dashed cut line */}
        <Line
          points={[startPt.x, startPt.y, ep.x, ep.y]}
          stroke="#ef4444"
          strokeWidth={lw}
          dash={[20 / scale, 10 / scale]}
          listening={false}
        />
        {/* Start marker */}
        {startPt && (
          <Circle x={startPt.x} y={startPt.y} radius={400 / scale}
            stroke="#ef4444" strokeWidth={lw} fill="transparent" />
        )}
        {/* End marker */}
        {phase === "configuring" && endPt && (
          <Circle x={endPt.x} y={endPt.y} radius={400 / scale}
            stroke="#ef4444" strokeWidth={lw} fill="transparent" />
        )}
        {/* View direction arrow */}
        {endPt && (
          <Line
            points={[
              midX, midY,
              midX + px * arrowLen * arrowSide,
              midY + py * arrowLen * arrowSide,
            ]}
            stroke="#ff6b00"
            strokeWidth={lw * 1.5}
            listening={false}
          />
        )}
      </Group>
    );
  }, [tool, sectionState, stageScale]);

  // ── Elevation line overlay ───────────────────────────────────────────────
  const elevationOverlay = useMemo(() => {
    if (tool !== "elevation") return null;
    const { startPt, endPt } = elevState;
    if (!startPt) return null;
    const ep = endPt ?? startPt;
    const scale = stageScale;
    const lw = 2 / scale;

    const dx = ep.x - startPt.x;
    const dy = ep.y - startPt.y;
    const [px, py] = perpendicular(dx, dy);
    const arrowLen = 1200 / scale;

    return (
      <Group key="elev-overlay">
        <Line
          points={[startPt.x, startPt.y, ep.x, ep.y]}
          stroke="#00c8ff"
          strokeWidth={lw}
          dash={[15 / scale, 8 / scale]}
          listening={false}
        />
        {endPt && (
          <Line
            points={[
              (startPt.x + ep.x) / 2, (startPt.y + ep.y) / 2,
              (startPt.x + ep.x) / 2 + px * arrowLen,
              (startPt.y + ep.y) / 2 + py * arrowLen,
            ]}
            stroke="#00c8ff"
            strokeWidth={lw * 1.5}
            listening={false}
          />
        )}
      </Group>
    );
  }, [tool, elevState, stageScale]);

  // ── Section viewer label overlay ─────────────────────────────────────────
  const isSectionView = !!drawing?.section_meta;
  const sectionMeta = drawing?.section_meta;

  // ── Cursor style ─────────────────────────────────────────────────────────
  const cursor =
    tool === "pan" ? "grab" :
    tool === "section" || tool === "elevation" ? "crosshair" :
    "default";

  // ── Tool reset helpers ───────────────────────────────────────────────────
  const resetSection = () => setSectionState({
    phase: "idle", startPt: null, endPt: null,
    viewSide: "left", cutDepth: 1000, cutHeight: 3000,
  });
  const resetElev = () => setElevState({
    phase: "idle", startPt: null, endPt: null,
    viewWidth: 30000, viewHeight: 15000, viewName: "ELEVATION",
  });

  // ── Section config panel ─────────────────────────────────────────────────
  const showSectionPanel = tool === "section" && sectionState.phase === "configuring";
  const showElevPanel = tool === "elevation" && elevState.phase === "configuring";

  return (
    <div style={styles.wrapper}>
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div style={styles.toolbar}>
        {(["pan", "select", "section", "elevation"] as ToolMode[]).map((t) => (
          <ToolButton
            key={t}
            active={tool === t}
            label={TOOL_LABELS[t]}
            icon={TOOL_ICONS[t]}
            onClick={() => {
              setTool(t);
              resetSection();
              resetElev();
              setGenError(null);
            }}
          />
        ))}
        <div style={styles.toolbarSep} />
        {drawing?.layers && drawing.layers.length > 0 && (
          <LayerMenu layers={drawing.layers} visibility={layerVisibility} onToggle={toggleLayer} />
        )}
      </div>

      {/* ── Canvas area ─────────────────────────────────────────────────── */}
      <div ref={containerRef} style={{ ...styles.canvasArea, cursor }}>
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          x={stagePos.x}
          y={stagePos.y}
          scaleX={stageScale}
          scaleY={stageScale}
          draggable={tool === "pan"}
          onDragEnd={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
          onWheel={handleWheel}
          onMouseMove={handleMouseMoveOnStage}
          onClick={handleStageClick}
        >
          {/* Main drawing layer — Y flipped for DXF convention */}
          <Layer scaleY={-1} y={0}>
            {renderedEntities}
            {sectionOverlay}
            {elevationOverlay}
          </Layer>
        </Stage>

        {/* ── Section viewer label ─────────────────────────────────────── */}
        {isSectionView && sectionMeta && (
          <div style={styles.sectionLabel}>
            <span style={styles.sectionLabelTitle}>
              {sectionMeta.cut_direction_label}
            </span>
            <span style={styles.sectionLabelScale}>
              Scale 1:{Math.round(1 / sectionMeta.scale)}
            </span>
          </div>
        )}

        {/* ── Scale bar (for section/elevation views) ───────────────────── */}
        {isSectionView && <ScaleBar scale={sectionMeta?.scale ?? 0.02} stageScale={stageScale} />}

        {/* ── Crosshair coords ─────────────────────────────────────────── */}
        {cursorPos && (
          <div style={styles.coords}>
            X: {cursorPos.x.toFixed(1)} &nbsp; Y: {cursorPos.y.toFixed(1)}
          </div>
        )}

        {/* ── Section instruction banner ────────────────────────────────── */}
        {tool === "section" && sectionState.phase !== "configuring" && (
          <InstructionBanner
            text={
              sectionState.phase === "idle" || sectionState.phase === "first_click" && !sectionState.startPt
                ? "Click to place section cut start point"
                : "Click to place section cut end point"
            }
          />
        )}
        {tool === "elevation" && elevState.phase !== "configuring" && (
          <InstructionBanner
            text={
              elevState.phase === "idle" || !elevState.startPt
                ? "Click to place elevation face start"
                : "Click to place elevation face end"
            }
            color="#00c8ff"
          />
        )}

        {/* ── Section config panel ──────────────────────────────────────── */}
        {showSectionPanel && (
          <ConfigPanel
            title="Section Cut Settings"
            accentColor="#ef4444"
            onCancel={resetSection}
            onGenerate={generateSection}
            generating={generating}
            error={genError}
            fields={[
              {
                label: "Cut Depth (mm)", type: "number",
                value: sectionState.cutDepth,
                onChange: (v) => setSectionState((p) => ({ ...p, cutDepth: Number(v) })),
              },
              {
                label: "Cut Height (mm)", type: "number",
                value: sectionState.cutHeight,
                onChange: (v) => setSectionState((p) => ({ ...p, cutHeight: Number(v) })),
              },
              {
                label: "View Direction", type: "select",
                value: sectionState.viewSide,
                options: [{ label: "Left of cut line", value: "left" }, { label: "Right of cut line", value: "right" }],
                onChange: (v) => setSectionState((p) => ({ ...p, viewSide: v as "left" | "right" })),
              },
            ]}
          />
        )}

        {/* ── Elevation config panel ────────────────────────────────────── */}
        {showElevPanel && (
          <ConfigPanel
            title="Elevation Settings"
            accentColor="#00c8ff"
            onCancel={resetElev}
            onGenerate={generateElevation}
            generating={generating}
            error={genError}
            fields={[
              {
                label: "View Width (mm)", type: "number",
                value: elevState.viewWidth,
                onChange: (v) => setElevState((p) => ({ ...p, viewWidth: Number(v) })),
              },
              {
                label: "View Height (mm)", type: "number",
                value: elevState.viewHeight,
                onChange: (v) => setElevState((p) => ({ ...p, viewHeight: Number(v) })),
              },
              {
                label: "View Name", type: "text",
                value: elevState.viewName,
                onChange: (v) => setElevState((p) => ({ ...p, viewName: String(v) })),
              },
            ]}
          />
        )}

        {/* ── Generating spinner ────────────────────────────────────────── */}
        {generating && <GeneratingOverlay />}
      </div>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const TOOL_LABELS: Record<ToolMode, string> = {
  pan: "Pan",
  select: "Select",
  section: "Section",
  elevation: "Elevation",
};

const TOOL_ICONS: Record<ToolMode, React.ReactNode> = {
  pan: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1v4M7 9v4M1 7h4M9 7h4M3.5 3.5l2.5 2.5M8 8l2.5 2.5M3.5 10.5L6 8M8 6l2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  select: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 2l4.5 10 1.5-4 4-1.5L2 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
  section: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="3" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="7" y1="0.5" x2="7" y2="13.5" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2 1.5"/>
      <circle cx="7" cy="1.5" r="1.5" fill="#ef4444"/>
      <circle cx="7" cy="12.5" r="1.5" fill="#ef4444"/>
    </svg>
  ),
  elevation: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="3" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="1" y1="12" x2="13" y2="12" stroke="currentColor" strokeWidth="2"/>
      <rect x="3" y="7" width="3" height="5" fill="currentColor" opacity="0.4" rx="0.5"/>
      <rect x="8" y="5" width="3" height="7" fill="currentColor" opacity="0.6" rx="0.5"/>
    </svg>
  ),
};

interface ToolButtonProps {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}
const ToolButton: React.FC<ToolButtonProps> = ({ active, label, icon, onClick }) => (
  <button
    style={{
      ...styles.toolBtn,
      ...(active ? styles.toolBtnActive : {}),
    }}
    onClick={onClick}
    title={label}
  >
    {icon}
    <span style={styles.toolBtnLabel}>{label}</span>
  </button>
);

interface LayerMenuProps {
  layers: CadLayer[];
  visibility: Record<string, boolean>;
  onToggle: (name: string) => void;
}
const LayerMenu: React.FC<LayerMenuProps> = ({ layers, visibility, onToggle }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button style={styles.toolBtn} onClick={() => setOpen((v) => !v)}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="2" width="12" height="2.5" rx="0.5" fill="currentColor" opacity="0.7"/>
          <rect x="1" y="5.75" width="12" height="2.5" rx="0.5" fill="currentColor" opacity="0.5"/>
          <rect x="1" y="9.5" width="12" height="2.5" rx="0.5" fill="currentColor" opacity="0.3"/>
        </svg>
        <span style={styles.toolBtnLabel}>Layers</span>
      </button>
      {open && (
        <div style={styles.layerDropdown}>
          <div style={styles.layerDropdownHeader}>Layers</div>
          <div style={styles.layerList}>
            {layers.map((l) => (
              <div
                key={l.name}
                style={styles.layerRow}
                onClick={() => onToggle(l.name)}
              >
                <div
                  style={{
                    ...styles.layerSwatch,
                    background: visibility[l.name] !== false ? l.color : "#333",
                    opacity: visibility[l.name] !== false ? 1 : 0.3,
                  }}
                />
                <span style={{
                  ...styles.layerName,
                  opacity: visibility[l.name] !== false ? 1 : 0.4,
                }}>
                  {l.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface ConfigField {
  label: string;
  type: "number" | "text" | "select";
  value: string | number;
  onChange: (v: string | number) => void;
  options?: { label: string; value: string }[];
}
interface ConfigPanelProps {
  title: string;
  accentColor: string;
  fields: ConfigField[];
  onCancel: () => void;
  onGenerate: () => void;
  generating: boolean;
  error: string | null;
}
const ConfigPanel: React.FC<ConfigPanelProps> = ({
  title, accentColor, fields, onCancel, onGenerate, generating, error,
}) => (
  <div style={{ ...styles.configPanel, borderTopColor: accentColor }}>
    <div style={styles.configTitle}>{title}</div>
    {fields.map((f) => (
      <div key={f.label} style={styles.configRow}>
        <label style={styles.configLabel}>{f.label}</label>
        {f.type === "select" ? (
          <select
            value={String(f.value)}
            onChange={(e) => f.onChange(e.target.value)}
            style={styles.configSelect}
          >
            {f.options?.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <input
            type={f.type}
            value={f.value}
            onChange={(e) => f.onChange(f.type === "number" ? Number(e.target.value) : e.target.value)}
            style={styles.configInput}
          />
        )}
      </div>
    ))}
    {error && <div style={styles.configError}>{error}</div>}
    <div style={styles.configActions}>
      <button style={styles.configCancel} onClick={onCancel} disabled={generating}>Cancel</button>
      <button
        style={{ ...styles.configGenerate, background: accentColor, opacity: generating ? 0.6 : 1 }}
        onClick={onGenerate}
        disabled={generating}
      >
        {generating ? "Generating…" : "Generate"}
      </button>
    </div>
  </div>
);

const InstructionBanner: React.FC<{ text: string; color?: string }> = ({
  text, color = "#ef4444",
}) => (
  <div style={{ ...styles.instructionBanner, borderColor: color }}>
    <span style={{ ...styles.instructionDot, background: color }} />
    {text}
  </div>
);

const GeneratingOverlay: React.FC = () => (
  <div style={styles.generatingOverlay}>
    <div style={styles.generatingSpinner} />
    <span style={styles.generatingText}>Generating view…</span>
  </div>
);

interface ScaleBarProps { scale: number; stageScale: number; }
const ScaleBar: React.FC<ScaleBarProps> = ({ scale }) => {
  const barMm = 5000; // 5 metres
  return (
    <div style={styles.scaleBar}>
      <div style={styles.scaleBarLine} />
      <span style={styles.scaleBarLabel}>{(barMm / 1000).toFixed(0)} m</span>
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#0c0e12",
    overflow: "hidden",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    padding: "5px 8px",
    background: "#111318",
    borderBottom: "1px solid #2a2d35",
    flexShrink: 0,
    flexWrap: "wrap" as const,
  },
  toolbarSep: {
    width: 1,
    height: 24,
    background: "#2a2d35",
    margin: "0 4px",
  },
  toolBtn: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 10px",
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: 5,
    color: "#7a8090",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "'DM Mono', monospace",
    transition: "all 0.12s",
    outline: "none",
  },
  toolBtnActive: {
    background: "#1a1d28",
    border: "1px solid #3a3d50",
    color: "#c8d0ff",
  },
  toolBtnLabel: {
    fontSize: 11,
    letterSpacing: "0.03em",
    fontWeight: 500,
  },
  canvasArea: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  sectionLabel: {
    position: "absolute",
    top: 12,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#0e1015ee",
    border: "1px solid #2a3050",
    borderRadius: 6,
    padding: "6px 16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    pointerEvents: "none",
  },
  sectionLabelTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#c8d0ff",
    fontFamily: "'DM Mono', monospace",
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
  },
  sectionLabelScale: {
    fontSize: 10,
    color: "#6b7aaa",
    letterSpacing: "0.08em",
    fontFamily: "'DM Mono', monospace",
  },
  coords: {
    position: "absolute",
    bottom: 10,
    right: 10,
    background: "#0e1015cc",
    border: "1px solid #1e2130",
    borderRadius: 4,
    padding: "4px 10px",
    fontSize: 11,
    color: "#5a6080",
    fontFamily: "'DM Mono', monospace",
    pointerEvents: "none",
    fontFeatureSettings: '"tnum" 1',
  },
  instructionBanner: {
    position: "absolute",
    bottom: 40,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#0e1015ee",
    border: "1px solid",
    borderRadius: 6,
    padding: "7px 16px",
    fontSize: 12,
    color: "#c8d0e0",
    fontFamily: "'DM Mono', monospace",
    display: "flex",
    alignItems: "center",
    gap: 8,
    pointerEvents: "none",
    whiteSpace: "nowrap" as const,
  },
  instructionDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    flexShrink: 0,
  },
  configPanel: {
    position: "absolute",
    bottom: 16,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#111318",
    border: "1px solid #2a2d35",
    borderTop: "3px solid #ef4444",
    borderRadius: 8,
    padding: "14px 18px",
    minWidth: 320,
    zIndex: 100,
    boxShadow: "0 8px 40px #000a",
    fontFamily: "'DM Mono', monospace",
  },
  configTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: "#7a8090",
    marginBottom: 12,
  },
  configRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  configLabel: {
    fontSize: 11,
    color: "#7a8090",
    whiteSpace: "nowrap" as const,
    flex: 1,
  },
  configInput: {
    background: "#0e1015",
    border: "1px solid #2a2d35",
    borderRadius: 4,
    color: "#c8d0e0",
    padding: "4px 8px",
    fontSize: 12,
    fontFamily: "inherit",
    width: 140,
    outline: "none",
  },
  configSelect: {
    background: "#0e1015",
    border: "1px solid #2a2d35",
    borderRadius: 4,
    color: "#c8d0e0",
    padding: "4px 8px",
    fontSize: 12,
    fontFamily: "inherit",
    width: 160,
    outline: "none",
  },
  configActions: {
    display: "flex",
    gap: 8,
    marginTop: 14,
    justifyContent: "flex-end",
  },
  configCancel: {
    background: "transparent",
    border: "1px solid #2a2d35",
    borderRadius: 5,
    color: "#5a6070",
    padding: "6px 14px",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  configGenerate: {
    border: "none",
    borderRadius: 5,
    color: "#fff",
    padding: "6px 18px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "0.04em",
  },
  configError: {
    fontSize: 11,
    color: "#ef6060",
    background: "#2a1414",
    border: "1px solid #6b2a2a",
    borderRadius: 4,
    padding: "5px 8px",
    marginTop: 6,
  },
  generatingOverlay: {
    position: "absolute",
    inset: 0,
    background: "#0c0e12cc",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    zIndex: 200,
  },
  generatingSpinner: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "3px solid #2a2d35",
    borderTop: "3px solid #6b7aff",
    animation: "spin 0.8s linear infinite",
  },
  generatingText: {
    fontSize: 12,
    color: "#6b7aaa",
    fontFamily: "'DM Mono', monospace",
    letterSpacing: "0.06em",
  },
  scaleBar: {
    position: "absolute",
    bottom: 10,
    left: 16,
    display: "flex",
    alignItems: "center",
    gap: 6,
    pointerEvents: "none",
  },
  scaleBarLine: {
    width: 60,
    height: 4,
    background: "linear-gradient(90deg, #6b7aff 0%, #6b7aff 50%, transparent 50%)",
    border: "1px solid #6b7aff",
    borderRadius: 1,
  },
  scaleBarLabel: {
    fontSize: 10,
    color: "#6b7aff",
    fontFamily: "'DM Mono', monospace",
  },
  layerDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: 4,
    background: "#111318",
    border: "1px solid #2a2d35",
    borderRadius: 6,
    zIndex: 300,
    minWidth: 200,
    maxHeight: 300,
    overflowY: "auto" as const,
    boxShadow: "0 8px 32px #000a",
  },
  layerDropdownHeader: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.12em",
    color: "#5a6070",
    textTransform: "uppercase" as const,
    padding: "8px 12px 4px",
    borderBottom: "1px solid #1e2130",
    fontFamily: "'DM Mono', monospace",
  },
  layerList: {
    padding: "4px 0",
  },
  layerRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 12px",
    cursor: "pointer",
    transition: "background 0.1s",
  },
  layerSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    flexShrink: 0,
  },
  layerName: {
    fontSize: 11,
    color: "#9a9eb0",
    fontFamily: "'DM Mono', monospace",
  },
};

export default CAD2DViewer;
