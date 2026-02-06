
import React, { useState } from 'react';
import {
    X, CheckCircle, AlertCircle, Download, Eye, FileText,
    Layers, Box, Layout, BarChart2, Shield
} from 'lucide-react';

const DesignDashboard = ({ results, onClose, onExportCAD, onViewCrossSection }) => {
    const [activeTab, setActiveTab] = useState('columns');

    if (!results) return null;

    const tabs = [
        { id: 'columns', label: 'Columns', icon: Box, count: results.columns?.length || 0 },
        { id: 'beams', label: 'Beams', icon: MinusIcon, count: results.beams?.length || 0 },
        { id: 'slabs', label: 'Slabs', icon: Layers, count: results.slabs?.length || 0 },
        { id: 'foundations', label: 'Foundations', icon: Layout, count: results.foundations?.length || 0 },
        { id: 'walls', label: 'Walls', icon: Box, count: results.walls?.length || 0 },
    ];

    const renderResults = () => {
        const data = results[activeTab] || [];
        if (data.length === 0) return <div style={emptyStyle}>No members of this type designed.</div>;

        return (
            <div style={tableContainerStyle}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th>Member ID</th>
                            <th>Floor</th>
                            <th>Status</th>
                            <th>Detailing</th>
                            <th>Utilization</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((item, idx) => (
                            <tr key={idx}>
                                <td><span style={idBadgeStyle}>{item.id || `M-${idx + 1}`}</span></td>
                                <td><span style={floorBadgeStyle}>{item.floor || 'N/A'}</span></td>
                                <td>
                                    {item.status === 'PASS' || item.all_spans_ok || item.summary?.all_designs_ok ? (
                                        <div style={passBadgeStyle}><CheckCircle size={14} /> PASS</div>
                                    ) : (
                                        <div style={failBadgeStyle}><AlertCircle size={14} /> FAIL</div>
                                    )}
                                </td>
                                <td>
                                    {item.detailing_summary || (
                                        activeTab === 'columns' ? `${item.bar_selection}H${item.bar_dia} (Links: Ø${item.links_dia}@${item.links_spacing})` :
                                            activeTab === 'beams' ? (item.detailed_span_designs?.[0]?.main_reinforcement_bottom || 'Designed') :
                                                activeTab === 'slabs' ? (item.mainReinforcement || item.reinforcementX || 'Designed') :
                                                    activeTab === 'foundations' ? (item.reinforcement?.main_bars_x || 'Designed') :
                                                        'Designed'
                                    )}
                                </td>
                                <td>
                                    <div style={progressContainerStyle}>
                                        <div style={{ ...progressBarStyle, width: `${(item.utilization_ratio || item.steel_percentage || 50) * 100}%`, background: (item.utilization_ratio || 0.5) > 0.9 ? '#ff4d4f' : '#52c41a' }} />
                                    </div>
                                    <span style={{ fontSize: '11px' }}>{Math.round((item.utilization_ratio || item.steel_percentage / 4 || 0.5) * 100)}%</span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => onViewCrossSection(item)} style={actionButtonStyle} title="View Cross Section">
                                            <Eye size={14} />
                                        </button>
                                        <button onClick={() => onExportCAD(item)} style={actionButtonStyle} title="Export CAD">
                                            <Download size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <div style={headerStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Shield style={{ color: '#2196F3' }} />
                        <h2 style={{ margin: 0, fontSize: '20px', letterSpacing: '-0.5px' }}>Structural Design Report</h2>
                        <div style={summaryBadgeStyle}>
                            {results.summary.passed} Passed / {results.summary.failed} Failed
                        </div>
                    </div>
                    <button onClick={onClose} style={closeButtonStyle}>
                        <X size={20} />
                    </button>
                </div>

                <div style={contentStyle}>
                    {/* Sidebar Tabs */}
                    <div style={sidebarStyle}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    ...sidebarTabStyle,
                                    background: activeTab === tab.id ? '#f0f7ff' : 'transparent',
                                    color: activeTab === tab.id ? '#2196F3' : '#666',
                                    borderRight: activeTab === tab.id ? '3px solid #2196F3' : '3px solid transparent'
                                }}
                            >
                                <tab.icon size={18} />
                                <span>{tab.label}</span>
                                <span style={countBadgeStyle}>{tab.count}</span>
                            </button>
                        ))}
                    </div>

                    {/* Main Results Area */}
                    <div style={mainAreaStyle}>
                        {renderResults()}
                    </div>
                </div>

                <div style={footerStyle}>
                    <button style={primaryButtonStyle}>
                        <Download size={16} /> Export Full Design Report (PDF)
                    </button>
                    <button onClick={onClose} style={secondaryButtonStyle}>Close</button>
                </div>
            </div>
        </div>
    );
};

const MinusIcon = ({ size }) => <div style={{ width: size, height: 2, background: 'currentColor' }} />;

// Styles
const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)'
};

const modalStyle = {
    width: '90%',
    maxWidth: '1100px',
    height: '80vh',
    background: '#fff',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
    overflow: 'hidden',
    animation: 'modalFadeIn 0.3s ease-out'
};

const headerStyle = {
    padding: '20px 24px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#fcfcfc'
};

const contentStyle = {
    flex: 1,
    display: 'flex',
    overflow: 'hidden'
};

const sidebarStyle = {
    width: '200px',
    borderRight: '1px solid #eee',
    background: '#fafafa',
    padding: '12px 0'
};

const sidebarTabStyle = {
    width: '100%',
    padding: '14px 20px',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    textAlign: 'left'
};

const mainAreaStyle = {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
    background: '#fff'
};

const footerStyle = {
    padding: '16px 24px',
    borderTop: '1px solid #eee',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    background: '#fcfcfc'
};

const tableContainerStyle = {
    border: '1px solid #eee',
    borderRadius: '8px',
    overflow: 'hidden'
};

const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px'
};

const idBadgeStyle = {
    background: '#f0f2f5',
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontFamily: 'monospace'
};

const floorBadgeStyle = {
    background: '#fff7e6',
    border: '1px solid #ffd591',
    color: '#d46b08',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600'
};

const passBadgeStyle = {
    color: '#52c41a',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontWeight: '600'
};

const failBadgeStyle = {
    color: '#ff4d4f',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontWeight: '600'
};

const countBadgeStyle = {
    marginLeft: 'auto',
    background: '#eee',
    padding: '2px 6px',
    borderRadius: '10px',
    fontSize: '11px',
    color: '#888'
};

const summaryBadgeStyle = {
    marginLeft: '16px',
    padding: '4px 12px',
    background: '#e6f7ff',
    border: '1px solid #91d5ff',
    borderRadius: '20px',
    color: '#1890ff',
    fontSize: '12px',
    fontWeight: 'bold'
};

const progressContainerStyle = {
    width: '60px',
    height: '6px',
    background: '#eee',
    borderRadius: '3px',
    overflow: 'hidden',
    display: 'inline-block',
    marginRight: '8px'
};

const progressBarStyle = {
    height: '100%',
    transition: 'width 0.3s ease'
};

const actionButtonStyle = {
    width: '28px',
    height: '28px',
    borderRadius: '4px',
    border: '1px solid #eee',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#666',
    transition: 'all 0.2s'
};

const closeButtonStyle = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#999',
    padding: '4px'
};

const primaryButtonStyle = {
    padding: '10px 20px',
    background: '#2196F3',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
};

const secondaryButtonStyle = {
    padding: '10px 20px',
    background: '#fff',
    color: '#666',
    border: '1px solid #ddd',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold'
};

const emptyStyle = {
    padding: '40px',
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic'
};

export default DesignDashboard;
