import React from 'react';
import { useStore } from '../../store/useStore';

export function PropertiesPanel() {
  const { selectedIds, elements, updateElement, removeElement, snapshot, selectedTool, toolOptions, setToolOptions } = useStore();

  const selected = elements.filter(e => selectedIds.includes(e.id));
  const el = selected[0] || null;

  if (!el) {
    return (
      <div className="flex-1 overflow-y-auto p-3">
        <PanelHeader title="Tool Options" />
        <ToolOptionsPanel tool={selectedTool} options={toolOptions} setOptions={setToolOptions} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3">
      <PanelHeader title="Properties" />

      <div className="space-y-3">
        {/* Type badge */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-[#4a6fa5]">Type</span>
          <span className="text-xs text-[#00d4ff] bg-[#00d4ff11] px-2 py-0.5 rounded font-mono">
            {el.type}{el.subType ? `/${el.subType}` : ''}
          </span>
        </div>

        <div className="text-[10px] text-[#3a4a60] font-mono truncate">{el.id}</div>

        <div className="border-t border-[#2a3144] pt-3 space-y-2">
          {/* Width */}
          {el.width !== undefined && (
            <PropRow label="Width (m)">
              <NumberInput
                value={el.width}
                min={0.5} max={50} step={0.5}
                onChange={v => { snapshot(); updateElement(el.id, { width: v }); }}
              />
            </PropRow>
          )}

          {/* Lanes */}
          {el.lanes !== undefined && (
            <PropRow label="Lanes">
              <SelectInput
                value={el.lanes}
                options={[1, 2, 3, 4].map(n => ({ value: n, label: String(n) }))}
                onChange={v => { snapshot(); updateElement(el.id, { lanes: Number(v) }); }}
              />
            </PropRow>
          )}

          {/* Material */}
          {el.material !== undefined && (
            <PropRow label="Material">
              <SelectInput
                value={el.material}
                options={MATERIAL_OPTIONS}
                onChange={v => { snapshot(); updateElement(el.id, { material: v }); }}
              />
            </PropRow>
          )}

          {/* Kerb */}
          {el.kerb !== undefined && (
            <PropRow label="Kerb">
              <SelectInput
                value={el.kerb}
                options={KERB_OPTIONS}
                onChange={v => { snapshot(); updateElement(el.id, { kerb: v }); }}
              />
            </PropRow>
          )}

          {/* Verge */}
          {el.verge !== undefined && (
            <PropRow label="Verge (m)">
              <NumberInput
                value={el.verge}
                min={0} max={5} step={0.25}
                onChange={v => { snapshot(); updateElement(el.id, { verge: v }); }}
              />
            </PropRow>
          )}

          {/* Markings toggles */}
          {el.markings !== undefined && (
            <div>
              <span className="text-[10px] uppercase tracking-widest text-[#4a6fa5] block mb-1">Markings</span>
              <div className="flex flex-wrap gap-1">
                {MARKING_OPTIONS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => {
                      snapshot();
                      const next = el.markings.includes(m.value)
                        ? el.markings.filter(x => x !== m.value)
                        : [...el.markings, m.value];
                      updateElement(el.id, { markings: next });
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded font-mono transition-all ${
                      el.markings.includes(m.value)
                        ? 'bg-[#00d4ff] text-[#0d1420]'
                        : 'border border-[#2a3144] text-[#4a6fa5] hover:border-[#00d4ff]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Parking specific */}
          {el.type === 'parking' && <ParkingProps el={el} updateElement={updateElement} snapshot={snapshot} />}

          {/* Tree specific */}
          {el.type === 'tree' && <TreeProps el={el} updateElement={updateElement} snapshot={snapshot} />}
        </div>

        {/* Path points */}
        {el.path && (
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[#4a6fa5] block mb-1">
              Path ({el.path.length} pts)
            </span>
            <div className="max-h-24 overflow-y-auto space-y-0.5">
              {el.path.map(([x, z], i) => (
                <div key={i} className="text-[10px] font-mono text-[#6080a0] flex gap-2">
                  <span className="text-[#3a4a60] w-4">{i}</span>
                  <span>x:{x.toFixed(1)}</span>
                  <span>z:{z.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delete */}
        <button
          onClick={() => removeElement(el.id)}
          className="w-full mt-2 py-1.5 text-xs font-mono text-red-400 border border-red-900 rounded hover:bg-red-900/20 transition-all"
        >
          ✕ Delete Element
        </button>
      </div>
    </div>
  );
}

// ── Sub-panels ────────────────────────────────────────────────────────────

function ParkingProps({ el, updateElement, snapshot }) {
  return (
    <>
      <PropRow label="Bay Angle">
        <SelectInput
          value={el.bayAngle}
          options={[45, 60, 90].map(n => ({ value: n, label: `${n}°` }))}
          onChange={v => { snapshot(); updateElement(el.id, { bayAngle: Number(v) }); }}
        />
      </PropRow>
      <PropRow label="Bay Width (m)">
        <NumberInput value={el.bayWidth} min={2} max={4} step={0.1}
          onChange={v => { snapshot(); updateElement(el.id, { bayWidth: v }); }} />
      </PropRow>
      <PropRow label="Bay Depth (m)">
        <NumberInput value={el.bayDepth} min={3} max={7} step={0.25}
          onChange={v => { snapshot(); updateElement(el.id, { bayDepth: v }); }} />
      </PropRow>
      <PropRow label="Aisle (m)">
        <NumberInput value={el.aisleWidth} min={4} max={9} step={0.5}
          onChange={v => { snapshot(); updateElement(el.id, { aisleWidth: v }); }} />
      </PropRow>
      <PropRow label="Rows">
        <NumberInput value={el.rows} min={1} max={10} step={1}
          onChange={v => { snapshot(); updateElement(el.id, { rows: v }); }} />
      </PropRow>
      <div className="text-[10px] text-[#00ff88] font-mono">
        Total bays: {(el.rows || 1) * (el.baysPerRow || 1)}
      </div>
    </>
  );
}

function TreeProps({ el, updateElement, snapshot }) {
  return (
    <>
      <PropRow label="Species">
        <SelectInput
          value={el.species}
          options={[
            { value: 'deciduous', label: 'Deciduous' },
            { value: 'conifer', label: 'Conifer' },
            { value: 'palm', label: 'Palm' },
            { value: 'shrub', label: 'Shrub' },
          ]}
          onChange={v => { snapshot(); updateElement(el.id, { species: v }); }}
        />
      </PropRow>
      <PropRow label="Scale">
        <NumberInput value={el.scale || 1} min={0.1} max={5} step={0.1}
          onChange={v => { snapshot(); updateElement(el.id, { scale: v }); }} />
      </PropRow>
    </>
  );
}

function ToolOptionsPanel({ tool, options, setOptions }) {
  if (!tool) return null;
  return (
    <div className="space-y-2 mt-2">
      <div className="text-[10px] text-[#4a6fa5] font-mono uppercase tracking-widest">{tool}</div>
      {options?.width !== undefined && (
        <PropRow label="Width (m)">
          <NumberInput value={options.width} min={0.5} max={50} step={0.5}
            onChange={v => setOptions({ width: v })} />
        </PropRow>
      )}
      {options?.material !== undefined && (
        <PropRow label="Material">
          <SelectInput value={options.material} options={MATERIAL_OPTIONS}
            onChange={v => setOptions({ material: v })} />
        </PropRow>
      )}
      {options?.kerb !== undefined && (
        <PropRow label="Kerb">
          <SelectInput value={options.kerb} options={KERB_OPTIONS}
            onChange={v => setOptions({ kerb: v })} />
        </PropRow>
      )}
      {options?.bayAngle !== undefined && (
        <PropRow label="Bay Angle">
          <SelectInput value={options.bayAngle}
            options={[45, 60, 90].map(n => ({ value: n, label: `${n}°` }))}
            onChange={v => setOptions({ bayAngle: Number(v) })} />
        </PropRow>
      )}
    </div>
  );
}

// ── Shared UI Atoms ───────────────────────────────────────────────────────

function PanelHeader({ title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-3 bg-[#00d4ff] rounded-full" />
      <span className="text-[11px] font-bold text-[#a0b4d0] uppercase tracking-widest font-mono">{title}</span>
    </div>
  );
}

function PropRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-[#4a6fa5] font-mono flex-shrink-0">{label}</span>
      {children}
    </div>
  );
}

function NumberInput({ value, min, max, step, onChange }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="w-20 bg-[#0d1420] border border-[#2a3144] rounded px-2 py-0.5
        text-xs text-[#a0c4e0] font-mono text-right
        focus:outline-none focus:border-[#00d4ff] transition-colors"
    />
  );
}

function SelectInput({ value, options, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-[#0d1420] border border-[#2a3144] rounded px-1 py-0.5
        text-[10px] text-[#a0c4e0] font-mono
        focus:outline-none focus:border-[#00d4ff] transition-colors"
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────

const MATERIAL_OPTIONS = [
  { value: 'asphalt', label: 'Asphalt' },
  { value: 'concrete', label: 'Concrete' },
  { value: 'block_paving', label: 'Block Paving' },
  { value: 'gravel', label: 'Gravel' },
  { value: 'paving', label: 'Slab Paving' },
];

const KERB_OPTIONS = [
  { value: 'upstand', label: 'Upstand' },
  { value: 'flush', label: 'Flush' },
  { value: 'dropped', label: 'Dropped (DDA)' },
  { value: 'splayed', label: 'Splayed' },
  { value: 'none', label: 'None' },
];

const MARKING_OPTIONS = [
  { value: 'centre', label: 'CL' },
  { value: 'edge', label: 'Edge' },
  { value: 'double_yellow', label: 'DY' },
  { value: 'stop_line', label: 'Stop' },
  { value: 'hatching', label: 'Hatch' },
  { value: 'arrows', label: 'Arrows' },
];