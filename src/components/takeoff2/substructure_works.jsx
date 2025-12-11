import React, { useState } from "react";
import {
  Calculator,
  FileText,
  Building2,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const SubstructureTakeoffApp = () => {
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
    wall_thick: "",
    veg_depth: "",
    trench_depth: "",
    reduce_level_depth: "",
    conc_thick_strip: "",
    hardcore_thick: "",
    blinding_thick: "",
    dpm_thick: "",
    anti_termite: false,
    has_formwork: false,
    has_reinforce: false,
    rebar_len: "",
    clear_extra: "",
    reinstate_width: "0.4",
    backfill_reuse_factor: "0.5",
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedSections, setExpandedSections] = useState({
    plan: true,
    walls: false,
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

  const handleSubmit = async () => {
    setLoading(true);
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
        reinstate_width: parseFloat(formData.reinstate_width) || 0.4,
        backfill_reuse_factor:
          parseFloat(formData.backfill_reuse_factor) || 0.5,
      };

      // Replace with your FastAPI backend URL
      const response = await fetch("http://localhost:8000/api/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Calculation failed");
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError("Failed to calculate. Please check your inputs and try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!results) return;

    const headers = ["Item No.", "Description", "Quantity", "Unit", "Remarks"];
    const rows = results.takeoff_items.map((item) => [
      item.item_no,
      item.description,
      item.quantity,
      item.unit,
      item.remarks,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "substructure_takeoff.csv";
    a.click();
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-gray-700" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Substructure Quantity Takeoff
              </h1>
              <p className="text-gray-600">
                Professional civil engineering calculations and BOQ generation
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Calculator className="w-6 h-6" />
              Input Parameters
            </h2>

            <div className="space-y-4">
              {/* Plan Details Section */}
              <div className="space-y-3">
                <SectionHeader
                  title="Plan Details"
                  section="plan"
                  icon={Building2}
                />
                {expandedSections.plan && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <SelectField
                      label="Plan Type"
                      name="plan_type"
                      options={[
                        { value: "rectangle", label: "Rectangle" },
                        { value: "semi-circle", label: "Semi-Circle" },
                        { value: "complex", label: "Complex" },
                      ]}
                    />
                    <InputField
                      label="External Length"
                      name="ext_length"
                      unit="m"
                    />
                    <InputField
                      label="External Width"
                      name="ext_width"
                      unit="m"
                    />
                    <InputField
                      label="Extra Clearance"
                      name="clear_extra"
                      unit="m"
                    />
                  </div>
                )}
              </div>

              {/* Walls Section */}
              <div className="space-y-3">
                <SectionHeader
                  title="Wall Configuration"
                  section="walls"
                  icon={FileText}
                />
                {expandedSections.walls && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputField
                        label="Wall Thickness"
                        name="wall_thick"
                        unit="m"
                      />
                      <div className="flex items-end">
                        <CheckboxField
                          label="Has Internal Walls"
                          name="has_internal_walls"
                        />
                      </div>
                    </div>
                    {formData.has_internal_walls && (
                      <InputField
                        label="Internal Wall Length"
                        name="int_wall_len"
                        unit="m"
                      />
                    )}
                    <div className="flex items-center gap-4">
                      <CheckboxField
                        label="Cavity Wall"
                        name="has_cavity_wall"
                      />
                    </div>
                    {formData.has_cavity_wall && (
                      <InputField
                        label="Cavity Thickness"
                        name="cavity_thick"
                        unit="m"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Features Section */}
              <div className="space-y-3">
                <SectionHeader
                  title="Additional Features"
                  section="features"
                  icon={Building2}
                />
                {expandedSections.features && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-3">
                      <CheckboxField label="Has Columns" name="has_columns" />
                      {formData.has_columns && (
                        <div className="grid grid-cols-2 gap-4 pl-6">
                          <InputField
                            label="Number of Columns"
                            name="num_columns"
                            step="1"
                          />
                          <InputField
                            label="Column Size"
                            name="col_size"
                            unit="m"
                          />
                          <InputField
                            label="Column Base Size"
                            name="col_base_size"
                            unit="m"
                          />
                          <InputField
                            label="Column Excavation Depth"
                            name="col_excav_depth"
                            unit="m"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <CheckboxField
                        label="Has Recess/Void"
                        name="has_recess"
                      />
                      {formData.has_recess && (
                        <div className="grid grid-cols-2 gap-4 pl-6">
                          <SelectField
                            label="Recess Type"
                            name="recess_type"
                            options={[
                              { value: "corner", label: "Corner" },
                              { value: "center", label: "Center" },
                              { value: "bay", label: "Bay" },
                            ]}
                          />
                          <div />
                          <InputField
                            label="Recess Length"
                            name="recess_len"
                            unit="m"
                          />
                          <InputField
                            label="Recess Width"
                            name="recess_wid"
                            unit="m"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Depths & Thicknesses */}
              <div className="space-y-3">
                <SectionHeader
                  title="Depths & Thicknesses"
                  section="depths"
                  icon={FileText}
                />
                {expandedSections.depths && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <InputField
                      label="Vegetable Soil Depth"
                      name="veg_depth"
                      unit="m"
                    />
                    <InputField
                      label="Trench Depth"
                      name="trench_depth"
                      unit="m"
                    />
                    <InputField
                      label="Reduce Level Depth"
                      name="reduce_level_depth"
                      unit="m"
                    />
                    <InputField
                      label="Strip Concrete Thickness"
                      name="conc_thick_strip"
                      unit="m"
                    />
                    <InputField
                      label="Hardcore Thickness"
                      name="hardcore_thick"
                      unit="m"
                    />
                    <InputField
                      label="Blinding Thickness"
                      name="blinding_thick"
                      unit="m"
                    />
                    <InputField
                      label="DPM Thickness"
                      name="dpm_thick"
                      unit="mm"
                    />
                  </div>
                )}
              </div>

              {/* Additional Options */}
              <div className="space-y-3">
                <SectionHeader
                  title="Additional Options"
                  section="additional"
                  icon={FileText}
                />
                {expandedSections.additional && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <CheckboxField
                        label="Anti-Termite Treatment"
                        name="anti_termite"
                      />
                      <CheckboxField
                        label="Formwork Required"
                        name="has_formwork"
                      />
                      <CheckboxField
                        label="Reinforcement Required"
                        name="has_reinforce"
                      />
                    </div>
                    {formData.has_reinforce && (
                      <InputField
                        label="Total Rebar Length"
                        name="rebar_len"
                        unit="m"
                      />
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <InputField
                        label="Reinstate Width"
                        name="reinstate_width"
                        unit="m"
                      />
                      <InputField
                        label="Backfill Reuse Factor"
                        name="backfill_reuse_factor"
                        step="0.1"
                      />
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-gray-700 hover:bg-gray-800 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Calculating...
                  </>
                ) : (
                  <>
                    <Calculator className="w-5 h-5" />
                    Calculate Quantities
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FileText className="w-6 h-6" />
                Bill of Quantities
              </h2>
              {results && (
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              )}
            </div>

            {!results ? (
              <div className="flex flex-col items-center justify-center h-96 text-gray-400">
                <FileText className="w-16 h-16 mb-4" />
                <p className="text-lg">
                  Enter parameters and calculate to see results
                </p>
              </div>
            ) : (
              <div className="space-y-6 max-h-[800px] overflow-y-auto">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(results.summary).map(([key, value]) => (
                    <div
                      key={key}
                      className="bg-gray-50 p-4 rounded-lg border border-gray-200"
                    >
                      <p className="text-xs text-gray-600 uppercase tracking-wide">
                        {key.replace(/_/g, " ")}
                      </p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">
                        {value.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Takeoff Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-white">
                      <tr className="bg-gray-200 border-b-2 border-gray-300">
                        <th className="text-left p-3 font-semibold text-gray-700 border-r border-gray-300">
                          Item No.
                        </th>
                        <th className="text-left p-3 font-semibold text-gray-700 border-r border-gray-300">
                          Description
                        </th>
                        <th className="text-right p-3 font-semibold text-gray-700 border-r border-gray-300">
                          Qty
                        </th>
                        <th className="text-center p-3 font-semibold text-gray-700 border-r border-gray-300">
                          Unit
                        </th>
                        <th className="text-left p-3 font-semibold text-gray-700">
                          Remarks
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.takeoff_items.map((item, index) => (
                        <tr
                          key={index}
                          className={`border-b border-gray-200 ${
                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                          }`}
                        >
                          <td className="p-3 text-sm font-medium text-gray-700 border-r border-gray-200">
                            {item.item_no}
                          </td>
                          <td className="p-3 text-sm text-gray-700 border-r border-gray-200">
                            {item.description}
                          </td>
                          <td className="p-3 text-sm text-right font-semibold text-gray-800 border-r border-gray-200">
                            {item.quantity}
                          </td>
                          <td className="p-3 text-sm text-center text-gray-600 border-r border-gray-200">
                            {item.unit}
                          </td>
                          <td className="p-3 text-sm text-gray-600">
                            {item.remarks}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubstructureTakeoffApp;
