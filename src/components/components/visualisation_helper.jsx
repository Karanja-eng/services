import { useState } from "react";
import StructuralVisualizationComponent from "../../Drawings/visualise_component";

export function ThreeD_helper() {
  const [show3D, setShow3D] = useState(false);
  const [stairPropsFor3D, setStairPropsFor3D] = useState(null);

  function Three_D_Button(inputs, stairProps) {
    return (
      <button
        onClick={() => {
          // prepare and normalize inputs for the DrawStairsMST1 component
          // convert mm → m where applicable (your inputs have some mm fields)

          setStairPropsFor3D(stairProps);
          setShow3D(true);
        }}
        className="w-full mt-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg"
      >
        Show 3D
      </button>
    );
  }

  function Three_D_Popup(data_object) {
    return (
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
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShow3D(false)}
                className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200"
              >
                ← Back
              </button>
              <h3 className="font-semibold">3D Stair Visualization</h3>
            </div>

            {/* optional quick toggles */}
            <div className="flex items-center gap-2 pr-2">
              {/* you can later add export/print controls here */}
              <button
                onClick={() => {
                  /* example: zoom to fit could be implemented in the viz component by exposing a ref */
                }}
                className="px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-800"
              >
                Fit
              </button>
            </div>
          </div>

          {/* visualization container */}
          <div className="w-full h-[calc(100%-64px)]">
            {/* render the StructuralVisualizationComponent and pass stair props */}
            <StructuralVisualizationComponent
              // theme={theme}
              visible={show3D}
              onClose={() => setShow3D(false)}
              elementType={stairPropsFor3D.elementType} // or "beam_RC1", "column_RC2", "slab_FF1"
              elementData={data_object} // contains all inputs and results
            />
          </div>
        </div>
      </div>
    );
  }

  return { Three_D_Button, Three_D_Popup };
}
