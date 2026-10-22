import React, { useState } from "react";
import { Calculator, Ruler, Layers, Box, CheckCircle2, ExternalLink } from "lucide-react";
import axios from "axios";
import { Link } from "react-router-dom";
import { SepticSystem2DDrawings } from "./TwoD";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from '../universal_component';
import EnglishMethodTakeoffSheet from "../ExternalWorks/EnglishMethodTakeoffSheet";
import StructuralVisualizationComponent from "../../Drawings/visualise_component";
import { useTakeoffBridge } from "../../../state/TakeoffBridgeContext";
import { TAKEOFF_SOURCE } from "../../../state/takeoffBridge";
import {
  Section,
  NumberField,
  SelectField,
  TechnicalDetails,
  ErrorNotice,
  ResultBanner,
  LoadingState,
  KeyValueGrid,
  ActionBar,
  action,
  layout,
  text,
} from "../../shared/ui";

/**
 * EnhancedSepticTakeoffApp — septic tank / manhole / soakpit takeoff.
 *
 * UI cleanup:
 * - The initial input form is composed from the shared engineering fields
 *   (single column on phones, 2–3 columns on larger screens, explicit metres).
 * - Payload fields that previously had no visible input (cover dimensions,
 *   pipe lengths, blinding, vegetable soil, working space, cover soil) are now
 *   editable inside an "Advanced" disclosure. Their default values are
 *   unchanged, so the request payload is identical unless the user edits them.
 * - `formData` keys, `handleChange` parsing semantics and the POST to
 *   `/septicRouter/api/calculate` are unchanged.
 * - The downstream tabs (`takeoff`, `sheet`, `boq`) and their components are
 *   untouched.
 */
