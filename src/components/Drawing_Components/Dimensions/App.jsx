import React, { useState, useRef, useCallback, useEffect } from 'react';
import FloatingPalette from '../../FloatingPalette';
import { Stage, Layer, Line, Arc, Circle, Text, Arrow, Group } from 'react-konva';
import { useAnnotationStore } from './stores/annotationStore';
import { Toolbar } from './components/Toolbar';
import { StylePanel } from './components/StylePanel';
import { CanvasAnnotations } from './components/CanvasAnnotations';
import { StatusBar } from './components/StatusBar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { TOOLS, COLORS } from './utils/constants';
import { distance } from './utils/geometry';

const TWO_PT_TOOLS = [
  TOOLS.LINEAR_DIM, TOOLS.ALIGNED_DIM, TOOLS.ANGULAR_DIM,
  TOOLS.RADIUS_DIM, TOOLS.DIAMETER_DIM, TOOLS.LEADER,
  TOOLS.SECTION_MARK, TOOLS.DETAIL_CIRCLE,
];
const ONE_PT_TOOLS = [
  TOOLS.ROOM_TAG, TOOLS.NORTH_ARROW, TOOLS.SCALE_BAR,
  TOOLS.GRID_BUBBLE, TOOLS.LEVEL_MARKER,
];

