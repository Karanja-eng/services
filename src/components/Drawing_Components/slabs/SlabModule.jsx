// SlabModule.jsx — Root component: layout shell + canvas toolbar + view switching
// This is the main entry point. Import and drop <SlabModule /> anywhere.

import React, { useState } from 'react';
import { useSlabStore } from './slabStore';
import { SLAB_TYPES } from './slabTypes';
import { SlabSidebar } from './SlabSidebar';
import { SlabRightPanel } from './SlabRightPanel';
import { Slab2D } from './Slab2D';
import { Slab3D } from './Slab3D';
import FloatingPalette from '../../FloatingPalette';

// ─── Toolbar button ───────────────────────────────────────────────────────────

function ToolBtn({ label, toolId, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: active ? 'rgba(79,110,247,.18)' : 'transparent',
      border: 'none',
      color: active ? '#7B93FF' : '#9AA3C8',
      padding: '4px 10px',
      borderRadius: 4,
      fontSize: 11,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      fontFamily: "'Syne', sans-serif",
      transition: 'all .12s',
      whiteSpace: 'nowrap',
    }}>{label}</button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 20, background: '#2D3050', margin: '0 4px' }} />;
}

// ─── Canvas toolbar ───────────────────────────────────────────────────────────

function CanvasToolbar({ view, setViewLocal }) {
  const { tool, setTool, toggleGrid, toggleAnnotations, clearAll,
    generateSlab, exportJSON } = useSlabStore();

  const handleGenerate = () => {
    generateSlab();
  };

  const handleExportCode = () => {
    const json = exportJSON();
    const jsx = buildJSX(JSON.parse(json));
    navigator.clipboard?.writeText(jsx).catch(() => {});
    console.log('JSX:\n', jsx);
    alert('JSX component code copied to clipboard!\nAlso logged to console.');
  };

  return (
    <div style={{
      height: 40,
      background: '#171921',
      borderBottom: '1px solid #2D3050',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: 4,
      flexShrink: 0,
    }}>
      <ToolBtn label="⬚ Select"    toolId="select"    active={tool==='select'}    onClick={() => setTool('select')} />
      <ToolBtn label="⬡ Polygon"   toolId="polygon"   active={tool==='polygon'}   onClick={() => setTool('polygon')} />
      <ToolBtn label="✚ Opening"   toolId="opening"   active={tool==='opening'}   onClick={() => setTool('opening')} />
      <ToolBtn label="↔ Dimension" toolId="dimension" active={tool==='dimension'} onClick={() => setTool('dimension')} />
      <Divider />
      <ToolBtn label="⊞ Grid"       onClick={toggleGrid} />
      <ToolBtn label="◎ Annotations" onClick={toggleAnnotations} />
      <ToolBtn label="✕ Clear"       onClick={clearAll} />

      {/* View tabs — right aligned */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
        {['plan','section','3d'].map(v => (
          <button key={v} onClick={() => setViewLocal(v)} style={{
            background: view === v ? '#1E2130' : 'transparent',
            border: `1px solid ${view===v ? '#3D4270' : 'transparent'}`,
            color: view === v ? '#7B93FF' : '#9AA3C8',
            padding: '4px 12px',
            borderRadius: 4,
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: "'Syne', sans-serif",
            textTransform: 'capitalize',
          }}>
            {v === '3d' ? '3D View' : v === 'plan' ? 'Plan' : 'Section'}
          </button>
        ))}
      </div>

      <Divider />
      <button onClick={handleGenerate} style={{
        background: '#4F6EF7',
        border: 'none',
        color: '#fff',
        borderRadius: 4,
        padding: '5px 12px',
        fontSize: 11,
        cursor: 'pointer',
        fontFamily: "'Syne', sans-serif",
        fontWeight: 600,
      }}>Generate</button>

      <button onClick={handleExportCode} style={{
        background: 'transparent',
        border: '1px solid #3D4270',
        color: '#9AA3C8',
        borderRadius: 4,
        padding: '5px 10px',
        fontSize: 11,
        cursor: 'pointer',
        fontFamily: "'Syne', sans-serif",
      }}>Export JSX</button>
    </div>
  );
}

// ─── Section view (Canvas-based) ─────────────────────────────────────────────
// Uses the same Canvas 2D draw logic as the mini-preview, full-size

function SectionView({ width, height }) {
  const canvasRef = React.useRef(null);
  const { activeType, thickness, ribSpacing, ribWidth, cofferSize } = useSlabStore();

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = width;
    canvas.height = height;

    ctx.fillStyle = '#0D0F1A';
    ctx.fillRect(0, 0, width, height);

    const t = SLAB_TYPES.find(s => s.id === activeType);
    const col = t?.color || '#4F6EF7';
    const sc  = 0.55;

    ctx.save();
    ctx.translate(width / 2, height / 2);
    drawFullSection(ctx, activeType, thickness, ribSpacing, ribWidth, cofferSize, sc, col, width, height);
    ctx.restore();

    // Title
    ctx.font = 'bold 13px "DM Mono", monospace';
    ctx.fillStyle = col;
    ctx.textAlign = 'left';
    ctx.fillText(`SECTION A—A  ·  ${t?.name?.toUpperCase()}  ·  ${thickness}mm THK`, 24, 28);
  }, [activeType, thickness, ribSpacing, ribWidth, cofferSize, width, height]);

  return (
    <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
  );
}

