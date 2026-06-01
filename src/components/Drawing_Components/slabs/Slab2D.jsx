// Slab2D.jsx — React Konva 2D plan & section view
// Install: npm install react-konva konva

import React, { useRef, useEffect, useCallback } from 'react';
import {
  Stage, Layer, Line, Rect, Circle, Text, Group,
  Arrow, Arc, Ellipse, Path,
} from 'react-konva';
import { SLAB_TYPES } from './slabTypes';
import { useSlabStore } from './slabStore';

// ─── helpers ────────────────────────────────────────────────────────────────

const SCALE = 0.055; // px per mm at zoom=1
const GRID_COLOR = '#2D3050';
const COLUMN_COLOR = '#4F6EF7';

function worldToKonva(wx, wy, stageW, stageH, zoom, pan) {
  return {
    x: stageW / 2 + (wx - 3600) * SCALE * zoom + pan.x,
    y: stageH / 2 + (wy - 3000) * SCALE * zoom + pan.y,
  };
}

function flattenFootprint(footprint, stageW, stageH, zoom, pan) {
  return footprint.flatMap(p => {
    const s = worldToKonva(p.x, p.y, stageW, stageH, zoom, pan);
    return [s.x, s.y];
  });
}

function getBBox(footprint) {
  const xs = footprint.map(p => p.x);
  const ys = footprint.map(p => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

// ─── Column grid ─────────────────────────────────────────────────────────────

function ColumnGrid({ spanX, spanY, stageW, stageH, zoom, pan }) {
  const cols = ['A','B','C','D','E'];
  const rows = ['1','2','3','4','5'];
  const stepX = spanX / (cols.length - 1);
  const stepY = spanY / (rows.length - 1);

  return (
    <Group>
      {/* Grid lines */}
      {cols.map((c, ci) => {
        const s1 = worldToKonva(ci * stepX, -1200, stageW, stageH, zoom, pan);
        const s2 = worldToKonva(ci * stepX, spanY + 1200, stageW, stageH, zoom, pan);
        const bubble = worldToKonva(ci * stepX, -900, stageW, stageH, zoom, pan);
        return (
          <Group key={`col-${c}`}>
            <Line points={[s1.x, s1.y, s2.x, s2.y]} stroke={COLUMN_COLOR} strokeWidth={0.5}
              opacity={0.3} dash={[6, 4]} />
            <Circle x={bubble.x} y={bubble.y} radius={11} fill="rgba(79,110,247,0.12)"
              stroke={COLUMN_COLOR} strokeWidth={0.8} opacity={0.7} />
            <Text x={bubble.x - 5} y={bubble.y - 5} text={c} fontSize={10}
              fill="#7B93FF" fontFamily="monospace" />
          </Group>
        );
      })}
      {rows.map((r, ri) => {
        const s1 = worldToKonva(-1200, ri * stepY, stageW, stageH, zoom, pan);
        const s2 = worldToKonva(spanX + 1200, ri * stepY, stageW, stageH, zoom, pan);
        const bubble = worldToKonva(-900, ri * stepY, stageW, stageH, zoom, pan);
        return (
          <Group key={`row-${r}`}>
            <Line points={[s1.x, s1.y, s2.x, s2.y]} stroke={COLUMN_COLOR} strokeWidth={0.5}
              opacity={0.3} dash={[6, 4]} />
            <Circle x={bubble.x} y={bubble.y} radius={11} fill="rgba(79,110,247,0.12)"
              stroke={COLUMN_COLOR} strokeWidth={0.8} opacity={0.7} />
            <Text x={bubble.x - 5} y={bubble.y - 5} text={r} fontSize={10}
              fill="#7B93FF" fontFamily="monospace" />
          </Group>
        );
      })}
      {/* Column squares */}
      {cols.map((c, ci) => rows.map((r, ri) => {
        const s = worldToKonva(ci * stepX, ri * stepY, stageW, stageH, zoom, pan);
        const sz = 12 * zoom;
        return (
          <Rect key={`col-sq-${c}${r}`} x={s.x - sz/2} y={s.y - sz/2}
            width={sz} height={sz} fill="rgba(79,110,247,0.6)"
            stroke="#7B93FF" strokeWidth={0.8} />
        );
      }))}
    </Group>
  );
}

// ─── Slab pattern overlays ────────────────────────────────────────────────────

function SlabPattern({ slab, bbox, stageW, stageH, zoom, pan, col }) {
  const type = slab.type;
  const rs = slab.ribSpacing || 750;
  const rw = slab.ribWidth || 150;
  const cs = slab.cofferSize || 600;
  const sc = zoom * SCALE;

  if (type === 'ribbed') {
    const lines = [];
    for (let x = bbox.minX + rs; x < bbox.maxX; x += rs) {
      const s1 = worldToKonva(x, bbox.minY, stageW, stageH, zoom, pan);
      const s2 = worldToKonva(x, bbox.maxY, stageW, stageH, zoom, pan);
      lines.push(<Line key={`rib-${x}`} points={[s1.x, s1.y, s2.x, s2.y]}
        stroke={col} strokeWidth={0.8} opacity={0.6} dash={[6, 3]} />);
    }
    const cx = worldToKonva((bbox.minX + bbox.maxX) / 2, (bbox.minY + bbox.maxY) / 2, stageW, stageH, zoom, pan);
    return (
      <Group>
        {lines}
        <Text x={cx.x - 80} y={cx.y - 10} text={`${rw} RIBS @ ${rs} C/C`}
          fontSize={10} fill={col} fontFamily="monospace" fontStyle="bold" />
      </Group>
    );
  }

  if (type === 'waffle') {
    const xLines = [], yLines = [], coffers = [];
    for (let x = bbox.minX + cs; x < bbox.maxX; x += cs) {
      const s1 = worldToKonva(x, bbox.minY, stageW, stageH, zoom, pan);
      const s2 = worldToKonva(x, bbox.maxY, stageW, stageH, zoom, pan);
      xLines.push(<Line key={`wx-${x}`} points={[s1.x, s1.y, s2.x, s2.y]}
        stroke={col} strokeWidth={0.7} opacity={0.55} dash={[5, 3]} />);
    }
    for (let y = bbox.minY + cs; y < bbox.maxY; y += cs) {
      const s1 = worldToKonva(bbox.minX, y, stageW, stageH, zoom, pan);
      const s2 = worldToKonva(bbox.maxX, y, stageW, stageH, zoom, pan);
      yLines.push(<Line key={`wy-${y}`} points={[s1.x, s1.y, s2.x, s2.y]}
        stroke={col} strokeWidth={0.7} opacity={0.55} dash={[5, 3]} />);
    }
    for (let x = bbox.minX; x < bbox.maxX - cs + rw; x += cs) {
      for (let y = bbox.minY; y < bbox.maxY - cs + rw; y += cs) {
        const sa = worldToKonva(x + rw / 2, y + rw / 2, stageW, stageH, zoom, pan);
        const sb = worldToKonva(x + cs - rw / 2, y + cs - rw / 2, stageW, stageH, zoom, pan);
        coffers.push(
          <Rect key={`coffer-${x}-${y}`} x={sa.x} y={sa.y}
            width={sb.x - sa.x} height={sb.y - sa.y}
            fill="#111320" stroke={col} strokeWidth={0.4} opacity={0.9} />
        );
      }
    }
    return <Group>{xLines}{yLines}{coffers}</Group>;
  }

  if (type === 'pt') {
    const tendons = [];
    // Banded tendons in X
    for (let x = bbox.minX + 800; x < bbox.maxX; x += 800) {
      const s1 = worldToKonva(x, bbox.minY + 200, stageW, stageH, zoom, pan);
      const sm = worldToKonva(x, (bbox.minY + bbox.maxY) / 2 + 300, stageW, stageH, zoom, pan);
      const s2 = worldToKonva(x, bbox.maxY - 200, stageW, stageH, zoom, pan);
      tendons.push(<Path key={`ptx-${x}`}
        data={`M ${s1.x} ${s1.y} Q ${sm.x} ${sm.y} ${s2.x} ${s2.y}`}
        stroke="#F39C12" strokeWidth={1.2} fill="transparent" opacity={0.75} />);
    }
    // Cross tendons in Y
    for (let y = bbox.minY + 800; y < bbox.maxY; y += 800) {
      const s1 = worldToKonva(bbox.minX + 200, y, stageW, stageH, zoom, pan);
      const sm = worldToKonva((bbox.minX + bbox.maxX) / 2 + 300, y, stageW, stageH, zoom, pan);
      const s2 = worldToKonva(bbox.maxX - 200, y, stageW, stageH, zoom, pan);
      tendons.push(<Path key={`pty-${y}`}
        data={`M ${s1.x} ${s1.y} Q ${sm.x} ${sm.y} ${s2.x} ${s2.y}`}
        stroke="#F39C12" strokeWidth={0.8} fill="transparent" opacity={0.5} />);
    }
    return <Group>{tendons}</Group>;
  }

  if (type === 'hollow') {
    const voids = [];
    const midY = (bbox.minY + bbox.maxY) / 2;
    const sc1 = worldToKonva(bbox.minX, midY, stageW, stageH, zoom, pan);
    const se1 = worldToKonva(bbox.maxX, midY, stageW, stageH, zoom, pan);
    for (let px = sc1.x + 18; px < se1.x - 12; px += 18) {
      voids.push(<Ellipse key={`void-${px}`} x={px} y={sc1.y}
        radiusX={6} radiusY={9} fill="#111320" stroke={col} strokeWidth={0.4} opacity={0.85} />);
    }
    return <Group>{voids}</Group>;
  }

  if (type === 'composite') {
    const midY = (bbox.minY + bbox.maxY) / 2;
    const s1 = worldToKonva(bbox.minX, midY, stageW, stageH, zoom, pan);
    const s2 = worldToKonva(bbox.maxX, midY, stageW, stageH, zoom, pan);
    const deckShapes = [];
    let px = s1.x;
    while (px < s2.x) {
      deckShapes.push(
        <Path key={`deck-${px}`}
          data={`M ${px} ${s1.y} L ${px+5} ${s1.y+6} L ${px+11} ${s1.y+6} L ${px+16} ${s1.y}`}
          stroke="#9B59B6" strokeWidth={1} fill="transparent" opacity={0.7} />
      );
      px += 16;
    }
    return <Group>{deckShapes}</Group>;
  }

  return null;
}

// ─── Openings ─────────────────────────────────────────────────────────────────

function OpeningShape({ opening, stageW, stageH, zoom, pan }) {
  const s = worldToKonva(opening.x, opening.y, stageW, stageH, zoom, pan);
  const sw = opening.width * SCALE * zoom;
  const sh = opening.height * SCALE * zoom;
  const hatchLines = [];
  for (let i = -sh; i < sw + sh; i += 8) {
    hatchLines.push(
      <Line key={`h-${i}`} points={[s.x + i, s.y - sh/2, s.x + i + sh, s.y + sh/2]}
        stroke="#E74C3C" strokeWidth={0.7} opacity={0.4}
        clip={{ x: s.x, y: s.y - sh/2, width: sw, height: sh }} />
    );
  }
  return (
    <Group>
      {hatchLines}
      <Rect x={s.x} y={s.y - sh/2} width={sw} height={sh}
        fill="rgba(231,76,60,0.06)" stroke="#E74C3C" strokeWidth={1} />
      <Text x={s.x + sw/2 - 35} y={s.y + sh/2 + 4} fontSize={9}
        text={`OPEN ${opening.width}×${opening.height}`} fill="#E74C3C" fontFamily="monospace" />
    </Group>
  );
}

// ─── Annotations ──────────────────────────────────────────────────────────────

function SlabAnnotations({ slab, bbox, stageW, stageH, zoom, pan, col }) {
  const midX = (bbox.minX + bbox.maxX) / 2;
  const midY = (bbox.minY + bbox.maxY) / 2;

  // Span arrow endpoints
  const arrowStart = worldToKonva(bbox.minX + 200, midY, stageW, stageH, zoom, pan);
  const arrowEnd   = worldToKonva(bbox.maxX - 200, midY, stageW, stageH, zoom, pan);

  // Callout bubble
  const callout = worldToKonva(midX, bbox.minY - 700, stageW, stageH, zoom, pan);

  // Dim line
  const dl1 = worldToKonva(bbox.minX, bbox.maxY + 450, stageW, stageH, zoom, pan);
  const dl2 = worldToKonva(bbox.maxX, bbox.maxY + 450, stageW, stageH, zoom, pan);
  const dimLabelY = dl1.y + 14;

  // FFL label
  const fflPos = worldToKonva(bbox.maxX + 350, midY, stageW, stageH, zoom, pan);

  // Rebar note
  const rebarPos = worldToKonva(midX, bbox.maxY + 900, stageW, stageH, zoom, pan);

  const t = SLAB_TYPES.find(s => s.id === slab.type);

  return (
    <Group>
      {/* Span direction arrow */}
      <Arrow points={[arrowStart.x, arrowStart.y, arrowEnd.x, arrowEnd.y]}
        stroke={col} strokeWidth={1.2} fill={col} pointerLength={7} pointerWidth={5} opacity={0.8} />
      <Text x={(arrowStart.x + arrowEnd.x)/2 - 50} y={arrowStart.y - 14}
        text="SPAN DIRECTION" fontSize={9} fill={col} opacity={0.7} fontFamily="monospace" />

      {/* Thickness callout bubble */}
      <Rect x={callout.x - 78} y={callout.y - 10} width={156} height={20} cornerRadius={4}
        fill="rgba(79,110,247,0.12)" stroke="#4F6EF7" strokeWidth={0.8} />
      <Text x={callout.x - 72} y={callout.y - 4}
        text={`${slab.thickness} THK ${t?.mat || 'RC'} SLAB`}
        fontSize={10} fill="#C4CEFF" fontFamily="monospace" fontStyle="bold" />

      {/* Dimension line */}
      <Line points={[dl1.x, dl1.y, dl2.x, dl2.y]} stroke={col} strokeWidth={0.7} opacity={0.5} />
      <Line points={[dl1.x, worldToKonva(bbox.minX, bbox.maxY, stageW, stageH, zoom, pan).y, dl1.x, dl1.y]}
        stroke={col} strokeWidth={0.5} opacity={0.4} dash={[3,2]} />
      <Line points={[dl2.x, worldToKonva(bbox.maxX, bbox.maxY, stageW, stageH, zoom, pan).y, dl2.x, dl2.y]}
        stroke={col} strokeWidth={0.5} opacity={0.4} dash={[3,2]} />
      <Text x={(dl1.x + dl2.x)/2 - 20} y={dimLabelY}
        text={`${Math.round(bbox.maxX - bbox.minX)}`}
        fontSize={10} fill={col} fontFamily="monospace" fontStyle="bold" />

      {/* FFL label */}
      <Text x={fflPos.x} y={fflPos.y - 5}
        text={`FFL +${slab.level}mm`}
        fontSize={9} fill={`${col}CC`} fontFamily="monospace" />

      {/* Rebar note */}
      <Text x={rebarPos.x - 120} y={rebarPos.y}
        text={t?.rebarNote || 'SEE STRUCTURAL DWGS'}
        fontSize={9} fill="#9AA3C8" fontFamily="monospace" />
    </Group>
  );
}

// ─── Drop panels ──────────────────────────────────────────────────────────────

function DropPanel({ drop, stageW, stageH, zoom, pan, col }) {
  const s = worldToKonva(drop.x, drop.y, stageW, stageH, zoom, pan);
  const r = (drop.size / 2) * SCALE * zoom;
  return (
    <Group>
      <Circle x={s.x} y={s.y} radius={r}
        fill={`${col}18`} stroke={col} strokeWidth={1.2} dash={[4, 2]} />
    </Group>
  );
}

// ─── Single slab (plan view) ──────────────────────────────────────────────────

function SlabPlan({ slab, stageW, stageH, zoom, pan, isSelected }) {
  const t = SLAB_TYPES.find(s => s.id === slab.type) || SLAB_TYPES[0];
  const col = t.color;
  const pts = flattenFootprint(slab.footprint, stageW, stageH, zoom, pan);
  const bbox = getBBox(slab.footprint);
  const { showAnnotations } = useSlabStore();

  return (
    <Group>
      {/* Slab fill + border */}
      <Line points={pts} closed fill={`${col}${isSelected ? '2E' : '1A'}`}
        stroke={col} strokeWidth={isSelected ? 2 : 1.2} />

      {/* Pattern overlay */}
      <SlabPattern slab={slab} bbox={bbox} stageW={stageW} stageH={stageH}
        zoom={zoom} pan={pan} col={col} />

      {/* Drops */}
      {(slab.drops || []).map((d, i) => (
        <DropPanel key={i} drop={d} stageW={stageW} stageH={stageH} zoom={zoom} pan={pan} col={col} />
      ))}

      {/* Openings */}
      {(slab.openings || []).map((o, i) => (
        <OpeningShape key={i} opening={o} stageW={stageW} stageH={stageH} zoom={zoom} pan={pan} />
      ))}

      {/* Annotations */}
      {showAnnotations && (
        <SlabAnnotations slab={slab} bbox={bbox} stageW={stageW} stageH={stageH}
          zoom={zoom} pan={pan} col={col} />
      )}
    </Group>
  );
}

// ─── Main Slab2D component ────────────────────────────────────────────────────

/**
 * <Slab2D
 *   type="ribbed"
 *   footprint={[{x,y}, ...]}
 *   thickness={250}
 *   ribSpacing={750}
 *   ribWidth={150}
 *   dropDimension={2000}
 *   openings={[{x,y,width,height},...]}
 *   scale={50}
 *   width={800}
 *   height={600}
 * />
 *
 * OR use without props to connect to slabStore automatically.
 */
export function Slab2D({
  type, footprint, thickness, ribSpacing, ribWidth,
  dropDimension, openings, scale = 50,
  width = 800, height = 600,
}) {
  const store = useSlabStore();
  const {
    slabs, selectedSlabId, spanX, spanY, zoom, pan,
    showGrid, showAnnotations, tool, drawingPoints,
    addDrawingPoint, finalizePolygon, clearDrawingPoints,
    selectSlab,
  } = store;

  // If props passed directly, build a one-off slab
  const standaloneMode = !!footprint;
  const displaySlabs = standaloneMode
    ? [{ id: 'standalone', type, footprint, thickness, ribSpacing, ribWidth,
         level: 0, drops: [], openings: openings || [] }]
    : slabs;

  const stageRef = useRef(null);

  const handleClick = useCallback((e) => {
    if (tool !== 'polygon' && tool !== 'opening') return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    // Invert worldToKonva
    const wx = (pos.x - width/2 - pan.x) / (SCALE * zoom) + 3600;
    const wy = (pos.y - height/2 - pan.y) / (SCALE * zoom) + 3000;
    addDrawingPoint({ x: wx, y: wy });
  }, [tool, zoom, pan, width, height, addDrawingPoint]);

  const handleDblClick = useCallback(() => {
    if (drawingPoints.length >= 3) finalizePolygon();
    else clearDrawingPoints();
  }, [drawingPoints, finalizePolygon, clearDrawingPoints]);

  // Drawing preview polyline
  const previewPts = drawingPoints.flatMap(p => {
    const s = worldToKonva(p.x, p.y, width, height, zoom, pan);
    return [s.x, s.y];
  });

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      style={{ background: '#0D0F1A', borderRadius: 8 }}
      onClick={handleClick}
      onDblClick={handleDblClick}
    >
      <Layer>
        {/* Grid */}
        {showGrid && !standaloneMode && (
          <GridLayer stageW={width} stageH={height} zoom={zoom} pan={pan} />
        )}

        {/* Column grid */}
        {!standaloneMode && (
          <ColumnGrid spanX={spanX} spanY={spanY}
            stageW={width} stageH={height} zoom={zoom} pan={pan} />
        )}

        {/* Slabs */}
        {displaySlabs.map(slab => (
          <SlabPlan
            key={slab.id}
            slab={slab}
            stageW={width}
            stageH={height}
            zoom={zoom}
            pan={pan}
            isSelected={slab.id === selectedSlabId}
          />
        ))}

        {/* Drawing preview */}
        {drawingPoints.length > 0 && (
          <Group>
            <Line points={previewPts} stroke="#4F6EF7" strokeWidth={1.5} dash={[4, 3]} />
            {drawingPoints.map((p, i) => {
              const s = worldToKonva(p.x, p.y, width, height, zoom, pan);
              return <Circle key={i} x={s.x} y={s.y} radius={3} fill="#4F6EF7" />;
            })}
          </Group>
        )}
      </Layer>
    </Stage>
  );
}

// ─── Grid layer ───────────────────────────────────────────────────────────────

function GridLayer({ stageW, stageH, zoom, pan }) {
  const minorLines = [];
  const majorLines = [];
  const gridMM = 600;
  for (let x = -12000; x < 24000; x += gridMM) {
    const s1 = worldToKonva(x, -12000, stageW, stageH, zoom, pan);
    const s2 = worldToKonva(x, 24000, stageW, stageH, zoom, pan);
    minorLines.push(<Line key={`gx-${x}`} points={[s1.x, s1.y, s2.x, s2.y]}
      stroke={GRID_COLOR} strokeWidth={0.4} opacity={0.6} />);
  }
  for (let y = -12000; y < 24000; y += gridMM) {
    const s1 = worldToKonva(-12000, y, stageW, stageH, zoom, pan);
    const s2 = worldToKonva(24000, y, stageW, stageH, zoom, pan);
    minorLines.push(<Line key={`gy-${y}`} points={[s1.x, s1.y, s2.x, s2.y]}
      stroke={GRID_COLOR} strokeWidth={0.4} opacity={0.6} />);
  }
  for (let x = -12000; x < 24000; x += 3600) {
    const s1 = worldToKonva(x, -12000, stageW, stageH, zoom, pan);
    const s2 = worldToKonva(x, 24000, stageW, stageH, zoom, pan);
    majorLines.push(<Line key={`mgx-${x}`} points={[s1.x, s1.y, s2.x, s2.y]}
      stroke="#3D4270" strokeWidth={0.5} opacity={0.5} />);
  }
  return <Group>{minorLines}{majorLines}</Group>;
}

export default Slab2D;
