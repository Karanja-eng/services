/**
 * CAD2DViewer.tsx
 * 2-D canvas viewer using React-Konva.
 * Supports layer/block-source visibility filtering and click-to-select tooltips.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import { Arc, Circle, Group, Layer, Line, Stage, Text } from "react-konva";
import type Konva from "konva";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CadEntity {
  id: string;
  type: string;
  layer: string;
  color: string;
  block_source?: string | null;
  is_attrib?: boolean;
  // LINE
  x1?: number; y1?: number; x2?: number; y2?: number;
  // CIRCLE / ARC
  cx?: number; cy?: number; radius?: number;
  // ARC
  start_angle?: number; end_angle?: number;
  // TEXT
  x?: number; y?: number; text?: string; height?: number; rotation?: number;
  // POLYLINE
  points?: Array<{ x: number; y: number }>; closed?: boolean;
}

export interface CAD2DViewerProps {
  entities: CadEntity[];
  visibleLayers: Set<string>;
  visibleBlockSources: Set<string>;
  width?: number;
  height?: number;
}

// ---------------------------------------------------------------------------
// Bounding-box helpers for auto-fit
// ---------------------------------------------------------------------------

interface BBox { minX: number; minY: number; maxX: number; maxY: number }

function unionBBox(a: BBox, b: BBox): BBox {
  return {
    minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY),
  };
}

function computeBBox(entities: CadEntity[]): BBox | null {
  let bbox: BBox | null = null;
  for (const e of entities) {
    let eb: BBox | null = null;
    if (e.type === "LINE" && e.x1 != null) {
      eb = {
        minX: Math.min(e.x1, e.x2!), minY: Math.min(e.y1!, e.y2!),
        maxX: Math.max(e.x1, e.x2!), maxY: Math.max(e.y1!, e.y2!),
      };
    } else if (e.type === "CIRCLE" && e.cx != null) {
      eb = {
        minX: e.cx - e.radius!, minY: e.cy! - e.radius!,
        maxX: e.cx + e.radius!, maxY: e.cy! + e.radius!,
      };
    } else if (e.type === "ARC" && e.cx != null) {
      eb = {
        minX: e.cx - e.radius!, minY: e.cy! - e.radius!,
        maxX: e.cx + e.radius!, maxY: e.cy! + e.radius!,
      };
    } else if (e.type === "TEXT" && e.x != null) {
      eb = { minX: e.x, minY: e.y!, maxX: e.x + 1, maxY: e.y! + 1 };
    } else if (e.type === "POLYLINE" && e.points?.length) {
      const xs = e.points.map((p) => p.x);
      const ys = e.points.map((p) => p.y);
      eb = { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
    }
    if (eb) bbox = bbox ? unionBBox(bbox, eb) : eb;
  }
  return bbox;
}

// ---------------------------------------------------------------------------
// Coordinate transform: DXF (Y-up) → Konva (Y-down)
// ---------------------------------------------------------------------------

interface Transform { scale: number; offsetX: number; offsetY: number }

function makeTransform(bbox: BBox, viewW: number, viewH: number, padding = 40): Transform {
  const dxfW = bbox.maxX - bbox.minX || 1;
  const dxfH = bbox.maxY - bbox.minY || 1;
  const scale = Math.min((viewW - padding * 2) / dxfW, (viewH - padding * 2) / dxfH);
  const offsetX = padding - bbox.minX * scale + ((viewW - padding * 2) - dxfW * scale) / 2;
  // Flip Y: Konva origin top-left, DXF origin bottom-left
  const offsetY = viewH - padding + bbox.minY * scale - ((viewH - padding * 2) - dxfH * scale) / 2;
  return { scale, offsetX, offsetY };
}

function tx(x: number, t: Transform): number {
  return x * t.scale + t.offsetX;
}
function ty(y: number, t: Transform): number {
  return -y * t.scale + t.offsetY;
}

// ---------------------------------------------------------------------------
// Entity renderers
// ---------------------------------------------------------------------------

function renderEntity(e: CadEntity, t: Transform, onClick: (e: CadEntity) => void) {
  const click = () => onClick(e);

  switch (e.type) {
    case "LINE":
      return (
        <Line
          key={e.id}
          points={[tx(e.x1!, t), ty(e.y1!, t), tx(e.x2!, t), ty(e.y2!, t)]}
          stroke={e.color}
          strokeWidth={1}
          onClick={click}
          hitStrokeWidth={6}
        />
      );

    case "CIRCLE":
      return (
        <Circle
          key={e.id}
          x={tx(e.cx!, t)}
          y={ty(e.cy!, t)}
          radius={e.radius! * t.scale}
          stroke={e.color}
          strokeWidth={1}
          fill="transparent"
          onClick={click}
          hitStrokeWidth={6}
        />
      );

    case "ARC": {
      // Konva uses clockwise from 3 o'clock; DXF uses counter-clockwise from 3 o'clock
      const startDeg = -e.end_angle!;   // flip because Y is inverted
      const endDeg = -e.start_angle!;
      const angleDeg = endDeg >= startDeg ? endDeg - startDeg : 360 + endDeg - startDeg;
      return (
        <Arc
          key={e.id}
          x={tx(e.cx!, t)}
          y={ty(e.cy!, t)}
          innerRadius={0}
          outerRadius={e.radius! * t.scale}
          angle={angleDeg}
          rotation={startDeg}
          stroke={e.color}
          strokeWidth={1}
          fill="transparent"
          onClick={click}
          hitStrokeWidth={6}
        />
      );
    }

    case "TEXT":
      return (
        <Text
          key={e.id}
          x={tx(e.x!, t)}
          y={ty(e.y!, t)}
          text={e.text ?? ""}
          fontSize={Math.max(2, (e.height ?? 1) * t.scale)}
          fill={e.color}
          rotation={-(e.rotation ?? 0)}
          onClick={click}
        />
      );

    case "POLYLINE": {
      if (!e.points?.length) return null;
      const pts = e.points.flatMap((p) => [tx(p.x, t), ty(p.y, t)]);
      return (
        <Line
          key={e.id}
          points={pts}
          stroke={e.color}
          strokeWidth={1}
          closed={e.closed}
          onClick={click}
          hitStrokeWidth={6}
        />
      );
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Tooltip component
// ---------------------------------------------------------------------------

interface TooltipData {
  entity: CadEntity;
  x: number;
  y: number;
}

const EntityTooltip: React.FC<{ data: TooltipData; onClose: () => void }> = ({ data, onClose }) => {
  const { entity, x, y } = data;
  const rows: Array<[string, string]> = [
    ["Type", entity.type],
    ["Layer", entity.layer],
    ["Color", entity.color],
  ];
  if (entity.block_source) rows.push(["From block", entity.block_source]);
  if (entity.is_attrib) rows.push(["Attribute", "Yes"]);
  if (entity.type === "TEXT" && entity.text) rows.push(["Text", entity.text]);
  if (entity.type === "CIRCLE" || entity.type === "ARC") {
    rows.push(["Radius", (entity.radius ?? 0).toFixed(3)]);
  }

  return (
    <div
      style={{
        position: "absolute",
        left: x + 12,
        top: y - 8,
        background: "#1a1a2e",
        border: "1px solid #3a3a6a",
        borderRadius: 6,
        padding: "8px 10px",
        minWidth: 180,
        maxWidth: 260,
        fontSize: 11,
        color: "#d0d0e8",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        zIndex: 100,
        pointerEvents: "none",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          fontWeight: 700,
          fontSize: 12,
          color: "#a0a8ff",
          marginBottom: 6,
          display: "flex",
          justifyContent: "space-between",
          pointerEvents: "all",
        }}
      >
        <span>{entity.type} Entity</span>
        <span
          style={{ cursor: "pointer", color: "#555577" }}
          onClick={onClose}
        >
          ✕
        </span>
      </div>

      {/* Rows */}
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: "flex", gap: 6, marginBottom: 2 }}>
          <span style={{ color: "#7070aa", minWidth: 70 }}>{label}:</span>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: label === "From block" ? "#a0a8ff" : "#d0d0e8",
              fontWeight: label === "From block" ? 600 : 400,
            }}
            title={value}
          >
            {label === "Color" ? (
              <>
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: value,
                    marginRight: 4,
                    verticalAlign: "middle",
                    border: "1px solid #444",
                  }}
                />
                {value}
              </>
            ) : (
              value
            )}
          </span>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main viewer