function drawFullSection(ctx, type, th, rs, rw, cs, sc, col, W, H) {
  const slabH = th * sc;
  const totalW = W * 0.75;

  const drawRect = (x, y, w, h, fill, stroke, lw = 1) => {
    ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = lw;
    ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
  };

  const hatch = (x, y, w, h) => {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = `${col}22`; ctx.lineWidth = 0.5;
    for (let i = -h; i < w + h; i += 14) {
      ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i + h, y + h); ctx.stroke();
    }
    ctx.restore();
  };

  const rebar = (y) => {
    for (let x = -totalW/2 + 30; x < totalW/2; x += 40) {
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI*2);
      ctx.fillStyle = '#E74C3C'; ctx.fill();
      ctx.strokeStyle = '#FF7070'; ctx.lineWidth = 0.6; ctx.stroke();
    }
  };

  const dimLine = (x, y1, y2, label) => {
    ctx.strokeStyle = `${col}66`; ctx.lineWidth = 0.8; ctx.setLineDash([3,2]);
    ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x-4, y1); ctx.lineTo(x+4, y1);
    ctx.moveTo(x-4, y2); ctx.lineTo(x+4, y2);
    ctx.strokeStyle = `${col}88`; ctx.stroke();
    ctx.save(); ctx.translate(x, (y1+y2)/2); ctx.rotate(-Math.PI/2);
    ctx.font = 'bold 11px monospace'; ctx.fillStyle = col; ctx.textAlign = 'center';
    ctx.fillText(label, 0, -7); ctx.restore();
  };

  if (['flat','plate','raft','beam-slab','pt'].includes(type)) {
    drawRect(-totalW/2, -slabH/2, totalW, slabH, `${col}30`, col, 1.5);
    hatch(-totalW/2, -slabH/2, totalW, slabH);
    rebar(slabH/2 - 20);
    rebar(-slabH/2 + 20);
    if (type === 'pt') {
      ctx.strokeStyle = '#F39C12'; ctx.lineWidth = 2.5;
      for (let x = -totalW/2 + 60; x < totalW/2; x += 70) {
        ctx.beginPath(); ctx.moveTo(x, slabH/2 - 18);
        ctx.quadraticCurveTo(x + 20, 5, x + 40, slabH/2 - 18); ctx.stroke();
      }
    }
    if (type === 'raft') {
      ctx.strokeStyle = '#5A6190'; ctx.lineWidth = 1; ctx.setLineDash([8,4]);
      ctx.beginPath(); ctx.moveTo(-totalW/2, slabH/2+6); ctx.lineTo(totalW/2, slabH/2+6); ctx.stroke();
      ctx.setLineDash([]);
    }
    dimLine(-totalW/2 - 40, -slabH/2, slabH/2, `${th}mm`);
  } else if (type === 'ribbed') {
    const topH = th * 0.25 * sc;
    const ribH = th * 0.75 * sc;
    const ribSc = (rs * sc * 0.5);
    const rwSc  = (rw * sc * 0.5);
    const nRibs = Math.floor(totalW / ribSc) + 1;
    const startX = -nRibs * ribSc / 2;
    drawRect(startX, -topH - ribH/2, nRibs * ribSc, topH, `${col}40`, col, 1.5);
    hatch(startX, -topH - ribH/2, nRibs * ribSc, topH);
    for (let i = 0; i < nRibs; i++) {
      const rx = startX + i * ribSc;
      drawRect(rx, -ribH/2, rwSc, ribH, `${col}55`, col, 1.2);
      ctx.beginPath(); ctx.arc(rx + rwSc/2, ribH/2 - 14, 5, 0, Math.PI*2);
      ctx.fillStyle = '#E74C3C'; ctx.fill();
      ctx.beginPath(); ctx.arc(rx + rwSc/2, -ribH/2 + 14, 3, 0, Math.PI*2);
      ctx.fillStyle = '#E74C3C'; ctx.fill();
    }
    for (let i = 0; i < nRibs - 1; i++) {
      const bx = startX + i * ribSc + rwSc;
      drawRect(bx, -ribH/2, ribSc - rwSc, ribH, '#1E2130', '#2D3050', 0.8);
      // Infill label
      ctx.font = '9px monospace'; ctx.fillStyle = '#5A6190'; ctx.textAlign = 'center';
      ctx.fillText('EPS', bx + (ribSc-rwSc)/2, 4);
    }
    // Rib spacing dim
    ctx.font = 'bold 10px monospace'; ctx.fillStyle = col; ctx.textAlign = 'center';
    ctx.fillText(`${rs} C/C`, startX + ribSc * 1.5, ribH/2 + 22);
    dimLine(startX - 40, -topH - ribH/2, ribH/2, `${th}mm`);
  } else if (type === 'waffle') {
    const topH = th * 0.22 * sc;
    const ribH = th * 0.78 * sc;
    const csSc = cs * sc * 0.42;
    const rwSc = rw * sc * 0.42;
    const nRibs = Math.min(5, Math.floor(totalW / csSc));
    const startX = -(nRibs * csSc) / 2;
    drawRect(startX, -topH - ribH/2, nRibs * csSc + rwSc, topH, `${col}40`, col, 1.5);
    for (let i = 0; i <= nRibs; i++) {
      drawRect(startX + i * csSc, -ribH/2, rwSc, ribH, `${col}55`, col, 1.2);
    }
    for (let i = 0; i < nRibs; i++) {
      const bx = startX + i * csSc + rwSc;
      const bw = csSc - rwSc;
      drawRect(bx, -ribH/2, bw, ribH, '#111320', `${col}44`, 0.8);
      ctx.font = '9px monospace'; ctx.fillStyle = `${col}77`; ctx.textAlign = 'center';
      ctx.fillText(`${cs-rw}×${cs-rw}`, bx + bw/2, 4);
    }
    dimLine(startX - 40, -topH - ribH/2, ribH/2, `${th}mm`);
  } else if (type === 'hollow') {
    drawRect(-totalW/2, -slabH/2, totalW, slabH, `${col}30`, col, 1.5);
    const voidR = slabH * 0.30;
    for (let x = -totalW/2 + voidR * 1.7; x < totalW/2 - voidR; x += voidR * 2.4) {
      ctx.beginPath(); ctx.ellipse(x, 0, voidR, voidR * 0.72, 0, 0, Math.PI*2);
      ctx.fillStyle = '#0D0F1A'; ctx.fill();
      ctx.strokeStyle = `${col}55`; ctx.lineWidth = 0.8; ctx.stroke();
    }
    dimLine(-totalW/2 - 40, -slabH/2, slabH/2, `${th}mm`);
  } else if (type === 'composite') {
    const concH = slabH * 0.62;
    const deckH = slabH * 0.38;
    drawRect(-totalW/2, -slabH/2, totalW, concH, `${col}35`, col, 1.5);
    hatch(-totalW/2, -slabH/2, totalW, concH);
    rebar(-slabH/2 + 20);
    ctx.strokeStyle = '#9B59B6'; ctx.lineWidth = 2;
    const deckY = -slabH/2 + concH;
    let dx = -totalW/2;
    while (dx < totalW/2) {
      ctx.beginPath();
      ctx.moveTo(dx, deckY);
      ctx.lineTo(dx + 10, deckY + deckH);
      ctx.lineTo(dx + 22, deckY + deckH);
      ctx.lineTo(dx + 32, deckY);
      ctx.stroke();
      dx += 32;
    }
    ctx.strokeStyle = `${col}44`; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(-totalW/2, deckY); ctx.lineTo(totalW/2, deckY); ctx.stroke();
    dimLine(-totalW/2 - 40, -slabH/2, slabH/2, `${th}mm`);
  }

  // Section label
  ctx.font = '12px monospace'; ctx.fillStyle = '#9AA3C8'; ctx.textAlign = 'left';
  ctx.fillText('A', -totalW/2 - 20, -slabH/2 - 14);
  ctx.fillText('A', -totalW/2 - 20, slabH/2 + 14);
}

