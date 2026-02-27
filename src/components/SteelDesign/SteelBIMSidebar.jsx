import React from 'react';
import { STRUCTURE_REGISTRY, CAT_COLORS, CAT_ICONS } from './SteelBIM_Generators.jsx';
import { Box, Layers, ChevronRight } from 'lucide-react';

const SteelBIMSidebar = ({
    activeCategory,
    setActiveCategory,
    activeStructure,
    setActiveStructure,
    loadStructure,
    layers,
    setLayers,
    isDark = false
}) => {
    const cardBg = isDark ? "bg-gray-800" : "bg-white";
    const borderColor = isDark ? "border-gray-700" : "border-gray-200";
    const hoverBg = isDark ? "hover:bg-gray-700" : "hover:bg-gray-100";
    const textPrimary = isDark ? "text-gray-100" : "text-gray-900";
    const textSecondary = isDark ? "text-gray-400" : "text-gray-500";
    const activeBg = "bg-blue-600 bg-opacity-10 border-blue-500 border-opacity-50";

    return (
        <div className="flex flex-col h-full overflow-hidden font-mono">
            {/* Category Tabs */}
            <div className="grid grid-cols-1 gap-1 p-3 border-b border-gray-200 dark:border-gray-800">
                {Object.entries(STRUCTURE_REGISTRY).map(([cat, items]) => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all text-xs text-left
                            ${activeCategory === cat ? activeBg : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
                        `}
                    >
                        <span style={{ color: CAT_COLORS[cat] }} className="text-base">{CAT_ICONS[cat]}</span>
                        <span className={`uppercase tracking-wider font-bold ${activeCategory === cat ? 'text-blue-600' : textSecondary}`}>
                            {cat}
                        </span>
                        <span className="ml-auto opacity-50 text-[9px]">{items.length}</span>
                    </button>
                ))}
            </div>

            {/* Structure List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400 mb-2 px-1">
                    Structures
                </div>
                {STRUCTURE_REGISTRY[activeCategory]?.map(entry => (
                    <button
                        key={entry.id}
                        onClick={() => {
                            setActiveStructure(entry.id);
                            loadStructure(activeCategory, entry.id);
                        }}
                        className={`w-full group flex items-center gap-2 px-3 py-2 rounded-md transition-all text-[11px] text-left border
                            ${activeStructure === entry.id
                                ? 'bg-white dark:bg-gray-900 border-blue-500/30 text-blue-600 shadow-sm'
                                : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700 text-gray-600 dark:text-gray-400'}
                        `}
                    >
                        <div className={`w-1.5 h-1.5 rounded-full transition-all ${activeStructure === entry.id ? 'bg-blue-500' : 'bg-transparent group-hover:bg-gray-300'}`} />
                        {entry.label}
                    </button>
                ))}
            </div>

            {/* Layers */}
            <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400 mb-3 flex items-center gap-2">
                    <Layers className="w-3 h-3" />
                    Visibility
                </div>
                <div className="space-y-1.5">
                    {Object.entries(layers).map(([layer, vis]) => (
                        <button
                            key={layer}
                            onClick={() => setLayers(l => ({ ...l, [layer]: !l[layer] }))}
                            className={`flex items-center gap-2 w-full group text-left`}
                        >
                            <div className={`w-3 h-3 rounded-[2px] border transition-all
                                ${vis
                                    ? 'bg-blue-500 border-blue-500'
                                    : 'border-gray-300 dark:border-gray-600 bg-transparent'}
                            `} />
                            <span className={`text-[10px] uppercase tracking-wide transition-all ${vis ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}`}>
                                {layer}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SteelBIMSidebar;
