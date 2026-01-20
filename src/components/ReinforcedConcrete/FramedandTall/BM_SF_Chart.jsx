import React, { useState, useMemo } from 'react';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
    Label
} from 'recharts';
import { Download, Maximize2, Grid, TrendingUp } from 'lucide-react';

// ============================================================================
// CUSTOM TOOLTIP
// ============================================================================

const CustomTooltip = ({ active, payload, label, unit = 'kNm' }) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
        <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '2px solid #333',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>
                Position: {Number(label).toFixed(2)} m
            </div>
            {payload.map((entry, index) => (
                <div
                    key={index}
                    style={{
                        color: entry.color,
                        fontSize: '12px',
                        marginTop: '4px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '12px'
                    }}
                >
                    <span style={{ fontWeight: '500' }}>{entry.name}:</span>
                    <span style={{ fontWeight: 'bold' }}>{Number(entry.value).toFixed(2)} {unit}</span>
                </div>
            ))}
        </div>
    );
};

// ============================================================================
// CURSOR SYNCHRONIZATION
// ============================================================================

const SyncCursor = ({ chartRefs, activeIndex, setActiveIndex }) => {
    const handleMouseMove = (state) => {
        if (state && state.activeTooltipIndex !== undefined) {
            setActiveIndex(state.activeTooltipIndex);
        }
    };

    const handleMouseLeave = () => {
        setActiveIndex(null);
    };

    return null;
};

// ============================================================================
// BENDING MOMENT CHART
// ============================================================================

const BendingMomentChart = ({
    data,
    showEnvelope = false,
    envelopeData = null,
    activeIndex,
    onMouseMove,
    onMouseLeave,
    memberLength
}) => {
    const [showFill, setShowFill] = useState(true);

    if (!data || data.length === 0) {
        return (
            <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999'
            }}>
                No moment data available
            </div>
        );
    }

    // Find max/min for scaling
    const values = data.flatMap(d => [d.Mz || 0, d.My || 0]);
    const maxVal = Math.max(...values.map(Math.abs));
    const yDomain = [-maxVal * 1.1, maxVal * 1.1];

    return (
        <div style={{ height: '100%', position: 'relative' }}>
            {/* Chart controls */}
            <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                zIndex: 10,
                display: 'flex',
                gap: '8px'
            }}>
                <button
                    onClick={() => setShowFill(!showFill)}
                    style={{
                        padding: '6px 12px',
                        background: showFill ? '#4CAF50' : '#fff',
                        color: showFill ? '#fff' : '#333',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}
                >
                    <Grid size={14} />
                    Fill
                </button>
            </div>

            <ResponsiveContainer width="100%" height="100%">
                {showFill ? (
                    <AreaChart
                        data={data}
                        margin={{ top: 20, right: 30, left: 60, bottom: 40 }}
                        onMouseMove={onMouseMove}
                        onMouseLeave={onMouseLeave}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis
                            dataKey="x"
                            domain={[0, memberLength || 'dataMax']}
                            type="number"
                            stroke="#666"
                        >
                            <Label value="Distance along member (m)" offset={-10} position="insideBottom" style={{ fontSize: '12px' }} />
                        </XAxis>
                        <YAxis
                            domain={yDomain}
                            stroke="#666"
                        >
                            <Label value="Bending Moment (kNm)" angle={-90} position="insideLeft" style={{ fontSize: '12px' }} />
                        </YAxis>
                        <Tooltip content={<CustomTooltip unit="kNm" />} />
                        <Legend
                            wrapperStyle={{ fontSize: '12px' }}
                            iconType="line"
                        />

                        <ReferenceLine y={0} stroke="#000" strokeWidth={1.5} />

                        {/* Envelope if provided */}
                        {showEnvelope && envelopeData && (
                            <>
                                <Area
                                    type="monotone"
                                    dataKey="Mz_max"
                                    data={envelopeData}
                                    stroke="#ff6b6b"
                                    fill="#ff6b6b"
                                    fillOpacity={0.2}
                                    strokeWidth={1}
                                    strokeDasharray="5 5"
                                    name="Mz Max Envelope"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="Mz_min"
                                    data={envelopeData}
                                    stroke="#4ecdc4"
                                    fill="#4ecdc4"
                                    fillOpacity={0.2}
                                    strokeWidth={1}
                                    strokeDasharray="5 5"
                                    name="Mz Min Envelope"
                                />
                            </>
                        )}

                        {/* Main moment diagram */}
                        <Area
                            type="monotone"
                            dataKey="Mz"
                            stroke="#e74c3c"
                            fill="#e74c3c"
                            fillOpacity={0.6}
                            strokeWidth={2.5}
                            name="Mz (Major Axis)"
                            dot={false}
                        />

                        {data[0]?.My !== undefined && (
                            <Area
                                type="monotone"
                                dataKey="My"
                                stroke="#3498db"
                                fill="#3498db"
                                fillOpacity={0.4}
                                strokeWidth={2}
                                name="My (Minor Axis)"
                                dot={false}
                            />
                        )}
                    </AreaChart>
                ) : (
                    <LineChart
                        data={data}
                        margin={{ top: 20, right: 30, left: 60, bottom: 40 }}
                        onMouseMove={onMouseMove}
                        onMouseLeave={onMouseLeave}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis
                            dataKey="x"
                            domain={[0, memberLength || 'dataMax']}
                            type="number"
                            stroke="#666"
                        >
                            <Label value="Distance along member (m)" offset={-10} position="insideBottom" style={{ fontSize: '12px' }} />
                        </XAxis>
                        <YAxis domain={yDomain} stroke="#666">
                            <Label value="Bending Moment (kNm)" angle={-90} position="insideLeft" style={{ fontSize: '12px' }} />
                        </YAxis>
                        <Tooltip content={<CustomTooltip unit="kNm" />} />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />

                        <ReferenceLine y={0} stroke="#000" strokeWidth={1.5} />

                        <Line
                            type="monotone"
                            dataKey="Mz"
                            stroke="#e74c3c"
                            strokeWidth={2.5}
                            name="Mz (Major Axis)"
                            dot={false}
                        />

                        {data[0]?.My !== undefined && (
                            <Line
                                type="monotone"
                                dataKey="My"
                                stroke="#3498db"
                                strokeWidth={2}
                                name="My (Minor Axis)"
                                dot={false}
                            />
                        )}
                    </LineChart>
                )}
            </ResponsiveContainer>
        </div>
    );
};

