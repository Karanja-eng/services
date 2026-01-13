import {
  Calculator,
  FileText,
  Building2,
  ChevronDown,
  ChevronUp,
  Upload,
  Loader2,
  Eye,
  Box,
  Layers,
  X,
  Settings as SettingsIcon
} from "lucide-react";
import React, { Suspense, useState } from "react";
import axios from "axios";
import { Canvas } from "@react-three/fiber";
import EnglishMethodTakeoffSheet from "./ExternalWorks/EnglishMethodTakeoffSheet";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from './universal_component';
import Substructure3DScene from "./Substructure3DScene";

const API_BASE = "http://localhost:8001";

const SubstructureTakeoffApp = () => {

  const [activeTab, setActiveTab] = useState("calculator");
  const [takeoffData, setTakeoffData] = useState([]);
  const [editorKey, setEditorKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [calcSubTab, setCalcSubTab] = useState("automation");

  // Automation State
  const [buildingData, setBuildingData] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [fileId, setFileId] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planImageUrl, setPlanImageUrl] = useState("");
  const [activeSegment, setActiveSegment] = useState("all");

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProcessing(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/arch_pro/upload`, { method: "POST", body: fd });
      const data = await res.json();
      setFileId(data.file_id);
      setPlanImageUrl(`${API_BASE}/uploads/${data.filename}`);
      await processFloorplan(data.file_id);
    } catch (err) { console.error(err); }
    setProcessing(false);
  };

  const processFloorplan = async (fid) => {
    const fd = new FormData();
    fd.append("file_id", fid);
    fd.append("use_yolo", "true");
    try {
      const res = await fetch(`${API_BASE}/arch_pro/api/process`, { method: "POST", body: fd });
      const data = await res.json();
      setBuildingData(data);
      autoFillInputs(data);
    } catch (err) { console.error(err); }
  };

  const autoFillInputs = (data) => {
    if (!data || !data.floors[0]) return;
    const floor = data.floors[0];

    // 1. Walls Logic (Foundation Walls)
    const totalWallLength = floor.walls.reduce((sum, w) => sum + w.length, 0);

    // Estimate bounds for rectangular plan
    const wallPoints = floor.walls.flatMap(w => [w.start, w.end]);
    const xs = wallPoints.map(p => p[0]);
    const ys = wallPoints.map(p => p[1]);
    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...ys) - Math.min(...ys);

    setFormData(prev => ({
      ...prev,
      ext_length: width.toFixed(2),
      ext_width: depth.toFixed(2),
      int_wall_len: (totalWallLength - (2 * (width + depth))).toFixed(2),
      has_columns: floor.columns.length > 0,
      num_columns: floor.columns.length,
      col_size: floor.columns[0]?.size || 0.2,
      col_base_size: 0.8 / (floor.columns[0]?.size || 0.2) > 2 ? 0.8 : 1.2, // Heuristic
      col_excav_depth: 1.5,
      wall_thick: data.wallThickness || 0.2,
    }));
  };

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
          tabs={['calculator', 'takeoff', 'sheet', 'boq', '3d-view']}
        />
      </div>

      <main className="flex-1 overflow-auto p-4 max-w-7xl mx-auto w-full">
        {activeTab === 'calculator' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Inputs */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex border-b border-gray-200 bg-gray-50 mb-4 rounded-t-lg">
                  {["automation", "params"].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setCalcSubTab(tab)}
                      className={`px-6 py-3 text-sm font-medium transition-colors ${calcSubTab === tab ? 'border-b-2 border-blue-600 text-blue-600 bg-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                      {tab === "automation" ? "AI Substructure" : "Manual Params"}
                    </button>
                  ))}
                </div>

                {calcSubTab === "automation" && (
                  <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 rounded-xl space-y-4 mb-6">
                    {processing ? (
                      <div className="flex flex-col items-center space-y-3">
                        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                        <p className="text-sm font-medium text-gray-700">Analyzing Substructure Geometry...</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-12 h-12 text-blue-800" />
                        <div className="text-center">
                          <h3 className="font-bold text-gray-900">AI Substructure Setup</h3>
                          <p className="text-xs text-gray-500">Auto-detect foundation walls, column bases, and excavation depths.</p>
                        </div>
                        <input type="file" id="sub-upload" className="hidden" onChange={handleUpload} />
                        <label htmlFor="sub-upload" className="cursor-pointer bg-gray-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition-all shadow-lg">
                          Upload Foundation Plan
                        </label>
                        {buildingData && (
                          <button
                            onClick={() => setShowPlanModal(true)}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-md mt-2"
                          >
                            <Eye size={16} />
                            View Detection Plan
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Calculator className="w-6 h-6" />
                  Foundation Parameters
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

        {activeTab === '3d-view' && (
          <div className="h-full bg-slate-900 rounded-lg overflow-hidden relative border border-slate-800 shadow-2xl">
            {buildingData ? (
              <>
                <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                  <div className="bg-slate-800/80 backdrop-blur px-3 py-2 rounded-lg border border-slate-700 flex items-center gap-2 shadow-lg">
                    <Box className="w-4 h-4 text-orange-400" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Foundation & Substructure</span>
                  </div>
                </div>
                <Canvas shadows dpr={[1, 2]}>
                  <Suspense fallback={null}>
                    <Substructure3DScene buildingData={buildingData} />
                  </Suspense>
                </Canvas>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center space-y-4 text-slate-400">
                <Box className="w-16 h-16 opacity-20" />
                <div className="text-center">
                  <h3 className="text-xl font-bold text-slate-200">No Foundation Visual</h3>
                  <p className="text-sm">Upload a foundation plan to see excavations and bases.</p>
                </div>
                <button
                  onClick={() => { setActiveTab('calculator'); setCalcSubTab('automation'); }}
                  className="px-6 py-2 bg-slate-800 text-slate-200 rounded-lg text-sm font-bold border border-slate-700"
                >
                  Go to Upload
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Plan Image Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-10">
          <div className="bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200">
            <div className="p-4 border-b flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Layers className="text-white w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 uppercase tracking-tight text-sm">Computer Vision Visualization</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">AutoCAD Standard Layer Inspection</p>
                </div>
              </div>
              <button onClick={() => setShowPlanModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-100 p-8 flex items-center justify-center relative min-h-[500px]">
              <div className="relative inline-block border-4 border-white shadow-2xl rounded-lg overflow-hidden">
                <img
                  src={planImageUrl}
                  alt="Floor Plan"
                  className={`max-w-full h-auto transition-all duration-500 ${activeSegment !== 'all' ? 'opacity-0 grayscale-[70%]' : 'opacity-100'}`}
                />
                {activeSegment !== 'all' && (
                  <img
                    src={`${API_BASE}/opencv/${activeSegment}?file_id=${buildingData?.project_id}`}
                    alt={`${activeSegment} Layer`}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none mix-blend-multiply transition-all duration-300 contrast-125 brightness-110"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">Layer Switcher:</span>
                {[
                  { id: 'all', label: 'Plan', color: 'bg-gray-600' },
                  { id: 'rooms', label: 'Rooms (Heatmap)', color: 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500' },
                  { id: 'walls', label: 'Walls', color: 'bg-black' },
                  { id: 'slabs', label: 'Slab Contours', color: 'bg-black' },
                  { id: 'beams', label: 'Beams', color: 'bg-black' },
                  { id: 'columns', label: 'Columns', color: 'bg-black' },
                  { id: 'stairs', label: 'Stairs', color: 'bg-black' },
                  { id: 'contours', label: 'Structural Contours', color: 'bg-black' }
                ].map(layer => (
                  <button
                    key={layer.id}
                    onClick={() => setActiveSegment(layer.id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all flex items-center gap-1.5 ${activeSegment === layer.id ? `${layer.color} text-white shadow-lg scale-105` : 'bg-white text-gray-400 border border-gray-100 hover:border-gray-300'}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${activeSegment === layer.id ? 'bg-white animate-pulse' : layer.color}`} />
                    {layer.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowPlanModal(false)}
                className="px-6 py-2 bg-gray-900 text-white rounded-lg font-bold hover:bg-gray-800 transition-colors text-xs uppercase tracking-widest"
              >
                Exit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubstructureTakeoffApp;
