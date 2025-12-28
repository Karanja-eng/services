import React, { useState } from "react";
import {
  Calculator,
  Download,
  Building2,
} from "lucide-react";
import axios from "axios";
import EnglishMethodTakeoffSheet from "./ExternalWorks/EnglishMethodTakeoffSheet";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from './universal_component';

const UnderGroundTankComponent = () => {
  const [activeTab, setActiveTab] = useState("calculator");
  const [takeoffData, setTakeoffData] = useState([]);
  const [editorKey, setEditorKey] = useState(0);
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
    blinding_thick: 0.05,
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
    int_L: 4.0,
    int_W: 3.0,
    depth_int: 2.5,
  });

  const calculateQuantities = async () => {
    setLoading(true);
    try {
      const payload = {
        ...tankInput,
        int_diam: tankInput.tank_type === "circular" ? parseFloat(tankInput.int_diam) : null,
        int_L: tankInput.tank_type === "rectangular" ? parseFloat(tankInput.int_L) : null,
        int_W: tankInput.tank_type === "rectangular" ? parseFloat(tankInput.int_W) : null,
      };

      const response = await axios.post("http://localhost:8001/underground_tank_router/api/calculate", payload);
      const data = response.data;

      if (data && data.items) {
        const formattedItems = data.items.map((item, index) => ({
          id: index + 1,
          billNo: item.item_no || (index + 1).toString(),
          itemNo: (index + 1).toString(),
          description: item.description,
          unit: item.unit,
          quantity: item.quantity ? parseFloat(item.quantity) : 0,
          rate: item.rate ? parseFloat(item.rate) : 0,
          amount: item.amount ? parseFloat(item.amount) : 0,
          dimensions: [],
          isHeader: item.description && item.description === item.description.toUpperCase() && !item.unit
        }));
        setTakeoffData(formattedItems);
        setEditorKey(prev => prev + 1);
      }
    } catch (err) {
      console.error("Calculation error:", err);
      alert("Calculation failed. Backend might be offline.");
    } finally {
      setLoading(false);
    }
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
            Veg Soil Depth (m)
          </label>
          <input
            type="number"
            step="0.1"
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

      <div className="grid grid-cols-3 gap-3 border-t pt-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Num Covers
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
            Cover L (m)
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
            Cover W (m)
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
    <div className="flex bg-gray-50 h-screen flex-col">
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex-none">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="w-8 h-8 text-blue-700" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Underground Tank Takeoff</h1>
            <p className="text-sm text-gray-500">Water Tank BOQ Generator</p>
          </div>
        </div>
        <UniversalTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabs={['calculator', 'takeoff', 'sheet', 'boq']}
        />
      </div>

      <main className="flex-1 overflow-auto p-4 max-w-7xl mx-auto w-full">
        {activeTab === 'calculator' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Parameters</h2>
              {renderUndergroundTankForm()}
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 sticky top-0">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Action</h2>
                <button
                  onClick={calculateQuantities}
                  disabled={loading}
                  className="w-full px-6 py-3 bg-blue-800 text-white rounded-lg hover:bg-blue-900 transition-colors flex items-center justify-center gap-2 mb-3 shadow"
                >
                  <Calculator className="w-5 h-5" />
                  {loading ? "Calculating..." : "Calculate Quantities"}
                </button>
                {takeoffData.length > 0 && (
                  <div className="mt-4 p-4 bg-green-50 text-green-800 rounded border border-green-200 text-sm">
                    Calculations updated! Check the <strong>Sheet</strong> and <strong>BOQ</strong> tabs.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'takeoff' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full overflow-hidden">
            <EnglishMethodTakeoffSheet
              key={editorKey}
              initialItems={takeoffData}
              onChange={setTakeoffData}
              projectInfo={{
                projectName: projectDetails.projectName || "Underground Tank",
                clientName: projectDetails.clientName,
                projectDate: projectDetails.date
              }}
            />
          </div>
        )}

        {activeTab === 'sheet' && (
          <div className="h-full">
            <UniversalSheet items={takeoffData} />
          </div>
        )}

        {activeTab === 'boq' && (
          <div className="h-full">
            <UniversalBOQ items={takeoffData} />
          </div>
        )}
      </main>
    </div>
  );
};

export default UnderGroundTankComponent;
