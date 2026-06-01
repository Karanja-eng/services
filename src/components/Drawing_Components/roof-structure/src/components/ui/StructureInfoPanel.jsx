// ─────────────────────────────────────────────────────────────
//  StructureInfoPanel.jsx
//  Right sidebar — stat cards, member schedule, truss info,
//  AI JSON spec editor with Apply button.
//
//  Props:
//    state          object  (from useRoofStructure)
//    derived        object  (computed values)
//    onApplyJSON    fn(jsonStr) → void
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  memberSchedule,
  TRUSS_INFO,
  TRUSS_TYPES,
  autoSelectTruss,
} from '../../constants/roofStructureTypes.js';

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
  return <div style={{ padding: '10px 13px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>{children}</div>;
}

export default function StructureInfoPanel({ state, derived, onApplyJSON }) {
  const { element, subType, span, pitch, bays, spacing, material, eaveHeight, baseType } = state;
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');

  // Sync json text when state changes (external updates)
  useEffect(() => {
    const spec = {
      elementType:   element,
      subType,
      span,
      pitch,
      spacing:       Math.round(spacing * 1000),
      bays,
      material,
      eaveHeight,
      baseType,
      visibility:    state.visibility,
    };
    setJsonText(JSON.stringify(spec, null, 2));
    setJsonError('');
  }, [element, subType, span, pitch, spacing, bays, material, eaveHeight, baseType]);

  const handleApply = () => {
    setJsonError('');
    try {
      JSON.parse(jsonText); // validate
      onApplyJSON(jsonText);
    } catch (e) {
      setJsonError('Invalid JSON: ' + e.message);
    }
  };

  const schedule = memberSchedule({ element, subType, span, pitch, bays, spacing, material });

  const infoText =
    element === 'truss'  ? (TRUSS_INFO[subType] || '') :
    element === 'portal' ?
      `Steel portal frame: moment-resisting frame for industrial clear-span buildings ${baseType === 'fixed' ? '(fixed base)' : '(pinned base)'}. Haunch connection transfers moment at knee.` :
      'Traditional cut-rafter roof: ridge beam, common rafters at regular spacing, purlins supporting rafter mid-span, collar ties preventing rafter spread. Habitable roof space accessible.';

  const autoType = element === 'truss' ? autoSelectTruss(span) : null;
  const autoTypeLabel = autoType ? TRUSS_TYPES.find(t => t.id === autoType)?.label : null;

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      borderLeft: '0.5px solid var(--color-border-tertiary)',
      overflowY: 'auto', display: 'flex', flexDirection: 'column',
    }}>
      {/* ── Stat cards ─────────────────────────────── */}
      <PanelTitle>Properties</PanelTitle>
      <Section>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          {[
            ['Roof area',    `${derived.roofArea.toFixed(1)}`,  'm²'],
            ['Ridge height', `${derived.rise.toFixed(2)}`,      'm' ],
            ['Slope length', `${derived.slopeLen.toFixed(2)}`,  'm' ],
            ['Truss count',  `${bays}`,                         'no.'],
          ].map(([label, value, unit]) => (
            <div key={label} style={{
              background: 'var(--color-background-secondary)', borderRadius: 7, padding: '8px 10px',
            }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginBottom: 2, fontWeight: 500 }}>
                {label}
              </div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>
                {value}<span style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginLeft: 3 }}>{unit}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Member schedule ─────────────────────────── */}
      <PanelTitle>Member Schedule</PanelTitle>
      <Section>
        {schedule.map(({ key, label, count, length, color }) => (
          <div key={key + label} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '2px 0', fontSize: 11, lineHeight: 1.8,
            borderBottom: '0.5px solid var(--color-border-tertiary)',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{label}</span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: 10 }}>
              {count}× {length}
            </span>
          </div>
        ))}
      </Section>

      {/* ── Truss info ──────────────────────────────── */}
      <PanelTitle>Structural Info</PanelTitle>
      <Section>
        <p style={{ fontSize: 10, lineHeight: 1.7, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
          {infoText}
        </p>
        {[
          autoTypeLabel ? ['AI auto-select', autoTypeLabel] : null,
          ['Span',       `${span.toFixed(1)} m`],
          ['Pitch',      `${pitch}°`],
          ['Spacing',    `${Math.round(spacing * 1000)} mm`],
          ['Material',   material.charAt(0).toUpperCase() + material.slice(1)],
          element === 'portal' ? ['Eave height', `${eaveHeight.toFixed(1)} m`] : null,
          element === 'portal' ? ['Base type',   baseType]                     : null,
        ].filter(Boolean).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '2px 0' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>{k}</span>
            <span style={{ fontWeight: 500, color: k === 'AI auto-select' ? '#2563EB' : 'inherit' }}>{v}</span>
          </div>
        ))}
      </Section>

      {/* ── AI JSON spec ────────────────────────────── */}
      <PanelTitle>AI Spec (JSON)</PanelTitle>
      <Section>
        <textarea
          value={jsonText}
          onChange={e => { setJsonText(e.target.value); setJsonError(''); }}
          rows={10}
          style={{
            width: '100%', fontFamily: 'monospace', fontSize: 9.5,
            border: `0.5px solid ${jsonError ? 'var(--color-border-danger)' : 'var(--color-border-tertiary)'}`,
            borderRadius: 5, padding: 7, resize: 'vertical',
            background: 'var(--color-background-secondary)',
            color: 'inherit', lineHeight: 1.5,
          }}
        />
        {jsonError && (
          <p style={{ fontSize: 10, color: 'var(--color-text-danger)', marginTop: 3 }}>{jsonError}</p>
        )}
        <button
          onClick={handleApply}
          style={{
            width: '100%', padding: 7, marginTop: 6,
            background: '#2563EB', color: '#fff',
            border: 'none', borderRadius: 5, fontSize: 11,
            cursor: 'pointer', fontWeight: 500,
          }}
        >
          Apply Spec
        </button>
      </Section>
    </div>
  );
}
