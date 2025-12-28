import React, { useState, useEffect } from "react";
import {
  Calculator,
  FileText,
  Download,
  Plus,
  Trash2,
  Building,
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

  const calculateTakeoff = async () => {
    setLoading(true);
    try {
      const payload = {
        columns: columns.map(c => ({
          id: c.id,
          width: c.width,
          depth: c.depth,
          height: c.height,
          mark: c.mark
        })),
        beams: beams.map(b => ({
          id: b.id,
          length: b.length,
          width: b.width,
          depth: b.depth,
          mark: b.mark
        })),
        slabs: slabs.map(s => ({
          id: s.id,
          area: s.area,
          thickness: s.thickness,
          mark: s.mark
        })),
        settings: {
          conc_grade: settings.conc_grade,
          conc_grade_name: settings.conc_grade_name,
          reinf_density: settings.reinf_density,
          form_type: settings.form_type,
          include_wastage: settings.include_wastage,
          conc_wastage: settings.conc_wastage,
          reinf_wastage: settings.reinf_wastage,
          cover: settings.cover,
          bar_spacing: settings.bar_spacing
        }
      };

      const response = await axios.post("http://localhost:8001/rc_superstructure_router/api/calculate-superstructure", payload);
      const data = response.data;

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

    } catch (err) {
      console.error(err);
      alert("Calculation failed. Backend might be offline.");
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
              {/* Columns Section */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Columns</h3>
                  <button
                    onClick={addColumn}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
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
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Beams</h3>
                  <button
                    onClick={addBeam}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
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
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Slabs</h3>
                  <button
                    onClick={addSlab}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
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
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 flex flex-col h-full">
                <h3 className="text-lg font-bold text-blue-900 mb-2">Instructions</h3>
                <ul className="list-disc pl-5 text-sm text-blue-800 space-y-1 mb-6">
                  <li>Add Columns, Beams, and Slabs using the + buttons.</li>
                  <li>Enter dimensions for each element.</li>
                  <li>Adjust settings if needed (grades, wastage).</li>
                  <li>Click Calculate to generate BOQ.</li>
                  <li>Check the <strong>Takeoff</strong> tab for detailed breakdown.</li>
                </ul>

                {takeoffData.length > 0 && (
                  <div className="bg-white p-4 rounded shadow-sm border">
                    <h4 className="font-bold text-gray-800 mb-2">Quick Summary</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Total Items:</span>
                        <span className="font-mono">{takeoffData.length}</span>
                      </div>
                    </div>
                  </div>
                )}
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
    </div>
  );
};

export default RCCSuperstructureApp;
