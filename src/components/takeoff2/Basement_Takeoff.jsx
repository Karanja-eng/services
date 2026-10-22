import React, { useState, useEffect } from 'react';
import { Calculator, Ruler, Layers, Droplets, Box, TrendingUp, Grid3x3 } from 'lucide-react';
import axios from 'axios';
import EnglishMethodTakeoffSheet from './ExternalWorks/EnglishMethodTakeoffSheet';
import { UniversalTabs, UniversalSheet, UniversalBOQ } from './universal_component';
import {
  WorkspacePage,
  PageHeader,
  Section,
  MetaChip,
  NumberField,
  CheckboxField,
  ErrorNotice,
  EmptyState,
  LoadingState,
  TableScrollRegion,
  ActionBar,
  action,
  layout,
  text,
} from '../shared/ui';

/**
 * BasementTakeoffApp — basement excavation / structure takeoff.
 *
 * UI cleanup:
 * - Calculator tab rebuilt from the shared UI kit (page header, sectioned fields,
 *   responsive grid, action bar, error/empty/loading states).
 * - Downstream tabs (`takeoff`, `sheet`, `boq`) are untouched — same components,
 *   same props, same editable documents.
 * - `inputs` keys, the local `InputField` parsing (`parseFloat(v) || 0`), the
 *   request payload and the auto-calculate-on-mount behaviour are unchanged.
 */
