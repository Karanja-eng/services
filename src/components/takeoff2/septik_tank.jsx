import React, { useState } from 'react';
import { Calculator, FileText, Download, AlertCircle } from 'lucide-react';

const InputField = ({ label, name, value, onChange, type = "number", step = "0.01" }) => (
    <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">{label}</label>
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            step={step}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-gray-400 dark:focus:ring-slate-500 focus:border-transparent"
        />
    </div>
);

export default function SepticTakeoffApp({ isDark = false }) {
    const [formData, setFormData] = useState({
        tankIntL: 3.0,
        tankIntW: 2.5,
        tankDepthInt: 2.0,
        manholeIntL: 0.7,
        manholeIntW: 0.6,
        manholeDepthInt: 0.7,
        wallThick: 0.2,
        bedThickTank: 0.15,
        bedThickManhole: 0.1,
        blindingThick: 0.075,
        slabThick: 0.2,
        vegSoil: 0.2,
        workingSpace: 0.2,
        coverL: 0.6,
        coverW: 0.45,
        numCovers: 3,
        numBaffles: 2,
        baffleL: 2.3,
        baffleThick: 0.2,
        baffleHeight1: 1.5,
        baffleHeight2: 1.3,
        inletPipeL: 1.0,
        outletPipeL: 1.0,
        coverSoilDepth: 0.3,
    });

    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: parseFloat(value) || 0
        }));
    };

    const handleCalculate = async () => {
        setLoading(true);
        setError(null);

        try {
            // Prepare baffle heights array
            const baffleHeights = [];
            for (let i = 1; i <= formData.numBaffles; i++) {
                baffleHeights.push(formData[`baffleHeight${i}`] || 0);
            }

            const payload = {
                tank_int_l: formData.tankIntL,
                tank_int_w: formData.tankIntW,
                tank_depth_int: formData.tankDepthInt,
                manhole_int_l: formData.manholeIntL,
                manhole_int_w: formData.manholeIntW,
                manhole_depth_int: formData.manholeDepthInt,
                wall_thick: formData.wallThick,
                bed_thick_tank: formData.bedThickTank,
                bed_thick_manhole: formData.bedThickManhole,
                blinding_thick: formData.blindingThick,
                slab_thick: formData.slabThick,
                veg_soil: formData.vegSoil,
                working_space: formData.workingSpace,
                cover_l: formData.coverL,
                cover_w: formData.coverW,
                num_covers: formData.numCovers,
                num_baffles: formData.numBaffles,
                baffle_l: formData.baffleL,
                baffle_thick: formData.baffleThick,
                baffle_heights: baffleHeights,
                inlet_pipe_l: formData.inletPipeL,
                outlet_pipe_l: formData.outletPipeL,
                cover_soil_depth: formData.coverSoilDepth,
            };

            // Call FastAPI backend
            const response = await fetch('http://localhost:8000/api/calculate', {
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
        a.download = 'septic_tank_boq.csv';
        a.click();
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
            {/* Header */}
            <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center gap-3">
                        <Calculator className="w-8 h-8 text-gray-700 dark:text-slate-300" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Septic Tank Quantity Takeoff</h1>
                            <p className="text-sm text-gray-600 dark:text-slate-400">Professional BOQ Calculator for Civil Engineers</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Input Form */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Input Parameters</h2>

                            <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
                                {/* Tank Dimensions */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3 border-b dark:border-slate-600 pb-2">Tank Dimensions</h3>
                                    <div className="space-y-3">
                                        <InputField label="Internal Length (m)" name="tankIntL" value={formData.tankIntL} onChange={handleChange} />
                                        <InputField label="Internal Width (m)" name="tankIntW" value={formData.tankIntW} onChange={handleChange} />
                                        <InputField label="Internal Depth (m)" name="tankDepthInt" value={formData.tankDepthInt} onChange={handleChange} />
                                    </div>
                                </div>

                                {/* Manhole Dimensions */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3 border-b pb-2">Manhole Dimensions</h3>
                                    <div className="space-y-3">
                                        <InputField label="Internal Length (m)" name="manholeIntL" value={formData.manholeIntL} onChange={handleChange} />
                                        <InputField label="Internal Width (m)" name="manholeIntW" value={formData.manholeIntW} onChange={handleChange} />
                                        <InputField label="Internal Depth (m)" name="manholeDepthInt" value={formData.manholeDepthInt} onChange={handleChange} />
                                    </div>
                                </div>

                                {/* Structural Elements */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3 border-b pb-2">Structural Elements</h3>
                                    <div className="space-y-3">
                                        <InputField label="Wall Thickness (m)" name="wallThick" value={formData.wallThick} onChange={handleChange} />
                                        <InputField label="Tank Bed Thickness (m)" name="bedThickTank" value={formData.bedThickTank} onChange={handleChange} />
                                        <InputField label="Manhole Bed Thickness (m)" name="bedThickManhole" value={formData.bedThickManhole} onChange={handleChange} />
                                        <InputField label="Blinding Thickness (m)" name="blindingThick" value={formData.blindingThick} onChange={handleChange} />
                                        <InputField label="Slab Thickness (m)" name="slabThick" value={formData.slabThick} onChange={handleChange} />
                                    </div>
                                </div>

                                {/* Baffle Walls */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3 border-b pb-2">Baffle Walls</h3>
                                    <div className="space-y-3">
                                        <InputField label="Number of Baffles" name="numBaffles" value={formData.numBaffles} onChange={handleChange} type="number" step="1" />
                                        <InputField label="Baffle Length (m)" name="baffleL" value={formData.baffleL} onChange={handleChange} />
                                        <InputField label="Baffle Thickness (m)" name="baffleThick" value={formData.baffleThick} onChange={handleChange} />
                                        {Array.from({ length: formData.numBaffles }, (_, i) => (
                                            <InputField
                                                key={i}
                                                label={`Baffle ${i + 1} Height (m)`}
                                                name={`baffleHeight${i + 1}`}
                                                value={formData[`baffleHeight${i + 1}`] || 0}
                                                onChange={handleChange}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Site & Covers */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3 border-b pb-2">Site & Covers</h3>
                                    <div className="space-y-3">
                                        <InputField label="Vegetable Soil Depth (m)" name="vegSoil" value={formData.vegSoil} onChange={handleChange} />
                                        <InputField label="Working Space (m)" name="workingSpace" value={formData.workingSpace} onChange={handleChange} />
                                        <InputField label="Cover Soil Depth (m)" name="coverSoilDepth" value={formData.coverSoilDepth} onChange={handleChange} />
                                        <InputField label="Number of Covers" name="numCovers" value={formData.numCovers} onChange={handleChange} type="number" step="1" />
                                        <InputField label="Cover Length (m)" name="coverL" value={formData.coverL} onChange={handleChange} />
                                        <InputField label="Cover Width (m)" name="coverW" value={formData.coverW} onChange={handleChange} />
                                    </div>
                                </div>

                                {/* Pipes */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3 border-b pb-2">Pipes</h3>
                                    <div className="space-y-3">
                                        <InputField label="Inlet Pipe Length (m)" name="inletPipeL" value={formData.inletPipeL} onChange={handleChange} />
                                        <InputField label="Outlet Pipe Length (m)" name="outletPipeL" value={formData.outletPipeL} onChange={handleChange} />
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
                                        <Calculator className="w-4 h-4" />
                                        Calculate BOQ
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Results Table */}
                    <div className="lg:col-span-2">
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-gray-700 dark:text-slate-300" />
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Bill of Quantities</h2>
                                </div>
                                {results && (
                                    <button
                                        onClick={handleExport}
                                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-sm font-medium rounded-md transition-colors"
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