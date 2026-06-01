import React from 'react';
import { Group, Line, Arrow, Circle, Rect, Text, Arc, Shape } from 'react-konva';
import {
  distance, angle, formatDim, toPointArray, computeAlignedDim,
} from '../utils/geometry';
import { COLORS } from '../utils/constants';

// ── Master renderer ──────────────────────────────────────────────
export function CanvasAnnotations({
  annotations, selectedId, setSelectedId, updateAnnotation, stageScale, setTextEditing,
}) {
  const ts = 1 / stageScale;
  return (
    <>
      {annotations.map((ann) => (
        <AnnotationItem
          key={ann.id}
          ann={ann}
          isSelected={ann.id === selectedId}
          onSelect={() => setSelectedId(ann.id)}
          onUpdate={(patch) => updateAnnotation(ann.id, patch)}
          ts={ts}
          onTextEdit={(x, y, value) => setTextEditing({ id: ann.id, x, y, value })}
        />
      ))}
    </>
  );
}

function AnnotationItem(props) {
  const map = {
    linear_dim: LinearDim, aligned_dim: AlignedDim, chain_dim: ChainDim,
    angular_dim: AngularDim, radius_dim: RadiusDim, diameter_dim: DiameterDim,
    leader: Leader, section_mark: SectionMark, detail_circle: DetailCircle,
    room_tag: RoomTag, grid_bubble: GridBubble, north_arrow: NorthArrow,
    scale_bar: ScaleBar, level_marker: LevelMarker,
  };
  const Component = map[props.ann.type];
  return Component ? <Component {...props} /> : null;
}

// ── Arrowhead ────────────────────────────────────────────────────
function Arrowhead({ x, y, ang, style = 'arrow', color, ts }) {
  const sz = 9 * ts;
  if (style === 'dot') return <Circle x={x} y={y} radius={3.5 * ts} fill={color} />;
  if (style === 'slash') {
    const a2 = ang + Math.PI / 2;
    return (
      <Line
        points={[x + Math.cos(a2) * sz * 0.6, y + Math.sin(a2) * sz * 0.6,
                 x - Math.cos(a2) * sz * 0.6, y - Math.sin(a2) * sz * 0.6]}
        stroke={color} strokeWidth={1.5 * ts}
      />
    );
  }
  if (style === 'open') {
    return (
      <Line
        points={[x + Math.cos(ang + Math.PI * 5/6) * sz, y + Math.sin(ang + Math.PI * 5/6) * sz,
                 x, y,
                 x + Math.cos(ang - Math.PI * 5/6) * sz, y + Math.sin(ang - Math.PI * 5/6) * sz]}
        stroke={color} strokeWidth={1.5 * ts}
      />
    );
  }
  // filled arrow
  return (
    <Shape
      x={x} y={y} fill={color} stroke={color}
      sceneFunc={(ctx, shape) => {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang + Math.PI * 5/6) * sz, Math.sin(ang + Math.PI * 5/6) * sz);
        ctx.lineTo(Math.cos(ang - Math.PI * 5/6) * sz, Math.sin(ang - Math.PI * 5/6) * sz);
        ctx.closePath();
        ctx.fillStrokeShape(shape);
      }}
    />
  );
}

// ── Dim text with opaque background ─────────────────────────────
function DimText({ x, y, text, ts, color, rotation = 0 }) {
  const fontSize = 10 * ts;
  const charW = fontSize * 0.62;
  const tw = text.length * charW;
  const pad = 2.5 * ts;
  return (
    <Group x={x} y={y} rotation={rotation}>
      <Rect
        x={-tw / 2 - pad} y={-fontSize / 2 - pad}
        width={tw + pad * 2} height={fontSize + pad * 2}
        fill="#0d0d1a" opacity={0.9}
      />
      <Text
        text={text} fontSize={fontSize} fill={color}
        fontFamily="monospace" fontStyle="bold"
        x={-tw / 2} y={-fontSize / 2}
      />
    </Group>
  );
}

