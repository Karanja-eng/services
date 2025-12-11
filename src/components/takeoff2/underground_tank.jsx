import React, { useState } from "react";
import {
  Calculator,
  Download,
  FileText,
  Building2,
  Droplet,
} from "lucide-react";

const UnderGroundTankComponent = () => {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const [projectDetails, setProjectDetails] = useState({
    projectName: "",
    clientName: "",
    location: "",
    date: new Date().toISOString().split("T")[0],
    engineer: "",
  });

  // Underground Tank State
  const [tankInput, setTankInput] = useState({
    tank_type: "circular",
    veg_soil: 0.15,
    working_space: 0.3,
    blinding_thick: 0.075,
    bed_thick: 0.15,
    wall_thick: 0.2,
    slab_thick: 0.15,
    plaster_thick: 0.012,
    mastic_thick: 0.02,
    brick_thick: 0.115,
    cover_to_slab: 0.3,
    num_covers: 1,
    cover_L: 0.6,
    cover_W: 0.6,
    int_diam: 3.0,
    int_L: null,
    int_W: null,
    depth_int: 2.5,
  });

  const calculateQuantities = async () => {
    setLoading(true);
    try {
      // In production: const response = await axios.post(`http://localhost:8000/api/underground-tank`, tankInput);
      const data = simulateCalculation(tankInput);
      setResults(data);
    } catch (error) {
      console.error("Calculation error:", error);
      alert("Error calculating quantities. Please check your inputs.");
    } finally {
      setLoading(false);
    }
  };

  const simulateCalculation = (input) => {
    // This simulates the backend response for underground tank calculations
    // In production, this would be replaced with actual API calls

    const baseItems = [
      {
        item_no: "1.0",
        description: "SITE CLEARANCE AND EARTHWORKS",
        unit: "",
        quantity: "",
        rate: "",
        amount: "",
      },
      {
        item_no: "1.1",
        description:
          "Clear site vegetation, grub up roots and remove topsoil average 150mm deep for preservation",
        unit: "m³",
        quantity: "12.50",
        rate: "180.00",
        amount: "2250.00",
      },
      {
        item_no: "1.2",
        description:
          "Excavate in soft soil to receive underground water tank including trimming sides and bottoms",
        unit: "m³",
        quantity: "45.80",
        rate: "420.00",
        amount: "19236.00",
      },
      {
        item_no: "1.3",
        description: "Excavate in rock to reduced level by mechanical means",
        unit: "m³",
        quantity: "8.50",
        rate: "850.00",
        amount: "7225.00",
      },
      {
        item_no: "1.4",
        description:
          "Dispose excavated material off-site at approved disposal area within 5km radius",
        unit: "m³",
        quantity: "25.30",
        rate: "320.00",
        amount: "8096.00",
      },
      {
        item_no: "",
        description: "",
        unit: "",
        quantity: "",
        rate: "",
        amount: "",
      },

      {
        item_no: "2.0",
        description: "CONCRETE WORK",
        unit: "",
        quantity: "",
        rate: "",
        amount: "",
      },
      {
        item_no: "2.1",
        description:
          "50mm thick mass concrete (1:4:8) blinding to bottom of excavation",
        unit: "m²",
        quantity: "18.50",
        rate: "650.00",
        amount: "12025.00",
      },
      {
        item_no: "2.2",
        description:
          "150mm thick reinforced concrete (1:2:4) base slab including trowel finish",
        unit: "m³",
        quantity: "2.85",
        rate: "12500.00",
        amount: "35625.00",
      },
      {
        item_no: "2.3",
        description: "200mm thick reinforced concrete (1:2:4) walls to tank",
        unit: "m³",
        quantity: "6.75",
        rate: "13500.00",
        amount: "91125.00",
      },
      {
        item_no: "2.4",
        description:
          "150mm thick reinforced concrete (1:2:4) top slab including access opening",
        unit: "m³",
        quantity: "2.40",
        rate: "12500.00",
        amount: "30000.00",
      },
      {
        item_no: "",
        description: "",
        unit: "",
        quantity: "",
        rate: "",
        amount: "",
      },

      {
        item_no: "3.0",
        description: "REINFORCEMENT",
        unit: "",
        quantity: "",
        rate: "",
        amount: "",
      },
      {
        item_no: "3.1",
        description:
          "High tensile steel reinforcement bars to BS 4449 including cutting, bending, lapping and tying",
        unit: "kg",
        quantity: "1425.00",
        rate: "185.00",
        amount: "263625.00",
      },
      {
        item_no: "3.2",
        description: "BRC fabric reinforcement A142 (2.22kg/m²) to slabs",
        unit: "m²",
        quantity: "22.50",
        rate: "450.00",
        amount: "10125.00",
      },
      {
        item_no: "",
        description: "",
        unit: "",
        quantity: "",
        rate: "",
        amount: "",
      },

      {
        item_no: "4.0",
        description: "FORMWORK",
        unit: "",
        quantity: "",
        rate: "",
        amount: "",
      },
      {
        item_no: "4.1",
        description: "Formwork class F3 to sides of base slab",
        unit: "m²",
        quantity: "3.50",
        rate: "1200.00",
        amount: "4200.00",
      },
      {
        item_no: "4.2",
        description: "Formwork class F3 to walls (fair face finish)",
        unit: "m²",
        quantity: "42.80",
        rate: "1350.00",
        amount: "57780.00",
      },
      {
        item_no: "4.3",
        description: "Formwork class F3 to top slab soffit",
        unit: "m²",
        quantity: "18.50",
        rate: "1200.00",
        amount: "22200.00",
      },
      {
        item_no: "",
        description: "",
        unit: "",
        quantity: "",
        rate: "",
        amount: "",
      },

      {
        item_no: "5.0",
        description: "WATERPROOFING AND FINISHES",
        unit: "",
        quantity: "",
        rate: "",
        amount: "",
      },
      {
        item_no: "5.1",
        description:
          "12mm thick cement sand plaster (1:4) to internal walls and ceiling",
        unit: "m²",
        quantity: "61.30",
        rate: "650.00",
        amount: "39845.00",
      },
      {
        item_no: "5.2",
        description:
          "20mm thick mastic asphalt tanking in two coats to external walls",
        unit: "m²",
        quantity: "42.80",
        rate: "1850.00",
        amount: "79180.00",
      },
      {
        item_no: "5.3",
        description: "Bituminous paint (2 coats) to internal surfaces",
        unit: "m²",
        quantity: "79.80",
        rate: "380.00",
        amount: "30324.00",
      },
      {
        item_no: "",
        description: "",
        unit: "",
        quantity: "",
        rate: "",
        amount: "",
      },

      {
        item_no: "6.0",
        description: "BACKFILLING",
        unit: "",
        quantity: "",
        rate: "",
        amount: "",
      },
      {
        item_no: "6.1",
        description:
          "Selected backfill material around tank in 150mm layers with compaction",
        unit: "m³",
        quantity: "28.50",
        rate: "580.00",
        amount: "16530.00",
      },
      {
        item_no: "6.2",
        description: "Reinstate topsoil over completed works",
        unit: "m³",
        quantity: "12.50",
        rate: "220.00",
        amount: "2750.00",
      },
      {
        item_no: "",
        description: "",
        unit: "",
        quantity: "",
        rate: "",
        amount: "",
      },

      {
        item_no: "7.0",
        description: "MANHOLES AND COVERS",
        unit: "",
        quantity: "",
        rate: "",
        amount: "",
      },
      {
        item_no: "7.1",
        description:
          "Precast concrete manhole cover and frame (600x600mm) grade A",
        unit: "no.",
        quantity: "1",
        rate: "8500.00",
        amount: "8500.00",
      },
      {
        item_no: "7.2",
        description: "Step irons built into wall at 300mm vertical spacing",
        unit: "no.",
        quantity: "8",
        rate: "850.00",
        amount: "6800.00",
      },
    ];

    return {
      summary: {
        topsoil_m3: 12.5,
        excavation_m3: 45.8,
        blinding_m2: 18.5,
        bed_m3: 2.85,
        walls_m3: 6.75,
        slab_m3: 2.4,
        formwork_m2: 64.8,
        backfill_m3: 28.5,
      },
      items: baseItems,
    };
  };

  const getSummaryForModule = (input) => {
    return {
      topsoil_m3: 12.5,
      excavation_m3: 45.8,
      blinding_m2: 18.5,
      bed_m3: 2.85,
      walls_m3: 6.75,
      slab_m3: 2.4,
      formwork_m2: 64.8,
      backfill_m3: 28.5,
    };
  };

  const exportResults = () => {
    if (!results) return;

    let csv = `BILL OF QUANTITIES - UNDERGROUND TANK\n\n`;
    csv += `Project: ${projectDetails.projectName}\n`;
    csv += `Client: ${projectDetails.clientName}\n`;
    csv += `Location: ${projectDetails.location}\n`;
    csv += `Date: ${projectDetails.date}\n`;
    csv += `Engineer: ${projectDetails.engineer}\n\n`;
    csv += "Item No.,Description,Unit,Quantity,Rate (KES),Amount (KES)\n";

    results.items.forEach((item) => {
      csv += `${item.item_no},"${item.description}",${item.unit},${item.quantity},${item.rate},${item.amount}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `underground_tank_boq_${projectDetails.date}.csv`;
    a.click();
  };

  const renderUndergroundTankForm = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tank Type
        </label>
        <select
          value={tankInput.tank_type}
          onChange={(e) =>
            setTankInput({ ...tankInput, tank_type: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400"
        >
          <option value="circular">Circular</option>
          <option value="rectangular">Rectangular</option>
        </select>
      </div>

      {tankInput.tank_type === "circular" ? (
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Internal Diameter (m)
          </label>
          <input
            type="number"
            step="0.1"
            value={tankInput.int_diam || ""}
            onChange={(e) =>
              setTankInput({
                ...tankInput,
                int_diam: parseFloat(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400"
            placeholder="3.0"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Internal Length (m)
            </label>
            <input
              type="number"
              step="0.1"
              value={tankInput.int_L || ""}
              onChange={(e) =>
                setTankInput({
                  ...tankInput,
                  int_L: parseFloat(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="4.0"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Internal Width (m)
            </label>
            <input
              type="number"
              step="0.1"
              value={tankInput.int_W || ""}
              onChange={(e) =>
                setTankInput({
                  ...tankInput,
                  int_W: parseFloat(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="3.0"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm text-gray-600 mb-1">
          Internal Depth (m)
        </label>
        <input
          type="number"
          step="0.1"
          value={tankInput.depth_int}
          onChange={(e) =>
            setTankInput({
              ...tankInput,
              depth_int: parseFloat(e.target.value),
            })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          placeholder="2.5"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Wall Thickness (m)
          </label>
          <input
            type="number"
            step="0.01"
            value={tankInput.wall_thick}
            onChange={(e) =>
              setTankInput({
                ...tankInput,
                wall_thick: parseFloat(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Base Slab Thickness (m)
          </label>
          <input
            type="number"
            step="0.01"
            value={tankInput.bed_thick}
            onChange={(e) =>
              setTankInput({
                ...tankInput,
                bed_thick: parseFloat(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Top Slab Thickness (m)
          </label>
          <input
            type="number"
            step="0.01"
            value={tankInput.slab_thick}
            onChange={(e) =>
              setTankInput({
                ...tankInput,
                slab_thick: parseFloat(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Blinding Thickness (m)
          </label>
          <input
            type="number"
            step="0.001"
            value={tankInput.blinding_thick}
            onChange={(e) =>
              setTankInput({
                ...tankInput,
                blinding_thick: parseFloat(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Working Space (m)
          </label>
          <input
            type="number"
            step="0.1"
            value={tankInput.working_space}
            onChange={(e) =>
              setTankInput({
                ...tankInput,
                working_space: parseFloat(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Topsoil Depth (m)
          </label>
          <input
            type="number"
            step="0.01"
            value={tankInput.veg_soil}
            onChange={(e) =>
              setTankInput({
                ...tankInput,
                veg_soil: parseFloat(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Number of Covers
          </label>
          <input
            type="number"
            value={tankInput.num_covers}
            onChange={(e) =>
              setTankInput({
                ...tankInput,
                num_covers: parseInt(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Cover Length (m)
          </label>
          <input
            type="number"
            step="0.1"
            value={tankInput.cover_L}
            onChange={(e) =>
              setTankInput({
                ...tankInput,
                cover_L: parseFloat(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Cover Width (m)
          </label>
          <input
            type="number"
            step="0.1"
            value={tankInput.cover_W}
            onChange={(e) =>
              setTankInput({
                ...tankInput,
                cover_W: parseFloat(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="w-8 h-8 text-gray-700" />
            <h1 className="text-3xl font-bold text-gray-800">
              Underground Infrastructure Quantity Takeoff
            </h1>
          </div>

          {/* Project Details */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-6">
            <input
              type="text"
              placeholder="Project Name"
              value={projectDetails.projectName}
              onChange={(e) =>
                setProjectDetails({
                  ...projectDetails,
                  projectName: e.target.value,
                })
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400"
            />
            <input
              type="text"
              placeholder="Client Name"
              value={projectDetails.clientName}
              onChange={(e) =>
                setProjectDetails({
                  ...projectDetails,
                  clientName: e.target.value,
                })
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400"
            />
            <input
              type="text"
              placeholder="Location"
              value={projectDetails.location}
              onChange={(e) =>
                setProjectDetails({
                  ...projectDetails,
                  location: e.target.value,
                })
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400"
            />
            <input
              type="text"
              placeholder="Engineer Name"
              value={projectDetails.engineer}
              onChange={(e) =>
                setProjectDetails({
                  ...projectDetails,
                  engineer: e.target.value,
                })
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400"
            />
            <input
              type="date"
              value={projectDetails.date}
              onChange={(e) =>
                setProjectDetails({ ...projectDetails, date: e.target.value })
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400"
            />
          </div>
        </div>

        {/* Input Form and Calculate Button */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Underground Tank Parameters
            </h2>
            {renderUndergroundTankForm()}
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Actions
            </h2>
            <button
              onClick={calculateQuantities}
              disabled={loading}
              className="w-full px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2 mb-3"
            >
              <Calculator className="w-5 h-5" />
              {loading ? "Calculating..." : "Calculate BOQ"}
            </button>

            {results && (
              <>
                <button
                  onClick={exportResults}
                  className="w-full px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Export to CSV
                </button>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Summary
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(results.summary).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {key.replace(/_/g, " ")}:
                        </span>
                        <span className="font-medium text-gray-800">
                          {value.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Results Table */}
        {results && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Bill of Quantities
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FileText className="w-4 h-4" />
                Underground Tank
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300">
                    <th className="text-left p-3 text-sm font-semibold text-gray-700 border border-gray-300 w-20">
                      Item No.
                    </th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700 border border-gray-300">
                      Description
                    </th>
                    <th className="text-center p-3 text-sm font-semibold text-gray-700 border border-gray-300 w-16">
                      Unit
                    </th>
                    <th className="text-right p-3 text-sm font-semibold text-gray-700 border border-gray-300 w-24">
                      Quantity
                    </th>
                    <th className="text-right p-3 text-sm font-semibold text-gray-700 border border-gray-300 w-28">
                      Rate (KES)
                    </th>
                    <th className="text-right p-3 text-sm font-semibold text-gray-700 border border-gray-300 w-32">
                      Amount (KES)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.items.map((item, idx) => (
                    <tr
                      key={idx}
                      className={`${
                        item.item_no.endsWith(".0")
                          ? "bg-gray-50 font-semibold"
                          : "hover:bg-gray-50"
                      } ${item.description === "" ? "h-2" : ""}`}
                    >
                      <td className="p-3 text-sm border border-gray-300">
                        {item.item_no}
                      </td>
                      <td className="p-3 text-sm border border-gray-300">
                        {item.description}
                      </td>
                      <td className="p-3 text-sm text-center border border-gray-300">
                        {item.unit}
                      </td>
                      <td className="p-3 text-sm text-right border border-gray-300">
                        {item.quantity}
                      </td>
                      <td className="p-3 text-sm text-right border border-gray-300">
                        {item.rate}
                      </td>
                      <td className="p-3 text-sm text-right border border-gray-300 font-medium">
                        {item.amount}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-200 font-bold border-t-2 border-gray-400">
                    <td
                      colSpan="5"
                      className="p-3 text-right border border-gray-300"
                    >
                      TOTAL
                    </td>
                    <td className="p-3 text-right border border-gray-300">
                      {results.items
                        .filter(
                          (item) =>
                            item.amount && !isNaN(parseFloat(item.amount))
                        )
                        .reduce((sum, item) => sum + parseFloat(item.amount), 0)
                        .toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnderGroundTankComponent;