// ─── Main Module ──────────────────────────────────────────────────────────────

/**
 * Drop-in root component. Uses CSS Grid layout.
 *
 * Props:
 *   width  {number}  — overall width  (default: window width)
 *   height {number}  — overall height (default: window height)
 *   style  {object}  — extra styles for root div
 */
export function SlabModule({ width, height, style = {} }) {
  const [viewLocal, setViewLocal] = useState('plan');
  const [showTools, setShowTools] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const W = width  || '100vw';
  const H = height || '100vh';

  // Sync local view to store
  const { setView } = useSlabStore();
  const handleSetView = (v) => { setViewLocal(v); setView(v); };

  return (
    <div style={{
      width: W, height: H,
      display: 'grid',
      gridTemplateColumns: '1fr',
      gridTemplateRows: '56px 1fr 24px',
      background: '#0F1117',
      fontFamily: "'Syne', sans-serif",
      ...style,
    }}>

      {/* Header */}
      <div style={{
        gridColumn: '1/-1',
        background: '#171921',
        borderBottom: '1px solid #2D3050',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 14,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '.1em',
          color: '#7B93FF', textTransform: 'uppercase' }}>
          ARCH<span style={{ color: '#5A6190' }}>CAD</span> · Slab &amp; Floor System
        </span>
        <span style={styles.badge}>MODULE v2.4</span>
        <span style={styles.badge}>{viewLocal === 'plan' ? '2D PLAN VIEW' : viewLocal === 'section' ? 'SECTION VIEW' : '3D ISOMETRIC'}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button style={styles.headerBtn} onClick={() => setShowTools(!showTools)}>
            Slab Tools
          </button>
          <button style={styles.headerBtn} onClick={() => setShowProperties(!showProperties)}>
            Slab Properties
          </button>
          <button style={styles.headerBtn} onClick={() => { const json = useSlabStore.getState().exportJSON(); console.log(json); }}>
            Export JSON
          </button>
          <button style={{ ...styles.headerBtn, background: '#4F6EF7', color: '#fff', borderColor: '#4F6EF7' }}
            onClick={() => useSlabStore.getState().generateSlab()}>
            Generate Slab
          </button>
        </div>
      </div>

      {/* Left sidebar as Floating Palette */}
      {showTools && (
        <FloatingPalette title="Slab Tools" onClose={() => setShowTools(false)} width={320}>
          <SlabSidebar />
        </FloatingPalette>
      )}

      {/* Canvas area */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0D0F1A' }}>
        <CanvasToolbar view={viewLocal} setViewLocal={handleSetView} />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <CanvasArea view={viewLocal} />
        </div>
      </div>

      {/* Right panel as Floating Palette */}
      {showProperties && (
        <FloatingPalette title="Slab Properties" onClose={() => setShowProperties(false)} width={330}>
          <SlabRightPanel />
        </FloatingPalette>
      )}

      {/* Status bar */}
      <StatusBar view={viewLocal} />
    </div>
  );
}

// ─── Canvas area router ───────────────────────────────────────────────────────

function CanvasArea({ view }) {
  const containerRef = React.useRef(null);
  const [dims, setDims] = React.useState({ w: 800, h: 600 });

  React.useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: Math.floor(width), h: Math.floor(height) });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      {view === 'plan' && <Slab2D width={dims.w} height={dims.h} />}
      {view === 'section' && <SectionView width={dims.w} height={dims.h} />}
      {view === '3d' && <Slab3D width={dims.w} height={dims.h} />}
    </div>
  );
}