// ── LINEAR DIM ───────────────────────────────────────────────────
function LinearDim({ ann, isSelected, onSelect, ts }) {
  const pts = toPointArray(ann.points);
  if (pts.length < 2) return null;
  const p1 = pts[0], p2 = pts[1];
  const sty = ann.style || {};
  const color = sty.dimColor || COLORS.dim;
  const offset = ann.offset || sty.dimOffset || 30;
  const unit = sty.unit || 'mm';
  const prec = sty.precision ?? 0;
  const arrowSty = sty.arrowhead || 'slash';
  const extGap = sty.extGap || 4;
  const extOver = sty.extOverhang || 6;

  const isH = Math.abs(p2.x - p1.x) >= Math.abs(p2.y - p1.y);
  let dl, e1s, e1e, e2s, e2e;
  if (isH) {
    const y = Math.min(p1.y, p2.y) - offset;
    dl = { x1: p1.x, y1: y, x2: p2.x, y2: y };
    e1s = { x: p1.x, y: p1.y - extGap }; e1e = { x: p1.x, y: y - extOver };
    e2s = { x: p2.x, y: p2.y - extGap }; e2e = { x: p2.x, y: y - extOver };
  } else {
    const x = Math.min(p1.x, p2.x) - offset;
    dl = { x1: x, y1: p1.y, x2: x, y2: p2.y };
    e1s = { x: p1.x - extGap, y: p1.y }; e1e = { x: x - extOver, y: p1.y };
    e2s = { x: p2.x - extGap, y: p2.y }; e2e = { x: x - extOver, y: p2.y };
  }

  const dist = isH ? Math.abs(p2.x - p1.x) : Math.abs(p2.y - p1.y);
  const label = formatDim(dist, unit, prec);
  const mx = (dl.x1 + dl.x2) / 2, my = (dl.y1 + dl.y2) / 2;
  const rot = isH ? 0 : -90;
  const ang1 = Math.atan2(dl.y1 - dl.y2, dl.x1 - dl.x2);
  const ang2 = Math.atan2(dl.y2 - dl.y1, dl.x2 - dl.x1);

  return (
    <Group onClick={onSelect} onTap={onSelect}>
      <Line points={[e1s.x, e1s.y, e1e.x, e1e.y]} stroke={color} strokeWidth={0.8 * ts} opacity={0.75} />
      <Line points={[e2s.x, e2s.y, e2e.x, e2e.y]} stroke={color} strokeWidth={0.8 * ts} opacity={0.75} />
      <Line points={[dl.x1, dl.y1, dl.x2, dl.y2]} stroke={color} strokeWidth={ts} />
      <Arrowhead x={dl.x1} y={dl.y1} ang={ang1} style={arrowSty} color={color} ts={ts} />
      <Arrowhead x={dl.x2} y={dl.y2} ang={ang2} style={arrowSty} color={color} ts={ts} />
      <DimText x={mx} y={my} text={label} ts={ts} color={color} rotation={rot} />
      {isSelected && <>
        <Circle x={p1.x} y={p1.y} radius={5 * ts} fill={COLORS.selected} opacity={0.8} />
        <Circle x={p2.x} y={p2.y} radius={5 * ts} fill={COLORS.selected} opacity={0.8} />
      </>}
    </Group>
  );
}

// ── ALIGNED DIM ──────────────────────────────────────────────────
function AlignedDim({ ann, isSelected, onSelect, ts }) {
  const pts = toPointArray(ann.points);
  if (pts.length < 2) return null;
  const p1 = pts[0], p2 = pts[1];
  const sty = ann.style || {};
  const color = sty.dimColor || COLORS.dim;
  const offset = ann.offset || sty.dimOffset || 30;
  const { dimLine, ang, perp, dist } = computeAlignedDim(p1, p2, offset);
  const label = formatDim(dist, sty.unit || 'mm', sty.precision ?? 0);
  const mx = (dimLine.start.x + dimLine.end.x) / 2;
  const my = (dimLine.start.y + dimLine.end.y) / 2;
  const rotDeg = ang * 180 / Math.PI;
  const extOver = 6, extGap = 4;
  const arrowSty = sty.arrowhead || 'slash';

  return (
    <Group onClick={onSelect} onTap={onSelect}>
      <Line points={[p1.x + Math.cos(perp) * extGap, p1.y + Math.sin(perp) * extGap,
                     dimLine.start.x + Math.cos(perp) * extOver, dimLine.start.y + Math.sin(perp) * extOver]}
        stroke={color} strokeWidth={0.8 * ts} opacity={0.75} />
      <Line points={[p2.x + Math.cos(perp) * extGap, p2.y + Math.sin(perp) * extGap,
                     dimLine.end.x + Math.cos(perp) * extOver, dimLine.end.y + Math.sin(perp) * extOver]}
        stroke={color} strokeWidth={0.8 * ts} opacity={0.75} />
      <Line points={[dimLine.start.x, dimLine.start.y, dimLine.end.x, dimLine.end.y]}
        stroke={color} strokeWidth={ts} />
      <Arrowhead x={dimLine.start.x} y={dimLine.start.y}
        ang={Math.atan2(dimLine.start.y - dimLine.end.y, dimLine.start.x - dimLine.end.x)}
        style={arrowSty} color={color} ts={ts} />
      <Arrowhead x={dimLine.end.x} y={dimLine.end.y} ang={ang} style={arrowSty} color={color} ts={ts} />
      <DimText x={mx} y={my} text={label} ts={ts} color={color} rotation={rotDeg} />
    </Group>
  );
}

