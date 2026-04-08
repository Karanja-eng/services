import React from 'react';
import { Group, Line, Text } from 'react-konva';

const ROAD_FILL = {
  asphalt: '#3a3a3a',
  concrete: '#c0b8a8',
  block_paving: '#a09080',
  gravel: '#b0a888',
  paving: '#b8ad8a',
};

const ROAD_WIDTHS = { road: 7, path: 1.8, driveway: 3.2 };
const SCALE = 10; // px per metre

export function Road2D({ element, isSelected, scale = 10, onSelect }) {
  const { path, width, material, markings = [], type } = element;
  if (!path || path.length < 2) return null;

  const px = (v) => v * scale;
  const fillColor = ROAD_FILL[material] || ROAD_FILL.asphalt;
  const roadWidth = px(width || ROAD_WIDTHS[type] || 7);

  // Build flat pts for main road line
  const flatPts = path.flatMap(([x, z]) => [px(x), px(z)]);

  // Compute offset edge lines
  const leftEdge = offsetPath(path, -width / 2, scale);
  const rightEdge = offsetPath(path, width / 2, scale);

  return (
    <Group onClick={onSelect}>
      {/* Road fill (thick line) */}
      <Line
        points={flatPts}
        stroke={fillColor}
        strokeWidth={roadWidth}
        lineCap="round"
        lineJoin="round"
        opacity={isSelected ? 0.9 : 1}
        shadowBlur={isSelected ? 8 : 0}
        shadowColor="#00d4ff"
      />

      {/* Left kerb edge */}
      <Line
        points={leftEdge}
        stroke={isSelected ? '#00d4ff' : '#555'}
        strokeWidth={isSelected ? 2 : 1.5}
        lineCap="butt"
      />

      {/* Right kerb edge */}
      <Line
        points={rightEdge}
        stroke={isSelected ? '#00d4ff' : '#555'}
        strokeWidth={isSelected ? 2 : 1.5}
        lineCap="butt"
      />

      {/* Centre line marking */}
      {markings.includes('centre') && (
        <Line
          points={flatPts}
          stroke="#ffffff"
          strokeWidth={0.6}
          dash={[px(3), px(2)]}
          lineCap="butt"
          opacity={0.8}
        />
      )}

      {/* Edge markings */}
      {markings.includes('edge') && (
        <>
          <Line points={offsetPath(path, -(width / 2 - 0.3), scale)} stroke="#fff" strokeWidth={0.5} />
          <Line points={offsetPath(path, (width / 2 - 0.3), scale)} stroke="#fff" strokeWidth={0.5} />
        </>
      )}

      {/* Double yellow lines */}
      {markings.includes('double_yellow') && (
        <>
          <Line points={offsetPath(path, -0.15, scale)} stroke="#ffcc00" strokeWidth={0.8} />
          <Line points={offsetPath(path, 0.15, scale)} stroke="#ffcc00" strokeWidth={0.8} />
        </>
      )}

      {/* Stop line */}
      {markings.includes('stop_line') && (() => {
        const last = path[path.length - 1];
        const second = path[path.length - 2];
        const dx = last[0] - second[0], dz = last[1] - second[1];
        const len = Math.hypot(dx, dz) || 1;
        const perp = [-dz / len, dx / len];
        const hw = width / 2;
        return (
          <Line
            points={[
              px(last[0] - perp[0] * hw), px(last[1] - perp[1] * hw),
              px(last[0] + perp[0] * hw), px(last[1] + perp[1] * hw),
            ]}
            stroke="#fff"
            strokeWidth={px(0.3)}
          />
        );
      })()}
    </Group>
  );
}

function offsetPath(path, d, scale) {
  return path.flatMap(([x, z], i) => {
    const prev = path[i - 1] || path[i];
    const next = path[i + 1] || path[i];
    const dx = next[0] - prev[0], dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz) || 1;
    const px2 = -dz / len, pz2 = dx / len;
    return [
      (x + px2 * d) * scale,
      (z + pz2 * d) * scale,
    ];
  });
}