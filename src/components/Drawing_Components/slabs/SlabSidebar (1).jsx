// SlabSidebar.jsx — Left panel: type selector + parameters + structural check

import React from 'react';
import { useSlabStore } from './slabStore';
import { SLAB_TYPES, autoSuggestType, checkLdRatio, calcSelfWeight } from './slabTypes';

// ─── Inline SVG type icons ────────────────────────────────────────────────────

const TYPE_ICONS = {
  flat: (
    <svg width="40" height="24" viewBox="0 0 40 24">
      <rect x="0" y="8" width="40" height="8" rx="2" fill="#4F6EF7" opacity=".7"/>
      <line x1="5" y1="14" x2="35" y2="14" stroke="#E74C3C" strokeWidth="1" opacity=".5"/>
      <line x1="5" y1="10" x2="35" y2="10" stroke="#E74C3C" strokeWidth="1" opacity=".5"/>
    </svg>
  ),
  plate: (
    <svg width="40" height="24" viewBox="0 0 40 24">
      <rect x="0" y="9" width="40" height="5" rx="1" fill="#7B93FF" opacity=".8"/>
    </svg>
  ),
  ribbed: (
    <svg width="40" height="24" viewBox="0 0 40 24">
      <rect x="0" y="4" width="40" height="4" rx="1" fill="#2ECC71" opacity=".7"/>
      <rect x="4" y="8" width="4" height="10" rx="1" fill="#2ECC71" opacity=".6"/>
      <rect x="16" y="8" width="4" height="10" rx="1" fill="#2ECC71" opacity=".6"/>
      <rect x="28" y="8" width="4" height="10" rx="1" fill="#2ECC71" opacity=".6"/>
      <rect x="8" y="10" width="8" height="8" rx="1" fill="#111320"/>
      <rect x="20" y="10" width="8" height="8" rx="1" fill="#111320"/>
    </svg>
  ),
  waffle: (
    <svg width="40" height="24" viewBox="0 0 40 24">
      <rect x="0" y="2" width="40" height="4" rx="1" fill="#1ABC9C" opacity=".7"/>
      <rect x="4" y="6" width="4" height="16" rx="1" fill="#1ABC9C" opacity=".5"/>
      <rect x="16" y="6" width="4" height="16" rx="1" fill="#1ABC9C" opacity=".5"/>
      <rect x="28" y="6" width="4" height="16" rx="1" fill="#1ABC9C" opacity=".5"/>
      <rect x="0" y="13" width="40" height="3" rx="1" fill="#1ABC9C" opacity=".4"/>
      <rect x="8" y="7" width="8" height="6" rx="1" fill="#111320"/>
      <rect x="20" y="7" width="8" height="6" rx="1" fill="#111320"/>
      <rect x="8" y="16" width="8" height="5" rx="1" fill="#111320"/>
      <rect x="20" y="16" width="8" height="5" rx="1" fill="#111320"/>
    </svg>
  ),
  pt: (
    <svg width="40" height="24" viewBox="0 0 40 24">
      <rect x="0" y="6" width="40" height="10" rx="2" fill="#F39C12" opacity=".4"/>
      <path d="M2,14 Q10,8 20,12 Q30,16 38,10" stroke="#F39C12" strokeWidth="1.5" fill="none"/>
      <path d="M2,15 Q10,11 20,14 Q30,17 38,12" stroke="#F39C12" strokeWidth="1" fill="none" opacity=".5"/>
    </svg>
  ),
  hollow: (
    <svg width="40" height="24" viewBox="0 0 40 24">
      <rect x="0" y="4" width="40" height="16" rx="2" fill="#E74C3C" opacity=".35"/>
      <ellipse cx="9" cy="12" rx="4" ry="5" fill="#111320"/>
      <ellipse cx="20" cy="12" rx="4" ry="5" fill="#111320"/>
      <ellipse cx="31" cy="12" rx="4" ry="5" fill="#111320"/>
    </svg>
  ),
  composite: (
    <svg width="40" height="24" viewBox="0 0 40 24">
      <rect x="0" y="4" width="40" height="9" rx="1" fill="#9B59B6" opacity=".45"/>
      <path d="M0,13 L7,20 L14,13 L21,20 L28,13 L35,20 L40,15" stroke="#9B59B6" strokeWidth="1.5" fill="none"/>
      <rect x="0" y="13" width="40" height="1" fill="#9B59B6" opacity=".7"/>
    </svg>
  ),
  raft: (
    <svg width="40" height="24" viewBox="0 0 40 24">
      <rect x="0" y="4" width="40" height="16" rx="2" fill="#E67E22" opacity=".35"/>
      <rect x="0" y="4" width="6" height="16" rx="2" fill="#E67E22" opacity=".7"/>
      <rect x="34" y="4" width="6" height="16" rx="2" fill="#E67E22" opacity=".7"/>
      <rect x="0" y="15" width="40" height="5" rx="1" fill="#E67E22" opacity=".5"/>
    </svg>
  ),
  'beam-slab': (
    <svg width="40" height="24" viewBox="0 0 40 24">
      <rect x="0" y="4" width="40" height="5" rx="1" fill="#16A085" opacity=".7"/>
      <rect x="4" y="9" width="7" height="12" rx="1" fill="#16A085" opacity=".5"/>
      <rect x="29" y="9" width="7" height="12" rx="1" fill="#16A085" opacity=".5"/>
      <rect x="11" y="14" width="18" height="2" fill="#111320" opacity=".7"/>
    </svg>
  ),
};

