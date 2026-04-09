import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer, Line, Circle, Rect, Arrow, Text, Group } from 'react-konva';
import { useStore } from './useStore';
import { Road2D } from './Road2D';
import { Tree2D } from './Tree2D';
import { Parking2D } from './Parking2D';
import { NorthArrow } from './NorthArrow';
import { ScaleBar } from './ScaleBar';

const WORLD_TO_PX = 10; // 10 px per metre at scale 1:100

export function Viewport2D() {
  const { elements, terrain, gridVisible, selectedIds, selectElement, selectedTool, addElement, snapshot } = useStore();

  const stageRef = useRef(null);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [drawingPath, setDrawingPath] = useState(null); // for road/path tool
  const [size, setSize] = useState({ w: 800, h: 600 });
  const containerRef = useRef(null);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // World ↔ canvas coordinate helpers
  const worldToPx = useCallback((wx, wz) => ({
    x: (wx * WORLD_TO_PX * stageScale) + stagePos.x + size.w / 2,
    y: (wz * WORLD_TO_PX * stageScale) + stagePos.y + size.h / 2,
  }), [stagePos, stageScale, size]);

  const pxToWorld = useCallback((px, py) => ({
    wx: (px - stagePos.x - size.w / 2) / (WORLD_TO_PX * stageScale),
    wz: (py - stagePos.y - size.h / 2) / (WORLD_TO_PX * stageScale),
  }), [stagePos, stageScale, size]);

  // Zoom
  const handleWheel = (e) => {
    e.evt.preventDefault();
    const scaleBy = 1.08;
    const stage = stageRef.current;
    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.1, Math.min(10, newScale));
    setStageScale(clampedScale);
    setStagePos(p => ({
      x: pointer.x - (pointer.x - p.x) * (clampedScale / oldScale),
      y: pointer.y - (pointer.y - p.y) * (clampedScale / oldScale),
    }));
  };

  // Click to draw road
  const handleStageClick = (e) => {
    if (e.target !== stageRef.current && e.target.getParent()?.getType() !== 'Stage') return;
    const pos = stageRef.current.getPointerPosition();
    const { wx, wz } = pxToWorld(pos.x, pos.y);

    if (['road', 'path', 'driveway'].includes(selectedTool)) {
      setDrawingPath(prev => {
        if (!prev) return [[wx, wz]];
        return [...prev, [wx, wz]];
      });
    }
  };

  const handleStageDblClick = () => {
    if (!drawingPath || drawingPath.length < 2) { setDrawingPath(null); return; }
    const toolDefaults = {
      road: { width: 7, lanes: 2, material: 'asphalt', kerb: 'upstand', markings: ['centre', 'edge'] },
      path: { width: 1.8, material: 'paving', markings: [] },
      driveway: { width: 3.2, material: 'block_paving', markings: [] },
    };
    snapshot();
    addElement({ type: selectedTool, path: drawingPath, ...toolDefaults[selectedTool] });
    setDrawingPath(null);
  };

  // Draw the in-progress path preview
  const previewFlatPts = drawingPath
    ? drawingPath.flatMap(([wx, wz]) => {
        const { x, y } = worldToPx(wx, wz);
        return [x, y];
      })
    : [];

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#f5f0e8] overflow-hidden">
      {/* Label */}
      <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-[#0d1420]/80 border border-[#2a3144] rounded text-xs text-[#4a6fa5] font-mono">
        ▣ PLAN VIEW
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-8 left-2 z-10 text-xs text-[#888] font-mono bg-white/60 px-2 py-1 rounded">
        {drawingPath ? `Drawing path — ${drawingPath.length} pts | Dbl-click to finish` : 'Scroll to zoom · Drag to pan'}
      </div>

      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        draggable={selectedTool === 'select'}
        onDragEnd={e => setStagePos({ x: e.target.x(), y: e.target.y() })}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onDblClick={handleStageDblClick}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
      >
        <Layer>
          {/* Background */}
          <Rect
            x={-size.w / stageScale}
            y={-size.h / stageScale}
            width={size.w * 3 / stageScale}
            height={size.h * 3 / stageScale}
            fill="#f5f0e8"
          />

          {/* Grid */}
          {gridVisible && <PlanGrid size={size} stageScale={stageScale} />}

          {/* Site boundary demo */}
          <SiteBoundary size={size} />

          {/* All 2D elements */}
          {elements.map(el => (
            <Element2D
              key={el.id}
              element={el}
              isSelected={selectedIds.includes(el.id)}
              scale={WORLD_TO_PX}
              onSelect={() => selectElement(el.id)}
              stagePos={stagePos}
              stageScale={stageScale}
              size={size}
            />
          ))}

          {/* Drawing preview */}
          {previewFlatPts.length >= 4 && (
            <Line
              points={previewFlatPts.map((v, i) => (i % 2 === 0 ? (v - stagePos.x) / stageScale : (v - stagePos.y) / stageScale))}
              stroke="#00d4ff"
              strokeWidth={2 / stageScale}
              dash={[6 / stageScale, 3 / stageScale]}
            />
          )}
          {drawingPath?.map(([wx, wz], i) => {
            const { x, y } = worldToPx(wx, wz);
            return (
              <Circle
                key={i}
                x={(x - stagePos.x) / stageScale}
                y={(y - stagePos.y) / stageScale}
                radius={4 / stageScale}
                fill="#00d4ff"
              />
            );
          })}
        </Layer>

        {/* Overlay layer (north arrow, scale bar) — fixed to canvas */}
        <Layer listening={false}>
          <NorthArrow x={size.w / stageScale - 60 / stageScale} y={60 / stageScale} scale={1 / stageScale} />
          <ScaleBar x={30 / stageScale} y={size.h / stageScale - 40 / stageScale} pxPerMetre={WORLD_TO_PX} scale={1 / stageScale} />
        </Layer>
      </Stage>
    </div>
  );
}

function Element2D({ element, isSelected, scale, onSelect, stagePos, stageScale, size }) {
  switch (element.type) {
    case 'road':
    case 'path':
    case 'driveway':
      return <Road2D element={element} isSelected={isSelected} scale={scale} onSelect={onSelect} />;
    case 'parking':
      return <Parking2D element={element} isSelected={isSelected} scale={scale} onSelect={onSelect} />;
    case 'tree':
      return <Tree2D element={element} isSelected={isSelected} scale={scale} onSelect={onSelect} />;
    default:
      return null;
  }
}

function PlanGrid({ size, stageScale }) {
  const lines = [];
  const step = 10; // 10m grid
  const range = 200;
  for (let i = -range; i <= range; i += step) {
    const isMajor = i % 50 === 0;
    lines.push(
      <Line key={`v${i}`} points={[i * 10, -range * 10, i * 10, range * 10]}
        stroke={isMajor ? '#c8c0b0' : '#ddd5c5'} strokeWidth={isMajor ? 0.8 : 0.4} />,
      <Line key={`h${i}`} points={[-range * 10, i * 10, range * 10, i * 10]}
        stroke={isMajor ? '#c8c0b0' : '#ddd5c5'} strokeWidth={isMajor ? 0.8 : 0.4} />
    );
  }
  return <>{lines}</>;
}

function SiteBoundary({ size }) {
  const pts = [[-50, -40], [50, -40], [50, 40], [-50, 40]];
  const flat = pts.flatMap(([x, z]) => [x * 10, z * 10]);
  return (
    <Line
      points={flat}
      stroke="#8a6a4a"
      strokeWidth={2}
      dash={[12, 6]}
      closed
    />
  );
}