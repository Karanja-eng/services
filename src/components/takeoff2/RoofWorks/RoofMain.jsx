import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  UniversalTabs,
  UniversalSheet,
  UniversalBOQ
} from '../universal_component';
import EnglishMethodTakeoffSheet from "../ExternalWorks/EnglishMethodTakeoffSheet";
import RoofForm from "./RoofForm";
import Roof3DVisualizer from "./Roof3DVisualizer";

export default function RoofComponent({ isDark = false }) {
  const [activeTab, setActiveTab] = useState("config");
  const [roofConfig, setRoofConfig] = useState({
    roofType: "gable",
    buildingLength: 12,
    buildingWidth: 8,
    wallThickness: 0.3,
    overhang: 0.6,
    pitchAngle: 30,
    pitchAngle2: 15,    // New: Upper pitch for Gambrel/Mansard
    breakRatio: 0.6,    // New: Break position
    trussSpacing: 1.8,
    rafterSpacing: 0.6,
    material: "timber",
    covering: "tiles",
    wallPlateSize: [0.1, 0.05],
    rafterSize: [0.15, 0.05],
    tieBeamSize: [0.15, 0.05],
    strutSize: [0.1, 0.05],
    ridgeSize: [0.175, 0.025],
    purlinSize: [0.075, 0.075],
    includeRainwaterGoods: true,
  });

  const [takeoffData, setTakeoffData] = useState([]);
  const [loading, setLoading] = useState(false);

  const updateConfig = (key, value) => {
    setRoofConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleCalculate = async () => {
    setLoading(true);
    try {
      const payload = {
        roof_type: roofConfig.roofType,
        building_length: roofConfig.buildingLength,
        building_width: roofConfig.buildingWidth,
        wall_thickness: roofConfig.wallThickness,
        overhang: roofConfig.overhang,
        pitch_angle: roofConfig.pitchAngle,
        pitch_angle_2: roofConfig.pitchAngle2,
        break_ratio: roofConfig.breakRatio,
        truss_spacing: roofConfig.trussSpacing,
        rafter_spacing: roofConfig.rafterSpacing,
        material: roofConfig.material,
        covering_type: roofConfig.covering !== "none" ? roofConfig.covering : null,
        include_rainwater_goods: roofConfig.includeRainwaterGoods
      };

      const response = await axios.post("http://localhost:8001/roof_router/api/generate-takeoff", payload);
      const data = response.data;

      if (data && data.takeoff) {
        // Flatten sectioned takeoff from backend to match UniversalSheet format
        const flattened = [];
        data.takeoff.forEach(section => {
          // Add header
          flattened.push({
            id: `header-${section.section}`,
            description: section.section,
            isHeader: true
          });

          section.items.forEach((item, idx) => {
            flattened.push({
              id: `${section.section}-${idx}`,
              billNo: item.billNo || "",
              description: item.description,
              unit: item.unit,
              quantity: parseFloat(item.squaring || item.quantity),
              rate: 0,
              amount: 0,
              dimensions: [
                { times: item.timesing, d1: item.dimension, d2: "", d3: "", result: item.squaring }
              ]
            });
          });
        });

        setTakeoffData(flattened);
        setActiveTab("takeoff"); // Auto-switch to takeoff tab
      }
    } catch (error) {
      console.error("Error calculating roof takeoff:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-slate-900 overflow-hidden font-sans">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between shadow-sm z-20">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
            Roof CAD Pro
          </h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 uppercase tracking-wider font-semibold">
            Engineering Structural Design Suite
          </p>
        </div>

        <div className="flex-1 max-w-2xl px-12">
          <UniversalTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabs={['config', '3d', 'takeoff', 'sheet', 'boq']}
            labels={{
              config: "Configuration",
              '3d': "3D Visualization",
              takeoff: "SMM7 Takeoff",
              sheet: "Standard Sheet",
              boq: "Bill of Quantities"
            }}
          />
        </div>

        <div className="flex gap-3">
          <button
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:scale-95 transition-all"
          >
            Save Project
          </button>
          <button
            onClick={handleCalculate}
            disabled={loading}
            className={`px-6 py-2 text-sm font-bold text-white rounded-lg transition-all active:scale-95 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30'
              }`}
          >
            {loading ? "Calculating..." : "Run Analysis"}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative p-6">
        <div className="h-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden">

          {activeTab === "config" && (
            <div className="h-full flex flex-col overflow-y-auto p-8 max-w-4xl mx-auto">
              <RoofForm
                config={roofConfig}
                onChange={updateConfig}
                onCalculate={handleCalculate}
              />
            </div>
          )}

          {activeTab === "3d" && (
            <div className="h-full relative">
              <Roof3DVisualizer config={roofConfig} />
            </div>
          )}

          {activeTab === "takeoff" && (
            <div className="h-full p-6 overflow-auto bg-slate-50 dark:bg-slate-900">
              <EnglishMethodTakeoffSheet
                initialItems={takeoffData}
                onChange={setTakeoffData}
                projectInfo={{
                  projectName: `${roofConfig.roofType.toUpperCase()} ROOF`,
                  clientName: "System Calculation",
                  projectDate: new Date().toLocaleDateString()
                }}
              />
            </div>
          )}

          {activeTab === "sheet" && (
            <div className="h-full overflow-auto">
              <UniversalSheet items={takeoffData} />
            </div>
          )}

          {activeTab === "boq" && (
            <div className="h-full overflow-auto">
              <UniversalBOQ items={takeoffData} />
            </div>
          )}

        </div>
      </div>

      {/* Footer Info */}
      <div className="bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 px-6 py-2 flex items-center justify-between text-[10px] text-gray-500 dark:text-slate-400 font-mono">
        <div className="flex gap-4">
          <span>TYPE: {roofConfig.roofType.toUpperCase()}</span>
          <span>SYSTEM: ARCHICAD-ENGINE-V3</span>
          <span>UNITS: METRIC (M)</span>
        </div>
        <div className="flex gap-4">
          <span>STATUS: {loading ? 'CALCULATING...' : 'READY'}</span>
          <span>SMM7 COMPLIANT</span>
        </div>
      </div>
    </div>
  );
}
