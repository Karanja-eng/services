import React, { useState } from "react";
import { Waves, Calculator, Ruler, Layers, Sparkles } from "lucide-react";
import Pool2DDrawing from "./Pool2_D";
import StructuralVisualizationComponent from "../../Drawings/visualise_component";
import {
  UniversalTabs,
  UniversalSheet,
  UniversalBOQ
} from '../universal_component';
import EnglishMethodTakeoffSheet from "../ExternalWorks/EnglishMethodTakeoffSheet";
import {
  WorkspacePage,
  PageHeader,
  Section,
  MetaChip,
  NumberField,
  SelectField,
  CheckboxField,
  ErrorNotice,
  ResultBanner,
  KeyValueGrid,
  ActionBar,
  action,
  layout,
  text,
} from "../../shared/ui";

/**
 * SwimmingPoolTakeoffApp — swimming pool quantity takeoff.
 *
 * UI cleanup: calculator tab rebuilt from the shared UI kit (page header,
 * sectioned fields, responsive single-column layout, sticky phone action bar,
 * honest error/summary states). The downstream tabs (2D, 3D, takeoff, sheet,
 * BOQ) keep their existing components and props.
 *
 * Preserved exactly: `formData` keys/defaults, the request payload and endpoint,
 * and the parsing contract — numbers use `parseFloat(value) || 0`, selects keep
 * their string value, checkboxes keep booleans.
 */