const BasementTakeoffApp = () => {
    const [activeTab, setActiveTab] = useState("calculator");
    const [inputs, setInputs] = useState({
        ext_L: 3.91,
        ext_W: 3.41,
        int_L: 3.0,
        int_W: 2.5,
        depth_below_gl: 2.5,
        veg_soil_depth: 0.15,
        working_space: 0.3,
        blinding_thick: 0.075,
        bed_thick: 0.1,
        found_L: 0.9,
        found_thick: 0.3,
        wall_thick: 0.225,
        rc_wall_thick: 0.15,
        horiz_tanking_thick: 0.03,
        vert_tanking_thick: 0.025,
        projection: 0.1,
        slab_thick: 0.15,
        excav_staged: false,
        stage_depth: 1.5,
        reinf_incl: true,
        reinf_density: 120,
        form_incl: true,
        backfill_incl: true,
        disposal_incl: true,
        hardcore_thick: 0.1,
        num_columns: 0,
        column_size: 0,
        column_base_size: 0,
        column_base_thick: 0,
        has_drain: false,
        has_tanking: false,
        has_waterbar: false
    });

    const [takeoffData, setTakeoffData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [editorKey, setEditorKey] = useState(0);

    const handleInputChange = (field, value) => {
        setInputs(prev => ({ ...prev, [field]: value }));
    };

    const handleCalculate = async () => {
        setLoading(true);
        setError(null);
        try {
            const payload = {
                length: inputs.ext_L,
                width: inputs.ext_W,
                depth: inputs.depth_below_gl,
                wall_thick: inputs.wall_thick,
                slab_thick: inputs.slab_thick,
                blinding_thick: inputs.blinding_thick,
                hardcore_thick: inputs.hardcore_thick,
                working_space: inputs.working_space,
                veg_soil: inputs.veg_soil_depth,
                num_columns: inputs.num_columns,
                column_size: inputs.column_size,
                column_base_size: inputs.column_base_size,
                column_base_thick: inputs.column_base_thick,
                has_drain: inputs.has_drain,
                has_tanking: inputs.has_tanking,
                has_waterbar: inputs.has_waterbar
            };

            const response = await axios.post("http://localhost:8001/basement_router/api/calculate", payload);
            const data = response.data;

            if (data && data.items) {
                const formattedItems = data.items.map((item, index) => ({
                    id: index + 1,
                    billNo: item.item_no || `B.${index + 1}`,
                    itemNo: (index + 1).toString(),
                    description: item.description,
                    unit: item.unit,
                    quantity: item.quantity,
                    rate: 0,
                    amount: 0,
                    dimensions: [],
                    isHeader: false
                }));
                setTakeoffData(formattedItems);
                setEditorKey(prev => prev + 1);
            }
        } catch (err) {
            setError("Failed to calculate. Backend might be offline or input is invalid.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Auto-calculate defaults on mount
    useEffect(() => {
        handleCalculate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Local number contract preserved: parseFloat(value) || 0
    const num = (field) => (value) => handleInputChange(field, parseFloat(value) || 0);

    return (
        <WorkspacePage width="wide">
            <PageHeader
                title="Basement quantity takeoff"
                subtitle="Excavation, earthworks, structure and waterproofing quantities for a basement."
                icon={<TrendingUp size={22} aria-hidden="true" />}
                meta={
                    <>
                        <MetaChip tone="info">SMM7 items</MetaChip>
                        <MetaChip>{takeoffData.length} item(s) generated</MetaChip>
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
                        {loading ? 'Calculating…' : 'Calculate takeoff'}
                    </button>
                }
            />

            <div className="mb-4 -mx-1 overflow-x-auto">
                <UniversalTabs
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    tabs={['calculator', 'takeoff', 'sheet', 'boq']}
                />
            </div>

            {activeTab === "calculator" && (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
                    {/* Input column */}
                    <div className="space-y-4 xl:col-span-2">
                        <Section
                            title="Basement geometry"
                            description="External and internal plan dimensions, and depth below ground level."
                            icon={<Ruler size={18} aria-hidden="true" />}
                        >
                            <div className={layout.formGridWide}>
                                <NumberField label="External length" unit="m" step="0.01" min={0} value={inputs.ext_L} onChange={num('ext_L')} />
                                <NumberField label="External width" unit="m" step="0.01" min={0} value={inputs.ext_W} onChange={num('ext_W')} />
                                <NumberField label="Internal length" unit="m" step="0.01" min={0} value={inputs.int_L} onChange={num('int_L')} />
                                <NumberField label="Internal width" unit="m" step="0.01" min={0} value={inputs.int_W} onChange={num('int_W')} />
                                <NumberField label="Depth below ground level" unit="m" step="0.01" min={0} value={inputs.depth_below_gl} onChange={num('depth_below_gl')} />
                            </div>
                        </Section>

                        <Section
                            title="Excavation and earthworks"
                            description="Vegetation strip, working space and disposal allowances."
                            icon={<Layers size={18} aria-hidden="true" />}
                            tone="muted"
                        >
                            <div className={layout.formGridWide}>
                                <NumberField label="Vegetable soil depth" unit="m" step="0.01" min={0} value={inputs.veg_soil_depth} onChange={num('veg_soil_depth')} />
                                <NumberField label="Working space allowance" unit="m" step="0.01" min={0} value={inputs.working_space} onChange={num('working_space')} />
                                <NumberField label="Staged excavation depth" unit="m" step="0.01" min={0} value={inputs.stage_depth} onChange={num('stage_depth')} />
                            </div>
                            <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                                <CheckboxField label="Staged excavation" checked={inputs.excav_staged} onChange={(v) => handleInputChange('excav_staged', v)} />
                                <CheckboxField label="Include backfill" checked={inputs.backfill_incl} onChange={(v) => handleInputChange('backfill_incl', v)} />
                                <CheckboxField label="Include disposal" checked={inputs.disposal_incl} onChange={(v) => handleInputChange('disposal_incl', v)} />
                            </div>
                        </Section>

                        <Section
                            title="Structural details"
                            description="Blinding, base slab, footings and walls (metres)."
                            icon={<Box size={18} aria-hidden="true" />}
                        >
                            <div className={layout.formGridWide}>
                                <NumberField label="Blinding thickness" unit="m" step="0.005" min={0} value={inputs.blinding_thick} onChange={num('blinding_thick')} />
                                <NumberField label="Bed thickness" unit="m" step="0.01" min={0} value={inputs.bed_thick} onChange={num('bed_thick')} />
                                <NumberField label="Hardcore thickness" unit="m" step="0.01" min={0} value={inputs.hardcore_thick} onChange={num('hardcore_thick')} />
                                <NumberField label="Footing length" unit="m" step="0.01" min={0} value={inputs.found_L} onChange={num('found_L')} />
                                <NumberField label="Footing thickness" unit="m" step="0.01" min={0} value={inputs.found_thick} onChange={num('found_thick')} />
                                <NumberField label="Wall thickness" unit="m" step="0.005" min={0} value={inputs.wall_thick} onChange={num('wall_thick')} />
                                <NumberField label="RC wall thickness" unit="m" step="0.005" min={0} value={inputs.rc_wall_thick} onChange={num('rc_wall_thick')} />
                                <NumberField label="Slab thickness" unit="m" step="0.01" min={0} value={inputs.slab_thick} onChange={num('slab_thick')} />
                            </div>
                        </Section>

                        <Section
                            title="Waterproofing"
                            description="Tanking, drainage and waterbar provisions."
                            icon={<Droplets size={18} aria-hidden="true" />}
                            tone="muted"
                        >
                            <div className={layout.formGridWide}>
                                <NumberField label="Horizontal tanking thickness" unit="m" step="0.005" min={0} value={inputs.horiz_tanking_thick} onChange={num('horiz_tanking_thick')} />
                                <NumberField label="Vertical tanking thickness" unit="m" step="0.005" min={0} value={inputs.vert_tanking_thick} onChange={num('vert_tanking_thick')} />
                                <NumberField label="Projection" unit="m" step="0.01" min={0} value={inputs.projection} onChange={num('projection')} />
                            </div>
                            <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                                <CheckboxField label="Include tanking" checked={inputs.has_tanking} onChange={(v) => handleInputChange('has_tanking', v)} />
                                <CheckboxField label="Include waterbar" checked={inputs.has_waterbar} onChange={(v) => handleInputChange('has_waterbar', v)} />
                                <CheckboxField label="Include drainage" checked={inputs.has_drain} onChange={(v) => handleInputChange('has_drain', v)} />
                            </div>
                        </Section>

                        <Section
                            title="Columns, reinforcement and formwork"
                            description="Internal columns and scope options for the takeoff."
                            icon={<Grid3x3 size={18} aria-hidden="true" />}
                        >
                            <div className={layout.formGridWide}>
                                <NumberField label="Number of columns" unit="no." step="1" min={0} inputMode="numeric" value={inputs.num_columns} onChange={num('num_columns')} />
                                <NumberField label="Column size" unit="m" step="0.01" min={0} value={inputs.column_size} onChange={num('column_size')} />
                                <NumberField label="Column base size" unit="m" step="0.01" min={0} value={inputs.column_base_size} onChange={num('column_base_size')} />
                                <NumberField label="Column base thickness" unit="m" step="0.01" min={0} value={inputs.column_base_thick} onChange={num('column_base_thick')} />
                                {inputs.reinf_incl && (
                                    <NumberField label="Reinforcement density" unit="kg/m³" step="1" min={0} value={inputs.reinf_density} onChange={num('reinf_density')} />
                                )}
                            </div>
                            <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                                <CheckboxField label="Include reinforcement" checked={inputs.reinf_incl} onChange={(v) => handleInputChange('reinf_incl', v)} />
                                <CheckboxField label="Include formwork" checked={inputs.form_incl} onChange={(v) => handleInputChange('form_incl', v)} />
                            </div>
                        </Section>

                        <ActionBar hint="Generates SMM7 rows you can edit in the taking-off tab.">
                            <button
                                type="button"
                                onClick={handleCalculate}
                                disabled={loading}
                                className={`${action.base} ${action.primary}`}
                            >
                                <Calculator size={16} aria-hidden="true" />
                                {loading ? 'Calculating…' : 'Calculate takeoff'}
                            </button>
                        </ActionBar>

                        {error && (
                            <ErrorNotice title="Basement takeoff failed" message={error} onRetry={handleCalculate} />
                        )}

                        {loading && (
                            <LoadingState
                                label="Calculating basement quantities…"
                                detail="Excavation, concrete, formwork and waterproofing are derived from the dimensions above."
                            />
                        )}
                    </div>

                    {/* Results column */}
                    <aside className="min-w-0">
                        <Section title="Calculation summary" description="Quantities produced by the current inputs.">
                            {takeoffData.length > 0 ? (
                                <>
                                    <TableScrollRegion label="Basement takeoff summary" minWidth="26rem" hint={false}>
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-100 dark:bg-slate-800">
                                                <tr>
                                                    <th className="px-2 py-2 text-left font-semibold sm:px-3">Description</th>
                                                    <th className="px-2 py-2 text-center font-semibold">Unit</th>
                                                    <th className="px-2 py-2 text-right font-semibold sm:px-3">Qty</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {takeoffData.map((item, idx) => (
                                                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                                                        <td className="px-2 py-2 text-xs sm:px-3 sm:text-sm">{item.description}</td>
                                                        <td className="px-2 py-2 text-center text-xs">{item.unit}</td>
                                                        <td className="px-2 py-2 text-right font-mono text-xs sm:px-3 sm:text-sm">
                                                            {typeof item.quantity === 'number' ? item.quantity.toFixed(2) : item.quantity}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </TableScrollRegion>
                                    <p className={`mt-3 text-[11px] leading-snug ${text.helper}`}>
                                        Switch to the <strong>Takeoff</strong> tab to edit descriptions or add manual items,
                                        then review the dimension paper and BOQ.
                                    </p>
                                </>
                            ) : loading ? (
                                <LoadingState label="Waiting for quantities…" />
                            ) : (
                                <EmptyState
                                    compact
                                    title="No items calculated yet"
                                    description="Run the takeoff to populate the summary, dimension paper and BOQ."
                                />
                            )}
                        </Section>
                    </aside>
                </div>
            )}

            {activeTab === "takeoff" && (
                <div className="overflow-hidden rounded-lg bg-white shadow-sm dark:bg-slate-900">
                    <EnglishMethodTakeoffSheet
                        key={editorKey}
                        initialItems={takeoffData}
                        onChange={setTakeoffData}
                        projectInfo={{
                            projectName: "Basement Project",
                            clientName: "Client Name",
                            projectDate: new Date().toLocaleDateString()
                        }}
                    />
                </div>
            )}

            {activeTab === "sheet" && (
                <div>
                    <UniversalSheet items={takeoffData} />
                </div>
            )}

            {activeTab === "boq" && (
                <div>
                    <UniversalBOQ items={takeoffData} />
                </div>
            )}
        </WorkspacePage>
    );
};

export default BasementTakeoffApp;
