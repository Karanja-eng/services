import { useState } from "react";
import StructuralVisualizationComponent from "../Drawings/visualise_component";

export default function Foundation3DVisualization({
  inputs,
  results,
  theme = "light",
  foundationType = "pad",
}) {
  const [show3D, setShow3D] = useState(false);
  const handleClose = () => setShow3D(false);

  const getFoundationLabel = () => {
    const labels = {
      pad: "Pad Foundation",
      "square-pad": "Square Pad Foundation",
      "rectangular-pad": "Rectangular Pad Foundation",
      "strap-footing": "Strap Footing",
      "pile-cap": "Pile Cap Foundation",
      "combined-footing": "Combined Footing",
    };
    return labels[foundationType] || foundationType;
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
                    {getFoundationLabel()} - 3D Visualization
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Foundation Design
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
                elementType="foundation_MF1"
                elementData={{ inputs, results }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
