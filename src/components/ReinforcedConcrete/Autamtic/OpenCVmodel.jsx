import React, { useState } from "react";
import axios from "axios";
import { Upload, Loader2, Eye, Trash2, Box, Layers, MousePointer2 } from 'lucide-react';

const API_BASE = `http://${window.location.hostname}:8001`;

export default function OpenCVApp() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [imgSrc, setImgSrc] = useState(null);
  const [msg, setMsg] = useState("");
  const [original, setOriginal] = useState(null);
  const [activeEndpoint, setActiveEndpoint] = useState(null);

  async function callEndpoint(endpoint) {
    if (!file) {
      setMsg("Choose an image first");
      return;
    }
    setBusy(true);
    setMsg("Processing " + endpoint + "...");
    setActiveEndpoint(endpoint);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API_BASE}/opencv/${endpoint}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "blob",
      });
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      setImgSrc(url);
      setMsg("Analysis Complete: " + endpoint);
    } catch (err) {
      console.error(err);
      setMsg("Error: " + (err.response?.data || err.message));
    } finally {
      setBusy(false);
    }
  }

  function handleFileChange(e) {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setOriginal(URL.createObjectURL(selectedFile));
      setImgSrc(null);
      setActiveEndpoint(null);
      setMsg("Plan Loaded. Select an analysis layer.");
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans antialiased text-slate-900">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Box className="text-blue-600 w-8 h-8" />
              OPENCV <span className="text-blue-600 italic underline decoration-2">ANALYTICS</span>
            </h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Computer Vision Floorplan Analysis</p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="file"
              id="file-upload"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <label
              htmlFor="file-upload"
              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all cursor-pointer shadow-lg active:scale-95 flex items-center gap-2"
            >
              <Upload size={16} />
              {file ? "Change Plan" : "Upload Plan"}
            </label>
            {file && (
              <button
                onClick={() => { setFile(null); setOriginal(null); setImgSrc(null); setActiveEndpoint(null); }}
                className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Analysis Controls */}
          <aside className="lg:col-span-1 space-y-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Layers size={14} className="text-blue-500" /> Analysis Layers
              </h3>

              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'contours', label: 'Outer Contours', color: 'bg-indigo-600' },
                  { id: 'rooms', label: 'Room Detection', color: 'bg-emerald-600' },
                  { id: 'walls', label: 'Wall Extraction', color: 'bg-blue-600' },
                  { id: 'slabs', label: 'Slab Zoning', color: 'bg-amber-500' },
                  { id: 'beams', label: 'Beam Centerlines', color: 'bg-orange-600' },
                  { id: 'ocr', label: 'Text Processing', color: 'bg-slate-700' },
                  { id: 'columns', label: 'Column AI (YOLO)', color: 'bg-magenta-600' },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => callEndpoint(btn.id)}
                    disabled={busy || !file}
                    className={`w-full text-left px-4 py-3 rounded-xl font-bold text-xs uppercase transition-all flex items-center justify-between border ${activeEndpoint === btn.id
                        ? `${btn.color} text-white border-transparent shadow-md scale-[1.02]`
                        : 'bg-white text-slate-600 border-slate-100 hover:border-blue-200 hover:bg-blue-50/30'
                      } ${(!file || busy) && 'opacity-50 cursor-not-allowed'}`}
                  >
                    {btn.label}
                    {busy && activeEndpoint === btn.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <div className={`w-2 h-2 rounded-full ${activeEndpoint === btn.id ? 'bg-white' : btn.color.replace('bg-', 'bg-')}`} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <p className={`text-[10px] font-bold ${msg.includes('Error') ? 'text-red-500' : 'text-slate-500'} uppercase tracking-tight leading-relaxed`}>
                <span className="opacity-50">Status:</span> {msg}
              </p>
            </div>
          </aside>

          {/* Visualization Canvas */}
          <main className="lg:col-span-3">
            <div className="bg-white rounded-3xl shadow-xl border-4 border-white overflow-hidden relative group aspect-[4/3] min-h-[500px] flex items-center justify-center bg-slate-100">
              {original ? (
                <div className="relative w-full h-full p-8 flex items-center justify-center">
                  {/* Base Original Image */}
                  <img
                    src={original}
                    alt="Original Floorplan"
                    className={`max-w-full max-h-full object-contain transition-opacity duration-500 ${imgSrc ? 'opacity-40 grayscale-[50%]' : 'opacity-100'}`}
                  />

                  {/* Stacked Processed Layer */}
                  {imgSrc && (
                    <img
                      src={imgSrc}
                      alt="CV Layer"
                      className="absolute inset-0 w-full h-full object-contain p-8 mix-blend-multiply transition-all duration-300 pointer-events-none"
                    />
                  )}

                  {/* UI Overlays */}
                  <div className="absolute top-6 left-6 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-2xl">
                    <p className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <Eye size={12} className="text-blue-400" />
                      {activeEndpoint ? `${activeEndpoint.toUpperCase()} LAYER` : 'NORMAL VIEW'}
                    </p>
                  </div>

                  {imgSrc && (
                    <div className="absolute top-6 right-6 flex items-center gap-2">
                      <button
                        onClick={() => { setImgSrc(null); setActiveEndpoint(null); setMsg("Layer cleared."); }}
                        className="bg-white/90 hover:bg-white p-2.5 rounded-xl shadow-lg text-slate-900 transition-all font-bold text-[10px] uppercase tracking-tighter flex items-center gap-2"
                      >
                        Clear Overlay
                      </button>
                    </div>
                  )}

                  <div className="absolute bottom-6 inset-x-0 flex justify-center translate-y-8 group-hover:translate-y-0 transition-all opacity-0 group-hover:opacity-100 px-6">
                    <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-2xl border border-slate-200 flex items-center gap-4 max-w-md w-full">
                      <div className="bg-blue-600 p-2 rounded-lg"><MousePointer2 size={16} className="text-white" /></div>
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Active Visualization</p>
                        <p className="text-[9px] text-slate-500 font-bold uppercase truncate">{activeEndpoint ? `Showing detected ${activeEndpoint} patterns` : 'Hover to see details'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-6 text-slate-300">
                  <div className="w-24 h-24 bg-white rounded-[2rem] shadow-lg flex items-center justify-center">
                    <Eye size={48} className="text-slate-200" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Viz Panel Ready</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Upload a floorplan to begin analysis</p>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
