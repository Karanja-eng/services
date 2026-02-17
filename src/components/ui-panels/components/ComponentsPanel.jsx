import React, { useState, useEffect } from 'react';
import {
    Eye, EyeOff, Box, Ghost, Target, ChevronDown, ChevronRight,
    Home, Droplets, Zap, Wind, Trees, LayoutGrid, Settings2
} from 'lucide-react';
import { layerController } from '../../../ui-state/LayerController';
import { panelRegistry } from '../../../ui-state/PanelRegistry';

const CATEGORIES = [
    {
        id: 'architecture',
        label: 'Architecture',
        icon: Home,
        panels: [
            { id: 'arch_walls', label: 'Walls' },
            { id: 'arch_doors', label: 'Doors' },
            { id: 'arch_windows', label: 'Windows' },
            { id: 'arch_floors', label: 'Floors' },
            { id: 'arch_roofs', label: 'Roofs' },
        ],
        layers: [
            { id: 'walls', label: 'Walls' },
            { id: 'doors', label: 'Doors' },
            { id: 'windows', label: 'Windows' },
            { id: 'floors', label: 'Floors' },
            { id: 'roofs', label: 'Roofs' },
        ]
    },
    {
        id: 'plumbing',
        label: 'Plumbing',
        icon: Droplets,
        panels: [
            { id: 'plumb_fixtures', label: 'Fixtures' },
            { id: 'plumb_water', label: 'Water Supply' },
            { id: 'plumb_drainage', label: 'Drainage' },
            { id: 'plumb_inspector', label: 'Inspector' },
        ],
        layers: [
            { id: 'fixtures', label: 'Fixtures' },
            { id: 'cold_water', label: 'Cold water pipes' },
            { id: 'hot_water', label: 'Hot water pipes' },
            { id: 'drainage', label: 'Drainage pipes' },
            { id: 'vent', label: 'Vent pipes' },
        ]
    },
    {
        id: 'electrical',
        label: 'Electrical',
        icon: Zap,
        panels: [
            { id: 'elec_fixtures', label: 'Fixtures' },
            { id: 'elec_switching', label: 'Switching' },
            { id: 'elec_circuits', label: 'Circuits' },
            { id: 'elec_inspector', label: 'Inspector' },
        ],
        layers: [
            { id: 'lights', label: 'Lights' },
            { id: 'switches', label: 'Switches' },
            { id: 'sockets', label: 'Sockets' },
            { id: 'appliances', label: 'Appliances' },
            { id: 'conduits', label: 'Conduits' },
            { id: 'panels', label: 'Panels' },
        ]
    },
    {
        id: 'hvac',
        label: 'HVAC',
        icon: Wind,
        layers: [
            { id: 'ducts', label: 'Ducts' },
            { id: 'vents', label: 'Vents' },
            { id: 'units', label: 'Units' },
        ]
    },
    {
        id: 'structural',
        label: 'Structural',
        icon: LayoutGrid,
        panels: [
            { id: 'struct_foundations', label: 'Foundations' },
        ],
        layers: [
            { id: 'pad_foundation', label: 'Pad foundations' },
            { id: 'strip_foundation', label: 'Strip foundations' },
            { id: 'raft_foundation', label: 'Raft foundations' },
        ]
    },
    {
        id: 'external',
        label: 'External Works',
        icon: Trees,
        layers: [
            { id: 'pavements', label: 'Pavements' },
            { id: 'drainage_channels', label: 'Drainage channels' },
            { id: 'manholes', label: 'Manholes' },
            { id: 'landscaping', label: 'Landscaping' },
            { id: 'site_furniture', label: 'Site furniture' },
        ]
    }
];

