import React, { useState } from 'react';
import { Calculator, FileText, Download } from 'lucide-react';

const BasementTakeoffApp = () => {
    const [inputs, setInputs] = useState({
        ext_L: 3.91,
        ext_W: 3.41,
        int_L: 3.0,
        int_W: 2.5,
        depth_below_gl: 2.5,
        veg_soil_depth: 0.15,
        working_space: 0.3,
        blinding_thick: 0.075,
        bed_thick: 0.1,
        found_L: 0.9,
        found_thick: 0.3,
        wall_thick: 0.225,
        rc_wall_thick: 0.15,
        horiz_tanking_thick: 0.03,
        vert_tanking_thick: 0.025,
        projection: 0.1,
        slab_thick: 0.15,
        excav_staged: false,
        stage_depth: 1.5,
        reinf_incl: true,
        reinf_density: 120,
        form_incl: true,
        backfill_incl: true,
        disposal_incl: true
    });

    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleInputChange = (field, value) => {
        setInputs(prev => ({ ...prev, [field]: value }));
    };

    const calculateTakeoff = async () => {
        setLoading(true);
        setError(null);

        try {
            // Simulating API call - replace with actual endpoint
            const response = await fetch('http://localhost:8000/api/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inputs)
            });

            if (!response.ok) throw new Error('Calculation failed');

            const data = await response.json();
            setResults(data);
        } catch (err) {
            // Demo calculation for offline use
            const demoResults = calculateDemo(inputs);
            setResults(demoResults);
        } finally {
            setLoading(false);
        }
    };

    const calculateDemo = (inp) => {
        const excav_L = inp.ext_L + 2 * inp.working_space;
        const excav_W = inp.ext_W + 2 * inp.working_space;
        const excav_area = excav_L * excav_W;
        const net_excav_depth = inp.depth_below_gl + inp.bed_thick + inp.blinding_thick +
            inp.horiz_tanking_thick + inp.found_thick - inp.veg_soil_depth;
        const excavation_vol = excav_area * net_excav_depth;
        const veg_soil_vol = excav_area * inp.veg_soil_depth;
        const blinding_area = inp.ext_L * inp.ext_W;
        const found_perim = 2 * (inp.ext_L + inp.ext_W);
        const found_vol = found_perim * inp.found_L * inp.found_thick / 2;
        const bed_vol = blinding_area * inp.bed_thick;
        const rc_wall_perim = 2 * (inp.int_L + inp.int_W);
        const rc_walls_vol = rc_wall_perim * inp.depth_below_gl * inp.rc_wall_thick;
        const vert_tanking_area = rc_wall_perim * inp.depth_below_gl;
        const ext_wall_area = (2 * (inp.ext_L + inp.ext_W) - 4 * inp.wall_thick) * inp.depth_below_gl;
        const int_wall_area = rc_wall_perim * inp.depth_below_gl;
        const slab_vol = blinding_area * inp.slab_thick;
        const total_conc_vol = found_vol + bed_vol + rc_walls_vol + slab_vol;
        const reinf_kg = inp.reinf_incl ? total_conc_vol * inp.reinf_density : 0;
        const form_soffit = inp.int_L * inp.int_W;
        const form_walls = rc_wall_perim * inp.depth_below_gl * 2;
        const form_slab_edges = 2 * (inp.ext_L + inp.ext_W) * inp.slab_thick;
        const form_found = found_perim * inp.found_thick * 2;
        const total_form_m2 = inp.form_incl ? form_soffit + form_walls + form_slab_edges + form_found : 0;
        const backfill_vol = inp.backfill_incl ? excavation_vol - (bed_vol + rc_walls_vol + slab_vol + found_vol +
            inp.blinding_thick * blinding_area + inp.horiz_tanking_thick * blinding_area) : 0;

        return {
            clearance_m2: excav_area,
            veg_soil_m3: veg_soil_vol,
            excavation_m3: excavation_vol,
            disposal_m3: inp.disposal_incl ? excavation_vol + veg_soil_vol : 0,
            blinding_m2: blinding_area,
            found_conc_m3: found_vol,
            bed_m3: bed_vol,
            horiz_tanking_m2: blinding_area,
            rc_walls_m3: rc_walls_vol,
            vert_tanking_m2: vert_tanking_area,
            ext_wall_m2: ext_wall_area,
            int_wall_m2: int_wall_area,
            slab_m3: slab_vol,
            reinf_kg: reinf_kg,
            formwork_m2: total_form_m2,
            backfill_m3: backfill_vol
        };
    };

    const takeoffItems = [
        { no: 1, description: 'Site clearance of bushy vegetation', unit: 'm²', quantity: results?.clearance_m2 },
        { no: 2, description: 'Excavation and removal of vegetable soil to spoil heaps', unit: 'm³', quantity: results?.veg_soil_m3 },
        { no: 3, description: 'Basement excavation in firm soil', unit: 'm³', quantity: results?.excavation_m3 },
        { no: 4, description: 'Allow for necessary planking and strutting', unit: 'Item', quantity: results ? 1 : null },
        { no: 5, description: 'Disposal of excavated material off-site', unit: 'm³', quantity: results?.disposal_m3 },
        { no: 6, description: 'Blinding concrete 1:3:6 mix, 75mm thick', unit: 'm²', quantity: results?.blinding_m2 },
        { no: 7, description: 'Reinforced concrete foundation strip footing grade 25', unit: 'm³', quantity: results?.found_conc_m3 },
        { no: 8, description: 'Concrete bed grade 20, 100mm thick', unit: 'm³', quantity: results?.bed_m3 },
        { no: 9, description: 'Horizontal asphalt tanking 30mm thick in three coats', unit: 'm²', quantity: results?.horiz_tanking_m2 },
        { no: 10, description: 'Reinforced concrete walls grade 25, 150mm thick', unit: 'm³', quantity: results?.rc_walls_m3 },
        { no: 11, description: 'Vertical asphalt tanking 25mm thick in two coats', unit: 'm²', quantity: results?.vert_tanking_m2 },
        { no: 12, description: 'External brick wall in class B engineering bricks, 225mm thick', unit: 'm²', quantity: results?.ext_wall_m2 },
        { no: 13, description: 'Internal brick wall in common bricks, 225mm thick', unit: 'm²', quantity: results?.int_wall_m2 },
        { no: 14, description: 'Ground floor slab reinforced concrete grade 25, 150mm thick', unit: 'm³', quantity: results?.slab_m3 },
        { no: 15, description: 'High tensile steel reinforcement bars to BS 4449', unit: 'kg', quantity: results?.reinf_kg },
        { no: 16, description: 'Formwork to concrete including striking and cleaning', unit: 'm²', quantity: results?.formwork_m2 },
        { no: 17, description: 'Backfilling with selected excavated material in layers', unit: 'm³', quantity: results?.backfill_m3 }
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center gap-3">
                        <Calculator className="w-8 h-8 text-gray-700" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Basement Quantity Takeoff</h1>
                            <p className="text-sm text-gray-500">Civil Engineering Calculator</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Input Panel */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Input Parameters</h2>

                            <div className="space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
                                <InputField label="External Length (m)" value={inputs.ext_L}
                                    onChange={(v) => handleInputChange('ext_L', v)} />
                                <InputField label="External Width (m)" value={inputs.ext_W}
                                    onChange={(v) => handleInputChange('ext_W', v)} />
                                <InputField label="Internal Length (m)" value={inputs.int_L}
                                    onChange={(v) => handleInputChange('int_L', v)} />
                                <InputField label="Internal Width (m)" value={inputs.int_W}
                                    onChange={(v) => handleInputChange('int_W', v)} />
                                <InputField label="Depth Below GL (m)" value={inputs.depth_below_gl}
                                    onChange={(v) => handleInputChange('depth_below_gl', v)} />
                                <InputField label="Vegetable Soil Depth (m)" value={inputs.veg_soil_depth}
                                    onChange={(v) => handleInputChange('veg_soil_depth', v)} />
                                <InputField label="Working Space (m)" value={inputs.working_space}
                                    onChange={(v) => handleInputChange('working_space', v)} />
                                <InputField label="Blinding Thickness (m)" value={inputs.blinding_thick}
                                    onChange={(v) => handleInputChange('blinding_thick', v)} />
                                <InputField label="Concrete Bed Thickness (m)" value={inputs.bed_thick}
                                    onChange={(v) => handleInputChange('bed_thick', v)} />
                                <InputField label="Foundation Length (m)" value={inputs.found_L}
                                    onChange={(v) => handleInputChange('found_L', v)} />
                                <InputField label="Foundation Thickness (m)" value={inputs.found_thick}
                                    onChange={(v) => handleInputChange('found_thick', v)} />
                                <InputField label="Wall Thickness (m)" value={inputs.wall_thick}
                                    onChange={(v) => handleInputChange('wall_thick', v)} />
                                <InputField label="RC Wall Thickness (m)" value={inputs.rc_wall_thick}
                                    onChange={(v) => handleInputChange('rc_wall_thick', v)} />
                                <InputField label="Slab Thickness (m)" value={inputs.slab_thick}
                                    onChange={(v) => handleInputChange('slab_thick', v)} />

                                <CheckboxField label="Include Reinforcement" checked={inputs.reinf_incl}
                                    onChange={(v) => handleInputChange('reinf_incl', v)} />
                                {inputs.reinf_incl && (
                                    <InputField label="Reinforcement Density (kg/m³)" value={inputs.reinf_density}
                                        onChange={(v) => handleInputChange('reinf_density', v)} />
                                )}

                                <CheckboxField label="Include Formwork" checked={inputs.form_incl}
                                    onChange={(v) => handleInputChange('form_incl', v)} />
                                <CheckboxField label="Include Backfill" checked={inputs.backfill_incl}
                                    onChange={(v) => handleInputChange('backfill_incl', v)} />
                                <CheckboxField label="Include Disposal" checked={inputs.disposal_incl}
                                    onChange={(v) => handleInputChange('disposal_incl', v)} />
                            </div>

                            <button
                                onClick={calculateTakeoff}
                                disabled={loading}
                                className="w-full mt-6 bg-gray-800 text-white py-3 rounded-lg font-medium hover:bg-gray-900 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <span>Calculating...</span>
                                ) : (
                                    <>
                                        <Calculator className="w-5 h-5" />
                                        Calculate Takeoff
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Results Panel */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-6 h-6 text-gray-700" />
                                    <h2 className="text-lg font-semibold text-gray-900">Bill of Quantities</h2>
                                </div>
                                {results && (
                                    <button className="text-gray-600 hover:text-gray-900 flex items-center gap-2 text-sm">
                                        <Download className="w-4 h-4" />
                                        Export
                                    </button>
                                )}
                            </div>

                            {!results ? (
                                <div className="text-center py-16">
                                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500">Enter parameters and click Calculate to generate Bill of Quantities</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b-2 border-gray-900">
                                                <th className="text-left py-3 px-2 font-semibold text-gray-900">No.</th>
                                                <th className="text-left py-3 px-2 font-semibold text-gray-900">Description</th>
                                                <th className="text-center py-3 px-2 font-semibold text-gray-900">Unit</th>
                                                <th className="text-right py-3 px-2 font-semibold text-gray-900">Quantity</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {takeoffItems.map((item, idx) => (
                                                item.quantity !== null && item.quantity !== 0 && (
                                                    <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                                                        <td className="py-3 px-2 text-gray-700">{item.no}</td>
                                                        <td className="py-3 px-2 text-gray-900">{item.description}</td>
                                                        <td className="py-3 px-2 text-center text-gray-700">{item.unit}</td>
                                                        <td className="py-3 px-2 text-right font-mono text-gray-900">
                                                            {item.unit === 'Item' ? 'Item' : item.quantity.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                )
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const InputField = ({ label, value, onChange }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-transparent text-gray-900"
        />
    </div>
);

const CheckboxField = ({ label, checked, onChange }) => (
    <div className="flex items-center">
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 text-gray-800 border-gray-300 rounded focus:ring-gray-500"
        />
        <label className="ml-2 text-sm font-medium text-gray-700">{label}</label>
    </div>
);

export default BasementTakeoffApp;