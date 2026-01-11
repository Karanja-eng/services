import React, { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Settings } from "lucide-react";

import DrainageTakeoffForm from "./DrainageTakeoffForm";
// import TakeoffSheet from "./TakeoffSheet"; // Replaced by Universal Components
import EnglishMethodTakeoffSheet from "../ExternalWorks/EnglishMethodTakeoffSheet";
import DrainageScene3D from "./DrainageScene3D";
import descriptions from "../descriptions";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from '../universal_component';

// Main App Component
const DrainageComponenet = () => {
  const [activeTab, setActiveTab] = useState("calculator");
  const [projectData, setProjectData] = useState(null);
  const [calculationResults, setCalculationResults] = useState(null);
  const [takeoffData, setTakeoffData] = useState([]);
  const [editorKey, setEditorKey] = useState(0);

  const handleCalculationComplete = (results) => {
    setCalculationResults(results);
    setProjectData(results); // assuming results contains project info too or we mix it

    // Format for Universal Components
    if (results && results.boq_items) {
      const formattedItems = results.boq_items.map((item, index) => ({
        id: index + 1,
        billNo: item.code.split('.')[0] || "A", // Extract A from A.1
        itemNo: item.code,
        description: descriptions[item.name] || item.description || item.name,
        unit: item.unit,
        quantity: item.quantity,
        rate: item.rate || 0,
        amount: item.amount || 0,
        dimensions: (item.dimensions || []).map((dim, dIdx) => ({
          id: dIdx + 1,
          number: dim.number?.toString() || "1",
          length: dim.length?.toString() || "",
          width: dim.width?.toString() || "",
          height: dim.height?.toString() || "",
          description: dim.description || "",
          deduction: false
        })),
        isHeader: false
      }));

      // Group headers for better structure
      const groupedItems = [];
      let currentBill = "";

      formattedItems.forEach(item => {
        const bill = item.billNo;
        if (bill !== currentBill) {
          groupedItems.push({
            id: `header-${bill}`,
            billNo: bill,
            itemNo: "",
            description: `CLASS ${bill}`, // Placeholder, backend could provide more
            dimensions: [],
            isHeader: true
          });
          currentBill = bill;
        }
        groupedItems.push(item);
      });

      setTakeoffData(groupedItems);
      setProjectData(results);
      setEditorKey(prev => prev + 1); // Reset editor on new calculation
      setActiveTab("takeoff");
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar - Optional, or just use full width layout since this component was full width originally. 
         The original matched the styling of others but was full width. 
         Stairs.jsx was full width. RoofMain.jsx was sidebar.
         UniversalTabs is flexible.
         I will keep the layout structure similar to original but wrapped to match the new 'App' feel if needed.
         Original had a top nav bar inside a container.
         I will stick to the original container layout but replace the nav bar with UniversalTabs.
      */}

      <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-gray-50 to-gray-200">
        <div className="max-w-7xl mx-auto w-full px-4 py-8 flex-1 flex flex-col">
          {/* Header / Nav */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md mb-6 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <Settings className="w-6 h-6" />
                  Drainage & Manhole Calculator
                </h1>
              </div>
            </div>

            <UniversalTabs
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              tabs={['calculator', '3d', 'takeoff', 'sheet', 'boq']}
            />
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-hidden flex flex-col relative">
            {activeTab === "calculator" && (
              <div className="p-6 h-full overflow-y-auto">
                <DrainageTakeoffForm
                  onCalculationComplete={handleCalculationComplete}
                />
              </div>
            )}

            {activeTab === "3d" && (
              <div className="h-full w-full relative">
                {calculationResults ? (
                  <>
                    <div className="absolute top-0 left-0 p-4 z-10 bg-black/50 text-white w-full">
                      <h2 className="text-xl font-bold">3D Visualization</h2>
                      <p className="text-sm text-gray-200">Use mouse to rotate, zoom, and pan</p>
                    </div>
                    <Canvas>
                      <PerspectiveCamera makeDefault position={[30, 25, 30]} />
                      <OrbitControls />
                      <DrainageScene3D
                        projectData={calculationResults}
                        calculationResults={calculationResults}
                      />
                    </Canvas>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Please perform a calculation to view the 3D model.
                  </div>
                )}
              </div>
            )}

            {activeTab === "takeoff" && (
              <div className="p-0 h-full overflow-y-auto">
                <EnglishMethodTakeoffSheet
                  key={editorKey}
                  initialItems={takeoffData.length > 0 ? takeoffData : undefined}
                  onChange={setTakeoffData}
                  projectInfo={{
                    projectName: projectData?.project_name || "Drainage Project",
                    clientName: "Client Name",
                    projectDate: new Date().toLocaleDateString()
                  }}
                />
              </div>
            )}

            {activeTab === "sheet" && (
              <div className="p-0 h-full overflow-y-auto">
                <UniversalSheet items={takeoffData} />
              </div>
            )}

            {activeTab === "boq" && (
              <div className="p-0 h-full overflow-y-auto">
                <UniversalBOQ items={takeoffData} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrainageComponenet;