// ── CHAIN DIM ───────────────────────────────────────────────────
function ChainDim({ ann, isSelected, onSelect, ts }) {
  const pts = toPointArray(ann.points);
  if (pts.length < 2) return null;
  const sty = ann.style || {};
  const color = sty.dimColor || COLORS.dim;
  const offset = ann.offset || sty.dimOffset || 30;
  const unit = sty.unit || 'mm';
  const prec = sty.precision ?? 0;
  const arrowSty = sty.arrowhead || 'slash';
  const yDim = Math.min(...pts.map(p => p.y)) - offset;

  return (
    <Group onClick={onSelect} onTap={onSelect}>
      {pts.map((p, i) => (
        <Line key={`ext-${i}`} points={[p.x, p.y, p.x, yDim - 6 * ts]} stroke={color} strokeWidth={0.8 * ts} opacity={0.75} />
      ))}
      {pts.slice(0, -1).map((p, i) => {
        const p2 = pts[i + 1];
        const mx = (p.x + p2.x) / 2;
        const d = Math.abs(p2.x - p.x);
        return (
          <Group key={`seg-${i}`}>
            <Line points={[p.x, yDim, p2.x, yDim]} stroke={color} strokeWidth={ts} />
            <Arrowhead x={p.x} y={yDim} ang={Math.PI} style={arrowSty} color={color} ts={ts} />
            <Arrowhead x={p2.x} y={yDim} ang={0} style={arrowSty} color={color} ts={ts} />
            <DimText x={mx} y={yDim} text={formatDim(d, unit, prec)} ts={ts} color={color} />
          </Group>
        );
      })}
      {/* Total */}
      {(() => {
        const total = Math.abs(pts[pts.length - 1].x - pts[0].x);
        const mx = (pts[0].x + pts[pts.length - 1].x) / 2;
        return (
          <Group>
            <Line points={[pts[0].x, yDim - 14 * ts, pts[pts.length - 1].x, yDim - 14 * ts]}
              stroke={color} strokeWidth={0.6 * ts} dash={[5 * ts, 3 * ts]} />
            <DimText x={mx} y={yDim - 14 * ts} text={`∑${formatDim(total, unit, prec)}`} ts={ts} color={color} />
          </Group>
        );
      })()}
    </Group>
  );
}

