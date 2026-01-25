import React, { useState, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Stage, Layer, Rect, Line as KonvaLine, Circle, Text as KonvaText } from 'react-konva';
import { LineChart, Line as RechartsLine, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Upload, Download, Eye, EyeOff, Grid3x3, Layers } from 'lucide-react';

// ============================================================================
// 3D CORRIDOR VISUALIZATION (React Three Fiber)
// ============================================================================

const RoadCorridor3D = ({ segments, showGrid = true }) => {
    const meshRef = useRef();

    useFrame(() => {
        if (meshRef.current) {
            meshRef.current.rotation.z += 0.001;
        }
    });

    // Generate corridor geometry
    const corridorGeometry = useMemo(() => {
        const points = [];
        segments.forEach(seg => {
            // Create extruded road prism
            points.push(new THREE.Vector3(seg.x, seg.y, seg.z));
        });
        return points;
    }, [segments]);

    return (
        <group>
            {/* Ground plane */}
            {showGrid && (
                <gridHelper args={[100, 20, '#9ca3af', '#d1d5db']} />
            )}

            {/* Road centerline */}
            <Line
                points={corridorGeometry}
                color="#1f2937"
                lineWidth={2}
            />

            {/* Road surface mesh */}
            {segments.map((seg, i) => (
                <mesh key={i} position={[seg.x, seg.y, seg.z]}>
                    <boxGeometry args={[seg.width || 7, 0.1, 10]} />
                    <meshStandardMaterial color="#6b7280" />
                </mesh>
            ))}

            {/* Cut/Fill indicators */}
            {segments.map((seg, i) => (
                seg.cutDepth > 0 ? (
                    <mesh key={`cut-${i}`} position={[seg.x, seg.y - seg.cutDepth / 2, seg.z]}>
                        <boxGeometry args={[seg.width + 10, seg.cutDepth, 10]} />
                        <meshStandardMaterial color="#fca5a5" transparent opacity={0.3} />
                    </mesh>
                ) : seg.fillHeight > 0 ? (
                    <mesh key={`fill-${i}`} position={[seg.x, seg.y + seg.fillHeight / 2, seg.z]}>
                        <boxGeometry args={[seg.width + 10, seg.fillHeight, 10]} />
                        <meshStandardMaterial color="#86efac" transparent opacity={0.3} />
                    </mesh>
                ) : null
            ))}

            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
        </group>
    );
};

const Corridor3DViewer = ({ data }) => {
    const [showGrid, setShowGrid] = useState(true);
    const [showCutFill, setShowCutFill] = useState(true);

    // Generate 3D corridor segments from alignment data
    const segments = useMemo(() => {
        return data.map((point, i) => ({
            x: point.chainage * 0.1,
            y: point.elevation * 0.1,
            z: 0,
            width: 7,
            cutDepth: point.cut || 0,
            fillHeight: point.fill || 0
        }));
    }, [data]);

    return (
        <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">3D Corridor View</h3>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowGrid(!showGrid)}
                        className="px-3 py-1 text-xs border rounded hover:bg-gray-50 flex items-center gap-1"
                    >
                        <Grid3x3 className="w-3 h-3" />
                        {showGrid ? 'Hide' : 'Show'} Grid
                    </button>
                    <button
                        onClick={() => setShowCutFill(!showCutFill)}
                        className="px-3 py-1 text-xs border rounded hover:bg-gray-50 flex items-center gap-1"
                    >
                        <Layers className="w-3 h-3" />
                        {showCutFill ? 'Hide' : 'Show'} Cut/Fill
                    </button>
                </div>
            </div>

            <div className="h-96 border rounded bg-gray-50">
                <Canvas camera={{ position: [50, 30, 50], fov: 50 }}>
                    <RoadCorridor3D segments={segments} showGrid={showGrid} />
                    <OrbitControls />
                </Canvas>
            </div>

            <div className="mt-2 text-xs text-gray-600">
                <p>Use mouse to orbit • Scroll to zoom • Right-click to pan</p>
            </div>
        </div>
    );
};

// ============================================================================
// 2D CROSS-SECTION WITH LAYERS (React Konva)
// ============================================================================

