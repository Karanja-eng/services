
import React from 'react';
import {
    MousePointer,
    Square,
    Minus,
    Grid,
    X,
    Box,
    Plus,
    Layout,
    Trash2,
    Copy,
    Library,
    Grid3x3,
    Maximize2,
    Minimize2,
    Play,
    Eye,
    EyeOff,
    Settings,
    ChevronDown,
    ChevronUp,
    Layers,
    ChevronLeft,
    ChevronRight,
    FolderOpen,
    Save,
    Building2 // Added for Header if needed, though Header is in main app usually
} from 'lucide-react';

// ============================================================================
// LAYER CONTROL PANEL
// ============================================================================
export const LayerControlPanel = ({ layers, onToggleLayer }) => {
    return (
        <div style={{
            background: 'white',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            minWidth: '200px'
        }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
                Visiblity Layers
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(layers).map(([key, isVisible]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', textTransform: 'capitalize' }}>
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <button
                            onClick={() => onToggleLayer(key)}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                                color: isVisible ? '#2196F3' : '#ccc'
                            }}
                        >
                            {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ============================================================================
// TOOLBAR COMPONENT
// ============================================================================

export const Toolbar = ({ tool, onToolChange, onAction, disabled, view, onViewChange, isFullScreen, onFullScreenChange, isSidebarVisible, onSidebarToggle, onSave, onLoad }) => {
    const tools = [
        { id: 'select', icon: MousePointer, label: 'Select', color: '#333' },
        { id: 'column', icon: Square, label: 'Column', color: '#2196F3' },
        { id: 'beam', icon: Minus, label: 'Beam', color: '#4CAF50' },
        { id: 'slab', icon: Grid, label: 'Slab', color: '#FF9800' },
        { id: 'void', icon: X, label: 'Void', color: '#f44336' },
        { id: 'wall', icon: Box, label: 'Wall', color: '#9C27B0' },
        { id: 'add_bay', icon: Plus, label: 'Add Bay', color: '#FF5722', action: true },
        { id: 'cad_view', icon: Layout, label: 'CAD Drawer', color: '#607D8B', action: true },
    ];

    return (
        <div style={{
            height: '60px',
            background: '#fff',
            borderBottom: '1px solid #ddd',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            zIndex: 10,
        }}>
            {/* Sidebar Toggle */}
            <button
                onClick={onSidebarToggle}
                style={{
                    padding: '8px',
                    background: isSidebarVisible ? '#E3F2FD' : '#fff',
                    color: isSidebarVisible ? '#2196F3' : '#666',
                    border: `1px solid ${isSidebarVisible ? '#2196F3' : '#ddd'}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '8px'
                }}
                title={isSidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
            >
                {isSidebarVisible ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>

            <div style={{ width: '1px', height: '30px', background: '#eee', marginRight: '8px' }} />

            {/* Drawing tools */}
            <div style={{
                display: 'flex',
                gap: '4px',
                padding: '4px',
                background: '#f5f5f5',
                borderRadius: '8px'
            }}>
                {tools.map(t => {
                    const isCADButton = t.id === 'cad_view';
                    const activeLabel = isCADButton && view === 'cad' ? 'Back to Builder' : t.label;
                    const activeIcon = isCADButton && view === 'cad' ? ChevronLeft : t.icon;
                    const activeAction = isCADButton && view === 'cad' ? () => onViewChange('2d') : (t.action ? () => onAction(t.id) : () => onToolChange(t.id));

                    return (
                        <button
                            key={t.id}
                            onClick={activeAction}
                            disabled={disabled}
                            style={{
                                padding: '8px 16px',
                                background: tool === t.id ? t.color : '#fff',
                                color: tool === t.id ? '#fff' : '#333',
                                border: `1px solid ${tool === t.id ? t.color : '#ddd'}`,
                                borderRadius: '6px',
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '13px',
                                fontWeight: '500',
                                opacity: disabled ? 0.5 : 1,
                                transition: 'all 0.2s',
                                boxShadow: tool === t.id ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            {React.createElement(activeIcon, { size: 16 })}
                            {activeLabel}
                        </button>
                    );
                })}
            </div>

            <div style={{ width: '1px', height: '40px', background: '#ddd' }} />

            {/* Actions */}
            <button
                onClick={() => onAction('delete')}
                disabled={disabled}
                style={{
                    padding: '8px 16px',
                    background: '#fff',
                    color: '#f44336',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    opacity: disabled ? 0.5 : 1
                }}
            >
                <Trash2 size={16} />
                Delete
            </button>

            <button
                onClick={() => onAction('copy')}
                disabled={disabled}
                style={{
                    padding: '8px 16px',
                    background: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    opacity: disabled ? 0.5 : 1
                }}
            >
                <Copy size={16} />
                Copy
            </button>

            <button
                onClick={() => onAction('library')}
                style={{
                    padding: '8px 16px',
                    background: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px'
                }}
            >
                <Library size={16} />
                Library
            </button>

            <div style={{ width: '1px', height: '40px', background: '#ddd', margin: '0 8px' }} />

            {/* File Operations */}
            <div style={{ display: 'flex', gap: '4px' }}>
                <label style={{
                    padding: '8px 12px',
                    background: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px'
                }}>
                    <FolderOpen size={16} />
                    Open
                    <input type="file" accept=".json" onChange={onLoad} style={{ display: 'none' }} />
                </label>

                <button
                    onClick={onSave}
                    style={{
                        padding: '8px 12px',
                        background: '#fff',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px'
                    }}
                >
                    <Save size={16} />
                    Save
                </button>
            </div>

            <div style={{ flex: 1 }} />

            {/* View toggle */}
            <div style={{
                display: 'flex',
                gap: '4px',
                padding: '4px',
                background: '#f5f5f5',
                borderRadius: '8px'
            }}>
                <button
                    onClick={() => onViewChange(view === '2d' ? '3d' : '2d')}
                    style={{
                        padding: '8px 16px',
                        background: '#fff',
                        color: view === '3d' ? '#9C27B0' : '#333',
                        border: `1px solid ${view === '3d' ? '#9C27B0' : '#ddd'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: '500'
                    }}
                >
                    {view === '2d' ? <Grid3x3 size={16} /> : <Box size={16} />}
                    {view === '2d' ? '3D View' : '2D View'}
                </button>

                {(view === '3d' || view === 'cad') && (
                    <button
                        onClick={() => onFullScreenChange(!isFullScreen)}
                        style={{
                            padding: '8px 16px',
                            background: isFullScreen ? '#333' : '#2196F3',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                    >
                        {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        {isFullScreen ? 'Exit FS' : 'Full Screen'}
                    </button>
                )}
            </div>

            <div style={{ width: '1px', height: '40px', background: '#ddd' }} />

            {/* Analysis */}
            <button
                onClick={() => onAction('analyze')}
                style={{
                    padding: '10px 20px',
                    background: '#4CAF50',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
            >
                <Play size={18} />
                Run Analysis
            </button>
        </div>
    );
};

// ============================================================================
// PROPERTIES PANEL
// ============================================================================

export const PropertiesPanel = ({ selectedElement, onPropertyChange, onClose }) => {
    if (!selectedElement) {
        return (
            <div style={{
                width: '350px',
                background: '#fff',
                borderLeft: '1px solid #ddd',
                padding: '20px',
                overflowY: 'auto'
            }}>
                <div style={{ textAlign: 'center', color: '#999', marginTop: '100px' }}>
                    <Settings size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <div>No Element Selected</div>
                    <div style={{ fontSize: '12px', marginTop: '8px' }}>
                        Click on an element to view properties
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            width: '350px',
            background: '#fff',
            borderLeft: '1px solid #ddd',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto'
        }}>
            {/* Header */}
            <div style={{
                padding: '16px',
                borderBottom: '1px solid #ddd',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f5f5f5'
            }}>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                    {selectedElement.type.toUpperCase()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px'
                        }}
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Properties */}
            <div style={{ padding: '20px' }}>
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '12px', color: '#666' }}>
                        DIMENSIONS & IDENTITY
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                            ID / Name
                        </label>
                        <input
                            type="text"
                            value={selectedElement.id}
                            onChange={(e) => onPropertyChange('id', e.target.value)} // Note: Requires handling ID change in parent if ID is used as key
                            style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px'
                            }}
                        />
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '12px', color: '#666', marginTop: '16px' }}>
                        DIMENSIONS
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                            Width (mm)
                        </label>
                        <input
                            type="number"
                            value={selectedElement.properties.width}
                            onChange={(e) => onPropertyChange('width', Number(e.target.value))}
                            style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                            Depth (mm)
                        </label>
                        <input
                            type="number"
                            value={selectedElement.properties.depth}
                            onChange={(e) => onPropertyChange('depth', Number(e.target.value))}
                            style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px'
                            }}
                        />
                    </div>

                    {selectedElement.type === 'column' && (
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                                Height (mm)
                            </label>
                            <input
                                type="number"
                                value={selectedElement.properties.height}
                                onChange={(e) => onPropertyChange('height', Number(e.target.value))}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '13px'
                                }}
                            />
                        </div>
                    )}
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '12px', color: '#666' }}>
                        MATERIAL
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                            Concrete Grade
                        </label>
                        <select
                            value={selectedElement.properties.material}
                            onChange={(e) => onPropertyChange('material', e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px'
                            }}
                        >
                            <option value="C25">C25</option>
                            <option value="C30">C30</option>
                            <option value="C35">C35</option>
                            <option value="C40">C40</option>
                            <option value="C50">C50</option>
                        </select>
                    </div>
                </div>

                {/* Analysis Results */}
                {selectedElement.analysisResults && (
                    <div style={{
                        marginTop: '20px',
                        padding: '16px',
                        background: '#f9f9f9',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0'
                    }}>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '12px', color: '#666' }}>
                            ANALYSIS RESULTS
                        </div>

                        <div style={{ fontSize: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <div style={{ color: '#888' }}>Axial Force:</div>
                                <div style={{ fontWeight: 'bold' }}>
                                    {selectedElement.analysisResults.N?.toFixed(1)} kN
                                </div>
                            </div>
                            <div>
                                <div style={{ color: '#888' }}>Moment:</div>
                                <div style={{ fontWeight: 'bold' }}>
                                    {selectedElement.analysisResults.M?.toFixed(1)} kNm
                                </div>
                            </div>
                            <div>
                                <div style={{ color: '#888' }}>Shear:</div>
                                <div style={{ fontWeight: 'bold' }}>
                                    {selectedElement.analysisResults.V?.toFixed(1)} kN
                                </div>
                            </div>
                            <div>
                                <div style={{ color: '#888' }}>Utilization:</div>
                                <div style={{ fontWeight: 'bold', color: selectedElement.analysisResults.utilization > 1 ? '#f44336' : '#4CAF50' }}>
                                    {(selectedElement.analysisResults.utilization * 100)?.toFixed(0)}%
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => {/* Open design details */ }}
                            style={{
                                width: '100%',
                                marginTop: '12px',
                                padding: '10px',
                                background: '#2196F3',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                            }}
                        >
                            <Settings size={16} /> {/* Replaced Calculator with Settings as Calculator import missing */}
                            View Design Details
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