// ── ANGULAR DIM ──────────────────────────────────────────────────
function AngularDim({ ann, isSelected, onSelect, ts }) {
  const pts = toPointArray(ann.points);
  if (pts.length < 2) return null;
  const sty = ann.style || {};
  const color = sty.dimColor || COLORS.dim;
  const center = pts[0], edge = pts[1];
  const r = Math.max(distance(center, edge), 20);
  const a1 = angle(center, edge) * 180 / Math.PI;
  const sweep = 45;
  const midAng = (a1 + sweep / 2) * Math.PI / 180;
  const lx = center.x + Math.cos(midAng) * (r + 14 * ts);
  const ly = center.y + Math.sin(midAng) * (r + 14 * ts);

  return (
    <Group onClick={onSelect} onTap={onSelect}>
      <Arc x={center.x} y={center.y}
        innerRadius={r - 0.5 * ts} outerRadius={r + 0.5 * ts}
        angle={sweep} rotation={a1}
        fill={color} stroke={color} strokeWidth={ts * 1.5} />
      <Line points={[center.x, center.y,
                     center.x + Math.cos(a1 * Math.PI / 180) * r,
                     center.y + Math.sin(a1 * Math.PI / 180) * r]}
        stroke={color} strokeWidth={0.7 * ts} dash={[4 * ts, 3 * ts]} opacity={0.5} />
      <Line points={[center.x, center.y,
                     center.x + Math.cos((a1 + sweep) * Math.PI / 180) * r,
                     center.y + Math.sin((a1 + sweep) * Math.PI / 180) * r]}
        stroke={color} strokeWidth={0.7 * ts} dash={[4 * ts, 3 * ts]} opacity={0.5} />
      <DimText x={lx} y={ly} text={`${sweep.toFixed(1)}°`} ts={ts} color={color} />
    </Group>
  );
}

// ── RADIUS DIM ───────────────────────────────────────────────────
function RadiusDim({ ann, isSelected, onSelect, ts }) {
  const pts = toPointArray(ann.points);
  if (pts.length < 2) return null;
  const sty = ann.style || {};
  const color = sty.dimColor || COLORS.dim;
  const center = pts[0], edge = pts[1];
  const r = distance(center, edge);
  const ang = angle(center, edge);
  const label = `R${formatDim(r, sty.unit || 'mm', sty.precision ?? 0)}`;
  const tx = edge.x + Math.cos(ang) * 16 * ts;
  const ty = edge.y + Math.sin(ang) * 16 * ts;

  return (
    <Group onClick={onSelect} onTap={onSelect}>
      <Circle x={center.x} y={center.y} radius={r}
        stroke={color} strokeWidth={0.7 * ts} dash={[5 * ts, 4 * ts]} fill="transparent" opacity={0.5} />
      <Arrow points={[center.x, center.y, edge.x, edge.y]}
        stroke={color} strokeWidth={ts} fill={color}
        pointerLength={8 * ts} pointerWidth={6 * ts} />
      <DimText x={tx} y={ty} text={label} ts={ts} color={color} />
    </Group>
  );
}

// ── DIAMETER DIM ─────────────────────────────────────────────────
function DiameterDim({ ann, isSelected, onSelect, ts }) {
  const pts = toPointArray(ann.points);
  if (pts.length < 2) return null;
  const sty = ann.style || {};
  const color = sty.dimColor || COLORS.dim;
  const center = pts[0], edge = pts[1];
  const r = distance(center, edge);
  const ang = angle(center, edge);
  const d = r * 2;
  const label = `⌀${formatDim(d, sty.unit || 'mm', sty.precision ?? 0)}`;
  const x1 = center.x - Math.cos(ang) * r;
  const y1 = center.y - Math.sin(ang) * r;
  const perp = ang + Math.PI / 2;
  const tx = center.x + Math.cos(perp) * 18 * ts;
  const ty = center.y + Math.sin(perp) * 18 * ts;

  return (
    <Group onClick={onSelect} onTap={onSelect}>
      <Circle x={center.x} y={center.y} radius={r}
        stroke={color} strokeWidth={0.7 * ts} dash={[5 * ts, 4 * ts]} fill="transparent" opacity={0.5} />
      <Arrow points={[x1, y1, edge.x, edge.y]}
        stroke={color} strokeWidth={ts} fill={color}
        pointerLength={8 * ts} pointerWidth={6 * ts} />
      <DimText x={tx} y={ty} text={label} ts={ts} color={color} />
    </Group>
  );
}

