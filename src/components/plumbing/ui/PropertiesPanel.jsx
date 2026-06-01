import React from 'react';
import { usePlumbingStore } from '../stores/plumbingStore';
import { validatePlumbingCompliance, estimateWaterConsumption } from '../engine/complianceEngine';

const SYSTEM_OPTIONS = ['CWS', 'HWS', 'HWR', 'SVP', 'WASTE', 'OVERFLOW', 'RWP', 'GREY', 'GAS'];
const MATERIAL_OPTIONS = ['Copper', 'CPVC', 'uPVC', 'MDPE', 'PEX', 'PPR', 'Galvanised Steel', 'Cast Iron', 'HDPE'];
const SIZE_OPTIONS = [15, 20, 22, 25, 28, 32, 40, 42, 50, 54, 63, 110, 160, 200];

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[10px] text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function NumberInput({ value, onChange, step = 1, min, max }) {
  return (
    <input
      type="number"
      className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
      value={value}
      step={step}
      min={min}
      max={max}
      onChange={e => onChange(parseFloat(e.target.value))}
    />
  );
}

function Toggle({ value, onChange, label }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
        value ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
      }`}
    >
      {label}: {value ? 'ON' : 'OFF'}
    </button>
  );
}

export default function PropertiesPanel() {
  const {
    selectedElementId,
    plumbingElements,
    pipeRoutes,
    updateElement,
    deleteElement,
    setSelectedElementId,
  } = usePlumbingStore();

  const selectedElement = selectedElementId
    ? (plumbingElements[selectedElementId] || pipeRoutes[selectedElementId])
    : null;

  const isPipe = selectedElement && selectedElement.points !== undefined;

  const update = (field, value) => {
    updateElement(selectedElementId, { [field]: value });
  };
  const updateConfig = (field, value) => {
    updateElement(selectedElementId, { config: { ...selectedElement.config, [field]: value } });
  };

  // Compliance check result (run on demand)
  const [violations, setViolations] = React.useState(null);
  const [demand, setDemand] = React.useState(null);

  const handleComplianceCheck = () => {
    setViolations(validatePlumbingCompliance());
    setDemand(estimateWaterConsumption());
  };

  return (
    <div className="w-72 h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col z-10 shrink-0 shadow-sm">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Properties</h2>
        {selectedElementId && (
          <button
            onClick={() => { deleteElement(selectedElementId); setSelectedElementId(null); }}
            className="text-[10px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900 px-2 py-1 rounded"
          >
            Delete
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {!selectedElement && (
          <p className="text-xs text-gray-400 italic">Click an element to inspect its properties.</p>
        )}

        {selectedElement && !isPipe && (
          <>
            <Field label="Type"><p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{selectedElement.subType}</p></Field>
            <Field label="Category"><p className="text-xs text-gray-600 dark:text-gray-400">{selectedElement.category}</p></Field>

            {/* Fixture-specific */}
            {selectedElement.category === 'fixture' && (
              <>
                <Field label="Material">
                  <Select
                    value={selectedElement.config?.material || 'Ceramic'}
                    onChange={v => updateConfig('material', v)}
                    options={['Ceramic', 'Acrylic', 'Cast Iron', 'Stainless Steel', 'Stone Resin', 'Tiled']}
                  />
                </Field>
                <Field label="Height AFF (m)">
                  <NumberInput value={selectedElement.position?.y || 0} step={0.05} onChange={v => update('position', { ...selectedElement.position, y: v })} />
                </Field>
              </>
            )}

            {/* Valve-specific */}
            {selectedElement.category === 'valve' && (
              <>
                <Field label="State">
                  <Toggle value={selectedElement.config?.isOpen !== false} label="Open" onChange={v => updateConfig('isOpen', v)} />
                </Field>
                {selectedElement.subType === 'TMV' && (
                  <Field label="Set Temperature (°C)">
                    <NumberInput value={selectedElement.config?.setTemp || 43} min={38} max={60} onChange={v => updateConfig('setTemp', v)} />
                  </Field>
                )}
              </>
            )}

            {/* Vessel-specific */}
            {selectedElement.category === 'vessel' && (
              <Field label="Capacity (L)">
                <NumberInput value={selectedElement.config?.capacity || 100} min={50} step={50} onChange={v => updateConfig('capacity', v)} />
              </Field>
            )}

            {/* Position */}
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Position (m)</p>
              <div className="grid grid-cols-3 gap-1">
                {['x', 'y', 'z'].map(axis => (
                  <div key={axis}>
                    <label className="text-[9px] text-gray-400 uppercase">{axis}</label>
                    <NumberInput
                      value={selectedElement.position?.[axis] || 0}
                      step={0.1}
                      onChange={v => update('position', { ...selectedElement.position, [axis]: v })}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {selectedElement && isPipe && (
          <>
            <Field label="System">
              <Select value={selectedElement.system || 'CWS'} onChange={v => update('system', v)} options={SYSTEM_OPTIONS} />
            </Field>
            <Field label="Material">
              <Select value={selectedElement.material || 'Copper'} onChange={v => update('material', v)} options={MATERIAL_OPTIONS} />
            </Field>
            <Field label="Bore Size (mm)">
              <Select value={selectedElement.size || 22} onChange={v => update('size', parseInt(v))} options={SIZE_OPTIONS} />
            </Field>
            <Field label="Gradient (1:X) — drainage only">
              <NumberInput value={selectedElement.gradient || ''} min={1} step={1} onChange={v => update('gradient', v)} />
            </Field>
            <Field label="Insulated">
              <Toggle value={selectedElement.insulated || false} label="Insulation" onChange={v => update('insulated', v)} />
            </Field>
          </>
        )}

        {/* Divider */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
          <button
            onClick={handleComplianceCheck}
            className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded shadow-sm"
          >
            Run Compliance Check
          </button>
        </div>

        {/* Violations */}
        {violations !== null && (
          <div className="space-y-2">
            {violations.length === 0 ? (
              <div className="p-2 bg-green-50 dark:bg-green-900 rounded border border-green-200 dark:border-green-700 text-xs text-green-700 dark:text-green-300">
                ✅ No violations found
              </div>
            ) : (
              violations.map((v, i) => (
                <div
                  key={i}
                  className={`p-2 rounded border text-[10px] leading-tight ${
                    v.severity === 'CRITICAL'
                      ? 'bg-red-50 border-red-300 dark:bg-red-950 dark:border-red-700 text-red-700 dark:text-red-300'
                      : v.severity === 'HIGH'
                        ? 'bg-orange-50 border-orange-300 dark:bg-orange-950 dark:border-orange-700 text-orange-700 dark:text-orange-300'
                        : 'bg-yellow-50 border-yellow-300 dark:bg-yellow-950 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300'
                  }`}
                >
                  <span className="font-bold">[{v.severity}]</span> {v.message}
                </div>
              ))
            )}
            {demand !== null && (
              <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-700 text-[10px] text-blue-700 dark:text-blue-300">
                💧 Estimated daily demand: <strong>{demand} L/day</strong>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
