import React, { useState, useEffect } from "react";
import {
  Menu,
  Settings,
  Save,
  Upload,
  Calculator,
} from "lucide-react";
import axios from "axios";
import ExternalWorks3DVisualizer from "./3DExternalWorksVisualizer";
import ExternalWorksInputForm from "./ExternalWorksInputForm";
import EnglishMethodTakeoffSheet from "./EnglishMethodTakeoffSheet";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from '../universal_component';

// Main Application Component
export default function ExternalWorksComponent({ isDark = false }) {
  const [activeTab, setActiveTab] = useState("calculator");

  // Theme check (simplified)
  const bgClass = isDark ? "bg-slate-900 text-white" : "bg-gray-50 text-gray-900";
  const cardClass = isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200";

  // Sample project state
  const [formData, setFormData] = useState({
    projectInfo: {
      projectName: "External Works Project",
      location: "Nairobi, Kenya",
      drawingNumber: "DRG No.01",
      date: new Date().toISOString().split("T")[0],
      takenBy: "",
      checkedBy: "",
      scale: "1:100",
    },
    siteData: {
      siteLength: 50,
      siteWidth: 40,
    },
    demolitions: {
      houseLength: 12,
      houseWidth: 10,
      buildingDemolitionVolume: 0,
      treesSmall: 3,
      treesLarge: 2,
      stumps: 1,
      pipelineRemovalLength: 0,
      pipelineDiameter: 225,
      vegetableSoilDepth: 0.15,
    },
    siteClearance: {
      clearArea: 1800,
      vegSoilDepth: 0.15,
      treesSmall: 3,
      treesLarge: 2,
      stumps: 1
    },
    excavations: {
      pavedArea: 500,
      depth: 0.5,
      rockVolume: 0,
      workingSpace: 0.3
    },
    filling: {
      murramVolume: 100,
      hardcoreVolume: 100,
      sandBedVolume: 20
    },
    pavement: {
      bitumenArea: 500,
      bitumenThick: 0.05,
      cabroArea: 0,
      cabroThick: 0.06
    },
    kerbs: {
      kerbStraight: 100,
      kerbRadius: 10,
      channelStraight: 100,
      channelRadius: 10
    },
    drainage: {
      invertBlocks: 100,
      sideSlabs: 200,
      manholes: 5
    },
    landscaping: {
      grassArea: 500,
      trees: 10,
      hedgeLength: 30
    },
    fencing: {
      fenceLength: 200,
      fenceType: "Chainlink"
    },
    gate: {
      numGates: 1,
      gateType: "Steel"
    }
  });

  const [takeoffData, setTakeoffData] = useState([]);
  const [editorKey, setEditorKey] = useState(0);

  const handleCalculate = async () => {
    try {
      const payload = {
        site_details: {
          length: formData.siteData.siteLength,
          width: formData.siteData.siteWidth
        },
        demolitions: formData.demolitions,
        site_clearance: formData.siteClearance,
        excavation: formData.excavations,
        filling: formData.filling,
        pavement: formData.pavement,
        kerbs: formData.kerbs,
        drainage: formData.drainage,
        landscaping: formData.landscaping,
        fencing: formData.fencing,
        gate: formData.gate
      };

      const response = await axios.post("http://localhost:8001/external_works/calculate", payload);
      const data = response.data;

      if (data && data.takeoff_items) {
        const formattedItems = data.takeoff_items.map((item, index) => ({
          id: index + 1,
          billNo: item.item_no || `EW.${index + 1}`,
          itemNo: (index + 1).toString(),
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          rate: item.rate || 0,
          amount: item.amount || 0,
          dimensions: [],
          isHeader: false
        }));
        setTakeoffData(formattedItems);
        setEditorKey(prev => prev + 1);
      }
    } catch (error) {
      console.error("Error calculating external works:", error);
      alert("Calculation failed. Backend might be offline.");
    }
  };

  const saveProject = () => {
    const dataStr = JSON.stringify({ formData }, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${formData.projectInfo.projectName.replace(/\s+/g, "-")}_${Date.now()}.json`;
    link.click();
  };

  const loadProject = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.formData) setFormData(data.formData);
        } catch (error) {
          alert("Error loading project file");
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className={`flex h-screen ${bgClass} font-sans transition-colors duration-300`}>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className={`${cardClass} border-b px-5 py-3 flex justify-between items-center shadow-sm z-10`}>
          <div className="flex items-center gap-4 flex-1">
            <h1 className="text-xl font-bold">External Works</h1>
          </div>
          <UniversalTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabs={['calculator', '3d', 'takeoff', 'sheet', 'boq']}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleCalculate}
              className="px-3 py-2 bg-blue-600 text-white rounded-md flex items-center gap-2 hover:bg-blue-700 text-sm font-medium"
            >
              <Calculator size={14} /> Calculate
            </button>
            <button
              onClick={saveProject}
              className="px-3 py-2 bg-teal-600 text-white rounded-md flex items-center gap-2 hover:bg-teal-700 text-sm font-medium"
            >
              <Save size={14} /> Save
            </button>
            <label className={`px-3 py-2 border rounded-md cursor-pointer flex items-center gap-2 text-sm font-medium ${isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-gray-300 hover:bg-gray-100'}`}>
              <Upload size={14} /> Load
              <input type="file" accept=".json" onChange={loadProject} className="hidden" />
            </label>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6 relative">
          {activeTab === "calculator" && (
            <ExternalWorksInputForm
              theme={{
                bg: isDark ? "#0f172a" : "#f8fafc",
                card: isDark ? "#1e293b" : "#ffffff",
                text: isDark ? "#f1f5f9" : "#0f172a",
                border: isDark ? "#334155" : "#e2e8f0",
                accent: "#14b8a6"
              }}
              formData={formData}
              setFormData={setFormData}
            />
          )}

          {activeTab === "3d" && (
            <ExternalWorks3DVisualizer
              theme={{ bg: isDark ? "#0f172a" : "#f8fafc" }}
              config={formData.roadConfig}
              setConfig={(cfg) => setFormData({ ...formData, roadConfig: cfg })}
            />
          )}

          {activeTab === "takeoff" && (
            <div className={`rounded-lg shadow p-0 h-full overflow-hidden ${cardClass}`}>
              <EnglishMethodTakeoffSheet
                key={editorKey}
                initialItems={takeoffData}
                onChange={setTakeoffData}
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
        </main>
      </div>
    </div>
  );
}
