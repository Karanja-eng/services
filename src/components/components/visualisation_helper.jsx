import { useState } from "react";
import StructuralVisualizationComponent from "../Drawings/visualise_component";

/**
 * Unified 3D Visualization Component
 * Handles both the Show 3D button and the full-screen 3D visualization modal
 * 
 * Props:
 * - inputs: Object with stair design inputs (span, width, waist_thickness, etc.)
 * - stairType: "simply_supported" | "cantilever" (for Eurocode) or "supported" | "cantilever" (for BS8110)
 * - dataObject: Object with { inputs, results } for the visualization
 * - codeStandard: "eurocode" | "bs8110" (for display in header)
 * - STAIR_TYPE_TO_ELEMENT: Mapping object { key: "element_type" }
 * - theme: "light" | "dark" (optional)
 */
export default function Stair3DVisualization({
  inputs,
  stairType,
  dataObject,
  codeStandard = "eurocode",
  STAIR_TYPE_TO_ELEMENT,
  theme = "light",
}) {
  const [show3D, setShow3D] = useState(false);
  const [stairPropsFor3D, setStairPropsFor3D] = useState(null);

  const handleShow3D = () => {
    // Prepare and normalize inputs for 3D visualization
    // Convert mm → m where applicable
    const stairProps = {
      flightLength: inputs.span, // span is in meters already
      flightWidth: inputs.width, // width in meters
      waistThickness: (inputs.waist_thickness || 150) / 1000, // mm -> m
      riserHeight: (inputs.riser_height || 175) / 1000, // mm -> m
      goingDepth: (inputs.tread_length || 250) / 1000, // mm -> m
      numSteps: inputs.num_risers || 14,
      landingLength: 1.2,
      landingThickness: (inputs.waist_thickness || 150) / 1000,
      cover: (inputs.cover || 30) / 1000,
      showConcrete: true,
      showRebar: true,
      opacity: 0.6,
      wireframe: false,
      // optional color overrides:
      colors: {
        concrete: "#c0c0c0",
        waist: "#b0b0b0",
        landing: "#a8a8a8",
        mainBars: "#cc3333",
        distributionBars: "#3366cc",
        uBars: "#ff6600",
      },
      elementType: STAIR_TYPE_TO_ELEMENT[stairType],
    };

    setStairPropsFor3D(stairProps);
    setShow3D(true);
  };

  const codeLabel =
    codeStandard === "eurocode"
      ? "Eurocode EN 1992-1-1"
      : "BS 8110-1:1997";

  return (
    <>
      {/* Show 3D Button */}
      <button
        onClick={handleShow3D}
        className="w-full mt-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg"
      >
        Show 3D
      </button>

      {/* 3D Visualization Modal */}
      {show3D && stairPropsFor3D && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center"
          role="dialog"
          aria-modal="true"
        >
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShow3D(false)}
          />

          {/* content */}
          <div className="relative m-6 w-[calc(100%-3rem)] h-[calc(100%-3rem)] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
            {/* header with Back button */}
            <div className="p-4 border-b flex items-center justify-between border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShow3D(false)}
                  className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  ← Back
                </button>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    3D Stair Visualization
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {codeLabel}
                  </p>
                </div>
              </div>

              {/* optional quick toggles */}
              <div className="flex items-center gap-2 pr-2">
                <button
                  onClick={() => {
                    /* zoom to fit could be implemented in the viz component by exposing a ref */
                  }}
                  className="px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Fit
                </button>
              </div>
            </div>

            {/* visualization container */}
            <div className="w-full h-[calc(100%-64px)]">
              {/* render the StructuralVisualizationComponent and pass stair props */}
              <StructuralVisualizationComponent
                theme={theme}
                visible={show3D}
                onClose={() => setShow3D(false)}
                elementType={stairPropsFor3D.elementType}
                elementData={dataObject}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
