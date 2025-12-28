import React, { useState, useEffect } from "react";
import { Calculator, Plus, Trash2, Download, FileText, Paintbrush } from "lucide-react";
import axios from "axios";
import EnglishMethodTakeoffSheet from "./ExternalWorks/EnglishMethodTakeoffSheet";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from './universal_component';

const InternalFinishesTakeoff = () => {
  const [activeTab, setActiveTab] = useState("calculator");
  const [takeoffData, setTakeoffData] = useState([]);
  const [editorKey, setEditorKey] = useState(0);

  const [rooms, setRooms] = useState([
    {
      id: 1,
      name: "Living Room",
      length: 5.0,
      width: 4.0,
      height: 3.0,
      doors: 1,
      doorHeight: 2.1,
      doorWidth: 0.9,
      windows: 1,
      windowHeight: 1.2,
      windowWidth: 1.5,
    },
  ]);

  const [materials, setMaterials] = useState({
    plasterThickness: 15,
    screedThickness: 25,
    tileSize: 300,
    skirtingHeight: 100,
    paintCoats: 3,
    ceilingFinish: "gypsum",
    wallTiling: "partial",
  });

  const [loading, setLoading] = useState(false);

  const addRoom = () => {
    setRooms([
      ...rooms,
      {
        id: Date.now(),
        name: `Room ${rooms.length + 1}`,
        length: 4.0,
        width: 3.0,
        height: 2.7,
        doors: 1,
        doorHeight: 2.1,
        doorWidth: 0.9,
        windows: 1,
        windowHeight: 1.2,
        windowWidth: 1.5,
      },
    ]);
  };

  const removeRoom = (id) => {
    if (rooms.length > 1) {
      setRooms(rooms.filter((room) => room.id !== id));
    }
  };

  const updateRoom = (id, field, value) => {
    setRooms(
      rooms.map((room) =>
        room.id === id ? { ...room, [field]: value } : room
      )
    );
  };

  const calculateQuantities = async () => {
    setLoading(true);
    try {
      const payload = {
        rooms: rooms.map(r => ({
          length: parseFloat(r.length),
          width: parseFloat(r.width),
          height: parseFloat(r.height),
          doors: parseInt(r.doors),
          door_height: parseFloat(r.doorHeight),
          door_width: parseFloat(r.doorWidth),
          windows: parseInt(r.windows),
          window_height: parseFloat(r.windowHeight),
          window_width: parseFloat(r.windowWidth)
        })),
        materials: {
          plaster_thickness: parseFloat(materials.plasterThickness),
          screed_thickness: parseFloat(materials.screedThickness),
          tile_size: parseFloat(materials.tileSize),
          skirting_height: parseFloat(materials.skirtingHeight),
          paint_coats: parseInt(materials.paintCoats),
          ceiling_finish: materials.ceilingFinish || "gypsum",
          wall_tiling: materials.wallTiling || "partial"
        }
      };

      const response = await axios.post("http://localhost:8001/internal_finishes_router/api/calculate", payload);
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
          isHeader: item.item_no && item.item_no.endsWith(".0") ? true : false
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex-none">
        <div className="flex items-center gap-3 mb-4">
          <Paintbrush className="w-8 h-8 text-blue-800" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Internal Finishes Takeoff</h1>
            <p className="text-sm text-gray-500">Floors, Walls & Ceilings</p>
          </div>
        </div>

        <UniversalTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabs={['calculator', 'takeoff', 'sheet', 'boq']}
        />
      </div>

      <main className="flex-1 overflow-auto p-4 max-w-7xl mx-auto w-full">
        {activeTab === "calculator" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Rooms Input */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-bold text-gray-800">Rooms</h2>
                  <button onClick={addRoom} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
                    <Plus className="w-4 h-4" /> Add Room
                  </button>
                </div>

                <div className="space-y-4">
                  {rooms.map((room, idx) => (
                    <div key={room.id} className="border rounded-lg p-4 bg-gray-50 relative">
                      <div className="flex justify-between mb-2">
                        <input
                          type="text"
                          value={room.name}
                          onChange={(e) => updateRoom(room.id, "name", e.target.value)}
                          className="font-semibold bg-transparent border-b border-gray-300 focus:border-blue-500 w-1/3 text-gray-800"
                        />
                        {rooms.length > 1 && <button onClick={() => removeRoom(room.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>}
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div><label className="text-xs text-gray-500 block">Length (m)</label><input type="number" value={room.length} onChange={(e) => updateRoom(room.id, "length", e.target.value)} className="w-full border rounded px-2 py-1" /></div>
                        <div><label className="text-xs text-gray-500 block">Width (m)</label><input type="number" value={room.width} onChange={(e) => updateRoom(room.id, "width", e.target.value)} className="w-full border rounded px-2 py-1" /></div>
                        <div><label className="text-xs text-gray-500 block">Height (m)</label><input type="number" value={room.height} onChange={(e) => updateRoom(room.id, "height", e.target.value)} className="w-full border rounded px-2 py-1" /></div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-t pt-2">
                        <div>
                          <label className="text-xs font-bold text-gray-600 mb-1 block">Doors</label>
                          <div className="flex gap-2">
                            <input type="number" placeholder="Count" value={room.doors} onChange={(e) => updateRoom(room.id, "doors", e.target.value)} className="w-16 border rounded px-1" />
                            <input type="number" placeholder="W" value={room.doorWidth} onChange={(e) => updateRoom(room.id, "doorWidth", e.target.value)} className="w-16 border rounded px-1" />
                            <input type="number" placeholder="H" value={room.doorHeight} onChange={(e) => updateRoom(room.id, "doorHeight", e.target.value)} className="w-16 border rounded px-1" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-600 mb-1 block">Windows</label>
                          <div className="flex gap-2">
                            <input type="number" placeholder="Count" value={room.windows} onChange={(e) => updateRoom(room.id, "windows", e.target.value)} className="w-16 border rounded px-1" />
                            <input type="number" placeholder="W" value={room.windowWidth} onChange={(e) => updateRoom(room.id, "windowWidth", e.target.value)} className="w-16 border rounded px-1" />
                            <input type="number" placeholder="H" value={room.windowHeight} onChange={(e) => updateRoom(room.id, "windowHeight", e.target.value)} className="w-16 border rounded px-1" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Settings & Actions */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h2 className="font-bold text-gray-800 mb-4 border-b pb-2">Specifications</h2>
                <div className="space-y-3">
                  <div><label className="text-xs text-gray-600">Plaster Thickness (mm)</label><input type="number" value={materials.plasterThickness} onChange={(e) => setMaterials({ ...materials, plasterThickness: e.target.value })} className="w-full border rounded px-2 py-1" /></div>
                  <div><label className="text-xs text-gray-600">Screed Thickness (mm)</label><input type="number" value={materials.screedThickness} onChange={(e) => setMaterials({ ...materials, screedThickness: e.target.value })} className="w-full border rounded px-2 py-1" /></div>
                  <div><label className="text-xs text-gray-600">Tile Size (mm)</label><input type="number" value={materials.tileSize} onChange={(e) => setMaterials({ ...materials, tileSize: e.target.value })} className="w-full border rounded px-2 py-1" /></div>
                  <div><label className="text-xs text-gray-600">Paint Coats</label><input type="number" value={materials.paintCoats} onChange={(e) => setMaterials({ ...materials, paintCoats: e.target.value })} className="w-full border rounded px-2 py-1" /></div>

                  <div>
                    <label className="text-xs text-gray-600">Ceiling Finish</label>
                    <select value={materials.ceilingFinish} onChange={(e) => setMaterials({ ...materials, ceilingFinish: e.target.value })} className="w-full border rounded px-2 py-1">
                      <option value="gypsum">Gypsum Board</option>
                      <option value="plaster">Plaster</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Wall Tiling</label>
                    <select value={materials.wallTiling} onChange={(e) => setMaterials({ ...materials, wallTiling: e.target.value })} className="w-full border rounded px-2 py-1">
                      <option value="none">None</option>
                      <option value="partial">Partial (Wet Areas)</option>
                      <option value="full">Full Height</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={calculateQuantities}
                  disabled={loading}
                  className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Calculator className="w-5 h-5" />
                  {loading ? "Calculating..." : "Calculate Takeoff"}
                </button>
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
                projectName: "Internal Finishes",
                clientName: "Client Name",
                projectDate: new Date().toLocaleDateString()
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

export default InternalFinishesTakeoff;
