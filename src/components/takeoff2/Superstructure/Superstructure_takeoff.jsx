import React, { useState, Suspense } from "react";
import { Calculator, FileText, Plus, Trash2, Building, Upload, Loader2, Eye, Box, Settings as SettingsIcon, X, Layers } from "lucide-react";
import axios from "axios";
import { Canvas } from "@react-three/fiber";
import EnglishMethodTakeoffSheet from "../ExternalWorks/EnglishMethodTakeoffSheet";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from '../universal_component';
import Superstructure3DScene from "./Superstructure3DScene";

const API_BASE = `http://${window.location.hostname}:8001`;
console.log("🚀 API BASE URL:", API_BASE);

const SuperstructureTakeoffApp = () => {
  // Main UI Tabs (Calculator, Takeoff, Sheet, BOQ)
  const [activeTab, setActiveTab] = useState("calculator");
  // Calculator Sub-tabs
  const [calcSubTab, setCalcSubTab] = useState("walls");

  const [takeoffData, setTakeoffData] = useState([]);
  const [editorKey, setEditorKey] = useState(0);
  const [loading, setLoading] = useState(false);

  // Automation State
  const [buildingData, setBuildingData] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [fileId, setFileId] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [activeSegment, setActiveSegment] = useState("all");

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

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // LOCAL PREVIEW (Foolproof & "Simple")
    const localUrl = URL.createObjectURL(file);
    setUploadedImageUrl(localUrl);
    console.log("📸 Local Preview created:", localUrl);

    setProcessing(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/arch_pro/upload`, { method: "POST", body: fd });
      const data = await res.json();
      setFileId(data.file_id);

      console.log("✅ Upload successful, File ID:", data.file_id);
      await processFloorplan(data.file_id);
    } catch (err) {
      console.error("❌ Upload failed:", err);
    } finally {
      setProcessing(false);
    }
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

    // 1. Walls Logic
    const totalWallLength = floor.walls.reduce((sum, w) => sum + w.length, 0);

    // Calculate Openings Widths for Beam Continuity
    const totalDoorWidth = floor.doors.reduce((sum, d) => sum + d.width, 0);
    const totalWindowWidth = floor.windows.reduce((sum, w) => sum + w.width, 0);

    setWallData(prev => ({
      ...prev,
      externalLength: (totalWallLength * 0.4).toFixed(2), // Heuristic split
      externalWidth: (totalWallLength * 0.3).toFixed(2),  // Heuristic split
      internalWallLength: (totalWallLength * 0.3).toFixed(2),
      wallHeight: data.wallHeight.toFixed(2),
      numDoors: floor.doors.length,
      doorWidth: floor.doors[0]?.width?.toFixed(2) || "0.9",
      doorHeight: floor.doors[0]?.height?.toFixed(2) || "2.1",
      numWindows: floor.windows.length,
      windowWidth: floor.windows[0]?.width?.toFixed(2) || "1.5",
      windowHeight: floor.windows[0]?.height?.toFixed(2) || "1.2",
    }));

    // 2. Beams Logic: Continuous over walls AND openings
    // Beam Length = Net Wall Length + Door Widths + Window Widths
    const continuousBeamLength = totalWallLength + totalDoorWidth + totalWindowWidth;

    setBeams([{
      id: 1,
      length: continuousBeamLength.toFixed(2),
      width: "0.20",
      depth: "0.45",
      count: 1
    }]);

    // 3. Slabs Logic: Entire outside contour
    // Estimate area from wall bounds if house is roughly rectangular
    const wallPoints = floor.walls.flatMap(w => [w.start, w.end]);
    if (wallPoints.length > 0) {
      const xs = wallPoints.map(p => p[0]);
      const ys = wallPoints.map(p => p[1]);
      const width = Math.max(...xs) - Math.min(...xs);
      const depth = Math.max(...ys) - Math.min(...ys);
      const estimatedArea = width * depth;
      setSlabs([{
        id: 1,
        area: estimatedArea.toFixed(2),
        thickness: "0.15",
        mark: "S1"
      }]);
    }

    // 4. Columns Logic
    if (floor.columns && floor.columns.length > 0) {
      setColumns(floor.columns.map((c, i) => ({
        id: c.id || Date.now() + i,
        width: c.size || 0.2,
        depth: c.size || 0.2,
        height: data.wallHeight || 3.0,
        count: 1
      })));
    }
  };

  const calculateQuantities = async () => {
    setLoading(true);
    try {
      // Map frontend state to backend model 'SuperstructureInput'
      // Model expects: { columns: [], beams: [], slabs: [], settings: {} }
      // Expand items based on count (Backend sums list items)
      const explodedColumns = [];
      columns.forEach(c => {
        const count = parseInt(c.count) || 0;
        for (let i = 0; i < count; i++) {
          explodedColumns.push({
            id: parseInt(c.id) + i,
            width: parseFloat(c.width) || 0.2,
            depth: parseFloat(c.depth) || 0.2,
            height: parseFloat(c.height) || 3.0,
            mark: "C1"
          });
        }
      });

      const explodedBeams = [];
      beams.forEach(b => {
        const count = parseInt(b.count) || 0;
        for (let i = 0; i < count; i++) {
          explodedBeams.push({
            id: parseInt(b.id) + i,
            length: parseFloat(b.length) || 1.0,
            width: parseFloat(b.width) || 0.2,
            depth: parseFloat(b.depth) || 0.4,
            mark: "B1" // TODO: Add mark input
          });
        }
      });

      const payload = {
        columns: explodedColumns,
        beams: explodedBeams,
        // Slabs usually count=1 per entry in this logic
        slabs: slabs.filter(s => s.area).map(s => ({
          id: parseInt(s.id) || 1,
          area: parseFloat(s.area) || 10.0,
          thickness: parseFloat(s.thickness) || 0.15,
          mark: s.mark || "S1"
        })),
        settings: {
          conc_grade: (commonData.concreteGrade && commonData.concreteGrade.includes(":")) ? commonData.concreteGrade.split("(")[1].replace(")", "") : "1:1.5:3",
          conc_grade_name: (commonData.concreteGrade && commonData.concreteGrade.split(" ")[0]) || "C25",
          reinf_density: parseFloat(commonData.reinfDensity) || 120,
          form_type: (commonData.formworkType && commonData.formworkType.split(" ")[0]) || "F3",
          include_wastage: true,
          conc_wastage: Math.min(parseFloat(commonData.wastage) || 5, 20), // Cap at 20%
          reinf_wastage: 2.5,
          cover: 25,
          bar_spacing: 150
        }
      };

      const response = await axios.post(`${API_BASE}/rc_superstructure_router/api/calculate-superstructure`, payload);
      const data = response.data;
      
      console.log("API Response:", data); // Debug log

      // Map SuperstructureResults to BOQ items
      if (data && data.total_conc_m3 !== undefined) {
         // Success
         const items = [
            // Concrete
            {
                id: 'conc-1',
                billNo: 'F',
                itemNo: 'F10',
                description: `Providing and placing C25 concrete in columns, beams, and slabs.`,
                unit: 'm³',
                quantity: data.total_conc_with_wastage,
                rate: 0,
                amount: 0
            },
             // Formwork
             {
                id: 'form-1',
                billNo: 'F',
                itemNo: 'F20',
                description: `Centering and shuttering (Formwork) including strutting, propping etc. and removal of formwork.`,
                unit: 'm²',
                quantity: data.total_form_m2,
                rate: 0,
                amount: 0
            },
             // Reinforcement
             {
                id: 'reinf-1',
                billNo: 'G',
                itemNo: 'G10',
                description: `Supply and fix High Yield Strength Deformed (HYSD) bars for reinforcement including cutting, bending, binding etc.`,
                unit: 'kg',
                quantity: data.total_reinf_kg,
                rate: 0,
                amount: 0
            }
         ];
        setTakeoffData(items);
        setEditorKey(prev => prev + 1);
        setActiveTab("takeoff"); // Switch to takeoff to see results
      } else {
        alert("Received unexpected response from server: " + JSON.stringify(data));
      }
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.detail) {
        alert("Calculation Error: " + JSON.stringify(err.response.data.detail));
      } else {
        alert("Calculation failed. Backend might be offline. Error: " + err.message);
      }
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
          tabs={['calculator', 'takeoff', 'sheet', 'boq', '3d-view']}
        />
      </div>

      <main className="flex-1 overflow-auto p-4 max-w-7xl mx-auto w-full">
        {activeTab === "calculator" && (
          <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Calculator Sub-Nav */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              {["automation", "walls", "columns", "beams", "slabs", "settings"].map(tab => (
                <button
                  key={tab}
                  onClick={() => setCalcSubTab(tab)}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${calcSubTab === tab ? 'border-b-2 border-blue-600 text-blue-600 bg-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  {tab === "automation" ? "Auto-Takeoff" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {/* Automation Sub-Tab */}
              {calcSubTab === "automation" && (
                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-200 rounded-xl space-y-4">
                  {processing ? (
                    <div className="flex flex-col items-center space-y-3">
                      <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                      <p className="font-medium text-gray-700">Analyzing Architecture with AI...</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 bg-blue-50 rounded-full">
                        <Upload className="w-12 h-12 text-blue-600" />
                      </div>
                      <div className="text-center">
                        <h3 className="text-lg font-bold text-gray-900">AI Floorplan Extraction</h3>
                        <p className="text-sm text-gray-500 max-w-sm">Upload your floor plan image to automatically extract wall lengths, door/window counts, and column positions.</p>
                      </div>
                      <input type="file" id="takeoff-upload" className="hidden" onChange={handleUpload} />
                      <label htmlFor="takeoff-upload" className="cursor-pointer bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-200">
                        Select Plan Image
                      </label>
                      {buildingData && (
                        <div className="mt-4 flex flex-col items-center gap-3 w-full">
                          <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg flex items-center gap-2">
                            <Box size={16} /> Successfully extracted {buildingData.floors[0].walls.length} walls and {buildingData.floors[0].doors.length} doors.
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Walls Sub-Tab */}
              {calcSubTab === "walls" && (
                <div className="space-y-6 max-w-3xl">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-lg font-bold text-gray-800">Wall Dimensions</h3>
                    {buildingData && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (activeSegment === 'walls') {
                              setActiveSegment('all');
                            } else {
                              setActiveSegment('walls');
                              setShowPlanModal(true);
                            }
                          }}
                          className={`px-3 py-1 text-[10px] font-bold rounded uppercase border transition-all ${activeSegment === 'walls' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}`}>
                          {activeSegment === 'walls' ? 'Hide Walls' : 'Show Walls'}
                        </button>
                        <button
                          onClick={() => {
                            if (activeSegment === 'openings') {
                              setActiveSegment('all');
                            } else {
                              setActiveSegment('openings');
                              setShowPlanModal(true);
                            }
                          }}
                          className={`px-3 py-1 text-[10px] font-bold rounded uppercase border transition-all ${activeSegment === 'openings' ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-gray-600 border-gray-200 hover:border-cyan-400'}`}>
                          {activeSegment === 'openings' ? 'Hide Openings' : 'Show Openings'}
                        </button>
                      </div>
                    )}
                  </div>
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
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="text-lg font-bold text-gray-800">Columns</h3>
                    <div className="flex gap-2">
                      {buildingData && (
                        <button
                          onClick={() => {
                            if (activeSegment === 'columns') {
                              setActiveSegment('all');
                            } else {
                              setActiveSegment('columns');
                              setShowPlanModal(true);
                            }
                          }}
                          className={`px-3 py-1 text-[10px] font-bold rounded uppercase border transition-all ${activeSegment === 'columns' ? 'bg-magenta-600 text-white border-magenta-600' : 'bg-white text-gray-600 border-gray-200 hover:border-magenta-400'}`}>
                          {activeSegment === 'columns' ? 'Hide Columns' : 'Show Columns'}
                        </button>
                      )}
                      <button onClick={() => addItem('column')} className="text-sm bg-gray-800 text-white px-3 py-1 rounded flex items-center gap-1"><Plus className="w-4 h-4" /> Add Type</button>
                    </div>
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
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="text-lg font-bold text-gray-800">Beams</h3>
                    <div className="flex gap-2">
                      {buildingData && (
                        <button
                          onClick={() => {
                            if (activeSegment === 'beams') {
                              setActiveSegment('all');
                            } else {
                              setActiveSegment('beams');
                              setShowPlanModal(true);
                            }
                          }}
                          className={`px-3 py-1 text-[10px] font-bold rounded uppercase border transition-all ${activeSegment === 'beams' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-400'}`}>
                          {activeSegment === 'beams' ? 'Hide Beams' : 'Show Beams'}
                        </button>
                      )}
                      <button onClick={() => addItem('beam')} className="text-sm bg-gray-800 text-white px-3 py-1 rounded flex items-center gap-1"><Plus className="w-4 h-4" /> Add Type</button>
                    </div>
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
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="text-lg font-bold text-gray-800">Slabs</h3>
                    <div className="flex gap-2">
                      {buildingData && (
                        <button
                          onClick={() => {
                            if (activeSegment === 'slabs') {
                              setActiveSegment('all');
                            } else {
                              setActiveSegment('slabs');
                              setShowPlanModal(true);
                            }
                          }}
                          className={`px-3 py-1 text-[10px] font-bold rounded uppercase border transition-all ${activeSegment === 'slabs' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-gray-600 border-gray-200 hover:border-yellow-400'}`}>
                          {activeSegment === 'slabs' ? 'Hide Slabs' : 'Show Slabs'}
                        </button>
                      )}
                      <button onClick={() => addItem('slab')} className="text-sm bg-gray-800 text-white px-3 py-1 rounded flex items-center gap-1"><Plus className="w-4 h-4" /> Add Type</button>
                    </div>
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
        )
        }

        {
          activeTab === 'takeoff' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full overflow-hidden">
              <EnglishMethodTakeoffSheet
                key={editorKey}
                initialItems={takeoffData}
                onChange={setTakeoffData}
                planImageUrl={uploadedImageUrl}
                buildingData={buildingData}
                projectInfo={{
                  projectName: projectInfo.projectName || "Superstructure",
                  clientName: "",
                  projectDate: projectInfo.date
                }}
              />
            </div>
          )
        }

        {
          activeTab === 'sheet' && (
            <div className="h-full">
              <UniversalSheet items={takeoffData} />
            </div>
          )
        }

        {
          activeTab === 'boq' && (
            <div className="h-full">
              <UniversalBOQ items={takeoffData} />
            </div>
          )
        }

        {
          activeTab === '3d-view' && (
            <div className="h-full bg-slate-900 rounded-lg overflow-hidden relative border border-slate-800 shadow-2xl">
              {buildingData ? (
                <>
                  <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                    <div className="bg-slate-800/80 backdrop-blur px-3 py-2 rounded-lg border border-slate-700 flex items-center gap-2 shadow-lg">
                      <Box className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Superstructure Model</span>
                    </div>
                    <div className="bg-slate-800/80 backdrop-blur px-3 py-2 rounded-lg border border-slate-700 flex items-center gap-2 shadow-lg">
                      <SettingsIcon className="w-4 h-4 text-slate-400" />
                      <span className="text-[10px] text-slate-400 font-mono">Height: {buildingData.wallHeight}m</span>
                    </div>
                  </div>

                  <div className="absolute bottom-4 right-4 z-10">
                    <button
                      onClick={() => setActiveTab('calculator')}
                      className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 font-bold text-sm"
                    >
                      <Calculator size={18} />
                      Edit Dimensions
                    </button>
                  </div>

                  <Canvas shadows dpr={[1, 2]}>
                    <Suspense fallback={null}>
                      <Superstructure3DScene
                        buildingData={buildingData}
                        selectedId={selectedElement?.id}
                        onSelect={setSelectedElement}
                      />
                    </Suspense>
                  </Canvas>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center space-y-4 text-slate-400">
                  <div className="p-6 bg-slate-800 rounded-full">
                    <Eye className="w-16 h-16 opacity-20" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-slate-200">No 3D Model Data</h3>
                    <p className="text-sm max-w-xs">Upload a plan in the Calculator tab to generate the 3D visualization.</p>
                  </div>
                  <button
                    onClick={() => { setActiveTab('calculator'); setCalcSubTab('automation'); }}
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm transition-colors border border-slate-700"
                  >
                    Go to Upload
                  </button>
                </div>
              )}
            </div>
          )
        }
      </main >

      {/* Plan Image Modal */}
      {
        showPlanModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Floor Plan Reference</h3>
                  <p className="text-sm text-gray-500">Scale: {buildingData?.metadata?.ppm || 100} pixels/meter</p>
                </div>
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={24} className="text-gray-500" />
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-gray-100 p-8 flex items-center justify-center relative min-h-[500px]">
                <div className="relative inline-block border-4 border-white shadow-2xl rounded-lg overflow-hidden">
                  <img
                    src={uploadedImageUrl}
                    alt="Floor Plan"
                    className={`max-w-full h-auto transition-all duration-500 ${activeSegment !== 'all' ? 'opacity-0 grayscale-[70%]' : 'opacity-100'}`}
                    onLoad={() => console.log("✅ Image loaded successfully:", uploadedImageUrl)}
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
                {!uploadedImageUrl && (
                  <div className="text-center text-gray-400">
                    <Eye size={48} className="mx-auto mb-2 opacity-20" />
                    <p>Image URL is missing</p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">Layer Switcher:</span>
                {[
                  { id: 'all', label: 'Plan', color: 'bg-gray-600' },
                  { id: 'rooms', label: 'Rooms', color: 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500' },
                  { id: 'walls', label: 'Walls', color: 'bg-black' },
                  { id: 'slabs', label: 'Slabs', color: 'bg-black' },
                  { id: 'beams', label: 'Beams', color: 'bg-black' },
                  { id: 'columns', label: 'Columns', color: 'bg-black' },
                  { id: 'stairs', label: 'Stairs', color: 'bg-black' },
                  { id: 'contours', label: 'Contours', color: 'bg-black' }
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
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="px-6 py-2 bg-gray-900 text-white rounded-lg font-bold hover:bg-gray-800 transition-colors"
                >
                  Exit View
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default SuperstructureTakeoffApp;