export default function EnhancedSepticTakeoffApp({ isDark = false }) {
  const [activeTab, setActiveTab] = useState("calculator");
  const { publish } = useTakeoffBridge();
  const [published, setPublished] = useState(false);
  const [formData, setFormData] = useState({
    tankIntL: 3.0, tankIntW: 2.5, tankDepthInt: 2.0, wallThick: 0.2, bedThickTank: 0.15, slabThick: 0.2, floorSlope: 0,
    manholeIntL: 0.7, manholeIntW: 0.6, manholeDepthInt: 0.7, bedThickManhole: 0.1, coverL: 0.6, coverW: 0.45, numCovers: 3,
    soakpitShape: 'circular', soakpitDiameter: 2.0, soakpitDepth: 3.0, soakpitWallThick: 0.23,
    numBaffles: 2, baffleL: 2.3, baffleThick: 0.2, baffleHeight1: 1.5, baffleHeight2: 1.3,
    inletPipeL: 1.0, outletPipeL: 1.0, pipeDiameter: 0.15,
    blindingThick: 0.075, vegSoil: 0.2, workingSpace: 0.2, coverSoilDepth: 0.3,
  });

  const [takeoffData, setTakeoffData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [editorKey, setEditorKey] = useState(0);

  /**
   * Same semantics as the previous `handleChange`:
   * numeric/select values are `parseFloat(value) || value`.
   */
  const setField = (name, rawValue) => {
    setFormData((prev) => ({
      ...prev,
      [name]: parseFloat(rawValue) || rawValue,
    }));
  };

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const baffleHeights = Array.from({ length: formData.numBaffles }, (_, i) => formData[`baffleHeight${i + 1}`] || 1.5);
      const payload = {
        tank_int_l: formData.tankIntL, tank_int_w: formData.tankIntW, tank_depth_int: formData.tankDepthInt,
        wall_thick: formData.wallThick, bed_thick_tank: formData.bedThickTank, slab_thick: formData.slabThick,
        manhole_int_l: formData.manholeIntL, manhole_int_w: formData.manholeIntW, manhole_depth_int: formData.manholeDepthInt,
        bed_thick_manhole: formData.bedThickManhole, cover_l: formData.coverL, cover_w: formData.coverW, num_covers: formData.numCovers,
        num_baffles: formData.numBaffles, baffle_l: formData.baffleL, baffle_thick: formData.baffleThick, baffle_heights: baffleHeights,
        inlet_pipe_l: formData.inletPipeL, outlet_pipe_l: formData.outletPipeL,
        blinding_thick: formData.blindingThick, veg_soil: formData.vegSoil, working_space: formData.workingSpace, cover_soil_depth: formData.coverSoilDepth,
        soakpit_shape: formData.soakpitShape, soakpit_diameter: formData.soakpitDiameter, soakpit_depth: formData.soakpitDepth, soakpit_wall_thick: formData.soakpitWallThick
      };

      const response = await axios.post("http://localhost:8001/septicRouter/api/calculate", payload);
      const data = response.data;

      if (data.boq) {
        setTakeoffData(data.boq.map((row, i) => ({
          id: i + 1,
          billNo: "S" + (i + 1),
          itemNo: row.item.toString(),
          description: row.description,
          unit: row.unit,
          quantity: parseFloat(row.quantity) || 0,
          rate: row.rate || 0,
          amount: row.amount || 0,
          dimensions: []
        })));
        setSummary(data.summary);
        setEditorKey(prev => prev + 1);
        setPublished(true);
        // Explicit hand-off to the global taking-off workflow. Re-running the
        // calculation replaces only the septic batch (no duplicate rows) and
        // never overwrites items from other sources.
        publish(
          data.boq.map((row, i) => ({
            id: i + 1,
            billNo: "S" + (i + 1),
            itemNo: row.item.toString(),
            description: row.description,
            unit: row.unit,
            quantity: parseFloat(row.quantity) || 0,
            rate: row.rate || 0,
            amount: row.amount || 0,
            dimensions: []
          })),
          TAKEOFF_SOURCE.septic
        );
        setActiveTab("takeoff");
      }
    } catch (err) {
      setError(err.message || "Failed to connect to backend");
    } finally {
      setLoading(false);
    }
  };

  // Map config for 2D/3D
  const visualConfig = {
    septicTank: {
      intL: formData.tankIntL,
      intW: formData.tankIntW,
      depth: formData.tankDepthInt,
      wallThick: formData.wallThick,
      slabThick: formData.slabThick,
      bedThick: formData.bedThickTank,
      numBaffles: formData.numBaffles,
      baffleThick: formData.baffleThick,
      baffleHeights: Array.from({ length: formData.numBaffles }, (_, i) => formData[`baffleHeight${i + 1}`] || 1.5)
    },
    manhole: {
      intL: formData.manholeIntL,
      intW: formData.manholeIntW,
      depth: formData.manholeDepthInt,
      wallThick: formData.wallThick,
      coverL: formData.coverL,
      coverW: formData.coverW
    },
    soakpit: {
      diameter: formData.soakpitDiameter,
      depth: formData.soakpitDepth,
      wallThick: formData.soakpitWallThick,
      shape: formData.soakpitShape
    }
  };

  const numBaffles = Number(formData.numBaffles) || 0;

  return (
    <div className="flex min-h-full flex-col bg-gray-50 dark:bg-slate-900">
      {/* Tool header + document tabs. Tabs are the existing component; only the
          container is responsive so it scrolls instead of overflowing. */}
      <header className="sticky top-0 z-20 shrink-0 border-b border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:px-5 sm:py-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-gray-900 dark:text-slate-100 sm:text-lg">
              Septic System Takeoff
            </h1>
            <p className={`truncate text-[11px] ${text.subtitle} sm:text-xs`}>
              Tank · manhole · soakpit quantities to SMM7
            </p>
          </div>
        </div>
        <div className="mt-2 -mx-1 overflow-x-auto">
          <UniversalTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabs={['calculator', '2d', '3d', 'takeoff', 'sheet', 'boq']}
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 p-3 sm:p-5">
        {published && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-200">
            <CheckCircle2 size={14} aria-hidden="true" />
            <span>Published to the global taking-off, dimension paper and BOQ.</span>
            <Link
              to="/quantity/manual/taking-off"
              className="inline-flex items-center gap-1 font-semibold underline hover:no-underline"
            >
              Open taking-off sheet
              <ExternalLink size={12} aria-hidden="true" />
            </Link>
          </div>
        )}
        {activeTab === "calculator" && (
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
            <div className="space-y-4 lg:col-span-2">
              <Section
                title="Septic tank chamber"
                description="Internal dimensions and concrete thicknesses in metres."
                icon={<Ruler size={18} aria-hidden="true" />}
              >
                <div className={layout.formGridWide}>
                  <NumberField label="Internal length" unit="m" step="0.01" min={0} value={formData.tankIntL} onChange={(v) => setField('tankIntL', v)} />
                  <NumberField label="Internal width" unit="m" step="0.01" min={0} value={formData.tankIntW} onChange={(v) => setField('tankIntW', v)} />
                  <NumberField label="Internal depth" unit="m" step="0.01" min={0} value={formData.tankDepthInt} onChange={(v) => setField('tankDepthInt', v)} />
                  <NumberField label="Wall thickness" unit="m" step="0.01" min={0} value={formData.wallThick} onChange={(v) => setField('wallThick', v)} />
                  <NumberField label="Cover slab thickness" unit="m" step="0.01" min={0} value={formData.slabThick} onChange={(v) => setField('slabThick', v)} />
                  <NumberField label="Base slab thickness" unit="m" step="0.01" min={0} value={formData.bedThickTank} onChange={(v) => setField('bedThickTank', v)} />
                </div>
              </Section>

              <Section
                title="Baffle walls"
                description="Baffle count and geometry; heights are entered per baffle."
                icon={<Layers size={18} aria-hidden="true" />}
                tone="muted"
              >
                <div className={layout.formGridWide}>
                  <NumberField label="Number of baffles" unit="no." step="1" min={0} max={4} inputMode="numeric" value={formData.numBaffles} onChange={(v) => setField('numBaffles', v)} />
                  <NumberField label="Baffle length" unit="m" step="0.01" min={0} value={formData.baffleL} onChange={(v) => setField('baffleL', v)} />
                  <NumberField label="Baffle thickness" unit="m" step="0.01" min={0} value={formData.baffleThick} onChange={(v) => setField('baffleThick', v)} />
                  {Array.from({ length: numBaffles }).map((_, i) => (
                    <NumberField
                      key={i}
                      label={`Baffle ${i + 1} height`}
                      unit="m"
                      step="0.01"
                      min={0}
                      value={formData[`baffleHeight${i + 1}`]}
                      onChange={(v) => setField(`baffleHeight${i + 1}`, v)}
                    />
                  ))}
                </div>
              </Section>

              <Section
                title="Inspection manhole"
                description="Chamber and cover dimensions for the access manhole."
                icon={<Box size={18} aria-hidden="true" />}
              >
                <div className={layout.formGridWide}>
                  <NumberField label="Internal length" unit="m" step="0.01" min={0} value={formData.manholeIntL} onChange={(v) => setField('manholeIntL', v)} />
                  <NumberField label="Internal width" unit="m" step="0.01" min={0} value={formData.manholeIntW} onChange={(v) => setField('manholeIntW', v)} />
                  <NumberField label="Internal depth" unit="m" step="0.01" min={0} value={formData.manholeDepthInt} onChange={(v) => setField('manholeDepthInt', v)} />
                  <NumberField label="Number of covers" unit="no." step="1" min={0} inputMode="numeric" value={formData.numCovers} onChange={(v) => setField('numCovers', v)} />
                  <NumberField label="Cover length" unit="m" step="0.01" min={0} value={formData.coverL} onChange={(v) => setField('coverL', v)} />
                  <NumberField label="Cover width" unit="m" step="0.01" min={0} value={formData.coverW} onChange={(v) => setField('coverW', v)} />
                </div>
              </Section>

              <Section
                title="Soak pit"
                description="Circular or rectangular absorption pit."
                icon={<Layers size={18} aria-hidden="true" />}
                tone="muted"
              >
                <div className={layout.formGridWide}>
                  <SelectField
                    label="Shape"
                    value={formData.soakpitShape}
                    onChange={(v) => setField('soakpitShape', v)}
                    options={[
                      { value: 'circular', label: 'Circular' },
                      { value: 'rectangular', label: 'Rectangular' },
                    ]}
                  />
                  <NumberField label="Diameter / width" unit="m" step="0.01" min={0} value={formData.soakpitDiameter} onChange={(v) => setField('soakpitDiameter', v)} />
                  <NumberField label="Depth" unit="m" step="0.01" min={0} value={formData.soakpitDepth} onChange={(v) => setField('soakpitDepth', v)} />
                  <NumberField label="Honeycombed wall thickness" unit="m" step="0.01" min={0} value={formData.soakpitWallThick} onChange={(v) => setField('soakpitWallThick', v)} />
                </div>
              </Section>

              {/* Payload fields that previously had no visible input. Defaults are
                  unchanged; they are shown so nothing in the request is hidden. */}
              <TechnicalDetails summary="Advanced — pipes, blinding and earthworks">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <NumberField label="Inlet pipe length" unit="m" step="0.01" min={0} value={formData.inletPipeL} onChange={(v) => setField('inletPipeL', v)} />
                  <NumberField label="Outlet pipe length" unit="m" step="0.01" min={0} value={formData.outletPipeL} onChange={(v) => setField('outletPipeL', v)} />
                  <NumberField label="Blinding thickness" unit="m" step="0.005" min={0} value={formData.blindingThick} onChange={(v) => setField('blindingThick', v)} />
                  <NumberField label="Vegetable soil strip" unit="m" step="0.01" min={0} value={formData.vegSoil} onChange={(v) => setField('vegSoil', v)} />
                  <NumberField label="Working space allowance" unit="m" step="0.01" min={0} value={formData.workingSpace} onChange={(v) => setField('workingSpace', v)} />
                  <NumberField label="Cover soil depth" unit="m" step="0.01" min={0} value={formData.coverSoilDepth} onChange={(v) => setField('coverSoilDepth', v)} />
                  <NumberField label="Manhole base thickness" unit="m" step="0.01" min={0} value={formData.bedThickManhole} onChange={(v) => setField('bedThickManhole', v)} />
                </div>
              </TechnicalDetails>

              <ActionBar sticky={false}>
                <button
                  type="button"
                  onClick={handleCalculate}
                  disabled={loading}
                  className={`${action.base} ${action.primary} w-full sm:w-auto`}
                >
                  {loading ? (
                    'Calculating…'
                  ) : (
                    <>
                      <Calculator size={16} aria-hidden="true" /> Calculate quantities
                    </>
                  )}
                </button>
              </ActionBar>

              {error && (
                <ErrorNotice
                  title="Septic takeoff could not be calculated"
                  message={error}
                  onRetry={handleCalculate}
                />
              )}

              {loading && (
                <LoadingState
                  label="Calculating septic quantities…"
                  detail="Concrete, formwork and excavation are computed from the dimensions above."
                />
              )}
            </div>

            <aside className="space-y-4">
              <Section title="How this works" description="Five steps from dimensions to bill.">
                <ol className={`list-inside list-decimal space-y-1.5 text-xs leading-relaxed ${text.subtitle}`}>
                  <li>Enter the tank, manhole and soak pit dimensions.</li>
                  <li>Configure the baffle walls.</li>
                  <li>Calculate to generate the takeoff and BOQ rows.</li>
                  <li>Check the 2D and 3D views against the input.</li>
                  <li>Edit and price the rows in the taking-off and BOQ tabs.</li>
                </ol>
              </Section>

              {summary && (
                <ResultBanner
                  status="pass"
                  title="Takeoff generated"
                  description="Rows are available in the taking-off, sheet and BOQ tabs."
                >
                  <div className="mt-3">
                    <KeyValueGrid
                      columns={2}
                      items={[
                        { label: 'Total concrete', value: summary.total_concrete, unit: 'm³' },
                        { label: 'Total excavation', value: summary.total_excavation, unit: 'm³' },
                        { label: 'Total formwork', value: summary.total_formwork, unit: 'm²' },
                        { label: 'BOQ items', value: takeoffData.length, unit: 'no.' },
                      ]}
                    />
                  </div>
                </ResultBanner>
              )}
            </aside>
          </div>
        )}

        {activeTab === "takeoff" && (
          <div className="rounded-lg bg-white shadow dark:bg-slate-800">
            <EnglishMethodTakeoffSheet
              key={editorKey}
              initialItems={takeoffData}
              onChange={setTakeoffData}
            />
          </div>
        )}

        {activeTab === "sheet" && (
          <div className="rounded-lg bg-white shadow dark:bg-slate-800">
            <UniversalSheet items={takeoffData} />
          </div>
        )}

        {activeTab === "boq" && (
          <div className="rounded-lg bg-white shadow dark:bg-slate-800">
            <UniversalBOQ items={takeoffData} />
          </div>
        )}

        {activeTab === "2d" && (
          <div className="h-[60vh] min-h-[360px] overflow-hidden rounded-lg bg-white shadow dark:bg-slate-800">
            <SepticSystem2DDrawings config={visualConfig} darkMode={isDark} />
          </div>
        )}

        {activeTab === "3d" && (
          <div className="relative h-[60vh] min-h-[360px] overflow-hidden rounded-lg bg-white shadow dark:bg-slate-800">
            <StructuralVisualizationComponent componentType="septic" buildingData={visualConfig} />
          </div>
        )}
      </div>
    </div>
  );
}
