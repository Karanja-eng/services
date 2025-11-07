import React, { useState, useRef, useEffect } from "react";

import paper from "paper";
const defaultData = {
  width: 300,
  height: 400,
  rebar_count: 6,
  bar_diameter: 16,
  cover: 25,
  stirrup_diameter: 8,
};

const SmartDrawing = ({ columnData: initialData }) => {
  const canvasRef = useRef(null);
  console.log("columnData Recceived in child", initialData);

  const [columnData, setColumnData] = useState(initialData || defaultData);

  useEffect(() => {
    setColumnData(initialData);
  }, [initialData]);

  if (!columnData) return <p> Loading column data... </p>;

  const rebarLabel = `${columnData.rebar_count}Y${columnData.bar_diameter}`;

  return (
    <div className="p-2">
      <h2>Conceptual Drawing</h2>
      {/* <ColumnControls data={columnData} setData={setColumnData} /> */}
      <div className="mb-2 font-bold">
        Reinforcement Summary: {rebarLabel} bars
      </div>
      <ColumnCanvas canvasRef={canvasRef} columnData={columnData} />
    </div>
  );
};

//////////////////////////////////////////////

const mmToPx = 1.5;

const ColumnCanvas = ({ canvasRef, columnData }) => {
  useEffect(() => {
    const scope = new paper.PaperScope();
    scope.setup(canvasRef.current);
    scope.project.clear();

    const {
      width,
      height,
      rebar_count,
      bar_diameter,
      cover,
      stirrup_diameter,
      //hook_length,
    } = columnData;

    const colW = (width / 2) * mmToPx;
    const colH = (height / 2) * mmToPx;
    const x = 50;
    const y = 50;

    //Draw Column Outer Boundary
    new scope.Path.Rectangle({
      point: [x, y],
      size: [colW, colH],
      strokeColor: "black",
      fillColor: "#eee",
    });
    //LabelDimensions
    new scope.PointText({
      point: [x + colW / 2, y - 10],
      justification: "center",
      content: `width: ${width} mm`,
      fillcolor: "black",
      fontsize: 12,
    });

    new scope.PointText({
      point: [x + colH, y + colH / 2],
      justification: "center",
      content: `height: ${height} mm`,
      fillcolor: "black",
      fontsize: 12,
    });

    //draw Stirrups (inner booundary- cover)
    const stirrupInset = (cover / 2) * mmToPx;
    new scope.Path.Rectangle({
      point: [x + stirrupInset, y + stirrupInset],
      size: [colW - 2 * stirrupInset, colH - 2 * stirrupInset],
      strokeColor: "green",
    });

    // Rebar Placement Logic
    const rebarRadius = (bar_diameter / 2) * mmToPx;
    const padding =
      (cover * mmToPx + (stirrup_diameter / 2) * mmToPx + rebarRadius) / 1.5;

    const positions = [];
    if (rebar_count === 4) {
      //4 corners
      positions.push([x + padding, y + padding]);
      positions.push([x + colW - padding, y + padding]);
      positions.push([x + padding, y + colH - padding]);
      positions.push([x + colW - padding, y + colH - padding]);
    } else {
      //Distribute along perimeter
      const barsPerSide = Math.ceil(rebar_count / 4);
      for (let i = 0; i < barsPerSide; i++) {
        const hSpacing = colW - 2 * padding;
        const vSpacing = colH - 2 * padding;

        positions.push([x + padding + i * hSpacing, y + padding]);
        positions.push([x + padding + i * hSpacing, y + colH - padding]);
        positions.push([x + padding, y + padding + i * vSpacing]);
        positions.push([x + colW - padding, y + padding + i * vSpacing]);
      }
    }

    //Draw Rebars and Hooks
    positions.slice(0, rebar_count).forEach(([cx, cy], index) => {
      new scope.Path.Circle({
        center: [cx, cy],
        radius: rebarRadius,
        fillColor: "black",
        strokeColor: "black",
      });

      //   new scope.Path.Line({
      //     from: [cx, cy],
      //     to: [cx + hook_length * mmToPx, cy],
      //     strokeColor: "blue",
      //     strokeWidth: 1,
      //   });

      //Add label to Each Rebar
      //   new scope.PointText({
      //     point: [cx, cy - 10],
      //     justification: "center",
      //     content: `T${index + 1}`,
      //     fillColor: "black",
      //     fontSize: 10,
      //   });
    });
  }, [columnData, canvasRef]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={600}
      className="   rounded-xl"
      style={{ width: "300px", height: "300px" }}
    />
  );
};

/////////////////////////////////////

// const ColumnControls = ({ data, setData }) => {
//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setData((prev) => ({ ...prev, [name]: parseFloat(value) }));
//   };

//   return (
//     <div className="mb-1 grid gap-4">
//       <label>
//         width (mm):
//         <input
//           name="width"
//           type="number"
//           value={data.width}
//           onChange={handleChange}
//         />
//       </label>
//       <label>
//         Height (mm):
//         <input
//           name="height"
//           type="number"
//           value={data.height}
//           onChange={handleChange}
//         />
//       </label>
//       <label>
//         Rebar Count
//         <input
//           name="rebar_count"
//           type="number"
//           value={data.rebar_count}
//           onChange={handleChange}
//         />
//       </label>
//       <label>
//         Bar Diameter (mm)
//         <input
//           name="bar_diameter"
//           type="number"
//           value={data.bar_diameter}
//           onChange={handleChange}
//         />
//       </label>
//       <label>
//         Cover (mm)
//         <input
//           name="cover"
//           type="number"
//           value={data.cover}
//           onChange={handleChange}
//         />
//       </label>
//       <label>
//         Stirrup Diameter (mm)
//         <input
//           name="stirrup_diameter"
//           type="number"
//           value={data.stirrup_diameter}
//           onChange={handleChange}
//         />
//       </label>
//       <label>
//         Hook Length (mm)
//         <input
//           name="hook_length"
//           type="number"
//           value={data.hook_length}
//           onChange={handleChange}
//         />
//       </label>
//     </div>
//   );
// };

export default SmartDrawing;
