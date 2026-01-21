import React, { useState, useRef, useMemo } from 'react';
import { Stage, Layer, Line, Circle, Text, Group } from 'react-konva';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Upload, Download, Settings, Mountain, Map, Ruler, Printer, Plus, Trash2 } from 'lucide-react';

// Configuration
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const PAPER_SIZES = {
    A4: { width: 210, height: 297, name: 'A4' },
    A3: { width: 297, height: 420, name: 'A3' },
    A2: { width: 420, height: 594, name: 'A2' }
};

const TerrainModeler = ({ isDark }) => {
    const [rlData, setRlData] = useState([]);
    const [contourLines, setContourLines] = useState([]);
    const [terrainVertices, setTerrainVertices] = useState(null);
    const [minRl, setMinRl] = useState(null);
    const [maxRl, setMaxRl] = useState(null);
    const [contourInterval, setContourInterval] = useState(1);
    const [mapDimensions, setMapDimensions] = useState({ width: 100, height: 100 });
    const [gridResolution, setGridResolution] = useState(50);
    const [activeView, setActiveView] = useState('2d');
    const [loading, setLoading] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState([]);
    const [slopeResult, setSlopeResult] = useState(null);
    const [paperSize, setPaperSize] = useState('A4');
    const [printScale, setPrintScale] = useState(1000);
    const [error, setError] = useState(null);
    const [manualPoint, setManualPoint] = useState({ x: '', y: '', rl: '' });
    const canvasRef = useRef(null);

    // Calculate scale for printing
    const calculatePrintScale = () => {
        const paper = PAPER_SIZES[paperSize];
        const mapWidthMm = (mapDimensions.width * 1000) / printScale;
        const mapHeightMm = (mapDimensions.height * 1000) / printScale;

        return {
            fitsWidth: mapWidthMm <= paper.width,
            fitsHeight: mapHeightMm <= paper.height,
            mapWidthMm,
            mapHeightMm,
            paperWidthMm: paper.width,
            paperHeightMm: paper.height
        };
    };

    // Handle CSV file upload
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target.result;
                const lines = text.split('\n').filter(line => line.trim());
                const data = lines.slice(1).map(line => {
                    const [x, y, rl] = line.split(',').map(v => v.trim());
                    return { x: parseFloat(x), y: parseFloat(y), rl: parseFloat(rl) };
                }).filter(d => !isNaN(d.x) && !isNaN(d.y) && !isNaN(d.rl));

                if (data.length < 3) {
                    setError('CSV must contain at least 3 valid data points');
                    return;
                }

                setRlData(data);
                setError(null);

                const rls = data.map(d => d.rl);
                setMinRl(Math.min(...rls));
                setMaxRl(Math.max(...rls));
            } catch (err) {
                setError('Failed to parse CSV file. Check format.');
                console.error(err);
            }
        };
        reader.readAsText(file);
    };

    // Add point manually
    const handleAddPoint = () => {
        const x = parseFloat(manualPoint.x);
        const y = parseFloat(manualPoint.y);
        const rl = parseFloat(manualPoint.rl);

        if (isNaN(x) || isNaN(y) || isNaN(rl)) {
            setError('Please enter valid numeric values for X, Y, and RL');
            return;
        }

        const newPoint = { x, y, rl };
        const newData = [...rlData, newPoint];
        setRlData(newData);
        setManualPoint({ x: '', y: '', rl: '' });
        setError(null);

        const rls = newData.map(d => d.rl);
        setMinRl(Math.min(...rls));
        setMaxRl(Math.max(...rls));
    };

    // Delete a point
    const handleDeletePoint = (index) => {
        const newData = rlData.filter((_, i) => i !== index);
        setRlData(newData);
        if (newData.length > 0) {
            const rls = newData.map(d => d.rl);
            setMinRl(Math.min(...rls));
            setMaxRl(Math.max(...rls));
        } else {
            setMinRl(null);
            setMaxRl(null);
        }
    };

    // Generate terrain using FastAPI backend
    const generateTerrain = async () => {
        if (rlData.length === 0) {
            setError('Please upload survey data first');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/surveying_terrain/generate-terrain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rl_data: rlData,
                    grid_dimensions: mapDimensions,
                    contour_interval: contourInterval,
                    grid_resolution: gridResolution
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to generate terrain');
            }

            const data = await response.json();

            setContourLines(data.contour_lines || []);
            setTerrainVertices(data.terrain_vertices || []);
            setMinRl(data.min_rl);
            setMaxRl(data.max_rl);

        } catch (err) {
            setError(err.message);
            console.error('Terrain generation error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Calculate slope using FastAPI backend
    const calculateSlope = async () => {
        if (selectedPoints.length !== 2) {
            setError('Please select exactly 2 points for slope calculation');
            return;
        }

        setError(null);
        try {
            const response = await fetch(`${API_URL}/surveying_terrain/calculate-slope`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    point1: selectedPoints[0],
                    point2: selectedPoints[1]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to calculate slope');
            }

            const data = await response.json();
            setSlopeResult(data);
        } catch (err) {
            setError(err.message);
            console.error('Slope calculation error:', err);
        }
    };

    // Handle point selection on 2D map
    const handlePointClick = (point) => {
        if (selectedPoints.length >= 2) {
            setSelectedPoints([point]);
            setSlopeResult(null);
        } else {
            setSelectedPoints([...selectedPoints, point]);
        }
    };

    // Get color for elevation
    const getElevationColor = (rl) => {
        if (minRl === null || maxRl === null) return '#666';
        const normalized = (rl - minRl) / (maxRl - minRl);
        const r = Math.floor(255 * (1 - normalized));
        const g = Math.floor(150 * normalized);
        const b = Math.floor(255 * normalized);
        return `rgb(${r}, ${g}, ${b})`;
    };

    // Export for printing
    const exportForPrint = () => {
        const scaleInfo = calculatePrintScale();
        const printData = {
            paperSize: PAPER_SIZES[paperSize],
            scale: `1:${printScale}`,
            mapDimensions,
            scaleInfo,
            contourLines,
            rlData,
            minRl,
            maxRl,
            contourInterval,
            gridResolution
        };

        const blob = new Blob([JSON.stringify(printData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `terrain_${paperSize}_1-${printScale}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Download sample CSV
    const downloadSampleCSV = () => {
        const csv = `x,y,rl
0,0,1230.5
5,0,1231.2
10,0,1232.0
15,0,1232.8
20,0,1233.5
0,5,1230.8
5,5,1231.5
10,5,1232.2
15,5,1233.0
20,5,1233.8
0,10,1231.0
5,10,1231.8
10,10,1232.5
15,10,1233.3
20,10,1234.0`;

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sample_survey_data.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const scaleInfo = calculatePrintScale();
    const canvasScale = 4;

    return (
        <div className={`min-h-screen p-6 transition-colors duration-300 ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
            <div className="max-w-7xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                        <Mountain className={`w-10 h-10 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                        Automated Terrain Modeler
                    </h1>
                    <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Generate contours and visualize terrain from survey data</p>
                </header>

                {error && (
                    <div className="mb-6 bg-red-900/50 border border-red-500 rounded-lg p-4">
                        <p className="text-red-200">{error}</p>
                    </div>
                )}

                {/* Control Panel */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    {/* Data Input */}
                    <div className={`${isDark ? 'bg-gray-800' : 'bg-white shadow-sm border border-gray-200'} rounded-lg p-6`}>
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Upload className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                            Data Input
                        </h2>

                        <button
                            onClick={downloadSampleCSV}
                            className={`w-full mb-3 ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} py-2 rounded text-sm flex items-center justify-center gap-2 transition-colors`}
                        >
                            <Download className="w-4 h-4" />
                            Download Sample CSV
                        </button>

                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            className={`mb-6 w-full text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer`}
                        />

                        {/* Manual Entry Form */}
                        <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-100'} pt-4 mb-6`}>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Plus className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                                Manual Point Entry
                            </h3>
                            <div className="grid grid-cols-3 gap-2 mb-3">
                                <div>
                                    <label className={`block text-[10px] uppercase ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-1`}>X (East)</label>
                                    <input
                                        type="number"
                                        placeholder="0.0"
                                        value={manualPoint.x}
                                        onChange={(e) => setManualPoint({ ...manualPoint, x: e.target.value })}
                                        className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-50 border border-gray-200'} rounded px-2 py-1 text-sm outline-none focus:ring-1 ring-blue-500 transition-colors`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-[10px] uppercase ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-1`}>Y (North)</label>
                                    <input
                                        type="number"
                                        placeholder="0.0"
                                        value={manualPoint.y}
                                        onChange={(e) => setManualPoint({ ...manualPoint, y: e.target.value })}
                                        className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-50 border border-gray-200'} rounded px-2 py-1 text-sm outline-none focus:ring-1 ring-blue-500 transition-colors`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-[10px] uppercase ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-1`}>RL (Level)</label>
                                    <input
                                        type="number"
                                        placeholder="0.0"
                                        value={manualPoint.rl}
                                        onChange={(e) => setManualPoint({ ...manualPoint, rl: e.target.value })}
                                        className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-50 border border-gray-200'} rounded px-2 py-1 text-sm outline-none focus:ring-1 ring-blue-500 transition-colors`}
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleAddPoint}
                                className={`w-full ${isDark ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400' : 'bg-blue-50 hover:bg-blue-100 text-blue-600'} text-xs py-2 rounded border ${isDark ? 'border-blue-600/30' : 'border-blue-200'} transition-all flex items-center justify-center gap-1 font-medium`}
                            >
                                <Plus className="w-3 h-3" />
                                Add Point
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm mb-1 font-medium">Map Width (m)</label>
                                <input
                                    type="number"
                                    value={mapDimensions.width}
                                    onChange={(e) => setMapDimensions({ ...mapDimensions, width: parseFloat(e.target.value) })}
                                    className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-50 border border-gray-200'} rounded px-3 py-2 outline-none focus:ring-1 ring-blue-500 transition-colors`}
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1 font-medium">Map Height (m)</label>
                                <input
                                    type="number"
                                    value={mapDimensions.height}
                                    onChange={(e) => setMapDimensions({ ...mapDimensions, height: parseFloat(e.target.value) })}
                                    className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-50 border border-gray-200'} rounded px-3 py-2 outline-none focus:ring-1 ring-blue-500 transition-colors`}
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1 font-medium">Contour Interval (m)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={contourInterval}
                                    onChange={(e) => setContourInterval(parseFloat(e.target.value))}
                                    className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-50 border border-gray-200'} rounded px-3 py-2 outline-none focus:ring-1 ring-blue-500 transition-colors`}
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1 font-medium">Grid Resolution</label>
                                <input
                                    type="number"
                                    value={gridResolution}
                                    onChange={(e) => setGridResolution(parseInt(e.target.value))}
                                    className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-50 border border-gray-200'} rounded px-3 py-2 outline-none focus:ring-1 ring-blue-500 transition-colors`}
                                />
                                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>Higher = smoother (20-100)</p>
                            </div>
                        </div>

                        {rlData.length > 0 && (
                            <div className="mt-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-sm font-semibold">Survey Points ({rlData.length})</h3>
                                    <button
                                        onClick={() => setRlData([])}
                                        className={`text-[10px] ${isDark ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'} font-medium transition-colors`}
                                    >
                                        Clear All
                                    </button>
                                </div>
                                <div className={`max-h-40 overflow-y-auto custom-scrollbar ${isDark ? 'bg-gray-900/50' : 'bg-gray-50 border border-gray-200'} rounded p-1`}>
                                    <table className="w-full text-[11px]">
                                        <thead className={`${isDark ? 'text-gray-500 border-gray-700' : 'text-gray-400 border-gray-200'} border-b`}>
                                            <tr>
                                                <th className="text-left py-1">X</th>
                                                <th className="text-left py-1">Y</th>
                                                <th className="text-left py-1">RL</th>
                                                <th className="w-8"></th>
                                            </tr>
                                        </thead>
                                        <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                                            {rlData.map((pt, i) => (
                                                <tr key={i} className={`hover:${isDark ? 'bg-white/5' : 'bg-black/5'} transition-colors`}>
                                                    <td className="py-1">{pt.x.toFixed(1)}</td>
                                                    <td className="py-1">{pt.y.toFixed(1)}</td>
                                                    <td className="py-1">{pt.rl.toFixed(2)}</td>
                                                    <td className="text-right">
                                                        <button
                                                            onClick={() => handleDeletePoint(i)}
                                                            className={`${isDark ? 'text-gray-600 hover:text-red-400' : 'text-gray-400 hover:text-red-600'} transition-colors`}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className={`mt-2 p-2 ${isDark ? 'bg-blue-900/20 border-blue-900/30 text-blue-300' : 'bg-blue-50 border-blue-100 text-blue-700'} border rounded text-[11px] font-medium`}>
                                    Elev: {minRl?.toFixed(2)}m to {maxRl?.toFixed(2)}m (Range: {(maxRl - minRl)?.toFixed(2)}m)
                                </div>
                            </div>
                        )}

                        <button
                            onClick={generateTerrain}
                            disabled={loading || rlData.length === 0}
                            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 rounded font-semibold transition shadow-md"
                        >
                            {loading ? 'Generating Terrain...' : 'Generate Terrain'}
                        </button>
                    </div>

                    {/* Print Settings */}
                    <div className={`${isDark ? 'bg-gray-800' : 'bg-white shadow-sm border border-gray-200'} rounded-lg p-6`}>
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Printer className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                            Print Settings
                        </h2>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm mb-1 font-medium">Paper Size</label>
                                <select
                                    value={paperSize}
                                    onChange={(e) => setPaperSize(e.target.value)}
                                    className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-50 border border-gray-200'} rounded px-3 py-2 outline-none focus:ring-1 ring-blue-500 transition-colors`}
                                >
                                    <option value="A4">A4 (210 × 297 mm)</option>
                                    <option value="A3">A3 (297 × 420 mm)</option>
                                    <option value="A2">A2 (420 × 594 mm)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm mb-1 font-medium">Scale (1:X)</label>
                                <input
                                    type="number"
                                    value={printScale}
                                    onChange={(e) => setPrintScale(parseInt(e.target.value))}
                                    className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-50 border border-gray-200'} rounded px-3 py-2 outline-none focus:ring-1 ring-blue-500 transition-colors`}
                                />
                                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>Common: 500, 1000, 2000, 5000</p>
                            </div>

                            <div className={`p-3 ${isDark ? 'bg-gray-700' : 'bg-gray-50 border border-gray-100'} rounded text-sm space-y-1`}>
                                <p className="font-semibold mb-2">Scale Calculation:</p>
                                <p>Map on paper: {scaleInfo.mapWidthMm.toFixed(0)} × {scaleInfo.mapHeightMm.toFixed(0)} mm</p>
                                <p>Paper size: {scaleInfo.paperWidthMm} × {scaleInfo.paperHeightMm} mm</p>
                                <p className={`font-semibold ${scaleInfo.fitsWidth && scaleInfo.fitsHeight ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                                    {scaleInfo.fitsWidth && scaleInfo.fitsHeight ? '✓ Map fits on paper' : '✗ Map does not fit'}
                                </p>
                                {!(scaleInfo.fitsWidth && scaleInfo.fitsHeight) && (
                                    <p className={`${isDark ? 'text-yellow-400' : 'text-amber-600'} text-xs mt-2`}>
                                        Try scale: 1:{Math.ceil((Math.max(mapDimensions.width, mapDimensions.height) * 1000) / Math.min(scaleInfo.paperWidthMm, scaleInfo.paperHeightMm))}
                                    </p>
                                )}
                            </div>

                            <button
                                onClick={exportForPrint}
                                disabled={contourLines.length === 0}
                                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 rounded transition shadow-sm font-medium"
                            >
                                Export for Print
                            </button>
                        </div>
                    </div>

                    {/* Slope Analysis */}
                    <div className={`${isDark ? 'bg-gray-800' : 'bg-white shadow-sm border border-gray-200'} rounded-lg p-6`}>
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Ruler className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                            Slope Analysis
                        </h2>

                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-3`}>
                            Click 2 points on the map to calculate slope
                        </p>

                        <div className="space-y-2 mb-4">
                            {selectedPoints.length === 0 && (
                                <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'} italic`}>No points selected</p>
                            )}
                            {selectedPoints.map((pt, i) => (
                                <div key={i} className={`p-2 ${isDark ? 'bg-gray-700' : 'bg-gray-50 border border-gray-100'} rounded text-sm`}>
                                    <span className="font-semibold">Point {i + 1}:</span> ({pt.x.toFixed(1)}, {pt.y.toFixed(1)}) RL: {pt.rl.toFixed(2)}m
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={calculateSlope}
                            disabled={selectedPoints.length !== 2}
                            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-2 rounded mb-4 transition shadow-sm font-medium"
                        >
                            Calculate Slope
                        </button>

                        {slopeResult && (
                            <div className={`p-3 ${isDark ? 'bg-gray-700' : 'bg-gray-50 border border-gray-200'} rounded space-y-2 text-sm shadow-inner`}>
                                <p className="font-semibold mb-2">Results:</p>
                                <p>Slope: <span className={`${isDark ? 'text-yellow-400' : 'text-blue-600'} font-bold`}>{slopeResult.slope_percent}%</span></p>
                                <p>Angle: <span className={`${isDark ? 'text-yellow-400' : 'text-blue-600'} font-bold`}>{slopeResult.slope_degrees}°</span></p>
                                <p>Ratio: <span className="font-medium text-gray-500 dark:text-gray-300">{slopeResult.slope_ratio}</span></p>
                                <p>H. Distance: <span className="font-medium text-gray-500 dark:text-gray-300">{slopeResult.horizontal_distance}m</span></p>
                                <p>V. Distance: <span className="font-medium text-gray-500 dark:text-gray-300">{slopeResult.vertical_distance}m</span></p>
                                <p>Elev. Change: <span className="font-medium text-gray-500 dark:text-gray-300">{slopeResult.elevation_change > 0 ? '+' : ''}{slopeResult.elevation_change}m</span></p>
                            </div>
                        )}

                        {selectedPoints.length > 0 && (
                            <button
                                onClick={() => { setSelectedPoints([]); setSlopeResult(null); }}
                                className={`w-full mt-3 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} py-2 rounded text-sm transition font-medium`}
                            >
                                Clear Selection
                            </button>
                        )}
                    </div>
                </div>

                {/* View Toggle */}
                <div className="flex gap-4 mb-4">
                    <button
                        onClick={() => setActiveView('2d')}
                        className={`flex items-center gap-2 px-6 py-3 rounded transition-all shadow-sm font-semibold ${activeView === '2d' ? 'bg-blue-600 text-white shadow-blue-500/20' : (isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200')}`}
                    >
                        <Map className="w-5 h-5" />
                        2D Contour Map
                    </button>
                    <button
                        onClick={() => setActiveView('3d')}
                        className={`flex items-center gap-2 px-6 py-3 rounded transition-all shadow-sm font-semibold ${activeView === '3d' ? 'bg-blue-600 text-white shadow-blue-500/20' : (isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200')}`}
                    >
                        <Mountain className="w-5 h-5" />
                        3D Terrain
                    </button>
                </div>

                {/* Visualization Area */}
                <div className={`${isDark ? 'bg-gray-800' : 'bg-white shadow-lg border border-gray-200'} rounded-lg p-6 relative overflow-hidden`} style={{ height: '600px' }}>
                    {contourLines.length === 0 && rlData.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            <div className="text-center">
                                <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${isDark ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                    <Mountain className={`w-10 h-10 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                                </div>
                                <p className="font-medium">Upload survey data to begin visualization</p>
                                <p className="text-xs mt-1 text-gray-500">Your terrain model will appear here</p>
                            </div>
                        </div>
                    ) : activeView === '2d' ? (
                        <Stage width={800} height={550} ref={canvasRef} className="mx-auto border border-gray-100 dark:border-gray-700 rounded bg-white dark:bg-gray-900 shadow-inner">
                            <Layer>
                                {/* Contour Lines */}
                                {contourLines.map((contour, i) => (
                                    <Group key={i}>
                                        <Line
                                            points={contour.points.flatMap(p => [p[0] * canvasScale, p[1] * canvasScale])}
                                            stroke={getElevationColor(contour.rl)}
                                            strokeWidth={contour.rl % 5 === 0 ? 2.5 : 1.2}
                                            opacity={0.9}
                                        />
                                        {contour.points.length > 2 && i % 3 === 0 && (
                                            <Text
                                                x={contour.points[Math.floor(contour.points.length / 2)][0] * canvasScale}
                                                y={contour.points[Math.floor(contour.points.length / 2)][1] * canvasScale}
                                                text={`${contour.rl.toFixed(1)}m`}
                                                fontSize={11}
                                                fill={isDark ? "#fff" : "#000"}
                                                padding={2}
                                            />
                                        )}
                                    </Group>
                                ))}

                                {/* Survey Points */}
                                {rlData.map((point, i) => (
                                    <Circle
                                        key={i}
                                        x={point.x * canvasScale}
                                        y={point.y * canvasScale}
                                        radius={selectedPoints.includes(point) ? 6 : 4}
                                        fill={selectedPoints.includes(point) ? '#ffff00' : getElevationColor(point.rl)}
                                        stroke={selectedPoints.includes(point) ? '#ff0' : '#fff'}
                                        strokeWidth={selectedPoints.includes(point) ? 2 : 1}
                                        onClick={() => handlePointClick(point)}
                                        onTap={() => handlePointClick(point)}
                                        onMouseEnter={(e) => {
                                            const container = e.target.getStage().container();
                                            container.style.cursor = 'pointer';
                                        }}
                                        onMouseLeave={(e) => {
                                            const container = e.target.getStage().container();
                                            container.style.cursor = 'default';
                                        }}
                                    />
                                ))}
                            </Layer>
                        </Stage>
                    ) : (
                        <Canvas>
                            <PerspectiveCamera makeDefault position={[0, 80, 120]} />
                            <OrbitControls enableDamping dampingFactor={0.05} />
                            <ambientLight intensity={0.6} />
                            <directionalLight position={[50, 50, 25]} intensity={1.2} castShadow />
                            <directionalLight position={[-50, 20, -25]} intensity={0.4} />

                            {terrainVertices && terrainVertices.length > 0 && (
                                <TerrainMesh
                                    vertices={terrainVertices}
                                    minRl={minRl}
                                    maxRl={maxRl}
                                    resolution={gridResolution}
                                />
                            )}

                            <gridHelper args={[mapDimensions.width, 20, '#444', '#222']} />
                        </Canvas>
                    )}
                </div>

                {/* Legend */}
                {(contourLines.length > 0 || rlData.length > 0) && (
                    <div className={`${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white shadow border border-gray-200'} rounded-lg p-4 mt-4 transition-all shadow-sm`}>
                        <h3 className={`text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Elevation Legend</h3>
                        <div className="flex items-center gap-4">
                            <div className="flex-1 h-6 rounded" style={{
                                background: `linear-gradient(to right, 
                  rgb(255, 0, 0), 
                  rgb(200, 75, 120), 
                  rgb(150, 150, 200), 
                  rgb(0, 150, 255))`
                            }}></div>
                            <div className={`flex justify-between w-full text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} font-medium`}>
                                <span>{minRl?.toFixed(1)}m (Low)</span>
                                <span>{maxRl?.toFixed(1)}m (High)</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// 3D Terrain Mesh Component
const TerrainMesh = ({ vertices, minRl, maxRl, resolution }) => {
    const meshRef = useRef();

    const geometry = useMemo(() => {
        const geo = new THREE.BufferGeometry();

        // Create positions array
        const positions = new Float32Array(vertices.flatMap(v => [v[0], v[2], v[1]]));

        // Create colors based on elevation
        const colors = new Float32Array(vertices.flatMap(v => {
            const normalized = (v[2] - minRl) / (maxRl - minRl);
            return [
                1 - normalized,           // R: high at low elevation
                0.5 * normalized,         // G: medium
                normalized               // B: high at high elevation
            ];
        }));

        // Create indices for triangles
        const indices = [];
        for (let i = 0; i < resolution - 1; i++) {
            for (let j = 0; j < resolution - 1; j++) {
                const a = i * resolution + j;
                const b = i * resolution + j + 1;
                const c = (i + 1) * resolution + j;
                const d = (i + 1) * resolution + j + 1;

                indices.push(a, b, d);
                indices.push(a, d, c);
            }
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        return geo;
    }, [vertices, minRl, maxRl, resolution]);

    return (
        <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
            <meshStandardMaterial
                vertexColors
                side={THREE.DoubleSide}
                roughness={0.8}
                metalness={0.2}
            />
        </mesh>
    );
};

export default TerrainModeler;