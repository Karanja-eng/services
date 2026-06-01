// ─────────────────────────────────────────────────────────────
//  StructureControlPanel.jsx
//  Left panel UI — element type picker, truss subtype grid,
//  span/pitch/spacing sliders, material toggle, vis toggles.
//  Fully controlled — all state via props + callbacks.
//
//  Props:
//    state         object  (from useRoofStructure hook)
//    derived       object  (computed values)
//    onSet         fn(patch)
//    onSetElement  fn(element)
//    onSetSpan     fn(span)
//    onToggleVis   fn(key)
// ─────────────────────────────────────────────────────────────

import React from 'react';
import {
  TRUSS_TYPES,
  RAFTER_SUBTYPES,
  PORTAL_SUBTYPES,
  VIS_KEYS,
} from '../../constants/roofStructureTypes.js';

// ── Small reusable sub-components ────────────────────────────

function PanelTitle({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '0.07em',
      textTransform: 'uppercase', color: 'var(--color-text-secondary)',
      padding: '12px 13px 6px',
      borderBottom: '0.5px solid var(--color-border-tertiary)',
    }}>
      {children}
    </div>
  );
}

function Section({ children }) {
  return (
    <div style={{ padding: '10px 13px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginBottom: 5, fontWeight: 500 }}>
      {children}
    </div>
  );
}

function SliderRow({ label, min, max, step, value, format, onChange }) {
  return (
    <>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: '#2563EB' }}
        />
        <span style={{ fontSize: 11, fontWeight: 600, minWidth: 44, textAlign: 'right', color: '#2563EB' }}>
          {format(value)}
        </span>
      </div>
    </>
  );
}

function Toggle({ on, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 28, height: 16,
        background: on ? '#2563EB' : 'var(--color-border-secondary, rgba(0,0,0,0.22))',
        borderRadius: 8, cursor: 'pointer', position: 'relative',
        transition: 'background 0.15s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', width: 12, height: 12, background: '#fff',
        borderRadius: '50%', top: 2, left: on ? 14 : 2, transition: 'left 0.15s',
      }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function StructureControlPanel({
  state,
  derived,
  onSet,
  onSetElement,
  onSetSpan,
  onToggleVis,
}) {
  const { element, subType, span, pitch, spacing, bays,
          material, eaveHeight, baseType, visibility } = state;

  // Pick subtype grid items based on element
  const subtypeItems =
    element === 'truss'  ? TRUSS_TYPES :
    element === 'rafters' ? RAFTER_SUBTYPES :
    PORTAL_SUBTYPES;

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      borderRight: '0.5px solid var(--color-border-tertiary)',
      overflowY: 'auto', display: 'flex', flexDirection: 'column',
    }}>
      {/* ── Element type ─────────────────────────────── */}
      <PanelTitle>Structural Type</PanelTitle>
      <Section>
        <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
          {[
            { id: 'truss',   label: 'Truss'   },
            { id: 'rafters', label: 'Rafters' },
            { id: 'portal',  label: 'Portal'  },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => onSetElement(id)}
              style={{
                flex: 1, padding: '5px 0',
                background: element === id ? '#2563EB' : 'none',
                color:      element === id ? '#fff'    : 'inherit',
                border:     `0.5px solid ${element === id ? '#2563EB' : 'var(--color-border-tertiary)'}`,
                borderRadius: 5, fontSize: 10, cursor: 'pointer', transition: 'all .12s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Subtype grid ───────────────────────── */}
        <SectionLabel>{element === 'truss' ? 'Truss Type' : element === 'portal' ? 'Base Type' : 'Framing Type'}</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          {subtypeItems.map(({ id, label, ico }) => (
            <button
              key={id}
              onClick={() => onSet({ subType: id })}
              style={{
                padding: '5px 3px', textAlign: 'center', lineHeight: 1.3,
                background: subType === id ? '#2563EB' : 'none',
                color:      subType === id ? '#fff'    : 'var(--color-text-secondary)',
                border:     `0.5px solid ${subType === id ? '#2563EB' : 'var(--color-border-tertiary)'}`,
                borderRadius: 6, fontSize: 10, cursor: 'pointer', transition: 'all .12s',
              }}
            >
              <span style={{ fontSize: 14, display: 'block', marginBottom: 1 }}>{ico}</span>
              {label}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Dimensions ───────────────────────────────── */}
      <Section>
        <SliderRow
          label="Span" min={3} max={20} step={0.5} value={span}
          format={v => `${Number(v).toFixed(1)} m`}
          onChange={v => onSetSpan(v)}
        />
        <SliderRow
          label="Pitch" min={10} max={55} step={1} value={pitch}
          format={v => `${v}°`}
          onChange={v => onSet({ pitch: v })}
        />
        <SliderRow
          label={element === 'portal' ? 'Bay spacing' : 'Truss / rafter spacing'} 
          min={400} max={1200} step={50} value={Math.round(spacing * 1000)}
          format={v => `${v} mm`}
          onChange={v => onSet({ spacing: v / 1000 })}
        />
        <SliderRow
          label="Bay / truss count" min={2} max={12} step={1} value={bays}
          format={v => `${v}`}
          onChange={v => onSet({ bays: v })}
        />
        {element === 'portal' && (
          <SliderRow
            label="Eave height" min={2.5} max={8} step={0.1} value={eaveHeight}
            format={v => `${Number(v).toFixed(1)} m`}
            onChange={v => onSet({ eaveHeight: v })}
          />
        )}
      </Section>

      {/* ── Material ─────────────────────────────────── */}
      <Section>
        <SectionLabel>Material</SectionLabel>
        <div style={{ display: 'flex', gap: 4 }}>
          {['timber', 'steel'].map(m => (
            <button
              key={m}
              onClick={() => onSet({ material: m })}
              style={{
                flex: 1, padding: '5px 0',
                background: material === m ? '#2563EB' : 'none',
                color:      material === m ? '#fff'    : 'inherit',
                border:     `0.5px solid ${material === m ? '#2563EB' : 'var(--color-border-tertiary)'}`,
                borderRadius: 5, fontSize: 10, cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Visibility ───────────────────────────────── */}
      <Section>
        <SectionLabel>Visibility</SectionLabel>
        {Object.entries(VIS_KEYS).map(([key, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' }}>
            <span style={{ fontSize: 11 }}>{label}</span>
            <Toggle on={!!visibility[key]} onClick={() => onToggleVis(key)} />
          </div>
        ))}
      </Section>

      {/* ── Derived stats ────────────────────────────── */}
      <Section>
        <SectionLabel>Computed</SectionLabel>
        {[
          ['Rise',       `${derived.rise.toFixed(2)} m`],
          ['Slope len.', `${derived.slopeLen.toFixed(2)} m`],
          ['Roof area',  `${derived.roofArea.toFixed(1)} m²`],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '2px 0' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>{k}</span>
            <span style={{ fontWeight: 500 }}>{v}</span>
          </div>
        ))}
      </Section>
    </div>
  );
}
