// ViewportRenderer.tsx — Renders Model Space entities clipped to a viewport rectangle
import React, { useCallback } from "react";
import { Group, Rect, Text, Line, Circle, Arc, Shape } from "react-konva";
import type { ViewportDescriptor } from "./LayoutTabs";
import type { KonvaEventObject } from "konva/lib/Node";

// ─── Types ──────────────────────────────────────────────────────────────────

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

interface ViewportRendererProps {
  viewport: ViewportDescriptor;
  /** All model space entities (unfiltered) */
  modelEntities: DXFEntity[];
  /** Block definitions map */
  blocks: Record<string, DXFEntity[]>;
  /** Global layer visibility map */
  layerVisibility: Record<string, boolean>;
  /** Paper-space canvas scale factor (zoom) */
  canvasScale: number;
  /** Whether to show the viewport border */
  showBorder: boolean;
}

// ─── Coordinate transform ────────────────────────────────────────────────────

/**
 * Transform a model-space [x, y] coordinate to paper-space canvas [px, py].
 * Formula: paper_pos = center_paper + (model_pos - center_model) * scale
 * Konva Y axis is inverted vs DXF.
 */
function modelToPaper(
  mx: number,
  my: number,
  vp: ViewportDescriptor
): [number, number] {
  const [cpx, cpy] = vp.center_paper;
  const [cmx, cmy] = vp.center_model;
  const s = vp.scale;
  const px = cpx + (mx - cmx) * s;
  // DXF Y increases upward; Konva Y increases downward → negate
  const py = cpy - (my - cmy) * s;
  return [px, py];
}

function modelLengthToPaper(len: number, vp: ViewportDescriptor): number {
  return len * vp.scale;
}

// ─── Line dash helper ────────────────────────────────────────────────────────

function dashForLinetype(lt?: string): number[] | undefined {
  if (!lt) return undefined;
  const u = lt.toUpperCase();
  if (u === "DASHED" || u === "DASHED2" || u === "DASHEDX2") return [8, 4];
  if (u === "DOTTED" || u === "DOT") return [1, 4];
  if (u === "CENTER" || u === "CENTER2") return [12, 3, 3, 3];
  if (u.includes("DASH") && u.includes("DOT")) return [8, 3, 1, 3];
  return undefined;
}

// ─── Individual entity renderers ─────────────────────────────────────────────

const EntityRenderer: React.FC<{
  entity: DXFEntity;
  vp: ViewportDescriptor;
  blocks: Record<string, DXFEntity[]>;
  depth?: number;
}> = ({ entity, vp, blocks, depth = 0 }) => {
  if (depth > 6) return null;

  const color = entity.color || "#FFFFFF";
  const dash = dashForLinetype(entity.linetype);
  const lineWidth = Math.max(0.5, modelLengthToPaper(
    entity.lineweight != null && entity.lineweight > 0 ? entity.lineweight / 100 : 0.25,
    vp
  ));

  const commonLineProps = {
    stroke: color,
    strokeWidth: Math.max(0.5, lineWidth),
    dash: dash,
    listening: false,
    perfectDrawEnabled: false,
  };

  switch (entity.type) {
    case "LINE": {
      const [x1, y1] = modelToPaper(entity.start[0], entity.start[1], vp);
      const [x2, y2] = modelToPaper(entity.end[0], entity.end[1], vp);
      return <Line points={[x1, y1, x2, y2]} {...commonLineProps} />;
    }

    case "CIRCLE": {
      const [cx, cy] = modelToPaper(entity.center[0], entity.center[1], vp);
      const r = modelLengthToPaper(entity.radius, vp);
      return <Circle x={cx} y={cy} radius={r} {...commonLineProps} fill="transparent" />;
    }

    case "ARC": {
      const [cx, cy] = modelToPaper(entity.center[0], entity.center[1], vp);
      const r = modelLengthToPaper(entity.radius, vp);
      // DXF angles are CCW from X; Konva angles are CW from X; Y is flipped
      const startAngle = -entity.end_angle * (Math.PI / 180);
      const endAngle = -entity.start_angle * (Math.PI / 180);
      return (
        <Arc
          x={cx} y={cy}
          innerRadius={0}
          outerRadius={r}
          angle={(entity.end_angle - entity.start_angle + 360) % 360}
          rotation={-entity.end_angle}
          {...commonLineProps}
          fill="transparent"
        />
      );
    }

    case "LWPOLYLINE":
    case "POLYLINE":
    case "2DPOLYLINE": {
      const pts = entity.points as Array<{ x: number; y: number; bulge?: number }>;
      if (!pts || pts.length < 2) return null;
      const flat: number[] = [];
      for (const p of pts) {
        const [px, py] = modelToPaper(p.x, p.y, vp);
        flat.push(px, py);
      }
      if (entity.is_closed && flat.length >= 4) {
        flat.push(flat[0], flat[1]);
      }
      return (
        <Line
          points={flat}
          closed={entity.is_closed}
          {...commonLineProps}
        />
      );
    }

    case "TEXT":
    case "MTEXT": {
      const [tx, ty] = modelToPaper(entity.position[0], entity.position[1], vp);
      const fontSize = Math.max(4, modelLengthToPaper(entity.height || 2.5, vp));
      return (
        <Text
          x={tx}
          y={ty - fontSize}
          text={entity.text || ""}
          fontSize={fontSize}
          fill={color}
          rotation={-(entity.rotation || 0)}
          listening={false}
          fontFamily="'JetBrains Mono', monospace"
        />
      );
    }

    case "INSERT": {
      const blockEntities = blocks[entity.block_name];
      if (!blockEntities || depth > 5) return null;
      const [ix, iy] = modelToPaper(entity.insert[0], entity.insert[1], vp);
      const xScale = (entity.x_scale || 1) * vp.scale;
      const yScale = (entity.y_scale || 1) * vp.scale;
      return (
        <Group
          x={ix} y={iy}
          scaleX={xScale} scaleY={yScale}
          rotation={-(entity.rotation || 0)}
        >
          {blockEntities.map((be) => (
            <EntityRenderer
              key={be.handle}
              entity={{ ...be, color: be.color === "#FFFFFF" ? color : be.color }}
              vp={{ ...vp, scale: 1, center_paper: [0, 0], center_model: [0, 0, 0] }}
              blocks={blocks}
              depth={depth + 1}
            />
          ))}
        </Group>
      );
    }

    case "HATCH": {
      if (!entity.paths) return null;
      return (
        <Group listening={false}>
          {entity.paths.map((path: any, pi: number) => {
            if (path.type === "polyline") {
              const flat: number[] = [];
              for (const p of path.points) {
                const [px, py] = modelToPaper(p[0], p[1], vp);
                flat.push(px, py);
              }
              return (
                <Line
                  key={pi}
                  points={flat}
                  closed={true}
                  fill={entity.solid_fill ? color : "transparent"}
                  stroke={color}
                  strokeWidth={0.5}
                  opacity={entity.solid_fill ? 0.35 : 1}
                  listening={false}
                />
              );
            }
            return null;
          })}
        </Group>
      );
    }

    case "ELLIPSE": {
      const [ecx, ecy] = modelToPaper(entity.center[0], entity.center[1], vp);
      const majorLen = Math.sqrt(
        entity.major_axis[0] ** 2 + entity.major_axis[1] ** 2
      );
      const rx = modelLengthToPaper(majorLen, vp);
      const ry = rx * (entity.ratio || 1);
      const rotation = Math.atan2(entity.major_axis[1], entity.major_axis[0]) * (180 / Math.PI);
      return (
        <Shape
          sceneFunc={(ctx, shape) => {
            ctx.beginPath();
            ctx.ellipse(0, 0, rx, ry, 0, 0, 2 * Math.PI);
            ctx.strokeShape(shape);
          }}
          x={ecx} y={ecy}
          rotation={-rotation}
          {...commonLineProps}
        />
      );
    }

    case "SOLID":
    case "TRACE":
    case "3DFACE": {
      const verts = entity.vertices as [number, number, number][];
      if (!verts || verts.length < 3) return null;
      const flat: number[] = [];
      for (const v of verts) {
        const [px, py] = modelToPaper(v[0], v[1], vp);
        flat.push(px, py);
      }
      return <Line points={flat} closed fill={color} stroke={color} strokeWidth={0.5} listening={false} />;
    }

    default:
      return null;
  }
};

