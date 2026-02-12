import React, { useState } from 'react';
import { X, Search } from 'lucide-react';

const ResultModal = ({ title, onClose, children }) => (
    <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '900px',
        maxWidth: '95vw',
        height: '80vh',
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    }}>
        <div style={{
            padding: '16px',
            borderBottom: '1px solid #eee',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8f9fa'
        }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>{title}</h3>
            <button
                onClick={onClose}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#666',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <X size={20} />
            </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            {children}
        </div>
    </div>
);

const DetailPopup = ({ title, data, onClose, position }) => (
    <div style={{
        position: 'absolute',
        top: position.y,
        left: position.x,
        width: '300px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
        zIndex: 1001,
        border: '1px solid #eee',
        padding: '16px'
    }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <strong style={{ fontSize: '15px' }}>{title}</strong>
            <X size={16} style={{ cursor: 'pointer', color: '#999' }} onClick={onClose} />
        </div>
        <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(data).map(([key, value]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #eee', paddingBottom: '4px' }}>
                    <span style={{ color: '#666' }}>{key}:</span>
                    <span style={{ fontWeight: 500 }}>{value}</span>
                </div>
            ))}
        </div>
    </div>
);

export const AnalysisResultsViewer = ({ elements, results, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');

    const filteredElements = elements.filter(el => {
        const matchesSearch = el.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || el.type === filterType;
        return matchesSearch && matchesType;
    });

    return (
        <ResultModal title="Analysis Results" onClose={onClose}>
            <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                    <input
                        type="text"
                        placeholder="Search element ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '8px 8px 8px 32px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                </div>
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', minWidth: '150px' }}
                >
                    <option value="all">All Types</option>
                    <option value="column">Columns</option>
                    <option value="beam">Beams</option>
                    <option value="slab">Slabs</option>
                    <option value="wall">Walls</option>
                </select>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                    <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                        <th style={thStyle}>ID</th>
                        <th style={thStyle}>Type</th>
                        <th style={thStyle}>Dimensions (mm)</th>
                        <th style={thStyle}>Axial Load (kN)</th>
                        <th style={thStyle}>Max Moment (kNm)</th>
                        <th style={thStyle}>Max Shear (kN)</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredElements.map(el => {
                        const res = results[el.id] || {};
                        const dims = el.type === 'column' || el.type === 'beam'
                            ? `${(el.properties.width || 0) * 1000}x${(el.properties.depth || 0) * 1000}`
                            : el.type === 'slab' || el.type === 'wall'
                                ? `Thk: ${(el.properties.thickness || el.properties.depth || 0) * 1000}`
                                : '-';

                        return (
                            <tr key={el.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={tdStyle}><strong>{el.id}</strong></td>
                                <td style={tdStyle}><span style={typeBadgeStyle(el.type)}>{el.type}</span></td>
                                <td style={tdStyle}>{dims}</td>
                                <td style={tdStyle}>{(res.N_max || 0).toFixed(2)}</td>
                                <td style={tdStyle}>{(res.M_max || 0).toFixed(2)}</td>
                                <td style={tdStyle}>{(res.V_max || 0).toFixed(2)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </ResultModal>
    );
};

export const DesignResultsViewer = ({ elements, results, onClose }) => {
    const [selectedItem, setSelectedItem] = useState(null);
    const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
    const [searchTerm, setSearchTerm] = useState('');

    const handleRowClick = (e, el, res) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPopupPos({
            x: rect.right + 10,
            y: rect.top
        });

        // Prepare detail data
        const detailData = {
            "Element ID": el.id,
            "Type": el.type,
            "Dimensions": el.type === 'column' || el.type === 'beam'
                ? `${(el.properties.width || 0) * 1000}x${(el.properties.depth || 0) * 1000} mm`
                : '-',
            "Material": el.properties.materialGrade || 'C30',
            "Axial Load (N)": `${(res.N_max || 0).toFixed(2)} kN`,
            "Moment (M)": `${(res.M_max || 0).toFixed(2)} kNm`,
            "Shear (V)": `${(res.V_max || 0).toFixed(2)} kN`,
            "Status": res.status || 'OK',
            "Utility Ratio": res.utilityRatio ? res.utilityRatio.toFixed(2) : '-'
        };

        if (el.type === 'column' && res.designResults) {
            detailData["Main Steel"] = res.designResults.mainSteel || '-';
            detailData["Links"] = res.designResults.links || '-';
            detailData["Area Required"] = res.designResults.astRequired ? `${res.designResults.astRequired.toFixed(0)} mm²` : '-';
        } else if (el.type === 'beam' && res.designResults) {
            detailData["Top Steel"] = res.designResults.topSteel || '-';
            detailData["Bottom Steel"] = res.designResults.bottomSteel || '-';
            detailData["Shear Links"] = res.designResults.links || '-';
        }

        setSelectedItem({ id: el.id, data: detailData });
    };

    const filteredElements = elements.filter(el =>
        (el.type === 'column' || el.type === 'beam' || el.type === 'slab') &&
        el.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <ResultModal title="Design Results" onClose={onClose}>
            <div style={{ marginBottom: '16px', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                <input
                    type="text"
                    placeholder="Search element ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '8px 8px 8px 32px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                    <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                        <th style={thStyle}>ID</th>
                        <th style={thStyle}>Type</th>
                        <th style={thStyle}>Load (kN)</th>
                        <th style={thStyle}>Moment (kNm)</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredElements.map(el => {
                        const res = results[el.id] || {};
                        return (
                            <tr key={el.id} style={{ borderBottom: '1px solid #eee', cursor: 'pointer', ':hover': { background: '#f9f9f9' } }}>
                                <td style={tdStyle}><strong>{el.id}</strong></td>
                                <td style={tdStyle}><span style={typeBadgeStyle(el.type)}>{el.type}</span></td>
                                <td style={tdStyle}>{(res.N_max || 0).toFixed(2)}</td>
                                <td style={tdStyle}>{(res.M_max || 0).toFixed(2)}</td>
                                <td style={tdStyle}>
                                    <span style={{
                                        color: res.status === 'FAIL' ? '#d32f2f' : '#388e3c',
                                        background: res.status === 'FAIL' ? '#ffebee' : '#e8f5e9',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '11px',
                                        fontWeight: 600
                                    }}>
                                        {res.status || 'OK'}
                                    </span>
                                </td>
                                <td style={tdStyle}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRowClick(e, el, res); }}
                                        style={{
                                            padding: '4px 12px',
                                            background: '#2196F3',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '11px'
                                        }}
                                    >
                                        View Detail
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {selectedItem && (
                <DetailPopup
                    title={`Details: ${selectedItem.id}`}
                    data={selectedItem.data}
                    onClose={() => setSelectedItem(null)}
                    position={popupPos}
                />
            )}
        </ResultModal>
    );
};

// Styles
const thStyle = { padding: '12px', borderBottom: '2px solid #ddd', fontWeight: 600, color: '#555' };
const tdStyle = { padding: '12px', color: '#333' };
const typeBadgeStyle = (type) => ({
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '11px',
    backgroundColor: type === 'column' ? '#e3f2fd' : type === 'beam' ? '#fff3e0' : '#f3e5f5',
    color: type === 'column' ? '#1565c0' : type === 'beam' ? '#e65100' : '#7b1fa2',
    textTransform: 'capitalize'
});
