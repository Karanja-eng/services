import React from 'react';
import { Group, Circle, Line, Rect, Text, Arrow } from 'react-konva';

// ── Tree2D ────────────────────────────────────────────────────────────────

export function Tree2D({ element, isSelected, scale = 10, onSelect }) {
  const { origin, species = 'deciduous', treeScale = 1 } = element;
  if (!origin) return null;

  const [wx, wz] = origin;
  const x = wx * scale;
  const y = wz * scale;

  const radii = { deciduous: 3, conifer: 2, palm: 2, shrub: 1.2 };
  const r = (radii[species] || 3) * treeScale * scale;

  const colors = {
    deciduous: '#2d6a1a',
    conifer: '#1a4a1a',
    palm: '#3a8a1a',
    shrub: '#4a7a2a',
  };
  const c = colors[species] || '#2d6a1a';

  // Plan symbol: circle + radial hatch lines
  const spokes = 8;
  const spokeLines = Array.from({ length: spokes }, (_, i) => {
    const angle = (i / spokes) * Math.PI * 2;
    return [x, y, x + Math.cos(angle) * r * 0.8, y + Math.sin(angle) * r * 0.8];
  });

  return (
    <Group onClick={onSelect}>
      <Circle
        x={x} y={y} radius={r}
        fill={c + '44'}
        stroke={isSelected ? '#00d4ff' : c}
        strokeWidth={isSelected ? 2 : 1}
      />
      {spokeLines.map((pts, i) => (
        <Line key={i} points={pts} stroke={c} strokeWidth={0.5} opacity={0.6} />
      ))}
      {/* Trunk dot */}
      <Circle x={x} y={y} radius={r * 0.12} fill={c} />
    </Group>
  );
}

// ── Parking2D ─────────────────────────────────────────────────────────────

export function Parking2D({ element, isSelected, scale = 10, onSelect }) {
  const {
    origin = [0, 0],
    width = 20,
    depth = 12,
    bayWidth = 2.5,
    bayDepth = 5.0,
    aisleWidth = 6.0,
    rows = 1,
    baysPerRow = 8,
    material = 'asphalt',
  } = element;

  const [ox, oz] = origin;
  const px = (v) => v * scale;

  const surfaceColor = material === 'asphalt' ? '#3a3a3a' : '#c0b8a8';
  const totalDepth = rows * (bayDepth + aisleWidth);

  return (
    <Group x={px(ox)} y={px(oz)} onClick={onSelect}>
      {/* Surface */}
      <Rect
        width={px(width)}
        height={px(totalDepth)}
        fill={surfaceColor}
        stroke={isSelected ? '#00d4ff' : '#555'}
        strokeWidth={isSelected ? 2 : 1}
      />

      {/* Aisles */}
      {Array.from({ length: rows }, (_, r) => (
        <Rect
          key={r}
          x={0}
          y={px(r * (bayDepth + aisleWidth))}
          width={px(width)}
          height={px(aisleWidth)}
          fill="#444"
          opacity={0.5}
        />
      ))}

      {/* Bay lines */}
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: baysPerRow + 1 }, (_, b) => (
          <Line
            key={`${r}-${b}`}
            points={[
              px(b * bayWidth), px(r * (bayDepth + aisleWidth) + aisleWidth),
              px(b * bayWidth), px(r * (bayDepth + aisleWidth) + aisleWidth + bayDepth),
            ]}
            stroke="#aaa"
            strokeWidth={0.6}
          />
        ))
      )}

      {/* Bay numbers */}
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: baysPerRow }, (_, b) => (
          <Text
            key={`num-${r}-${b}`}
            x={px(b * bayWidth + bayWidth / 2) - 4}
            y={px(r * (bayDepth + aisleWidth) + aisleWidth + bayDepth * 0.5) - 4}
            text={String(r * baysPerRow + b + 1)}
            fontSize={Math.max(4, scale * 0.25)}
            fill="#ccc"
            align="center"
          />
        ))
      )}
    </Group>
  );
}

// ── NorthArrow ────────────────────────────────────────────────────────────

export function NorthArrow({ x = 50, y = 50, scale = 1, angle = 0 }) {
  return (
    <Group x={x} y={y} rotation={angle} scaleX={scale} scaleY={scale}>
      <Arrow
        points={[0, 20, 0, -20]}
        pointerLength={10}
        pointerWidth={8}
        fill="#1a1a1a"
        stroke="#1a1a1a"
        strokeWidth={2}
      />
      <Circle x={0} y={0} radius={22} stroke="#1a1a1a" strokeWidth={1.5} fill="transparent" />
      <Text x={-5} y={-40} text="N" fontSize={14} fontStyle="bold" fill="#1a1a1a" />
    </Group>
  );
}

// ── ScaleBar ──────────────────────────────────────────────────────────────

export function ScaleBar({ x = 30, y = 30, pxPerMetre = 10, scale = 1 }) {
  const totalM = 50; // represents 50 metres
  const totalPx = totalM * pxPerMetre;
  const divisions = 5;
  const divPx = totalPx / divisions;

  return (
    <Group x={x} y={y} scaleX={scale} scaleY={scale}>
      {/* Outer border */}
      <Rect x={0} y={0} width={totalPx} height={10} stroke="#333" strokeWidth={1} fill="transparent" />
      {/* Alternating fill blocks */}
      {Array.from({ length: divisions }, (_, i) => (
        <Rect key={i} x={i * divPx} y={0} width={divPx} height={10}
          fill={i % 2 === 0 ? '#333' : '#fff'} />
      ))}
      {/* Labels */}
      {Array.from({ length: divisions + 1 }, (_, i) => (
        <Text
          key={i}
          x={i * divPx - 5}
          y={12}
          text={String(i * (totalM / divisions))}
          fontSize={8}
          fill="#333"
        />
      ))}
      <Text x={totalPx + 4} y={12} text="m" fontSize={8} fill="#333" />
      <Text x={0} y={-12} text="1:100" fontSize={9} fontStyle="bold" fill="#333" />
    </Group>
  );
}
