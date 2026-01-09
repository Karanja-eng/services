import React, { useState } from "react";
import { Calculator, FileText, Plus, Trash2, Building } from "lucide-react";
import axios from "axios";
import EnglishMethodTakeoffSheet from "../ExternalWorks/EnglishMethodTakeoffSheet";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from '../universal_component';

const SuperstructureTakeoffApp = () => {
  // Main UI Tabs (Calculator, Takeoff, Sheet, BOQ)
  const [activeTab, setActiveTab] = useState("calculator");
  // Calculator Sub-tabs
  const [calcSubTab, setCalcSubTab] = useState("walls");

  const [takeoffData, setTakeoffData] = useState([]);
  const [editorKey, setEditorKey] = useState(0);
  const [loading, setLoading] = useState(false);

  // State for all inputs
  const [projectInfo, setProjectInfo] = useState({
    projectName: "",
    projectLocation: "",
    date: new Date().toISOString().split("T")[0],
  });

  const [wallData, setWallData] = useState({
    externalLength: "",
    externalWidth: "",
    wallHeight: "",
    wallThickness: "",
    internalWallLength: "",
    numDoors: "",
    doorWidth: "",
    doorHeight: "",
    numWindows: "",
    windowWidth: "",
    windowHeight: "",
    mortarRatio: "1:4",
    blockType: "6 inch",
  });

  const [columns, setColumns] = useState([
    { id: 1, width: "", depth: "", height: "", count: "" },
  ]);

  const [beams, setBeams] = useState([
    { id: 1, length: "", width: "", depth: "", count: "" },
  ]);

  const [slabs, setSlabs] = useState([{ id: 1, area: "", thickness: "", mark: "S1" }]);

  const [commonData, setCommonData] = useState({
    concreteGrade: "C25 (1:1.5:3)",
    reinfDensity: "120",
    formworkType: "F3 - Smooth finish",
    wastage: "5",
  });

  const [parapet, setParapet] = useState({
    hasParapet: false,
    girth: "",
    height: "",
    thickness: "",
    hasCoping: false,
    copingWidth: "",
    copingThickness: "",
  });

  const [rainwater, setRainwater] = useState({
    hasRainwater: false,
    downpipeLength: "",
    numDownpipes: "",
    diameter: "100",
    hasShoe: false,
    shoeLength: "",
  });

  const addItem = (type) => {
    if (type === "column") {
      setColumns([...columns, { id: Date.now(), width: "", depth: "", height: "", count: "" }]);
    } else if (type === "beam") {
      setBeams([...beams, { id: Date.now(), length: "", width: "", depth: "", count: "" }]);
    } else if (type === "slab") {
      setSlabs([...slabs, { id: Date.now(), area: "", thickness: "", mark: `S${slabs.length + 1}` }]);
    }
  };

  const removeItem = (type, index) => {
    if (type === "column") {
      setColumns(columns.filter((_, i) => i !== index));
    } else if (type === "beam") {
      setBeams(beams.filter((_, i) => i !== index));
    } else if (type === "slab") {
      setSlabs(slabs.filter((_, i) => i !== index));
    }
  };

  const updateCol = (idx, field, val) => {
    const newCols = [...columns];
    newCols[idx][field] = val;
    setColumns(newCols);
  }
  const updateBeam = (idx, field, val) => {
    const newBeams = [...beams];
    newBeams[idx][field] = val;
    setBeams(newBeams);
  }
  const updateSlab = (idx, field, val) => {
    const newSlabs = [...slabs];
    newSlabs[idx][field] = val;
    setSlabs(newSlabs);
  }

  const calculateQuantities = async () => {
    setLoading(true);
    try {
      const payload = {
        project_info: {
          project_name: projectInfo.projectName || "Superstructure",
          project_location: projectInfo.projectLocation || "Unknown",
          date: projectInfo.date
        },
        wall_data: {
          external_length: parseFloat(wallData.externalLength) || 0,
          external_width: parseFloat(wallData.externalWidth) || 0,
          wall_height: parseFloat(wallData.wallHeight) || 0,
          wall_thickness: parseFloat(wallData.wallThickness) || 0.2,
          internal_wall_length: parseFloat(wallData.internalWallLength) || 0,
          num_doors: parseInt(wallData.numDoors) || 0,
          door_width: parseFloat(wallData.doorWidth) || 0.9,
          door_height: parseFloat(wallData.doorHeight) || 2.1,
          num_windows: parseInt(wallData.numWindows) || 0,
          window_width: parseFloat(wallData.windowWidth) || 1.5,
          window_height: parseFloat(wallData.windowHeight) || 1.2,
          mortar_ratio: wallData.mortarRatio,
          block_type: wallData.blockType
        },
        columns: columns.filter(c => c.count).map(c => ({
          width: parseFloat(c.width) || 0,
          depth: parseFloat(c.depth) || 0,
          height: parseFloat(c.height) || 0,
          count: parseInt(c.count) || 0
        })),
        beams: beams.filter(b => b.count).map(b => ({
          length: parseFloat(b.length) || 0,
          width: parseFloat(b.width) || 0,
          depth: parseFloat(b.depth) || 0,
          count: parseInt(b.count) || 0
        })),
        slabs: slabs.filter(s => s.area).map(s => ({
          area: parseFloat(s.area) || 0,
          thickness: parseFloat(s.thickness) || 0.15
        })),
        parapet: {
          has_parapet: parapet.hasParapet,
          girth: parseFloat(parapet.girth) || 0,
          height: parseFloat(parapet.height) || 0,
          thickness: parseFloat(parapet.thickness) || 0,
          has_coping: parapet.hasCoping,
          coping_width: parseFloat(parapet.copingWidth) || 0,
          coping_thickness: parseFloat(parapet.copingThickness) || 0
        },
        rainwater: {
          has_rainwater: rainwater.hasRainwater,
          downpipe_length: parseFloat(rainwater.downpipeLength) || 0,
          num_downpipes: parseInt(rainwater.numDownpipes) || 0,
          diameter: rainwater.diameter,
          has_shoe: rainwater.hasShoe,
          shoe_length: parseFloat(rainwater.shoeLength) || 0
        },
        common_data: {
          concrete_grade: commonData.concreteGrade,
          reinf_density: parseFloat(commonData.reinfDensity) || 120,
          formwork_type: commonData.formworkType,
          wastage: parseFloat(commonData.wastage) || 5
        }
      };

      const response = await axios.post("http://localhost:8001/superstructure_router/api/calculate", payload);
      const data = response.data;

      if (data.success && data.boq_items) {
        const items = data.boq_items.map((item, index) => ({
          id: index + 1,
          billNo: item.item,
          itemNo: (index + 1).toString(),
          description: item.description,
          unit: item.unit,
          quantity: parseFloat(item.quantity) || 0,
          rate: 0,
          amount: 0,
          dimensions: [],
          isHeader: false
        }));
        setTakeoffData(items);
        setEditorKey(prev => prev + 1);
      }
    } catch (err) {
      console.error(err);
      alert("Calculation failed. Backend might be offline.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex bg-gray-50 h-screen flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex-none">
        <div className="flex items-center gap-3 mb-4">
          <Building className="w-8 h-8 text-blue-800" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Superstructure Takeoff</h1>
            <p className="text-sm text-gray-500">Comprehensive BOQ Calculator</p>
          </div>
        </div>

        <UniversalTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabs={['calculator', 'takeoff', 'sheet', 'boq']}
        />
      </div>

      <main className="flex-1 overflow-auto p-4 max-w-7xl mx-auto w-full">
        {activeTab === "calculator" && (
          <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Calculator Sub-Nav */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              {["walls", "columns", "beams", "slabs", "settings"].map(tab => (
                <button
                  key={tab}
                  onClick={() => setCalcSubTab(tab)}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${calcSubTab === tab ? 'border-b-2 border-blue-600 text-blue-600 bg-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {/* Walls Sub-Tab */}
              {calcSubTab === "walls" && (
                <div className="space-y-6 max-w-3xl">
                  <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Wall Dimensions</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div><label className="text-sm text-gray-600">Ext. Length (m)</label><input type="number" value={wallData.externalLength} onChange={e => setWallData({ ...wallData, externalLength: e.target.value })} className="w-full border rounded px-3 py-2" /></div>
                    <div><label className="text-sm text-gray-600">Ext. Width (m)</label><input type="number" value={wallData.externalWidth} onChange={e => setWallData({ ...wallData, externalWidth: e.target.value })} className="w-full border rounded px-3 py-2" /></div>
                    <div><label className="text-sm text-gray-600">Wall Height (m)</label><input type="number" value={wallData.wallHeight} onChange={e => setWallData({ ...wallData, wallHeight: e.target.value })} className="w-full border rounded px-3 py-2" /></div>
                    <div><label className="text-sm text-gray-600">Thickness (m)</label><input type="number" value={wallData.wallThickness} onChange={e => setWallData({ ...wallData, wallThickness: e.target.value })} className="w-full border rounded px-3 py-2" /></div>
                    <div className="col-span-2"><label className="text-sm text-gray-600">Internal Wall Length (Total m)</label><input type="number" value={wallData.internalWallLength} onChange={e => setWallData({ ...wallData, internalWallLength: e.target.value })} className="w-full border rounded px-3 py-2" /></div>
                  </div>

                  <h3 className="text-lg font-bold text-gray-800 border-b pb-2 pt-4">Deductions</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div><label className="text-sm text-gray-600">Num Doors</label><input type="number" value={wallData.numDoors} onChange={e => setWallData({ ...wallData, numDoors: e.target.value })} className="w-full border rounded px-3 py-2" /></div>
                    <div><label className="text-sm text-gray-600">Door W (m)</label><input type="number" value={wallData.doorWidth} onChange={e => setWallData({ ...wallData, doorWidth: e.target.value })} className="w-full border rounded px-3 py-2" /></div>
                    <div><label className="text-sm text-gray-600">Door H (m)</label><input type="number" value={wallData.doorHeight} onChange={e => setWallData({ ...wallData, doorHeight: e.target.value })} className="w-full border rounded px-3 py-2" /></div>
                    <div className="hidden lg:block"></div>
                    <div><label className="text-sm text-gray-600">Num Windows</label><input type="number" value={wallData.numWindows} onChange={e => setWallData({ ...wallData, numWindows: e.target.value })} className="w-full border rounded px-3 py-2" /></div>
                    <div><label className="text-sm text-gray-600">Window W (m)</label><input type="number" value={wallData.windowWidth} onChange={e => setWallData({ ...wallData, windowWidth: e.target.value })} className="w-full border rounded px-3 py-2" /></div>
                    <div><label className="text-sm text-gray-600">Window H (m)</label><input type="number" value={wallData.windowHeight} onChange={e => setWallData({ ...wallData, windowHeight: e.target.value })} className="w-full border rounded px-3 py-2" /></div>
                  </div>
                </div>
              )}

              {/* Columns Sub-Tab */}
              {calcSubTab === "columns" && (
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <h3 className="text-lg font-bold text-gray-800">Columns</h3>
                    <button onClick={() => addItem('column')} className="text-sm bg-gray-800 text-white px-3 py-1 rounded flex items-center gap-1"><Plus className="w-4 h-4" /> Add Type</button>
                  </div>
                  {columns.map((col, idx) => (
                    <div key={col.id} className="grid grid-cols-5 gap-4 bg-gray-50 p-3 rounded border">
                      <div><label className="text-xs text-gray-500">Count</label><input type="number" value={col.count} onChange={e => updateCol(idx, 'count', e.target.value)} className="w-full border rounded px-2 py-1" /></div>
                      <div><label className="text-xs text-gray-500">Width (m)</label><input type="number" value={col.width} onChange={e => updateCol(idx, 'width', e.target.value)} className="w-full border rounded px-2 py-1" /></div>
                      <div><label className="text-xs text-gray-500">Depth (m)</label><input type="number" value={col.depth} onChange={e => updateCol(idx, 'depth', e.target.value)} className="w-full border rounded px-2 py-1" /></div>
                      <div><label className="text-xs text-gray-500">Height (m)</label><input type="number" value={col.height} onChange={e => updateCol(idx, 'height', e.target.value)} className="w-full border rounded px-2 py-1" /></div>
                      <div className="flex items-end"><button onClick={() => removeItem('column', idx)} className="text-red-500 p-2"><Trash2 className="w-5 h-5" /></button></div>
                    </div>
                  ))}
                </div>
              )}

              {/* Beams Sub-Tab */}
              {calcSubTab === "beams" && (
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <h3 className="text-lg font-bold text-gray-800">Beams</h3>
                    <button onClick={() => addItem('beam')} className="text-sm bg-gray-800 text-white px-3 py-1 rounded flex items-center gap-1"><Plus className="w-4 h-4" /> Add Type</button>
                  </div>
                  {beams.map((beam, idx) => (
                    <div key={beam.id} className="grid grid-cols-5 gap-4 bg-gray-50 p-3 rounded border">
                      <div><label className="text-xs text-gray-500">Count</label><input type="number" value={beam.count} onChange={e => updateBeam(idx, 'count', e.target.value)} className="w-full border rounded px-2 py-1" /></div>
                      <div><label className="text-xs text-gray-500">Length (m)</label><input type="number" value={beam.length} onChange={e => updateBeam(idx, 'length', e.target.value)} className="w-full border rounded px-2 py-1" /></div>
                      <div><label className="text-xs text-gray-500">Width (m)</label><input type="number" value={beam.width} onChange={e => updateBeam(idx, 'width', e.target.value)} className="w-full border rounded px-2 py-1" /></div>
                      <div><label className="text-xs text-gray-500">Depth (m)</label><input type="number" value={beam.depth} onChange={e => updateBeam(idx, 'depth', e.target.value)} className="w-full border rounded px-2 py-1" /></div>
                      <div className="flex items-end"><button onClick={() => removeItem('beam', idx)} className="text-red-500 p-2"><Trash2 className="w-5 h-5" /></button></div>
                    </div>
                  ))}
                </div>
              )}

              {/* Slabs Sub-Tab */}
              {calcSubTab === "slabs" && (
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <h3 className="text-lg font-bold text-gray-800">Slabs</h3>
                    <button onClick={() => addItem('slab')} className="text-sm bg-gray-800 text-white px-3 py-1 rounded flex items-center gap-1"><Plus className="w-4 h-4" /> Add Type</button>
                  </div>
                  {slabs.map((slab, idx) => (
                    <div key={slab.id} className="grid grid-cols-4 gap-4 bg-gray-50 p-3 rounded border">
                      <div><label className="text-xs text-gray-500">Mark</label><input type="text" value={slab.mark} onChange={e => updateSlab(idx, 'mark', e.target.value)} className="w-full border rounded px-2 py-1" /></div>
                      <div><label className="text-xs text-gray-500">Area (m²)</label><input type="number" value={slab.area} onChange={e => updateSlab(idx, 'area', e.target.value)} className="w-full border rounded px-2 py-1" /></div>
                      <div><label className="text-xs text-gray-500">Thickness (m)</label><input type="number" value={slab.thickness} onChange={e => updateSlab(idx, 'thickness', e.target.value)} className="w-full border rounded px-2 py-1" /></div>
                      <div className="flex items-end"><button onClick={() => removeItem('slab', idx)} className="text-red-500 p-2"><Trash2 className="w-5 h-5" /></button></div>
                    </div>
                  ))}
                </div>
              )}

              {/* Settings Sub-Tab */}
              {calcSubTab === "settings" && (
                <div className="space-y-4 max-w-lg">
                  <h3 className="text-lg font-bold text-gray-800">General Settings</h3>
                  <div><label className="text-sm text-gray-600">Concrete Grade</label><input type="text" value={commonData.concreteGrade} onChange={e => setCommonData({ ...commonData, concreteGrade: e.target.value })} className="w-full border rounded px-3 py-2" /></div>
                  <div><label className="text-sm text-gray-600">Reinf Density (kg/m³)</label><input type="number" value={commonData.reinfDensity} onChange={e => setCommonData({ ...commonData, reinfDensity: e.target.value })} className="w-full border rounded px-3 py-2" /></div>
                  <div><label className="text-sm text-gray-600">Formwork Type</label><input type="text" value={commonData.formworkType} onChange={e => setCommonData({ ...commonData, formworkType: e.target.value })} className="w-full border rounded px-3 py-2" /></div>
                </div>
              )}

            </div>

            {/* Calculate Footer */}
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={calculateQuantities}
                disabled={loading}
                className="w-full bg-blue-800 text-white py-3 rounded-lg font-bold hover:bg-blue-900 shadow-md transition-colors"
              >
                {loading ? "Calculating..." : "Calculate All Quantities"}
              </button>
              {takeoffData.length > 0 && <p className="text-center text-xs text-gray-500 mt-2">See Takeoff tab for results</p>}
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
                projectName: projectInfo.projectName || "Superstructure",
                clientName: "",
                projectDate: projectInfo.date
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

export default SuperstructureTakeoffApp;
