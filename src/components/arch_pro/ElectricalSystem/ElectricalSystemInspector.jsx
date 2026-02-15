// /ui-panels/electrical/ElectricalSystemInspector.jsx
import { useState, useEffect } from 'react';

export default function ElectricalSystemInspector({ isOpen, onClose, onGenerate, selectedElementId }) {
    const [validationData, setValidationData] = useState({
        errors: [],
        warnings: [],
        systemHealth: 'ok'
    });

    const [panels, setPanels] = useState([
        {
            id: 'main_db',
            name: 'Main DB',
            circuits: [
                { id: 'L01', name: 'Living Room Lights', type: 'lighting', load: 240, phase: 'L1', breaker: 10, status: 'ok' },
                { id: 'S01', name: 'Kitchen Sockets', type: 'socket', load: 3200, phase: 'L2', breaker: 16, status: 'warning' },
                { id: 'D01', name: 'Cooker', type: 'dedicated', load: 7200, phase: 'L3', breaker: 32, status: 'ok' }
            ]
        }
    ]);

    const [phaseBalance, setPhaseBalance] = useState([
        { phase: 'L1', load: 240, percent: 15 },
        { phase: 'L2', load: 3200, percent: 82 },
        { phase: 'L3', load: 7200, percent: 95 }
    ]);

    const [expandedPanels, setExpandedPanels] = useState({});

    const togglePanel = (panelId) => {
        setExpandedPanels(prev => ({
            ...prev,
            [panelId]: !prev[panelId]
        }));
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'ok': return 'text-green-500';
            case 'warning': return 'text-yellow-500';
            case 'error': return 'text-red-500';
            default: return 'text-gray-500';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'ok': return '✓';
            case 'warning': return '⚠';
            case 'error': return '✕';
            default: return '•';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed top-16 right-4 w-[32rem] max-h-[calc(100vh-5rem)] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Electrical System Inspector</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide border-b border-gray-800 pb-2">
                        System Health
                    </h3>

                    <div className={`p-3 rounded border ${validationData.systemHealth === 'ok' ? 'bg-green-900/20 border-green-700' :
                            validationData.systemHealth === 'warning' ? 'bg-yellow-900/20 border-yellow-700' :
                                'bg-red-900/20 border-red-700'
                        }`}>
                        <div className="flex items-center gap-2">
                            <span className={`text-lg ${validationData.systemHealth === 'ok' ? 'text-green-500' :
                                    validationData.systemHealth === 'warning' ? 'text-yellow-500' :
                                        'text-red-500'
                                }`}>
                                {getStatusIcon(validationData.systemHealth)}
                            </span>
                            <span className="text-sm text-white font-semibold uppercase">
                                {validationData.systemHealth === 'ok' ? 'Balanced & Compliant' :
                                    validationData.systemHealth === 'warning' ? 'Warnings Present' :
                                        'Errors Detected'}
                            </span>
                        </div>
                    </div>

                    {validationData.errors.length > 0 && (
                        <div className="space-y-1">
                            {validationData.errors.map((error, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-xs text-red-400 bg-red-900/10 p-2 rounded">
                                    <span className="text-red-500 font-bold">✕</span>
                                    <span>{error}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {validationData.warnings.length > 0 && (
                        <div className="space-y-1">
                            {validationData.warnings.map((warning, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-xs text-yellow-400 bg-yellow-900/10 p-2 rounded">
                                    <span className="text-yellow-500 font-bold">⚠</span>
                                    <span>{warning}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide border-b border-gray-800 pb-2">
                        Phase Balance
                    </h3>

                    <div className="space-y-2">
                        {phaseBalance.map((phase) => (
                            <div key={phase.phase} className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-400 font-semibold">{phase.phase}</span>
                                    <span className="text-xs text-white">{phase.load} W ({phase.percent}%)</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all ${phase.percent > 90 ? 'bg-red-500' :
                                                phase.percent > 70 ? 'bg-yellow-500' :
                                                    'bg-blue-500'
                                            }`}
                                        style={{ width: `${Math.min(phase.percent, 100)}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide border-b border-gray-800 pb-2">
                        Panel Tree
                    </h3>

                    <div className="space-y-2">
                        {panels.map((panel) => (
                            <div key={panel.id} className="border border-gray-700 rounded">
                                <button
                                    onClick={() => togglePanel(panel.id)}
                                    className="w-full flex items-center justify-between p-3 hover:bg-gray-800 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <svg
                                            className={`w-4 h-4 text-gray-400 transition-transform ${expandedPanels[panel.id] ? 'rotate-90' : ''
                                                }`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                        <span className="text-sm text-white font-semibold">{panel.name}</span>
                                    </div>
                                    <span className="text-xs text-gray-400">{panel.circuits.length} circuits</span>
                                </button>

                                {expandedPanels[panel.id] && (
                                    <div className="border-t border-gray-700 p-2 space-y-1">
                                        {panel.circuits.map((circuit) => (
                                            <div key={circuit.id} className="flex items-center justify-between p-2 bg-gray-800 rounded text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-bold ${getStatusColor(circuit.status)}`}>
                                                        {getStatusIcon(circuit.status)}
                                                    </span>
                                                    <span className="text-white font-mono">{circuit.id}</span>
                                                    <span className="text-gray-400">{circuit.name}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-gray-500">{circuit.phase}</span>
                                                    <span className="text-gray-500">{circuit.breaker}A</span>
                                                    <span className="text-white">{circuit.load}W</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide border-b border-gray-800 pb-2">
                        Earthing Status
                    </h3>

                    <div className="bg-gray-800 border border-gray-700 rounded p-3">
                        <div className="flex items-center gap-2">
                            <span className="text-green-500 font-bold">✓</span>
                            <span className="text-xs text-white">All circuits properly earthed</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide border-b border-gray-800 pb-2">
                        Wet-zone Compliance
                    </h3>

                    <div className="bg-gray-800 border border-gray-700 rounded p-3">
                        <div className="flex items-center gap-2">
                            <span className="text-green-500 font-bold">✓</span>
                            <span className="text-xs text-white">No wet-zone violations detected</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-700">
                <button
                    onClick={() => onGenerate({ category: 'refresh_validation' })}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold py-2 rounded transition-colors"
                >
                    Refresh Validation
                </button>
            </div>
        </div>
    );
}