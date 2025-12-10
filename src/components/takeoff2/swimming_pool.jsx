import React, { useState } from 'react';
import { Waves, FileText, Download, AlertCircle } from 'lucide-react';

const InputField = ({ label, name, value, onChange, type = "number", step = "0.01" }) => (
    <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            step={step}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
        />
    </div>
);

const CheckboxField = ({ label, name, checked, onChange }) => (
    <div className="flex items-center gap-2">
        <input
            type="checkbox"
            name={name}
            checked={checked}
            onChange={onChange}
            className="w-4 h-4 text-gray-800 border-gray-300 rounded focus:ring-2 focus:ring-gray-400"
        />
        <label className="text-xs font-medium text-gray-700">{label}</label>
    </div>
);

export default function SwimmingPoolTakeoffApp() {
    const [formData, setFormData] = useState({
        intL: 12.0,
        intW: 8.0,
        shallowDepth: 1.5,
        deepDepth: 2.8,
        vegSoilDepth: 0.15,
        workingSpace: 0.335,
        blindingThick: 0.075,
        bedThick: 0.15,
        wallThick: 0.1,
        tankingThick: 0.02,
        trenchWidth: 1.0,
        trenchDepth: 0.2,
        wallHeightAbove: 0.3,
        numSteps: 0,
        stepRise: 0.3,
        stepTread: 0.3,
        excavStaged: false,
        stageDepth: 1.5,
        reinfIncl: false,
        reinfDensity: 100,
        formIncl: true,
        backfillIncl: true,
    });

    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (parseFloat(value) || 0)
        }));
    };

    const handleCalculate = async () => {
        setLoading(true);
        setError(null);

        try {
            const payload = {
                int_l: formData.intL,
                int_w: formData.intW,
                shallow_depth: formData.shallowDepth,
                deep_depth: formData.deepDepth,
                veg_soil_depth: formData.vegSoilDepth,
                working_space: formData.workingSpace,
                blinding_thick: formData.blindingThick,
                bed_thick: formData.bedThick,
                wall_thick: formData.wallThick,
                tanking_thick: formData.tankingThick,
                trench_width: formData.trenchWidth,
                trench_depth: formData.trenchDepth,
                wall_height_above: formData.wallHeightAbove,
                num_steps: formData.numSteps,
                step_rise: formData.stepRise,
                step_tread: formData.stepTread,
                excav_staged: formData.excavStaged,
                stage_depth: formData.stageDepth,
                reinf_incl: formData.reinfIncl,
                reinf_density: formData.reinfDensity,
                form_incl: formData.formIncl,
                backfill_incl: formData.backfillIncl,
            };

            const response = await fetch('http://localhost:8000/api/calculate-pool', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error('Calculation failed');
            }

            const data = await response.json();
            setResults(data.boq);
        } catch (err) {
            setError(err.message || 'Failed to connect to backend. Please ensure the FastAPI server is running.');
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        if (!results) return;

        let csv = 'Item,Description,Unit,Quantity\n';
        results.forEach(row => {
            csv += `${row.item},"${row.description}",${row.unit},${row.quantity}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'swimming_pool_boq.csv';
        a.click();
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center gap-3">
                        <Waves className="w-8 h-8 text-gray-700" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Swimming Pool Quantity Takeoff</h1>
                            <p className="text-sm text-gray-600">Professional BOQ Calculator for Civil Engineers</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Input Form */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Input Parameters</h2>

                            <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
                                {/* Pool Dimensions */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3 border-b pb-2">Pool Dimensions</h3>
                                    <div className="space-y-3">
                                        <InputField label="Internal Length (m)" name="intL" value={formData.intL} onChange={handleChange} />
                                        <InputField label="Internal Width (m)" name="intW" value={formData.intW} onChange={handleChange} />
                                        <InputField label="Shallow End Depth (m)" name="shallowDepth" value={formData.shallowDepth} onChange={handleChange} />
                                        <InputField label="Deep End Depth (m)" name="deepDepth" value={formData.deepDepth} onChange={handleChange} />
                                        <InputField label="Wall Height Above Ground (m)" name="wallHeightAbove" value={formData.wallHeightAbove} onChange={handleChange} />
                                    </div>
                                </div>

                                {/* Structural Elements */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3 border-b pb-2">Structural Elements</h3>
                                    <div className="space-y-3">
                                        <InputField label="Wall Thickness (m)" name="wallThick" value={formData.wallThick} onChange={handleChange} />
                                        <InputField label="Base Slab Thickness (m)" name="bedThick" value={formData.bedThick} onChange={handleChange} />
                                        <InputField label="Tanking Thickness (m)" name="tankingThick" value={formData.tankingThick} onChange={handleChange} />
                                        <InputField label="Blinding Thickness (m)" name="blindingThick" value={formData.blindingThick} onChange={handleChange} />
                                    </div>
                                </div>

                                {/* Foundation Trench */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3 border-b pb-2">Foundation Trench</h3>
                                    <div className="space-y-3">
                                        <InputField label="Trench Width (m)" name="trenchWidth" value={formData.trenchWidth} onChange={handleChange} />
                                        <InputField label="Trench Depth (m)" name="trenchDepth" value={formData.trenchDepth} onChange={handleChange} />
                                    </div>
                                </div>

                                {/* Steps */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3 border-b pb-2">Steps (Optional)</h3>
                                    <div className="space-y-3">
                                        <InputField label="Number of Steps" name="numSteps" value={formData.numSteps} onChange={handleChange} type="number" step="1" />
                                        {formData.numSteps > 0 && (
                                            <>
                                                <InputField label="Step Rise (m)" name="stepRise" value={formData.stepRise} onChange={handleChange} />
                                                <InputField label="Step Tread (m)" name="stepTread" value={formData.stepTread} onChange={handleChange} />
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Site Work */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3 border-b pb-2">Site Work</h3>
                                    <div className="space-y-3">
                                        <InputField label="Vegetable Soil Depth (m)" name="vegSoilDepth" value={formData.vegSoilDepth} onChange={handleChange} />
                                        <InputField label="Working Space (m)" name="workingSpace" value={formData.workingSpace} onChange={handleChange} />
                                    </div>
                                </div>

                                {/* Excavation Staging */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3 border-b pb-2">Excavation Options</h3>
                                    <div className="space-y-3">
                                        <CheckboxField label="Excavate in Stages" name="excavStaged" checked={formData.excavStaged} onChange={handleChange} />
                                        {formData.excavStaged && (
                                            <InputField label="Stage Depth (m)" name="stageDepth" value={formData.stageDepth} onChange={handleChange} />
                                        )}
                                    </div>
                                </div>

                                {/* Reinforcement */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3 border-b pb-2">Reinforcement</h3>
                                    <div className="space-y-3">
                                        <CheckboxField label="Include Reinforcement" name="reinfIncl" checked={formData.reinfIncl} onChange={handleChange} />
                                        {formData.reinfIncl && (
                                            <InputField label="Reinforcement Density (kg/m³)" name="reinfDensity" value={formData.reinfDensity} onChange={handleChange} />
                                        )}
                                    </div>
                                </div>

                                {/* Other Options */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3 border-b pb-2">Other Options</h3>
                                    <div className="space-y-3">
                                        <CheckboxField label="Include Formwork" name="formIncl" checked={formData.formIncl} onChange={handleChange} />
                                        <CheckboxField label="Include Backfill" name="backfillIncl" checked={formData.backfillIncl} onChange={handleChange} />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleCalculate}
                                disabled={loading}
                                className="w-full mt-6 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Calculating...
                                    </>
                                ) : (
                                    <>
                                        <Waves className="w-4 h-4" />
                                        Calculate BOQ
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Results Table */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-gray-700" />
                                    <h2 className="text-lg font-semibold text-gray-900">Bill of Quantities</h2>
                                </div>
                                {results && (
                                    <button
                                        onClick={handleExport}
                                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-md transition-colors"
                                    >
                                        <Download className="w-4 h-4" />
                                        Export CSV
                                    </button>
                                )}
                            </div>

                            {error && (
                                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-red-800">Error</p>
                                        <p className="text-sm text-red-700 mt-1">{error}</p>
                                        <p className="text-xs text-red-600 mt-2">Make sure FastAPI server is running on http://localhost:8000</p>
                                    </div>
                                </div>
                            )}

                            {!results && !error && (
                                <div className="text-center py-12">
                                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500">Enter parameters and click "Calculate BOQ" to see results</p>
                                </div>
                            )}

                            {results && (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-gray-100 border-b-2 border-gray-300">
                                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 w-16">Item</th>
                                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Description</th>
                                                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 w-20">Unit</th>
                                                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 w-28">Quantity</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.map((row, index) => (
                                                <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                                                    <td className="py-3 px-4 text-sm text-gray-700 font-medium">{row.item}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-700">{row.description}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-700 text-center">{row.unit}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-900 font-medium text-right">{row.quantity}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Backend Instructions */}
                        <div className="mt-4 bg-gray-100 border border-gray-200 rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-gray-900 mb-2">Backend Setup Instructions</h3>
                            <p className="text-xs text-gray-600 mb-2">Save the Python FastAPI backend code and run:</p>
                            <code className="block bg-white px-3 py-2 rounded text-xs text-gray-800 font-mono border border-gray-300">
                                uvicorn main:app --reload
                            </code>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}