import React, { useState } from "react";
import { Calculator, Zap, AlertCircle, CheckCircle, Info } from "lucide-react";

const WeldedJointsModule = () => {
  const [activeWeldType, setActiveWeldType] = useState("fillet");
  const [results, setResults] = useState(null);

  // Fillet Weld State
  const [filletWeld, setFilletWeld] = useState({
    throat_size: 6,
    weld_length: 150,
    longitudinal_force: 50,
    transverse_force: 0,
    electrode_grade: "E42",
    parent_steel_grade: "S275",
    position: "longitudinal",
  });

  // Butt Weld State
  const [buttWeld, setButtWeld] = useState({
    weld_type: "butt_full_penetration",
    throat_size: 10,
    weld_length: 200,
    applied_force: 100,
    parent_steel_grade: "S275",
    electrode_grade: "E42",
    stress_type: "tension",
  });

  // Lap Joint State
  const [lapJoint, setLapJoint] = useState({
    throat_size: 6,
    weld_length: 100,
    applied_load: 75,
    eccentricity: 0,
    electrode_grade: "E42",
    parent_steel_grade: "S275",
  });

  // T-Joint State
  const [teeJoint, setTeeJoint] = useState({
    throat_size: 8,
    weld_length: 150,
    vertical_load: 50,
    horizontal_load: 30,
    moment: 0,
    electrode_grade: "E42",
    parent_steel_grade: "S275",
  });

  const calculateFilletWeld = async () => {
    try {
      const response = await fetch(
        "http://localhost:8001/api/welded-joints/fillet-weld",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(filletWeld),
        }
      );
      const data = await response.json();
      setResults({ type: "fillet", data });
    } catch (error) {
      console.error("Error:", error);
      alert("Calculation failed. Make sure the backend is running.");
    }
  };

  const calculateButtWeld = async () => {
    try {
      const response = await fetch(
        "http://localhost:8000/api/welded-joints/butt-weld",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buttWeld),
        }
      );
      const data = await response.json();
      setResults({ type: "butt", data });
    } catch (error) {
      console.error("Error:", error);
      alert("Calculation failed. Make sure the backend is running.");
    }
  };

  const calculateLapJoint = async () => {
    try {
      const response = await fetch(
        "http://localhost:8000/api/welded-joints/lap-joint",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lapJoint),
        }
      );
      const data = await response.json();
      setResults({ type: "lap", data });
    } catch (error) {
      console.error("Error:", error);
      alert("Calculation failed. Make sure the backend is running.");
    }
  };

  const calculateTeeJoint = async () => {
    try {
      const response = await fetch(
        "http://localhost:8000/api/welded-joints/tee-joint",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(teeJoint),
        }
      );
      const data = await response.json();
      setResults({ type: "tee", data });
    } catch (error) {
      console.error("Error:", error);
      alert("Calculation failed. Make sure the backend is running.");
    }
  };

  // Define renderFilletWeldForm
  const renderFilletWeldForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Throat Size (mm)
          </label>
          <input
            type="number"
            value={filletWeld.throat_size}
            onChange={(e) =>
              setFilletWeld({
                ...filletWeld,
                throat_size: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            step="0.5"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Weld Length (mm)
          </label>
          <input
            type="number"
            value={filletWeld.weld_length}
            onChange={(e) =>
              setFilletWeld({
                ...filletWeld,
                weld_length: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Longitudinal Force (kN)
          </label>
          <input
            type="number"
            value={filletWeld.longitudinal_force}
            onChange={(e) =>
              setFilletWeld({
                ...filletWeld,
                longitudinal_force: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Transverse Force (kN)
          </label>
          <input
            type="number"
            value={filletWeld.transverse_force}
            onChange={(e) =>
              setFilletWeld({
                ...filletWeld,
                transverse_force: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Weld Position
          </label>
          <select
            value={filletWeld.position}
            onChange={(e) =>
              setFilletWeld({ ...filletWeld, position: e.target.value })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="longitudinal">Longitudinal</option>
            <option value="transverse">Transverse</option>
            <option value="combined">Combined</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Electrode Grade
          </label>
          <select
            value={filletWeld.electrode_grade}
            onChange={(e) =>
              setFilletWeld({ ...filletWeld, electrode_grade: e.target.value })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="E35">E35 (350 N/mm²)</option>
            <option value="E42">E42 (420 N/mm²)</option>
            <option value="E51">E51 (510 N/mm²)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Parent Steel Grade
          </label>
          <select
            value={filletWeld.parent_steel_grade}
            onChange={(e) =>
              setFilletWeld({
                ...filletWeld,
                parent_steel_grade: e.target.value,
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="S275">S275</option>
            <option value="S355">S355</option>
            <option value="S450">S450</option>
          </select>
        </div>
      </div>

      <button
        onClick={calculateFilletWeld}
        className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-green-700 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
      >
        <Calculator size={20} />
        Calculate Fillet Weld
      </button>
    </div>
  );

  // Define renderButtWeldForm
  const renderButtWeldForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Weld Type
          </label>
          <select
            value={buttWeld.weld_type}
            onChange={(e) =>
              setButtWeld({ ...buttWeld, weld_type: e.target.value })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="butt_full_penetration">Full Penetration</option>
            <option value="butt_partial_penetration">
              Partial Penetration
            </option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Throat Size (mm)
          </label>
          <input
            type="number"
            value={buttWeld.throat_size}
            onChange={(e) =>
              setButtWeld({
                ...buttWeld,
                throat_size: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            step="0.5"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Weld Length (mm)
          </label>
          <input
            type="number"
            value={buttWeld.weld_length}
            onChange={(e) =>
              setButtWeld({
                ...buttWeld,
                weld_length: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Applied Force (kN)
          </label>
          <input
            type="number"
            value={buttWeld.applied_force}
            onChange={(e) =>
              setButtWeld({
                ...buttWeld,
                applied_force: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Stress Type
          </label>
          <select
            value={buttWeld.stress_type}
            onChange={(e) =>
              setButtWeld({ ...buttWeld, stress_type: e.target.value })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="tension">Tension</option>
            <option value="compression">Compression</option>
            <option value="shear">Shear</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Electrode Grade
          </label>
          <select
            value={buttWeld.electrode_grade}
            onChange={(e) =>
              setButtWeld({ ...buttWeld, electrode_grade: e.target.value })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="E35">E35 (350 N/mm²)</option>
            <option value="E42">E42 (420 N/mm²)</option>
            <option value="E51">E51 (510 N/mm²)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Parent Steel Grade
          </label>
          <select
            value={buttWeld.parent_steel_grade}
            onChange={(e) =>
              setButtWeld({ ...buttWeld, parent_steel_grade: e.target.value })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="S275">S275</option>
            <option value="S355">S355</option>
            <option value="S450">S450</option>
          </select>
        </div>
      </div>

      <button
        onClick={calculateButtWeld}
        className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-green-700 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
      >
        <Calculator size={20} />
        Calculate Butt Weld
      </button>
    </div>
  );

  const renderLapJointForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Throat Size (mm)
          </label>
          <input
            type="number"
            value={lapJoint.throat_size}
            onChange={(e) =>
              setLapJoint({
                ...lapJoint,
                throat_size: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            step="0.5"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Weld Length (mm) - Each Side
          </label>
          <input
            type="number"
            value={lapJoint.weld_length}
            onChange={(e) =>
              setLapJoint({
                ...lapJoint,
                weld_length: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Applied Load (kN)
          </label>
          <input
            type="number"
            value={lapJoint.applied_load}
            onChange={(e) =>
              setLapJoint({
                ...lapJoint,
                applied_load: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Eccentricity (mm)
          </label>
          <input
            type="number"
            value={lapJoint.eccentricity}
            onChange={(e) =>
              setLapJoint({
                ...lapJoint,
                eccentricity: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Electrode Grade
          </label>
          <select
            value={lapJoint.electrode_grade}
            onChange={(e) =>
              setLapJoint({ ...lapJoint, electrode_grade: e.target.value })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="E35">E35 (350 N/mm²)</option>
            <option value="E42">E42 (420 N/mm²)</option>
            <option value="E51">E51 (510 N/mm²)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Parent Steel Grade
          </label>
          <select
            value={lapJoint.parent_steel_grade}
            onChange={(e) =>
              setLapJoint({ ...lapJoint, parent_steel_grade: e.target.value })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="S275">S275</option>
            <option value="S355">S355</option>
            <option value="S450">S450</option>
          </select>
        </div>
      </div>

      <button
        onClick={calculateLapJoint}
        className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-green-700 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
      >
        <Calculator size={20} />
        Calculate Lap Joint
      </button>
    </div>
  );

  const renderTeeJointForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Throat Size (mm)
          </label>
          <input
            type="number"
            value={teeJoint.throat_size}
            onChange={(e) =>
              setTeeJoint({
                ...teeJoint,
                throat_size: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            step="0.5"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Weld Length (mm)
          </label>
          <input
            type="number"
            value={teeJoint.weld_length}
            onChange={(e) =>
              setTeeJoint({
                ...teeJoint,
                weld_length: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Vertical Load (kN)
          </label>
          <input
            type="number"
            value={teeJoint.vertical_load}
            onChange={(e) =>
              setTeeJoint({
                ...teeJoint,
                vertical_load: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Horizontal Load (kN)
          </label>
          <input
            type="number"
            value={teeJoint.horizontal_load}
            onChange={(e) =>
              setTeeJoint({
                ...teeJoint,
                horizontal_load: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Applied Moment (kNm)
          </label>
          <input
            type="number"
            value={teeJoint.moment}
            onChange={(e) =>
              setTeeJoint({ ...teeJoint, moment: parseFloat(e.target.value) })
            }
            className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Electrode Grade
          </label>
          <select
            value={teeJoint.electrode_grade}
            onChange={(e) =>
              setTeeJoint({ ...teeJoint, electrode_grade: e.target.value })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="E35">E35 (350 N/mm²)</option>
            <option value="E42">E42 (420 N/mm²)</option>
            <option value="E51">E51 (510 N/mm²)</option>
          </select>
        </div>
      </div>

      <button
        onClick={calculateTeeJoint}
        className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-green-700 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
      >
        <Calculator size={20} />
        Calculate T-Joint
      </button>
    </div>
  );

  const renderResults = () => {
    if (!results) return null;

    if (results.type === "fillet" || results.type === "butt") {
      const data = results.data;
      return (
        <div className="mt-8 bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 border-2 border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-6">
            <Zap className="text-blue-600" size={28} />
            <h3 className="text-2xl font-bold text-gray-800 dark:text-slate-100">
              Design Results - {data.weld_type}
            </h3>
          </div>

          <div
            className={`p-4 rounded-lg mb-6 ${data.passed
              ? "bg-green-50 border-2 border-green-500"
              : "bg-red-50 border-2 border-red-500"
              }`}
          >
            <div className="flex items-center gap-2">
              {data.passed ? (
                <CheckCircle className="text-green-600" size={24} />
              ) : (
                <AlertCircle className="text-red-600" size={24} />
              )}
              <span
                className={`text-lg font-bold ${data.passed ? "text-green-700" : "text-red-700"
                  }`}
              >
                {data.passed ? "WELD ADEQUATE" : "WELD INADEQUATE"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-bold text-lg text-blue-700 border-b-2 border-blue-200 pb-2">
                Weld Properties
              </h4>
              <div className="space-y-2">
                <p>
                  <span className="font-semibold">Throat Size:</span>{" "}
                  {data.throat_size} mm
                </p>
                <p>
                  <span className="font-semibold">Weld Length:</span>{" "}
                  {data.weld_length} mm
                </p>
                <p>
                  <span className="font-semibold">Design Strength (pw):</span>{" "}
                  {data.design_strength_pw} N/mm²
                </p>
                <p>
                  <span className="font-semibold">Applied Stress:</span>{" "}
                  {data.applied_stress} N/mm²
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-lg text-green-700 border-b-2 border-green-200 pb-2">
                Capacities
              </h4>
              <div className="space-y-2">
                <p>
                  <span className="font-semibold">Longitudinal Capacity:</span>{" "}
                  {data.longitudinal_capacity} kN
                </p>
                <p>
                  <span className="font-semibold">Transverse Capacity:</span>{" "}
                  {data.transverse_capacity} kN
                </p>
                <p>
                  <span className="font-semibold">Design Capacity:</span>{" "}
                  {data.design_capacity} kN
                </p>
                <p>
                  <span className="font-semibold">Safety Factor:</span>{" "}
                  {data.safety_factor}
                </p>
              </div>
            </div>

            <div className="col-span-2">
              <h4 className="font-bold text-lg text-gray-700 dark:text-slate-300 border-b-2 border-gray-200 dark:border-slate-700 pb-2 mb-3">
                Utilization Ratio
              </h4>
              <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-6">
                <div
                  className={`h-6 rounded-full flex items-center justify-center text-white font-semibold text-sm ${data.utilization_ratio > 100
                    ? "bg-red-600"
                    : data.utilization_ratio > 90
                      ? "bg-yellow-600"
                      : "bg-green-600"
                    }`}
                  style={{ width: `${Math.min(data.utilization_ratio, 100)}%` }}
                >
                  {data.utilization_ratio}%
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
            <p className="text-sm text-blue-800">
              <strong>Reference:</strong> BS 5950-1:2000 Section 6.9 - Design of
              welded connections
            </p>
          </div>
        </div>
      );
    }

    if (results.type === "lap") {
      const data = results.data;
      return (
        <div className="mt-8 bg-white rounded-lg shadow-xl p-6 border-2 border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-6">
            <Zap className="text-blue-600" size={28} />
            <h3 className="text-2xl font-bold text-gray-800 dark:text-slate-100">
              Lap Joint Results
            </h3>
          </div>

          <div
            className={`p-4 rounded-lg mb-6 ${data.passed
              ? "bg-green-50 border-2 border-green-500"
              : "bg-red-50 border-2 border-red-500"
              }`}
          >
            <div className="flex items-center gap-2">
              {data.passed ? (
                <CheckCircle className="text-green-600" size={24} />
              ) : (
                <AlertCircle className="text-red-600" size={24} />
              )}
              <span
                className={`text-lg font-bold ${data.passed ? "text-green-700" : "text-red-700"
                  }`}
              >
                {data.passed ? "JOINT ADEQUATE" : "JOINT INADEQUATE"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p>
                <span className="font-semibold">Throat Size:</span>{" "}
                {data.throat_size} mm
              </p>
              <p>
                <span className="font-semibold">Total Weld Length:</span>{" "}
                {data.total_weld_length} mm
              </p>
              <p>
                <span className="font-semibold">Design Strength:</span>{" "}
                {data.design_strength} N/mm²
              </p>
            </div>

            <div className="space-y-2">
              <p>
                <span className="font-semibold">Direct Shear Stress:</span>{" "}
                {data.direct_shear_stress} N/mm²
              </p>
              <p>
                <span className="font-semibold">Moment Stress:</span>{" "}
                {data.moment_induced_stress} N/mm²
              </p>
              <p>
                <span className="font-semibold">Total Stress:</span>{" "}
                {data.total_stress} N/mm²
              </p>
              <p>
                <span className="font-semibold">Capacity:</span> {data.capacity}{" "}
                kN
              </p>
            </div>

            <div className="col-span-2">
              <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-6">
                <div
                  className={`h-6 rounded-full flex items-center justify-center text-white font-semibold text-sm ${data.utilization_ratio > 100 ? "bg-red-600" : "bg-green-600"
                    }`}
                  style={{ width: `${Math.min(data.utilization_ratio, 100)}%` }}
                >
                  {data.utilization_ratio}%
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (results.type === "tee") {
      const data = results.data;
      return (
        <div className="mt-8 bg-white rounded-lg shadow-xl p-6 border-2 border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-6">
            <Zap className="text-blue-600" size={28} />
            <h3 className="text-2xl font-bold text-gray-800 dark:text-slate-100">
              T-Joint Results
            </h3>
          </div>

          <div
            className={`p-4 rounded-lg mb-6 ${data.passed
              ? "bg-green-50 border-2 border-green-500"
              : "bg-red-50 border-2 border-red-500"
              }`}
          >
            <div className="flex items-center gap-2">
              {data.passed ? (
                <CheckCircle className="text-green-600" size={24} />
              ) : (
                <AlertCircle className="text-red-600" size={24} />
              )}
              <span
                className={`text-lg font-bold ${data.passed ? "text-green-700" : "text-red-700"
                  }`}
              >
                {data.passed ? "JOINT ADEQUATE" : "JOINT INADEQUATE"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p>
                <span className="font-semibold">Throat Size:</span>{" "}
                {data.throat_size} mm
              </p>
              <p>
                <span className="font-semibold">Weld Length:</span>{" "}
                {data.weld_length} mm
              </p>
              <p>
                <span className="font-semibold">Resultant Force:</span>{" "}
                {data.resultant_force} kN
              </p>
            </div>

            <div className="space-y-2">
              <p>
                <span className="font-semibold">Resultant Stress:</span>{" "}
                {data.resultant_stress} N/mm²
              </p>
              <p>
                <span className="font-semibold">Design Strength:</span>{" "}
                {data.design_strength} N/mm²
              </p>
              <p>
                <span className="font-semibold">Capacity:</span> {data.capacity}{" "}
                kN
              </p>
            </div>

            <div className="col-span-2">
              <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-6">
                <div
                  className={`h-6 rounded-full flex items-center justify-center text-white font-semibold text-sm ${data.utilization_ratio > 100 ? "bg-red-600" : "bg-green-600"
                    }`}
                  style={{ width: `${Math.min(data.utilization_ratio, 100)}%` }}
                >
                  {data.utilization_ratio}%
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Zap className="text-blue-600" size={32} />
        <h2 className="text-3xl font-bold text-gray-800 dark:text-slate-100">
          Welded Joints Design
        </h2>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg border-2 border-blue-200">
        <div className="flex items-start gap-2">
          <Info className="text-blue-600 mt-1" size={20} />
          <p className="text-sm text-gray-700 dark:text-slate-300">
            <strong>BS 5950-1:2000 Section 6.9:</strong> Design of welded
            connections including fillet welds, butt welds, lap joints, and
            T-joints. All calculations follow British Standard specifications.
          </p>
        </div>
      </div>

      {/* Weld Type Selector */}
      <div className="flex gap-2 flex-wrap">
        {["fillet", "butt", "lap", "tee"].map((type) => (
          <button
            key={type}
            onClick={() => {
              setActiveWeldType(type);
              setResults(null);
            }}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${activeWeldType === type
              ? "bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-lg"
              : "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:bg-slate-600"
              }`}
          >
            {type === "fillet" && "Fillet Weld"}
            {type === "butt" && "Butt Weld"}
            {type === "lap" && "Lap Joint"}
            {type === "tee" && "T-Joint"}
          </button>
        ))}
      </div>

      {/* Forms */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border-2 border-gray-200 dark:border-slate-700">
        {activeWeldType === "fillet" && renderFilletWeldForm()}
        {activeWeldType === "butt" && renderButtWeldForm()}
        {activeWeldType === "lap" && renderLapJointForm()}
        {activeWeldType === "tee" && renderTeeJointForm()}
      </div>

      {/* Results */}
      {renderResults()}
    </div>
  );
};

export default WeldedJointsModule;
