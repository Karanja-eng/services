import React, { useState } from "react";
import {
  Calculator,
  FileText,
  Building2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import axios from "axios";
import EnglishMethodTakeoffSheet from "./ExternalWorks/EnglishMethodTakeoffSheet";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from './universal_component';

const SubstructureTakeoffApp = () => {

  const [activeTab, setActiveTab] = useState("calculator");
  const [takeoffData, setTakeoffData] = useState([]);
  const [editorKey, setEditorKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    plan_type: "rectangle",
    ext_length: "",
    ext_width: "",
    has_internal_walls: false,
    int_wall_len: "",
    has_columns: false,
    num_columns: "",
    col_size: "",
    col_base_size: "",
    col_excav_depth: "",
    has_recess: false,
    recess_type: "corner",
    recess_len: "",
    recess_wid: "",
    has_cavity_wall: false,
    cavity_thick: "",
    wall_thick: 0.2,
    veg_depth: 0.15,
    trench_depth: 1.0,
    reduce_level_depth: 0.2,
    conc_thick_strip: 0.2,
    hardcore_thick: 0.3,
    blinding_thick: 0.05,
    dpm_thick: "",
    anti_termite: false,
    has_formwork: false,
    has_reinforce: false,
    rebar_len: "",
    clear_extra: 1.0,
    reinstate_width: 0.4,
    backfill_reuse_factor: 0.5,
  });

  const [expandedSections, setExpandedSections] = useState({
    plan: true,
    walls: true,
    features: false,
    depths: false,
    additional: false,
  });

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const calculateQuantities = async () => {
    setLoading(true);
    setTakeoffData([]);
    setError("");

    try {
      const payload = {
        ...formData,
        ext_length: parseFloat(formData.ext_length) || 0,
        ext_width: parseFloat(formData.ext_width) || 0,
        int_wall_len: parseFloat(formData.int_wall_len) || 0,
        num_columns: parseInt(formData.num_columns) || 0,
        col_size: parseFloat(formData.col_size) || 0,
        col_base_size: parseFloat(formData.col_base_size) || 0,
        col_excav_depth: parseFloat(formData.col_excav_depth) || 0,
        recess_len: parseFloat(formData.recess_len) || 0,
        recess_wid: parseFloat(formData.recess_wid) || 0,
        cavity_thick: parseFloat(formData.cavity_thick) || 0,
        wall_thick: parseFloat(formData.wall_thick) || 0,
        veg_depth: parseFloat(formData.veg_depth) || 0,
        trench_depth: parseFloat(formData.trench_depth) || 0,
        reduce_level_depth: parseFloat(formData.reduce_level_depth) || 0,
        conc_thick_strip: parseFloat(formData.conc_thick_strip) || 0,
        hardcore_thick: parseFloat(formData.hardcore_thick) || 0,
        blinding_thick: parseFloat(formData.blinding_thick) || 0,
        dpm_thick: parseFloat(formData.dpm_thick) || 0,
        rebar_len: parseFloat(formData.rebar_len) || 0,
        clear_extra: parseFloat(formData.clear_extra) || 0,
        reinstate_width: parseFloat(formData.reinstate_width) || 0,
        backfill_reuse_factor: parseFloat(formData.backfill_reuse_factor) || 0,
      };

      const response = await axios.post("http://localhost:8001/rc_substructure_router/api/calculate", payload);
      const data = response.data;

      if (data && data.takeoff_items) {
        const formattedItems = data.takeoff_items.map((item, index) => ({
          id: index + 1,
          billNo: item.item_no.split('.')[0],
          itemNo: item.item_no,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          rate: 0, // Rate is not returned from this specific backend yet
          amount: 0,
          dimensions: [],
          isHeader: false
        }));

        // Grouping items by their prefix if needed, or just adding headers manually if possible
        // But the backend returns a flat list. 
        setTakeoffData(formattedItems);
        setEditorKey(prev => prev + 1);
        setActiveTab("sheet");
      }
    } catch (err) {
      console.error("Calculation error:", err);
      setError("Calculation failed. Backend might be offline.");
    } finally {
      setLoading(false);
    }
  };


  const SectionHeader = ({ title, section, icon: Icon }) => (
    <div
      className="flex items-center justify-between cursor-pointer p-4 bg-gray-100 hover:bg-gray-150 transition-colors rounded-lg"
      onClick={() => toggleSection(section)}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-gray-600" />
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
      {expandedSections[section] ? (
        <ChevronUp className="w-5 h-5 text-gray-600" />
      ) : (
        <ChevronDown className="w-5 h-5 text-gray-600" />
      )}
    </div>
  );

  const InputField = ({
    label,
    name,
    type = "number",
    unit,
    step = "0.01",
  }) => (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={type}
          name={name}
          value={formData[name]}
          onChange={handleInputChange}
          step={step}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
        />
        {unit && (
          <span className="absolute right-3 top-2 text-sm text-gray-500">
            {unit}
          </span>
        )}
      </div>
    </div>
  );

  const CheckboxField = ({ label, name }) => (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        name={name}
        id={name}
        checked={formData[name]}
        onChange={handleInputChange}
        className="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-400"
      />
      <label
        htmlFor={name}
        className="text-sm font-medium text-gray-700 cursor-pointer"
      >
        {label}
      </label>
    </div>
  );


  const SelectField = ({ label, name, options }) => (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        name={name}
        value={formData[name]}
        onChange={handleInputChange}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="flex bg-gray-50 h-screen flex-col">
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex-none">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="w-8 h-8 text-blue-800" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Substructure Takeoff</h1>
            <p className="text-sm text-gray-500">Foundations & Substructure Works</p>
          </div>
        </div>
        <UniversalTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabs={['calculator', 'takeoff', 'sheet', 'boq']}
        />
      </div>

      <main className="flex-1 overflow-auto p-4 max-w-7xl mx-auto w-full">
        {activeTab === 'calculator' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Inputs */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Calculator className="w-6 h-6" />
                  Input Parameters
                </h2>

                <div className="space-y-3">
                  {/* Plan Details Section */}
                  <div className="space-y-3">
                    <SectionHeader title="Plan Details" section="plan" icon={Building2} />
                    {expandedSections.plan && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                        <SelectField label="Plan Type" name="plan_type" options={[{ value: "rectangle", label: "Rectangle" }]} />
                        <InputField label="Ext. Length (m)" name="ext_length" />
                        <InputField label="Ext. Width (m)" name="ext_width" />
                        <InputField label="Internal Wall Len (m)" name="int_wall_len" />
                      </div>
                    )}
                  </div>

                  {/* Walls & Depths */}
                  <div className="space-y-3">
                    <SectionHeader title="Foundation Specs" section="walls" icon={FileText} />
                    {expandedSections.walls && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                        <InputField label="Wall Thickness (m)" name="wall_thick" />
                        <InputField label="Trench Depth (m)" name="trench_depth" />
                        <InputField label="Strip Conc Thk (m)" name="conc_thick_strip" />
                        <InputField label="Veg Soil Depth (m)" name="veg_depth" />
                        <InputField label="Hardcore Thk (m)" name="hardcore_thick" />
                        <InputField label="Ex. Clearance (m)" name="clear_extra" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 sticky top-0">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Calculate</h2>
                <button
                  onClick={calculateQuantities}
                  disabled={loading}
                  className="w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Calculator className="w-5 h-5" />
                  {loading ? "Calculating..." : "Calculate Quantities"}
                </button>
                {takeoffData.length > 0 && <div className="mt-4 text-green-700 text-sm bg-green-50 p-2 rounded border border-green-200">Done! Check Takeoff/Sheet/BOQ tabs.</div>}
                {error && <div className="mt-4 text-red-700 text-sm bg-red-50 p-2 rounded border border-red-200">{error}</div>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'takeoff' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full overflow-hidden">
            <EnglishMethodTakeoffSheet
              key={editorKey}
              initialItems={takeoffData}
              onChange={setTakeoffData}
              projectInfo={{
                projectName: "Substructure Works",
                clientName: "",
                projectDate: new Date().toLocaleDateString()
              }}
            />
          </div>
        )}

        {activeTab === 'sheet' && (
          <div className="h-full">
            <UniversalSheet items={takeoffData} />
          </div>
        )}

        {activeTab === 'boq' && (
          <div className="h-full">
            <UniversalBOQ items={takeoffData} />
          </div>
        )}
      </main>
    </div>
  );
};

export default SubstructureTakeoffApp;
