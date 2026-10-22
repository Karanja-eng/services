import React, { useState } from "react";
import { Calculator, Building2, Ruler, Layers, CircleDot } from "lucide-react";
import axios from "axios";
import EnglishMethodTakeoffSheet from "./ExternalWorks/EnglishMethodTakeoffSheet";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from './universal_component';
import {
  WorkspacePage,
  PageHeader,
  Section,
  MetaChip,
  NumberField,
  SelectField,
  ErrorNotice,
  ActionBar,
  ResultBanner,
  action,
  layout,
  text,
} from "../shared/ui";

/**
 * UnderGroundTankComponent — underground water tank takeoff.
 *
 * UI cleanup: the bespoke parameter list is now sectioned and uses the shared
 * engineering fields (single column on phones, 2–3 columns from `sm`). Tank
 * finishes that were already part of the request payload but had no input
 * (plaster, mastic, brick, cover to slab) are editable again, with unchanged
 * defaults.
 *
 * Preserved exactly: `tankInput` keys/defaults, the null-override logic for
 * circular vs rectangular tanks, `parseInt` for cover count, the endpoint and
 * the payload shape (`...tankInput` + explicit overrides).
 */
const UnderGroundTankComponent = () => {
  const [activeTab, setActiveTab] = useState("calculator");
  const [takeoffData, setTakeoffData] = useState([]);
  const [editorKey, setEditorKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [projectDetails, setProjectDetails] = useState({
    projectName: "",
    clientName: "",
    location: "",
    date: new Date().toISOString().split("T")[0],
    engineer: "",
  });

  // Underground Tank State
  const [tankInput, setTankInput] = useState({
    tank_type: "circular",
    veg_soil: 0.15,
    working_space: 0.3,
    blinding_thick: 0.05,
    bed_thick: 0.15,
    wall_thick: 0.2,
    slab_thick: 0.15,
    plaster_thick: 0.012,
    mastic_thick: 0.02,
    brick_thick: 0.115,
    cover_to_slab: 0.3,
    num_covers: 1,
    cover_L: 0.6,
    cover_W: 0.6,
    int_diam: 3.0,
    int_L: 4.0,
    int_W: 3.0,
    depth_int: 2.5,
  });

  const setFloat = (key) => (value) =>
    setTankInput((prev) => ({ ...prev, [key]: parseFloat(value) }));
  const setInt = (key) => (value) =>
    setTankInput((prev) => ({ ...prev, [key]: parseInt(value, 10) }));

  const calculateQuantities = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ...tankInput,
        int_diam: tankInput.tank_type === "circular" ? parseFloat(tankInput.int_diam) : null,
        int_L: tankInput.tank_type === "rectangular" ? parseFloat(tankInput.int_L) : null,
        int_W: tankInput.tank_type === "rectangular" ? parseFloat(tankInput.int_W) : null,
      };

      const response = await axios.post("http://localhost:8001/underground_tank_router/api/calculate", payload);
      const data = response.data;

      if (data && data.items) {
        const formattedItems = data.items.map((item, index) => ({
          id: index + 1,
          billNo: item.item_no || (index + 1).toString(),
          itemNo: (index + 1).toString(),
          description: item.description,
          unit: item.unit,
          quantity: item.quantity ? parseFloat(item.quantity) : 0,
          rate: item.rate ? parseFloat(item.rate) : 0,
          amount: item.amount ? parseFloat(item.amount) : 0,
          dimensions: [],
          isHeader: item.description && item.description === item.description.toUpperCase() && !item.unit
        }));
        setTakeoffData(formattedItems);
        setEditorKey(prev => prev + 1);
      }
    } catch (err) {
      console.error("Calculation error:", err);
      // Replaces the previous `alert()` with an in-page, dismissible-by-retry
      // error state. No result is fabricated.
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Calculation failed. The backend may be offline."
      );
    } finally {
      setLoading(false);
    }
  };

  const isCircular = tankInput.tank_type === "circular";

  return (
    <WorkspacePage width="wide">
      <PageHeader
        title="Underground tank takeoff"
        subtitle="Circular or rectangular water tank quantities and BOQ."
        icon={<Building2 size={22} aria-hidden="true" />}
        meta={
          <>
            <MetaChip tone="info">{isCircular ? "Circular tank" : "Rectangular tank"}</MetaChip>
            <MetaChip>{takeoffData.length} item(s) generated</MetaChip>
          </>
        }
        actions={
          <button
            type="button"
            onClick={calculateQuantities}
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
          tabs={['calculator', 'takeoff', 'sheet', 'boq']}
        />
      </div>

      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
          <div className="space-y-4 lg:col-span-2">
            <Section
              title="Tank geometry"
              description="Shape and internal dimensions in metres."
              icon={<CircleDot size={18} aria-hidden="true" />}
            >
              <div className={layout.formGridWide}>
                <SelectField
                  label="Tank type"
                  value={tankInput.tank_type}
                  onChange={(value) => setTankInput({ ...tankInput, tank_type: value })}
                  options={[
                    { value: 'circular', label: 'Circular' },
                    { value: 'rectangular', label: 'Rectangular' },
                  ]}
                />
                {isCircular ? (
                  <NumberField
                    label="Internal diameter"
                    unit="m"
                    step="0.1"
                    min={0}
                    placeholder="3.0"
                    value={tankInput.int_diam ?? ""}
                    onChange={setFloat('int_diam')}
                  />
                ) : (
                  <>
                    <NumberField
                      label="Internal length"
                      unit="m"
                      step="0.1"
                      min={0}
                      placeholder="4.0"
                      value={tankInput.int_L ?? ""}
                      onChange={setFloat('int_L')}
                    />
                    <NumberField
                      label="Internal width"
                      unit="m"
                      step="0.1"
                      min={0}
                      placeholder="3.0"
                      value={tankInput.int_W ?? ""}
                      onChange={setFloat('int_W')}
                    />
                  </>
                )}
                <NumberField
                  label="Internal depth"
                  unit="m"
                  step="0.1"
                  min={0}
                  placeholder="2.5"
                  value={tankInput.depth_int}
                  onChange={setFloat('depth_int')}
                />
              </div>
            </Section>

            <Section
              title="Structure"
              description="Concrete thicknesses and excavation allowances."
              icon={<Layers size={18} aria-hidden="true" />}
              tone="muted"
            >
              <div className={layout.formGridWide}>
                <NumberField label="Wall thickness" unit="m" step="0.01" min={0} value={tankInput.wall_thick} onChange={setFloat('wall_thick')} />
                <NumberField label="Base slab thickness" unit="m" step="0.01" min={0} value={tankInput.bed_thick} onChange={setFloat('bed_thick')} />
                <NumberField label="Top slab thickness" unit="m" step="0.01" min={0} value={tankInput.slab_thick} onChange={setFloat('slab_thick')} />
                <NumberField label="Blinding thickness" unit="m" step="0.001" min={0} value={tankInput.blinding_thick} onChange={setFloat('blinding_thick')} />
                <NumberField label="Working space" unit="m" step="0.1" min={0} value={tankInput.working_space} onChange={setFloat('working_space')} />
                <NumberField label="Vegetable soil depth" unit="m" step="0.1" min={0} value={tankInput.veg_soil} onChange={setFloat('veg_soil')} />
              </div>
            </Section>

            <Section
              title="Access covers"
              description="Number and size of access covers in the top slab."
              icon={<Ruler size={18} aria-hidden="true" />}
            >
              <div className={layout.formGridWide}>
                <NumberField label="Number of covers" unit="no." step="1" min={0} inputMode="numeric" value={tankInput.num_covers} onChange={setInt('num_covers')} />
                <NumberField label="Cover length" unit="m" step="0.1" min={0} value={tankInput.cover_L} onChange={setFloat('cover_L')} />
                <NumberField label="Cover width" unit="m" step="0.1" min={0} value={tankInput.cover_W} onChange={setFloat('cover_W')} />
              </div>
            </Section>

            <Section
              title="Linings and finishes"
              description="These thicknesses are part of the calculation request."
              icon={<Layers size={18} aria-hidden="true" />}
              tone="muted"
            >
              <div className={layout.formGridWide}>
                <NumberField label="Internal plaster thickness" unit="m" step="0.001" min={0} value={tankInput.plaster_thick} onChange={setFloat('plaster_thick')} />
                <NumberField label="Mastic coating thickness" unit="m" step="0.001" min={0} value={tankInput.mastic_thick} onChange={setFloat('mastic_thick')} />
                <NumberField label="Brick wall thickness" unit="m" step="0.005" min={0} value={tankInput.brick_thick} onChange={setFloat('brick_thick')} />
                <NumberField label="Cover to slab" unit="m" step="0.01" min={0} value={tankInput.cover_to_slab} onChange={setFloat('cover_to_slab')} />
              </div>
            </Section>

            <ActionBar hint="Generates rows for the taking-off sheet, dimension paper and BOQ.">
              <button
                type="button"
                onClick={calculateQuantities}
                disabled={loading}
                className={`${action.base} ${action.primary}`}
              >
                <Calculator size={16} aria-hidden="true" />
                {loading ? "Calculating…" : "Calculate quantities"}
              </button>
            </ActionBar>

            {error && (
              <ErrorNotice
                title="Tank takeoff failed"
                message={error}
                onRetry={calculateQuantities}
              />
            )}
          </div>

          <aside className="space-y-4">
            <Section title="Project" description="Shown on the takeoff sheet header.">
              <div className="grid grid-cols-1 gap-3">
                <ProjectText label="Project name" value={projectDetails.projectName} onChange={(v) => setProjectDetails((p) => ({ ...p, projectName: v }))} />
                <ProjectText label="Client" value={projectDetails.clientName} onChange={(v) => setProjectDetails((p) => ({ ...p, clientName: v }))} />
              </div>
            </Section>

            {takeoffData.length > 0 && (
              <ResultBanner
                status="pass"
                title="Quantities generated"
                description="Review the taking-off sheet, dimension paper and BOQ tabs."
              >
                <p className={`mt-2 text-xs ${text.subtitle}`}>
                  {takeoffData.filter((i) => !i.isHeader).length} measured item(s).
                </p>
              </ResultBanner>
            )}
          </aside>
        </div>
      )}

      {activeTab === 'takeoff' && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <EnglishMethodTakeoffSheet
            key={editorKey}
            initialItems={takeoffData}
            onChange={setTakeoffData}
            projectInfo={{
              projectName: projectDetails.projectName || "Underground Tank",
              clientName: projectDetails.clientName,
              projectDate: projectDetails.date
            }}
          />
        </div>
      )}

      {activeTab === 'sheet' && (
        <div>
          <UniversalSheet items={takeoffData} />
        </div>
      )}

      {activeTab === 'boq' && (
        <div>
          <UniversalBOQ items={takeoffData} />
        </div>
      )}
    </WorkspacePage>
  );
};

/* Small local composition for the two project text fields; the shared field set
   has no text-without-hint variant worth adding for two inputs. */
const ProjectText = ({ label, value, onChange }) => (
  <label className="block">
    <span className={`mb-1.5 block text-xs font-semibold ${text.label}`}>{label}</span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:min-h-[40px]"
    />
  </label>
);

export default UnderGroundTankComponent;
