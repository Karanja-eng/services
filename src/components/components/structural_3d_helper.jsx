import { useState } from "react";
import StructuralVisualizationComponent from "../Drawings/visualise_component";

/**
 * Generic Structural 3D Visualization Component
 * Works with all structural elements (beams, columns, foundations, walls, slabs, retaining walls)
 *
 * Props:
 * - elementType: "beam_RC1", "column_MC1", "foundation_FRC1", "wall_RC1", "slab_FF1", "retaining_RW1", etc.
 * - inputs: Design input parameters (varies by element type)
 * - results: Calculation results (optional)
 * - theme: "light" | "dark"
 * - codeStandard: "eurocode" | "bs8110" | "both"
 */
export default function Structural3DVisualization({
  elementType,
  inputs,
  results,
  theme = "light",
  codeStandard = "eurocode",
  onClose,
}) {
  const [show3D, setShow3D] = useState(false);

  const handleShow3D = () => {
    setShow3D(true);
  };

  const handleClose = () => {
    setShow3D(false);
    if (onClose) onClose();
  };

  // Generate element-specific label
  const getElementLabel = () => {
    const labels = {
      beam_RC1: "Beam - Simply Supported",
      beam_RC2: "Beam - Cantilever",
      beam_RC3: "Beam - Continuous",
      column_MC1: "Column - Rectangular",
      column_MC2: "Column - Circular",
      column_MC3: "Column - L-shaped",
      column_MC4: "Column - T-shaped",
      column_MC5: "Column - I-shaped",
      column_MC6: "Column - Circular with Helix",
      foundation_FRC1: "Foundation - Square Pad",
      foundation_FRC2: "Foundation - Rectangular Pad",
      foundation_FRC3: "Foundation - Strap Footing",
      wall_RC1: "Wall - Rectangular",
      wall_RC2: "Wall - Sloped",
      wall_RC3: "Wall - Complex",
      slab_FF1: "Slab - Flat",
      slab_FF2: "Slab - Waffle",
      slab_FF3: "Slab - Two-way",
      retaining_RW1: "Retaining Wall - Cantilever",
      retaining_RW2: "Retaining Wall - Gravity",
      retaining_RW3: "Retaining Wall - Anchored",
    };
    return labels[elementType] || elementType;
  };

  const codeLabel =
    codeStandard === "eurocode"
      ? "Eurocode"
      : codeStandard === "bs8110"
      ? "BS 8110"
      : "Standards";

  return (
    <>
      {/* Show 3D Button */}
      <button
        onClick={handleShow3D}
        className="w-full mt-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg"
      >
        Show 3D Visualization
      </button>

      {/* 3D Visualization Modal */}
      {show3D && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center"
          role="dialog"
          aria-modal="true"
        >
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={handleClose} />

          {/* content */}
          <div className="relative m-6 w-[calc(100%-3rem)] h-[calc(100%-3rem)] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
            {/* header with Back button */}
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
                    {getElementLabel()} - 3D Visualization
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {codeLabel}
                  </p>
                </div>
              </div>

              {/* quick toggles */}
              <div className="flex items-center gap-2 pr-2">
                <button
                  onClick={() => {
                    /* zoom to fit - can be exposed via ref */
                  }}
                  className="px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Fit
                </button>
              </div>
            </div>

            {/* visualization container */}
            <div className="w-full h-[calc(100%-64px)]">
              <StructuralVisualizationComponent
                theme={theme}
                visible={show3D}
                onClose={handleClose}
                elementType={elementType}
                elementData={{ inputs, results }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