// ─── Main component ───────────────────────────────────────────────────────────

const ViewportRenderer: React.FC<ViewportRendererProps> = ({
  viewport: vp,
  modelEntities,
  blocks,
  layerVisibility,
  canvasScale,
  showBorder,
}) => {
  const [cpx, cpy] = vp.center_paper;
  const hw = vp.width_paper / 2;
  const hh = vp.height_paper / 2;
  const rectX = cpx - hw;
  const rectY = cpy - hh;
  const w = vp.width_paper;
  const h = vp.height_paper;

  // Clip function: constrains drawing to the viewport rectangle
  const clipFunc = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.rect(rectX, rectY, w, h);
    },
    [rectX, rectY, w, h]
  );

  // Filter entities to those visible in this viewport
  const visibleEntities = modelEntities.filter((e) => {
    if (e.visible === false) return false;
    const layerName = e.layer || "0";
    if (layerVisibility[layerName] === false) return false;
    if (vp.frozen_layers.includes(layerName)) return false;
    return true;
  });

  const labelFontSize = Math.max(8, 10 / canvasScale);

  return (
    <Group>
      {/* Clipped content group */}
      <Group clipFunc={clipFunc} listening={false}>
        {/* White background for the viewport area */}
        <Rect x={rectX} y={rectY} width={w} height={h} fill="#f8f8fc" listening={false} />

        {/* Model space entities rendered through this viewport */}
        {visibleEntities.map((entity) => (
          <EntityRenderer
            key={entity.handle}
            entity={entity}
            vp={vp}
            blocks={blocks}
          />
        ))}
      </Group>

      {/* Viewport border */}
      {showBorder && (
        <Rect
          x={rectX}
          y={rectY}
          width={w}
          height={h}
          stroke="#4466cc"
          strokeWidth={1 / canvasScale}
          dash={[4 / canvasScale, 3 / canvasScale]}
          fill="transparent"
          listening={false}
        />
      )}

      {/* Scale label below viewport */}
      <Text
        x={rectX}
        y={rectY + h + 2 / canvasScale}
        text={`Scale ${vp.scale_label}`}
        fontSize={labelFontSize}
        fill="#4466cc"
        listening={false}
        fontFamily="'JetBrains Mono', monospace"
      />
    </Group>
  );
};

export default ViewportRenderer;
export { EntityRenderer, modelToPaper, modelLengthToPaper };
