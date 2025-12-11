import React, { useState } from "react";
import {
  Calculator,
  FileText,
  Download,
  Plus,
  Trash2,
  Building,
} from "lucide-react";

const RCCSuperstructureApp = () => {
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

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

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
      const response = await fetch(
        "http://localhost:8001/api/calculate-superstructure",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ columns, beams, slabs, settings }),
        }
      );

      if (!response.ok) throw new Error("Calculation failed");
      const data = await response.json();
      setResults(data);
    } catch (err) {
      const demoResults = calculateDemo();
      setResults(demoResults);
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

  const takeoffItems = results
    ? [
        {
          no: 1,
          description: `Reinforced concrete grade ${settings.conc_grade_name} (${settings.conc_grade}) in columns`,
          unit: "m³",
          quantity: results.col_conc_with_wastage,
        },
        {
          no: 2,
          description: `Reinforced concrete grade ${settings.conc_grade_name} (${settings.conc_grade}) in beams`,
          unit: "m³",
          quantity: results.beam_conc_with_wastage,
        },
        {
          no: 3,
          description: `Reinforced concrete grade ${settings.conc_grade_name} (${settings.conc_grade}) in slabs`,
          unit: "m³",
          quantity: results.slab_conc_with_wastage,
        },
        {
          no: 4,
          description:
            "High tensile steel reinforcement bars to BS 4449 in columns",
          unit: "kg",
          quantity: results.col_reinf_kg,
        },
        {
          no: 5,
          description:
            "High tensile steel reinforcement bars to BS 4449 in beams",
          unit: "kg",
          quantity: results.beam_reinf_kg,
        },
        {
          no: 6,
          description:
            "High tensile steel reinforcement bars to BS 4449 in slabs",
          unit: "kg",
          quantity: results.slab_reinf_kg,
        },
        {
          no: 7,
          description: `Formwork type ${settings.form_type} to columns including props and supports`,
          unit: "m²",
          quantity: results.col_form_m2,
        },
        {
          no: 8,
          description: `Formwork type ${settings.form_type} to beams including soffit and sides`,
          unit: "m²",
          quantity: results.beam_form_m2,
        },
        {
          no: 9,
          description: `Formwork type ${settings.form_type} to slabs including soffit and edges`,
          unit: "m²",
          quantity: results.slab_form_m2,
        },
        {
          no: 10,
          description:
            "Curing of concrete for 7 days with hessian and polythene",
          unit: "m²",
          quantity: results.total_form_m2,
        },
        {
          no: 11,
          description:
            "Testing of concrete including cube samples at 7, 14, and 28 days",
          unit: "Item",
          quantity: 1,
        },
        {
          no: 12,
          description: "Striking and cleaning formwork and storage",
          unit: "m²",
          quantity: results.total_form_m2,
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <Building className="w-8 h-8 text-gray-700" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                RCC Superstructure Takeoff
              </h1>
              <p className="text-sm text-gray-500">
                Columns, Beams & Slabs Calculator
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {columns.map((col, idx) => (
                  <div
                    key={col.id}
                    className="p-3 bg-gray-50 rounded border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Column {idx + 1}
                      </span>
                      {columns.length > 1 && (
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
                        className="px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={col.depth}
                        onChange={(e) =>
                          updateColumn(col.id, "depth", e.target.value)
                        }
                        placeholder="D(m)"
                        className="px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={col.height}
                        onChange={(e) =>
                          updateColumn(col.id, "height", e.target.value)
                        }
                        placeholder="H(m)"
                        className="px-2 py-1 text-sm border border-gray-300 rounded"
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
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {beams.map((beam, idx) => (
                  <div
                    key={beam.id}
                    className="p-3 bg-gray-50 rounded border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Beam {idx + 1}
                      </span>
                      {beams.length > 1 && (
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
                        className="px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={beam.width}
                        onChange={(e) =>
                          updateBeam(beam.id, "width", e.target.value)
                        }
                        placeholder="W(m)"
                        className="px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={beam.depth}
                        onChange={(e) =>
                          updateBeam(beam.id, "depth", e.target.value)
                        }
                        placeholder="D(m)"
                        className="px-2 py-1 text-sm border border-gray-300 rounded"
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
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {slabs.map((slab, idx) => (
                  <div
                    key={slab.id}
                    className="p-3 bg-gray-50 rounded border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Slab {idx + 1}
                      </span>
                      {slabs.length > 1 && (
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
                        className="px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={slab.thickness}
                        onChange={(e) =>
                          updateSlab(slab.id, "thickness", e.target.value)
                        }
                        placeholder="T(m)"
                        className="px-2 py-1 text-sm border border-gray-300 rounded"
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
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Concrete Grade
                  </label>
                  <input
                    type="text"
                    value={settings.conc_grade_name}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        conc_grade_name: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Reinf. Density (kg/m³)
                  </label>
                  <input
                    type="number"
                    value={settings.reinf_density}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        reinf_density: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Formwork Type
                  </label>
                  <select
                    value={settings.form_type}
                    onChange={(e) =>
                      setSettings({ ...settings, form_type: e.target.value })
                    }
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  >
                    <option value="F1">F1 - Basic</option>
                    <option value="F2">F2 - Standard</option>
                    <option value="F3">F3 - Fair Faced</option>
                    <option value="F4">F4 - Premium</option>
                  </select>
                </div>
                <div className="flex items-center">
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
                  <label className="ml-2 text-xs font-medium text-gray-700">
                    Include Wastage
                  </label>
                </div>
              </div>
            </div>

            <button
              onClick={calculateTakeoff}
              disabled={loading}
              className="w-full bg-gray-800 text-white py-3 rounded-lg font-medium hover:bg-gray-900 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
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

          {/* Results Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-6 h-6 text-gray-700" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Bill of Quantities
                  </h2>
                </div>
                {results && (
                  <button className="text-gray-600 hover:text-gray-900 flex items-center gap-2 text-sm">
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                )}
              </div>

              {!results ? (
                <div className="text-center py-16">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">
                    Add structural elements and click Calculate
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-900">
                        <th className="text-left py-3 px-2 font-semibold text-gray-900">
                          No.
                        </th>
                        <th className="text-left py-3 px-2 font-semibold text-gray-900">
                          Description
                        </th>
                        <th className="text-center py-3 px-2 font-semibold text-gray-900">
                          Unit
                        </th>
                        <th className="text-right py-3 px-2 font-semibold text-gray-900">
                          Quantity
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {takeoffItems.map(
                        (item, idx) =>
                          item.quantity > 0 && (
                            <tr
                              key={idx}
                              className="border-b border-gray-200 hover:bg-gray-50"
                            >
                              <td className="py-3 px-2 text-gray-700">
                                {item.no}
                              </td>
                              <td className="py-3 px-2 text-gray-900">
                                {item.description}
                              </td>
                              <td className="py-3 px-2 text-center text-gray-700">
                                {item.unit}
                              </td>
                              <td className="py-3 px-2 text-right font-mono text-gray-900">
                                {item.unit === "Item"
                                  ? "Item"
                                  : item.quantity.toFixed(3)}
                              </td>
                            </tr>
                          )
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-900 font-semibold">
                        <td colSpan="3" className="py-3 px-2 text-gray-900">
                          Total Concrete Volume (with wastage)
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-gray-900">
                          {results.total_conc_with_wastage.toFixed(3)} m³
                        </td>
                      </tr>
                      <tr className="font-semibold">
                        <td colSpan="3" className="py-3 px-2 text-gray-900">
                          Total Reinforcement
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-gray-900">
                          {results.total_reinf_kg.toFixed(2)} kg
                        </td>
                      </tr>
                      <tr className="font-semibold">
                        <td colSpan="3" className="py-3 px-2 text-gray-900">
                          Total Formwork
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-gray-900">
                          {results.total_form_m2.toFixed(2)} m²
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RCCSuperstructureApp;
