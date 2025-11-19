import React, { useState, useRef } from "react";
import { Download, Printer, Plus, Trash2, Edit2 } from "lucide-react";

export default function EnglishMethodTakeoffSheet() {
  const [projectInfo, setProjectInfo] = useState({
    projectName: "PROPOSED EXTERNAL WORKS",
    location: "Sample Site",
    drawingNo: "DRG No.01",
    date: new Date().toISOString().split("T")[0],
    takenBy: "",
    checkedBy: "",
    scale: "1:100",
  });

  // Sample takeoff items following English Method format
  const [takeoffItems, setTakeoffItems] = useState([
    {
      id: 1,
      billNo: "A",
      itemNo: "1",
      description: "DEMOLITION & SITE CLEARANCE (Class D)",
      dimensions: [],
      quantity: null,
      unit: "",
      rate: null,
      amount: null,
      isHeader: true,
    },
    {
      id: 2,
      billNo: "A",
      itemNo: "1.1",
      description: "Site clearance, general",
      dimensions: [
        {
          id: 1,
          length: "50.00",
          width: "40.00",
          height: "",
          number: "1",
          deduction: false,
        },
        {
          id: 2,
          length: "12.00",
          width: "10.00",
          height: "",
          number: "1",
          deduction: true,
        },
      ],
      quantity: 1880.0,
      unit: "m²",
      rate: 150.0,
      amount: 282000.0,
      isHeader: false,
    },
    {
      id: 3,
      billNo: "A",
      itemNo: "1.2",
      description: "Remove trees, girth 0.5-2m",
      dimensions: [
        {
          id: 1,
          length: "",
          width: "",
          height: "",
          number: "3",
          deduction: false,
        },
      ],
      quantity: 3,
      unit: "no",
      rate: 5000.0,
      amount: 15000.0,
      isHeader: false,
    },
    {
      id: 4,
      billNo: "A",
      itemNo: "1.3",
      description: "Remove trees, girth >2m",
      dimensions: [
        {
          id: 1,
          length: "",
          width: "",
          height: "",
          number: "2",
          deduction: false,
        },
      ],
      quantity: 2,
      unit: "no",
      rate: 8000.0,
      amount: 16000.0,
      isHeader: false,
    },
    {
      id: 5,
      billNo: "B",
      itemNo: "2",
      description: "EARTHWORKS (Class E)",
      dimensions: [],
      quantity: null,
      unit: "",
      rate: null,
      amount: null,
      isHeader: true,
    },
    {
      id: 6,
      billNo: "B",
      itemNo: "2.1",
      description:
        "Excavate vegetable soil for preservation, average depth 150mm",
      dimensions: [
        {
          id: 1,
          length: "50.00",
          width: "40.00",
          height: "0.15",
          number: "1",
          deduction: false,
        },
      ],
      quantity: 300.0,
      unit: "m³",
      rate: 250.0,
      amount: 75000.0,
      isHeader: false,
    },
    {
      id: 7,
      billNo: "B",
      itemNo: "2.2",
      description: "Mass excavation, maximum depth 0.5m",
      subItems: ["Road area", "Parking area", "Bellmouth"],
      dimensions: [
        {
          id: 1,
          length: "32.00",
          width: "9.20",
          height: "0.50",
          number: "1",
          deduction: false,
        },
        {
          id: 2,
          length: "25.00",
          width: "9.20",
          height: "0.50",
          number: "1",
          deduction: false,
        },
        {
          id: 3,
          length: "8.50",
          width: "",
          height: "0.50",
          number: "1",
          deduction: false,
          note: "(bellmouth area)",
        },
      ],
      quantity: 150.55,
      unit: "m³",
      rate: 350.0,
      amount: 52692.5,
      isHeader: false,
    },
    {
      id: 8,
      billNo: "B",
      itemNo: "2.3",
      description: "Disposal of excavated material",
      dimensions: [
        {
          id: 1,
          length: "150.55",
          width: "",
          height: "",
          number: "1",
          deduction: false,
        },
      ],
      quantity: 150.55,
      unit: "m³",
      rate: 200.0,
      amount: 30110.0,
      isHeader: false,
    },
    {
      id: 9,
      billNo: "B",
      itemNo: "2.4",
      description: "Filling, imported murram, compacted in layers",
      dimensions: [
        {
          id: 1,
          length: "32.00",
          width: "9.20",
          height: "0.20",
          number: "1",
          deduction: false,
        },
        {
          id: 2,
          length: "25.00",
          width: "9.20",
          height: "0.20",
          number: "1",
          deduction: false,
        },
      ],
      quantity: 105.04,
      unit: "m³",
      rate: 800.0,
      amount: 84032.0,
      isHeader: false,
    },
    {
      id: 10,
      billNo: "C",
      itemNo: "3",
      description: "ROADS & PAVINGS (Class R)",
      dimensions: [],
      quantity: null,
      unit: "",
      rate: null,
      amount: null,
      isHeader: true,
    },
    {
      id: 11,
      billNo: "C",
      itemNo: "3.1",
      description: "Hardcore filling, 200mm thick, compacted",
      dimensions: [
        {
          id: 1,
          length: "32.00",
          width: "9.20",
          height: "",
          number: "1",
          deduction: false,
        },
        {
          id: 2,
          length: "25.00",
          width: "9.20",
          height: "",
          number: "1",
          deduction: false,
        },
      ],
      quantity: 524.4,
      unit: "m²",
      rate: 650.0,
      amount: 340860.0,
      isHeader: false,
    },
    {
      id: 12,
      billNo: "C",
      itemNo: "3.2",
      description: "Bitumen bound macadam base course, 150mm thick",
      dimensions: [
        {
          id: 1,
          length: "32.00",
          width: "9.00",
          height: "",
          number: "1",
          deduction: false,
        },
      ],
      quantity: 288.0,
      unit: "m²",
      rate: 1200.0,
      amount: 345600.0,
      isHeader: false,
    },
    {
      id: 13,
      billNo: "C",
      itemNo: "3.3",
      description: "Bitumen premix wearing course, 50mm thick",
      dimensions: [
        {
          id: 1,
          length: "32.00",
          width: "9.00",
          height: "",
          number: "1",
          deduction: false,
        },
      ],
      quantity: 288.0,
      unit: "m²",
      rate: 850.0,
      amount: 244800.0,
      isHeader: false,
    },
    {
      id: 14,
      billNo: "C",
      itemNo: "3.4",
      description: "PCC kerb, 125x250mm, straight",
      dimensions: [
        {
          id: 1,
          length: "32.00",
          width: "",
          height: "",
          number: "2",
          deduction: false,
        },
      ],
      quantity: 64.0,
      unit: "m",
      rate: 1500.0,
      amount: 96000.0,
      isHeader: false,
    },
    {
      id: 15,
      billNo: "C",
      itemNo: "3.5",
      description: "PCC channel, 125x100mm, straight",
      dimensions: [
        {
          id: 1,
          length: "32.00",
          width: "",
          height: "",
          number: "2",
          deduction: false,
        },
      ],
      quantity: 64.0,
      unit: "m",
      rate: 1200.0,
      amount: 76800.0,
      isHeader: false,
    },
    {
      id: 16,
      billNo: "C",
      itemNo: "3.6",
      description: "Concrete backing to kerb, 100mm thick",
      dimensions: [
        {
          id: 1,
          length: "32.00",
          width: "0.20",
          height: "0.10",
          number: "2",
          deduction: false,
        },
      ],
      quantity: 1.28,
      unit: "m³",
      rate: 12000.0,
      amount: 15360.0,
      isHeader: false,
    },
  ]);

  const [editingCell, setEditingCell] = useState(null);

  const calculateDimensionTotal = (dimensions) => {
    if (!dimensions || dimensions.length === 0) return 0;

    return dimensions.reduce((total, dim) => {
      const num = parseFloat(dim.number) || 1;
      const len = parseFloat(dim.length) || 1;
      const wid = parseFloat(dim.width) || 1;
      const hgt = parseFloat(dim.height) || 1;

      let dimTotal = num * len;
      if (dim.width) dimTotal *= wid;
      if (dim.height) dimTotal *= hgt;

      return dim.deduction ? total - dimTotal : total + dimTotal;
    }, 0);
  };

  const addNewItem = () => {
    const newItem = {
      id: Date.now(),
      billNo: "A",
      itemNo: "",
      description: "New item",
      dimensions: [
        {
          id: 1,
          length: "",
          width: "",
          height: "",
          number: "1",
          deduction: false,
        },
      ],
      quantity: 0,
      unit: "m²",
      rate: 0,
      amount: 0,
      isHeader: false,
    };
    setTakeoffItems([...takeoffItems, newItem]);
  };

  const deleteItem = (id) => {
    setTakeoffItems(takeoffItems.filter((item) => item.id !== id));
  };

  const updateDimension = (itemId, dimId, field, value) => {
    setTakeoffItems(
      takeoffItems.map((item) => {
        if (item.id === itemId) {
          const updatedDimensions = item.dimensions.map((dim) =>
            dim.id === dimId ? { ...dim, [field]: value } : dim
          );
          const newQuantity = calculateDimensionTotal(updatedDimensions);
          const newAmount = item.rate ? newQuantity * item.rate : 0;
          return {
            ...item,
            dimensions: updatedDimensions,
            quantity: newQuantity,
            amount: newAmount,
          };
        }
        return item;
      })
    );
  };

  const addDimension = (itemId) => {
    setTakeoffItems(
      takeoffItems.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            dimensions: [
              ...item.dimensions,
              {
                id: Date.now(),
                length: "",
                width: "",
                height: "",
                number: "1",
                deduction: false,
              },
            ],
          };
        }
        return item;
      })
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const exportToPDF = () => {
    alert("PDF export functionality would be implemented here");
  };

  const exportToXML = () => {
    const xmlData = generateXML(takeoffItems, projectInfo);
    const blob = new Blob([xmlData], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `takeoff-${projectInfo.drawingNo}.xml`;
    link.click();
  };

  const generateXML = (items, info) => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += "<TakeoffSheet>\n";
    xml += `  <ProjectInfo>\n`;
    xml += `    <ProjectName>${info.projectName}</ProjectName>\n`;
    xml += `    <Location>${info.location}</Location>\n`;
    xml += `    <DrawingNo>${info.drawingNo}</DrawingNo>\n`;
    xml += `    <Date>${info.date}</Date>\n`;
    xml += `  </ProjectInfo>\n`;
    xml += `  <Items>\n`;

    items.forEach((item) => {
      xml += `    <Item>\n`;
      xml += `      <BillNo>${item.billNo}</BillNo>\n`;
      xml += `      <ItemNo>${item.itemNo}</ItemNo>\n`;
      xml += `      <Description>${item.description}</Description>\n`;
      xml += `      <Quantity>${item.quantity || 0}</Quantity>\n`;
      xml += `      <Unit>${item.unit}</Unit>\n`;
      xml += `      <Rate>${item.rate || 0}</Rate>\n`;
      xml += `      <Amount>${item.amount || 0}</Amount>\n`;
      xml += `    </Item>\n`;
    });

    xml += `  </Items>\n`;
    xml += "</TakeoffSheet>";
    return xml;
  };

  const calculateSubtotal = (billNo) => {
    return takeoffItems
      .filter((item) => item.billNo === billNo && !item.isHeader && item.amount)
      .reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  const calculateGrandTotal = () => {
    return takeoffItems
      .filter((item) => !item.isHeader && item.amount)
      .reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        padding: "20px",
        maxWidth: "1400px",
        margin: "0 auto",
      }}
    >
      <style>{`
        @media print {
          .no-print { display: none; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
        }
        .takeoff-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
          font-size: 11px;
        }
        .takeoff-table th,
        .takeoff-table td {
          border: 1px solid #000;
          padding: 6px 8px;
          text-align: left;
        }
        .takeoff-table th {
          background: #f0f0f0;
          font-weight: bold;
          text-align: center;
        }
        .dim-cell {
          text-align: right;
          font-family: 'Courier New', monospace;
        }
        .header-row {
          background: #e8f4f8;
          font-weight: bold;
        }
        .header-row td {
          font-size: 12px;
          padding: 10px;
        }
        .dimension-row {
          background: #fafafa;
        }
        .underline {
          border-bottom: 1px solid #000;
          display: inline-block;
          min-width: 60px;
        }
        .deduction {
          color: red;
        }
        .subtotal-row {
          background: #fffacd;
          font-weight: bold;
        }
        .grand-total-row {
          background: #90ee90;
          font-weight: bold;
          font-size: 13px;
        }
        input[type="text"],
        input[type="number"] {
          border: 1px solid #ccc;
          padding: 4px;
          width: 100%;
          box-sizing: border-box;
        }
        .action-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          margin: 0 2px;
        }
        .action-btn:hover {
          opacity: 0.7;
        }
      `}</style>

      {/* Header Section */}
      <div className="no-print" style={{ marginBottom: "20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h1 style={{ margin: 0 }}>Quantity Takeoff Sheet</h1>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={addNewItem}
              style={{
                padding: "10px 20px",
                background: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Plus size={16} /> Add Item
            </button>
            <button
              onClick={handlePrint}
              style={{
                padding: "10px 20px",
                background: "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Printer size={16} /> Print
            </button>
            <button
              onClick={exportToPDF}
              style={{
                padding: "10px 20px",
                background: "#FF9800",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Download size={16} /> PDF
            </button>
            <button
              onClick={exportToXML}
              style={{
                padding: "10px 20px",
                background: "#9C27B0",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Download size={16} /> XML
            </button>
          </div>
        </div>
      </div>

      {/* Project Information Header */}
      <div
        style={{
          border: "2px solid #000",
          padding: "15px",
          marginBottom: "20px",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ width: "70%", verticalAlign: "top" }}>
                <h2 style={{ margin: "0 0 10px 0" }}>
                  {projectInfo.projectName}
                </h2>
                <p style={{ margin: "5px 0" }}>
                  <strong>Location:</strong> {projectInfo.location}
                </p>
                <p style={{ margin: "5px 0" }}>
                  <strong>Drawing No:</strong> {projectInfo.drawingNo}
                </p>
              </td>
              <td style={{ width: "30%", verticalAlign: "top" }}>
                <p style={{ margin: "5px 0" }}>
                  <strong>Date:</strong> {projectInfo.date}
                </p>
                <p style={{ margin: "5px 0" }}>
                  <strong>Scale:</strong> {projectInfo.scale}
                </p>
                <p style={{ margin: "5px 0" }}>
                  <strong>Taken by:</strong> {projectInfo.takenBy}
                </p>
                <p style={{ margin: "5px 0" }}>
                  <strong>Checked by:</strong> {projectInfo.checkedBy}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Takeoff Table */}
      <table className="takeoff-table">
        <thead>
          <tr>
            <th style={{ width: "40px" }}>Bill</th>
            <th style={{ width: "50px" }}>Item</th>
            <th style={{ width: "300px" }}>Description</th>
            <th style={{ width: "60px" }}>No.</th>
            <th style={{ width: "80px" }}>Length</th>
            <th style={{ width: "80px" }}>Width</th>
            <th style={{ width: "80px" }}>Height</th>
            <th style={{ width: "100px" }}>Quantity</th>
            <th style={{ width: "50px" }}>Unit</th>
            <th style={{ width: "100px" }}>Rate</th>
            <th style={{ width: "120px" }}>Amount</th>
            <th className="no-print" style={{ width: "60px" }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {takeoffItems.map((item, itemIndex) => {
            if (item.isHeader) {
              return (
                <React.Fragment key={item.id}>
                  <tr className="header-row">
                    <td>{item.billNo}</td>
                    <td>{item.itemNo}</td>
                    <td colSpan="9">{item.description}</td>
                    <td className="no-print">
                      <button
                        className="action-btn"
                        onClick={() => deleteItem(item.id)}
                      >
                        <Trash2 size={14} color="red" />
                      </button>
                    </td>
                  </tr>
                  {/* Show subtotal before next section */}
                  {itemIndex > 0 &&
                    takeoffItems[itemIndex - 1] &&
                    takeoffItems[itemIndex - 1].billNo !== item.billNo && (
                      <tr className="subtotal-row">
                        <td
                          colSpan="10"
                          style={{ textAlign: "right", paddingRight: "20px" }}
                        >
                          Sub-total {takeoffItems[itemIndex - 1].billNo}:
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {calculateSubtotal(
                            takeoffItems[itemIndex - 1].billNo
                          ).toLocaleString("en-KE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="no-print"></td>
                      </tr>
                    )}
                </React.Fragment>
              );
            }

            const dimensionRows = item.dimensions || [];
            return (
              <React.Fragment key={item.id}>
                {dimensionRows.map((dim, dimIndex) => (
                  <tr
                    key={dim.id}
                    className={dimIndex > 0 ? "dimension-row" : ""}
                  >
                    {dimIndex === 0 && (
                      <>
                        <td rowSpan={dimensionRows.length}>{item.billNo}</td>
                        <td rowSpan={dimensionRows.length}>{item.itemNo}</td>
                        <td rowSpan={dimensionRows.length}>
                          {item.description}
                          {item.subItems && (
                            <div
                              style={{
                                marginTop: "5px",
                                fontSize: "10px",
                                color: "#666",
                              }}
                            >
                              {item.subItems.map((sub, i) => (
                                <div key={i}>• {sub}</div>
                              ))}
                            </div>
                          )}
                        </td>
                      </>
                    )}
                    <td className="dim-cell">
                      <input
                        type="text"
                        value={dim.number}
                        onChange={(e) =>
                          updateDimension(
                            item.id,
                            dim.id,
                            "number",
                            e.target.value
                          )
                        }
                        style={{ textAlign: "right" }}
                      />
                    </td>
                    <td className="dim-cell">
                      <input
                        type="text"
                        value={dim.length}
                        onChange={(e) =>
                          updateDimension(
                            item.id,
                            dim.id,
                            "length",
                            e.target.value
                          )
                        }
                        style={{ textAlign: "right" }}
                      />
                    </td>
                    <td className="dim-cell">
                      <input
                        type="text"
                        value={dim.width}
                        onChange={(e) =>
                          updateDimension(
                            item.id,
                            dim.id,
                            "width",
                            e.target.value
                          )
                        }
                        style={{ textAlign: "right" }}
                      />
                    </td>
                    <td className="dim-cell">
                      <input
                        type="text"
                        value={dim.height}
                        onChange={(e) =>
                          updateDimension(
                            item.id,
                            dim.id,
                            "height",
                            e.target.value
                          )
                        }
                        className={
                          dimIndex === dimensionRows.length - 1
                            ? "underline"
                            : ""
                        }
                        style={{ textAlign: "right" }}
                      />
                    </td>
                    {dimIndex === 0 && (
                      <>
                        <td
                          rowSpan={dimensionRows.length}
                          style={{ textAlign: "right", fontWeight: "bold" }}
                        >
                          {item.quantity ? item.quantity.toFixed(2) : "0.00"}
                        </td>
                        <td
                          rowSpan={dimensionRows.length}
                          style={{ textAlign: "center" }}
                        >
                          {item.unit}
                        </td>
                        <td
                          rowSpan={dimensionRows.length}
                          style={{ textAlign: "right" }}
                        >
                          {item.rate ? item.rate.toLocaleString() : "-"}
                        </td>
                        <td
                          rowSpan={dimensionRows.length}
                          style={{ textAlign: "right", fontWeight: "bold" }}
                        >
                          {item.amount
                            ? item.amount.toLocaleString("en-KE", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : "-"}
                        </td>
                        <td rowSpan={dimensionRows.length} className="no-print">
                          <button
                            className="action-btn"
                            onClick={() => addDimension(item.id)}
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            className="action-btn"
                            onClick={() => deleteItem(item.id)}
                          >
                            <Trash2 size={14} color="red" />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </React.Fragment>
            );
          })}

          {/* Final subtotal */}
          {takeoffItems.length > 0 && (
            <tr className="subtotal-row">
              <td
                colSpan="10"
                style={{ textAlign: "right", paddingRight: "20px" }}
              >
                Sub-total {takeoffItems[takeoffItems.length - 1].billNo}:
              </td>
              <td style={{ textAlign: "right" }}>
                {calculateSubtotal(
                  takeoffItems[takeoffItems.length - 1].billNo
                ).toLocaleString("en-KE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
              <td className="no-print"></td>
            </tr>
          )}

          {/* Grand Total */}
          <tr className="grand-total-row">
            <td
              colSpan="10"
              style={{ textAlign: "right", paddingRight: "20px" }}
            >
              GRAND TOTAL:
            </td>
            <td style={{ textAlign: "right", fontSize: "14px" }}>
              {calculateGrandTotal().toLocaleString("en-KE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </td>
            <td className="no-print"></td>
          </tr>
        </tbody>
      </table>

      {/* Footer Notes */}
      <div style={{ marginTop: "30px", fontSize: "11px" }}>
        <p>
          <strong>NOTES:</strong>
        </p>
        <ol>
          <li>All quantities are net unless otherwise stated</li>
          <li>Rates include for labour, materials, and plant</li>
          <li>Measurement in accordance with CESMM4</li>
          <li>Deductions shown in red</li>
        </ol>
      </div>
    </div>
  );
}
