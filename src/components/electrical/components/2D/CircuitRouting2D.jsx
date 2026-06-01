import React from 'react';
import { Group, Line, Path } from 'react-konva';
import { COLORS } from '../../utils/constants';

export default function CircuitRouting2D({ circuits, elements }) {
  // Simple rendering of lines between elements in the same circuit
  
  return (
    <Group>
      {Object.values(circuits).map(circuit => {
        if (circuit.elements.length < 2) return null;
        
        // Extract positions for all elements in circuit
        const points = circuit.elements.map(id => {
          const el = elements[id];
          return el && el.position ? [el.position.x * 100, el.position.z * 100] : null;
        }).filter(Boolean);

        if (points.length < 2) return null;

        // Flatten points array for Konva Line
        const flatPoints = points.reduce((acc, val) => acc.concat(val), []);

        return (
          <Group key={circuit.ref}>
            <Line 
              points={flatPoints} 
              stroke={circuit.ref.startsWith('L') ? COLORS.LIGHTING : COLORS.POWER} 
              strokeWidth={1.5} 
              lineCap="round" 
              lineJoin="round" 
              tension={0.2} 
            />
            {/* Show wire count ticks halfway between first two points */}
            <Path 
               data={`M ${points[0][0] + 5} ${points[0][1] + 5} L ${points[0][0] - 5} ${points[0][1] - 5}`} 
               stroke="black" strokeWidth={1} 
            />
          </Group>
        );
      })}
    </Group>
  );
}