// ─── Status bar ───────────────────────────────────────────────────────────────

function StatusBar({ view }) {
  const { slabs, activeType, thickness, spanX, spanY } = useSlabStore();
  const t = SLAB_TYPES.find(s => s.id === activeType);
  return (
    <div style={{
      gridColumn: '1/-1',
      background: '#171921',
      borderTop: '1px solid #2D3050',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 20,
      fontSize: 10,
      color: '#5A6190',
      fontFamily: 'monospace',
    }}>
      <span style={{ color: '#2ECC71' }}>● READY</span>
      <span>{slabs.length} slab(s)</span>
      <span>{t?.name} · {thickness}mm · {spanX}×{spanY}mm</span>
      <span style={{ marginLeft: 'auto' }}>1:50 @ A1 · mm · SLS</span>
    </div>
  );
}

// ─── JSX code generator ───────────────────────────────────────────────────────

function buildJSX(spec) {
  return `<Slab3D
  type="${spec.type}"
  footprint={${JSON.stringify(spec.footprint)}}
  thickness={${spec.thickness}}
  ribSpacing={${spec.ribSpacing}}
  ribWidth={${spec.ribWidth}}
  cofferSize={${spec.cofferSize}}
  waffleGrid={${JSON.stringify(spec.waffleGrid)}}
  drops={${JSON.stringify(spec.drops)}}
  openings={${JSON.stringify(spec.openings)}}
  material="${spec.material}"
  ffl={${spec.finishLevel}}
/>`;
}

const styles = {
  badge: {
    background: '#1E2130',
    border: '1px solid #2D3050',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 11,
    color: '#9AA3C8',
    fontFamily: 'monospace',
  },
  headerBtn: {
    background: 'transparent',
    border: '1px solid #3D4270',
    color: '#9AA3C8',
    padding: '5px 12px',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: "'Syne', sans-serif",
  },
};

export default SlabModule;
