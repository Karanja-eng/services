import React, { useState } from "react";
import axios from "axios";
import SmartDrawing from "./Drawings/SmartColumn";

function ColumnPage() {
  const [inputs, setInputs] = useState({
    Load: "",
    Fcu: "",
    Fy: "",
    AreaP: "",
  });
  const [columnData, setcolumnData] = useState(null);

  const handleChange = (e) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (
        isNaN(parseFloat(inputs.Load)) ||
        isNaN(parseFloat(inputs.Fcu)) ||
        isNaN(parseFloat(inputs.Fy)) ||
        isNaN(parseFloat(inputs.AreaP))
      ) {
        alert("Please enter valid numbers for all fields");
        return;
      }
      const res = await axios.post(
        "http://127.0.0.1:8000/column_Design",
        {
          Load: parseFloat(inputs.Load),
          Fcu: parseFloat(inputs.Fcu),
          Fy: parseFloat(inputs.Fy),
          AreaP: parseFloat(inputs.AreaP),
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );
      setcolumnData(res.data);
    } catch (error) {
      alert("Error: " + error.message);
    }
  };
  return (
    <div className="bg-gray-100  flex flex-row gap-4 border shadow-md rounded-xl">
      <div className="flex flex-row gap-4 justify-between">
        <div className="p-3 border shadow-md rounded-xl ">
          <form
            className="bg-white p-3 roundeded-xl shadow-md w-full  h-full max-w-md"
            onSubmit={handleSubmit}
          >
            <h2 className="text-2xl font-bold mb-1 text-center">
              Column Design
            </h2>
            {["Load", "Fcu", "Fy", "AreaP"].map((field) => (
              <div key={field} className="mb-2">
                <label className="block text-slate-700 font-medium mb-1">
                  {field.toUpperCase()}(
                  {field === "Load"
                    ? "Kn"
                    : field === "Fcu" || field === "Fy"
                    ? "N/mm²"
                    : "%"}
                  )
                </label>
                <input
                  type="number"
                  name={field}
                  value={inputs[field]}
                  onChange={handleChange}
                  required
                  className=" bg-ble-600 px-2 border border-gray-300
                            rounded-md shadow-sm *: focus:outline-none 
                            focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg
                hover:bg-blue-700 transition "
            >
              Design Column
            </button>
          </form>
        </div>
        <div className="p-4 w-60">
          {columnData && (
            <div
              className="mt-6 bg-white p-6 rounded-xl shadow-md w-full
                max-w-md"
            >
              <h3 className="text-xl font-semibold mb-4 text-center">
                Design Output
              </h3>
              <p>
                <strong>Number of Bars:</strong> {columnData.rebar_count}
              </p>
              <p>
                <strong>Main Diameter:</strong> {columnData.bar_diameter} mm
              </p>
              <p>
                <strong>Area of Steel:</strong> {columnData.area} mm²
              </p>
              <p>
                <strong>Diameter of Links:</strong>{" "}
                {columnData.stirrup_diameter} mm
              </p>
              <p>
                <strong>Spacing Of Links:</strong> {columnData.spacing} mm
              </p>
              <p>
                <strong>Column width:</strong> {columnData.width} mm
              </p>
              <p>
                <strong>Column height:</strong> {columnData.height} mm
              </p>
            </div>
          )}
        </div>
      </div>

      <div>
        <SmartDrawing columnData={columnData} />
      </div>
    </div>
  );
}
export default ColumnPage;
