import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Frame3D from './Frame3D';
import BM_SF_Chart from './BM_SF_Chart';
import {
    Play,
    Pause,
    RotateCcw,
    Download,
    Upload,
    Settings,
    Eye,
    EyeOff,
    Layers,
    Grid3x3,
    TrendingUp,
    FileJson,
    Moon,
    Sun,
    Maximize2,
    Box,
    AlertCircle
} from 'lucide-react';

// ============================================================================
// CROSS SECTION 2D VIEW COMPONENT
// ============================================================================

const CrossSection2D = ({ sectionData, theme }) => {
    if (!sectionData) {
        return (
            <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: theme === 'dark' ? '#1a1a1a' : '#f5f5f5',
                color: theme === 'dark' ? '#ccc' : '#666',
                borderRadius: '8px'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <Box size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
                    <div>No Section Selected</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                        Click on a member section in the 3D view
                    </div>
                </div>
            </div>
        );
    }

    const { geometry, forces, reinforcement, position } = sectionData;
    const { width, depth } = geometry;

    // Calculate scale for drawing (fit to container)
    const maxDim = Math.max(width, depth);
    const scale = 200 / maxDim; // 200px for max dimension
    const w = width * scale;
    const h = depth * scale;

    const bgColor = theme === 'dark' ? '#2d2d2d' : '#ffffff';
    const textColor = theme === 'dark' ? '#ffffff' : '#000000';
    const strokeColor = theme === 'dark' ? '#666666' : '#333333';

    return (
        <div style={{
            width: '100%',
            height: '100%',
            background: bgColor,
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
        }}>
            {/* Section info */}
            <div style={{
                color: textColor,
                fontSize: '14px',
                borderBottom: `1px solid ${strokeColor}`,
                paddingBottom: '12px'
            }}>
                <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>
                    Section at {position.toFixed(2)} m
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                    <div>Width: {width} mm</div>
                    <div>Depth: {depth} mm</div>
                    <div>N: {forces.N?.toFixed(1)} kN</div>
                    <div>Mz: {forces.Mz?.toFixed(1)} kNm</div>
                    <div>Vy: {forces.Vy?.toFixed(1)} kN</div>
                    <div>T: {forces.T?.toFixed(1)} kNm</div>
                </div>
            </div>

            {/* SVG Drawing */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <svg width="300" height="300" viewBox="0 0 300 300">
                    {/* Concrete section */}
                    <rect
                        x={(300 - w) / 2}
                        y={(300 - h) / 2}
                        width={w}
                        height={h}
                        fill={theme === 'dark' ? '#4a4a4a' : '#cccccc'}
                        stroke={strokeColor}
                        strokeWidth="2"
                    />

                    {/* Reinforcement bars (placeholder circles) */}
                    {reinforcement?.top?.bars && reinforcement.top.bars.map((bar, idx) => (
                        <circle
                            key={`top-${idx}`}
                            cx={150 + (bar.position || 0) * w / width}
                            cy={(300 - h) / 2 + 20}
                            r="4"
                            fill="#ff6b6b"
                            stroke="#8b0000"
                            strokeWidth="1"
                        />
                    ))}

                    {reinforcement?.bottom?.bars && reinforcement.bottom.bars.map((bar, idx) => (
                        <circle
                            key={`bottom-${idx}`}
                            cx={150 + (bar.position || 0) * w / width}
                            cy={(300 + h) / 2 - 20}
                            r="4"
                            fill="#4ecdc4"
                            stroke="#006666"
                            strokeWidth="1"
                        />
                    ))}

                    {/* Neutral axis (if available) */}
                    {forces.Mz !== 0 && (
                        <line
                            x1={(300 - w) / 2}
                            y1={150}
                            x2={(300 + w) / 2}
                            y2={150}
                            stroke="#ff9900"
                            strokeWidth="1.5"
                            strokeDasharray="4 2"
                        />
                    )}

                    {/* Dimension lines */}
                    <g stroke={textColor} strokeWidth="0.5">
                        {/* Width dimension */}
                        <line x1={(300 - w) / 2} y1={(300 + h) / 2 + 40} x2={(300 + w) / 2} y2={(300 + h) / 2 + 40} />
                        <line x1={(300 - w) / 2} y1={(300 + h) / 2 + 35} x2={(300 - w) / 2} y2={(300 + h) / 2 + 45} />
                        <line x1={(300 + w) / 2} y1={(300 + h) / 2 + 35} x2={(300 + w) / 2} y2={(300 + h) / 2 + 45} />
                        <text x={150} y={(300 + h) / 2 + 55} fill={textColor} fontSize="11" textAnchor="middle">
                            {width} mm
                        </text>

                        {/* Depth dimension */}
                        <line x1={(300 + w) / 2 + 40} y1={(300 - h) / 2} x2={(300 + w) / 2 + 40} y2={(300 + h) / 2} />
                        <line x1={(300 + w) / 2 + 35} y1={(300 - h) / 2} x2={(300 + w) / 2 + 45} y2={(300 - h) / 2} />
                        <line x1={(300 + w) / 2 + 35} y1={(300 + h) / 2} x2={(300 + w) / 2 + 45} y2={(300 + h) / 2} />
                        <text x={(300 + w) / 2 + 60} y={150} fill={textColor} fontSize="11" textAnchor="start">
                            {depth} mm
                        </text>
                    </g>
                </svg>
            </div>

            {/* Reinforcement details */}
            {reinforcement && (
                <div style={{
                    color: textColor,
                    fontSize: '12px',
                    borderTop: `1px solid ${strokeColor}`,
                    paddingTop: '12px'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Reinforcement (Placeholder)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div>Top: {reinforcement.top?.area || 0} mm²</div>
                        <div>Bottom: {reinforcement.bottom?.area || 0} mm²</div>
                        <div>Links: {reinforcement.links?.size || 0}@{reinforcement.links?.spacing || 0}</div>
                    </div>
                    <div style={{
                        marginTop: '8px',
                        padding: '8px',
                        background: theme === 'dark' ? '#3a3a3a' : '#f0f0f0',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#888'
                    }}>
                        <AlertCircle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                        Actual reinforcement will be calculated by design module
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// CONTROL PANEL
// ============================================================================

const ControlPanel = ({
    settings,
    onSettingsChange,
    onLoadFile,
    onExportData,
    loadCombinations,
    selectedCombo,
    onComboChange
}) => {
    const [expanded, setExpanded] = useState(true);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    onLoadFile(data);
                } catch (error) {
                    alert('Error parsing JSON file');
                }
            };
            reader.readAsText(file);
        }
    };

    return (
        <div style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            zIndex: 1000,
            background: settings.theme === 'dark' ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            minWidth: expanded ? '280px' : '50px',
            transition: 'all 0.3s',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${settings.theme === 'dark' ? '#444' : '#ddd'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer'
            }}
                onClick={() => setExpanded(!expanded)}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: settings.theme === 'dark' ? '#fff' : '#333',
                    fontWeight: 'bold'
                }}>
                    <Settings size={18} />
                    {expanded && 'Controls'}
                </div>
                <button style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: settings.theme === 'dark' ? '#fff' : '#333'
                }}>
                    {expanded ? '−' : '+'}
                </button>
            </div>

            {/* Controls */}
            {expanded && (
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* File operations */}
                    <div>
                        <div style={{
                            fontSize: '12px',
                            fontWeight: 'bold',
                            marginBottom: '8px',
                            color: settings.theme === 'dark' ? '#ccc' : '#666'
                        }}>
                            File Operations
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <label style={{
                                flex: 1,
                                padding: '8px',
                                background: '#2196F3',
                                color: '#fff',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                textAlign: 'center',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                            }}>
                                <Upload size={14} />
                                Load
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleFileUpload}
                                    style={{ display: 'none' }}
                                />
                            </label>

                            <button
                                onClick={onExportData}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    background: '#4CAF50',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Download size={14} />
                                Export
                            </button>
                        </div>
                    </div>

                    {/* Load combination selector */}
                    {loadCombinations && loadCombinations.length > 0 && (
                        <div>
                            <div style={{
                                fontSize: '12px',
                                fontWeight: 'bold',
                                marginBottom: '8px',
                                color: settings.theme === 'dark' ? '#ccc' : '#666'
                            }}>
                                Load Combination
                            </div>
                            <select
                                value={selectedCombo}
                                onChange={(e) => onComboChange(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    borderRadius: '6px',
                                    border: `1px solid ${settings.theme === 'dark' ? '#555' : '#ddd'}`,
                                    background: settings.theme === 'dark' ? '#2d2d2d' : '#fff',
                                    color: settings.theme === 'dark' ? '#fff' : '#333',
                                    fontSize: '12px'
                                }}
                            >
                                {loadCombinations.map((combo, idx) => (
                                    <option key={idx} value={combo}>
                                        {combo}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Deformation scale */}
                    <div>
                        <div style={{
                            fontSize: '12px',
                            fontWeight: 'bold',
                            marginBottom: '8px',
                            color: settings.theme === 'dark' ? '#ccc' : '#666',
                            display: 'flex',
                            justifyContent: 'space-between'
                        }}>
                            <span>Deformation Scale</span>
                            <span>{settings.deformationScale}x</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="500"
                            value={settings.deformationScale}
                            onChange={(e) => onSettingsChange({
                                ...settings,
                                deformationScale: Number(e.target.value)
                            })}
                            style={{ width: '100%' }}
                        />
                    </div>

                    {/* Display options */}
                    <div>
                        <div style={{
                            fontSize: '12px',
                            fontWeight: 'bold',
                            marginBottom: '8px',
                            color: settings.theme === 'dark' ? '#ccc' : '#666'
                        }}>
                            Display Options
                        </div>

                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: settings.theme === 'dark' ? '#fff' : '#333'
                        }}>
                            <input
                                type="checkbox"
                                checked={settings.showDeformed}
                                onChange={(e) => onSettingsChange({
                                    ...settings,
                                    showDeformed: e.target.checked
                                })}
                            />
                            Show Deformed Shape
                        </label>

                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: settings.theme === 'dark' ? '#fff' : '#333'
                        }}>
                            <input
                                type="checkbox"
                                checked={settings.showDiagrams.moment}
                                onChange={(e) => onSettingsChange({
                                    ...settings,
                                    showDiagrams: { ...settings.showDiagrams, moment: e.target.checked }
                                })}
                            />
                            Show BM Diagram
                        </label>

                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: settings.theme === 'dark' ? '#fff' : '#333'
                        }}>
                            <input
                                type="checkbox"
                                checked={settings.showDiagrams.shear}
                                onChange={(e) => onSettingsChange({
                                    ...settings,
                                    showDiagrams: { ...settings.showDiagrams, shear: e.target.checked }
                                })}
                            />
                            Show SF Diagram
                        </label>

                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: settings.theme === 'dark' ? '#fff' : '#333'
                        }}>
                            <input
                                type="checkbox"
                                checked={settings.showLoads}
                                onChange={(e) => onSettingsChange({
                                    ...settings,
                                    showLoads: e.target.checked
                                })}
                            />
                            Show Loads
                        </label>
                    </div>

                    {/* Theme toggle */}
                    <button
                        onClick={() => onSettingsChange({
                            ...settings,
                            theme: settings.theme === 'light' ? 'dark' : 'light'
                        })}
                        style={{
                            padding: '10px',
                            background: settings.theme === 'dark' ? '#444' : '#f0f0f0',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            color: settings.theme === 'dark' ? '#fff' : '#333',
                            fontSize: '12px',
                            fontWeight: '500'
                        }}
                    >
                        {settings.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                        {settings.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </button>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// MAIN FRAME VIEWER
// ============================================================================

const FrameViewer = () => {
    const [frameData, setFrameData] = useState(null);
    const [selectedMemberId, setSelectedMemberId] = useState(null);
    const [selectedSectionData, setSelectedSectionData] = useState(null);
    const [settings, setSettings] = useState({
        theme: 'light',
        showDeformed: false,
        deformationScale: 100,
        showDiagrams: {
            moment: true,
            shear: true,
            axial: false
        },
        showLoads: true
    });
    const [layout, setLayout] = useState('split'); // 'split', '3d-only', 'charts-only'

    // Get selected member data for charts
    const selectedMemberData = useMemo(() => {
        if (!frameData || !selectedMemberId) return null;

        const member = frameData.members.find(m => m.id === selectedMemberId);
        if (!member || !member.sections) return null;

        return {
            bendingMoment: member.sections.map(s => ({
                x: s.position,
                Mz: s.Mz,
                My: s.My
            })),
            shearForce: member.sections.map(s => ({
                x: s.position,
                Vy: s.Vy,
                Vz: s.Vz
            })),
            axialForce: member.sections.map(s => ({
                x: s.position,
                N: s.N
            })),
            deflection: member.sections.map(s => ({
                x: s.position,
                delta_y: s.delta_y,
                delta_z: s.delta_z
            })),
            length: member.length
        };
    }, [frameData, selectedMemberId]);

    const handleMemberSelect = useCallback((memberId) => {
        setSelectedMemberId(memberId);
    }, []);

    const handleLoadFile = useCallback((data) => {
        setFrameData(data);
        setSelectedMemberId(null);
    }, []);

    const handleExportData = useCallback(() => {
        if (!frameData) {
            alert('No data to export');
            return;
        }

        const json = JSON.stringify(frameData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `frame_analysis_${new Date().toISOString()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }, [frameData]);

    const handleAnalyze = async () => {
        try {
            const res = await fetch('http://localhost:8001/api/framed/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    floors: 3,
                    bays: 2,
                    story_height: 3.5,
                    bay_width: 5.0,
                    lateral_load: 50,
                    vertical_load: 25,
                    concrete_grade: 'C30',
                    steel_grade: 500
                })
            });
            const data = await res.json();
            setFrameData(data);
        } catch (error) {
            console.error("Analysis failed:", error);
            alert("Failed to run analysis");
        }
    };

    const bgColor = settings.theme === 'dark' ? '#1a1a1a' : '#f5f5f5';
    const panelBg = settings.theme === 'dark' ? '#2d2d2d' : '#ffffff';

    return (
        <div style={{
            width: '100%',
            height: '100%',
            background: bgColor,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative'
        }}>
            {/* Header */}
            <div style={{
                height: '60px',
                background: panelBg,
                borderBottom: `1px solid ${settings.theme === 'dark' ? '#444' : '#ddd'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    color: settings.theme === 'dark' ? '#fff' : '#333'
                }}>
                    <Layers size={28} />
                    <div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                            RC Frame Analyzer
                        </div>
                        <div style={{ fontSize: '11px', opacity: 0.7 }}>
                            BS 8110 Compliant Analysis & Visualization
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                        onClick={handleAnalyze}
                        style={{
                            padding: '8px 20px',
                            background: '#ff4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <Play size={16} />
                        Run Analysis
                    </button>

                    {/* Layout toggles */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => setLayout('3d-only')}
                            style={{
                                padding: '8px 16px',
                                background: layout === '3d-only' ? '#2196F3' : 'transparent',
                                color: layout === '3d-only' ? '#fff' : (settings.theme === 'dark' ? '#ccc' : '#666'),
                                border: `1px solid ${settings.theme === 'dark' ? '#555' : '#ddd'}`,
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            3D Only
                        </button>
                        <button
                            onClick={() => setLayout('split')}
                            style={{
                                padding: '8px 16px',
                                background: layout === 'split' ? '#2196F3' : 'transparent',
                                color: layout === 'split' ? '#fff' : (settings.theme === 'dark' ? '#ccc' : '#666'),
                                border: `1px solid ${settings.theme === 'dark' ? '#555' : '#ddd'}`,
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            Split View
                        </button>
                        <button
                            onClick={() => setLayout('charts-only')}
                            style={{
                                padding: '8px 16px',
                                background: layout === 'charts-only' ? '#2196F3' : 'transparent',
                                color: layout === 'charts-only' ? '#fff' : (settings.theme === 'dark' ? '#ccc' : '#666'),
                                border: `1px solid ${settings.theme === 'dark' ? '#555' : '#ddd'}`,
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            Charts Only
                        </button>
                    </div>
                </div>
            </div>

            {/* Main content area */}
            <div style={{ flex: 1, display: 'flex', position: 'relative', minHeight: 0 }}>

                {/* Control panel overlay */}
                <ControlPanel
                    settings={settings}
                    onSettingsChange={setSettings}
                    onLoadFile={handleLoadFile}
                    onExportData={handleExportData}
                    loadCombinations={frameData ? [frameData.combination] : []}
                    selectedCombo={frameData?.combination}
                    onComboChange={() => { }}
                />

                {/* 3D View */}
                {(layout === '3d-only' || layout === 'split') && (
                    <div style={{
                        flex: layout === 'split' ? 1 : 1,
                        position: 'relative',
                        minHeight: 0,
                        minWidth: 0
                    }}>
                        <Frame3D
                            data={frameData}
                            showDeformed={settings.showDeformed}
                            deformationScale={settings.deformationScale}
                            showDiagrams={settings.showDiagrams}
                            onMemberSelect={handleMemberSelect}
                        />
                    </div>
                )}

                {/* Charts and Section View */}
                {(layout === 'charts-only' || layout === 'split') && (
                    <div style={{
                        flex: layout === 'split' ? 1 : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        padding: '16px',
                        minHeight: 0,
                        minWidth: 0,
                        overflowY: 'auto'
                    }}>
                        {/* Charts */}
                        <div style={{
                            flex: 2,
                            minHeight: '400px',
                            background: panelBg,
                            borderRadius: '8px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}>
                            <BM_SF_Chart
                                memberData={selectedMemberData}
                                showEnvelope={false}
                            />
                        </div>

                        {/* Cross section */}
                        <div style={{
                            flex: 1,
                            minHeight: '300px',
                            background: panelBg,
                            borderRadius: '8px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            padding: '16px'
                        }}>
                            <CrossSection2D
                                sectionData={selectedSectionData}
                                theme={settings.theme}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FrameViewer;