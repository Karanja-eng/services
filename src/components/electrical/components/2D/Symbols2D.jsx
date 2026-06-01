import React from 'react';
import { Group, Rect, Circle, Line, Text } from 'react-konva';
import { COLORS } from '../../utils/constants';

// IEC 60617 / BS 7671 compliant symbols
export default function Symbols2D({ element }) {
  const { elementType, subType, position, rotation = 0, config = {} } = element;
  const x = position.x * 100; // Convert scale for 2D map
  const y = position.z * 100;

  if (elementType === 'socket') {
    return (
      <Group x={x} y={y} rotation={rotation}>
        <Rect x={-10} y={-5} width={20} height={10} stroke="black" strokeWidth={1} fill="white" />
        <Line points={[0, 5, 0, 15]} stroke="black" strokeWidth={1} />
        {config.gang === 2 && <Line points={[5, 5, 5, 15]} stroke="black" strokeWidth={1} />}
        {config.gang === 2 && <Line points={[-5, 5, -5, 15]} stroke="black" strokeWidth={1} />}
        <Text text={config.amperage + 'A'} x={-8} y={-20} fontSize={8} fill="blue" />
      </Group>
    );
  }

  if (elementType === 'switch') {
    return (
      <Group x={x} y={y} rotation={rotation}>
        <Circle x={0} y={0} radius={6} stroke="black" strokeWidth={1} />
        <Line points={[-6, 0, 6, 0]} stroke="black" strokeWidth={1} />
        <Line points={[0, 0, 8, -8]} stroke="black" strokeWidth={1} />
        {config.gang > 1 && <Text text={config.gang.toString()} x={8} y={-12} fontSize={8} />}
      </Group>
    );
  }

  if (elementType === 'light') {
    return (
      <Group x={x} y={y} rotation={rotation}>
        {subType.includes('downlight') ? (
          <>
            <Circle x={0} y={0} radius={10} stroke="black" strokeWidth={1} fill="#fffaa" />
            <Line points={[-10, 0, 10, 0]} stroke="black" strokeWidth={0.5} />
            <Line points={[0, -10, 0, 10]} stroke="black" strokeWidth={0.5} />
          </>
        ) : (
          <Rect x={-15} y={-5} width={30} height={10} stroke="black" strokeWidth={1} />
        )}
      </Group>
    );
  }

  if (elementType === 'db') {
    return (
      <Group x={x} y={y} rotation={rotation}>
        <Rect x={-20} y={-10} width={40} height={20} fill="#333" />
        <Text text="DB" x={-10} y={-5} fill="white" fontSize={10} />
      </Group>
    );
  }

  if (elementType === 'safetyDevice') {
    return (
      <Group x={x} y={y} rotation={rotation}>
        <Circle x={0} y={0} radius={8} stroke="red" strokeWidth={1.5} />
        <Text text={subType === 'smoke_detector' ? 'S' : 'H'} x={-3} y={-4} fontSize={8} fill="red" />
      </Group>
    );
  }

  return null;
}