// ── LEADER ───────────────────────────────────────────────────────
function Leader({ ann, isSelected, onSelect, ts, onTextEdit }) {
  const pts = toPointArray(ann.points);
  if (pts.length < 2) return null;
  const sty = ann.style || {};
  const color = sty.annotationColor || COLORS.annotation;
  const p1 = pts[0], p2 = pts[1];
  const text = ann.text || 'Note';
  const fontSize = 10 * ts;
  const lineLen = 55 * ts;

  return (
    <Group onClick={onSelect} onTap={onSelect} onDblClick={() => onTextEdit(p2.x + 4, p2.y - 8, text)}>
      <Arrow points={[p1.x, p1.y, p2.x, p2.y]}
        stroke={color} strokeWidth={ts} fill={color}
        pointerLength={9 * ts} pointerWidth={7 * ts} />
      <Line points={[p2.x, p2.y, p2.x + lineLen, p2.y]}
        stroke={color} strokeWidth={0.8 * ts} />
      <Text x={p2.x + 3 * ts} y={p2.y - fontSize - 2 * ts}
        text={text} fontSize={fontSize} fill={color} fontFamily="monospace" />
      {isSelected && <>
        <Circle x={p1.x} y={p1.y} radius={5 * ts} fill={COLORS.selected} opacity={0.8} />
        <Circle x={p2.x} y={p2.y} radius={5 * ts} fill={COLORS.selected} opacity={0.8} />
      </>}
    </Group>
  );
}

// ── SECTION MARK ─────────────────────────────────────────────────
function SectionMark({ ann, isSelected, onSelect, ts }) {
  const pts = toPointArray(ann.points);
  if (pts.length < 2) return null;
  const sty = ann.style || {};
  const color = sty.annotationColor || COLORS.annotation;
  const p1 = pts[0], p2 = pts[1];
  const text = ann.text || 'A';
  const bR = 13 * ts;

  return (
    <Group onClick={onSelect} onTap={onSelect}>
      <Line points={[p1.x, p1.y, p2.x, p2.y]}
        stroke={color} strokeWidth={1.5 * ts} dash={[8 * ts, 4 * ts, 2 * ts, 4 * ts]} />
      {/* Arrows perpendicular at ends */}
      {[p1, p2].map((p, i) => (
        <Group key={i}>
          <Arrow points={[p.x - 18 * ts, p.y, p.x + 18 * ts, p.y]}
            stroke={color} strokeWidth={ts} fill={color}
            pointerLength={7 * ts} pointerWidth={6 * ts} />
          <Circle x={p.x} y={p.y - bR * 2 - 4 * ts} radius={bR}
            stroke={color} strokeWidth={ts} fill="#0d0d1a" />
          <Line points={[p.x - bR, p.y - bR * 2 - 4 * ts, p.x + bR, p.y - bR * 2 - 4 * ts]}
            stroke={color} strokeWidth={0.5 * ts} />
          <Text x={p.x - bR} y={p.y - bR * 2 - 4 * ts - bR + 1 * ts}
            text={text} width={bR * 2} align="center"
            fontSize={9 * ts} fill={color} fontFamily="monospace" />
          <Text x={p.x - bR} y={p.y - bR * 2 - 4 * ts + 1 * ts}
            text={`${i + 1}`} width={bR * 2} align="center"
            fontSize={9 * ts} fill={color} fontFamily="monospace" />
        </Group>
      ))}
    </Group>
  );
}

// ── DETAIL CIRCLE ────────────────────────────────────────────────
function DetailCircle({ ann, isSelected, onSelect, ts }) {
  const pts = toPointArray(ann.points);
  if (pts.length < 2) return null;
  const sty = ann.style || {};
  const color = sty.annotationColor || COLORS.annotation;
  const center = pts[0], edge = pts[1];
  const r = distance(center, edge);
  const text = ann.text || '1';
  const bR = 15 * ts;
  const ang = angle(center, edge);
  const ex = center.x + Math.cos(ang) * r;
  const ey = center.y + Math.sin(ang) * r;
  const lx = ex + Math.cos(ang) * 28 * ts;
  const ly = ey + Math.sin(ang) * 14 * ts;

  return (
    <Group onClick={onSelect} onTap={onSelect}>
      <Circle x={center.x} y={center.y} radius={r}
        stroke={color} strokeWidth={1.5 * ts} dash={[5 * ts, 3 * ts]} fill="transparent" />
      <Line points={[ex, ey, lx, ly]} stroke={color} strokeWidth={ts} />
      <Circle x={lx + bR} y={ly} radius={bR}
        stroke={color} strokeWidth={ts} fill="#0d0d1a" />
      <Line points={[lx, ly, lx + bR * 2, ly]}
        stroke={color} strokeWidth={0.5 * ts} />
      <Text x={lx} y={ly - bR + 1 * ts}
        text={text} width={bR * 2} align="center"
        fontSize={10 * ts} fill={color} fontFamily="monospace" />
      <Text x={lx} y={ly + 1 * ts}
        text="1/50" width={bR * 2} align="center"
        fontSize={8 * ts} fill={color} fontFamily="monospace" opacity={0.8} />
    </Group>
  );
}

