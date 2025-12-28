import React, { useState } from "react";
import { Calculator, FileText, Download, AlertCircle, Settings, Box, Layers } from "lucide-react";

const InputField = ({ label, name, value, onChange, type = "number", step = "0.01", min = "0" }) => (
  <div>
    <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">{label}</label>
    <input
      type={type} name={name} value={value} onChange={onChange} step={step} min={min}
      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  </div>
);

const SelectField = ({ label, name, value, onChange, options }) => (
  <div>
    <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">{label}</label>
    <select name={name} value={value} onChange={onChange} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
      {options.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
    </select>
  </div>
);

export default function EnhancedSepticTakeoffApp({ isDark = false }) {
  const [activeTab, setActiveTab] = useState("calculator");
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
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
      };
      const response = await fetch("http://localhost:8001/septicRouter/api/calculate", {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.boq) {
        setTakeoffData(data.boq.map((row, i) => ({
          id: i + 1, itemNo: (i + 1).toString(), description: row.description, unit: row.unit,
          quantity: parseFloat(row.quantity) || 0, rate: 0, amount: 0
        })));
        setSummary(data.summary);
      }
    } catch (err) {
      setError(err.message || "Failed to connect to backend");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900">
      <div className="flex-1 flex flex-col h-full">
        <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-sm px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Calculator className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Septic System Takeoff</h1>
                <p className="text-sm text-gray-600 dark:text-slate-400">Professional quantity surveying tool</p>
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            {[
              { id: "calculator", icon: Settings, label: "Calculator" },
              { id: "2d", icon: Layers, label: "2D Drawings" },
              { id: "3d", icon: Box, label: "3D Model" },
              { id: "boq", icon: FileText, label: "BOQ" }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all rounded-t-lg ${activeTab === tab.id
                    ? 'bg-white dark:bg-slate-800 text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}>
                <tab.icon className="w-4 h-4" />{tab.label}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {activeTab === "calculator" && (
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-6">Design Parameters</h2>
                <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-blue-600 border-b pb-2">Septic Tank</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <InputField label="Length (m)" name="tankIntL" value={formData.tankIntL} onChange={handleChange} />
                      <InputField label="Width (m)" name="tankIntW" value={formData.tankIntW} onChange={handleChange} />
                      <InputField label="Depth (m)" name="tankDepthInt" value={formData.tankDepthInt} onChange={handleChange} />
                      <InputField label="Wall (m)" name="wallThick" value={formData.wallThick} onChange={handleChange} />
                      <InputField label="Slab (m)" name="slabThick" value={formData.slabThick} onChange={handleChange} />
                      <InputField label="Bed (m)" name="bedThickTank" value={formData.bedThickTank} onChange={handleChange} />
                      <InputField label="Baffles" name="numBaffles" value={formData.numBaffles} onChange={handleChange} step="1" />
                      <InputField label="Baffle Thick" name="baffleThick" value={formData.baffleThick} onChange={handleChange} />
                    </div>
                    {formData.numBaffles > 0 && (
                      <div className="grid grid-cols-3 gap-3">
                        <InputField label="Baffle L" name="baffleL" value={formData.baffleL} onChange={handleChange} />
                        {Array.from({ length: formData.numBaffles }).map((_, i) => (
                          <InputField key={i} label={`H${i + 1} (m)`} name={`baffleHeight${i + 1}`} value={formData[`baffleHeight${i + 1}`]} onChange={handleChange} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-blue-600 border-b pb-2">Manhole</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <InputField label="L (m)" name="manholeIntL" value={formData.manholeIntL} onChange={handleChange} />
                      <InputField label="W (m)" name="manholeIntW" value={formData.manholeIntW} onChange={handleChange} />
                      <InputField label="D (m)" name="manholeDepthInt" value={formData.manholeDepthInt} onChange={handleChange} />
                      <InputField label="Covers" name="numCovers" value={formData.numCovers} onChange={handleChange} step="1" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-blue-600 border-b pb-2">Soakpit</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <SelectField label="Shape" name="soakpitShape" value={formData.soakpitShape} onChange={handleChange}
                        options={[{ value: 'circular', label: 'Circular' }, { value: 'rectangular', label: 'Rectangular' }]} />
                      <InputField label="Size (m)" name="soakpitDiameter" value={formData.soakpitDiameter} onChange={handleChange} />
                      <InputField label="Depth (m)" name="soakpitDepth" value={formData.soakpitDepth} onChange={handleChange} />
                    </div>
                  </div>
                </div>

                <button onClick={handleCalculate} disabled={loading}
                  className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 px-4 rounded-md flex items-center justify-center gap-2">
                  {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Calculator className="w-5 h-5" />}
                  {loading ? 'Calculating...' : 'Calculate Quantities'}
                </button>

                {error && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md flex gap-2">
                    <AlertCircle className="w-5 h-5" />
                    <div><p className="font-bold">Error</p><p className="text-sm">{error}</p></div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-slate-800 p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-4">Quick Guide</h3>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-slate-400">
                    <li>1. Enter septic tank, manhole, and soakpit dimensions</li>
                    <li>2. Specify baffle walls configuration</li>
                    <li>3. Click Calculate to generate BOQ</li>
                    <li>4. View 2D/3D visualizations</li>
                    <li>5. Export results to CSV</li>
                  </ul>
                </div>

                {summary && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg shadow">
                    <h4 className="font-bold text-green-800 dark:text-green-400 mb-3">Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>Concrete:</span><strong>{summary.total_concrete} m³</strong></div>
                      <div className="flex justify-between"><span>Excavation:</span><strong>{summary.total_excavation} m³</strong></div>
                      <div className="flex justify-between"><span>Formwork:</span><strong>{summary.total_formwork} m²</strong></div>
                      <div className="flex justify-between pt-2 border-t"><span>Items:</span><strong>{takeoffData.length}</strong></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "boq" && (
            <div className="max-w-7xl mx-auto bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold">Bill of Quantities</h2>
              </div>
              {takeoffData.length === 0 ? (
                <div className="p-12 text-center"><FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No data. Run calculation first.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-slate-700">
                      <tr>{['No.', 'Description', 'Unit', 'Quantity', 'Rate', 'Amount'].map(h => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                      {takeoffData.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                          <td className="px-6 py-4 text-sm">{item.itemNo}</td>
                          <td className="px-6 py-4 text-sm">{item.description}</td>
                          <td className="px-6 py-4 text-sm">{item.unit}</td>
                          <td className="px-6 py-4 text-sm font-semibold">{item.quantity.toFixed(2)}</td>
                          <td className="px-6 py-4 text-sm">{item.rate}</td>
                          <td className="px-6 py-4 text-sm">{item.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {(activeTab === "2d" || activeTab === "3d") && (
            <div className="h-full flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg shadow">
              <div className="text-center p-12">
                <div className="text-4xl mb-4">{activeTab === "2d" ? "📐" : "🎨"}</div>
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  {activeTab === "2d" ? "2D CAD Drawings" : "3D Visualization"}
                </p>
                <p className="text-sm text-gray-500">Import drawings components separately:<br />
                  <code className="bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded text-xs">
                    {activeTab === "2d" ? "SepticSystem2DDrawings" : "SepticSystem3DView"}
                  </code>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}