export default function SwimmingPoolTakeoffApp() {
  const [activeTab, setActiveTab] = useState("calculator");
  const [formData, setFormData] = useState({
    intL: 12.0,
    intW: 8.0,
    shallowDepth: 1.5,
    deepDepth: 2.8,
    vegSoilDepth: 0.15,
    workingSpace: 0.335,
    blindingThick: 0.075,
    bedThick: 0.15,
    wallThick: 0.1,
    tankingThick: 0.02,
    trenchWidth: 1.0,
    trenchDepth: 0.2,
    wallHeightAbove: 0.3,
    numSteps: 0,
    stepRise: 0.3,
    stepTread: 0.3,
    excavStaged: false,
    stageDepth: 1.5,
    reinfIncl: true,
    reinfDensity: 100,
    formIncl: true,
    backfillIncl: true,
    poolShape: "rectangular",
    includeFinishes: true,
    includeMep: true,
    overflowSystem: false,
    divingBoard: false,
    shallowEndSteps: true,
    copingWidth: 0.3,
  });

  const [takeoffData, setTakeoffData] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editorKey, setEditorKey] = useState(0);

  // Parsing contract of the previous `handleChange`, preserved:
  // checkbox -> boolean, select -> string, number -> parseFloat(v) || 0.
  const setNumber = (name) => (value) =>
    setFormData((prev) => ({ ...prev, [name]: parseFloat(value) || 0 }));
  const setSelect = (name) => (value) =>
    setFormData((prev) => ({ ...prev, [name]: value }));
  const setCheck = (name) => (checked) =>
    setFormData((prev) => ({ ...prev, [name]: checked }));

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        int_l: formData.intL,
        int_w: formData.intW,
        shallow_depth: formData.shallowDepth,
        deep_depth: formData.deepDepth,
        veg_soil_depth: formData.vegSoilDepth,
        working_space: formData.workingSpace,
        blinding_thick: formData.blindingThick,
        bed_thick: formData.bedThick,
        wall_thick: formData.wallThick,
        tanking_thick: formData.tankingThick,
        trench_width: formData.trenchWidth,
        trench_depth: formData.trenchDepth,
        wall_height_above: formData.wallHeightAbove,
        num_steps: formData.numSteps,
        step_rise: formData.stepRise,
        step_tread: formData.stepTread,
        excav_staged: formData.excavStaged,
        stage_depth: formData.stageDepth,
        reinf_incl: formData.reinfIncl,
        reinf_density: formData.reinfDensity,
        form_incl: formData.formIncl,
        backfill_incl: formData.backfillIncl,
        pool_shape: formData.poolShape,
        include_finishes: formData.includeFinishes,
        include_mep: formData.includeMep,
        overflow_system: formData.overflowSystem,
        diving_board: formData.divingBoard,
        shallow_end_steps: formData.shallowEndSteps,
        coping_width: formData.copingWidth,
      };

      const response = await fetch("http://localhost:8001/swimming_pool_router/api/calculate-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Failed to fetch");

      const data = await response.json();

      if (data.boq) {
        const formattedItems = data.boq.map((row, index) => ({
          id: index + 1,
          billNo: row.item,
          itemNo: (index + 1).toString(),
          description: row.description,
          unit: row.unit,
          quantity: row.quantity || 0,
          rate: 0,
          amount: 0,
          dimensions: [],
          isHeader: false
        }));
        setTakeoffData(formattedItems);
        setSummary(data.summary || {});
        setEditorKey(prev => prev + 1);
      }
    } catch (err) {
      setError(err.message || "Failed to connect to backend. Ensure FastAPI server is running on port 8001.");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const poolShapeOptions = [
    { value: "rectangular", label: "Rectangular" },
    { value: "kidney", label: "Kidney shaped" },
    { value: "oval", label: "Oval / circular" },
    { value: "L-shaped", label: "L-shaped" },
  ];

  return (
    <WorkspacePage width="wide">
      <PageHeader
        title="Swimming pool quantity takeoff"
        subtitle="Excavation, structure, waterproofing, finishes and MEP quantities."
        icon={<Waves size={22} aria-hidden="true" />}
        meta={
          <>
            <MetaChip tone="info">{formData.poolShape}</MetaChip>
            <MetaChip>{takeoffData.length} BOQ item(s)</MetaChip>
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
            {loading ? "Calculating…" : "Calculate quantities"}
          </button>
        }
      />

      <div className="mb-4 -mx-1 overflow-x-auto">
        <UniversalTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabs={['calculator', '2d-drawing', '3d-view', 'takeoff', 'sheet', 'boq']}
        />
      </div>

      {activeTab === "calculator" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
          <div className="space-y-4 lg:col-span-2">
            <Section
              title="Pool type"
              description="The shape changes the surface area and volume formulae used by the backend."
              icon={<Waves size={18} aria-hidden="true" />}
            >
              <div className={layout.formGrid}>
                <SelectField
                  label="Pool shape"
                  value={formData.poolShape}
                  onChange={setSelect("poolShape")}
                  options={poolShapeOptions}
                />
              </div>
            </Section>

            <Section
              title="Dimensions"
              description="Internal plan size and water depths (metres)."
              icon={<Ruler size={18} aria-hidden="true" />}
            >
              <div className={layout.formGrid}>
                <NumberField label="Internal length" unit="m" step="0.01" min={0} value={formData.intL} onChange={setNumber("intL")} />
                <NumberField label="Internal width" unit="m" step="0.01" min={0} value={formData.intW} onChange={setNumber("intW")} />
                <NumberField label="Shallow end depth" unit="m" step="0.01" min={0} value={formData.shallowDepth} onChange={setNumber("shallowDepth")} />
                <NumberField label="Deep end depth" unit="m" step="0.01" min={0} value={formData.deepDepth} onChange={setNumber("deepDepth")} />
              </div>
            </Section>

            <Section
              title="Structure"
              description="Concrete, tanking and coping dimensions."
              icon={<Layers size={18} aria-hidden="true" />}
              tone="muted"
            >
              <div className={layout.formGrid}>
                <NumberField label="Wall thickness" unit="m" step="0.005" min={0} value={formData.wallThick} onChange={setNumber("wallThick")} />
                <NumberField label="Base slab thickness" unit="m" step="0.005" min={0} value={formData.bedThick} onChange={setNumber("bedThick")} />
                <NumberField label="Tanking thickness" unit="m" step="0.005" min={0} value={formData.tankingThick} onChange={setNumber("tankingThick")} />
                <NumberField label="Coping width" unit="m" step="0.01" min={0} value={formData.copingWidth} onChange={setNumber("copingWidth")} />
              </div>
            </Section>

            <Section
              title="Scope options"
              description="Choose which element groups are included in the bill."
              icon={<Sparkles size={18} aria-hidden="true" />}
            >
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                <CheckboxField label="Include reinforcement" checked={formData.reinfIncl} onChange={setCheck("reinfIncl")} />
                <CheckboxField label="Include formwork" checked={formData.formIncl} onChange={setCheck("formIncl")} />
                <CheckboxField label="Include finishes" checked={formData.includeFinishes} onChange={setCheck("includeFinishes")} />
                <CheckboxField label="Include MEP" checked={formData.includeMep} onChange={setCheck("includeMep")} />
                <CheckboxField label="Overflow system" checked={formData.overflowSystem} onChange={setCheck("overflowSystem")} />
                <CheckboxField label="Diving board" checked={formData.divingBoard} onChange={setCheck("divingBoard")} />
                <CheckboxField label="Shallow end steps" checked={formData.shallowEndSteps} onChange={setCheck("shallowEndSteps")} />
                <CheckboxField label="Include backfill" checked={formData.backfillIncl} onChange={setCheck("backfillIncl")} />
              </div>
            </Section>

            <ActionBar hint="Generates BOQ rows you can edit in the taking-off tab.">
              <button
                type="button"
                onClick={handleCalculate}
                disabled={loading}
                className={`${action.base} ${action.primary}`}
              >
                <Calculator size={16} aria-hidden="true" />
                {loading ? "Calculating…" : "Calculate quantities"}
              </button>
            </ActionBar>

            {error && (
              <ErrorNotice
                title="Swimming pool takeoff failed"
                message={error}
                onRetry={handleCalculate}
              />
            )}
          </div>

          <aside className="space-y-4">
            <Section title="What this calculates" description="Element groups included in the bill.">
              <ul className={`list-inside list-disc space-y-1 text-xs leading-relaxed ${text.subtitle}`}>
                <li>Rectangular, kidney, oval and L-shaped pools</li>
                <li>Earthworks and excavation</li>
                <li>Structural concrete and reinforcement</li>
                <li>Waterproofing and finishes</li>
                <li>MEP systems (filtration, lighting)</li>
                <li>Safety features and accessories</li>
              </ul>
            </Section>

            {Object.keys(summary).length > 0 && (
              <ResultBanner
                status="pass"
                title="Quantities generated"
                description={`${takeoffData.length} BOQ items are available in the taking-off, sheet and BOQ tabs.`}
              >
                <div className="mt-3">
                  <KeyValueGrid
                    columns={2}
                    items={[
                      { label: "Pool type", value: summary.pool_type?.toUpperCase?.() ?? "—" },
                      { label: "Water volume", value: summary.water_volume_liters?.toLocaleString?.() ?? "—", unit: "L" },
                      { label: "Concrete", value: summary.total_concrete_m3, unit: "m³" },
                      { label: "Excavation", value: summary.total_excavation_m3, unit: "m³" },
                      { label: "Tiling area", value: summary.tiling_area_m2, unit: "m²" },
                    ]}
                  />
                </div>
              </ResultBanner>
            )}
          </aside>
        </div>
      )}

      {activeTab === "2d-drawing" && (
        <div className="h-[70vh] min-h-[360px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Pool2DDrawing poolData={{
            int_l: formData.intL,
            int_w: formData.intW,
            shallow_depth: formData.shallowDepth,
            deep_depth: formData.deepDepth,
            wall_thick: formData.wallThick,
            tanking_thick: formData.tankingThick,
            working_space: formData.workingSpace,
            bed_thick: formData.bedThick,
            pool_shape: formData.poolShape,
          }} />
        </div>
      )}

      {activeTab === "3d-view" && (
        <div className="h-[70vh] min-h-[360px] overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-sm">
          <StructuralVisualizationComponent
            componentType="pool"
            componentData={{
              int_l: formData.intL,
              int_w: formData.intW,
              shallow_depth: formData.shallowDepth,
              deep_depth: formData.deepDepth,
              wall_thick: formData.wallThick,
              bed_thick: formData.bedThick,
              pool_shape: formData.poolShape,
            }}
            theme="dark"
          />
        </div>
      )}

      {activeTab === "takeoff" && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <EnglishMethodTakeoffSheet
            key={editorKey}
            initialItems={takeoffData}
            onChange={setTakeoffData}
            projectInfo={{
              projectName: `Swimming Pool Project - ${formData.poolShape.toUpperCase()}`,
              clientName: "Client Name",
              projectDate: new Date().toLocaleDateString()
            }}
          />
        </div>
      )}

      {activeTab === "sheet" && <div><UniversalSheet items={takeoffData} /></div>}
      {activeTab === "boq" && <div><UniversalBOQ items={takeoffData} /></div>}
    </WorkspacePage>
  );
}
