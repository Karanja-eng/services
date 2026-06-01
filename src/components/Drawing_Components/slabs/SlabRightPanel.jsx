// SlabRightPanel.jsx — Annotations, AI assistant, registry, cross-section preview

import React, { useRef, useEffect } from 'react';
import { useSlabStore } from './slabStore';
import { SLAB_TYPES, checkLdRatio, calcSelfWeight, autoSuggestType } from './slabTypes';

// ─── AI structural assistant ──────────────────────────────────────────────────

function AIAssistant() {
  const { activeType, thickness, ribSpacing, ribWidth, spanX, spanY,
    imposedLoad, aiResponse, setAIResponse, generateSlab, exportJSON, importJSON } = useSlabStore();
  const [query, setQuery] = React.useState('');

  const answer = (q) => {
    const text = q.toLowerCase();
    const span = Math.max(spanX, spanY);
    const t = SLAB_TYPES.find(s => s.id === activeType);
    const ld = checkLdRatio(span, thickness, activeType);
    const sw = calcSelfWeight(thickness);

    if (text.includes('suggest') || text.includes('recommend') || text.includes('best')) {
      const suggestions = autoSuggestType(span, imposedLoad);
      return `For ${span}mm span, ${imposedLoad}kN/m²: ${suggestions.map(s =>
        `${SLAB_TYPES.find(t=>t.id===s.id)?.name} (${s.thickness}mm — ${s.note})`).join(' | ')}`;
    }
    if (text.includes('l/d') || text.includes('thickness') || text.includes('depth')) {
      return `${t?.name}: L/d=${ld.actual}${ld.ok?' ✓ OK':' ✗ EXCEED'}. Min thickness for ${span}mm span: ${ld.minThickness}mm (limit L/${ld.limit}).`;
    }
    if (text.includes('load') || text.includes('weight')) {
      const total = Math.round((sw + imposedLoad) * 10) / 10;
      return `Self-weight: ${sw} kN/m². Imposed: ${imposedLoad} kN/m². Total SLS: ${total} kN/m². ULS factored: ${Math.round(total*1.35*10)/10} kN/m².`;
    }
    if (text.includes('waffle') || text.includes('coffer')) {
      return `Waffle slab: coffers ${useSlabStore.getState().cofferSize}mm, ribs ${ribWidth}mm wide @ ${ribSpacing}c/c. L/d limit 24. Economic for 8-12m square bays.`;
    }
    if (text.includes('pt') || text.includes('post-tension')) {
      return `Post-tensioned flat slab: L/d = 38-45, min 180mm. Tendons 12.9mm Ø draped parabolically. Eliminates deflection. Prestress ≈10MPa.`;
    }
    if (text.includes('fire') || text.includes('rei')) {
      const rei = thickness>=200?'REI 240':thickness>=100?'REI 120':'REI 60';
      return `${rei} fire resistance at ${thickness}mm. Cover ≥ 35mm to main bars. REI 240 needs ≥200mm depth.`;
    }
    if (text.includes('json') || text.includes('export') || text.includes('spec')) {
      return `JSON exported to console. Use generateSlab(spec) to programmatically create slabs from JSON.`;
    }
    if (text.includes('hollow') || text.includes('precast')) {
      return `Hollow-core precast: spans 6-16m, depth 150-500mm. No formwork. Factory-made. Topping required for composite action (75-100mm min).`;
    }
    if (text.includes('composite') || text.includes('deck')) {
      return `Composite slab: steel deck (0.9mm) acts as formwork + tensile reinforcement. Shear studs transfer load. Typical span 3-4.5m between beams.`;
    }
    return `Module ready. ${useSlabStore.getState().slabs.length} slab(s). Active: ${t?.name}, ${thickness}mm, ${spanX}×${spanY}mm. Ask: suggest, l/d, load, waffle, PT, fire, hollow, composite, json.`;
  };

  const handleQuery = () => {
    if (!query.trim()) return;
    setAIResponse(answer(query));
    setQuery('');
  };

  return (
    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleQuery()}
          placeholder="e.g. suggest for 8m span..."
          style={styles.aiInput}
        />
        <button onClick={handleQuery} style={styles.aiBtn}>Ask</button>
      </div>
      {aiResponse && (
        <div style={styles.aiResponse}>{aiResponse}</div>
      )}
    </div>
  );
}

