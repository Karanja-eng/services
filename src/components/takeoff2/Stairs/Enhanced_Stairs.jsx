import React, { useState } from 'react';
import { Calculator, Box, Eye, FileText, Settings, Edit3, Table, Ruler, Layers } from 'lucide-react';
import Staircase2DViewer from './2DViewer';
import EnglishMethodTakeoffSheet from '../ExternalWorks/EnglishMethodTakeoffSheet';
import { UniversalSheet, UniversalBOQ } from '../universal_component';
import StructuralVisualizationComponent from '../../Drawings/visualise_component';
import {
  WorkspacePage,
  PageHeader,
  Section,
  MetaChip,
  NumberField,
  SelectField,
  CheckboxField,
  SegmentedField,
  TechnicalDetails,
  ErrorNotice,
  ResultBanner,
  KeyValueGrid,
  ActionBar,
  action,
  layout,
} from '../../shared/ui';

/**
 * EnhancedStaircaseApp — staircase estimator and takeoff.
 *
 * UI cleanup:
 * - Page header, design tab, parameter sections, action bar and error state now
 *   come from the shared UI kit; the design tab is single-column on phones.
 * - The `alert()` failure path is replaced by an in-page error notice.
 * - Material parameters that are part of the request payload but previously had
 *   no input (rebar, balustrade, glass, timber, winder) are editable in a
 *   disclosure with unchanged defaults.
 *
 * Preserved: every `inputs` key/default, `updateInput` / `updateArrayInput`
 * semantics, the endpoint, the payload (including `.map(Number)` on the flight
 * arrays) and the automatic switch to the bill sheet after a successful run.
 */
