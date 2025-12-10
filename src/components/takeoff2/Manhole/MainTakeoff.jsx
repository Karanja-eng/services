import React, { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";

import DrainageTakeoffForm from "./DrainageTakeoffForm";
import TakeoffSheet from "./TakeoffSheet";
import DrainageScene3D from "./DrainageScene3D";




// Main App Component
const DrainageComponenet = () => {
  const [activeView, setActiveView] = useState("form");
  const [projectData, setProjectData] = useState(null);
  const [calculationResults, setCalculationResults] = useState(null);

  const handleCalculationComplete = (results) => {
    setCalculationResults(results);
    setActiveView("takeoff");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Navigation */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md mb-6 p-4">
          <div className="flex space-x-2">
            {["form", "takeoff", "3d"].map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                disabled={view !== "form" && !calculationResults}
                className={`px-6 py-2 rounded-lg font-medium transition ${activeView === view
                  ? "bg-blue-600 text-white"
                  : view !== "form" && !calculationResults
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
              >
                {view === "form"
                  ? "Input Form"
                  : view === "takeoff"
                    ? "Takeoff Sheet"
                    : "3D View"}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {activeView === "form" && (
          <DrainageTakeoffForm
            onCalculationComplete={(results) => {
              setCalculationResults(results);
              setProjectData(results);
              handleCalculationComplete(results);
            }}
          />
        )}

        {activeView === "takeoff" && calculationResults && (
          <TakeoffSheet
            calculationResults={calculationResults}
            projectData={calculationResults}
          />
        )}

        {activeView === "3d" && calculationResults && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 bg-gray-800 dark:bg-slate-900 text-white">
              <h2 className="text-xl font-bold">3D Visualization</h2>
              <p className="text-sm text-gray-300">
                Use mouse to rotate, zoom, and pan the view
              </p>
            </div>
            <div style={{ height: "600px" }}>
              <Canvas>
                <PerspectiveCamera makeDefault position={[30, 25, 30]} />
                <OrbitControls />
                <DrainageScene3D
                  projectData={calculationResults}
                  calculationResults={calculationResults}
                />
              </Canvas>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DrainageComponenet;
