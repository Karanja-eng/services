import React, { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { CheckCircle2, ExternalLink } from "lucide-react";
import {
  UniversalTabs,
  UniversalSheet,
  UniversalBOQ
} from '../universal_component';
import EnglishMethodTakeoffSheet from "../ExternalWorks/EnglishMethodTakeoffSheet";
import RoofForm from "./RoofForm";
import StructuralVisualizationComponent from "../../Drawings/visualise_component";
import { useTakeoffBridge } from "../../../state/TakeoffBridgeContext";
import { TAKEOFF_SOURCE } from "../../../state/takeoffBridge";

export default function RoofComponent({ isDark = false }) {
  const [activeTab, setActiveTab] = useState("config");
  const { publish } = useTakeoffBridge();
  const [published, setPublished] = useState(false);
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
        // Explicit hand-off to the global taking-off workflow. Re-running the
        // calculation replaces only the previously published roof batch, so
        // repeated runs cannot duplicate rows or touch manual items.
        publish(flattened, TAKEOFF_SOURCE.roof);
        setPublished(true);
        setActiveTab("takeoff"); // Auto-switch to takeoff tab
      }
    } catch (error) {
      console.error("Error calculating roof takeoff:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-gray-50 font-sans dark:bg-slate-900">
      {/* Top Header */}
      <div className="z-20 flex flex-col gap-2 border-b border-gray-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
        <div className="min-w-0">
          <h1 className="truncate bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-lg font-bold text-transparent sm:text-2xl">
            Roof takeoff
          </h1>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400 sm:text-xs">
            SMM7 takeoff · dimension paper · bill of quantities
          </p>
        </div>

        <div className="-mx-1 min-w-0 overflow-x-auto sm:max-w-2xl sm:flex-1 sm:px-4">
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

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={handleCalculate}
            disabled={loading}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {loading ? "Calculating…" : "Run analysis"}
          </button>
        </div>
      </div>

      {published && (
        <div className="mx-3 mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-200 sm:mx-6">
          <CheckCircle2 size={14} aria-hidden="true" />
          <span>Published to the global taking-off, dimension paper and BOQ.</span>
          <Link
            to="/quantity/manual/taking-off"
            className="inline-flex items-center gap-1 font-semibold underline hover:no-underline"
          >
            Open taking-off sheet
            <ExternalLink size={12} aria-hidden="true" />
          </Link>
        </div>
      )}

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
              <StructuralVisualizationComponent
                componentType="roof"
                componentData={{
                  roofConfig: roofConfig,
                }}
                theme={isDark ? "dark" : "light"}
              />
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
