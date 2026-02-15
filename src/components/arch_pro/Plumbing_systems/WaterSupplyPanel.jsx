import React, { useState } from 'react';
import NumericField from './NumericField';
import SelectField from './SelectField';
import ToggleField from './ToggleField';

export default function WaterSupplyPanel({ isOpen, onClose, onGenerate, selectedElementId }) {
    const [system, setSystem] = useState('cold_water');
    const [pipeMaterial, setPipeMaterial] = useState('pex');
    const [diameter, setDiameter] = useState(25);
    const [pressureZone, setPressureZone] = useState('normal');
    const [valves, setValves] = useState({
        main: true,
        zone: false,
        fixtureGroup: false
    });
    const [heaterType, setHeaterType] = useState('tank');
    const [heaterCapacity, setHeaterCapacity] = useState(150);
    const [heaterLocation, setHeaterLocation] = useState('utility_room');

    const systems = [
        { value: 'cold_water', label: 'Cold Water' },
        { value: 'hot_water', label: 'Hot Water' },
        { value: 'recirculation', label: 'Recirculation' }
    ];

    const materials = [
        { value: 'pvc', label: 'PVC' },
        { value: 'pex', label: 'PEX' },
        { value: 'copper', label: 'Copper' }
    ];

    const diameters = [
        { value: 12, label: '12mm (1/2")' },
        { value: 15, label: '15mm (3/4")' },
        { value: 20, label: '20mm (1")' },
        { value: 25, label: '25mm (1-1/4")' },
        { value: 32, label: '32mm (1-1/2")' },
        { value: 40, label: '40mm (2")' }
    ];

    const pressureZones = [
        { value: 'low', label: 'Low Pressure' },
        { value: 'normal', label: 'Normal Pressure' },
        { value: 'boosted', label: 'Boosted' }
    ];

    const heaterTypes = [
        { value: 'tank', label: 'Tank Water Heater' },
        { value: 'instant', label: 'Instant/Tankless' }
    ];

    const locations = [
        { value: 'utility_room', label: 'Utility Room' },
        { value: 'basement', label: 'Basement' },
        { value: 'garage', label: 'Garage' },
        { value: 'exterior', label: 'Exterior' },
        { value: 'attic', label: 'Attic' }
    ];

    const handleValveToggle = (valveType) => {
        setValves({ ...valves, [valveType]: !valves[valveType] });
    };

    const handleGenerate = () => {
        const selectedValves = Object.keys(valves).filter(k => valves[k]);

        const payload = {
            category: 'plumbing_supply',
            system,
            pipeMaterial,
            diameter,
            pressureZone,
            valves: selectedValves,
            heater: {
                type: heaterType,
                capacity: heaterCapacity,
                location: heaterLocation
            }
        };
        onGenerate(payload);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed top-16 right-4 w-96 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col max-h-[calc(100vh-5rem)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">Water Supply System</h2>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">System Type</h3>
                    <SelectField
                        label="Water System"
                        value={system}
                        onChange={setSystem}
                        options={systems}
                    />
                </div>

                <div className="space-y-3 pt-3 border-t border-gray-200">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Pipe Configuration</h3>

                    <SelectField
                        label="Pipe Material"
                        value={pipeMaterial}
                        onChange={setPipeMaterial}
                        options={materials}
                    />

                    <SelectField
                        label="Pipe Diameter"
                        value={diameter}
                        onChange={(val) => setDiameter(parseInt(val))}
                        options={diameters}
                    />

                    <SelectField
                        label="Pressure Zone"
                        value={pressureZone}
                        onChange={setPressureZone}
                        options={pressureZones}
                    />
                </div>

                <div className="space-y-3 pt-3 border-t border-gray-200">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Isolation Valves</h3>

                    <ToggleField
                        label="Main Supply Valve"
                        value={valves.main}
                        onChange={() => handleValveToggle('main')}
                    />

                    <ToggleField
                        label="Zone Valves"
                        value={valves.zone}
                        onChange={() => handleValveToggle('zone')}
                    />

                    <ToggleField
                        label="Fixture Group Valves"
                        value={valves.fixtureGroup}
                        onChange={() => handleValveToggle('fixtureGroup')}
                    />
                </div>

                <div className="space-y-3 pt-3 border-t border-gray-200">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Water Heater</h3>

                    <SelectField
                        label="Heater Type"
                        value={heaterType}
                        onChange={setHeaterType}
                        options={heaterTypes}
                    />

                    <NumericField
                        label="Capacity"
                        value={heaterCapacity}
                        onChange={setHeaterCapacity}
                        min={10}
                        max={500}
                        step={10}
                        unit={heaterType === 'tank' ? 'L' : 'kW'}
                    />

                    <SelectField
                        label="Location"
                        value={heaterLocation}
                        onChange={setHeaterLocation}
                        options={locations}
                    />

                    <div className="px-3 py-2 bg-blue-50 rounded text-xs text-blue-700 border border-blue-200">
                        <div className="font-medium mb-1">Required Clearances</div>
                        <div>Front: 600mm, Sides: 150mm, Top: 450mm</div>
                    </div>
                </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-200">
                <button
                    onClick={handleGenerate}
                    className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                >
                    Configure Supply System
                </button>
            </div>
        </div>
    );
}