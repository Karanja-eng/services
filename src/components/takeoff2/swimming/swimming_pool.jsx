import React, { useState } from "react";
import { Waves, Calculator, AlertCircle } from "lucide-react";
import Pool2DDrawing from "./Pool2_D";
import StructuralVisualizationComponent from "../../Drawings/visualise_component";
import {
  UniversalTabs,
  UniversalSheet,
  UniversalBOQ
} from '../universal_component';

// Mock components for demonstration (replace with actual imports in your project)
import EnglishMethodTakeoffSheet from "../ExternalWorks/EnglishMethodTakeoffSheet";

const InputField = ({ label, name, value, onChange, type = "number", step = "0.01" }) => (
  <div>
    <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      step={step}
      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
    />
  </div>
);

const SelectField = ({ label, name, value, onChange, options }) => (
  <div>
    <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

const CheckboxField = ({ label, name, checked, onChange }) => (
  <div className="flex items-center gap-2">
    <input
      type="checkbox"
      name={name}
      checked={checked}
      onChange={onChange}
      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-400"
    />
    <label className="text-xs font-medium text-gray-700">{label}</label>
  </div>
);

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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : (type === "select-one" ? value : parseFloat(value) || 0),
    }));
  };

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
    { value: "kidney", label: "Kidney Shaped" },
    { value: "oval", label: "Oval/Circular" },
    { value: "L-shaped", label: "L-Shaped" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 shadow-sm px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Waves className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Swimming Pool Quantity Takeoff</h1>
              <p className="text-sm text-gray-600">Professional BOQ Calculator with CAD Visualization</p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <UniversalTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabs={['calculator', '2d-drawing', '3d-view', 'takeoff', 'sheet', 'boq']}
          />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 max-w-7xl mx-auto w-full">
        {activeTab === "calculator" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
                <Calculator className="w-5 h-5 text-gray-500" /> Parameters
              </h2>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-4">
                  <h3 className="col-span-2 text-sm font-bold text-gray-700 mt-2">Pool Type</h3>
                  <div className="col-span-2">
                    <SelectField label="Pool Shape" name="poolShape" value={formData.poolShape} onChange={handleChange} options={poolShapeOptions} />
                  </div>

                  <h3 className="col-span-2 text-sm font-bold text-gray-700 mt-2">Dimensions</h3>
                  <InputField label="Length (m)" name="intL" value={formData.intL} onChange={handleChange} />
                  <InputField label="Width (m)" name="intW" value={formData.intW} onChange={handleChange} />
                  <InputField label="Shallow Depth (m)" name="shallowDepth" value={formData.shallowDepth} onChange={handleChange} />
                  <InputField label="Deep Depth (m)" name="deepDepth" value={formData.deepDepth} onChange={handleChange} />

                  <h3 className="col-span-2 text-sm font-bold text-gray-700 mt-2">Structure</h3>
                  <InputField label="Wall Thickness (m)" name="wallThick" value={formData.wallThick} onChange={handleChange} />
                  <InputField label="Bed Thickness (m)" name="bedThick" value={formData.bedThick} onChange={handleChange} />
                  <InputField label="Tanking (m)" name="tankingThick" value={formData.tankingThick} onChange={handleChange} />
                  <InputField label="Coping Width (m)" name="copingWidth" value={formData.copingWidth} onChange={handleChange} />

                  <h3 className="col-span-2 text-sm font-bold text-gray-700 mt-2">Features</h3>
                  <div className="col-span-2 space-y-2">
                    <CheckboxField label="Include Reinforcement" name="reinfIncl" checked={formData.reinfIncl} onChange={handleChange} />
                    <CheckboxField label="Include Formwork" name="formIncl" checked={formData.formIncl} onChange={handleChange} />
                    <CheckboxField label="Include Finishes" name="includeFinishes" checked={formData.includeFinishes} onChange={handleChange} />
                    <CheckboxField label="Include MEP" name="includeMep" checked={formData.includeMep} onChange={handleChange} />
                    <CheckboxField label="Overflow System" name="overflowSystem" checked={formData.overflowSystem} onChange={handleChange} />
                    <CheckboxField label="Diving Board" name="divingBoard" checked={formData.divingBoard} onChange={handleChange} />
                    <CheckboxField label="Shallow End Steps" name="shallowEndSteps" checked={formData.shallowEndSteps} onChange={handleChange} />
                    <CheckboxField label="Include Backfill" name="backfillIncl" checked={formData.backfillIncl} onChange={handleChange} />
                  </div>
                </div>
              </div>

              <button
                onClick={handleCalculate}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition-colors disabled:opacity-50"
              >
                {loading ? "Calculating..." : "Calculate Quantities"}
              </button>

              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded text-sm flex gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>{error}</div>
                </div>
              )}
            </div>

            <div className="bg-blue-50/50 p-6 rounded-lg border border-blue-100">
              <h3 className="font-bold text-blue-900 mb-2">Swimming Pool Calculation</h3>
              <p className="text-sm text-blue-800 mb-4">
                Comprehensive BOQ generation for various pool types including:
              </p>
              <ul className="list-disc pl-5 text-sm text-blue-800 space-y-1 mb-4">
                <li>Rectangular, Kidney, Oval, and L-shaped pools</li>
                <li>Complete earthworks and excavation</li>
                <li>Structural concrete and reinforcement</li>
                <li>Waterproofing and finishes</li>
                <li>MEP systems (filtration, lighting, etc.)</li>
                <li>Safety features and accessories</li>
              </ul>

              {Object.keys(summary).length > 0 && (
                <div className="mt-4 bg-white p-4 rounded shadow-sm border border-green-100">
                  <h4 className="text-green-700 font-bold mb-2">Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-600">Pool Type:</div>
                    <div className="font-semibold">{summary.pool_type?.toUpperCase()}</div>
                    <div className="text-gray-600">Water Volume:</div>
                    <div className="font-semibold">{summary.water_volume_liters?.toLocaleString()} L</div>
                    <div className="text-gray-600">Total Concrete:</div>
                    <div className="font-semibold">{summary.total_concrete_m3} m³</div>
                    <div className="text-gray-600">Total Excavation:</div>
                    <div className="font-semibold">{summary.total_excavation_m3} m³</div>
                    <div className="text-gray-600">Tiling Area:</div>
                    <div className="font-semibold">{summary.tiling_area_m2} m²</div>
                  </div>
                  <p className="text-xs text-gray-600 mt-3">
                    Generated {takeoffData.length} BOQ items. Check other tabs for details.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "2d-drawing" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[800px] overflow-hidden">
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
          <div className="bg-gray-900 rounded-lg shadow-sm border border-gray-700 h-[800px] overflow-hidden">
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full overflow-hidden">
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

        {activeTab === "sheet" && <div className="h-full"><UniversalSheet items={takeoffData} /></div>}
        {activeTab === "boq" && <div className="h-full"><UniversalBOQ items={takeoffData} /></div>}
      </main>
    </div>
  );
}