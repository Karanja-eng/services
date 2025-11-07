import React, { useState } from "react";
import {
  Calculator,
  Wrench,
  AlertCircle,
  CheckCircle,
  Info,
} from "lucide-react";

const BoltedConnectionsModule = () => {
  const [activeBoltType, setActiveBoltType] = useState("ordinary");
  const [results, setResults] = useState(null);

  // Ordinary Bolts State
  const [ordinaryBolt, setOrdinaryBolt] = useState({
    bolt_diameter: 20,
    bolt_grade: "8.8",
    num_bolts: 4,
    shear_plane: "single",
    thread_condition: "threads_in_shear_plane",
    applied_shear: 100,
    applied_tension: 0,
    plate_thickness: 12,
    plate_grade: "S275",
    edge_distance: 50,
  });

  // HSFG Bolts State
  const [hsfgBolt, setHsfgBolt] = useState({
    bolt_diameter: 20,
    bolt_grade: "HSFG_8.8",
    num_bolts: 6,
    shear_plane: "single",
    applied_shear: 150,
    plate_thickness: 15,
    surface_condition: "normal",
  });

  // Bolt Group State
  const [boltGroup, setBoltGroup] = useState({
    bolt_diameter: 20,
    bolt_grade: "8.8",
    num_bolts_x: 2,
    num_bolts_y: 3,
    spacing_x: 75,
    spacing_y: 75,
    applied_force: 200,
    eccentricity_x: 0,
    eccentricity_y: 100,
    thread_condition: "threads_in_shear_plane",
    plate_thickness: 12,
    plate_grade: "S275",
  });

  const calculateOrdinaryBolts = async () => {
    try {
      const response = await fetch(
        "http://localhost:8001/api/bolted-connections/ordinary-bolts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ordinaryBolt),
        }
      );
      const data = await response.json();
      setResults({ type: "ordinary", data });
    } catch (error) {
      console.error("Error:", error);
      alert("Calculation failed. Make sure the backend is running.");
    }
  };

  const calculateHsfgBolts = async () => {
    try {
      const response = await fetch(
        "http://localhost:8000/api/bolted-connections/hsfg-bolts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(hsfgBolt),
        }
      );
      const data = await response.json();
      setResults({ type: "hsfg", data });
    } catch (error) {
      console.error("Error:", error);
      alert("Calculation failed. Make sure the backend is running.");
    }
  };

  const calculateBoltGroup = async () => {
    try {
      // Generate bolt positions
      const positions = [];
      for (let i = 0; i < boltGroup.num_bolts_y; i++) {
        for (let j = 0; j < boltGroup.num_bolts_x; j++) {
          positions.push([j * boltGroup.spacing_x, i * boltGroup.spacing_y]);
        }
      }

      const requestData = {
        bolt_diameter: boltGroup.bolt_diameter,
        bolt_grade: boltGroup.bolt_grade,
        bolt_positions: positions,
        applied_force: boltGroup.applied_force,
        eccentricity_x: boltGroup.eccentricity_x,
        eccentricity_y: boltGroup.eccentricity_y,
        thread_condition: boltGroup.thread_condition,
        plate_thickness: boltGroup.plate_thickness,
        plate_grade: boltGroup.plate_grade,
      };

      const response = await fetch(
        "http://localhost:8000/api/bolted-connections/bolt-group",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestData),
        }
      );
      const data = await response.json();
      setResults({ type: "group", data });
    } catch (error) {
      console.error("Error:", error);
      alert("Calculation failed. Make sure the backend is running.");
    }
  };

  const renderOrdinaryBoltsForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Bolt Diameter (mm)
          </label>
          <select
            value={ordinaryBolt.bolt_diameter}
            onChange={(e) =>
              setOrdinaryBolt({
                ...ordinaryBolt,
                bolt_diameter: parseInt(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="12">M12</option>
            <option value="16">M16</option>
            <option value="20">M20</option>
            <option value="24">M24</option>
            <option value="27">M27</option>
            <option value="30">M30</option>
            <option value="36">M36</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Bolt Grade
          </label>
          <select
            value={ordinaryBolt.bolt_grade}
            onChange={(e) =>
              setOrdinaryBolt({ ...ordinaryBolt, bolt_grade: e.target.value })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="4.6">Grade 4.6 (General)</option>
            <option value="8.8">Grade 8.8 (High Strength)</option>
            <option value="10.9">Grade 10.9 (Very High)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Number of Bolts
          </label>
          <input
            type="number"
            value={ordinaryBolt.num_bolts}
            onChange={(e) =>
              setOrdinaryBolt({
                ...ordinaryBolt,
                num_bolts: parseInt(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            min="1"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Shear Plane
          </label>
          <select
            value={ordinaryBolt.shear_plane}
            onChange={(e) =>
              setOrdinaryBolt({ ...ordinaryBolt, shear_plane: e.target.value })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="single">Single Shear</option>
            <option value="double">Double Shear</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Thread Condition
          </label>
          <select
            value={ordinaryBolt.thread_condition}
            onChange={(e) =>
              setOrdinaryBolt({
                ...ordinaryBolt,
                thread_condition: e.target.value,
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="threads_in_shear_plane">
              Threads in Shear Plane
            </option>
            <option value="threads_excluded">Threads Excluded</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Applied Shear (kN)
          </label>
          <input
            type="number"
            value={ordinaryBolt.applied_shear}
            onChange={(e) =>
              setOrdinaryBolt({
                ...ordinaryBolt,
                applied_shear: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-green-200className="
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Applied Tension (kN)
          </label>
          <input
            type="number"
            value={ordinaryBolt.applied_tension}
            onChange={(e) =>
              setOrdinaryBolt({
                ...ordinaryBolt,
                applied_tension: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Plate Thickness (mm)
          </label>
          <input
            type="number"
            value={ordinaryBolt.plate_thickness}
            onChange={(e) =>
              setOrdinaryBolt({
                ...ordinaryBolt,
                plate_thickness: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            step="0.5"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Plate Grade
          </label>
          <select
            value={ordinaryBolt.plate_grade}
            onChange={(e) =>
              setOrdinaryBolt({ ...ordinaryBolt, plate_grade: e.target.value })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="S275">S275</option>
            <option value="S355">S355</option>
            <option value="S450">S450</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Edge Distance (mm)
          </label>
          <input
            type="number"
            value={ordinaryBolt.edge_distance}
            onChange={(e) =>
              setOrdinaryBolt({
                ...ordinaryBolt,
                edge_distance: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            step="1"
          />
        </div>
      </div>

      <button
        onClick={calculateOrdinaryBolts}
        className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-green-700 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
      >
        <Calculator size={20} />
        Calculate Ordinary Bolts
      </button>
    </div>
  );

  const renderHsfgBoltsForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Bolt Diameter (mm)
          </label>
          <select
            value={hsfgBolt.bolt_diameter}
            onChange={(e) =>
              setHsfgBolt({
                ...hsfgBolt,
                bolt_diameter: parseInt(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="16">M16</option>
            <option value="20">M20</option>
            <option value="24">M24</option>
            <option value="27">M27</option>
            <option value="30">M30</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            HSFG Bolt Grade
          </label>
          <select
            value={hsfgBolt.bolt_grade}
            onChange={(e) =>
              setHsfgBolt({ ...hsfgBolt, bolt_grade: e.target.value })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="HSFG_8.8">HSFG 8.8</option>
            <option value="HSFG_10.9">HSFG 10.9</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Number of Bolts
          </label>
          <input
            type="number"
            value={hsfgBolt.num_bolts}
            onChange={(e) =>
              setHsfgBolt({ ...hsfgBolt, num_bolts: parseInt(e.target.value) })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            min="1"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Shear Plane
          </label>
          <select
            value={hsfgBolt.shear_plane}
            onChange={(e) =>
              setHsfgBolt({ ...hsfgBolt, shear_plane: e.target.value })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="single">Single Shear</option>
            <option value="double">Double Shear</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Applied Shear (kN)
          </label>
          <input
            type="number"
            value={hsfgBolt.applied_shear}
            onChange={(e) =>
              setHsfgBolt({
                ...hsfgBolt,
                applied_shear: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Plate Thickness (mm)
          </label>
          <input
            type="number"
            value={hsfgBolt.plate_thickness}
            onChange={(e) =>
              setHsfgBolt({
                ...hsfgBolt,
                plate_thickness: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            step="0.5"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Surface Condition
          </label>
          <select
            value={hsfgBolt.surface_condition}
            onChange={(e) =>
              setHsfgBolt({ ...hsfgBolt, surface_condition: e.target.value })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="normal">Normal (μ = 0.3)</option>
            <option value="wire_brushed">Wire Brushed (μ = 0.4)</option>
            <option value="blast_cleaned">Blast Cleaned (μ = 0.5)</option>
          </select>
        </div>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <p className="text-sm text-blue-800">
          <strong>HSFG Bolts:</strong> High Strength Friction Grip bolts are
          designed for slip-critical connections. The friction factor (μ)
          depends on surface preparation.
        </p>
      </div>

      <button
        onClick={calculateHsfgBolts}
        className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-green-700 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
      >
        <Calculator size={20} />
        Calculate HSFG Bolts
      </button>
    </div>
  );

  const renderBoltGroupForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Bolt Diameter (mm)
          </label>
          <select
            value={boltGroup.bolt_diameter}
            onChange={(e) =>
              setBoltGroup({
                ...boltGroup,
                bolt_diameter: parseInt(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="16">M16</option>
            <option value="20">M20</option>
            <option value="24">M24</option>
            <option value="27">M27</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Bolt Grade
          </label>
          <select
            value={boltGroup.bolt_grade}
            onChange={(e) =>
              setBoltGroup({ ...boltGroup, bolt_grade: e.target.value })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="8.8">Grade 8.8</option>
            <option value="10.9">Grade 10.9</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Bolts in X-Direction
          </label>
          <input
            type="number"
            value={boltGroup.num_bolts_x}
            onChange={(e) =>
              setBoltGroup({
                ...boltGroup,
                num_bolts_x: parseInt(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            min="1"
            max="10"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Bolts in Y-Direction
          </label>
          <input
            type="number"
            value={boltGroup.num_bolts_y}
            onChange={(e) =>
              setBoltGroup({
                ...boltGroup,
                num_bolts_y: parseInt(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            min="1"
            max="10"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Spacing X (mm)
          </label>
          <input
            type="number"
            value={boltGroup.spacing_x}
            onChange={(e) =>
              setBoltGroup({
                ...boltGroup,
                spacing_x: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            step="5"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Spacing Y (mm)
          </label>
          <input
            type="number"
            value={boltGroup.spacing_y}
            onChange={(e) =>
              setBoltGroup({
                ...boltGroup,
                spacing_y: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
            step="5"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Applied Force (kN)
          </label>
          <input
            type="number"
            value={boltGroup.applied_force}
            onChange={(e) =>
              setBoltGroup({
                ...boltGroup,
                applied_force: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Eccentricity X (mm)
          </label>
          <input
            type="number"
            value={boltGroup.eccentricity_x}
            onChange={(e) =>
              setBoltGroup({
                ...boltGroup,
                eccentricity_x: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
            step="5"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Eccentricity Y (mm)
          </label>
          <input
            type="number"
            value={boltGroup.eccentricity_y}
            onChange={(e) =>
              setBoltGroup({
                ...boltGroup,
                eccentricity_y: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
            step="5"
          />
        </div>
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
        <p className="text-sm text-yellow-800">
          <strong>Eccentric Loading:</strong> When force is applied away from
          the bolt group centroid, additional moment creates varying loads on
          individual bolts.
        </p>
      </div>

      <button
        onClick={calculateBoltGroup}
        className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-green-700 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
      >
        <Calculator size={20} />
        Analyze Bolt Group
      </button>
    </div>
  );

  const renderResults = () => {
    if (!results) return null;

    if (results.type === "ordinary") {
      const data = results.data;
      return (
        <div className="mt-8 bg-white rounded-lg shadow-xl p-6 border-2 border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <Wrench className="text-blue-600" size={28} />
            <h3 className="text-2xl font-bold text-gray-800">
              Ordinary Bolts Results
            </h3>
          </div>

          <div
            className={`p-4 rounded-lg mb-6 ${
              data.passed
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
                className={`text-lg font-bold ${
                  data.passed ? "text-green-700" : "text-red-700"
                }`}
              >
                {data.passed ? "CONNECTION ADEQUATE" : "CONNECTION INADEQUATE"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-bold text-lg text-blue-700 border-b-2 border-blue-200 pb-2">
                Bolt Properties
              </h4>
              <div className="space-y-2">
                <p>
                  <span className="font-semibold">Diameter:</span> M
                  {data.bolt_diameter}
                </p>
                <p>
                  <span className="font-semibold">Grade:</span>{" "}
                  {data.bolt_grade}
                </p>
                <p>
                  <span className="font-semibold">Number of Bolts:</span>{" "}
                  {data.num_bolts}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-lg text-green-700 border-b-2 border-green-200 pb-2">
                Applied Forces
              </h4>
              <div className="space-y-2">
                <p>
                  <span className="font-semibold">Applied Shear:</span>{" "}
                  {data.applied_shear} kN
                </p>
                <p>
                  <span className="font-semibold">Applied Tension:</span>{" "}
                  {data.applied_tension} kN
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-lg text-blue-700 border-b-2 border-blue-200 pb-2">
                Capacities per Bolt
              </h4>
              <div className="space-y-2">
                <p>
                  <span className="font-semibold">Shear:</span>{" "}
                  {data.shear_capacity_per_bolt} kN
                </p>
                <p>
                  <span className="font-semibold">Tension:</span>{" "}
                  {data.tension_capacity_per_bolt} kN
                </p>
                <p>
                  <span className="font-semibold">Bearing:</span>{" "}
                  {data.bearing_capacity_per_bolt} kN
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-lg text-green-700 border-b-2 border-green-200 pb-2">
                Total Capacities
              </h4>
              <div className="space-y-2">
                <p>
                  <span className="font-semibold">Shear:</span>{" "}
                  {data.total_shear_capacity} kN
                </p>
                <p>
                  <span className="font-semibold">Tension:</span>{" "}
                  {data.total_tension_capacity} kN
                </p>
                <p>
                  <span className="font-semibold">Bearing:</span>{" "}
                  {data.total_bearing_capacity} kN
                </p>
              </div>
            </div>

            <div className="col-span-2 space-y-3">
              <h4 className="font-bold text-lg text-gray-700 border-b-2 border-gray-200 pb-2">
                Utilization Ratios
              </h4>

              <div>
                <p className="font-semibold mb-1">
                  Shear: {data.shear_utilization}%
                </p>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className={`h-4 rounded-full ${
                      data.shear_utilization > 100
                        ? "bg-red-600"
                        : data.shear_utilization > 90
                        ? "bg-yellow-600"
                        : "bg-green-600"
                    }`}
                    style={{
                      width: `${Math.min(data.shear_utilization, 100)}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <p className="font-semibold mb-1">
                  Tension: {data.tension_utilization}%
                </p>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className={`h-4 rounded-full ${
                      data.tension_utilization > 100
                        ? "bg-red-600"
                        : data.tension_utilization > 90
                        ? "bg-yellow-600"
                        : "bg-green-600"
                    }`}
                    style={{
                      width: `${Math.min(data.tension_utilization, 100)}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <p className="font-semibold mb-1">
                  Interaction: {data.interaction_ratio}%
                </p>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className={`h-4 rounded-full ${
                      data.interaction_ratio > 100
                        ? "bg-red-600"
                        : data.interaction_ratio > 90
                        ? "bg-yellow-600"
                        : "bg-green-600"
                    }`}
                    style={{
                      width: `${Math.min(data.interaction_ratio, 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
            <p className="text-sm text-blue-800">
              <strong>Reference:</strong> BS 5950-1:2000 Section 6.3 - Design of
              ordinary bolted connections
            </p>
          </div>
        </div>
      );
    }

    if (results.type === "hsfg") {
      const data = results.data;
      return (
        <div className="mt-8 bg-white rounded-lg shadow-xl p-6 border-2 border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <Wrench className="text-blue-600" size={28} />
            <h3 className="text-2xl font-bold text-gray-800">
              HSFG Bolts Results
            </h3>
          </div>

          <div
            className={`p-4 rounded-lg mb-6 ${
              data.passed
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
                className={`text-lg font-bold ${
                  data.passed ? "text-green-700" : "text-red-700"
                }`}
              >
                {data.passed ? "CONNECTION ADEQUATE" : "CONNECTION INADEQUATE"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p>
                <span className="font-semibold">Bolt Diameter:</span> M
                {data.bolt_diameter}
              </p>
              <p>
                <span className="font-semibold">Number of Bolts:</span>{" "}
                {data.num_bolts}
              </p>
              <p>
                <span className="font-semibold">Clamping Force:</span>{" "}
                {data.clamping_force} kN
              </p>
            </div>

            <div className="space-y-2">
              <p>
                <span className="font-semibold">Slip Resistance/Bolt:</span>{" "}
                {data.slip_resistance_per_bolt} kN
              </p>
              <p>
                <span className="font-semibold">Total Slip Resistance:</span>{" "}
                {data.total_slip_resistance} kN
              </p>
              <p>
                <span className="font-semibold">Applied Shear:</span>{" "}
                {data.applied_shear} kN
              </p>
            </div>

            <div className="col-span-2">
              <h4 className="font-bold text-lg text-gray-700 border-b-2 border-gray-200 pb-2 mb-3">
                Utilization Ratio
              </h4>
              <div className="w-full bg-gray-200 rounded-full h-6">
                <div
                  className={`h-6 rounded-full flex items-center justify-center text-white font-semibold ${
                    data.utilization_ratio > 100
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
              <strong>Reference:</strong> BS 5950-1:2000 Section 6.4 - Design of
              HSFG bolt connections
            </p>
          </div>
        </div>
      );
    }

    if (results.type === "group") {
      const data = results.data;
      return (
        <div className="mt-8 bg-white rounded-lg shadow-xl p-6 border-2 border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <Wrench className="text-blue-600" size={28} />
            <h3 className="text-2xl font-bold text-gray-800">
              Bolt Group Analysis
            </h3>
          </div>

          <div
            className={`p-4 rounded-lg mb-6 ${
              data.passed
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
                className={`text-lg font-bold ${
                  data.passed ? "text-green-700" : "text-red-700"
                }`}
              >
                {data.passed ? "BOLT GROUP ADEQUATE" : "BOLT GROUP INADEQUATE"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p>
                <span className="font-semibold">Number of Bolts:</span>{" "}
                {data.num_bolts}
              </p>
              <p>
                <span className="font-semibold">Centroid X:</span>{" "}
                {data.centroid_x} mm
              </p>
              <p>
                <span className="font-semibold">Centroid Y:</span>{" "}
                {data.centroid_y} mm
              </p>
            </div>

            <div className="space-y-2">
              <p>
                <span className="font-semibold">Applied Moment:</span>{" "}
                {data.moment} kN·mm
              </p>
              <p>
                <span className="font-semibold">Max Bolt Force:</span>{" "}
                {data.max_bolt_force} kN
              </p>
              <p>
                <span className="font-semibold">Bolt Capacity:</span>{" "}
                {data.bolt_capacity} kN
              </p>
            </div>

            <div className="col-span-2">
              <h4 className="font-bold text-lg text-gray-700 border-b-2 border-gray-200 pb-2 mb-3">
                Critical Bolt Utilization
              </h4>
              <div className="w-full bg-gray-200 rounded-full h-6">
                <div
                  className={`h-6 rounded-full flex items-center justify-center text-white font-semibold ${
                    data.utilization_ratio > 100
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
              <p className="text-sm text-gray-600 mt-2">
                Critical bolt at position: ({data.critical_bolt_position[0]},{" "}
                {data.critical_bolt_position[1]}) mm
              </p>
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
        <Wrench className="text-blue-600" size={32} />
        <h2 className="text-3xl font-bold text-gray-800">
          Bolted Connections Design
        </h2>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg border-2 border-blue-200">
        <div className="flex items-start gap-2">
          <Info className="text-blue-600 mt-1" size={20} />
          <p className="text-sm text-gray-700">
            <strong>BS 5950-1:2000 Sections 6.2-6.4:</strong> Design of bolted
            connections including ordinary bolts, HSFG (High Strength Friction
            Grip) bolts, and eccentric bolt groups with comprehensive capacity
            checks.
          </p>
        </div>
      </div>

      {/* Bolt Type Selector */}
      <div className="flex gap-2 flex-wrap">
        {["ordinary", "hsfg", "group"].map((type) => (
          <button
            key={type}
            onClick={() => {
              setActiveBoltType(type);
              setResults(null);
            }}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeBoltType === type
                ? "bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-lg"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {type === "ordinary" && "Ordinary Bolts"}
            {type === "hsfg" && "HSFG Bolts"}
            {type === "group" && "Bolt Group"}
          </button>
        ))}
      </div>

      {/* Forms */}
      <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200">
        {activeBoltType === "ordinary" && renderOrdinaryBoltsForm()}
        {activeBoltType === "hsfg" && renderHsfgBoltsForm()}
        {activeBoltType === "group" && renderBoltGroupForm()}
      </div>

      {/* Results */}
      {renderResults()}
    </div>
  );
};

export default BoltedConnectionsModule;
