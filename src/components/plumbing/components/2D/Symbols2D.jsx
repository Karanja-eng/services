import React from 'react';
import { Group, Line, Rect, Circle, Arc, Text, Shape } from 'react-konva';
import { COLORS } from '../../utils/constants';

// Stroke styles per pipe system
const PIPE_STYLES = {
  CWS:    { stroke: '#0000CC', strokeWidth: 1.5, dash: [] },
  HWS:    { stroke: '#CC0000', strokeWidth: 1.5, dash: [] },
  HWR:    { stroke: '#CC0000', strokeWidth: 1.5, dash: [15, 5] },
  SVP:    { stroke: '#1A1A1A', strokeWidth: 2,   dash: [] },
  WASTE:  { stroke: '#808080', strokeWidth: 1,   dash: [] },
  OVERFLOW: { stroke: '#FFA500', strokeWidth: 1.5, dash: [20, 8] },
  RWP:    { stroke: '#008000', strokeWidth: 1,   dash: [] },
  GREY:   { stroke: '#800080', strokeWidth: 1.5, dash: [10, 5, 2, 5] },
  GAS:    { stroke: '#CCCC00', strokeWidth: 1.5, dash: [10, 5] }
};

// ─── WC ───────────────────────────────────────────────────
function WCSymbol({ x, y, rotation, type }) {
  const isConcealedCistern = type && (type.includes('Wall-hung') || type.includes('Back-to-wall'));
  return (
    <Group x={x} y={y} rotation={rotation}>
      {/* Pan (elongated D shape) */}
      <Shape
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          ctx.ellipse(0, 15, 18, 28, 0, 0, Math.PI * 2);
          ctx.closePath();
          ctx.fillStrokeShape(shape);
        }}
        fill="white" stroke="black" strokeWidth={1}
      />
      {/* Cistern */}
      {isConcealedCistern ? (
        <Rect x={-18} y={-40} width={36} height={18} stroke="black" strokeWidth={1} dash={[4,2]} />
      ) : (
        <Rect x={-18} y={-40} width={36} height={18} fill="white" stroke="black" strokeWidth={1} />
      )}
    </Group>
  );
}

// ─── Basin ────────────────────────────────────────────────
function BasinSymbol({ x, y, rotation, type }) {
  const w = type && type.includes('Compact') ? 30 : 45;
  const h = type && type.includes('Compact') ? 22 : 38;
  return (
    <Group x={x} y={y} rotation={rotation}>
      <Shape
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          ctx.roundRect(-w/2, -h/2, w, h, 8);
          ctx.closePath();
          ctx.fillStrokeShape(shape);
        }}
        fill="white" stroke="black" strokeWidth={1}
      />
      {/* Tap circle */}
      <Circle x={0} y={h/2 - 5} radius={3} fill="black" />
      {/* Overflow arc */}
      <Arc x={0} y={-h/2 + 8} innerRadius={6} outerRadius={7} angle={120} rotation={-60} stroke="black" strokeWidth={0.8} />
    </Group>
  );
}

// ─── Bath ─────────────────────────────────────────────────
function BathSymbol({ x, y, rotation, type }) {
  return (
    <Group x={x} y={y} rotation={rotation}>
      <Rect x={-35} y={-75} width={70} height={150} cornerRadius={4} fill="white" stroke="black" strokeWidth={1} />
      <Rect x={-29} y={-69} width={58} height={138} cornerRadius={2} stroke="black" strokeWidth={0.6} />
      {/* Taps */}
      <Circle x={-20} y={-65} radius={3} fill="black" />
      <Circle x={20} y={-65} radius={3} fill="black" />
      {/* Overflow */}
      <Circle x={0} y={-65} radius={4} stroke="black" strokeWidth={0.8} />
    </Group>
  );
}

// ─── Shower ───────────────────────────────────────────────
function ShowerSymbol({ x, y, rotation }) {
  return (
    <Group x={x} y={y} rotation={rotation}>
      <Rect x={-40} y={-40} width={80} height={80} fill="white" stroke="black" strokeWidth={1} dash={[6,3]} />
      {/* Drain */}
      <Circle x={0} y={0} radius={5} stroke="black" strokeWidth={1} />
      <Line points={[-5,0,5,0]} stroke="black" strokeWidth={1} />
      <Line points={[0,-5,0,5]} stroke="black" strokeWidth={1} />
    </Group>
  );
}