// ─── Auto-suggest box ─────────────────────────────────────────────────────────

function AutoSuggest() {
  const { spanX, spanY, imposedLoad, setActiveType, setThickness } = useSlabStore();
  const span = Math.max(spanX, spanY);
  const suggestions = autoSuggestType(span, imposedLoad);

  return (
    <div style={styles.suggestBox}>
      <div style={styles.suggestTitle}>Auto-Suggest</div>
      <div style={{ fontSize: 10, color: '#9AA3C8', marginBottom: 6 }}>
        Based on {span}mm span, {imposedLoad}kN/m² load:
      </div>
      {suggestions.map(s => {
        const t = SLAB_TYPES.find(st => st.id === s.id);
        return (
          <div key={s.id} onClick={() => { setActiveType(s.id); setThickness(s.thickness); }}
            style={styles.suggestRow}>
            <span style={{ color: t?.color }}>{t?.name}</span>
            <span style={{ fontFamily: 'monospace' }}>{s.note} — {s.thickness}mm</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Annotation list ──────────────────────────────────────────────────────────

function Annotations() {
  const { activeType, thickness, spanX, spanY, ffl, ribSpacing, ribWidth } = useSlabStore();
  const span = Math.max(spanX, spanY);
  const t = SLAB_TYPES.find(s => s.id === activeType);
  const ld = checkLdRatio(span, thickness, activeType);
  const sw = calcSelfWeight(thickness);

  const items = [
    { label: `${thickness} THK ${t?.mat || 'RC'} SLAB`, val: 'THK',   type: 'Thickness callout' },
    { label: `L/d = ${ld.actual}`,                      val: ld.ok ? 'OK' : 'FAIL', type: 'Span-depth ratio' },
    { label: `${sw} kN/m² self-weight`,                  val: 'LOAD',  type: 'Dead load' },
    { label: `FFL +${ffl}mm`,                            val: 'LEVEL', type: 'Finished floor level' },
    { label: `${spanX} × ${spanY}mm`,                   val: 'SPAN',  type: 'Bay dimensions' },
    ...(['ribbed','waffle'].includes(activeType) ? [
      { label: `${ribWidth} RIBS @ ${ribSpacing} C/C`, val: 'RIBS', type: 'Rib schedule' }
    ] : []),
    { label: t?.rebarNote || 'SEE STRUCTURAL DRAWINGS', val: 'REBR', type: 'Reinforcement note' },
  ];

  return (
    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
      {items.map((item, i) => (
        <div key={i} style={styles.annoItem}>
          <div>
            <div style={styles.annoLabel}>{item.label}</div>
            <div style={styles.annoType}>{item.type}</div>
          </div>
          <div style={{
            ...styles.annoVal,
            color: item.val === 'FAIL' ? '#E74C3C' : item.val === 'OK' ? '#2ECC71' : '#7B93FF',
          }}>{item.val}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Cross-section canvas ─────────────────────────────────────────────────────

function CrossSectionPreview() {
  const canvasRef = useRef(null);
  const { activeType, thickness, ribSpacing, ribWidth, cofferSize } = useSlabStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 276;
    const H = 130;
    canvas.width = W;
    canvas.height = H;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#171921';
    ctx.fillRect(0, 0, W, H);

    const t = SLAB_TYPES.find(s => s.id === activeType);
    const col = t?.color || '#4F6EF7';
    const sc = 0.22;
    const th = thickness;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    drawSection(ctx, activeType, th, ribSpacing, ribWidth, cofferSize, sc, col, W, H);
    ctx.restore();
  }, [activeType, thickness, ribSpacing, ribWidth, cofferSize]);

  return (
    <div style={{ padding: '8px 12px' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: 130, borderRadius: 6,
        border: '1px solid #2D3050', background: '#171921', display: 'block' }} />
    </div>
  );
}

function drawSection(ctx, type, th, rs, rw, cs, sc, col, W, H) {
  const slabH = th * sc;
  const totalW = W * 0.82;

  const drawRect = (x, y, w, h, fill, stroke) => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  };

  if (['flat','plate','raft','beam-slab','pt'].includes(type)) {
    drawRect(-totalW/2, -slabH/2, totalW, slabH, `${col}35`, col);
    // Rebar dots
    for (let x = -totalW/2 + 20; x < totalW/2; x += 30) {
      ctx.beginPath(); ctx.arc(x, slabH/2 - 10, 3, 0, Math.PI*2);
      ctx.fillStyle = '#E74C3C'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, -slabH/2 + 10, 3, 0, Math.PI*2); ctx.fill();
    }
    if (type === 'pt') {
      ctx.strokeStyle = '#F39C12'; ctx.lineWidth = 2;
      for (let x = -totalW/2 + 40; x < totalW/2; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, slabH/2 - 8);
        ctx.quadraticCurveTo(x + 12, 0, x + 24, slabH/2 - 8); ctx.stroke();
      }
    }
  } else if (type === 'ribbed') {
    const topH = th * 0.25 * sc;
    const ribH = th * 0.75 * sc;
    const ribSc = rs * sc * 0.4;
    const rwSc = rw * sc * 0.4;
    const nRibs = Math.floor(totalW / ribSc) + 1;
    const startX = -totalW/2;
    drawRect(startX, -topH - ribH/2, totalW, topH, `${col}40`, col);
    for (let i = 0; i < nRibs; i++) {
      const rx = startX + i * ribSc;
      drawRect(rx, -ribH/2, rwSc, ribH, `${col}55`, col);
      ctx.beginPath(); ctx.arc(rx + rwSc/2, ribH/2 - 8, 3, 0, Math.PI*2);
      ctx.fillStyle = '#E74C3C'; ctx.fill();
    }
    for (let i = 0; i < nRibs - 1; i++) {
      const bx = startX + i * ribSc + rwSc;
      drawRect(bx, -ribH/2, ribSc - rwSc, ribH, '#1E2130', '#2D3050');
    }
  } else if (type === 'waffle') {
    const topH = th * 0.22 * sc;
    const ribH = th * 0.78 * sc;
    const csSc = cs * sc * 0.35;
    const rwSc = rw * sc * 0.35;
    const nRibs = Math.min(5, Math.floor(totalW / csSc) + 1);
    const startX = -totalW/2;
    drawRect(startX, -topH - ribH/2, nRibs * csSc, topH, `${col}40`, col);
    for (let i = 0; i <= nRibs; i++) {
      drawRect(startX + i * csSc, -ribH/2, rwSc, ribH, `${col}55`, col);
    }
    for (let i = 0; i < nRibs; i++) {
      const bx = startX + i * csSc + rwSc;
      drawRect(bx, -ribH/2, csSc - rwSc - 2, ribH, '#111320', `${col}44`);
    }
  } else if (type === 'hollow') {
    drawRect(-totalW/2, -slabH/2, totalW, slabH, `${col}30`, col);
    const voidR = slabH * 0.32;
    for (let x = -totalW/2 + voidR*1.5; x < totalW/2 - voidR; x += voidR * 2.2) {
      ctx.beginPath(); ctx.ellipse(x, 0, voidR, voidR * 0.75, 0, 0, Math.PI*2);
      ctx.fillStyle = '#0D0F1A'; ctx.fill();
      ctx.strokeStyle = `${col}44`; ctx.lineWidth = 0.7; ctx.stroke();
    }
  } else if (type === 'composite') {
    const concH = slabH * 0.6;
    const deckH = slabH * 0.4;
    drawRect(-totalW/2, -slabH/2, totalW, concH, `${col}35`, col);
    ctx.strokeStyle = '#9B59B6'; ctx.lineWidth = 1.6;
    let dx = -totalW/2;
    while (dx < totalW/2) {
      ctx.beginPath();
      ctx.moveTo(dx, -slabH/2 + concH);
      ctx.lineTo(dx + 8, -slabH/2 + concH + deckH);
      ctx.lineTo(dx + 18, -slabH/2 + concH + deckH);
      ctx.lineTo(dx + 26, -slabH/2 + concH);
      ctx.stroke();
      dx += 26;
    }
  }

  // Dim line
  ctx.strokeStyle = `${col}66`; ctx.lineWidth = 0.7;
  ctx.setLineDash([3,2]);
  ctx.beginPath(); ctx.moveTo(-totalW/2 - 18, -slabH/2); ctx.lineTo(-totalW/2 - 18, slabH/2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = 'bold 9px monospace'; ctx.fillStyle = col;
  ctx.save(); ctx.translate(-totalW/2 - 28, 0); ctx.rotate(-Math.PI/2);
  ctx.textAlign = 'center'; ctx.fillText(`${th}`, 0, 0); ctx.restore();
}

// ─── Slab registry ────────────────────────────────────────────────────────────

function SlabRegistry() {
  const { slabs, selectedSlabId, selectSlab, deleteSlab, copySlabToFloor } = useSlabStore();
  const [levelOffset, setLevelOffset] = React.useState('3600');

  return (
    <div>
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {slabs.length === 0 && (
          <div style={{ fontSize: 11, color: '#5A6190', padding: '4px' }}>No slabs placed yet</div>
        )}
        {slabs.map(s => {
          const t = SLAB_TYPES.find(st => st.id === s.type);
          return (
            <div key={s.id} onClick={() => selectSlab(s.id)}
              style={{ ...styles.slabItem, borderColor: s.id === selectedSlabId ? t?.color : '#2D3050',
                background: s.id === selectedSlabId ? `${t?.color}18` : '#1E2130' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: t?.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#E8EAF6' }}>{t?.name || s.type}</div>
                <div style={{ fontSize: 10, color: '#5A6190', fontFamily: 'monospace' }}>
                  {s.thickness}mm · FFL+{s.level} · {s.id.slice(-4)}
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); deleteSlab(s.id); }}
                style={styles.delBtnSm}>✕</button>
            </div>
          );
        })}
      </div>

      {/* Copy to floor */}
      {slabs.length > 0 && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid #2D3050' }}>
          <div style={styles.label2}>Copy to Floor (offset mm)</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input style={styles.inputSm} value={levelOffset}
              onChange={e => setLevelOffset(e.target.value)} type="number" placeholder="3600" />
            <button style={styles.outlineBtn}
              onClick={() => { if(selectedSlabId) copySlabToFloor(selectedSlabId, parseInt(levelOffset)||3600); }}>
              Copy ↑
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Import/Export ────────────────────────────────────────────────────────────

function ImportExport() {
  const { exportJSON, importJSON, generateSlab } = useSlabStore();

  const handleExport = () => {
    const json = exportJSON();
    console.log('Slab JSON:', json);
    navigator.clipboard?.writeText(json);
  };

  const handleImport = () => {
    const raw = prompt('Paste JSON spec:');
    if (!raw) return;
    try {
      const spec = JSON.parse(raw);
      importJSON(spec);
    } catch(e) { alert('Invalid JSON: ' + e.message); }
  };

  return (
    <div style={{ padding: '8px 12px', display: 'flex', gap: 6, borderTop: '1px solid #2D3050' }}>
      <button style={styles.outlineBtn} onClick={handleImport}>Import JSON</button>
      <button style={styles.outlineBtn} onClick={handleExport}>Export JSON</button>
    </div>
  );
}

// ─── Main right panel ─────────────────────────────────────────────────────────

export function SlabRightPanel() {
  return (
    <div style={styles.panel}>
      <PanelHead title="AI Assistant" />
      <AIAssistant />

      <AutoSuggest />

      <PanelHead title="Annotations" />
      <Annotations />

      <PanelHead title="Cross-Section Preview" />
      <CrossSectionPreview />

      <PanelHead title="Slab Registry" />
      <SlabRegistry />

      <ImportExport />
    </div>
  );
}

function PanelHead({ title }) {
  return (
    <div style={{ padding: '10px 12px', borderBottom: '1px solid #2D3050',
      borderTop: '1px solid #2D3050', marginTop: 2 }}>
      <span style={styles.panelTitle}>{title}</span>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  panel: {
    background: '#171921',
    borderLeft: '1px solid #2D3050',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Syne', sans-serif",
    color: '#E8EAF6',
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '.07em',
    textTransform: 'uppercase',
    color: '#9AA3C8',
  },
  aiInput: {
    flex: 1,
    background: '#1E2130',
    border: '1px solid #2D3050',
    borderRadius: 5,
    padding: '7px 10px',
    fontSize: 11,
    color: '#E8EAF6',
    fontFamily: "'Syne', sans-serif",
    outline: 'none',
  },
  aiBtn: {
    background: '#4F6EF7',
    border: 'none',
    color: '#fff',
    borderRadius: 5,
    padding: '7px 14px',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: "'Syne', sans-serif",
    whiteSpace: 'nowrap',
  },
  aiResponse: {
    background: '#1E2130',
    border: '1px solid #2D3050',
    borderRadius: 5,
    padding: '9px 10px',
    fontSize: 11,
    color: '#9AA3C8',
    lineHeight: 1.6,
    maxHeight: 130,
    overflowY: 'auto',
  },
  suggestBox: {
    margin: '8px 12px',
    background: 'rgba(79,110,247,.06)',
    border: '1px solid rgba(79,110,247,.2)',
    borderRadius: 6,
    padding: 10,
  },
  suggestTitle: { fontSize: 11, fontWeight: 600, color: '#7B93FF', marginBottom: 4 },
  suggestRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
    color: '#9AA3C8',
    padding: '3px 4px',
    borderRadius: 3,
    cursor: 'pointer',
  },
  annoItem: {
    background: '#1E2130',
    border: '1px solid #2D3050',
    borderRadius: 4,
    padding: '7px 10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  annoLabel: { fontSize: 11, color: '#E8EAF6', fontWeight: 500 },
  annoType:  { fontSize: 9, color: '#5A6190', marginTop: 2 },
  annoVal:   { fontSize: 10, fontFamily: 'monospace' },
  slabItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid #2D3050',
    borderRadius: 5,
    padding: '7px 9px',
    cursor: 'pointer',
    transition: 'all .12s',
  },
  label2: { fontSize: 10, color: '#9AA3C8', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase' },
  inputSm: {
    flex: 1,
    background: '#1E2130',
    border: '1px solid #2D3050',
    borderRadius: 4,
    color: '#E8EAF6',
    padding: '5px 8px',
    fontSize: 11,
    fontFamily: 'monospace',
    outline: 'none',
  },
  outlineBtn: {
    background: 'transparent',
    border: '1px solid #3D4270',
    color: '#9AA3C8',
    borderRadius: 4,
    padding: '5px 10px',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: "'Syne', sans-serif",
    whiteSpace: 'nowrap',
  },
  delBtnSm: {
    background: 'transparent',
    border: 'none',
    color: '#5A6190',
    cursor: 'pointer',
    fontSize: 11,
    padding: '2px 4px',
  },
};

export default SlabRightPanel;