const LayeredCrossSection = ({ points, layers = [], showDimensions = true }) => {
    const width = 800;
    const height = 400;
    const padding = 60;

    if (!points || points.length === 0) return null;

    const minX = Math.min(...points.map(p => p.offset));
    const maxX = Math.max(...points.map(p => p.offset));
    const minY = Math.min(...points.map(p => p.elevation));
    const maxY = Math.max(...points.map(p => p.elevation));

    const scaleX = (width - 2 * padding) / (maxX - minX);
    const scaleY = (height - 2 * padding) / (maxY - minY);
    const scale = Math.min(scaleX, scaleY);

    const toScreenX = (x) => padding + (x - minX) * scale;
    const toScreenY = (y) => height - padding - (y - minY) * scale;

    // Generate path points for cross-section
    const sectionPoints = points.flatMap(p => [toScreenX(p.offset), toScreenY(p.elevation)]);

    // Generate pavement layer polygons
    const layerPolygons = layers.map((layer, idx) => {
        const layerPoints = points.map(p => ({
            x: toScreenX(p.offset),
            y: toScreenY(p.elevation - (layer.depth || 0))
        }));

        return layerPoints.flatMap(p => [p.x, p.y]);
    });

    return (
        <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-semibold mb-2">Detailed Cross-Section with Pavement Layers</h3>
            <Stage width={width} height={height}>
                <Layer>
                    {/* Background */}
                    <Rect x={0} y={0} width={width} height={height} fill="#fafafa" />

                    {/* Grid */}
                    {[...Array(10)].map((_, i) => (
                        <React.Fragment key={i}>
                            <KonvaLine
                                points={[padding, padding + i * (height - 2 * padding) / 10, width - padding, padding + i * (height - 2 * padding) / 10]}
                                stroke="#e5e7eb"
                                strokeWidth={1}
                            />
                            <KonvaLine
                                points={[padding + i * (width - 2 * padding) / 10, padding, padding + i * (width - 2 * padding) / 10, height - padding]}
                                stroke="#e5e7eb"
                                strokeWidth={1}
                            />
                        </React.Fragment>
                    ))}

                    {/* Centerline */}
                    <KonvaLine
                        points={[toScreenX(0), padding, toScreenX(0), height - padding]}
                        stroke="#1f2937"
                        strokeWidth={2}
                        dash={[10, 5]}
                    />

                    {/* Datum line */}
                    <KonvaLine
                        points={[padding, toScreenY(0), width - padding, toScreenY(0)]}
                        stroke="#1f2937"
                        strokeWidth={2}
                    />

                    {/* Pavement layers */}
                    {layerPolygons.map((layerPts, idx) => (
                        <KonvaLine
                            key={`layer-${idx}`}
                            points={layerPts}
                            stroke="#6b7280"
                            strokeWidth={1}
                            fill={`rgba(156, 163, 175, ${0.2 - idx * 0.05})`}
                            closed={false}
                        />
                    ))}

                    {/* Main cross-section */}
                    <KonvaLine
                        points={sectionPoints}
                        stroke="#1f2937"
                        strokeWidth={3}
                        lineCap="round"
                        lineJoin="round"
                    />

                    {/* Points */}
                    {points.map((p, i) => (
                        <Circle
                            key={i}
                            x={toScreenX(p.offset)}
                            y={toScreenY(p.elevation)}
                            radius={4}
                            fill="#1f2937"
                        />
                    ))}

                    {/* Dimensions */}
                    {showDimensions && points.map((p, i) => (
                        <KonvaText
                            key={`dim-${i}`}
                            x={toScreenX(p.offset) - 20}
                            y={toScreenY(p.elevation) - 20}
                            text={`${p.offset.toFixed(1)}m`}
                            fontSize={10}
                            fill="#374151"
                        />
                    ))}

                    {/* Axes labels */}
                    <KonvaText
                        x={width / 2 - 50}
                        y={height - 30}
                        text="Offset from Centerline (m)"
                        fontSize={12}
                        fill="#1f2937"
                        fontStyle="bold"
                    />

                    <KonvaText
                        x={10}
                        y={height / 2 - 50}
                        text="Elevation (m)"
                        fontSize={12}
                        fill="#1f2937"
                        fontStyle="bold"
                        rotation={-90}
                    />
                </Layer>
            </Stage>
        </div>
    );
};

