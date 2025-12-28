import React, { useState } from "react";
import { Waves, FileText, Download, AlertCircle, Calculator } from "lucide-react";
import axios from "axios";
import EnglishMethodTakeoffSheet from "./ExternalWorks/EnglishMethodTakeoffSheet";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from './universal_component';

const InputField = ({
  label,
  name,
  value,
  onChange,
  type = "number",
  step = "0.01",
}) => (
  <div>
    <label className="block text-xs font-medium text-gray-700 mb-1">
      {label}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      step={step}
      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
    />
  </div>
);

const CheckboxField = ({ label, name, checked, onChange }) => (
  <div className="flex items-center gap-2">
    <input
      type="checkbox"
      name={name}
      checked={checked}
      onChange={onChange}
      className="w-4 h-4 text-gray-800 border-gray-300 rounded focus:ring-2 focus:ring-gray-400"
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
    reinfIncl: false,
    reinfDensity: 100,
    formIncl: true,
    backfillIncl: true,
  });

  const [takeoffData, setTakeoffData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editorKey, setEditorKey] = useState(0);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : parseFloat(value) || 0,
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
      };

      const response = await axios.post("http://localhost:8001/swimming_pool_router/api/calculate-pool", payload);
      const data = response.data;

      // Standardize data
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
        setEditorKey(prev => prev + 1);
      }
    } catch (err) {
      setError(
        err.message ||
        "Failed to connect to backend. Please ensure the FastAPI server is running."
      );
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Waves className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Swimming Pool Quantity Takeoff
              </h1>
              <p className="text-sm text-gray-600">
                Professional BOQ Calculator
              </p>
            </div>
          </div>

        </div>

        <div className="mt-4">
          <UniversalTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabs={['calculator', 'takeoff', 'sheet', 'boq']}
          />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 max-w-7xl mx-auto w-full">
        {activeTab === "calculator" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            {/* Left Col: Inputs */}
            <div className="space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
                <Calculator className="w-5 h-5 text-gray-500" /> Parameters
              </h2>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-4">
                  <h3 className="col-span-2 text-sm font-bold text-gray-700 mt-2">Dimensions</h3>
                  <InputField label="Len (m)" name="intL" value={formData.intL} onChange={handleChange} />
                  <InputField label="Wid (m)" name="intW" value={formData.intW} onChange={handleChange} />
                  <InputField label="Shallow Dep (m)" name="shallowDepth" value={formData.shallowDepth} onChange={handleChange} />
                  <InputField label="Deep Dep (m)" name="deepDepth" value={formData.deepDepth} onChange={handleChange} />

                  <h3 className="col-span-2 text-sm font-bold text-gray-700 mt-2">Structure</h3>
                  <InputField label="Wall Thk (m)" name="wallThick" value={formData.wallThick} onChange={handleChange} />
                  <InputField label="Bed Thk (m)" name="bedThick" value={formData.bedThick} onChange={handleChange} />
                  <InputField label="Tanking (m)" name="tankingThick" value={formData.tankingThick} onChange={handleChange} />

                  <h3 className="col-span-2 text-sm font-bold text-gray-700 mt-2">Excavation</h3>
                  <div className="col-span-2 grid grid-cols-2 gap-4">
                    <InputField label="Veg Soil (m)" name="vegSoilDepth" value={formData.vegSoilDepth} onChange={handleChange} />
                    <InputField label="Work Space (m)" name="workingSpace" value={formData.workingSpace} onChange={handleChange} />
                  </div>

                  <h3 className="col-span-2 text-sm font-bold text-gray-700 mt-2">Options</h3>
                  <div className="col-span-2 space-y-2">
                    <CheckboxField label="Reinf" name="reinfIncl" checked={formData.reinfIncl} onChange={handleChange} />
                    <CheckboxField label="Formwork" name="formIncl" checked={formData.formIncl} onChange={handleChange} />
                    <CheckboxField label="Backfill" name="backfillIncl" checked={formData.backfillIncl} onChange={handleChange} />
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
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}
            </div>

            {/* Right Col: Info / Preview */}
            <div className="bg-blue-50/50 p-6 rounded-lg border border-blue-100">
              <h3 className="font-bold text-blue-900 mb-2">Swimming Pool Calculation</h3>
              <p className="text-sm text-blue-800 mb-4">
                Enter pool dimensions and structural details to generate a comprehensive Bill of Quantities including:
              </p>
              <ul className="list-disc pl-5 text-sm text-blue-800 space-y-1">
                <li>Excavation volumes (bulk and trench)</li>
                <li>Disposal and backfilling</li>
                <li>Concrete works (blinding, bed, walls)</li>
                <li>Formwork areas</li>
                <li>Reinforcement weights</li>
                <li>Finishes (plaster, tiling, painting)</li>
              </ul>

              {takeoffData.length > 0 && (
                <div className="mt-8 bg-white p-4 rounded shadow-sm border border-green-100">
                  <h4 className="text-green-700 font-bold mb-1">Success!</h4>
                  <p className="text-sm text-gray-600">
                    Generated {takeoffData.length} BOQ items. Check the <strong>BOQ</strong> tab for details.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "takeoff" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full overflow-hidden">
            <EnglishMethodTakeoffSheet
              key={editorKey}
              initialItems={takeoffData}
              onChange={setTakeoffData}
              projectInfo={{
                projectName: "Swimming Pool Project",
                clientName: "Client Name",
                projectDate: new Date().toLocaleDateString()
              }}
            />
          </div>
        )}

        {activeTab === "sheet" && (
          <div className="h-full">
            <UniversalSheet items={takeoffData} />
          </div>
        )}

        {activeTab === "boq" && (
          <div className="h-full">
            <UniversalBOQ items={takeoffData} />
          </div>
        )}
      </main>
    </div>
  );
}
