import React, { useState } from "react";
import { Calculator, FileText, Download, Plus, Trash2 } from "lucide-react";

const SuperstructureTakeoffApp = () => {
  const [activeTab, setActiveTab] = useState("walls");
  const [results, setResults] = useState(null);
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
    { width: "", depth: "", height: "", count: "" },
  ]);

  const [beams, setBeams] = useState([
    { length: "", width: "", depth: "", count: "" },
  ]);

  const [slabs, setSlabs] = useState([{ area: "", thickness: "" }]);

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
      setColumns([...columns, { width: "", depth: "", height: "", count: "" }]);
    } else if (type === "beam") {
      setBeams([...beams, { length: "", width: "", depth: "", count: "" }]);
    } else if (type === "slab") {
      setSlabs([...slabs, { area: "", thickness: "" }]);
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

  const calculateQuantities = async () => {
    setLoading(true);

    try {
      // Prepare request payload
      const payload = {
        project_info: {
          project_name: projectInfo.projectName,
          project_location: projectInfo.projectLocation,
          date: projectInfo.date,
        },
        wall_data: {
          external_length: parseFloat(wallData.externalLength) || 0,
          external_width: parseFloat(wallData.externalWidth) || 0,
          wall_height: parseFloat(wallData.wallHeight) || 0,
          wall_thickness: parseFloat(wallData.wallThickness) || 0,
          internal_wall_length: parseFloat(wallData.internalWallLength) || 0,
          num_doors: parseInt(wallData.numDoors) || 0,
          door_width: parseFloat(wallData.doorWidth) || 0,
          door_height: parseFloat(wallData.doorHeight) || 0,
          num_windows: parseInt(wallData.numWindows) || 0,
          window_width: parseFloat(wallData.windowWidth) || 0,
          window_height: parseFloat(wallData.windowHeight) || 0,
          mortar_ratio: wallData.mortarRatio,
          block_type: wallData.blockType,
        },
        columns: columns
          .filter((c) => c.width && c.depth && c.height && c.count)
          .map((c) => ({
            width: parseFloat(c.width),
            depth: parseFloat(c.depth),
            height: parseFloat(c.height),
            count: parseInt(c.count),
          })),
        beams: beams
          .filter((b) => b.length && b.width && b.depth && b.count)
          .map((b) => ({
            length: parseFloat(b.length),
            width: parseFloat(b.width),
            depth: parseFloat(b.depth),
            count: parseInt(b.count),
          })),
        slabs: slabs
          .filter((s) => s.area && s.thickness)
          .map((s) => ({
            area: parseFloat(s.area),
            thickness: parseFloat(s.thickness),
          })),
        parapet: {
          has_parapet: parapet.hasParapet,
          girth: parseFloat(parapet.girth) || 0,
          height: parseFloat(parapet.height) || 0,
          thickness: parseFloat(parapet.thickness) || 0,
          has_coping: parapet.hasCoping,
          coping_width: parseFloat(parapet.copingWidth) || 0,
          coping_thickness: parseFloat(parapet.copingThickness) || 0,
        },
        rainwater: {
          has_rainwater: rainwater.hasRainwater,
          downpipe_length: parseFloat(rainwater.downpipeLength) || 0,
          num_downpipes: parseInt(rainwater.numDownpipes) || 0,
          diameter: rainwater.diameter,
          has_shoe: rainwater.hasShoe,
          shoe_length: parseFloat(rainwater.shoeLength) || 0,
        },
        common_data: {
          concrete_grade: commonData.concreteGrade,
          reinf_density: parseFloat(commonData.reinfDensity) || 120,
          formwork_type: commonData.formworkType,
          wastage: parseFloat(commonData.wastage) || 5,
        },
      };

      // Call FastAPI backend
      const response = await fetch("http://localhost:8001/api/calculate", {
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
      setResults(data.boq_items);
    } catch (error) {
      console.error("Error calculating quantities:", error);
      // Fallback to local calculation
      const calculated = performCalculations();
      setResults(calculated);
    } finally {
      setLoading(false);
    }
  };

  const performCalculations = () => {
    const results = [];

    // WALLS CALCULATION
    const extPerim =
      2 *
      (parseFloat(wallData.externalLength) +
        parseFloat(wallData.externalWidth));
    const wallThick = parseFloat(wallData.wallThickness);
    const centerlineWall =
      extPerim - 4 * wallThick + parseFloat(wallData.internalWallLength || 0);
    const wallHeight = parseFloat(wallData.wallHeight);
    const grossWallArea = centerlineWall * wallHeight;

    const doorArea =
      parseFloat(wallData.numDoors || 0) *
      parseFloat(wallData.doorWidth || 0) *
      parseFloat(wallData.doorHeight || 0);
    const windowArea =
      parseFloat(wallData.numWindows || 0) *
      parseFloat(wallData.windowWidth || 0) *
      parseFloat(wallData.windowHeight || 0);
    const netWallArea = grossWallArea - doorArea - windowArea;

    results.push({
      item: "A",
      description: `Walling in ${wallData.blockType} concrete blocks in cement mortar ${wallData.mortarRatio}`,
      unit: "m²",
      quantity: netWallArea.toFixed(2),
    });

    // COLUMNS CALCULATION
    let totalColConcrete = 0;
    let totalColFormwork = 0;
    let totalColReinf = 0;

    columns.forEach((col, idx) => {
      if (col.width && col.depth && col.height && col.count) {
        const w = parseFloat(col.width);
        const d = parseFloat(col.depth);
        const h = parseFloat(col.height);
        const count = parseFloat(col.count);

        const volume = w * d * h * count;
        const formwork = 2 * (w + d) * h * count;
        const reinf = volume * parseFloat(commonData.reinfDensity);

        totalColConcrete += volume;
        totalColFormwork += formwork;
        totalColReinf += reinf;
      }
    });

    if (totalColConcrete > 0) {
      results.push({
        item: "B.1",
        description: `Reinforced concrete in columns grade ${commonData.concreteGrade}`,
        unit: "m³",
        quantity: totalColConcrete.toFixed(3),
      });
      results.push({
        item: "B.2",
        description: `Formwork to columns type ${commonData.formworkType}`,
        unit: "m²",
        quantity: totalColFormwork.toFixed(2),
      });
      results.push({
        item: "B.3",
        description: `High tensile steel reinforcement bars to columns`,
        unit: "kg",
        quantity: totalColReinf.toFixed(1),
      });
    }

    // BEAMS CALCULATION
    let totalBeamConcrete = 0;
    let totalBeamFormwork = 0;
    let totalBeamReinf = 0;

    beams.forEach((beam) => {
      if (beam.length && beam.width && beam.depth && beam.count) {
        const l = parseFloat(beam.length);
        const w = parseFloat(beam.width);
        const d = parseFloat(beam.depth);
        const count = parseFloat(beam.count);

        const volume = l * w * d * count;
        const formwork = (2 * d + w) * l * count;
        const reinf = volume * parseFloat(commonData.reinfDensity);

        totalBeamConcrete += volume;
        totalBeamFormwork += formwork;
        totalBeamReinf += reinf;
      }
    });

    if (totalBeamConcrete > 0) {
      results.push({
        item: "C.1",
        description: `Reinforced concrete in beams grade ${commonData.concreteGrade}`,
        unit: "m³",
        quantity: totalBeamConcrete.toFixed(3),
      });
      results.push({
        item: "C.2",
        description: `Formwork to beams type ${commonData.formworkType}`,
        unit: "m²",
        quantity: totalBeamFormwork.toFixed(2),
      });
      results.push({
        item: "C.3",
        description: `High tensile steel reinforcement bars to beams`,
        unit: "kg",
        quantity: totalBeamReinf.toFixed(1),
      });
    }

    // SLABS CALCULATION
    let totalSlabConcrete = 0;
    let totalSlabFormwork = 0;
    let totalSlabReinf = 0;

    slabs.forEach((slab) => {
      if (slab.area && slab.thickness) {
        const area = parseFloat(slab.area);
        const thickness = parseFloat(slab.thickness);

        const volume = area * thickness;
        const reinf = volume * parseFloat(commonData.reinfDensity);

        totalSlabConcrete += volume;
        totalSlabFormwork += area;
        totalSlabReinf += reinf;
      }
    });

    if (totalSlabConcrete > 0) {
      results.push({
        item: "D.1",
        description: `Reinforced concrete in slabs grade ${commonData.concreteGrade}`,
        unit: "m³",
        quantity: totalSlabConcrete.toFixed(3),
      });
      results.push({
        item: "D.2",
        description: `Formwork to slab soffit type ${commonData.formworkType}`,
        unit: "m²",
        quantity: totalSlabFormwork.toFixed(2),
      });
      results.push({
        item: "D.3",
        description: `High tensile steel reinforcement bars to slabs`,
        unit: "kg",
        quantity: totalSlabReinf.toFixed(1),
      });
    }

    // PARAPET CALCULATION
    if (
      parapet.hasParapet &&
      parapet.girth &&
      parapet.height &&
      parapet.thickness
    ) {
      const parapetArea =
        parseFloat(parapet.girth) * parseFloat(parapet.height);
      results.push({
        item: "E.1",
        description: `Parapet wall in concrete blocks thickness ${parapet.thickness}m`,
        unit: "m²",
        quantity: parapetArea.toFixed(2),
      });

      if (parapet.hasCoping && parapet.copingWidth && parapet.copingThickness) {
        const copingVol =
          parseFloat(parapet.girth) *
          parseFloat(parapet.copingWidth) *
          parseFloat(parapet.copingThickness);
        results.push({
          item: "E.2",
          description: `Precast concrete coping to parapet`,
          unit: "m³",
          quantity: copingVol.toFixed(3),
        });
      }
    }

    // RAINWATER GOODS
    if (
      rainwater.hasRainwater &&
      rainwater.downpipeLength &&
      rainwater.numDownpipes
    ) {
      const totalPipeLength =
        parseFloat(rainwater.downpipeLength) *
        parseFloat(rainwater.numDownpipes);
      results.push({
        item: "F.1",
        description: `PVC downpipes diameter ${rainwater.diameter}mm`,
        unit: "m",
        quantity: totalPipeLength.toFixed(2),
      });
      results.push({
        item: "F.2",
        description: `Rainwater outlets diameter ${rainwater.diameter}mm`,
        unit: "No",
        quantity: rainwater.numDownpipes,
      });

      if (rainwater.hasShoe && rainwater.shoeLength) {
        results.push({
          item: "F.3",
          description: `Shoes to downpipes`,
          unit: "No",
          quantity: rainwater.numDownpipes,
        });
      }
    }

    return results;
  };

  const exportToCSV = () => {
    if (!results) return;

    const headers = ["Item", "Description", "Unit", "Quantity"];
    const csvContent = [
      `Project: ${projectInfo.projectName}`,
      `Location: ${projectInfo.projectLocation}`,
      `Date: ${projectInfo.date}`,
      "",
      headers.join(","),
      ...results.map(
        (r) => `${r.item},"${r.description}",${r.unit},${r.quantity}`
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BOQ_${projectInfo.projectName || "Project"}_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Calculator className="w-8 h-8 text-gray-700" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Superstructure Quantity Takeoff
                </h1>
                <p className="text-sm text-gray-600">
                  Professional BOQ Calculator for Civil Engineers
                </p>
              </div>
            </div>
            <FileText className="w-6 h-6 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Project Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Project Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Project Name"
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              value={projectInfo.projectName}
              onChange={(e) =>
                setProjectInfo({ ...projectInfo, projectName: e.target.value })
              }
            />
            <input
              type="text"
              placeholder="Project Location"
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              value={projectInfo.projectLocation}
              onChange={(e) =>
                setProjectInfo({
                  ...projectInfo,
                  projectLocation: e.target.value,
                })
              }
            />
            <input
              type="date"
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              value={projectInfo.date}
              onChange={(e) =>
                setProjectInfo({ ...projectInfo, date: e.target.value })
              }
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {["walls", "columns", "beams", "slabs", "others", "settings"].map(
                (tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-4 px-6 text-sm font-medium border-b-2 ${
                      activeTab === tab
                        ? "border-gray-900 text-gray-900"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                )
              )}
            </nav>
          </div>

          <div className="p-6">
            {/* WALLS TAB */}
            {activeTab === "walls" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Wall Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      External Length (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 12.50"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                      value={wallData.externalLength}
                      onChange={(e) =>
                        setWallData({
                          ...wallData,
                          externalLength: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      External Width (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 8.00"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                      value={wallData.externalWidth}
                      onChange={(e) =>
                        setWallData({
                          ...wallData,
                          externalWidth: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Wall Height (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 3.00"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                      value={wallData.wallHeight}
                      onChange={(e) =>
                        setWallData({ ...wallData, wallHeight: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Wall Thickness (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 0.15"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                      value={wallData.wallThickness}
                      onChange={(e) =>
                        setWallData({
                          ...wallData,
                          wallThickness: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Internal Wall Length (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 15.00"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                      value={wallData.internalWallLength}
                      onChange={(e) =>
                        setWallData({
                          ...wallData,
                          internalWallLength: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Block Type
                    </label>
                    <select
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                      value={wallData.blockType}
                      onChange={(e) =>
                        setWallData({ ...wallData, blockType: e.target.value })
                      }
                    >
                      <option>4 inch</option>
                      <option>6 inch</option>
                      <option>9 inch</option>
                    </select>
                  </div>
                </div>

                <h4 className="text-md font-semibold text-gray-900 mt-6 mb-3">
                  Openings
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Number of Doors
                    </label>
                    <input
                      type="number"
                      placeholder="e.g., 4"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                      value={wallData.numDoors}
                      onChange={(e) =>
                        setWallData({ ...wallData, numDoors: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Door Width (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 0.90"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                      value={wallData.doorWidth}
                      onChange={(e) =>
                        setWallData({ ...wallData, doorWidth: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Door Height (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 2.10"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                      value={wallData.doorHeight}
                      onChange={(e) =>
                        setWallData({ ...wallData, doorHeight: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Number of Windows
                    </label>
                    <input
                      type="number"
                      placeholder="e.g., 8"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                      value={wallData.numWindows}
                      onChange={(e) =>
                        setWallData({ ...wallData, numWindows: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Window Width (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 1.20"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                      value={wallData.windowWidth}
                      onChange={(e) =>
                        setWallData({
                          ...wallData,
                          windowWidth: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Window Height (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 1.20"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                      value={wallData.windowHeight}
                      onChange={(e) =>
                        setWallData({
                          ...wallData,
                          windowHeight: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* COLUMNS TAB */}
            {activeTab === "columns" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Column Details
                  </h3>
                  <button
                    onClick={() => addItem("column")}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Column</span>
                  </button>
                </div>
                {columns.map((col, idx) => (
                  <div
                    key={idx}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium text-gray-900">
                        Column {idx + 1}
                      </h4>
                      {columns.length > 1 && (
                        <button
                          onClick={() => removeItem("column", idx)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Width (m)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.30"
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                          value={col.width}
                          onChange={(e) => {
                            const newCols = [...columns];
                            newCols[idx].width = e.target.value;
                            setColumns(newCols);
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Depth (m)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.30"
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                          value={col.depth}
                          onChange={(e) => {
                            const newCols = [...columns];
                            newCols[idx].depth = e.target.value;
                            setColumns(newCols);
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Height (m)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="3.00"
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                          value={col.height}
                          onChange={(e) => {
                            const newCols = [...columns];
                            newCols[idx].height = e.target.value;
                            setColumns(newCols);
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Count
                        </label>
                        <input
                          type="number"
                          placeholder="4"
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                          value={col.count}
                          onChange={(e) => {
                            const newCols = [...columns];
                            newCols[idx].count = e.target.value;
                            setColumns(newCols);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* BEAMS TAB */}
            {activeTab === "beams" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Beam Details
                  </h3>
                  <button
                    onClick={() => addItem("beam")}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Beam</span>
                  </button>
                </div>
                {beams.map((beam, idx) => (
                  <div
                    key={idx}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium text-gray-900">
                        Beam {idx + 1}
                      </h4>
                      {beams.length > 1 && (
                        <button
                          onClick={() => removeItem("beam", idx)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Length (m)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="5.00"
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                          value={beam.length}
                          onChange={(e) => {
                            const newBeams = [...beams];
                            newBeams[idx].length = e.target.value;
                            setBeams(newBeams);
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Width (m)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.30"
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                          value={beam.width}
                          onChange={(e) => {
                            const newBeams = [...beams];
                            newBeams[idx].width = e.target.value;
                            setBeams(newBeams);
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Depth (m)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.45"
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                          value={beam.depth}
                          onChange={(e) => {
                            const newBeams = [...beams];
                            newBeams[idx].depth = e.target.value;
                            setBeams(newBeams);
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Count
                        </label>
                        <input
                          type="number"
                          placeholder="6"
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                          value={beam.count}
                          onChange={(e) => {
                            const newBeams = [...beams];
                            newBeams[idx].count = e.target.value;
                            setBeams(newBeams);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SLABS TAB */}
            {activeTab === "slabs" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Slab Details
                  </h3>
                  <button
                    onClick={() => addItem("slab")}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Slab</span>
                  </button>
                </div>
                {slabs.map((slab, idx) => (
                  <div
                    key={idx}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium text-gray-900">
                        Slab {idx + 1}
                      </h4>
                      {slabs.length > 1 && (
                        <button
                          onClick={() => removeItem("slab", idx)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Area (m²)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="100.00"
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                          value={slab.area}
                          onChange={(e) => {
                            const newSlabs = [...slabs];
                            newSlabs[idx].area = e.target.value;
                            setSlabs(newSlabs);
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Thickness (m)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.15"
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                          value={slab.thickness}
                          onChange={(e) => {
                            const newSlabs = [...slabs];
                            newSlabs[idx].thickness = e.target.value;
                            setSlabs(newSlabs);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* OTHERS TAB (Parapet & Rainwater) */}
            {activeTab === "others" && (
              <div className="space-y-6">
                {/* Parapet Section */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <input
                      type="checkbox"
                      checked={parapet.hasParapet}
                      onChange={(e) =>
                        setParapet({ ...parapet, hasParapet: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Parapet Wall
                    </h3>
                  </div>
                  {parapet.hasParapet && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Girth (m)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="41.00"
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                            value={parapet.girth}
                            onChange={(e) =>
                              setParapet({ ...parapet, girth: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Height (m)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.90"
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                            value={parapet.height}
                            onChange={(e) =>
                              setParapet({ ...parapet, height: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Thickness (m)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.10"
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                            value={parapet.thickness}
                            onChange={(e) =>
                              setParapet({
                                ...parapet,
                                thickness: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={parapet.hasCoping}
                          onChange={(e) =>
                            setParapet({
                              ...parapet,
                              hasCoping: e.target.checked,
                            })
                          }
                          className="w-4 h-4"
                        />
                        <label className="text-sm font-medium text-gray-700">
                          Include Coping
                        </label>
                      </div>
                      {parapet.hasCoping && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Coping Width (m)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.20"
                              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                              value={parapet.copingWidth}
                              onChange={(e) =>
                                setParapet({
                                  ...parapet,
                                  copingWidth: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Coping Thickness (m)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.05"
                              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                              value={parapet.copingThickness}
                              onChange={(e) =>
                                setParapet({
                                  ...parapet,
                                  copingThickness: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Rainwater Section */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <input
                      type="checkbox"
                      checked={rainwater.hasRainwater}
                      onChange={(e) =>
                        setRainwater({
                          ...rainwater,
                          hasRainwater: e.target.checked,
                        })
                      }
                      className="w-4 h-4"
                    />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Rainwater Goods
                    </h3>
                  </div>
                  {rainwater.hasRainwater && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Downpipe Length (m)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="3.50"
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                            value={rainwater.downpipeLength}
                            onChange={(e) =>
                              setRainwater({
                                ...rainwater,
                                downpipeLength: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Number of Downpipes
                          </label>
                          <input
                            type="number"
                            placeholder="4"
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                            value={rainwater.numDownpipes}
                            onChange={(e) =>
                              setRainwater({
                                ...rainwater,
                                numDownpipes: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Diameter (mm)
                          </label>
                          <select
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                            value={rainwater.diameter}
                            onChange={(e) =>
                              setRainwater({
                                ...rainwater,
                                diameter: e.target.value,
                              })
                            }
                          >
                            <option value="75">75mm</option>
                            <option value="100">100mm</option>
                            <option value="150">150mm</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={rainwater.hasShoe}
                          onChange={(e) =>
                            setRainwater({
                              ...rainwater,
                              hasShoe: e.target.checked,
                            })
                          }
                          className="w-4 h-4"
                        />
                        <label className="text-sm font-medium text-gray-700">
                          Include Shoes
                        </label>
                      </div>
                      {rainwater.hasShoe && (
                        <div className="w-full md:w-1/3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Shoe Length (m)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.60"
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                            value={rainwater.shoeLength}
                            onChange={(e) =>
                              setRainwater({
                                ...rainwater,
                                shoeLength: e.target.value,
                              })
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === "settings" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Material Specifications
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Concrete Grade
                    </label>
                    <select
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                      value={commonData.concreteGrade}
                      onChange={(e) =>
                        setCommonData({
                          ...commonData,
                          concreteGrade: e.target.value,
                        })
                      }
                    >
                      <option>C20 (1:2:4)</option>
                      <option>C25 (1:1.5:3)</option>
                      <option>C30 (1:1:2)</option>
                      <option>C35</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reinforcement Density (kg/m³)
                    </label>
                    <input
                      type="number"
                      placeholder="120"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                      value={commonData.reinfDensity}
                      onChange={(e) =>
                        setCommonData({
                          ...commonData,
                          reinfDensity: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Formwork Type
                    </label>
                    <select
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                      value={commonData.formworkType}
                      onChange={(e) =>
                        setCommonData({
                          ...commonData,
                          formworkType: e.target.value,
                        })
                      }
                    >
                      <option>F1 - Basic finish</option>
                      <option>F2 - Fair finish</option>
                      <option>F3 - Smooth finish</option>
                      <option>F4 - Architectural finish</option>
                      <option>F5 - Special finish</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Wastage (%)
                    </label>
                    <input
                      type="number"
                      placeholder="5"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400"
                      value={commonData.wastage}
                      onChange={(e) =>
                        setCommonData({
                          ...commonData,
                          wastage: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Calculate Button */}
        <div className="flex justify-center mb-6">
          <button
            onClick={calculateQuantities}
            disabled={loading}
            className="flex items-center space-x-2 px-8 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md"
          >
            <Calculator className="w-5 h-5" />
            <span>{loading ? "Calculating..." : "Calculate Quantities"}</span>
          </button>
        </div>

        {/* Results Table */}
        {results && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">
                BILL OF QUANTITIES
              </h2>
              <button
                onClick={exportToCSV}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 text-sm"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-20">
                      Item
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider w-24">
                      Unit
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider w-32">
                      Quantity
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {row.item}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {row.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">
                        {row.unit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                        {row.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-600">
                Project:{" "}
                <span className="font-medium">
                  {projectInfo.projectName || "Untitled Project"}
                </span>{" "}
                | Location:{" "}
                <span className="font-medium">
                  {projectInfo.projectLocation || "Not specified"}
                </span>{" "}
                | Date: <span className="font-medium">{projectInfo.date}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperstructureTakeoffApp;
