import React, { useState } from 'react';
import NumericField from './NumericField';
import SelectField from './SelectField';
import Vector3Field from './Vector3field';
import ToggleField from './ToggleField';

export default function PlumbingFixturesPanel({ isOpen, onClose, onGenerate, selectedElementId }) {
    const [fixtureType, setFixtureType] = useState('wc');
    const [mountingHeight, setMountingHeight] = useState(0.4);
    const [rotation, setRotation] = useState([0, 0, 0]);
    const [hotWater, setHotWater] = useState(false);
    const [coldWater, setColdWater] = useState(true);
    const [wasteDiameter, setWasteDiameter] = useState(110);
    const [trap, setTrap] = useState('p-trap');
    const [ventRequired, setVentRequired] = useState(true);

    const fixtureTypes = [
        { value: 'wc', label: 'Water Closet (WC)' },
        { value: 'wash_basin', label: 'Wash Basin' },
        { value: 'kitchen_sink', label: 'Kitchen Sink' },
        { value: 'shower', label: 'Shower' },
        { value: 'bathtub', label: 'Bathtub' },
        { value: 'urinal', label: 'Urinal' },
        { value: 'bidet', label: 'Bidet' },
        { value: 'washing_machine', label: 'Washing Machine' },
        { value: 'dishwasher', label: 'Dishwasher' },
        { value: 'floor_drain', label: 'Floor Drain' },
        { value: 'external_tap', label: 'External Tap' }
    ];

    const trapTypes = [
        { value: 'p-trap', label: 'P-Trap' },
        { value: 's-trap', label: 'S-Trap' },
        { value: 'bottle-trap', label: 'Bottle Trap' },
        { value: 'none', label: 'None' }
    ];

    const wasteDiameters = [
        { value: 32, label: '32mm (1-1/4")' },
        { value: 40, label: '40mm (1-1/2")' },
        { value: 50, label: '50mm (2")' },
        { value: 75, label: '75mm (3")' },
        { value: 110, label: '110mm (4")' }
    ];

    const fixtureDefaults = {
        wc: { mountingHeight: 0.4, wasteDiameter: 110, trap: 'p-trap', ventRequired: true, hotWater: false, coldWater: true },
        wash_basin: { mountingHeight: 0.85, wasteDiameter: 40, trap: 'p-trap', ventRequired: false, hotWater: true, coldWater: true },
        kitchen_sink: { mountingHeight: 0.9, wasteDiameter: 50, trap: 'p-trap', ventRequired: false, hotWater: true, coldWater: true },
        shower: { mountingHeight: 0, wasteDiameter: 50, trap: 'p-trap', ventRequired: false, hotWater: true, coldWater: true },
        bathtub: { mountingHeight: 0, wasteDiameter: 50, trap: 'p-trap', ventRequired: false, hotWater: true, coldWater: true },
        urinal: { mountingHeight: 0.6, wasteDiameter: 50, trap: 'p-trap', ventRequired: false, hotWater: false, coldWater: true },
        bidet: { mountingHeight: 0.4, wasteDiameter: 40, trap: 'p-trap', ventRequired: false, hotWater: true, coldWater: true },
        washing_machine: { mountingHeight: 0, wasteDiameter: 50, trap: 'p-trap', ventRequired: false, hotWater: true, coldWater: true },
        dishwasher: { mountingHeight: 0, wasteDiameter: 40, trap: 'none', ventRequired: false, hotWater: true, coldWater: false },
        floor_drain: { mountingHeight: 0, wasteDiameter: 50, trap: 'p-trap', ventRequired: false, hotWater: false, coldWater: false },
        external_tap: { mountingHeight: 0.6, wasteDiameter: 0, trap: 'none', ventRequired: false, hotWater: false, coldWater: true }
    };

    const clearanceData = {
        wc: 'Front: 600mm, Sides: 300mm',
        wash_basin: 'Front: 600mm, Sides: 200mm',
        kitchen_sink: 'Front: 800mm, Sides: 300mm',
        shower: 'Front: 300mm, Enclosure: 900×900mm',
        bathtub: 'Front: 600mm, Sides: 300mm',
        urinal: 'Front: 600mm, Sides: 200mm',
        bidet: 'Front: 600mm, Sides: 300mm',
        washing_machine: 'Front: 800mm, Sides: 50mm',
        dishwasher: 'Front: 600mm, Sides: 50mm',
        floor_drain: 'All sides: 300mm',
        external_tap: 'Front: 300mm, Sides: 150mm'
    };

    const handleFixtureTypeChange = (type) => {
        setFixtureType(type);
        const defaults = fixtureDefaults[type];
        setMountingHeight(defaults.mountingHeight);
        setWasteDiameter(defaults.wasteDiameter);
        setTrap(defaults.trap);
        setVentRequired(defaults.ventRequired);
        setHotWater(defaults.hotWater);
        setColdWater(defaults.coldWater);
    };

    const handleGenerate = () => {
        const payload = {
            category: 'plumbing_fixture',
            fixtureType,
            mountingHeight,
            rotation,
            hotWater,
            coldWater,
            wasteDiameter,
            trap,
            ventRequired
        };
        onGenerate(payload);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed top-16 right-4 w-96 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col max-h-[calc(100vh-5rem)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">Plumbing Fixtures</h2>
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
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Fixture Library</h3>
                    <SelectField
                        label="Fixture Type"
                        value={fixtureType}
                        onChange={handleFixtureTypeChange}
                        options={fixtureTypes}
                    />
                </div>

                <div className="space-y-3 pt-3 border-t border-gray-200">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Configuration</h3>

                    <NumericField
                        label="Mounting Height"
                        value={mountingHeight}
                        onChange={setMountingHeight}
                        min={0}
                        max={3}
                        step={0.01}
                        unit="m"
                    />

                    <Vector3Field
                        label="Rotation"
                        value={rotation}
                        onChange={setRotation}
                        step={15}
                        unit="°"
                    />
                </div>

                <div className="space-y-3 pt-3 border-t border-gray-200">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Water Connections</h3>

                    <ToggleField
                        label="Hot Water Required"
                        value={hotWater}
                        onChange={setHotWater}
                    />

                    <ToggleField
                        label="Cold Water Required"
                        value={coldWater}
                        onChange={setColdWater}
                    />
                </div>

                <div className="space-y-3 pt-3 border-t border-gray-200">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Drainage</h3>

                    <SelectField
                        label="Waste Outlet Diameter"
                        value={wasteDiameter}
                        onChange={(val) => setWasteDiameter(parseInt(val))}
                        options={wasteDiameters}
                    />

                    <SelectField
                        label="Trap Type"
                        value={trap}
                        onChange={setTrap}
                        options={trapTypes}
                    />

                    <ToggleField
                        label="Vent Required"
                        value={ventRequired}
                        onChange={setVentRequired}
                    />
                </div>

                <div className="space-y-2 pt-3 border-t border-gray-200">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Clearance Envelope</h3>
                    <div className="px-3 py-2 bg-gray-50 rounded text-xs text-gray-600 border border-gray-200">
                        {clearanceData[fixtureType]}
                    </div>
                </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-200">
                <button
                    onClick={handleGenerate}
                    className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                >
                    Generate Fixture
                </button>
            </div>
        </div>
    );
}