// ─── Vessel / Tank ────────────────────────────────────────
function VesselSymbol({ x, y, type, config = {} }) {
  const isCylinder = type && type.includes('Cylinder');
  const label = isCylinder ? 'HWC' : 'W/T';
  const capacity = config?.capacity ? `${config.capacity}L` : '';
  return (
    <Group x={x} y={y}>
      {isCylinder ? (
        <Circle x={0} y={0} radius={22} fill="white" stroke="black" strokeWidth={1.5} />
      ) : (
        <Rect x={-28} y={-22} width={56} height={44} fill="white" stroke="black" strokeWidth={1.5} />
      )}
      <Text text={label} x={isCylinder ? -8 : -10} y={-6} fontSize={8} fill="#333" fontStyle="bold" />
      {capacity && <Text text={capacity} x={-12} y={6} fontSize={7} fill="#555" />}
    </Group>
  );
}

// ─── Valve ────────────────────────────────────────────────
function ValveSymbol({ x, y, rotation, type, isOpen = true }) {
  const color = isOpen ? 'white' : '#333';
  return (
    <Group x={x} y={y} rotation={rotation}>
      {/* Gate valve = bowtie */}
      {type.includes('Gate') && (
        <Shape sceneFunc={(ctx, shape) => {
          ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(10, 0); ctx.lineTo(-10, 8); ctx.closePath();
          ctx.moveTo(10, -8); ctx.lineTo(-10, 0); ctx.lineTo(10, 8); ctx.closePath();
          ctx.fillStrokeShape(shape);
        }} fill={color} stroke="black" strokeWidth={1.5} />
      )}
      {/* Ball valve = circle with line */}
      {type.includes('Ball') && (
        <>
          <Circle x={0} y={0} radius={8} fill={color} stroke="black" strokeWidth={1.5} />
          <Line points={[-8,0,8,0]} stroke={isOpen ? 'black' : 'red'} strokeWidth={1.5} />
        </>
      )}
      {/* Generic / Globe = circle with triangle */}
      {!type.includes('Gate') && !type.includes('Ball') && (
        <>
          <Circle x={0} y={0} radius={7} fill={color} stroke="black" strokeWidth={1.5} />
          <Shape sceneFunc={(ctx, shape) => {
            ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(5, 5); ctx.lineTo(0, -5); ctx.closePath();
            ctx.fillStrokeShape(shape);
          }} fill={isOpen ? '#333' : 'white'} />
        </>
      )}
      {/* DN label */}
      <Text text={type.slice(0,3)} x={-8} y={12} fontSize={7} fill="#555" />
    </Group>
  );
}

// ─── Floor Drain / Gully ──────────────────────────────────
function DrainSymbol({ x, y, type }) {
  return (
    <Group x={x} y={y}>
      <Circle x={0} y={0} radius={8} stroke="black" strokeWidth={1.5} />
      <Line points={[-8,0,8,0]} stroke="black" strokeWidth={1} />
      <Line points={[0,-8,0,8]} stroke="black" strokeWidth={1} />
      {type && type.includes('Chamber') && (
        <Rect x={-12} y={-12} width={24} height={24} stroke="black" strokeWidth={1.5} />
      )}
    </Group>
  );
}

// ─── Main dispatcher ─────────────────────────────────────
export default function PlumbingSymbol2D({ element }) {
  const { category, subType, position, rotation = 0, config = {} } = element;
  const x = position.x * 50;
  const y = position.z * 50;

  switch (category) {
    case 'fixture':
      if (subType.includes('WC'))     return <WCSymbol     x={x} y={y} rotation={rotation} type={subType} />;
      if (subType.includes('Basin'))  return <BasinSymbol  x={x} y={y} rotation={rotation} type={subType} />;
      if (subType.includes('Bath'))   return <BathSymbol   x={x} y={y} rotation={rotation} type={subType} />;
      if (subType.includes('Shower')) return <ShowerSymbol x={x} y={y} rotation={rotation} />;
      return null;
    case 'vessel':
      return <VesselSymbol x={x} y={y} type={subType} config={config} />;
    case 'valve':
      return <ValveSymbol x={x} y={y} rotation={rotation} type={subType} isOpen={config?.isOpen !== false} />;
    case 'drain':
      return <DrainSymbol x={x} y={y} type={subType} />;
    default:
      return null;
  }
}
