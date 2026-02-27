
import React, { useState } from 'react';
import {
    Eye, Play, Box, Layout, Plus, Square, Minus, Grid, X,
    MousePointer, Save, FolderOpen, Maximize2, Minimize2,
    ChevronDown, Settings, Calculator, Library, Trash2, Copy, Activity, Layers
} from 'lucide-react';
import { CheckCircle } from 'lucide-react';

const StructureBuilderToolbar = ({
    tool,
    onToolChange,
    onAction,
    view,
    onViewChange,
    isFullScreen,
    onFullScreenChange,
    onSidebarToggle,
    onSave,
    onLoad,
    onRunAnalysis,
    onRunDesign,
    hasAnalysisResults,
    hasDesignResults,
    onViewAnalysisResults,
    onViewDesignResults,
    analysisMethod = 'moment_distribution',
    onAnalysisMethodChange,
    materialType = 'concrete'
}) => {
    const [activeTab, setActiveTab] = useState('view'); // 'view', 'design', 'members', 'edit', 'steel_bim'

    const tabs = [
        { id: 'view', label: 'View', icon: Eye },
        { id: 'design', label: 'Design', icon: Play },
        { id: 'members', label: 'Members', icon: Box },
        { id: 'edit', label: 'Edit', icon: Layout },
        ...(materialType === 'steel' ? [{ id: 'steel_bim', label: 'Steel BIM', icon: Layout }] : [])
    ];

    const renderSubToolbar = () => {
        switch (activeTab) {
            case 'view':
                return (
                    <div style={subToolbarStyle}>
                        <ToolbarButton
                            active={view === '2d'}
                            onClick={() => onViewChange('2d')}
                            icon={Layout}
                            label="2D View"
                        />
                        <ToolbarButton
                            active={view === '3d'}
                            onClick={() => onViewChange('3d')}
                            icon={Box}
                            label="3D View"
                        />
                        <ToolbarButton
                            active={view === 'analysis_3d'}
                            onClick={() => onViewChange('analysis_3d')}
                            icon={Activity}
                            label="Wireframe"
                        />
                        <ToolbarButton
                            active={false}
                            onClick={() => onAction('cad_view')}
                            icon={Settings}
                            label="CAD Drawer"
                        />
                    </div>
                );
            case 'design':
                return (
                    <div style={subToolbarStyle}>
                        <ToolbarButton
                            onClick={onRunAnalysis}
                            icon={Calculator}
                            label="Run Analysis"
                            color="#2196F3"
                        />
                        {hasAnalysisResults && (
                            <ToolbarButton
                                onClick={onViewAnalysisResults}
                                icon={Activity}
                                label="View Analysis"
                                color="#1976D2"
                            />
                        )}
                        <div style={{ width: '1px', height: '20px', background: '#ddd', margin: '0 8px' }} />

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f5f5f5', borderRadius: '4px', padding: '2px' }}>
                            <ToolbarButton
                                active={analysisMethod === 'moment_distribution'}
                                onClick={() => onAnalysisMethodChange('moment_distribution')}
                                icon={Box}
                                label="Moment Dist."
                                color={analysisMethod === 'moment_distribution' ? '#2196F3' : '#666'}
                            />
                            <ToolbarButton
                                active={analysisMethod === 'stiffness'}
                                onClick={() => onAnalysisMethodChange('stiffness')}
                                icon={Layers}
                                label="Stiffness Matrix"
                                color={analysisMethod === 'stiffness' ? '#2196F3' : '#666'}
                            />
                        </div>

                        <ToolbarButton
                            onClick={onRunDesign}
                            icon={Play}
                            label="Run Design"
                            color="#4CAF50"
                        />
                        {hasDesignResults && (
                            <ToolbarButton
                                onClick={onViewDesignResults}
                                icon={CheckCircle}
                                label="View Design"
                                color="#388E3C"
                            />
                        )}
                    </div>
                );
            case 'members':
                return (
                    <div style={subToolbarStyle}>
                        <ToolbarButton
                            active={false}
                            onClick={() => onAction('add_bay')}
                            icon={Plus}
                            label="Add Bay"
                            color="#FF5722"
                        />
                        <ToolbarButton
                            active={tool === 'column'}
                            onClick={() => onToolChange('column')}
                            icon={Square}
                            label="Column"
                            color="#2196F3"
                        />
                        <ToolbarButton
                            active={tool === 'beam'}
                            onClick={() => onToolChange('beam')}
                            icon={Minus}
                            label="Beam"
                            color="#4CAF50"
                        />
                        <ToolbarButton
                            active={tool === 'slab'}
                            onClick={() => onToolChange('slab')}
                            icon={Grid}
                            label="Slab"
                            color="#FF9800"
                        />
                        <ToolbarButton
                            active={tool === 'wall'}
                            onClick={() => onToolChange('wall')}
                            icon={Box}
                            label="Wall"
                            color="#9C27B0"
                        />
                        <ToolbarButton
                            active={tool === 'void'}
                            onClick={() => onToolChange('void')}
                            icon={X}
                            label="Void"
                            color="#f44336"
                        />
                    </div>
                );
            case 'steel_bim':
                return (
                    <div style={subToolbarStyle}>
                        <ToolbarButton
                            active={view === 'steel_bim'}
                            onClick={() => onViewChange('steel_bim')}
                            icon={Box}
                            label="3D Dashboard"
                            color="#f97316"
                        />
                        <ToolbarButton
                            active={false}
                            onClick={() => onAction('steel_catalog')}
                            icon={Library}
                            label="Steel Catalog"
                        />
                    </div>
                );
            case 'edit':
                return (
                    <div style={subToolbarStyle}>
                        <ToolbarButton
                            active={tool === 'select'}
                            onClick={() => onToolChange('select')}
                            icon={MousePointer}
                            label="Select"
                        />
                        <ToolbarButton
                            onClick={() => onAction('copy')}
                            icon={Copy}
                            label="Copy"
                        />
                        <ToolbarButton
                            onClick={() => onAction('delete')}
                            icon={Trash2}
                            label="Delete"
                            color="#f44336"
                        />
                        <ToolbarButton
                            onClick={() => onAction('library')}
                            icon={Library}
                            label="Library"
                        />
                        <ToolbarButton
                            onClick={onSave}
                            icon={Save}
                            label="Save"
                        />
                        <ToolbarButton
                            onClick={onLoad}
                            icon={FolderOpen}
                            label="Open"
                        />
                    </div>
                );
            case 'steel_bim':
                return (
                    <div style={subToolbarStyle}>
                        <ToolbarButton
                            onClick={() => onAction('steel_bim_panel')}
                            icon={Layout}
                            label="BIM Dashboard"
                            color="#e67e22"
                        />
                        <ToolbarButton
                            onClick={() => onAction('library')}
                            icon={Library}
                            label="Steel Catalog"
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div style={toolbarContainerStyle}>
            {/* Main Tabs */}
            <div style={mainTabsStyle}>
                <div style={{ display: 'flex' }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                ...tabButtonStyle,
                                borderBottom: activeTab === tab.id ? '3px solid #2196F3' : '3px solid transparent',
                                color: activeTab === tab.id ? '#2196F3' : '#666',
                                background: activeTab === tab.id ? '#f0f7ff' : 'transparent'
                            }}
                        >
                            <tab.icon size={18} />
                            <span style={{ fontWeight: activeTab === tab.id ? 'bold' : 'normal' }}>{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '8px', paddingRight: '16px' }}>
                    <button onClick={onSidebarToggle} style={iconButtonStyle} title="Toggle Sidebar">
                        <Layout size={18} />
                    </button>
                    <button onClick={() => onFullScreenChange(!isFullScreen)} style={iconButtonStyle} title="Fullscreen">
                        {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                </div>
            </div>

            {/* Sub-toolbar */}
            <div style={subToolbarContainerStyle}>
                {renderSubToolbar()}
            </div>
        </div>
    );
};

const ToolbarButton = ({ active, onClick, icon: Icon, label, color }) => (
    <button
        onClick={onClick}
        style={{
            ...subTabButtonStyle,
            background: active ? '#f0f0f0' : 'transparent',
            border: active ? '1px solid #ddd' : '1px solid transparent',
            color: color || (active ? '#2196F3' : '#555')
        }}
    >
        <Icon size={16} />
        <span>{label}</span>
    </button>
);

// Styles
const toolbarContainerStyle = {
    background: '#fff',
    borderBottom: '1px solid #ddd',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
};

const mainTabsStyle = {
    height: '50px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #eee',
    paddingLeft: '8px'
};

const subToolbarContainerStyle = {
    height: '50px',
    background: '#fcfcfc',
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px'
};

const subToolbarStyle = {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
};

const tabButtonStyle = {
    height: '50px',
    padding: '0 20px',
    border: 'none',
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s ease'
};

const subTabButtonStyle = {
    padding: '6px 12px',
    borderRadius: '4px',
    border: '1px solid transparent',
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s ease'
};

const iconButtonStyle = {
    width: '36px',
    height: '36px',
    borderRadius: '4px',
    border: '1px solid #eee',
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#666'
};

export default StructureBuilderToolbar;
