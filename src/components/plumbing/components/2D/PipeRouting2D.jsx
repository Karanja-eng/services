import React from 'react';
import { Group, Line, Text, Arrow } from 'react-konva';

const PIPE_STYLES = {
  CWS:      { stroke: '#0000CC', strokeWidth: 1.5, dash: [] },
  HWS:      { stroke: '#CC0000', strokeWidth: 1.5, dash: [] },
  HWR:      { stroke: '#CC0000', strokeWidth: 1.5, dash: [15, 5] },
  SVP:      { stroke: '#1A1A1A', strokeWidth: 2,   dash: [] },
  WASTE:    { stroke: '#808080', strokeWidth: 1,   dash: [] },
  OVERFLOW: { stroke: '#FFA500', strokeWidth: 1.5, dash: [20, 8] },
  RWP:      { stroke: '#008000', strokeWidth: 1,   dash: [] },
  GREY:     { stroke: '#800080', strokeWidth: 1.5, dash: [10, 5, 2, 5] },
  GAS:      { stroke: '#CCCC00', strokeWidth: 1.5, dash: [10, 5] }
};

const SCALE = 50; // 1 unit = 50px

function getMidpoint(pts) {
  const n = pts.length / 2;
  const idx = Math.floor(n / 2) * 2;
  return { x: pts[idx], y: pts[idx + 1] };
}

function getAngle(pts) {
  if (pts.length < 4) return 0;
  const dx = pts[2] - pts[0];
  const dy = pts[3] - pts[1];
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export default function PipeRouting2D({ pipeRoutes }) {
  if (!pipeRoutes) return null;

  return (
    <Group>
      {Object.values(pipeRoutes).map(route => {
        if (!route.points || route.points.length < 2) return null;

        const flatPts = route.points.flatMap(p => [p.x * SCALE, p.z * SCALE]);
        const style = PIPE_STYLES[route.system] || PIPE_STYLES.CWS;
        const mid = getMidpoint(flatPts);
        const angle = getAngle(flatPts);
        const label = `${route.size || '?'}${route.material ? route.material.slice(0,2) : ''} ${route.system || ''}`;

        return (
          <Group key={route.id}>
            {/* Pipe line */}
            <Line
              points={flatPts}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              dash={style.dash}
              lineCap="round"
              lineJoin="round"
            />

            {/* Flow arrow at midpoint */}
            <Arrow
              x={mid.x}
              y={mid.y}
              points={[0, 0, 10, 0]}
              rotation={angle}
              fill={style.stroke}
              stroke={style.stroke}
              strokeWidth={0.8}
              pointerLength={5}
              pointerWidth={4}
            />

            {/* Size / system label */}
            <Text
              x={mid.x + 4}
              y={mid.y - 12}
              text={label}
              fontSize={7}
              fill={style.stroke}
              rotation={angle > 45 || angle < -135 ? angle + 180 : angle}
              fontStyle="bold"
            />

            {/* Gradient annotation for drainage */}
            {route.gradient && (
              <Text
                x={mid.x + 4}
                y={mid.y + 2}
                text={`1:${route.gradient} FALL`}
                fontSize={6}
                fill="#666"
                rotation={angle > 45 || angle < -135 ? angle + 180 : angle}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
}
