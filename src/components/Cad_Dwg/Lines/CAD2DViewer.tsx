/**
 * CAD2DViewer.tsx
 * Senior-grade React-Konva CAD renderer with:
 *  - Physical lineweight simulation (mm → pixels at current zoom/plotScale)
 *  - Full linetype dash pattern rendering (scaled with zoom)
 *  - Dash offset animation for CENTER / PHANTOM linetypes (opt-in)
 *  - Symbol linetypes: FENCELINE1, ZIGZAG, TRACKS, BATTING, HOT_WATER_SUPPLY
 *  - Plot Preview mode (white bg, print-weight pixels, color inversion)
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Konva from "konva";
import {
  Arc,
  Arrow,
  Circle,
  Ellipse as KonvaEllipse,
  Group,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
} from "react-konva";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DXFEntity {
  type: string;
  layer: string;
  color: string;
  colorRGB: [number, number, number];
  lineweight_mm: number;
  linetype_name: string;
  linetype_pattern: number[];
  linetype_scale: number;
  is_symbol_linetype?: boolean;
  // Geometry fields (optional per type)
  x1?: number; y1?: number; x2?: number; y2?: number;
  points?: [number, number][];
  closed?: boolean;
  cx?: number; cy?: number; radius?: number;
  start_angle?: number; end_angle?: number;
  major_axis?: [number, number]; ratio?: number;
  start_param?: number; end_param?: number;
  x?: number; y?: number;
  height?: number; rotation?: number; text?: string;
  paths?: Array<Array<{
    edge_type: "LINE" | "ARC";
    start?: number[]; end?: number[];
    center?: number[]; radius?: number;
    start_angle?: number; end_angle?: number; ccw?: boolean;
  }>>;
  solid_fill?: boolean;
}

export interface LayerMeta {
  name: string;
  color: string;
  lineweight_mm: number;
  linetype_name: string;
  linetype_pattern: number[];
  is_frozen: boolean;
  is_off: boolean;
}

export interface DrawingData {
  entities: DXFEntity[];
  layers: LayerMeta[];
  extents: { min_x: number; min_y: number; max_x: number; max_y: number };
  units_per_mm: number;
  standard_linetypes: Record<string, number[]>;
}

interface ViewerProps {
  data: DrawingData;
  hiddenLayers: Set<string>;
  animateLinetypes: boolean;
  plotPreview: boolean;
  stageRef?: React.RefObject<Konva.Stage>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ANIMATED_LINETYPES = new Set(["CENTER", "CENTER2", "CENTERX2", "PHANTOM", "PHANTOM2", "PHANTOMX2"]);

const PLOT_COLOR_MAP: Record<string, string> = {
  "#ffffff": "#000000",
  "#ffff00": "#808000",
  "#00ffff": "#006666",
  "#00ff00": "#006600",
  "#ff0000": "#cc0000",
  "#0000ff": "#0000cc",
  "#ff00ff": "#660066",
  "#c0c0c0": "#404040",
  "#808080": "#202020",
};

// Standard linetype fallback table (mirrors backend)
const STANDARD_LINETYPES: Record<string, number[]> = {
  CONTINUOUS: [],
  DASHED: [12.0, -6.0],
  DASHED2: [6.0, -3.0],
  DASHEDX2: [24.0, -12.0],
  HIDDEN: [6.0, -3.0],
  HIDDEN2: [3.0, -1.5],
  HIDDENX2: [12.0, -6.0],
  CENTER: [31.75, -6.35, 6.35, -6.35],
  CENTER2: [15.875, -3.175, 3.175, -3.175],
  CENTERX2: [63.5, -12.7, 12.7, -12.7],
  PHANTOM: [25.4, -5.08, 5.08, -5.08, 5.08, -5.08],
  PHANTOM2: [12.7, -2.54, 2.54, -2.54, 2.54, -2.54],
  PHANTOMX2: [50.8, -10.16, 10.16, -10.16, 10.16, -10.16],
  DOT: [0, -6.35],
  DOT2: [0, -3.175],
  DOTX2: [0, -12.7],
  DASHDOT: [12.7, -3.18, 0, -3.18],
  DASHDOT2: [6.35, -1.59, 0, -1.59],
  DASHDOTX2: [25.4, -6.35, 0, -6.35],
  BORDER: [12.7, -3.18, 12.7, -3.18, 0, -3.18],
  BORDER2: [6.35, -1.59, 6.35, -1.59, 0, -1.59],
  BORDERX2: [25.4, -6.35, 25.4, -6.35, 0, -6.35],
  DIVIDE: [12.7, -3.18, 0, -3.18, 0, -3.18],
  DIVIDE2: [6.35, -1.59, 0, -1.59, 0, -1.59],
  DIVIDEX2: [25.4, -6.35, 0, -6.35, 0, -6.35],
  FENCELINE1: [12.7, -2.54, 0, -2.54],
  ZIGZAG: [12.7, -6.35, 6.35, -6.35],
  TRACKS: [12.7, -2.54],
  BATTING: [12.7, -2.54, 6.35, -2.54],
  HOT_WATER_SUPPLY: [12.7, -3.18, 0, -3.18, 12.7, -3.18],
};

// ─────────────────────────────────────────────────────────────────────────────
// Utility — lineweight
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve physical mm lineweight → screen pixels.
 * @param lw_mm         lineweight in millimetres
 * @param scale         canvas pixels per drawing unit
 * @param units_per_mm  drawing units per mm (1/INSUNITS_TO_MM factor)
 * @param plotPreview   if true, simulate A1 print at 150 DPI
 */
