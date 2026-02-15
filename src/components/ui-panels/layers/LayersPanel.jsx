import React, { useState, useEffect } from 'react';
import {
    Eye, EyeOff, Box, Ghost, Target, ChevronDown, ChevronRight,
    Home, Droplets, Zap, Wind, Trees
} from 'lucide-react';
import { layerController } from '../../../ui-state/LayerController';

const LAYER_GROUPS = [
    {
        id: 'architecture',
        label: 'Architecture',
        icon: Home,
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

export default function LayersPanel({ isOpen, onClose }) {
    const [expandedGroups, setExpandedGroups] = useState(['architecture']);
    const [layerStates, setLayerStates] = useState({});

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
                <span className="text-sm truncate mr-2">{layer.label}</span>

                <div className="flex items-center space-x-1">
                    {/* Visibility Toggle */}
                    <button
                        onClick={() => layerController.setLayerVisibility(group.id, layer.id, !state.visible)}
                        className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${!state.visible ? 'text-gray-400' : 'text-blue-500'}`}
                        title={state.visible ? "Hide Layer" : "Show Layer"}
                    >
                        {state.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>

                    {/* Transparency Toggle (30% / 100%) */}
                    <button
                        onClick={() => layerController.setLayerOpacity(group.id, layer.id, state.opacity === 1 ? 0.3 : 1)}
                        className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${state.opacity < 1 ? 'text-purple-500' : 'text-gray-400'}`}
                        title={state.opacity < 1 ? "Solid Material" : "Translucent (30%)"}
                    >
                        {state.opacity < 1 ? <Ghost className="w-4 h-4" /> : <Box className="w-4 h-4" />}
                    </button>

                    {/* Isolation Toggle */}
                    <button
                        onClick={() => layerController.toggleIsolation(group.id, layer.id)}
                        className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${state.isolated ? 'text-amber-500' : 'text-gray-400'}`}
                        title={state.isolated ? "Disable Solo" : "Solo Layer"}
                    >
                        <Target className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="absolute right-4 top-16 w-72 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-2xl flex flex-col z-50 max-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-t-lg">
                <div className="flex items-center space-x-2 font-bold text-sm uppercase tracking-wider">
                    <Target className="w-4 h-4 text-blue-500" />
                    <span>Layer Control</span>
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto py-2">
                {LAYER_GROUPS.map(group => (
                    <div key={group.id} className="mb-1">
                        <button
                            onClick={() => toggleGroup(group.id)}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                            <div className="flex items-center space-x-2">
                                <group.icon className="w-4 h-4" />
                                <span>{group.label}</span>
                            </div>
                            {expandedGroups.includes(group.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>

                        {expandedGroups.includes(group.id) && (
                            <div className="bg-gray-50 dark:bg-gray-900/50">
                                {group.layers.map(layer => (
                                    <LayerRow key={layer.id} group={group} layer={layer} />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-lg text-[10px] text-gray-500 flex justify-between">
                <span>BIM STANDARDS EQUIVALENT</span>
                <span>ISO 19650</span>
            </div>
        </div>
    );
}