// ============================================================================
// SHEAR FORCE CHART
// ============================================================================

const ShearForceChart = ({
    data,
    showEnvelope = false,
    envelopeData = null,
    activeIndex,
    onMouseMove,
    onMouseLeave,
    memberLength
}) => {
    const [showFill, setShowFill] = useState(false);

    if (!data || data.length === 0) {
        return (
            <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999'
            }}>
                No shear data available
            </div>
        );
    }

    const values = data.flatMap(d => [d.Vy || 0, d.Vz || 0]);
    const maxVal = Math.max(...values.map(Math.abs));
    const yDomain = [-maxVal * 1.1, maxVal * 1.1];

    return (
        <div style={{ height: '100%', position: 'relative' }}>
            <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                zIndex: 10,
                display: 'flex',
                gap: '8px'
            }}>
                <button
                    onClick={() => setShowFill(!showFill)}
                    style={{
                        padding: '6px 12px',
                        background: showFill ? '#4CAF50' : '#fff',
                        color: showFill ? '#fff' : '#333',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}
                >
                    <Grid size={14} />
                    Fill
                </button>
            </div>

            <ResponsiveContainer width="100%" height="100%">
                {showFill ? (
                    <AreaChart
                        data={data}
                        margin={{ top: 20, right: 30, left: 60, bottom: 40 }}
                        onMouseMove={onMouseMove}
                        onMouseLeave={onMouseLeave}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis
                            dataKey="x"
                            domain={[0, memberLength || 'dataMax']}
                            type="number"
                            stroke="#666"
                        >
                            <Label value="Distance along member (m)" offset={-10} position="insideBottom" style={{ fontSize: '12px' }} />
                        </XAxis>
                        <YAxis domain={yDomain} stroke="#666">
                            <Label value="Shear Force (kN)" angle={-90} position="insideLeft" style={{ fontSize: '12px' }} />
                        </YAxis>
                        <Tooltip content={<CustomTooltip unit="kN" />} />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />

                        <ReferenceLine y={0} stroke="#000" strokeWidth={1.5} />

                        {showEnvelope && envelopeData && (
                            <>
                                <Area
                                    type="stepAfter"
                                    dataKey="Vy_max"
                                    data={envelopeData}
                                    stroke="#ff6b6b"
                                    fill="#ff6b6b"
                                    fillOpacity={0.2}
                                    strokeWidth={1}
                                    strokeDasharray="5 5"
                                    name="Vy Max Envelope"
                                />
                                <Area
                                    type="stepAfter"
                                    dataKey="Vy_min"
                                    data={envelopeData}
                                    stroke="#4ecdc4"
                                    fill="#4ecdc4"
                                    fillOpacity={0.2}
                                    strokeWidth={1}
                                    strokeDasharray="5 5"
                                    name="Vy Min Envelope"
                                />
                            </>
                        )}

                        <Area
                            type="stepAfter"
                            dataKey="Vy"
                            stroke="#9b59b6"
                            fill="#9b59b6"
                            fillOpacity={0.6}
                            strokeWidth={2.5}
                            name="Vy (Major Axis)"
                            dot={false}
                        />

                        {data[0]?.Vz !== undefined && (
                            <Area
                                type="stepAfter"
                                dataKey="Vz"
                                stroke="#f39c12"
                                fill="#f39c12"
                                fillOpacity={0.4}
                                strokeWidth={2}
                                name="Vz (Minor Axis)"
                                dot={false}
                            />
                        )}
                    </AreaChart>
                ) : (
                    <LineChart
                        data={data}
                        margin={{ top: 20, right: 30, left: 60, bottom: 40 }}
                        onMouseMove={onMouseMove}
                        onMouseLeave={onMouseLeave}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis
                            dataKey="x"
                            domain={[0, memberLength || 'dataMax']}
                            type="number"
                            stroke="#666"
                        >
                            <Label value="Distance along member (m)" offset={-10} position="insideBottom" style={{ fontSize: '12px' }} />
                        </XAxis>
                        <YAxis domain={yDomain} stroke="#666">
                            <Label value="Shear Force (kN)" angle={-90} position="insideLeft" style={{ fontSize: '12px' }} />
                        </YAxis>
                        <Tooltip content={<CustomTooltip unit="kN" />} />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />

                        <ReferenceLine y={0} stroke="#000" strokeWidth={1.5} />

                        <Line
                            type="stepAfter"
                            dataKey="Vy"
                            stroke="#9b59b6"
                            strokeWidth={2.5}
                            name="Vy (Major Axis)"
                            dot={false}
                        />

                        {data[0]?.Vz !== undefined && (
                            <Line
                                type="stepAfter"
                                dataKey="Vz"
                                stroke="#f39c12"
                                strokeWidth={2}
                                name="Vz (Minor Axis)"
                                dot={false}
                            />
                        )}
                    </LineChart>
                )}
            </ResponsiveContainer>
        </div>
    );
};