// ── ROOM TAG ─────────────────────────────────────────────────────
function RoomTag({ ann, isSelected, onSelect, onTextEdit, ts }) {
  const pts = toPointArray(ann.points);
  if (pts.length < 1) return null;
  const sty = ann.style || {};
  const color = sty.annotationColor || COLORS.accent;
  const p = pts[0];
  const text = ann.text || 'ROOM';
  const area = ann.area || 0;
  const halfW = 55 * ts;

  return (
    <Group onClick={onSelect} onTap={onSelect}
      onDblClick={() => onTextEdit(p.x - halfW, p.y - 8, text)}
      draggable
      onDragEnd={(e) => {
        const np = e.target.getAbsolutePosition();
      }}>
      <Text x={p.x - halfW} y={p.y - 13 * ts}
        text={text} width={halfW * 2}
        fontSize={13 * ts} fill={color}
        fontFamily="monospace" fontStyle="bold" align="center" />
      {area > 0 && (
        <Text x={p.x - halfW} y={p.y + 3 * ts}
          text={`${area.toFixed(2)} m²`} width={halfW * 2}
          fontSize={9 * ts} fill={color}
          fontFamily="monospace" align="center" opacity={0.7} />
      )}
      {isSelected && (
        <Rect x={p.x - halfW - 4 * ts} y={p.y - 18 * ts}
          width={halfW * 2 + 8 * ts} height={area > 0 ? 28 * ts : 18 * ts}
          stroke={COLORS.selected} strokeWidth={ts} fill="transparent"
          dash={[3 * ts, 2 * ts]} />
      )}
    </Group>
  );
}

// ── GRID BUBBLE ──────────────────────────────────────────────────
function GridBubble({ ann, isSelected, onSelect, ts }) {
  const pts = toPointArray(ann.points);
  if (pts.length < 1) return null;
  const sty = ann.style || {};
  const color = sty.gridColor || sty.dimColor || COLORS.grid;
  const p = pts[0];
  const text = ann.text || 'A';
  const r = 14 * ts;

  return (
    <Group onClick={onSelect} onTap={onSelect}>
      <Line points={[p.x, p.y + r, p.x, p.y + 400]}
        stroke={color} strokeWidth={0.5 * ts} dash={[8 * ts, 4 * ts]} opacity={0.45} />
      <Circle x={p.x} y={p.y} radius={r}
        stroke={color} strokeWidth={ts} fill="#0d0d1a" />
      <Text x={p.x - r} y={p.y - 6 * ts}
        text={text} width={r * 2}
        fontSize={11 * ts} fill={color}
        fontFamily="monospace" fontStyle="bold" align="center" />
      {isSelected && (
        <Circle x={p.x} y={p.y} radius={r + 4 * ts}
          stroke={COLORS.selected} strokeWidth={ts}
          dash={[3 * ts, 2 * ts]} fill="transparent" />
      )}
    </Group>
  );
}