// ─── Parameter slider ─────────────────────────────────────────────────────────

function ParamSlider({ label, value, min, max, step = 25, unit = 'mm', onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={styles.label}>{label}</span>
        <span style={styles.val}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#4F6EF7' }} />
    </div>
  );
}

// ─── Structural check row ─────────────────────────────────────────────────────

function CheckRow({ ok, warn, label, detail }) {
  const color = ok ? '#2ECC71' : warn ? '#F39C12' : '#E74C3C';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8,
      background: '#1E2130', borderRadius: 5, padding: '7px 10px' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%',
        background: color, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 11, color: '#E8EAF6' }}>{label}</div>
        <div style={{ fontSize: 9, color: '#5A6190' }}>{detail}</div>
      </div>
    </div>
  );
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────

export function SlabSidebar() {
  const {
    activeType, setActiveType,
    thickness, setThickness,
    ribSpacing, setRibSpacing,
    ribWidth, setRibWidth,
    cofferSize, setCofferSize,
    spanX, spanY, setSpanX, setSpanY,
    ffl, setFFL,
    imposedLoad, setImposedLoad,
    openings, addOpening, removeOpening,
    getStructuralCheck,
  } = useSlabStore();

  const { ld, sw } = getStructuralCheck();
  const span = Math.max(spanX, spanY);

  const isRibbed = ['ribbed', 'waffle'].includes(activeType);
  const isWaffle = activeType === 'waffle';

  return (
    <div style={styles.sidebar}>
      {/* Type selector */}
      <div style={styles.sectionHead}>
        <span style={styles.panelTitle}>Slab Type</span>
        <span style={styles.mat}>{SLAB_TYPES.find(t=>t.id===activeType)?.mat || 'RC'}</span>
      </div>

      <div style={styles.typeGrid}>
        {SLAB_TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveType(t.id)}
            style={{
              ...styles.typeCard,
              borderColor: activeType === t.id ? t.color : '#2D3050',
              background: activeType === t.id ? `${t.color}18` : '#1E2130',
            }}
          >
            <div style={{ marginBottom: 5 }}>{TYPE_ICONS[t.id]}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#E8EAF6' }}>{t.name}</div>
            <div style={{ fontSize: 9, color: '#5A6190', marginTop: 2 }}>{t.sub}</div>
          </button>
        ))}
      </div>

      {/* Parameters */}
      <Section title="Parameters">
        <ParamSlider label="Thickness" value={thickness} min={100} max={600} step={25}
          onChange={setThickness} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={styles.label}>Span X (mm)</div>
            <input style={styles.input} value={spanX}
              onChange={e => setSpanX(e.target.value)} type="number" />
          </div>
          <div>
            <div style={styles.label}>Span Y (mm)</div>
            <input style={styles.input} value={spanY}
              onChange={e => setSpanY(e.target.value)} type="number" />
          </div>
        </div>

        {isRibbed && (
          <ParamSlider label="Rib Spacing" value={ribSpacing} min={500} max={1200} step={50}
            onChange={setRibSpacing} />
        )}
        {isRibbed && (
          <ParamSlider label="Rib Width" value={ribWidth} min={100} max={300} step={25}
            onChange={setRibWidth} />
        )}
        {isWaffle && (
          <ParamSlider label="Coffer Size" value={cofferSize} min={400} max={900} step={50}
            onChange={setCofferSize} />
        )}

        <div>
          <div style={styles.label}>FFL Level (mm)</div>
          <input style={styles.input} value={ffl}
            onChange={e => setFFL(e.target.value)} type="number" />
        </div>

        <div>
          <div style={styles.label}>Imposed Load (kN/m²)</div>
          <input style={styles.input} value={imposedLoad}
            onChange={e => setImposedLoad(e.target.value)} type="number" step="0.5" />
        </div>
      </Section>

      {/* Structural check */}
      <Section title="Structural Check">
        <CheckRow
          ok={ld.ok} warn={ld.warn}
          label={`L/d = ${ld.actual}  (limit ${ld.ldLimit ?? ld.limit})`}
          detail={ld.ok ? `OK — min thickness ${ld.minThickness}mm` : `⚠ Increase thickness to ${ld.minThickness}mm`}
        />
        <CheckRow ok label={`Self-weight: ${sw} kN/m²`} detail="25 kN/m³ concrete density" />
        <CheckRow ok={thickness >= 100}
          label={`Fire: ${thickness >= 200 ? 'REI 240 ✓' : thickness >= 100 ? 'REI 120 ✓' : 'REI 60 – check'}`}
          detail="Based on slab thickness" />
        {!ld.ok && (
          <div style={styles.warnBox}>
            ⚠ L/d ratio {ld.actual} exceeds limit {ld.limit} for {SLAB_TYPES.find(t=>t.id===activeType)?.name}.
            Minimum thickness: {ld.minThickness}mm.
          </div>
        )}
      </Section>

      {/* Openings */}
      <Section title="Openings">
        <button style={styles.outlineBtn} onClick={() => addOpening()}>+ Add Opening</button>
        {openings.map(o => (
          <div key={o.id} style={styles.openingRow}>
            <span style={{ fontSize: 10, color: '#9AA3C8', fontFamily: 'monospace' }}>
              {Math.round(o.width)}×{Math.round(o.height)}mm
            </span>
            <button style={styles.delBtn} onClick={() => removeOpening(o.id)}>✕</button>
          </div>
        ))}
      </Section>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }) {
  const [open, setOpen] = React.useState(true);
  return (
    <div style={{ borderBottom: '1px solid #2D3050' }}>
      <div onClick={() => setOpen(o => !o)} style={styles.collapsibleHead}>
        <span style={styles.panelTitle}>{title}</span>
        <span style={{ fontSize: 10, color: '#5A6190' }}>{open ? '▼' : '▶'}</span>
      </div>
      {open && <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  sidebar: {
    background: '#171921',
    borderRight: '1px solid #2D3050',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Syne', sans-serif",
    color: '#E8EAF6',
  },
  sectionHead: {
    padding: '12px 16px',
    borderBottom: '1px solid #2D3050',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapsibleHead: {
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    userSelect: 'none',
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '.07em',
    textTransform: 'uppercase',
    color: '#9AA3C8',
  },
  mat: {
    background: 'rgba(46,204,113,.12)',
    border: '1px solid rgba(46,204,113,.3)',
    color: '#2ECC71',
    fontSize: 9,
    fontWeight: 700,
    padding: '1px 7px',
    borderRadius: 3,
  },
  typeGrid: {
    padding: 12,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  typeCard: {
    background: '#1E2130',
    border: '1px solid #2D3050',
    borderRadius: 6,
    padding: '10px 8px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all .15s',
  },
  label: {
    fontSize: 10,
    color: '#9AA3C8',
    fontWeight: 600,
    letterSpacing: '.05em',
    textTransform: 'uppercase',
  },
  val: {
    fontSize: 10,
    color: '#7B93FF',
    fontFamily: 'monospace',
  },
  input: {
    background: '#1E2130',
    border: '1px solid #2D3050',
    borderRadius: 4,
    color: '#E8EAF6',
    padding: '6px 10px',
    fontSize: 12,
    fontFamily: 'monospace',
    width: '100%',
    outline: 'none',
    marginTop: 4,
  },
  warnBox: {
    background: 'rgba(243,156,18,.08)',
    border: '1px solid rgba(243,156,18,.3)',
    borderRadius: 5,
    padding: '8px 10px',
    fontSize: 10,
    color: '#F39C12',
    lineHeight: 1.5,
  },
  outlineBtn: {
    background: 'transparent',
    border: '1px solid #3D4270',
    color: '#9AA3C8',
    borderRadius: 4,
    padding: '6px 12px',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: "'Syne', sans-serif",
  },
  openingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#1E2130',
    border: '1px solid #2D3050',
    borderRadius: 4,
    padding: '5px 8px',
  },
  delBtn: {
    background: 'transparent',
    border: 'none',
    color: '#5A6190',
    cursor: 'pointer',
    fontSize: 12,
    padding: '2px 5px',
  },
};

export default SlabSidebar;
