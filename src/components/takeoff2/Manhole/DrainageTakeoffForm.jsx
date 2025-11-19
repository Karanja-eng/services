import React, { useState } from "react";
import axios from "axios";

const DrainageTakeoffForm = ({ onCalculationComplete }) => {
  const [projectData, setProjectData] = useState({
    project_name: "",
    veg_depth: 0.15,
    has_rock: false,
    rock_start_depth: 0,
    has_planking: false,
    ground_is_level: true,
    site_clearance_area: 0,
    boundary_area: 0,
    road_reinstatement_area: 0,
    pavement_reinstatement_area: 0,
    manholes: [],
    pipes: [],
  });

  const [currentManhole, setCurrentManhole] = useState({
    id: "",
    type: "rect",
    internal_length: 1.5,
    internal_width: 1.5,
    internal_diameter: 1.2,
    invert_level: -2.0,
    ground_level: 0.0,
    bed_thickness: 0.15,
    wall_thickness: 0.15,
    wall_material: "concrete",
    projection_thickness: 0.1,
    slab_thickness: 0.1,
    benching_avg_height: 0.2,
    has_benching: true,
    plaster_thickness: 0.012,
    has_plaster: true,
    cover_length: 0.6,
    cover_width: 0.6,
    cover_type: "heavy_duty",
    has_channel: true,
    channel_length: 1.5,
    has_step_irons: true,
    quantity: 1,
    position_x: 0,
    position_y: 0,
  });

  const [currentPipe, setCurrentPipe] = useState({
    id: "",
    from_point: "",
    to_point: "",
    length: 20.0,
    diameter_mm: 150,
    pipe_material: "upvc",
    trench_depth_start: 1.0,
    trench_depth_end: 1.2,
    trench_width: 0.6,
    bedding_type: "granular",
    surround_thickness: 0.15,
    gradient: 1.0,
    quantity: 1,
  });

  const [activeTab, setActiveTab] = useState("project");
  const [loading, setLoading] = useState(false);

  const addManhole = () => {
    if (!currentManhole.id) {
      alert("Please enter a Manhole ID");
      return;
    }
    setProjectData((prev) => ({
      ...prev,
      manholes: [...prev.manholes, { ...currentManhole }],
    }));
    setCurrentManhole((prev) => ({
      ...prev,
      id: `MH${projectData.manholes.length + 2}`,
      position_y: prev.position_y + 20,
    }));
  };

  const removeManhole = (id) => {
    setProjectData((prev) => ({
      ...prev,
      manholes: prev.manholes.filter((mh) => mh.id !== id),
    }));
  };

  const addPipe = () => {
    if (!currentPipe.id || !currentPipe.from_point || !currentPipe.to_point) {
      alert("Please enter Pipe ID, From and To points");
      return;
    }
    setProjectData((prev) => ({
      ...prev,
      pipes: [...prev.pipes, { ...currentPipe }],
    }));
    setCurrentPipe((prev) => ({
      ...prev,
      id: `P${projectData.pipes.length + 2}`,
    }));
  };

  const removePipe = (id) => {
    setProjectData((prev) => ({
      ...prev,
      pipes: prev.pipes.filter((p) => p.id !== id),
    }));
  };

  const handleCalculate = async () => {
    if (projectData.manholes.length === 0) {
      alert("Please add at least one manhole");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        "http://localhost:8000/calculate",
        projectData
      );
      onCalculationComplete(response.data);
    } catch (error) {
      console.error("Calculation error:", error);
      alert(
        "Error calculating takeoff: " +
          (error.response?.data?.detail || error.message)
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        Drainage Takeoff Calculator
      </h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {["project", "manholes", "pipes", "ancillary"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-medium capitalize ${
              activeTab === tab
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Project Details Tab */}
      {activeTab === "project" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Project Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Name
              </label>
              <input
                type="text"
                value={projectData.project_name}
                onChange={(e) =>
                  setProjectData((prev) => ({
                    ...prev,
                    project_name: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter project name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vegetable Soil Depth (m)
              </label>
              <input
                type="number"
                step="0.01"
                value={projectData.veg_depth}
                onChange={(e) =>
                  setProjectData((prev) => ({
                    ...prev,
                    veg_depth: parseFloat(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Site Clearance Area (m²)
              </label>
              <input
                type="number"
                step="0.01"
                value={projectData.site_clearance_area}
                onChange={(e) =>
                  setProjectData((prev) => ({
                    ...prev,
                    site_clearance_area: parseFloat(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={projectData.has_rock}
                  onChange={(e) =>
                    setProjectData((prev) => ({
                      ...prev,
                      has_rock: e.target.checked,
                    }))
                  }
                  className="mr-2 h-4 w-4 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">
                  Extra over for rock
                </span>
              </label>
            </div>

            {projectData.has_rock && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rock starts at depth from GL (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={projectData.rock_start_depth}
                  onChange={(e) =>
                    setProjectData((prev) => ({
                      ...prev,
                      rock_start_depth: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={projectData.has_planking}
                  onChange={(e) =>
                    setProjectData((prev) => ({
                      ...prev,
                      has_planking: e.target.checked,
                    }))
                  }
                  className="mr-2 h-4 w-4 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">
                  Planking/Strutting/Dewatering
                </span>
              </label>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={projectData.ground_is_level}
                  onChange={(e) =>
                    setProjectData((prev) => ({
                      ...prev,
                      ground_is_level: e.target.checked,
                    }))
                  }
                  className="mr-2 h-4 w-4 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">
                  Ground is level
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Manholes Tab */}
      {activeTab === "manholes" && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Manhole Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Manhole ID
              </label>
              <input
                type="text"
                value={currentManhole.id}
                onChange={(e) =>
                  setCurrentManhole((prev) => ({ ...prev, id: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., MH1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={currentManhole.type}
                onChange={(e) =>
                  setCurrentManhole((prev) => ({
                    ...prev,
                    type: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="rect">Rectangular</option>
                <option value="square">Square</option>
                <option value="circ">Circular</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Wall Material
              </label>
              <select
                value={currentManhole.wall_material}
                onChange={(e) =>
                  setCurrentManhole((prev) => ({
                    ...prev,
                    wall_material: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="concrete">Concrete</option>
                <option value="stone">Stone Masonry</option>
                <option value="precast">Precast Rings</option>
              </select>
            </div>

            {currentManhole.type === "circ" ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Internal Diameter (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={currentManhole.internal_diameter}
                  onChange={(e) =>
                    setCurrentManhole((prev) => ({
                      ...prev,
                      internal_diameter: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Internal Length (m)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={currentManhole.internal_length}
                    onChange={(e) =>
                      setCurrentManhole((prev) => ({
                        ...prev,
                        internal_length: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Internal Width (m)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={currentManhole.internal_width}
                    onChange={(e) =>
                      setCurrentManhole((prev) => ({
                        ...prev,
                        internal_width: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ground Level (m)
              </label>
              <input
                type="number"
                step="0.1"
                value={currentManhole.ground_level}
                onChange={(e) =>
                  setCurrentManhole((prev) => ({
                    ...prev,
                    ground_level: parseFloat(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invert Level (m)
              </label>
              <input
                type="number"
                step="0.1"
                value={currentManhole.invert_level}
                onChange={(e) =>
                  setCurrentManhole((prev) => ({
                    ...prev,
                    invert_level: parseFloat(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bed Thickness (m)
              </label>
              <input
                type="number"
                step="0.01"
                value={currentManhole.bed_thickness}
                onChange={(e) =>
                  setCurrentManhole((prev) => ({
                    ...prev,
                    bed_thickness: parseFloat(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Wall Thickness (m)
              </label>
              <input
                type="number"
                step="0.01"
                value={currentManhole.wall_thickness}
                onChange={(e) =>
                  setCurrentManhole((prev) => ({
                    ...prev,
                    wall_thickness: parseFloat(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slab Thickness (m)
              </label>
              <input
                type="number"
                step="0.01"
                value={currentManhole.slab_thickness}
                onChange={(e) =>
                  setCurrentManhole((prev) => ({
                    ...prev,
                    slab_thickness: parseFloat(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cover Size (L x W) m
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  step="0.1"
                  value={currentManhole.cover_length}
                  onChange={(e) =>
                    setCurrentManhole((prev) => ({
                      ...prev,
                      cover_length: parseFloat(e.target.value),
                    }))
                  }
                  className="w-1/2 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="L"
                />
                <input
                  type="number"
                  step="0.1"
                  value={currentManhole.cover_width}
                  onChange={(e) =>
                    setCurrentManhole((prev) => ({
                      ...prev,
                      cover_width: parseFloat(e.target.value),
                    }))
                  }
                  className="w-1/2 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="W"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position X (m)
              </label>
              <input
                type="number"
                step="1"
                value={currentManhole.position_x}
                onChange={(e) =>
                  setCurrentManhole((prev) => ({
                    ...prev,
                    position_x: parseFloat(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position Y (m)
              </label>
              <input
                type="number"
                step="1"
                value={currentManhole.position_y}
                onChange={(e) =>
                  setCurrentManhole((prev) => ({
                    ...prev,
                    position_y: parseFloat(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={currentPipe.quantity}
                onChange={(e) =>
                  setCurrentPipe((prev) => ({
                    ...prev,
                    quantity: parseInt(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-3">
              <button
                onClick={addPipe}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
              >
                Add Pipe Run
              </button>
            </div>
          </div>

          {/* Pipes List */}
          {projectData.pipes.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">
                Added Pipes
              </h3>
              <div className="space-y-2">
                {projectData.pipes.map((pipe, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded"
                  >
                    <span className="font-medium">{pipe.id}</span>
                    <span className="text-sm text-gray-600">
                      {pipe.from_point} → {pipe.to_point} | Ø{pipe.diameter_mm}
                      mm | {pipe.length}m | {pipe.pipe_material.toUpperCase()}
                    </span>
                    <button
                      onClick={() => removePipe(pipe.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ancillary Works Tab */}
      {activeTab === "ancillary" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Ancillary Works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Boundary Area (m²)
              </label>
              <input
                type="number"
                step="0.01"
                value={projectData.boundary_area}
                onChange={(e) =>
                  setProjectData((prev) => ({
                    ...prev,
                    boundary_area: parseFloat(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Road Reinstatement Area (m²)
              </label>
              <input
                type="number"
                step="0.01"
                value={projectData.road_reinstatement_area}
                onChange={(e) =>
                  setProjectData((prev) => ({
                    ...prev,
                    road_reinstatement_area: parseFloat(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pavement Reinstatement Area (m²)
              </label>
              <input
                type="number"
                step="0.01"
                value={projectData.pavement_reinstatement_area}
                onChange={(e) =>
                  setProjectData((prev) => ({
                    ...prev,
                    pavement_reinstatement_area: parseFloat(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
            <h3 className="font-semibold text-blue-900 mb-2">
              Note on Ancillary Works
            </h3>
            <p className="text-sm text-blue-800">
              These items cover reinstatement works required after drainage
              installation, including:
            </p>
            <ul className="list-disc list-inside text-sm text-blue-800 mt-2 space-y-1">
              <li>
                Road and carriageway reinstatement with appropriate surfacing
              </li>
              <li>Pavement and footway reinstatement</li>
              <li>Kerb replacement and realignment</li>
              <li>Boundary fence or wall restoration if affected</li>
            </ul>
          </div>
        </div>
      )}

      {/* Calculate Button */}
      <div className="mt-8 flex justify-end space-x-4">
        <button
          onClick={() => {
            if (window.confirm("Are you sure you want to clear all data?")) {
              setProjectData({
                project_name: "",
                veg_depth: 0.15,
                has_rock: false,
                rock_start_depth: 0,
                has_planking: false,
                ground_is_level: true,
                site_clearance_area: 0,
                boundary_area: 0,
                road_reinstatement_area: 0,
                pavement_reinstatement_area: 0,
                manholes: [],
                pipes: [],
              });
            }
          }}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
        >
          Clear All
        </button>

        <button
          onClick={handleCalculate}
          disabled={loading}
          className={`px-8 py-3 rounded font-semibold transition ${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {loading ? "Calculating..." : "Calculate Takeoff"}
        </button>
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-gray-50 rounded">
        <h3 className="font-semibold text-gray-700 mb-2">Project Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Manholes:</span>
            <span className="ml-2 font-semibold">
              {projectData.manholes.length}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Pipe Runs:</span>
            <span className="ml-2 font-semibold">
              {projectData.pipes.length}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Total Pipe Length:</span>
            <span className="ml-2 font-semibold">
              {projectData.pipes
                .reduce((sum, p) => sum + p.length * p.quantity, 0)
                .toFixed(1)}
              m
            </span>
          </div>
          <div>
            <span className="text-gray-600">Status:</span>
            <span className="ml-2 font-semibold text-green-600">
              {projectData.manholes.length > 0 ? "Ready" : "Add manholes"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrainageTakeoffForm;