// ── NORTH ARROW ──────────────────────────────────────────────────
function NorthArrow({ ann, isSelected, onSelect, ts }) {
  const pts = toPointArray(ann.points);
  if (pts.length < 1) return null;
  const sty = ann.style || {};
  const color = sty.annotationColor || COLORS.accent;
  const p = pts[0];
  const r = 24 * ts;
  const rotation = ann.rotation || 0;

  return (
    <Group x={p.x} y={p.y} rotation={rotation} onClick={onSelect} onTap={onSelect}>
      <Circle radius={r} stroke={color} strokeWidth={ts} fill="transparent" opacity={0.45} />
      {/* Cross hairs */}
      <Line points={[-r, 0, r, 0]} stroke={color} strokeWidth={0.5 * ts} opacity={0.3} />
      <Line points={[0, -r, 0, r]} stroke={color} strokeWidth={0.5 * ts} opacity={0.3} />
      {/* North half filled */}
      <Shape
        fill={color} stroke={color}
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          ctx.moveTo(0, -(r - 3 * ts));
          ctx.lineTo(5 * ts, 4 * ts);
          ctx.lineTo(0, 0);
          ctx.closePath();
          ctx.fillStrokeShape(shape);
        }}
      />
      {/* South half outline */}
      <Shape
        fill="transparent" stroke={color} strokeWidth={ts}
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          ctx.moveTo(0, r - 3 * ts);
          ctx.lineTo(-5 * ts, -4 * ts);
          ctx.lineTo(0, 0);
          ctx.closePath();
          ctx.fillStrokeShape(shape);
        }}
      />
      <Text x={-6 * ts} y={-(r + 14 * ts)}
        text="N" fontSize={11 * ts}
        fill={color} fontFamily="monospace" fontStyle="bold" />
      {isSelected && (
        <Circle radius={r + 5 * ts}
          stroke={COLORS.selected} strokeWidth={ts}
          dash={[3 * ts, 2 * ts]} fill="transparent" />
      )}
    </Group>
  );
}

// ── SCALE BAR ────────────────────────────────────────────────────
function ScaleBar({ ann, isSelected, onSelect, ts }) {
  const pts = toPointArray(ann.points);
  if (pts.length < 1) return null;
  const sty = ann.style || {};
  const color = sty.annotationColor || COLORS.dim;
  const p = pts[0];
  const barW = 120 * ts;
  const barH = 6 * ts;
  const segs = 5;
  const segW = barW / segs;

  return (
    <Group x={p.x} y={p.y} onClick={onSelect} onTap={onSelect}>
      <Text x={barW / 2 - 18 * ts} y={-12 * ts}
        text="1 : 100" fontSize={8 * ts} fill={color} fontFamily="monospace" />
      {Array.from({ length: segs }, (_, i) => (
        <Rect key={i} x={i * segW} y={0}
          width={segW} height={barH}
          fill={i % 2 === 0 ? color : '#0d0d1a'}
          stroke={color} strokeWidth={0.5 * ts} />
      ))}
      <Text x={-3 * ts} y={barH + 2 * ts} text="0" fontSize={8 * ts} fill={color} fontFamily="monospace" />
      <Text x={barW - 14 * ts} y={barH + 2 * ts} text={`${segs * 10}m`} fontSize={8 * ts} fill={color} fontFamily="monospace" />
      {isSelected && (
        <Rect x={-4 * ts} y={-16 * ts}
          width={barW + 8 * ts} height={barH + 22 * ts}
          stroke={COLORS.selected} strokeWidth={ts}
          dash={[3 * ts, 2 * ts]} fill="transparent" />
      )}
    </Group>
  );
}

// ── LEVEL MARKER ─────────────────────────────────────────────────
function LevelMarker({ ann, isSelected, onSelect, onTextEdit, ts }) {
  const pts = toPointArray(ann.points);
  if (pts.length < 1) return null;
  const sty = ann.style || {};
  const color = sty.dimColor || COLORS.dim;
  const p = pts[0];
  const text = ann.text || '±0.000';
  const sz = 10 * ts;
  const lineW = (text.length * 7 + 20) * ts;

  return (
    <Group onClick={onSelect} onTap={onSelect}
      onDblClick={() => onTextEdit(p.x + sz * 1.5, p.y - sz - 8, text)}>
      <Shape
        x={p.x} y={p.y} fill={color} stroke={color}
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-sz, -sz);
          ctx.lineTo(sz, -sz);
          ctx.closePath();
          ctx.fillStrokeShape(shape);
        }}
      />
      <Line points={[p.x - sz * 2, p.y - sz, p.x + lineW, p.y - sz]}
        stroke={color} strokeWidth={0.5 * ts} />
      <Text x={p.x + sz * 1.2} y={p.y - sz - 10 * ts}
        text={text} fontSize={10 * ts}
        fill={color} fontFamily="monospace" />
      {isSelected && (
        <Circle x={p.x} y={p.y} radius={6 * ts}
          stroke={COLORS.selected} strokeWidth={ts}
          dash={[3 * ts, 2 * ts]} fill="transparent" />
      )}
    </Group>
  );
}