// ---------------------------------------------------------------------------

export const CAD2DViewer: React.FC<CAD2DViewerProps> = ({
  entities,
  visibleLayers,
  visibleBlockSources,
  width = 900,
  height = 700,
}) => {
  const stageRef = useRef<Konva.Stage>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);

  // Filter entities by layer and block source visibility
  const visible = useMemo(
    () =>
      entities.filter((e) => {
        if (!visibleLayers.has(e.layer)) return false;
        if (e.block_source && !visibleBlockSources.has(e.block_source)) return false;
        return true;
      }),
    [entities, visibleLayers, visibleBlockSources]
  );

  // Compute fit-to-view transform
  const bbox = useMemo(() => computeBBox(visible.length ? visible : entities), [visible, entities]);
  const transform = useMemo(
    () =>
      bbox ? makeTransform(bbox, width, height) : { scale: 1, offsetX: 0, offsetY: 0 },
    [bbox, width, height]
  );

  const handleEntityClick = useCallback(
    (entity: CadEntity) => {
      const stage = stageRef.current;
      if (!stage) return;
      const ptr = stage.getPointerPosition();
      if (ptr) {
        setTooltip({ entity, x: ptr.x, y: ptr.y });
      }
    },
    []
  );

  // Wheel zoom
  const handleWheel = useCallback((ev: Konva.KonvaEventObject<WheelEvent>) => {
    ev.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = ev.target.getStage()!;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition()!;
    const newScale = ev.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const newPos = {
      x: pointer.x - ((pointer.x - stage.x()) / oldScale) * newScale,
      y: pointer.y - ((pointer.y - stage.y()) / oldScale) * newScale,
    };
    setStageScale(newScale);
    setStagePos(newPos);
  }, []);

  return (
    <div style={{ position: "relative", width, height, background: "#0d0d1a", borderRadius: 6, overflow: "hidden" }}>
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        draggable
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        onWheel={handleWheel}
        onDragEnd={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
        onClick={(ev) => {
          // Click on stage background → close tooltip
          if (ev.target === ev.target.getStage()) setTooltip(null);
        }}
      >
        <Layer>
          <Group>
            {visible.map((e) => renderEntity(e, transform, handleEntityClick))}
          </Group>
        </Layer>
      </Stage>

      {tooltip && (
        <EntityTooltip
          data={tooltip}
          onClose={() => setTooltip(null)}
        />
      )}

      {/* Zoom/pan hint */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          right: 10,
          fontSize: 10,
          color: "#444466",
          pointerEvents: "none",
        }}
      >
        Scroll to zoom · Drag to pan
      </div>

      {/* Entity count badge */}
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 10,
          fontSize: 11,
          color: "#555577",
          background: "#1a1a2e",
          border: "1px solid #2e2e4e",
          borderRadius: 4,
          padding: "2px 8px",
          pointerEvents: "none",
        }}
      >
        {visible.length.toLocaleString()} / {entities.length.toLocaleString()} entities
      </div>
    </div>
  );
};

export default CAD2DViewer;