export function resolveStrokeWidth(
  lw_mm: number,
  scale: number,
  units_per_mm: number,
  plotPreview: boolean
): number {
  if (plotPreview) {
    // A1 = 841mm wide; at 150 DPI ≈ 4961 px. 1mm = 5.9px at 150dpi
    const DPI_MM = 150 / 25.4;
    return Math.max(lw_mm * DPI_MM, 0.5);
  }
  // Physical: 1 drawing unit = (1/units_per_mm) mm
  // So 1 mm in drawing coords = units_per_mm drawing units
  // At this scale: 1 drawing unit = scale pixels
  // Therefore 1 mm = units_per_mm * scale pixels
  const pixels = lw_mm * units_per_mm * scale;
  return Math.max(pixels, 0.5);
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility — dash pattern
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve DXF linetype pattern → Konva dash array (canvas pixels).
 * Positive values = dash, negative = gap, zero = dot (rendered as 0.5px)
 */
function resolveDash(
  pattern: number[],
  ltscale: number,
  scale: number,           // pixels per drawing unit
  units_per_mm: number     // drawing units per mm
): number[] {
  if (!pattern || pattern.length === 0) return [];
  // Pattern values are in drawing units already (ezdxf exposes in drawing units)
  return pattern.map((v) => {
    const abs = Math.abs(v) * ltscale * scale;
    return v === 0 ? 0.5 : Math.max(abs, 0.5);
  });
}

// Cache: key = `${ltName}:${ltscale.toFixed(3)}:${scaleBucket}` → number[]
const dashCache = new Map<string, number[]>();

function cachedDash(
  pattern: number[],
  ltscale: number,
  scale: number,
  units_per_mm: number
): number[] {
  // Bucket scale changes to ±10% to reduce thrashing
  const bucket = Math.round(Math.log2(scale) * 10);
  const key = `${pattern.join(",")}_${ltscale.toFixed(3)}_${bucket}`;
  if (dashCache.has(key)) return dashCache.get(key)!;
  const result = resolveDash(pattern, ltscale, scale, units_per_mm);
  dashCache.set(key, result);
  // Prune cache if it grows beyond 500 entries
  if (dashCache.size > 500) {
    const first = dashCache.keys().next().value;
    dashCache.delete(first);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility — color
// ─────────────────────────────────────────────────────────────────────────────

function resolveColor(entity: DXFEntity, plotPreview: boolean): string {
  const raw = entity.color.toLowerCase();
  if (!plotPreview) return raw;
  return PLOT_COLOR_MAP[raw] ?? raw.replace(
    /#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/,
    (_, r, g, b) => {
      const inv = (x: string) => (255 - parseInt(x, 16)).toString(16).padStart(2, "0");
      // Soft invert: darken rather than full invert for readability
      const darken = (x: string) => Math.round(parseInt(x, 16) * 0.4).toString(16).padStart(2, "0");
      return "#" + darken(r) + darken(g) + darken(b);
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility — symbol linetype helpers
// ─────────────────────────────────────────────────────────────────────────────

interface SymbolPlacement { x: number; y: number; angle: number }

function computeLineLength(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function interpolateAlong(
  x1: number, y1: number, x2: number, y2: number,
  t: number  // 0..1
): { x: number; y: number; angle: number } {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, angle };
}

function symbolsAlong(
  x1: number, y1: number, x2: number, y2: number,
  intervalPx: number
): SymbolPlacement[] {
  const len = computeLineLength(x1, y1, x2, y2);
  if (len < intervalPx) return [];
  const count = Math.floor(len / intervalPx);
  return Array.from({ length: count }, (_, i) =>
    interpolateAlong(x1, y1, x2, y2, ((i + 0.5) * intervalPx) / len)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Symbol renderers
// ─────────────────────────────────────────────────────────────────────────────

function FenceLine1Symbol({ p, r, color }: { p: SymbolPlacement; r: number; color: string }) {
  return (
    <Circle
      x={p.x} y={p.y}
      radius={r}
      stroke={color} strokeWidth={0.8}
      fill="transparent"
    />
  );
}

function TracksSymbol({ p, len, color, sw }: {
  p: SymbolPlacement; len: number; color: string; sw: number;
}) {
  const cos = Math.cos(p.angle + Math.PI / 2);
  const sin = Math.sin(p.angle + Math.PI / 2);
  return (
    <Line
      points={[
        p.x - cos * len, p.y - sin * len,
        p.x + cos * len, p.y + sin * len,
      ]}
      stroke={color} strokeWidth={sw}
    />
  );
}

function BattingArc({ p, r, color, sw }: {
  p: SymbolPlacement; r: number; color: string; sw: number;
}) {
  // Draw a small semicircular arc perpendicular to line direction
  return (
    <Arc
      x={p.x} y={p.y}
      innerRadius={0} outerRadius={r}
      angle={180}
      rotation={(p.angle * 180) / Math.PI - 90}
      stroke={color} strokeWidth={sw}
      fill="transparent"
    />
  );
}

function HotWaterSymbol({ p, size, color, sw }: {
  p: SymbolPlacement; size: number; color: string; sw: number;
}) {
  // Arrow pointing in line direction with "HW" offset
  const cos = Math.cos(p.angle);
  const sin = Math.sin(p.angle);
  return (
    <Group>
      <Arrow
        points={[
          p.x - cos * size, p.y - sin * size,
          p.x + cos * size, p.y + sin * size,
        ]}
        pointerLength={size * 0.4}
        pointerWidth={size * 0.3}
        fill={color} stroke={color} strokeWidth={sw}
      />
      <Text
        x={p.x + sin * size * 1.4 - size * 0.6}
        y={p.y - cos * size * 1.4 - size * 0.4}
        text="HW"
        fontSize={size * 0.9}
        fill={color}
        rotation={(p.angle * 180) / Math.PI}
      />
    </Group>
  );
}

// ZigZag: a "Z" wave along the line (series of alternating angled strokes)
function ZigZagSegment({ x1, y1, x2, y2, amplitude, color, sw }: {
  x1: number; y1: number; x2: number; y2: number;
  amplitude: number; color: string; sw: number;
}) {
  const len = computeLineLength(x1, y1, x2, y2);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const perp = angle + Math.PI / 2;
  const count = Math.max(2, Math.round(len / amplitude));
  const pts: number[] = [];

  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const bx = x1 + (x2 - x1) * t;
    const by = y1 + (y2 - y1) * t;
    const flip = i % 2 === 0 ? 1 : -1;
    pts.push(
      bx + Math.cos(perp) * amplitude * flip * 0.5,
      by + Math.sin(perp) * amplitude * flip * 0.5
    );
  }
  return <Line points={pts} stroke={color} strokeWidth={sw} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity renderers
// ─────────────────────────────────────────────────────────────────────────────

interface RenderProps {
  entity: DXFEntity;
  scale: number;
  units_per_mm: number;
  animateLinetypes: boolean;
  plotPreview: boolean;
  dashOffset: number;
  flipY: number; // canvas Y = flipY - entity.y (to invert Y axis)
}

function EntityRenderer(props: RenderProps) {
  const { entity, scale, units_per_mm, animateLinetypes, plotPreview, dashOffset, flipY } = props;

  const color = resolveColor(entity, plotPreview);
  const sw = resolveStrokeWidth(entity.lineweight_mm, scale, units_per_mm, plotPreview);

  const rawPattern = entity.linetype_pattern?.length
    ? entity.linetype_pattern
    : (STANDARD_LINETYPES[entity.linetype_name] ?? []);
  const dash = cachedDash(rawPattern, entity.linetype_scale ?? 1, scale, units_per_mm);

  const isAnimated = animateLinetypes && ANIMATED_LINETYPES.has(entity.linetype_name);
  const offset = isAnimated ? dashOffset : 0;

  // Utility: flip Y for canvas (DXF Y increases upward, canvas downward)
  const fy = (y: number) => flipY - y * scale;
  const fx = (x: number) => x * scale;

  switch (entity.type) {
    case "LINE": {
      if (entity.x1 == null) return null;
      const x1c = fx(entity.x1!);
      const y1c = fy(entity.y1!);
      const x2c = fx(entity.x2!);
      const y2c = fy(entity.y2!);

      if (entity.is_symbol_linetype) {
        return (
          <SymbolLineRenderer
            x1={x1c} y1={y1c} x2={x2c} y2={y2c}
            ltName={entity.linetype_name}
            color={color} sw={sw} scale={scale}
          />
        );
      }

      return (
        <Line
          points={[x1c, y1c, x2c, y2c]}
          stroke={color}
          strokeWidth={sw}
          dash={dash}
          dashOffset={offset}
        />
      );
    }

    case "LWPOLYLINE":
    case "POLYLINE":
    case "SPLINE": {
      if (!entity.points?.length) return null;
      const pts = entity.points.flatMap(([px, py]) => [fx(px), fy(py)]);

      if (entity.is_symbol_linetype && entity.points.length >= 2) {
        // Render symbol linetype for each segment of the polyline
        const segments: React.ReactNode[] = [];
        for (let i = 0; i < entity.points.length - 1; i++) {
          const [ax, ay] = entity.points[i];
          const [bx, by] = entity.points[i + 1];
          segments.push(
            <SymbolLineRenderer
              key={i}
              x1={fx(ax)} y1={fy(ay)} x2={fx(bx)} y2={fy(by)}
              ltName={entity.linetype_name}
              color={color} sw={sw} scale={scale}
            />
          );
        }
        return <Group>{segments}</Group>;
      }

      return (
        <Line
          points={pts}
          stroke={color}
          strokeWidth={sw}
          closed={entity.closed}
          dash={dash}
          dashOffset={offset}
        />
      );
    }

    case "CIRCLE": {
      if (entity.cx == null) return null;
      return (
        <Circle
          x={fx(entity.cx!)}
          y={fy(entity.cy!)}
          radius={entity.radius! * scale}
          stroke={color}
          strokeWidth={sw}
          fill="transparent"
          dash={dash}
          dashOffset={offset}
        />
      );
    }

    case "ARC": {
      if (entity.cx == null) return null;
      // DXF arc: angles in degrees, CCW, Y-up
      // Konva arc: clockwise, Y-down
      // We need to flip both angles
      const startAngle = -(entity.end_angle! % 360);
      const endAngle = -(entity.start_angle! % 360);
      let sweepDeg = endAngle - startAngle;
      if (sweepDeg <= 0) sweepDeg += 360;

      return (
        <Arc
          x={fx(entity.cx!)}
          y={fy(entity.cy!)}
          innerRadius={0}
          outerRadius={entity.radius! * scale}
          angle={sweepDeg}
          rotation={startAngle}
          stroke={color}
          strokeWidth={sw}
          fill="transparent"
          dash={dash}
          dashOffset={offset}
        />
      );
    }

    case "ELLIPSE": {
      if (entity.cx == null) return null;
      const [majX, majY] = entity.major_axis ?? [1, 0];
      const majorLen = Math.sqrt(majX ** 2 + majY ** 2) * scale;
      const minorLen = majorLen * (entity.ratio ?? 1);
      const rotDeg = (Math.atan2(majY, majX) * 180) / Math.PI;

      return (
        <KonvaEllipse
          x={fx(entity.cx!)}
          y={fy(entity.cy!)}
          radiusX={majorLen}
          radiusY={minorLen}
          rotation={-rotDeg}
          stroke={color}
          strokeWidth={sw}
          fill="transparent"
          dash={dash}
          dashOffset={offset}
        />
      );
    }

    case "TEXT":
    case "MTEXT": {
      if (entity.x == null) return null;
      const fontSize = Math.max((entity.height ?? 2.5) * scale, 4);
      return (
        <Text
          x={fx(entity.x!)}
          y={fy(entity.y!) - fontSize}
          text={entity.text ?? ""}
          fontSize={fontSize}
          fill={color}
          rotation={-(entity.rotation ?? 0)}
        />
      );
    }

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Symbol line renderer
// ─────────────────────────────────────────────────────────────────────────────

function SymbolLineRenderer({
  x1, y1, x2, y2, ltName, color, sw, scale,
}: {
  x1: number; y1: number; x2: number; y2: number;
  ltName: string; color: string; sw: number; scale: number;
}) {
  const baseInterval = 30 * scale; // 30 drawing units between symbols
  const symbolSize = Math.max(4, 6 * scale);

  // Always draw the underlying line
  const baseLine = (
    <Line
      points={[x1, y1, x2, y2]}
      stroke={color}
      strokeWidth={sw}
    />
  );

  let symbols: React.ReactNode = null;

  if (ltName === "FENCELINE1") {
    const placements = symbolsAlong(x1, y1, x2, y2, baseInterval);
    symbols = placements.map((p, i) => (
      <FenceLine1Symbol key={i} p={p} r={symbolSize * 0.4} color={color} />
    ));
  } else if (ltName === "TRACKS") {
    const placements = symbolsAlong(x1, y1, x2, y2, baseInterval * 0.6);
    symbols = placements.map((p, i) => (
      <TracksSymbol key={i} p={p} len={symbolSize * 0.6} color={color} sw={sw} />
    ));
  } else if (ltName === "BATTING") {
    const placements = symbolsAlong(x1, y1, x2, y2, baseInterval * 0.7);
    symbols = placements.map((p, i) => (
      <BattingArc key={i} p={p} r={symbolSize * 0.5} color={color} sw={sw} />
    ));
  } else if (ltName === "HOT_WATER_SUPPLY") {
    const placements = symbolsAlong(x1, y1, x2, y2, baseInterval);
    symbols = placements.map((p, i) => (
      <HotWaterSymbol key={i} p={p} size={symbolSize} color={color} sw={sw} />
    ));
  } else if (ltName === "ZIGZAG") {
    symbols = (
      <ZigZagSegment
        x1={x1} y1={y1} x2={x2} y2={y2}
        amplitude={symbolSize * 0.8}
        color={color} sw={sw}
      />
    );
  }

  return (
    <Group>
      {baseLine}
      {symbols}
    </Group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Viewer
// ─────────────────────────────────────────────────────────────────────────────

export const CAD2DViewer: React.FC<ViewerProps> = ({
  data,
  hiddenLayers,
  animateLinetypes,
  plotPreview,
  stageRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [dashOffset, setDashOffset] = useState(0);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDims({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit-to-extent on first load / data change
  const { extents, units_per_mm } = data;
  const drawingW = extents.max_x - extents.min_x;
  const drawingH = extents.max_y - extents.min_y;

  useEffect(() => {
    if (drawingW === 0 || drawingH === 0) return;
    const padding = 0.05;
    const fitScale = Math.min(
      (dims.width * (1 - padding)) / drawingW,
      (dims.height * (1 - padding)) / drawingH
    );
    const cx = dims.width / 2 - (extents.min_x + drawingW / 2) * fitScale;
    const cy = dims.height / 2 - (extents.min_y + drawingH / 2) * fitScale; // will be adjusted for flipY
    setStageScale(fitScale);
    setStagePos({ x: cx, y: cy });
  }, [dims.width, dims.height, drawingW, drawingH]);

  // Scroll zoom
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage()!;
    const pointer = stage.getPointerPosition()!;
    const oldScale = stageScale;
    const factor = e.evt.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newScale = Math.min(Math.max(oldScale * factor, 0.001), 500);

    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };
    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, [stageScale, stagePos]);

  // Animation loop for dash offset
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (!animateLinetypes) { setDashOffset(0); return; }
    let offset = 0;
    const tick = () => {
      offset = (offset + 0.5) % 1000;
      setDashOffset(offset);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animateLinetypes]);

  // The canvas Y origin is at top. DXF Y origin is at bottom. We use a flipY
  // transform: canvas_y = flipY_const - dxf_y * scale.
  // Since stage has its own position/scale, we pre-multiply:
  // The entities are rendered at raw DXF units, and we multiply inside EntityRenderer.
  // flipY represents the drawing height in pixels, so that DXF (0,0) maps to bottom-left.
  const flipY = drawingH * stageScale; // approximate — entities apply their own scale

  // Filter visible entities
  const visibleEntities = useMemo(
    () => data.entities.filter((e) => !hiddenLayers.has(e.layer)),
    [data.entities, hiddenLayers]
  );

  const bg = plotPreview ? "#ffffff" : "#0a0e1a";

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", background: bg, overflow: "hidden" }}
    >
      <Stage
        ref={stageRef}
        width={dims.width}
        height={dims.height}
        x={stagePos.x}
        y={stagePos.y + flipY}   // anchor so DXF Y=0 is near bottom
        scaleX={stageScale}
        scaleY={-stageScale}    // negative Y to flip coordinate system
        draggable
        onDragEnd={(e) => {
          const stage = e.target as Konva.Stage;
          setStagePos({ x: stage.x(), y: stage.y() - flipY });
        }}
        onWheel={handleWheel}
      >
        <Layer>
          {visibleEntities.map((entity, idx) => (
            <EntityRenderer
              key={idx}
              entity={entity}
              scale={1} // scale applied by Stage.scaleX/Y
              units_per_mm={units_per_mm}
              animateLinetypes={animateLinetypes}
              plotPreview={plotPreview}
              dashOffset={dashOffset}
              flipY={0} // no per-entity flip needed since Stage handles it
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Linetype mini-canvas preview (used by LayerPanel)
// ─────────────────────────────────────────────────────────────────────────────

interface LinetypePreviewProps {
  pattern: number[];
  ltscale?: number;
  color?: string;
  width?: number;
  height?: number;
}

export const LinetypePreview: React.FC<LinetypePreviewProps> = ({
  pattern,
  ltscale = 1,
  color = "#ffffff",
  width = 60,
  height = 15,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";

    if (!pattern || pattern.length === 0) {
      // Continuous
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    // Scale pattern to fit within `width` pixels
    const patternLen = pattern.reduce((s, v) => s + Math.abs(v), 0);
    const scale = patternLen > 0 ? (width * 0.85) / (patternLen * ltscale) : 1;
    const dash = pattern.map((v) => (v === 0 ? 0.5 : Math.max(Math.abs(v) * ltscale * scale, 0.5)));

    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(width * 0.075, height / 2);
    ctx.lineTo(width * 0.925, height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [pattern, ltscale, color, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: "block" }}
    />
  );
};

export default CAD2DViewer;
