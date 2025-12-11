import { useState } from "react";
import StructuralVisualizationComponent from "../Drawings/visualise_component";

export default function Wall3DVisualization({
  inputs,
  results,
  theme = "light",
  wallType = "rectangular",
}) {
  const [show3D, setShow3D] = useState(false);
  const handleClose = () => setShow3D(false);

  const getWallLabel = () => {
    const labels = {
      rectangular: "Rectangular Wall",
      sloped: "Sloped Wall",
      "stepped-wall": "Stepped Wall",
      "buttressed-wall": "Buttressed Wall",
      "tee-wall": "Tee Wall",
    };
    return labels[wallType] || wallType;
  };

  return (
    <>
      <button
        onClick={() => setShow3D(true)}
        className="w-full mt-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg"
      >
        Show 3D Visualization
      </button>

      {show3D && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
          <div className="relative m-6 w-[calc(100%-3rem)] h-[calc(100%-3rem)] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClose}
                  className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  ← Back
                </button>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {getWallLabel()} - 3D Visualization
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Wall Design
                  </p>
                </div>
              </div>
              <button className="px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300">
                Fit
              </button>
            </div>
            <div className="w-full h-[calc(100%-64px)]">
              <StructuralVisualizationComponent
                theme={theme}
                visible={show3D}
                onClose={handleClose}
                elementType="wall_MW1"
                elementData={{ inputs, results }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
