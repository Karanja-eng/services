
import React, { useState } from 'react';
import {
    Eye, Play, Box, Layout, Plus, Square, Minus, Grid, X,
    MousePointer, Save, FolderOpen, Maximize2, Minimize2,
    Settings, Calculator, Library, Trash2, Copy, Activity, Layers, CheckCircle
} from 'lucide-react';

/**
 * Framed & Tall Buildings — structure builder toolbar.
 *
 * Presentation only: every prop, handler, tab id, tool id and action name below is
 * unchanged, so the builder's workflow is identical to before.
 *
 * What changed (design-system migration, see docs in chats/):
 * - The tab row no longer has a fixed 50 px height with 20 px per-tab padding,
 *   which overflowed a 360 px phone screen (four tabs × ~100 px). Tabs now use the
 *   shared token sizes (`min-h-[44px]`, `px-3`, `text-xs/sm`), wrap when needed and
 *   keep the Beam Designer Suite's blue-600 active state.
 * - The sub-toolbar wraps instead of clipping, and its buttons use the shared
 *   control radius/height/typography.
 * - Colours come from tokens (Tailwind palette + `dark:` variants) instead of
 *   hardcoded hex values, so the toolbar follows the application theme and stays
 *   readable in dark mode.
 * - Icon-only buttons meet the 44 px touch target on phones.
 */

const SUBTOOLBAR = 'flex flex-wrap items-center gap-1.5 sm:gap-2';
const DIVIDER = 'hidden h-5 w-px shrink-0 bg-gray-200 dark:bg-slate-700 sm:block';

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
                    <div className={SUBTOOLBAR}>
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
                    <div className={SUBTOOLBAR}>
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
                        <div className={DIVIDER} />

                        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-slate-800">
                            <ToolbarButton
                                active={analysisMethod === 'moment_distribution'}
                                onClick={() => onAnalysisMethodChange('moment_distribution')}
                                icon={Box}
                                label="Moment Dist."
                                color={analysisMethod === 'moment_distribution' ? '#2196F3' : undefined}
                            />
                            <ToolbarButton
                                active={analysisMethod === 'stiffness'}
                                onClick={() => onAnalysisMethodChange('stiffness')}
                                icon={Layers}
                                label="Stiffness Matrix"
                                color={analysisMethod === 'stiffness' ? '#2196F3' : undefined}
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
                    <div className={SUBTOOLBAR}>
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
                    <div className={SUBTOOLBAR}>
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
                    <div className={SUBTOOLBAR}>
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
                        <ToolbarButton
                            onClick={() => onAction('import_cad')}
                            icon={FolderOpen}
                            label="Import CAD"
                            color="#0284c7"
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col border-b border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {/* Main tabs — wrap instead of clipping on narrow screens. */}
            <div className="flex flex-wrap items-center justify-between gap-1 border-b border-gray-100 pl-1 dark:border-slate-800">
                <div role="tablist" aria-label="Structure builder sections" className="flex flex-wrap items-stretch gap-0.5">
                    {tabs.map(tab => {
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setActiveTab(tab.id)}
                                className={`inline-flex min-h-[44px] items-center gap-1.5 border-b-[3px] px-3 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:text-sm ${
                                    active
                                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-300'
                                        : 'border-transparent text-gray-600 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-800'
                                }`}
                            >
                                <tab.icon size={16} aria-hidden="true" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-0.5 pr-1">
                    <button
                        type="button"
                        onClick={onSidebarToggle}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-transparent text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800"
                        title="Toggle Sidebar"
                        aria-label="Toggle sidebar"
                    >
                        <Layout size={18} aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onFullScreenChange(!isFullScreen)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-transparent text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800"
                        title="Fullscreen"
                        aria-label={isFullScreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    >
                        {isFullScreen ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
                    </button>
                </div>
            </div>

            {/* Sub-toolbar */}
            <div className="flex min-h-[44px] flex-wrap items-center gap-1 px-2 py-1.5 sm:px-3">
                {renderSubToolbar()}
            </div>
        </div>
    );
};

/**
 * Sub-toolbar button. `color` still carries the per-tool identity colour used by
 * the builder (blue column, green beam, orange slab, ...). It is applied to the
 * text/icon only, and the label is always present, so colour is never the sole
 * carrier of meaning.
 */
const ToolbarButton = ({ active, onClick, icon: Icon, label, color }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={Boolean(active)}
        style={color ? { color } : undefined}
        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:text-[13px] ${
            active
                ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/25 dark:text-blue-300'
                : 'border-transparent text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800'
        }`}
    >
        <Icon size={15} aria-hidden="true" />
        <span className="whitespace-nowrap">{label}</span>
    </button>
);

export default StructureBuilderToolbar;
