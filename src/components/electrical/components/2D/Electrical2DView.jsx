import React, { useRef, useState } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import { useElectricalStore } from '../../stores/electricalStore';
import Symbols2D from './Symbols2D';
import CircuitRouting2D from './CircuitRouting2D';

export default function Electrical2DView() {
  const { elements, circuits, setSelectedElementId } = useElectricalStore();
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const mousePointTo = {
      x: (stage.getPointerPosition().x - stage.x()) / oldScale,
      y: (stage.getPointerPosition().y - stage.y()) / oldScale,
    };
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    setScale(newScale);
    setPosition({
      x: stage.getPointerPosition().x - mousePointTo.x * newScale,
      y: stage.getPointerPosition().y - mousePointTo.y * newScale,
    });
  };

  return (
    <div className="w-full h-full bg-gray-50 dark:bg-[#121212]">
      <Stage 
        width={window.innerWidth - 500} 
        height={window.innerHeight - 100}
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
          {/* Background Grid */}
          <Rect x={-1000} y={-1000} width={3000} height={3000} fill="#f8f9fa" />
          
          <CircuitRouting2D circuits={circuits} elements={elements} />
          
          {Object.values(elements).map(el => (
             <Symbols2D key={el.id} element={el} />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