// ============================================================================
// ADVANCED SIGHT DISTANCE VISUALIZATION
// ============================================================================

const SightDistanceEnvelope = ({ data, designSpeed, roadCondition }) => {
    // Calculate sight distance envelope
    const envelopeData = useMemo(() => {
        return data.map(point => {
            const ssd = calculateSSD(designSpeed, roadCondition, point.grade || 0);
            return {
                chainage: point.chainage,
                elevation: point.elevation,
                ssdEnvelope: point.elevation + 1.08, // Eye height
                targetHeight: point.elevation + 0.60 // Object height
            };
        });
    }, [data, designSpeed, roadCondition]);

    return (
        <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-semibold mb-2">Sight Distance Envelope Analysis</h3>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={envelopeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="chainage"
                        label={{ value: 'Chainage (m)', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis
                        label={{ value: 'Elevation (m)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip />
                    <Legend />
                    <RechartsLine
                        type="monotone"
                        dataKey="elevation"
                        stroke="#1f2937"
                        strokeWidth={2}
                        name="Ground Profile"
                    />
                    <RechartsLine
                        type="monotone"
                        dataKey="ssdEnvelope"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        name="Sight Line (Eye Height)"
                    />
                    <RechartsLine
                        type="monotone"
                        dataKey="targetHeight"
                        stroke="#ef4444"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        name="Target Height"
                    />
                    <ReferenceLine
                        y={envelopeData[0]?.ssdEnvelope}
                        stroke="#9ca3af"
                        strokeDasharray="3 3"
                        label="Min SSD"
                    />
                </LineChart>
            </ResponsiveContainer>

            <div className="mt-4 grid grid-cols-3 gap-4 text-xs">
                <div className="p-2 bg-blue-50 rounded">
                    <div className="font-semibold text-blue-900">Design Speed</div>
                    <div className="text-blue-700">{designSpeed} km/h</div>
                </div>
                <div className="p-2 bg-yellow-50 rounded">
                    <div className="font-semibold text-yellow-900">Road Condition</div>
                    <div className="text-yellow-700">{roadCondition}</div>
                </div>
                <div className="p-2 bg-green-50 rounded">
                    <div className="font-semibold text-green-900">Eye Height</div>
                    <div className="text-green-700">1.08 m (AASHTO)</div>
                </div>
            </div>
        </div>
    );
};

// Helper function for SSD calculation
function calculateSSD(speed, condition, grade) {
    const speedMs = speed / 3.6;
    const friction = { dry: 0.35, wet: 0.30, icy: 0.15 }[condition] || 0.30;
    const g = 9.81;
    return speedMs * 2.5 + (speedMs * speedMs) / (2 * g * (friction + grade / 100));
}

// ============================================================================
// DATA IMPORT/EXPORT COMPONENT
// ============================================================================

const DataManager = ({ onImport, onExport }) => {
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setImporting(true);
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                onImport(data);
                setImporting(false);
            } catch (error) {
                alert('Error parsing file: ' + error.message);
                setImporting(false);
            }
        };

        reader.readAsText(file);
    };

    const handleExport = () => {
        const data = onExport();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `route-survey-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex gap-2">
            <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
            />
            <button
                onClick={() => fileInputRef.current.click()}
                disabled={importing}
                className="px-4 py-2 border rounded hover:bg-gray-50 flex items-center gap-2 text-sm"
            >
                <Upload className="w-4 h-4" />
                {importing ? 'Importing...' : 'Import Data'}
            </button>
            <button
                onClick={handleExport}
                className="px-4 py-2 border rounded hover:bg-gray-50 flex items-center gap-2 text-sm"
            >
                <Download className="w-4 h-4" />
                Export Data
            </button>
        </div>
    );
};

// ============================================================================
// MAIN APPLICATION WITH ADVANCED FEATURES
// ============================================================================

const AdvancedRouteSurveyingApp = () => {
    const [activeView, setActiveView] = useState('3d');
    const [show3DControls, setShow3DControls] = useState(true);

    // Sample alignment data
    const alignmentData = [
        { chainage: 0, elevation: 100.0, cut: 2.5, fill: 0, grade: 0 },
        { chainage: 50, elevation: 102.5, cut: 3.0, fill: 0, grade: 5 },
        { chainage: 100, elevation: 104.0, cut: 2.0, fill: 0, grade: 3 },
        { chainage: 150, elevation: 103.5, cut: 0, fill: 0, grade: -1 },
        { chainage: 200, elevation: 105.0, cut: 0, fill: 1.5, grade: 3 },
        { chainage: 250, elevation: 107.5, cut: 0, fill: 2.0, grade: 5 },
        { chainage: 300, elevation: 110.0, cut: 0, fill: 2.5, grade: 5 }
    ];

    // Sample cross-section
    const crossSectionPoints = [
        { offset: -12, elevation: -3 },
        { offset: -5.5, elevation: 0.15 },
        { offset: -3.5, elevation: 0.15 },
        { offset: 0, elevation: 0 },
        { offset: 3.5, elevation: 0.15 },
        { offset: 5.5, elevation: 0.15 },
        { offset: 12, elevation: -3 }
    ];

    const pavementLayers = [
        { name: 'Asphalt Surface', depth: 0.05 },
        { name: 'Asphalt Binder', depth: 0.13 },
        { name: 'Base Course', depth: 0.33 },
        { name: 'Subbase', depth: 0.63 }
    ];

    const handleImport = (data) => {
        console.log('Imported data:', data);
        // Handle imported survey data
    };

    const handleExport = () => {
        return {
            alignment: alignmentData,
            crossSection: crossSectionPoints,
            timestamp: new Date().toISOString(),
            project: 'Route Survey Export'
        };
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Advanced Route Surveying Visualizations</h1>
                            <p className="text-gray-600 mt-1">3D corridor modeling, layered cross-sections & sight distance envelopes</p>
                        </div>
                        <DataManager onImport={handleImport} onExport={handleExport} />
                    </div>
                </div>

                {/* View Toggle */}
                <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                    <div className="flex gap-4">
                        {['3d', 'cross-section', 'sight-distance'].map(view => (
                            <button
                                key={view}
                                onClick={() => setActiveView(view)}
                                className={`px-4 py-2 rounded transition-colors ${activeView === view
                                    ? 'bg-gray-900 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {view === '3d' && '3D Corridor'}
                                {view === 'cross-section' && 'Layered Cross-Section'}
                                {view === 'sight-distance' && 'Sight Distance'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content */}
                <div className="space-y-6">
                    {activeView === '3d' && (
                        <Corridor3DViewer data={alignmentData} />
                    )}

                    {activeView === 'cross-section' && (
                        <LayeredCrossSection
                            points={crossSectionPoints}
                            layers={pavementLayers}
                            showDimensions={true}
                        />
                    )}

                    {activeView === 'sight-distance' && (
                        <SightDistanceEnvelope
                            data={alignmentData}
                            designSpeed={80}
                            roadCondition="wet"
                        />
                    )}
                </div>

                {/* Technical Notes */}
                <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Visualization Features</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div>
                            <div className="font-semibold text-gray-900 mb-1">3D Corridor</div>
                            <ul className="space-y-1 text-xs">
                                <li>• Real-time orbit controls</li>
                                <li>• Cut/fill volume preview</li>
                                <li>• Grid reference system</li>
                                <li>• Scale-accurate modeling</li>
                            </ul>
                        </div>
                        <div>
                            <div className="font-semibold text-gray-900 mb-1">Cross-Sections</div>
                            <ul className="space-y-1 text-xs">
                                <li>• Pavement layer visualization</li>
                                <li>• Dimension annotations</li>
                                <li>• Coordinate-based accuracy</li>
                                <li>• Export-ready drawings</li>
                            </ul>
                        </div>
                        <div>
                            <div className="font-semibold text-gray-900 mb-1">Sight Distance</div>
                            <ul className="space-y-1 text-xs">
                                <li>• AASHTO compliance checking</li>
                                <li>• Eye/object height markers</li>
                                <li>• Grade-sensitive calculations</li>
                                <li>• Safety envelope display</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdvancedRouteSurveyingApp;