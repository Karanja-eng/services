import React, { useState } from 'react';

export default function PlumbingSystemInspector({ isOpen, onClose, onGenerate, selectedElementId, validationData }) {
    const [activeTab, setActiveTab] = useState('fixtures');
    const [expandedItems, setExpandedItems] = useState({});

    const mockFixtures = [
        { id: 'wc_1', type: 'Water Closet', status: 'connected', floor: 1 },
        { id: 'basin_1', type: 'Wash Basin', status: 'connected', floor: 1 },
        { id: 'basin_2', type: 'Wash Basin', status: 'warning', warning: 'Missing vent', floor: 2 },
        { id: 'shower_1', type: 'Shower', status: 'connected', floor: 2 }
    ];

    const mockStacks = [
        { id: 'soil_stack_1', type: 'Soil Stack', diameter: 110, floors: [1, 2], status: 'connected' },
        { id: 'vent_stack_1', type: 'Vent Stack', diameter: 50, floors: [1, 2], status: 'connected' }
    ];

    const mockPipeNetwork = [
        {
            id: 'cold_water_main',
            type: 'Cold Water',
            branches: [
                { id: 'cold_kitchen', fixtures: ['sink_1'], status: 'connected' },
                { id: 'cold_bath_1', fixtures: ['basin_1', 'wc_1'], status: 'connected' }
            ]
        },
        {
            id: 'hot_water_main',
            type: 'Hot Water',
            branches: [
                { id: 'hot_kitchen', fixtures: ['sink_1'], status: 'connected' },
                { id: 'hot_bath_1', fixtures: ['basin_1', 'shower_1'], status: 'connected' }
            ]
        },
        {
            id: 'drainage_main',
            type: 'Drainage',
            branches: [
                { id: 'drain_bath_1', fixtures: ['wc_1', 'basin_1'], status: 'error', error: 'Insufficient slope' },
                { id: 'drain_bath_2', fixtures: ['basin_2', 'shower_1'], status: 'connected' }
            ]
        }
    ];

    const mockMaintenancePoints = [
        { id: 'cleanout_1', location: 'Base of soil stack 1', accessible: true },
        { id: 'cleanout_2', location: 'Kitchen branch', accessible: true },
        { id: 'valve_main', location: 'Main supply entry', accessible: true },
        { id: 'valve_zone_1', location: 'Bathroom zone 1', accessible: false, warning: 'Behind wall' }
    ];

    const validation = validationData || {
        errors: ['Insufficient slope on drain_bath_1'],
        warnings: ['Missing vent on basin_2', 'Inaccessible valve at zone 1'],
        systemHealth: 'warning'
    };

    const toggleExpand = (id) => {
        setExpandedItems({ ...expandedItems, [id]: !expandedItems[id] });
    };

    const getStatusIcon = (status) => {
        if (status === 'connected') {
            return (
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
            );
        }
        if (status === 'warning') {
            return (
                <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
            );
        }
        if (status === 'error') {
            return (
                <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
            );
        }
    };

    const getHealthBadge = () => {
        if (validation.systemHealth === 'ok') {
            return (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                    ✓ System Healthy
                </span>
            );
        }
        if (validation.systemHealth === 'warning') {
            return (
                <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded">
                    ⚠ Warnings Present
                </span>
            );
        }
        return (
            <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                ✕ Errors Found
            </span>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed top-16 right-4 w-[28rem] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col max-h-[calc(100vh-5rem)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-gray-900">System Inspector</h2>
                    {getHealthBadge()}
                </div>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex border-b border-gray-200">
                {['fixtures', 'network', 'stacks', 'maintenance', 'validation'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${activeTab === tab
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
                {activeTab === 'fixtures' && (
                    <div className="space-y-2">
                        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
                            Fixture List ({mockFixtures.length})
                        </h3>
                        {mockFixtures.map((fixture) => (
                            <div
                                key={fixture.id}
                                className="px-3 py-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {getStatusIcon(fixture.status)}
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{fixture.type}</div>
                                            <div className="text-xs text-gray-500">{fixture.id} • Floor {fixture.floor}</div>
                                        </div>
                                    </div>
                                </div>
                                {fixture.warning && (
                                    <div className="mt-2 px-2 py-1 bg-amber-50 rounded text-xs text-amber-700 border border-amber-200">
                                        {fixture.warning}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'network' && (
                    <div className="space-y-3">
                        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
                            Pipe Networks
                        </h3>
                        {mockPipeNetwork.map((network) => (
                            <div key={network.id} className="border border-gray-200 rounded">
                                <button
                                    onClick={() => toggleExpand(network.id)}
                                    className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                                >
                                    <span className="text-sm font-medium text-gray-900">{network.type}</span>
                                    <svg
                                        className={`w-4 h-4 text-gray-500 transition-transform ${expandedItems[network.id] ? 'rotate-180' : ''
                                            }`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {expandedItems[network.id] && (
                                    <div className="px-3 py-2 space-y-2">
                                        {network.branches.map((branch) => (
                                            <div key={branch.id} className="pl-3 border-l-2 border-gray-300">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {getStatusIcon(branch.status)}
                                                    <span className="text-xs font-medium text-gray-700">{branch.id}</span>
                                                </div>
                                                <div className="text-xs text-gray-500 ml-6">
                                                    Serves: {branch.fixtures.join(', ')}
                                                </div>
                                                {branch.error && (
                                                    <div className="mt-1 ml-6 px-2 py-1 bg-red-50 rounded text-xs text-red-700 border border-red-200">
                                                        {branch.error}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'stacks' && (
                    <div className="space-y-2">
                        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
                            Vertical Stacks ({mockStacks.length})
                        </h3>
                        {mockStacks.map((stack) => (
                            <div
                                key={stack.id}
                                className="px-3 py-3 bg-gray-50 rounded border border-gray-200"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        {getStatusIcon(stack.status)}
                                        <span className="text-sm font-medium text-gray-900">{stack.type}</span>
                                    </div>
                                    <span className="text-xs text-gray-500">{stack.diameter}mm</span>
                                </div>
                                <div className="text-xs text-gray-600">
                                    Floors: {stack.floors.join(', ')}
                                </div>
                                <div className="mt-2 flex gap-2">
                                    <div className="flex-1 h-2 bg-blue-200 rounded">
                                        {stack.floors.map((floor) => (
                                            <div
                                                key={floor}
                                                className="h-full bg-blue-600 rounded"
                                                style={{ width: `${100 / stack.floors.length}%` }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'maintenance' && (
                    <div className="space-y-2">
                        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
                            Maintenance Access Points
                        </h3>
                        {mockMaintenancePoints.map((point) => (
                            <div
                                key={point.id}
                                className="px-3 py-2 bg-gray-50 rounded border border-gray-200"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {point.accessible ? (
                                            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{point.id}</div>
                                            <div className="text-xs text-gray-500">{point.location}</div>
                                        </div>
                                    </div>
                                </div>
                                {point.warning && (
                                    <div className="mt-2 px-2 py-1 bg-amber-50 rounded text-xs text-amber-700 border border-amber-200">
                                        {point.warning}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'validation' && (
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
                                Validation Report
                            </h3>

                            {validation.errors.length > 0 && (
                                <div className="mb-3">
                                    <div className="text-xs font-medium text-red-700 mb-2">
                                        Errors ({validation.errors.length})
                                    </div>
                                    <div className="space-y-1">
                                        {validation.errors.map((error, i) => (
                                            <div
                                                key={i}
                                                className="px-3 py-2 bg-red-50 rounded border border-red-200 flex items-start gap-2"
                                            >
                                                <svg className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                </svg>
                                                <span className="text-xs text-red-700">{error}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {validation.warnings.length > 0 && (
                                <div className="mb-3">
                                    <div className="text-xs font-medium text-amber-700 mb-2">
                                        Warnings ({validation.warnings.length})
                                    </div>
                                    <div className="space-y-1">
                                        {validation.warnings.map((warning, i) => (
                                            <div
                                                key={i}
                                                className="px-3 py-2 bg-amber-50 rounded border border-amber-200 flex items-start gap-2"
                                            >
                                                <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                                <span className="text-xs text-amber-700">{warning}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {validation.errors.length === 0 && validation.warnings.length === 0 && (
                                <div className="px-4 py-3 bg-green-50 rounded border border-green-200 text-center">
                                    <svg className="w-8 h-8 text-green-600 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <div className="text-sm font-medium text-green-800">All Systems Operational</div>
                                    <div className="text-xs text-green-600 mt-1">No issues detected</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}