// ============================================================================
// AXIAL FORCE CHART
// ============================================================================

const AxialForceChart = ({ data, memberLength }) => {
    if (!data || data.length === 0) return null;

    const values = data.map(d => d.N || 0);
    const maxVal = Math.max(...values.map(Math.abs));
    const yDomain = [-maxVal * 1.1, maxVal * 1.1];

    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart
                data={data}
                margin={{ top: 20, right: 30, left: 60, bottom: 40 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                    dataKey="x"
                    domain={[0, memberLength || 'dataMax']}
                    type="number"
                    stroke="#666"
                >
                    <Label value="Distance along member (m)" offset={-10} position="insideBottom" style={{ fontSize: '12px' }} />
                </XAxis>
                <YAxis domain={yDomain} stroke="#666">
                    <Label value="Axial Force (kN)" angle={-90} position="insideLeft" style={{ fontSize: '12px' }} />
                </YAxis>
                <Tooltip content={<CustomTooltip unit="kN" />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />

                <ReferenceLine y={0} stroke="#000" strokeWidth={1.5} />

                <Line
                    type="monotone"
                    dataKey="N"
                    stroke="#16a085"
                    strokeWidth={2.5}
                    name="Axial Force (Tension +)"
                    dot={false}
                />
            </LineChart>
        </ResponsiveContainer>
    );
};

// ============================================================================
// DEFLECTION CHART
// ============================================================================

const DeflectionChart = ({ data, memberLength }) => {
    if (!data || data.length === 0) return null;

    const values = data.flatMap(d => [d.delta_y || 0, d.delta_z || 0]);
    const maxVal = Math.max(...values.map(Math.abs));
    const yDomain = [-maxVal * 1.1, maxVal * 1.1];

    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart
                data={data}
                margin={{ top: 20, right: 30, left: 60, bottom: 40 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                    dataKey="x"
                    domain={[0, memberLength || 'dataMax']}
                    type="number"
                    stroke="#666"
                >
                    <Label value="Distance along member (m)" offset={-10} position="insideBottom" style={{ fontSize: '12px' }} />
                </XAxis>
                <YAxis domain={yDomain} stroke="#666">
                    <Label value="Deflection (mm)" angle={-90} position="insideLeft" style={{ fontSize: '12px' }} />
                </YAxis>
                <Tooltip content={<CustomTooltip unit="mm" />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />

                <ReferenceLine y={0} stroke="#000" strokeWidth={1.5} />

                <Line
                    type="monotone"
                    dataKey="delta_y"
                    stroke="#e67e22"
                    strokeWidth={2.5}
                    name="Deflection Y"
                    dot={false}
                />

                {data[0]?.delta_z !== undefined && (
                    <Line
                        type="monotone"
                        dataKey="delta_z"
                        stroke="#2ecc71"
                        strokeWidth={2}
                        name="Deflection Z"
                        dot={false}
                    />
                )}
            </LineChart>
        </ResponsiveContainer>
    );
};

// ============================================================================
// MAIN BM_SF_CHART COMPONENT
// ============================================================================

const BM_SF_Chart = ({
    memberData,
    showEnvelope = false,
    envelopeData = null,
    onExport
}) => {
    const [activeIndex, setActiveIndex] = useState(null);
    const [activeTab, setActiveTab] = useState('moment');

    if (!memberData) {
        return (
            <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f5f5f5',
                color: '#999'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <TrendingUp size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <div style={{ fontSize: '18px', fontWeight: '500' }}>No Member Selected</div>
                    <div style={{ fontSize: '14px', marginTop: '8px' }}>Click on a member in the 3D view to see diagrams</div>
                </div>
            </div>
        );
    }

    const { bendingMoment, shearForce, axialForce, deflection, length } = memberData;

    const tabs = [
        { id: 'moment', label: 'Bending Moment', icon: <TrendingUp size={16} /> },
        { id: 'shear', label: 'Shear Force', icon: <Grid size={16} /> },
        { id: 'axial', label: 'Axial Force', icon: <Maximize2 size={16} /> },
        { id: 'deflection', label: 'Deflection', icon: <TrendingUp size={16} /> },
    ];

    const handleExport = (format) => {
        if (onExport) {
            onExport(memberData, format);
        } else {
            // Default export behavior
            if (format === 'csv') {
                const csv = convertToCSV(memberData);
                downloadFile(csv, 'member_forces.csv', 'text/csv');
            } else if (format === 'json') {
                const json = JSON.stringify(memberData, null, 2);
                downloadFile(json, 'member_forces.json', 'application/json');
            }
        }
    };

    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            overflow: 'hidden'
        }}>
            {/* Header with tabs */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderBottom: '2px solid #e0e0e0',
                background: '#fafafa'
            }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '8px 16px',
                                background: activeTab === tab.id ? '#2196F3' : '#fff',
                                color: activeTab === tab.id ? '#fff' : '#333',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s'
                            }}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Export buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => handleExport('csv')}
                        style={{
                            padding: '8px 12px',
                            background: '#fff',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <Download size={14} />
                        CSV
                    </button>
                    <button
                        onClick={() => handleExport('json')}
                        style={{
                            padding: '8px 12px',
                            background: '#fff',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <Download size={14} />
                        JSON
                    </button>
                </div>
            </div>

            {/* Chart area */}
            <div style={{ flex: 1, padding: '16px', minHeight: 0 }}>
                {activeTab === 'moment' && (
                    <BendingMomentChart
                        data={bendingMoment}
                        showEnvelope={showEnvelope}
                        envelopeData={envelopeData?.moment}
                        activeIndex={activeIndex}
                        onMouseMove={(state) => setActiveIndex(state?.activeTooltipIndex)}
                        onMouseLeave={() => setActiveIndex(null)}
                        memberLength={length}
                    />
                )}

                {activeTab === 'shear' && (
                    <ShearForceChart
                        data={shearForce}
                        showEnvelope={showEnvelope}
                        envelopeData={envelopeData?.shear}
                        activeIndex={activeIndex}
                        onMouseMove={(state) => setActiveIndex(state?.activeTooltipIndex)}
                        onMouseLeave={() => setActiveIndex(null)}
                        memberLength={length}
                    />
                )}

                {activeTab === 'axial' && axialForce && (
                    <AxialForceChart data={axialForce} memberLength={length} />
                )}

                {activeTab === 'deflection' && deflection && (
                    <DeflectionChart data={deflection} memberLength={length} />
                )}
            </div>
        </div>
    );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const convertToCSV = (memberData) => {
    const { bendingMoment, shearForce, axialForce, deflection } = memberData;

    let csv = 'Position (m),Mz (kNm),My (kNm),Vy (kN),Vz (kN),N (kN),Delta_y (mm),Delta_z (mm)\n';

    const maxLength = Math.max(
        bendingMoment?.length || 0,
        shearForce?.length || 0,
        axialForce?.length || 0,
        deflection?.length || 0
    );

    for (let i = 0; i < maxLength; i++) {
        const row = [
            bendingMoment?.[i]?.x || '',
            bendingMoment?.[i]?.Mz || '',
            bendingMoment?.[i]?.My || '',
            shearForce?.[i]?.Vy || '',
            shearForce?.[i]?.Vz || '',
            axialForce?.[i]?.N || '',
            deflection?.[i]?.delta_y || '',
            deflection?.[i]?.delta_z || ''
        ];
        csv += row.join(',') + '\n';
    }

    return csv;
};

const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};

export default BM_SF_Chart;