const EnhancedStaircaseApp = () => {
    const [activeTab, setActiveTab] = useState("config");
    const [staircaseType, setStaircaseType] = useState("straight");
    const [materialType, setMaterialType] = useState("concrete");
    const [finishType, setFinishType] = useState("terrazzo");
    const [balType, setBalType] = useState("metal");
    const [error, setError] = useState(null);

    const [inputs, setInputs] = useState({
        clear_width: 1.2,
        tread: 0.275,
        rise: 0.175,
        wall_thick: 0.225,
        waist_thick: 0.150,
        num_flights: 2,
        risers_per_flight: [8, 8],
        treads_per_flight: [7, 8],
        landing_lengths: [1.5],
        landing_widths: [1.2],
        // Specialty parameters
        spiral_radius: 1.0,
        spiral_center_column_dia: 0.2,
        total_rotation: 360,
        turn_angle: 90,
        num_winders: 0,
        winder_inner_radius: 0.3,
        // Materials
        rebar_main_dia: 12,
        rebar_dist_dia: 10,
        rebar_spacing: 0.150,
        rebar_bend: 0.500,
        bal_height: 0.900,
        bal_spacing: 0.150,
        handrail_dia: 0.050,
        glass_thickness: 0.012,
        timber_tread_thick: 0.040,
        timber_species: "hardwood",
        // Features
        include_lighting: false,
        waterproofing_required: false
    });

    const [boqData, setBoqData] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);

    // Dynamic API Base URL
    const API_BASE = `http://${window.location.hostname}:8001`;

    const handleCalculate = async () => {
        setLoading(true);
        setError(null);
        try {
            const payload = {
                staircase_type: staircaseType,
                material_type: materialType,
                finish_type: finishType,
                balustrade_type: balType,
                ...inputs,
                risers_per_flight: inputs.risers_per_flight.map(Number),
                treads_per_flight: inputs.treads_per_flight.map(Number),
                landing_lengths: inputs.landing_lengths.map(Number),
                landing_widths: inputs.landing_widths.map(Number)
            };

            const response = await fetch(`${API_BASE}/stairs_router/calculate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            // Format data for Universal Components
            const formattedItems = (data.items || []).map((item, index) => ({
                id: index + 1,
                billNo: item.billNo || (index + 1).toString(),
                itemNo: (index + 1).toString(),
                description: item.description,
                unit: item.unit,
                quantity: typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0,
                rate: 0,
                amount: 0,
                dimensions: item.dimensions || [],
                isHeader: false
            }));

            setBoqData(formattedItems);
            setSummary(data.summary || {});
            setActiveTab("sheet"); // Switch to sheet view on success
        } catch (err) {
            console.error('Calculation error:', err);
            setError(
                err?.message ||
                    'Calculation failed. Check the backend connection and try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    const updateInput = (key, value) => {
        setInputs(prev => ({ ...prev, [key]: value }));
    };

    // Helper to update array inputs
    const updateArrayInput = (key, index, value) => {
        setInputs(prev => {
            const newArray = [...prev[key]];
            newArray[index] = value;
            return { ...prev, [key]: newArray };
        });
    };

    const tabs = [
        { id: "config", label: "Design", icon: Settings },
        { id: "2d", label: "2D plans", icon: Box },
        { id: "3d", label: "3D view", icon: Eye },
        { id: "takeoff", label: "Takeoff editor", icon: Edit3 },
        { id: "sheet", label: "Bill sheet", icon: Table },
        { id: "boq", label: "Final BOQ", icon: FileText }
    ];

    const staircaseTypes = [
        'straight', 'l_shaped', 'u_shaped', 'spiral', 'winder',
        'curved', 'bifurcated', 'cantilever', 'helical', 'open_newel'
    ];

    const showFlightConfig = ['straight', 'l_shaped', 'u_shaped'].includes(staircaseType);

    return (
        <WorkspacePage width="wide">
            <PageHeader
                title="Staircase estimator"
                subtitle="Geometry, materials, detailing and SMM7 takeoff for staircases."
                icon={<Ruler size={22} aria-hidden="true" />}
                meta={
                    <>
                        <MetaChip tone="info">{staircaseType.replace('_', ' ')}</MetaChip>
                        <MetaChip>{materialType}</MetaChip>
                        <MetaChip>{boqData.length} item(s)</MetaChip>
                    </>
                }
                actions={
                    <button
                        type="button"
                        onClick={handleCalculate}
                        disabled={loading}
                        className={`${action.base} ${action.primary}`}
                    >
                        <Calculator size={16} aria-hidden="true" />
                        {loading ? 'Calculating…' : 'Calculate quantities'}
                    </button>
                }
            />

            {/* Tool tabs */}
            <div className="-mx-1 mb-4 overflow-x-auto">
                <div className="flex w-max min-w-full gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                aria-current={isActive ? 'page' : undefined}
                                className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:px-4 sm:text-sm ${
                                    isActive
                                        ? 'bg-blue-600 text-white shadow'
                                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                <Icon className="h-4 w-4" aria-hidden="true" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {activeTab === "config" && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
                        <div className="space-y-4 lg:col-span-2">
                            <Section
                                title="Staircase type"
                                description="The type determines which geometry parameters are required."
                                icon={<Layers size={18} aria-hidden="true" />}
                            >
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                                    {staircaseTypes.map((type) => {
                                        const isActive = staircaseType === type;
                                        return (
                                            <button
                                                key={type}
                                                type="button"
                                                aria-pressed={isActive}
                                                onClick={() => setStaircaseType(type)}
                                                className={`min-h-[44px] rounded-lg border px-2 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                                    isActive
                                                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-200'
                                                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                                                }`}
                                            >
                                                {type.replace(/_/g, ' ')}
                                            </button>
                                        );
                                    })}
                                </div>
                            </Section>

                            <Section
                                title="Materials and finishes"
                                description="Structure, finish and balustrade systems included in the bill."
                                icon={<Layers size={18} aria-hidden="true" />}
                                tone="muted"
                            >
                                <div className={layout.formGrid}>
                                    <SelectField
                                        label="Structure material"
                                        value={materialType}
                                        onChange={setMaterialType}
                                        options={[
                                            { value: 'concrete', label: 'Reinforced concrete' },
                                            { value: 'timber', label: 'Structural timber' },
                                            { value: 'steel', label: 'Structural steel' },
                                            { value: 'glass', label: 'Structural glass' },
                                            { value: 'combination', label: 'Composite / mixed' },
                                        ]}
                                    />
                                    <SelectField
                                        label="Finish type"
                                        value={finishType}
                                        onChange={setFinishType}
                                        options={[
                                            { value: 'terrazzo', label: 'Terrazzo' },
                                            { value: 'ceramic_tiles', label: 'Ceramic tiles' },
                                            { value: 'porcelain_tiles', label: 'Porcelain tiles' },
                                            { value: 'granite', label: 'Granite' },
                                            { value: 'marble', label: 'Marble' },
                                            { value: 'timber', label: 'Timber flooring' },
                                            { value: 'polished_concrete', label: 'Polished concrete' },
                                        ]}
                                    />
                                    <SelectField
                                        label="Balustrade system"
                                        value={balType}
                                        onChange={setBalType}
                                        options={[
                                            { value: 'metal', label: 'Metal railings' },
                                            { value: 'timber', label: 'Timber posts' },
                                            { value: 'glass', label: 'Frameless glass' },
                                            { value: 'cable', label: 'Cable system' },
                                        ]}
                                    />
                                </div>
                            </Section>

                            <Section
                                title="Geometric parameters"
                                description="All stair dimensions in metres."
                                icon={<Ruler size={18} aria-hidden="true" />}
                            >
                                <div className={layout.formGridWide}>
                                    <NumberField label="Clear width" unit="m" step="0.01" min={0} value={inputs.clear_width} onChange={(v) => updateInput('clear_width', parseFloat(v))} />
                                    <NumberField label="Going / tread" unit="m" step="0.005" min={0} value={inputs.tread} onChange={(v) => updateInput('tread', parseFloat(v))} />
                                    <NumberField label="Rise" unit="m" step="0.005" min={0} value={inputs.rise} onChange={(v) => updateInput('rise', parseFloat(v))} />
                                    <NumberField label="Waist thickness" unit="m" step="0.01" min={0} value={inputs.waist_thick} onChange={(v) => updateInput('waist_thick', parseFloat(v))} />
                                    <NumberField label="Wall thickness" unit="m" step="0.005" min={0} value={inputs.wall_thick} onChange={(v) => updateInput('wall_thick', parseFloat(v))} />
                                </div>
                            </Section>

                            {showFlightConfig && (
                                <Section
                                    title="Flight configuration"
                                    description="Riser counts and landing lengths per flight."
                                    icon={<Layers size={18} aria-hidden="true" />}
                                    tone="muted"
                                >
                                    <div className="mb-3">
                                        <SegmentedField
                                            label="Number of flights"
                                            value={inputs.num_flights}
                                            onChange={(v) => updateInput('num_flights', v)}
                                            options={[1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        {Array.from({ length: inputs.num_flights }).map((_, idx) => (
                                            <div key={idx} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                                                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                                                    Flight {idx + 1}
                                                </p>
                                                <div className="space-y-2">
                                                    <NumberField
                                                        label="Risers"
                                                        unit="no."
                                                        step="1"
                                                        min={1}
                                                        inputMode="numeric"
                                                        value={inputs.risers_per_flight[idx] || 8}
                                                        onChange={(v) => updateArrayInput('risers_per_flight', idx, parseInt(v, 10))}
                                                    />
                                                    {idx < inputs.num_flights - 1 && (
                                                        <NumberField
                                                            label="Landing length"
                                                            unit="m"
                                                            step="0.1"
                                                            min={0}
                                                            value={inputs.landing_lengths[idx] || 1.5}
                                                            onChange={(v) => updateArrayInput('landing_lengths', idx, parseFloat(v))}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Section>
                            )}

                            {staircaseType === 'spiral' && (
                                <Section
                                    title="Spiral settings"
                                    description="Radius, centre column and total rotation."
                                    icon={<Ruler size={18} aria-hidden="true" />}
                                >
                                    <div className={layout.formGridWide}>
                                        <NumberField label="Outer radius" unit="m" step="0.1" min={0} value={inputs.spiral_radius} onChange={(v) => updateInput('spiral_radius', parseFloat(v))} />
                                        <NumberField label="Centre column diameter" unit="m" step="0.05" min={0} value={inputs.spiral_center_column_dia} onChange={(v) => updateInput('spiral_center_column_dia', parseFloat(v))} />
                                        <NumberField label="Total rotation" unit="°" step="45" min={0} value={inputs.total_rotation} onChange={(v) => updateInput('total_rotation', parseFloat(v))} />
                                    </div>
                                </Section>
                            )}

                            <TechnicalDetails summary="Detailing parameters (rebar, balustrade, glass, timber)">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    <NumberField label="Main bar diameter" unit="mm" step="1" min={0} value={inputs.rebar_main_dia} onChange={(v) => updateInput('rebar_main_dia', parseFloat(v))} />
                                    <NumberField label="Distribution bar diameter" unit="mm" step="1" min={0} value={inputs.rebar_dist_dia} onChange={(v) => updateInput('rebar_dist_dia', parseFloat(v))} />
                                    <NumberField label="Bar spacing" unit="m" step="0.005" min={0} value={inputs.rebar_spacing} onChange={(v) => updateInput('rebar_spacing', parseFloat(v))} />
                                    <NumberField label="Bar bend allowance" unit="m" step="0.01" min={0} value={inputs.rebar_bend} onChange={(v) => updateInput('rebar_bend', parseFloat(v))} />
                                    <NumberField label="Balustrade height" unit="m" step="0.01" min={0} value={inputs.bal_height} onChange={(v) => updateInput('bal_height', parseFloat(v))} />
                                    <NumberField label="Balustrade post spacing" unit="m" step="0.005" min={0} value={inputs.bal_spacing} onChange={(v) => updateInput('bal_spacing', parseFloat(v))} />
                                    <NumberField label="Handrail diameter" unit="m" step="0.005" min={0} value={inputs.handrail_dia} onChange={(v) => updateInput('handrail_dia', parseFloat(v))} />
                                    <NumberField label="Glass thickness" unit="m" step="0.001" min={0} value={inputs.glass_thickness} onChange={(v) => updateInput('glass_thickness', parseFloat(v))} />
                                    <NumberField label="Timber tread thickness" unit="m" step="0.005" min={0} value={inputs.timber_tread_thick} onChange={(v) => updateInput('timber_tread_thick', parseFloat(v))} />
                                    <NumberField label="Turn angle" unit="°" step="15" min={0} value={inputs.turn_angle} onChange={(v) => updateInput('turn_angle', parseFloat(v))} />
                                    <NumberField label="Number of winders" unit="no." step="1" min={0} inputMode="numeric" value={inputs.num_winders} onChange={(v) => updateInput('num_winders', parseInt(v, 10))} />
                                    <NumberField label="Winder inner radius" unit="m" step="0.05" min={0} value={inputs.winder_inner_radius} onChange={(v) => updateInput('winder_inner_radius', parseFloat(v))} />
                                    <SelectField
                                        label="Timber species"
                                        value={inputs.timber_species}
                                        onChange={(v) => updateInput('timber_species', v)}
                                        options={[
                                            { value: 'hardwood', label: 'Hardwood' },
                                            { value: 'softwood', label: 'Softwood' },
                                        ]}
                                    />
                                </div>
                            </TechnicalDetails>

                            <Section title="Additional features" icon={<Layers size={18} aria-hidden="true" />} tone="muted">
                                <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                                    <CheckboxField
                                        label="LED lighting system"
                                        checked={inputs.include_lighting}
                                        onChange={(v) => updateInput('include_lighting', v)}
                                    />
                                    <CheckboxField
                                        label="Waterproofing"
                                        checked={inputs.waterproofing_required}
                                        onChange={(v) => updateInput('waterproofing_required', v)}
                                    />
                                </div>
                            </Section>

                            <ActionBar hint="Successful runs open the bill sheet automatically.">
                                <button
                                    type="button"
                                    onClick={handleCalculate}
                                    disabled={loading}
                                    className={`${action.base} ${action.primary}`}
                                >
                                    <Calculator size={16} aria-hidden="true" />
                                    {loading ? 'Calculating…' : 'Calculate quantities'}
                                </button>
                            </ActionBar>

                            {error && (
                                <ErrorNotice
                                    title="Staircase calculation failed"
                                    message={error}
                                    onRetry={handleCalculate}
                                />
                            )}
                        </div>

                        <aside className="space-y-4">
                            <Section title="Current configuration" description="Summary of the selected design.">
                                <KeyValueGrid
                                    columns={2}
                                    items={[
                                        { label: 'Type', value: staircaseType.replace(/_/g, ' ') },
                                        { label: 'Material', value: materialType },
                                        { label: 'Finish', value: finishType },
                                        { label: 'Balustrade', value: balType },
                                        { label: 'Rise', value: inputs.rise, unit: 'm' },
                                        { label: 'Tread', value: inputs.tread, unit: 'm' },
                                    ]}
                                />
                            </Section>
                        </aside>
                    </div>
                </div>
            )}

            {activeTab === "2d" && (
                <div className="h-[70vh] min-h-[360px] overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <Staircase2DViewer staircaseData={{ staircase_type: staircaseType, ...inputs }} />
                </div>
            )}

            {activeTab === "3d" && (
                <div className="relative h-[70vh] min-h-[360px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
                    <StructuralVisualizationComponent
                        componentType="staircase"
                        buildingData={{ staircase_type: staircaseType, ...inputs }}
                    />
                </div>
            )}

            {activeTab === "takeoff" && (
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <EnglishMethodTakeoffSheet
                        initialItems={boqData}
                        onChange={setBoqData}
                        projectInfo={{
                            projectName: "Staircase Project",
                            clientName: "Auto-Generated",
                            projectDate: new Date().toLocaleDateString()
                        }}
                    />
                </div>
            )}

            {activeTab === "sheet" && (
                <div>
                    <UniversalSheet items={boqData} />
                </div>
            )}

            {activeTab === "boq" && (
                <div className="space-y-4">
                    <UniversalBOQ items={boqData} />

                    {summary && (
                        <ResultBanner
                            status="pass"
                            title="Staircase quantities"
                            description="Summary of the current bill."
                        >
                            <div className="mt-3">
                                <KeyValueGrid
                                    columns={4}
                                    items={[
                                        { label: 'Total height', value: summary.total_height_m, unit: 'm' },
                                        {
                                            label: 'Concrete volume',
                                            value:
                                                boqData.find((i) => i.description?.includes('Reinforced concrete'))
                                                    ?.quantity || 0,
                                            unit: 'm³',
                                        },
                                        { label: 'Total risers', value: summary.total_risers },
                                        {
                                            label: 'Rebar weight',
                                            value: (
                                                (boqData.find((i) => i.description?.includes('main bars'))?.quantity || 0) *
                                                0.888
                                            ).toFixed(1),
                                            unit: 'kg',
                                        },
                                    ]}
                                />
                            </div>
                        </ResultBanner>
                    )}
                </div>
            )}
        </WorkspacePage>
    );
};

export default EnhancedStaircaseApp;
