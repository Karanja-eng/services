import React, { useState, useEffect } from "react";
import {
  Calculator,
  FileText,
  Download,
  Plus,
  Trash2,
  Building,
  Upload,
  Loader2,
  Eye,
  Layers,
  X,
} from "lucide-react";
import axios from "axios";
import EnglishMethodTakeoffSheet from "./ExternalWorks/EnglishMethodTakeoffSheet";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from './universal_component';

const RCCSuperstructureApp = () => {
  const [activeTab, setActiveTab] = useState("calculator");
  const [columns, setColumns] = useState([
    { id: 1, width: 0.3, depth: 0.3, height: 3.0, mark: "C1" },
  ]);
  const [beams, setBeams] = useState([
    { id: 1, length: 5.0, width: 0.3, depth: 0.45, mark: "B1" },
  ]);
  const [slabs, setSlabs] = useState([
    { id: 1, area: 25.0, thickness: 0.15, mark: "S1" },
  ]);

  const [settings, setSettings] = useState({
    conc_grade: "1:1.5:3",
    conc_grade_name: "C25",
    reinf_density: 120,
    form_type: "F3",
    include_wastage: true,
    conc_wastage: 5,
    reinf_wastage: 2.5,
    cover: 25,
    bar_spacing: 150,
  });

  const [takeoffData, setTakeoffData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  // Automation State
  const [calcSubTab, setCalcSubTab] = useState("automation");
  const [processing, setProcessing] = useState(false);
  const [fileId, setFileId] = useState(null);
  const [buildingData, setBuildingData] = useState(null);
  const [planImageUrl, setPlanImageUrl] = useState(null);
  const [activeSegment, setActiveSegment] = useState("all");
  const [showPlanModal, setShowPlanModal] = useState(false);

  useEffect(() => {
    calculateTakeoff();
  }, []); // Run on mount

  const addColumn = () => {
    setColumns([
      ...columns,
      {
        id: Date.now(),
        width: 0.3,
        depth: 0.3,
        height: 3.0,
        mark: `C${columns.length + 1}`,
      },
    ]);
  };

  const addBeam = () => {
    setBeams([
      ...beams,
      {
        id: Date.now(),
        length: 5.0,
        width: 0.3,
        depth: 0.45,
        mark: `B${beams.length + 1}`,
      },
    ]);
  };

  const addSlab = () => {
    setSlabs([
      ...slabs,
      {
        id: Date.now(),
        area: 25.0,
        thickness: 0.15,
        mark: `S${slabs.length + 1}`,
      },
    ]);
  };

  const removeColumn = (id) => {
    if (columns.length > 1) setColumns(columns.filter((c) => c.id !== id));
  };

  const removeBeam = (id) => {
    if (beams.length > 1) setBeams(beams.filter((b) => b.id !== id));
  };

  const removeSlab = (id) => {
    if (slabs.length > 1) setSlabs(slabs.filter((s) => s.id !== id));
  };

  const updateColumn = (id, field, value) => {
    setColumns(
      columns.map((c) =>
        c.id === id ? { ...c, [field]: parseFloat(value) || 0 } : c
      )
    );
  };

  const updateBeam = (id, field, value) => {
    setBeams(
      beams.map((b) =>
        b.id === id ? { ...b, [field]: parseFloat(value) || 0 } : b
      )
    );
  };

  const updateSlab = (id, field, value) => {
    setSlabs(
      slabs.map((s) =>
        s.id === id ? { ...s, [field]: parseFloat(value) || 0 } : s
      )
    );
  };

  const API_BASE = `http://${window.location.hostname}:8001`;

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Immediate local preview
    setPlanImageUrl(URL.createObjectURL(file));
    setProcessing(true);

    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/arch_pro/upload`, { method: "POST", body: fd });
      const data = await res.json();
      setFileId(data.file_id);
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
      autoFillRCInputs(data);
    } catch (err) { console.error(err); }
  };

  const autoFillRCInputs = (data) => {
    if (!data || !data.floors[0]) return;
    const floor = data.floors[0];

    // 1. Columns: Map directly (assuming CV returns individual columns)
    if (floor.columns && floor.columns.length > 0) {
      setColumns(floor.columns.map((c, i) => ({
        id: c.id || Date.now() + i,
        // Default to a standard count of 1 if not provided
        count: 1,
        width: c.size || 0.3,
        depth: c.size || 0.3,
        height: 3.0,
        mark: c.mark || `C${i + 1}`,
      })));
    }

    // 2. Beams: Continuous logic (Total Wall Length + Openings)
    // Calculate total linear length of walls
    let totalWallLen = 0;
    if (floor.walls) {
      totalWallLen = floor.walls.reduce((sum, w) => sum + (parseFloat(w.length) || 0), 0);
    }
    // Add openings to make it "continuous" (over doors/windows)
    let totalDoorWidth = 0;
    if (floor.doors) {
      totalDoorWidth = floor.doors.reduce((sum, d) => sum + (parseFloat(d.width) || 0), 0);
    }
    let totalWindowWidth = 0;
    if (floor.windows) {
      totalWindowWidth = floor.windows.reduce((sum, w) => sum + (parseFloat(w.width) || 0), 0);
    }

    const continuousBeamLength = totalWallLen + totalDoorWidth + totalWindowWidth;

    // Create one "Total Beam Run" item, or split if needed. 
    // Here we create one consolidated item as per user preference for simplicity in takeoff
    if (continuousBeamLength > 0) {
      setBeams([{
        id: Date.now() + 500,
        count: 1,
        length: parseFloat(continuousBeamLength.toFixed(2)),
        width: 0.2, // Default
        depth: 0.45, // Default
        mark: "B1 (Total Run)",
      }]);
    }

    // 3. Slabs: Single Slab Logic (Bounding Box)
    // Find min/max X and Y from walls to estimate building footprint
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let found = false;

    if (floor.walls) {
      floor.walls.forEach(w => {
        const vals = [w.start_x, w.end_x, w.start_y, w.end_y].map(v => parseFloat(v));
        // Check for valid numbers
        if (!vals.some(isNaN)) {
          minX = Math.min(minX, vals[0], vals[1]);
          maxX = Math.max(maxX, vals[0], vals[1]);
          minY = Math.min(minY, vals[2], vals[3]);
          maxY = Math.max(maxY, vals[2], vals[3]);
          found = true;
        }
      });
    }

    if (found) {
      const width = maxX - minX;
      const depth = maxY - minY;
      const totalArea = width * depth;

      if (totalArea > 0) {
        setSlabs([{
          id: Date.now() + 600,
          area: parseFloat(totalArea.toFixed(2)),
          thickness: 0.15,
          mark: "S1 (Main Slab)"
        }]);
      }
    } else if (floor.slabs && floor.slabs.length > 0) {
      // Fallback to CV slabs if no walls? Or just use CV slabs logic if preferred?
      // User requested single slab, so if walls fail, maybe try summing CV slab areas
      const totalSlabArea = floor.slabs.reduce((sum, s) => sum + (parseFloat(s.area) || 0), 0);
      setSlabs([{
        id: Date.now() + 600,
        area: parseFloat(totalSlabArea.toFixed(2)),
        thickness: 0.15,
        mark: "S1 (Total Area)"
      }]);
    }
  };

  const calculateTakeoff = async () => {
    setLoading(true);
    try {
      // Explode items based on 'count' for the backend
      const explodedColumns = [];
      columns.forEach(c => {
        const count = parseInt(c.count) || 1;
        for (let i = 0; i < count; i++) {
          explodedColumns.push({
            id: `${c.id}_${i}`, // Unique ID for backend
            width: parseFloat(c.width) || 0.1, // Safe default
            depth: parseFloat(c.depth) || 0.1,
            height: parseFloat(c.height) || 0.1,
            mark: c.mark
          });
        }
      });

      const explodedBeams = [];
      beams.forEach(b => {
        const count = parseInt(b.count) || 1;
        for (let i = 0; i < count; i++) {
          explodedBeams.push({
            id: `${b.id}_${i}`,
            length: parseFloat(b.length) || 0.1,
            width: parseFloat(b.width) || 0.1,
            depth: parseFloat(b.depth) || 0.1,
            mark: b.mark
          });
        }
      });

      // Slabs usually don't have a 'count' field in this UI, but if they did:
      // (The UI code shows slabs don't have count input, just area/thickness)
      const finalSlabs = slabs.map(s => ({
        id: s.id,
        area: parseFloat(s.area) || 0.1,
        thickness: parseFloat(s.thickness) || 0.1,
        mark: s.mark
      }));

      const payload = {
        columns: explodedColumns,
        beams: explodedBeams,
        slabs: finalSlabs,
        settings: {
          conc_grade: settings.conc_grade || "1:1.5:3",
          conc_grade_name: settings.conc_grade_name || "C25",
          reinf_density: parseFloat(settings.reinf_density) || 120,
          form_type: settings.form_type || "F3",
          include_wastage: settings.include_wastage,
          conc_wastage: parseFloat(settings.conc_wastage) || 5, // Remove hard validation cap if desired, relying on backend
          reinf_wastage: parseFloat(settings.reinf_wastage) || 2.5,
          cover: parseFloat(settings.cover) || 25,
          bar_spacing: parseFloat(settings.bar_spacing) || 150
        }
      };

      console.log("Sending Payload:", payload); // Debug

      const response = await axios.post(`${API_BASE}/rc_superstructure_router/api/calculate-superstructure`, payload);
      const data = response.data;
      console.log("API Response:", data);

      if (data) {
        const items = [
          { id: 1, billNo: "1", itemNo: "1", description: `Reinforced concrete grade ${settings.conc_grade_name} (${settings.conc_grade}) in columns`, unit: "m³", quantity: data.col_conc_with_wastage, rate: 0, amount: 0, dimensions: [], isHeader: false },
          { id: 2, billNo: "2", itemNo: "2", description: `Reinforced concrete grade ${settings.conc_grade_name} (${settings.conc_grade}) in beams`, unit: "m³", quantity: data.beam_conc_with_wastage, rate: 0, amount: 0, dimensions: [], isHeader: false },
          { id: 3, billNo: "3", itemNo: "3", description: `Reinforced concrete grade ${settings.conc_grade_name} (${settings.conc_grade}) in slabs`, unit: "m³", quantity: data.slab_conc_with_wastage, rate: 0, amount: 0, dimensions: [], isHeader: false },
          { id: 4, billNo: "4", itemNo: "4", description: "High tensile steel reinforcement bars to BS 4449 in columns", unit: "kg", quantity: data.col_reinf_kg, rate: 0, amount: 0, dimensions: [], isHeader: false },
          { id: 5, billNo: "5", itemNo: "5", description: "High tensile steel reinforcement bars to BS 4449 in beams", unit: "kg", quantity: data.beam_reinf_kg, rate: 0, amount: 0, dimensions: [], isHeader: false },
          { id: 6, billNo: "6", itemNo: "6", description: "High tensile steel reinforcement bars to BS 4449 in slabs", unit: "kg", quantity: data.slab_reinf_kg, rate: 0, amount: 0, dimensions: [], isHeader: false },
          { id: 7, billNo: "7", itemNo: "7", description: `Formwork type ${settings.form_type} to columns including props and supports`, unit: "m²", quantity: data.col_form_m2, rate: 0, amount: 0, dimensions: [], isHeader: false },
          { id: 8, billNo: "8", itemNo: "8", description: `Formwork type ${settings.form_type} to beams including soffit and sides`, unit: "m²", quantity: data.beam_form_m2, rate: 0, amount: 0, dimensions: [], isHeader: false },
          { id: 9, billNo: "9", itemNo: "9", description: `Formwork type ${settings.form_type} to slabs including soffit and edges`, unit: "m²", quantity: data.slab_form_m2, rate: 0, amount: 0, dimensions: [], isHeader: false },
          { id: 10, billNo: "10", itemNo: "10", description: "Curing of concrete for 7 days with hessian and polythene", unit: "m²", quantity: data.total_form_m2, rate: 0, amount: 0, dimensions: [], isHeader: false },
          { id: 11, billNo: "11", itemNo: "11", description: "Testing of concrete including cube samples at 7, 14, and 28 days", unit: "Item", quantity: 1, rate: 0, amount: 0, dimensions: [], isHeader: false },
          { id: 12, billNo: "12", itemNo: "12", description: "Striking and cleaning formwork and storage", unit: "m²", quantity: data.total_form_m2, rate: 0, amount: 0, dimensions: [], isHeader: false },
        ].filter(item => item.quantity > 0);

        setTakeoffData(items);
        setEditorKey(prev => prev + 1);
        // Only switch tab if we have data to show
        if (items.length > 0) {
          setActiveTab("takeoff");
        } else {
          alert("Calculation completed but yielded 0 quantities. Please check your inputs.");
        }
      }

    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.detail) {
        // Detailed backend error
        alert("Calculation Error: " + JSON.stringify(err.response.data.detail));
      } else {
        alert("Calculation failed. Backend might be offline or unreachable.");
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateDemo = () => {
    // Column calculations
    const col_conc_vol = columns.reduce(
      (sum, c) => sum + c.width * c.depth * c.height,
      0
    );
    const col_form = columns.reduce(
      (sum, c) => sum + 2 * (c.width + c.depth) * c.height,
      0
    );

    // Beam calculations
    const beam_conc_vol = beams.reduce(
      (sum, b) => sum + b.length * b.width * b.depth,
      0
    );
    const beam_form_sides = beams.reduce(
      (sum, b) => sum + 2 * b.length * b.depth,
      0
    );
    const beam_form_bottom = beams.reduce(
      (sum, b) => sum + b.length * b.width,
      0
    );
    const beam_form = beam_form_sides + beam_form_bottom;

    // Slab calculations
    const slab_conc_vol = slabs.reduce(
      (sum, s) => sum + s.area * s.thickness,
      0
    );
    const slab_form_soffit = slabs.reduce((sum, s) => sum + s.area, 0);
    const slab_form_edges = slabs.reduce(
      (sum, s) => sum + 2 * (Math.sqrt(s.area) * 4) * s.thickness,
      0
    );
    const slab_form = slab_form_soffit + slab_form_edges;

    // Totals
    const total_conc_vol = col_conc_vol + beam_conc_vol + slab_conc_vol;
    const total_form = col_form + beam_form + slab_form;

    // With wastage
    const wastage_factor = settings.include_wastage
      ? 1 + settings.conc_wastage / 100
      : 1;
    const reinf_wastage_factor = settings.include_wastage
      ? 1 + settings.reinf_wastage / 100
      : 1;

    const col_conc_with_wastage = col_conc_vol * wastage_factor;
    const beam_conc_with_wastage = beam_conc_vol * wastage_factor;
    const slab_conc_with_wastage = slab_conc_vol * wastage_factor;
    const total_conc_with_wastage = total_conc_vol * wastage_factor;

    // Reinforcement
    const col_reinf =
      col_conc_vol * settings.reinf_density * reinf_wastage_factor;
    const beam_reinf =
      beam_conc_vol * settings.reinf_density * reinf_wastage_factor;
    const slab_reinf =
      slab_conc_vol * settings.reinf_density * reinf_wastage_factor;
    const total_reinf = col_reinf + beam_reinf + slab_reinf;

    // Shuttering (formwork in tons for estimation)
    const shuttering_tons = total_form * 0.025; // Approximate weight

    return {
      col_conc_m3: col_conc_vol,
      beam_conc_m3: beam_conc_vol,
      slab_conc_m3: slab_conc_vol,
      total_conc_m3: total_conc_vol,
      col_conc_with_wastage: col_conc_with_wastage,
      beam_conc_with_wastage: beam_conc_with_wastage,
      slab_conc_with_wastage: slab_conc_with_wastage,
      total_conc_with_wastage: total_conc_with_wastage,
      col_reinf_kg: col_reinf,
      beam_reinf_kg: beam_reinf,
      slab_reinf_kg: slab_reinf,
      total_reinf_kg: total_reinf,
      col_form_m2: col_form,
      beam_form_m2: beam_form,
      slab_form_m2: slab_form,
      total_form_m2: total_form,
      shuttering_tons: shuttering_tons,
    };
  };

  return (
    <div className="flex bg-gray-50 h-screen flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-4 flex-none">
        <div className="flex items-center gap-3 mb-4">
          <Building className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              RCC Superstructure Takeoff
            </h1>
            <p className="text-sm text-gray-600">
              Columns, Beams & Slabs
            </p>
          </div>
        </div>

        <UniversalTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabs={['calculator', 'takeoff', 'sheet', 'boq']}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 max-w-7xl mx-auto w-full">
        {activeTab === "calculator" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Input Panel */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex border-b border-gray-200 bg-gray-50 mb-4 rounded-t-lg">
                  {["automation", "manual"].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setCalcSubTab(tab)}
                      className={`flex-1 px-4 py-2 text-xs font-bold transition-colors ${calcSubTab === tab ? 'border-b-2 border-blue-600 text-blue-600 bg-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                      {tab === "automation" ? "AI AUTOMATION" : "MANUAL LISTS"}
                    </button>
                  ))}
                </div>

                {calcSubTab === "automation" ? (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 rounded-xl space-y-3">
                      {processing ? (
                        <div className="flex flex-col items-center space-y-2">
                          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                          <p className="text-xs font-bold text-gray-700">Detecting Structural Elements...</p>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-blue-400" />
                          <div className="text-center">
                            <h3 className="text-sm font-bold text-gray-900">RC Analysis</h3>
                            <p className="text-[10px] text-gray-500">Upload plan to auto-detect columns, beams and slabs.</p>
                          </div>
                          <input type="file" id="rc-upload" className="hidden" onChange={handleUpload} />
                          <label htmlFor="rc-upload" className="cursor-pointer bg-blue-600 text-white px-4 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition-all text-xs">
                            Select Plan
                          </label>
                        </>
                      )}
                    </div>

                    {buildingData && (
                      <div className="bg-green-50 p-3 rounded-lg border border-green-200 text-green-700 text-xs font-bold flex items-center gap-2">
                        <Layers className="w-3 h-3" /> Architecture analysis complete. Verify elements below.
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-center text-gray-500 py-4 italic">Use the sections below to manage your RC elements list manually.</p>
                )}
              </div>

              {/* Columns Section */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3 border-b pb-2">
                  <h3 className="font-semibold text-gray-900">Columns</h3>
                  <div className="flex gap-2">
                    {buildingData && (
                      <button
                        onClick={() => {
                          const next = activeSegment === 'columns' ? 'all' : 'columns';
                          setActiveSegment(next);
                          if (next === 'columns') setShowPlanModal(true);
                        }}
                        className={`px-3 py-1 text-[10px] font-bold rounded uppercase border transition-all ${activeSegment === 'columns' ? 'bg-magenta-600 text-white border-magenta-600' : 'bg-white text-gray-600 border-gray-200 hover:border-magenta-400 font-black'}`}>
                        {activeSegment === 'columns' ? 'Hide' : 'Show AI'}
                      </button>
                    )}
                    <button
                      onClick={addColumn}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                  {columns.length === 0 && <p className="text-sm text-gray-500 italic">No columns added</p>}
                  {columns.map((col, idx) => (
                    <div
                      key={col.id}
                      className="p-3 bg-gray-50 rounded border border-gray-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          {col.mark || `C${idx + 1}`}
                        </span>
                        {columns.length > 0 && (
                          <button
                            onClick={() => removeColumn(col.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={col.width}
                          onChange={(e) =>
                            updateColumn(col.id, "width", e.target.value)
                          }
                          placeholder="W(m)"
                          className="px-2 py-1 text-sm border border-gray-300 rounded w-full"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={col.depth}
                          onChange={(e) =>
                            updateColumn(col.id, "depth", e.target.value)
                          }
                          placeholder="D(m)"
                          className="px-2 py-1 text-sm border border-gray-300 rounded w-full"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={col.height}
                          onChange={(e) =>
                            updateColumn(col.id, "height", e.target.value)
                          }
                          placeholder="H(m)"
                          className="px-2 py-1 text-sm border border-gray-300 rounded w-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Beams Section */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3 border-b pb-2">
                  <h3 className="font-semibold text-gray-900">Beams</h3>
                  <div className="flex gap-2">
                    {buildingData && (
                      <button
                        onClick={() => {
                          const next = activeSegment === 'beams' ? 'all' : 'beams';
                          setActiveSegment(next);
                          if (next === 'beams') setShowPlanModal(true);
                        }}
                        className={`px-3 py-1 text-[10px] font-bold rounded uppercase border transition-all ${activeSegment === 'beams' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-400 font-black'}`}>
                        {activeSegment === 'beams' ? 'Hide' : 'Show AI'}
                      </button>
                    )}
                    <button
                      onClick={addBeam}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                  {beams.length === 0 && <p className="text-sm text-gray-500 italic">No beams added</p>}
                  {beams.map((beam, idx) => (
                    <div
                      key={beam.id}
                      className="p-3 bg-gray-50 rounded border border-gray-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          {beam.mark || `B${idx + 1}`}
                        </span>
                        {beams.length > 0 && (
                          <button
                            onClick={() => removeBeam(beam.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={beam.length}
                          onChange={(e) =>
                            updateBeam(beam.id, "length", e.target.value)
                          }
                          placeholder="L(m)"
                          className="px-2 py-1 text-sm border border-gray-300 rounded w-full"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={beam.width}
                          onChange={(e) =>
                            updateBeam(beam.id, "width", e.target.value)
                          }
                          placeholder="W(m)"
                          className="px-2 py-1 text-sm border border-gray-300 rounded w-full"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={beam.depth}
                          onChange={(e) =>
                            updateBeam(beam.id, "depth", e.target.value)
                          }
                          placeholder="D(m)"
                          className="px-2 py-1 text-sm border border-gray-300 rounded w-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Slabs Section */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3 border-b pb-2">
                  <h3 className="font-semibold text-gray-900 uppercase tracking-tighter text-xs">Slabs & Walls</h3>
                  <div className="flex gap-2">
                    {buildingData && (
                      <>
                        <button
                          onClick={() => {
                            const next = activeSegment === 'slabs' ? 'all' : 'slabs';
                            setActiveSegment(next);
                            if (next === 'slabs') setShowPlanModal(true);
                          }}
                          className={`px-3 py-1 text-[10px] font-bold rounded uppercase border transition-all ${activeSegment === 'slabs' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-gray-600 border-gray-200 hover:border-yellow-400 font-black'}`}>
                          {activeSegment === 'slabs' ? 'Hide Slabs' : 'Show Slabs'}
                        </button>
                        <button
                          onClick={() => {
                            const next = activeSegment === 'walls' ? 'all' : 'walls';
                            setActiveSegment(next);
                            if (next === 'walls') setShowPlanModal(true);
                          }}
                          className={`px-3 py-1 text-[10px] font-bold rounded uppercase border transition-all ${activeSegment === 'walls' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 font-black'}`}>
                          {activeSegment === 'walls' ? 'Hide Walls' : 'Show Walls'}
                        </button>
                      </>
                    )}
                    <button
                      onClick={addSlab}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                  {slabs.length === 0 && <p className="text-sm text-gray-500 italic">No slabs added</p>}
                  {slabs.map((slab, idx) => (
                    <div
                      key={slab.id}
                      className="p-3 bg-gray-50 rounded border border-gray-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          {slab.mark || `S${idx + 1}`}
                        </span>
                        {slabs.length > 0 && (
                          <button
                            onClick={() => removeSlab(slab.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={slab.area}
                          onChange={(e) =>
                            updateSlab(slab.id, "area", e.target.value)
                          }
                          placeholder="Area(m²)"
                          className="px-2 py-1 text-sm border border-gray-300 rounded w-full"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={slab.thickness}
                          onChange={(e) =>
                            updateSlab(slab.id, "thickness", e.target.value)
                          }
                          placeholder="T(m)"
                          className="px-2 py-1 text-sm border border-gray-300 rounded w-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Settings */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Settings</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.include_wastage}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          include_wastage: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-gray-800 border-gray-300 rounded"
                    />
                    <label className="text-xs font-medium text-gray-700">Include Wastage</label>
                  </div>
                </div>
              </div>

              <button
                onClick={calculateTakeoff}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center justify-center gap-2 shadow-sm"
              >
                {loading ? (
                  <span>Calculating...</span>
                ) : (
                  <>
                    <Calculator className="w-5 h-5" />
                    Calculate Takeoff
                  </>
                )}
              </button>
            </div>

            {/* Info Panel */}
            <div className="lg:col-span-2">
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 flex flex-col h-full relative overflow-hidden">
                {planImageUrl ? (
                  <div className="absolute inset-0 bg-white">
                    <img
                      src={planImageUrl}
                      className={`absolute inset-0 w-full h-full object-contain transition-all duration-500 ${buildingData?.metadata?.segmented_urls && activeSegment !== 'all' ? 'opacity-40 grayscale-[50%]' : 'opacity-100'}`}
                      alt="Base Plan"
                    />
                    {buildingData?.metadata?.segmented_urls && activeSegment !== 'all' && (
                      <img
                        src={`${API_BASE}${buildingData.metadata.segmented_urls[activeSegment]}`}
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none mix-blend-multiply transition-all duration-300"
                        alt="Segment Mask"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <div className="absolute top-4 right-4 flex gap-2">
                      <button
                        onClick={() => setPlanImageUrl(null)}
                        className="bg-white/90 p-2 shadow rounded-full hover:bg-white text-red-500"
                        title="Clear Image"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="relative z-10 bg-white/80 backdrop-blur-sm p-4 rounded-lg shadow-sm border border-blue-100/50 max-w-md">
                  <h3 className="text-lg font-bold text-blue-900 mb-2">Instructions</h3>
                  <ul className="list-disc pl-5 text-sm text-blue-800 space-y-1 mb-6">
                    <li>Use <strong>AI Automation</strong> to scan your floor plan for faster takeoff.</li>
                    <li>Add or refine Columns, Beams, and Slabs manually using the + buttons.</li>
                    <li>Adjust concrete grades and reinforcement densities in Settings.</li>
                    <li>Click Calculate to generate BOQ and detailed takeoff.</li>
                  </ul>

                  {takeoffData.length > 0 && (
                    <div className="bg-white p-4 rounded shadow-sm border">
                      <h4 className="font-bold text-gray-800 mb-2">Quick Summary</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Verified Items:</span>
                          <span className="font-mono font-bold text-blue-600">{takeoffData.length}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "takeoff" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full overflow-hidden">
            <EnglishMethodTakeoffSheet
              key={editorKey}
              initialItems={takeoffData}
              onChange={setTakeoffData}
              planImageUrl={planImageUrl}
              buildingData={buildingData}
              projectInfo={{
                projectName: "RCC Superstructure",
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
      </div>
      {/* Plan Image Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Floor Plan Reference</h3>
                <p className="text-sm text-gray-500">Scale: {buildingData?.metadata?.ppm || 100} pixels/meter</p>
              </div>
              <button onClick={() => setShowPlanModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={24} className="text-gray-500" />
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
                  { id: 'rooms', label: 'Rooms', color: 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500' },
                  { id: 'walls', label: 'Walls', color: 'bg-black' },
                  { id: 'slabs', label: 'Slabs', color: 'bg-black' },
                  { id: 'beams', label: 'Beams', color: 'bg-black' },
                  { id: 'columns', label: 'Columns', color: 'bg-black' },
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
    </div >
  );
};

export default RCCSuperstructureApp;