export default function ComponentsPanel({ isOpen, onClose }) {
    const [expandedGroups, setExpandedGroups] = useState(['architecture']);
    const [layerStates, setLayerStates] = useState({});
    const [activeTab, setActiveTab] = useState('components'); // 'components' or 'layers'

    useEffect(() => {
        return layerController.subscribe(setLayerStates);
    }, []);

    if (!isOpen) return null;

    const toggleGroup = (groupId) => {
        setExpandedGroups(prev =>
            prev.includes(groupId)
                ? prev.filter(g => g !== groupId)
                : [...prev, groupId]
        );
    };

    const LayerRow = ({ group, layer }) => {
        const state = layerStates[`${group.id}:${layer.id}`] || { visible: true, opacity: 1, isolated: false };

        return (
            <div className="flex items-center justify-between py-1 px-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                <span className="text-xs truncate mr-2">{layer.label}</span>
                <div className="flex items-center space-x-1">
                    <button
                        onClick={() => layerController.setLayerVisibility(group.id, layer.id, !state.visible)}
                        className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${!state.visible ? 'text-gray-400' : 'text-blue-500'}`}
                    >
                        {state.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                    <button
                        onClick={() => layerController.setLayerOpacity(group.id, layer.id, state.opacity === 1 ? 0.3 : 1)}
                        className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${state.opacity < 1 ? 'text-purple-500' : 'text-gray-400'}`}
                    >
                        {state.opacity < 1 ? <Ghost className="w-3 h-3" /> : <Box className="w-3 h-3" />}
                    </button>
                    <button
                        onClick={() => layerController.toggleIsolation(group.id, layer.id)}
                        className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${state.isolated ? 'text-amber-500' : 'text-gray-400'}`}
                    >
                        <Target className="w-3 h-3" />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="absolute right-4 top-16 w-80 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-2xl flex flex-col z-50 max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-t-lg">
                <div className="flex items-center space-x-2 font-bold text-sm uppercase tracking-wider">
                    <LayoutGrid className="w-4 h-4 text-blue-500" />
                    <span>Components</span>
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-300 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('components')}
                    className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === 'components' ? 'bg-white dark:bg-gray-900 text-blue-600' : 'bg-gray-50 dark:bg-gray-800 text-gray-500'}`}
                >
                    Editors
                </button>
                <button
                    onClick={() => setActiveTab('layers')}
                    className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === 'layers' ? 'bg-white dark:bg-gray-900 text-blue-600' : 'bg-gray-50 dark:bg-gray-800 text-gray-500'}`}
                >
                    Visibility
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto py-2">
                {CATEGORIES.map(category => (
                    <div key={category.id} className="mb-1 border-b border-gray-100 dark:border-gray-800 last:border-0 pb-1">
                        <button
                            onClick={() => toggleGroup(category.id)}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                            <div className="flex items-center space-x-2">
                                <category.icon className="w-4 h-4" />
                                <span>{category.label}</span>
                            </div>
                            {expandedGroups.includes(category.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>

                        {expandedGroups.includes(category.id) && (
                            <div className="space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                {activeTab === 'components' ? (
                                    <div className="grid grid-cols-2 gap-1 p-2">
                                        {category.panels?.map(panel => (
                                            <button
                                                key={panel.id}
                                                onClick={() => panelRegistry.toggle(panel.id)}
                                                className="flex items-center space-x-2 px-2 py-1.5 text-[11px] bg-gray-50 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-750 transition-all hover:border-blue-300 active:scale-95"
                                            >
                                                <Settings2 className="w-3 h-3 text-gray-400" />
                                                <span className="truncate">{panel.label}</span>
                                            </button>
                                        ))}
                                        {!category.panels && <div className="col-span-2 text-[10px] text-gray-400 italic px-2">No editors available</div>}
                                    </div>
                                ) : (
                                    <div className="bg-gray-50 dark:bg-gray-900/50">
                                        {category.layers.map(layer => (
                                            <LayerRow key={layer.id} group={category} layer={layer} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-lg text-[9px] text-gray-500 flex justify-between">
                <span>V2.0 INTEGRATED</span>
                <span className="font-mono">SYS-BIM-COMP</span>
            </div>
        </div>
    );
}
