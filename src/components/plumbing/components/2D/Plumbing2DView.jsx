import React, { useState } from 'react';
import { Stage, Layer, Rect, Line, Text } from 'react-konva';
import { usePlumbingStore } from '../../stores/plumbingStore';
import PlumbingSymbol2D from './Symbols2D';
import PipeRouting2D from './PipeRouting2D';

const GRID_SIZE = 25; // px per grid cell

export default function Plumbing2DView() {
  const { plumbingElements, pipeRoutes, setSelectedElementId } = usePlumbingStore();
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 80, y: 80 });
  const [viewportSize] = useState({ w: window.innerWidth - 520, h: window.innerHeight - 100 });

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const scaleBy = 1.08;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.1, Math.min(newScale, 10));
    setScale(clampedScale);
    setPosition({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  };

  // Build background grid lines
  const gridLines = [];
  const gridCount = 80;
  for (let i = 0; i <= gridCount; i++) {
    gridLines.push(
      <Line key={`h${i}`} points={[0, i * GRID_SIZE, gridCount * GRID_SIZE, i * GRID_SIZE]}
        stroke="#e2e8f0" strokeWidth={0.5} />,
      <Line key={`v${i}`} points={[i * GRID_SIZE, 0, i * GRID_SIZE, gridCount * GRID_SIZE]}
        stroke="#e2e8f0" strokeWidth={0.5} />
    );
  }

  return (
    <div className="w-full h-full bg-gray-50 dark:bg-[#121212] relative">
      {/* Legend overlay */}
      <div className="absolute top-3 right-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 z-10 text-[10px] space-y-1 shadow-md">
        {[
          { sys: 'CWS', color: '#0000CC', label: 'Cold Water Supply' },
          { sys: 'HWS', color: '#CC0000', label: 'Hot Water Supply' },
          { sys: 'HWR', color: '#CC0000', label: 'HW Return (dashed)', dashed: true },
          { sys: 'SVP', color: '#1A1A1A', label: 'Soil / Vent Pipe' },
          { sys: 'WASTE', color: '#808080', label: 'Waste Pipe' },
          { sys: 'RWP',  color: '#008000', label: 'Rainwater Pipe' },
        ].map(item => (
          <div key={item.sys} className="flex items-center gap-2">
            <svg width={28} height={8}>
              <line x1="0" y1="4" x2="28" y2="4"
                stroke={item.color} strokeWidth="2"
                strokeDasharray={item.dashed ? '6,3' : 'none'} />
            </svg>
            <span className="text-gray-600 dark:text-gray-300">{item.label}</span>
          </div>
        ))}
      </div>

      <Stage
        width={viewportSize.w}
        height={viewportSize.h}
        onWheel={handleWheel}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        draggable
        onClick={(e) => {
          if (e.target === e.target.getStage()) setSelectedElementId(null);
        }}
      >
        <Layer>
          {/* Background */}
          <Rect x={-200} y={-200} width={gridCount * GRID_SIZE + 400} height={gridCount * GRID_SIZE + 400} fill="#f8fafc" />
          {gridLines}

          {/* Pipe routes */}
          <PipeRouting2D pipeRoutes={pipeRoutes} />

          {/* Fixture / vessel symbols */}
          {Object.values(plumbingElements).map(el => (
            <PlumbingSymbol2D key={el.id} element={el} />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
