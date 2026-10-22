import { Calculator, Plus, Trash2, Download, FileText, Box, Paintbrush, Upload, Loader2, Eye, Building, Layers, X } from "lucide-react";
import axios from "axios";
import React, { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import EnglishMethodTakeoffSheet from "../ExternalWorks/EnglishMethodTakeoffSheet";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from '../universal_component';
import StructuralVisualizationComponent from '../../Drawings/visualise_component';
import {
  PageHeader,
  Section,
  MetaChip,
  NumberField,
  SelectField,
  ErrorNotice,
  ActionBar,
  action,
  layout,
} from '../../shared/ui';

const API_BASE = `http://${window.location.hostname}:8001`;

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
  const [calcError, setCalcError] = useState(null);
  const [calcSubTab, setCalcSubTab] = useState("automation");
  const [planImageUrl, setPlanImageUrl] = useState(null);
  const [activeSegment, setActiveSegment] = useState("all");

  // Automation State
  const [buildingData, setBuildingData] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [fileId, setFileId] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    if (isImage) {
      setPlanImageUrl(URL.createObjectURL(file));
    } else {
      setPlanImageUrl("cad_placeholder");
    }
    setProcessing(true);

    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/arch_pro/upload`, { method: "POST", body: fd });
      const data = await res.json();
      setFileId(data.file_id);
      await processFloorplan(data.file_id);
    } catch (err) { console.error(err); }
    setProcessing(false);
  };

  const processFloorplan = async (fid) => {
    const fd = new FormData();
    fd.append("file_id", fid);
    fd.append("use_yolo", "true");
    try {
      const res = await fetch(`${API_BASE}/arch_pro/api/process`, { method: "POST", body: fd });
      const data = await res.json();
      setBuildingData(data);
      autoFillInputs(data);
    } catch (err) { console.error(err); }
  };

  const autoFillInputs = (data) => {
    if (!data || !data.floors[0]) return;
    const floor = data.floors[0];

    const extractedRooms = floor.rooms.map((r, i) => {
      // Calculate length/width from polygon bounding box
      let length = 4.0;
      let width = 3.0;

      if (r.polygon && r.polygon.length > 0) {
        const xs = r.polygon.map(p => p[0]);
        const ys = r.polygon.map(p => p[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        length = (maxX - minX);
        width = (maxY - minY);
      } else if (r.area) {
        length = Math.sqrt(r.area);
        width = Math.sqrt(r.area);
      }

      return {
        id: r.id || Date.now() + i,
        name: r.name || r.type || `Room ${i + 1}`,
        length: length.toFixed(2),
        width: width.toFixed(2),
        height: data.wallHeight || 2.8,
        doors: 1,
        doorHeight: 2.1,
        doorWidth: 0.9,
        windows: 1,
        windowHeight: 1.2,
        windowWidth: 1.5,
      };
    });
    setRooms(extractedRooms);
  };

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
    setCalcError(null);
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
      // Replaces the previous alert(); the failure is reported in-page and no
      // quantities are invented.
      setCalcError(
        err?.response?.data?.detail ||
          err?.message ||
          "Calculation failed. The backend may be offline."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-gray-50">
      <div className="mx-auto w-full max-w-7xl px-3 pt-4 sm:px-5">
        <PageHeader
          title="Internal finishes takeoff"
          subtitle="Floors, walls and ceilings — plaster, screed, tiling, paint and skirting."
          icon={<Paintbrush size={22} aria-hidden="true" />}
          meta={
            <>
              <MetaChip tone="info">{rooms.length} room(s)</MetaChip>
              <MetaChip>{takeoffData.length} item(s) generated</MetaChip>
            </>
          }
        />
        <div className="-mx-1 mb-4 overflow-x-auto">
          <UniversalTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabs={['calculator', 'takeoff', 'sheet', 'boq', '3d-view']}
          />
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl px-3 pb-8 sm:px-5">
        {activeTab === "calculator" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Input Panel */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex border-b border-gray-200 bg-gray-50">
                  {["automation", "manual"].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setCalcSubTab(tab)}
                      className={`flex-1 px-4 py-3 text-sm font-bold transition-colors ${calcSubTab === tab ? 'border-b-2 border-blue-600 text-blue-600 bg-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                      {tab === "automation" ? "AI AUTOMATION" : "MANUAL LIST"}
                    </button>
                  ))}
                </div>

                <div className="p-4">
                  {calcSubTab === "automation" ? (
                    <div className="space-y-4">
                      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 rounded-xl space-y-4">
                        {processing ? (
                          <div className="flex flex-col items-center space-y-3">
                            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                            <p className="text-sm font-bold text-gray-700">Detecting Finishes...</p>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-10 h-10 text-blue-400" />
                            <div className="text-center">
                              <h3 className="font-bold text-gray-900 uppercase">Room Extractor</h3>
                              <p className="text-xs text-gray-500">Scan plan for automated finishes.</p>
                            </div>
                            <input type="file" id="finishes-upload" className="hidden" accept="image/*,.dxf,.ifc" onChange={handleUpload} />
                            <label htmlFor="finishes-upload" className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-all text-sm">
                              Upload Plan (Img/CAD)
                            </label>
                          </>
                        )}
                      </div>

                      {buildingData && (
                        <div className="bg-green-50 p-3 rounded-lg border border-green-200 text-green-700 text-xs font-bold flex items-center gap-2">
                          <Layers className="w-3 h-3" /> Architecture analysis complete. Verify rooms below.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <button onClick={addRoom} className="w-full flex items-center justify-center gap-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 px-3 py-3 rounded-lg hover:bg-blue-100 font-bold transition-colors">
                        <Plus className="w-4 h-4" /> Add Room Manually
                      </button>
                    </div>
                  )}

                  <div className="mt-6 border-t border-gray-200 pt-5 dark:border-slate-800">
                    <Section
                      title="Finish specifications"
                      description="Thicknesses are in millimetres; they feed the quantity calculation directly."
                      tone="muted"
                    >
                      <div className={layout.formGrid}>
                        <NumberField
                          label="Plaster thickness"
                          unit="mm"
                          step="1"
                          min={0}
                          value={materials.plasterThickness}
                          onChange={(v) => setMaterials({ ...materials, plasterThickness: v })}
                        />
                        <NumberField
                          label="Screed thickness"
                          unit="mm"
                          step="1"
                          min={0}
                          value={materials.screedThickness}
                          onChange={(v) => setMaterials({ ...materials, screedThickness: v })}
                        />
                        <NumberField
                          label="Tile size"
                          unit="mm"
                          step="1"
                          min={0}
                          value={materials.tileSize}
                          onChange={(v) => setMaterials({ ...materials, tileSize: v })}
                        />
                        <NumberField
                          label="Skirting height"
                          unit="mm"
                          step="1"
                          min={0}
                          value={materials.skirtingHeight}
                          onChange={(v) => setMaterials({ ...materials, skirtingHeight: v })}
                        />
                        <NumberField
                          label="Paint coats"
                          unit="no."
                          step="1"
                          min={0}
                          inputMode="numeric"
                          value={materials.paintCoats}
                          onChange={(v) => setMaterials({ ...materials, paintCoats: v })}
                        />
                        <SelectField
                          label="Ceiling finish"
                          value={materials.ceilingFinish}
                          onChange={(v) => setMaterials({ ...materials, ceilingFinish: v })}
                          options={[
                            { value: 'gypsum', label: 'Gypsum' },
                            { value: 'plaster', label: 'Plaster' },
                          ]}
                        />
                        <SelectField
                          label="Wall tiling"
                          value={materials.wallTiling}
                          onChange={(v) => setMaterials({ ...materials, wallTiling: v })}
                          options={[
                            { value: 'none', label: 'None' },
                            { value: 'partial', label: 'Partial' },
                            { value: 'full', label: 'Full' },
                          ]}
                        />
                      </div>
                    </Section>

                    <ActionBar sticky={false} hint="Rooms are listed on the right; each room is measured individually.">
                      <button
                        type="button"
                        onClick={calculateQuantities}
                        disabled={loading}
                        className={`${action.base} ${action.primary}`}
                      >
                        <Calculator className="w-4 h-4" aria-hidden="true" />
                        {loading ? "Calculating…" : "Run analysis"}
                      </button>
                    </ActionBar>

                    {calcError && (
                      <ErrorNotice
                        title="Finishes takeoff failed"
                        message={calcError}
                        onRetry={calculateQuantities}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-col gap-4 lg:col-span-2">
              {/* Visualizer Panel */}
              <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-2xl border-4 border-white bg-slate-900 shadow-xl sm:min-h-[420px]">
                {planImageUrl ? (
                  <div className="absolute inset-0 bg-white">
                    {planImageUrl === "cad_placeholder" ? (
                      <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-white p-8 space-y-4">
                        <Box size={64} className="text-blue-400" />
                        <h3 className="text-xl font-bold">CAD File Render</h3>
                        <p className="text-sm text-slate-400 text-center">AutoCAD/Revit/ArchiCAD data extracted successfully. Close this view to see calculated results in the forms.</p>
                      </div>
                    ) : (
                      <>
                        <img
                          src={planImageUrl}
                          className={`absolute inset-0 w-full h-full object-contain transition-all duration-500 ${buildingData?.metadata?.segmented_urls && activeSegment !== 'all' ? 'opacity-40 grayscale-[50%]' : 'opacity-100'}`}
                          alt="Base Plan"
                        />
                        {buildingData?.metadata?.segmented_urls && activeSegment !== 'all' && (
                          <img
                            src={`${API_BASE}${buildingData.metadata.segmented_urls[activeSegment]}`}
                            className="absolute inset-0 w-full h-full object-contain pointer-events-none mix-blend-multiply transition-all duration-300"
                            alt="Segment Mask"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        )}
                      </>
                    )}

                    <div className="absolute top-4 right-4 z-20">
                      <button
                        onClick={() => { setPlanImageUrl(null); setBuildingData(null); }}
                        className="bg-white/90 p-2 shadow-lg rounded-full hover:bg-white text-red-500 transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="absolute bottom-4 left-4 z-20 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                      <p className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <Building className="w-3 h-3 text-blue-400" /> {activeSegment === 'all' ? 'Original Plan' : `${activeSegment} Detections`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 space-y-4">
                    <div className="p-8 bg-slate-800 rounded-full animate-pulse">
                      <Eye className="w-16 h-16 opacity-20" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-slate-200">Visualizer Pending</h3>
                      <p className="text-sm">Upload a floorplan to see detection layers.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Rooms List Panel */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 overflow-y-auto h-72">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Box className="w-5 h-5 text-blue-600" /> Detected Rooms & Elements
                  </h3>
                  <div className="flex items-center gap-2">
                    {buildingData && (
                      <div className="flex gap-2 mr-2">
                        <div className="flex gap-2 mr-2">
                          <button
                            onClick={() => {
                              setActiveSegment(activeSegment === 'rooms' ? 'all' : 'rooms');
                              if (activeSegment !== 'rooms') setShowPlanModal(true);
                            }}
                            className={`px-3 py-1 text-[10px] font-bold rounded uppercase border transition-all ${activeSegment === 'rooms' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 font-black'}`}>
                            {activeSegment === 'rooms' ? 'Hide Rooms' : 'Show Rooms'}
                          </button>
                          <button
                            onClick={() => {
                              setActiveSegment(activeSegment === 'walls' ? 'all' : 'walls');
                              if (activeSegment !== 'walls') setShowPlanModal(true);
                            }}
                            className={`px-3 py-1 text-[10px] font-bold rounded uppercase border transition-all ${activeSegment === 'walls' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 font-black'}`}>
                            {activeSegment === 'walls' ? 'Hide Walls' : 'Show Walls'}
                          </button>
                        </div>
                      </div>
                    )}
                    <span className="text-xs font-bold px-2 py-1 bg-gray-100 text-gray-600 rounded">Total: {rooms.length}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {rooms.map((room, idx) => (
                    <div key={room.id} className="group border border-gray-100 hover:border-blue-200 rounded-xl p-4 transition-all hover:bg-blue-50/30">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-blue-600 text-gray-400 group-hover:text-white flex items-center justify-center text-xs font-black transition-all">
                          {idx + 1}
                        </div>
                        <div className="flex-1 grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                          <input
                            type="text"
                            value={room.name}
                            onChange={(e) => updateRoom(room.id, "name", e.target.value)}
                            className="font-bold text-sm text-gray-900 bg-transparent border-b border-transparent focus:border-blue-500 outline-none"
                          />
                          <div className="col-span-1 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Size:</span>
                            <span className="text-xs font-mono font-bold text-gray-700">{room.length}x{room.width}m</span>
                          </div>
                          <div className="col-span-1 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">H:</span>
                            <span className="text-xs font-mono font-bold text-gray-700">{room.height}m</span>
                          </div>
                          <div className="flex justify-end">
                            <button onClick={() => removeRoom(room.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'takeoff' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-full overflow-hidden">
            <EnglishMethodTakeoffSheet
              key={editorKey}
              initialItems={takeoffData}
              onChange={setTakeoffData}
              planImageUrl={planImageUrl}
              buildingData={buildingData}
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

        {activeTab === '3d-view' && (
          <div className="h-full bg-slate-900 rounded-2xl overflow-hidden relative border border-slate-800 shadow-2xl">
            {buildingData ? (
              <StructuralVisualizationComponent
                componentType="internalFinishes"
                buildingData={buildingData}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center space-y-4 text-slate-400">
                <div className="p-8 bg-slate-800 rounded-full">
                  <Eye className="w-16 h-16 opacity-20" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-slate-200 uppercase tracking-widest">3D Model Pending</h3>
                  <p className="text-sm max-w-xs">Upload a plan to generate the architectural visualization.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      {/* Plan Image Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Architecture Reference</h3>
                <p className="text-sm text-gray-500">Scale: {buildingData?.metadata?.ppm || 100} pixels/meter</p>
              </div>
              <button onClick={() => setShowPlanModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={24} className="text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-100 p-8 flex items-center justify-center relative min-h-[500px]">
              <div className="relative inline-block border-4 border-white shadow-2xl rounded-lg overflow-hidden">
                {planImageUrl === "cad_placeholder" ? (
                  <div className="w-[600px] h-[400px] bg-slate-900 flex flex-col items-center justify-center text-white p-8 space-y-4">
                    <Box size={64} className="text-blue-400" />
                    <h3 className="text-xl font-bold">CAD File Render</h3>
                    <p className="text-sm text-slate-400 text-center">AutoCAD/Revit/ArchiCAD data extracted successfully. Close this view to see calculated results in the forms.</p>
                  </div>
                ) : (
                  <img
                    src={planImageUrl}
                    alt="Floor Plan"
                    className={`max-w-full h-auto transition-all duration-500 ${activeSegment !== 'all' ? 'opacity-0 grayscale-[70%]' : 'opacity-100'}`}
                  />
                )}
                {activeSegment !== 'all' && planImageUrl !== "cad_placeholder" && (
                  <img
                    src={`${API_BASE}/opencv/${activeSegment}?file_id=${buildingData?.project_id}`}
                    alt={`${activeSegment} Layer`}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none mix-blend-multiply transition-all duration-300 contrast-125 brightness-110"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">Layer Switcher:</span>
                {[
                  { id: 'all', label: 'Plan', color: 'bg-gray-600' },
                  { id: 'rooms', label: 'Rooms', color: 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500' },
                  { id: 'walls', label: 'Walls', color: 'bg-black' },
                  { id: 'slabs', label: 'Slabs', color: 'bg-black' },
                  { id: 'beams', label: 'Beams', color: 'bg-black' },
                  { id: 'columns', label: 'Columns', color: 'bg-black' },
                  { id: 'stairs', label: 'Stairs', color: 'bg-black' },
                  { id: 'contours', label: 'Contours', color: 'bg-black' }
                ].map(layer => (
                  <button
                    key={layer.id}
                    onClick={() => setActiveSegment(layer.id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all flex items-center gap-1.5 ${activeSegment === layer.id ? `${layer.color} text-white shadow-lg scale-105` : 'bg-white text-gray-400 border border-gray-100 hover:border-gray-300'}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${activeSegment === layer.id ? 'bg-white animate-pulse' : layer.color}`} />
                    {layer.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowPlanModal(false)}
                className="px-6 py-2 bg-gray-900 text-white rounded-lg font-bold hover:bg-gray-800 transition-colors text-xs uppercase tracking-widest"
              >
                Exit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InternalFinishesTakeoff;
