import React from 'react';
import { useAnnotationStore } from '../stores/annotationStore';
import { ARROWHEAD_STYLES, UNIT_TYPES } from '../utils/constants';

function PanelSection({ title, children }) {
  return (
    <div className="border-b border-[#1a1a3a]">
      <div className="px-3 py-1.5 text-[#2a4a6a] text-[8px] tracking-widest uppercase font-bold bg-[#070712]">
        {title}
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[#4a4a7a] text-[10px] shrink-0">{label}</span>
      {children}
    </div>
  );
}

function Sel({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-[#0f0f20] border border-[#2a2a4a] text-[#6a8ab0] text-[10px] px-1.5 py-0.5 rounded outline-none focus:border-[#4a9eff] w-24"
    >
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  );
}

function Num({ value, onChange, min, max, step = 1 }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      min={min} max={max} step={step}
      className="bg-[#0f0f20] border border-[#2a2a4a] text-[#6a8ab0] text-[10px] px-1.5 py-0.5 rounded outline-none focus:border-[#4a9eff] w-16 text-right"
    />
  );
}

function ColorPick({ label, value, onChange }) {
  return (
    <Row label={label}>
      <label className="flex items-center gap-1.5 cursor-pointer">
        <div className="w-4 h-4 rounded border border-[#2a2a4a] shrink-0" style={{ background: value }} />
        <span className="text-[#3a3a6a] text-[9px] font-mono">{value}</span>
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="opacity-0 absolute w-0 h-0" />
      </label>
    </Row>
  );
}

const PRESETS = [
  { label: 'Arch', style: { arrowhead: 'slash', unit: 'mm', precision: 0, dimColor: '#4a9eff' } },
  { label: 'Civil', style: { arrowhead: 'arrow', unit: 'm', precision: 3, dimColor: '#ff9f43' } },
  { label: 'Struct', style: { arrowhead: 'dot', unit: 'mm', precision: 0, dimColor: '#ff6b6b' } },
  { label: 'Imper', style: { arrowhead: 'arrow', unit: 'ft', precision: 0, dimColor: '#a29bfe' } },
];

export function StylePanel() {
  const { activeStyle, setActiveStyle, clearAll } = useAnnotationStore();

  return (
    <div className="text-[#c0c8e8] overflow-y-auto">
      <PanelSection title="Dim Style">
        <Row label="Arrow">
          <Sel value={activeStyle.arrowhead} onChange={v => setActiveStyle({ arrowhead: v })}
            options={ARROWHEAD_STYLES.map(s => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} />
        </Row>
        <Row label="Unit">
          <Sel value={activeStyle.unit} onChange={v => setActiveStyle({ unit: v })}
            options={UNIT_TYPES} />
        </Row>
        <Row label="Precision">
          <Num value={activeStyle.precision} onChange={v => setActiveStyle({ precision: v })} min={0} max={4} />
        </Row>
        <Row label="Offset">
          <Num value={activeStyle.dimOffset} onChange={v => setActiveStyle({ dimOffset: v })} min={10} max={150} />
        </Row>
      </PanelSection>

      <PanelSection title="Layer Colors">
        <ColorPick label="Dims" value={activeStyle.dimColor} onChange={v => setActiveStyle({ dimColor: v })} />
        <ColorPick label="Notes" value={activeStyle.annotationColor} onChange={v => setActiveStyle({ annotationColor: v })} />
        <ColorPick label="Grids" value={activeStyle.gridColor} onChange={v => setActiveStyle({ gridColor: v })} />
      </PanelSection>

      <PanelSection title="Ext Lines">
        <Row label="Gap">
          <Num value={activeStyle.extGap} onChange={v => setActiveStyle({ extGap: v })} min={0} max={20} />
        </Row>
        <Row label="Overhang">
          <Num value={activeStyle.extOverhang} onChange={v => setActiveStyle({ extOverhang: v })} min={0} max={20} />
        </Row>
      </PanelSection>

      <PanelSection title="Presets">
        <div className="grid grid-cols-2 gap-1">
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => setActiveStyle(p.style)}
              className="text-[9px] text-[#4a5580] border border-[#2a2a4a] rounded px-1.5 py-1 hover:border-[#4a9eff] hover:text-[#4a9eff] transition-colors">
              {p.label}
            </button>
          ))}
        </div>
      </PanelSection>

      <div className="p-3">
        <button onClick={clearAll}
          className="w-full text-[9px] text-[#6a2a2a] border border-[#3a1a1a] rounded px-2 py-1.5 hover:border-[#ff6b6b] hover:text-[#ff6b6b] transition-colors">
          Clear All Annotations
        </button>
      </div>
    </div>
  );
}