export default function App() {
  const stageRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [stageScale, setStageScale] = useState(1);
  const [showTools, setShowTools] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState(TOOLS.SELECT);
  const [clickPoints, setClickPoints] = useState([]);
  const [mousePos, setMousePos] = useState({ x: 400, y: 300 });
  const [isDragging, setIsDragging] = useState(false);
  const [textEditing, setTextEditing] = useState(null);

  const {
    annotations, selectedId, activeStyle,
    setSelectedId, addAnnotation, updateAnnotation, deleteAnnotation,
  } = useAnnotationStore();

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const getWorldPos = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pos = stage.getPointerPosition();
    return {
      x: (pos.x - stage.x()) / stage.scaleX(),
      y: (pos.y - stage.y()) / stage.scaleY(),
    };
  }, []);

  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const scaleBy = 1.1;
    const newScale = Math.min(Math.max(
      e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy,
      0.04, 30
    ));
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, []);

  const finalizeAnnotation = useCallback((tool, points) => {
    const id = `ann_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const sty = { ...activeStyle };
    const specMap = {
      [TOOLS.LINEAR_DIM]: { type: 'linear_dim', points, style: sty },
      [TOOLS.ALIGNED_DIM]: { type: 'aligned_dim', points, style: sty },
      [TOOLS.CHAIN_DIM]: { type: 'chain_dim', points, style: sty },
      [TOOLS.ANGULAR_DIM]: { type: 'angular_dim', points, style: sty },
      [TOOLS.RADIUS_DIM]: { type: 'radius_dim', points, style: sty },
      [TOOLS.DIAMETER_DIM]: { type: 'diameter_dim', points, style: sty },
      [TOOLS.LEADER]: { type: 'leader', points, text: 'Note', style: sty },
      [TOOLS.SECTION_MARK]: { type: 'section_mark', points, text: 'A', style: sty },
      [TOOLS.DETAIL_CIRCLE]: { type: 'detail_circle', points, text: '1', style: sty },
      [TOOLS.ROOM_TAG]: { type: 'room_tag', points, text: 'ROOM', area: 0, style: sty },
      [TOOLS.GRID_BUBBLE]: { type: 'grid_bubble', points, text: 'A', style: sty },
      [TOOLS.NORTH_ARROW]: { type: 'north_arrow', points, style: sty },
      [TOOLS.SCALE_BAR]: { type: 'scale_bar', points, style: sty },
      [TOOLS.LEVEL_MARKER]: { type: 'level_marker', points, text: '±0.000', style: sty },
    };
    if (specMap[tool]) addAnnotation({ id, ...specMap[tool] });
  }, [activeStyle, addAnnotation]);

  const handleStageClick = useCallback((e) => {
    if (isDragging) return;
    if (activeTool === TOOLS.SELECT || activeTool === TOOLS.PAN) {
      if (e.target === e.target.getStage()) setSelectedId(null);
      return;
    }
    const pos = getWorldPos();
    const newPts = [...clickPoints, pos];

    if (ONE_PT_TOOLS.includes(activeTool)) {
      finalizeAnnotation(activeTool, newPts);
      setClickPoints([]);
    } else if (TWO_PT_TOOLS.includes(activeTool)) {
      if (newPts.length === 2) {
        finalizeAnnotation(activeTool, newPts);
        setClickPoints([]);
      } else {
        setClickPoints(newPts);
      }
    } else if (activeTool === TOOLS.CHAIN_DIM) {
      setClickPoints(newPts);
    }
  }, [isDragging, activeTool, clickPoints, getWorldPos, finalizeAnnotation, setSelectedId]);

  const handleStageDblClick = useCallback((e) => {
    if (activeTool === TOOLS.CHAIN_DIM && clickPoints.length >= 2) {
      finalizeAnnotation(TOOLS.CHAIN_DIM, clickPoints);
      setClickPoints([]);
    }
  }, [activeTool, clickPoints, finalizeAnnotation]);

  const handleMouseMove = useCallback(() => {
    setMousePos(getWorldPos());
  }, [getWorldPos]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !textEditing) {
        deleteAnnotation(selectedId);
      }
      if (e.key === 'Escape') {
        setClickPoints([]);
        if (activeTool !== TOOLS.SELECT) setActiveTool(TOOLS.SELECT);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, textEditing, activeTool, deleteAnnotation]);

  const cursor = activeTool === TOOLS.PAN ? 'grab'
    : activeTool === TOOLS.SELECT ? 'default'
    : 'crosshair';

  const ts = 1 / stageScale;

  return (
    <div className="flex flex-col h-screen bg-[#13131f] font-mono overflow-hidden select-none">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-[#0a0a15] border-b border-[#1e1e36] z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[#3a7acc] text-xs font-bold tracking-widest">ARCHDIM</span>
          <span className="text-[#2a2a4a] text-[10px] hidden sm:block">
            Dimensioning & Annotation Engine v2.1
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTools(!showTools)}
            className={`px-3 py-1 text-[10px] font-mono rounded transition-all ${showTools ? 'bg-[#4a9eff] text-white' : 'text-[#4a9eff] border border-[#4a9eff33] hover:bg-[#4a9eff11]'}`}
          >
            DIMENSION TOOLS
          </button>
          <button
            onClick={() => setShowProperties(!showProperties)}
            className={`px-3 py-1 text-[10px] font-mono rounded transition-all ${showProperties ? 'bg-[#4a9eff] text-white' : 'text-[#4a9eff] border border-[#4a9eff33] hover:bg-[#4a9eff11]'}`}
          >
            PROPERTIES
          </button>
        </div>
        <div className="flex items-center gap-5 text-[9px] text-[#2a3a5a]">
          <span>1:{Math.max(1, Math.round(100 / stageScale))}</span>
          <span>{Math.round(stageScale * 100)}%</span>
          <span className="font-mono">{Math.round(mousePos.x)}, {Math.round(mousePos.y)}</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {showTools && (
          <FloatingPalette title="Dimension Tools" onClose={() => setShowTools(false)} width={72}>
            <Toolbar activeTool={activeTool} setActiveTool={setActiveTool} clickPoints={clickPoints} />
          </FloatingPalette>
        )}

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden w-full h-full" style={{ cursor }}>
          {/* Grid */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: `
              linear-gradient(rgba(30,50,90,0.18) 1px, transparent 1px),
              linear-gradient(90deg, rgba(30,50,90,0.18) 1px, transparent 1px),
              linear-gradient(rgba(30,50,90,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(30,50,90,0.06) 1px, transparent 1px)
            `,
            backgroundSize: `
              ${100 * stageScale}px ${100 * stageScale}px,
              ${100 * stageScale}px ${100 * stageScale}px,
              ${20 * stageScale}px ${20 * stageScale}px,
              ${20 * stageScale}px ${20 * stageScale}px
            `,
            backgroundPosition: `${stagePos.x}px ${stagePos.y}px`,
          }} />

          <Stage
            ref={stageRef}
            width={size.w}
            height={size.h}
            scaleX={stageScale}
            scaleY={stageScale}
            x={stagePos.x}
            y={stagePos.y}
            onWheel={handleWheel}
            onClick={handleStageClick}
            onDblClick={handleStageDblClick}
            onMouseMove={handleMouseMove}
            draggable={activeTool === TOOLS.PAN || activeTool === TOOLS.SELECT}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={(e) => {
              setTimeout(() => setIsDragging(false), 50);
              setStagePos({ x: e.target.x(), y: e.target.y() });
            }}
          >
            <Layer name="drawing">
              <SampleFloorPlan />
            </Layer>
            <Layer name="annotations">
              <CanvasAnnotations
                annotations={annotations}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                updateAnnotation={updateAnnotation}
                stageScale={stageScale}
                setTextEditing={setTextEditing}
              />
            </Layer>
            <Layer name="preview">
              <PreviewLayer
                activeTool={activeTool}
                clickPoints={clickPoints}
                mousePos={mousePos}
                ts={ts}
              />
            </Layer>
          </Stage>

          {textEditing && (
            <TextEditorOverlay
              textEditing={textEditing}
              stagePos={stagePos}
              stageScale={stageScale}
              onConfirm={(val) => {
                updateAnnotation(textEditing.id, { text: val });
                setTextEditing(null);
              }}
              onCancel={() => setTextEditing(null)}
            />
          )}
        </div>

        {/* Right Panel as Floating Palette */}
        {showProperties && (
          <FloatingPalette title="Properties" onClose={() => setShowProperties(false)} width={280}>
            <StylePanel />
            <PropertiesPanel
              annotation={annotations.find(a => a.id === selectedId)}
              updateAnnotation={updateAnnotation}
            />
          </FloatingPalette>
        )}
      </div>

      <StatusBar activeTool={activeTool} clickPoints={clickPoints} selectedId={selectedId} />
    </div>
  );
}

// ── Sample floor plan ────────────────────────────────────────────
function SampleFloorPlan() {
  const w = { stroke: '#b0bcd8', strokeWidth: 8, lineCap: 'square', lineJoin: 'miter' };
  const wi = { stroke: '#4a9eff', strokeWidth: 3, opacity: 0.7 };
  return (
    <Group>
      {/* Outer */}
      <Line points={[100,100, 700,100, 700,500, 100,500]} closed {...w} />
      {/* Interior */}
      <Line points={[380,100, 380,340]} {...w} />
      <Line points={[100,310, 380,310]} {...w} />
      <Line points={[380,240, 700,240]} {...w} />
      <Line points={[540,240, 540,500]} {...w} />
      {/* Door arc */}
      <Arc x={380} y={200} innerRadius={0} outerRadius={60}
        angle={90} rotation={0} stroke="#7090b0" strokeWidth={1} opacity={0.6} />
      {/* Windows */}
      <Line points={[420,100, 520,100]} {...wi} />
      <Line points={[420,100, 420,94]} stroke="#4a9eff" strokeWidth={1} opacity={0.5} />
      <Line points={[520,100, 520,94]} stroke="#4a9eff" strokeWidth={1} opacity={0.5} />
      <Line points={[200,500, 310,500]} {...wi} />
      <Line points={[600,100, 680,100]} {...wi} />
      {/* Room labels (background) */}
      <Text x={150} y={185} text="LIVING ROOM" fontSize={10} fill="#2a3a5a" fontFamily="monospace" letterSpacing={1} />
      <Text x={420} y={145} text="KITCHEN" fontSize={10} fill="#2a3a5a" fontFamily="monospace" letterSpacing={1} />
      <Text x={150} y={360} text="BEDROOM" fontSize={10} fill="#2a3a5a" fontFamily="monospace" letterSpacing={1} />
      <Text x={430} y={330} text="BATH" fontSize={10} fill="#2a3a5a" fontFamily="monospace" letterSpacing={1} />
      <Text x={560} y={330} text="HALL" fontSize={10} fill="#2a3a5a" fontFamily="monospace" letterSpacing={1} />
    </Group>
  );
}

// ── Placement preview ────────────────────────────────────────────
function PreviewLayer({ activeTool, clickPoints, mousePos, ts }) {
  if (clickPoints.length === 0) return null;
  const p0 = clickPoints[0];
  const p1 = mousePos;

  if ([TOOLS.LINEAR_DIM, TOOLS.ALIGNED_DIM, TOOLS.CHAIN_DIM,
       TOOLS.LEADER, TOOLS.SECTION_MARK, TOOLS.DETAIL_CIRCLE,
       TOOLS.ANGULAR_DIM, TOOLS.RADIUS_DIM, TOOLS.DIAMETER_DIM].includes(activeTool)) {
    const d = Math.round(distance(p0, p1));
    const mx = (p0.x + p1.x) / 2;
    const my = (p0.y + p1.y) / 2;
    return (
      <Group>
        <Line points={[p0.x, p0.y, p1.x, p1.y]}
          stroke="#4a9eff" strokeWidth={ts} dash={[6 * ts, 4 * ts]} opacity={0.5} />
        <Circle x={p0.x} y={p0.y} radius={3.5 * ts} fill="#4a9eff" opacity={0.8} />
        <Circle x={p1.x} y={p1.y} radius={3.5 * ts} fill="#4a9eff" opacity={0.5} />
        <Group x={mx} y={my - 12 * ts}>
          <Text x={-18 * ts} y={-5 * ts} text={`${d}`}
            fontSize={9 * ts} fill="#4a9eff" fontFamily="monospace" />
        </Group>
        {clickPoints.slice(1).map((pp, i) => (
          <Circle key={i} x={pp.x} y={pp.y} radius={3.5 * ts} fill="#ffd700" opacity={0.8} />
        ))}
      </Group>
    );
  }
  return null;
}

// ── Text editor overlay ──────────────────────────────────────────
function TextEditorOverlay({ textEditing, stagePos, stageScale, onConfirm, onCancel }) {
  const [val, setVal] = useState(textEditing.value || '');
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const sx = textEditing.x * stageScale + stagePos.x;
  const sy = textEditing.y * stageScale + stagePos.y;
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 100 }}>
      <textarea
        ref={ref}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onConfirm(val); }
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={() => onConfirm(val)}
        style={{ left: sx, top: sy, fontSize: 11 }}
        className="absolute pointer-events-auto bg-[#0d0d1a] border border-[#4a9eff] text-[#4a9eff] px-2 py-1 rounded outline-none resize-none font-mono min-w-28"
        rows={1}
      />
    </div>
  );
}
