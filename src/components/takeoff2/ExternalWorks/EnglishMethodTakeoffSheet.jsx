import React, { useState, useRef, useEffect, useMemo } from "react";
import { Download, Printer, Plus, Trash2, Edit2, Copy } from "lucide-react";
import descriptionsData from "../../takeoff2/descriptions";

// Flatten descriptions for auto-complete
const ALL_DESCRIPTIONS = Object.values(descriptionsData).flat();

const EditableDescription = ({ value, onChange, placeholder }) => {
  const [inputValue, setInputValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  // Sync internal state if prop value changes externally
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const filteredSuggestions = useMemo(() => {
    if (!inputValue) return [];
    const lowerInput = inputValue.toLowerCase();
    return ALL_DESCRIPTIONS.filter((desc) =>
      desc.toLowerCase().includes(lowerInput)
    ).slice(0, 10); // Limit to top 10 matches for performance
  }, [inputValue]);

  const handleSelect = (desc) => {
    setInputValue(desc);
    onChange(desc);
    setShowSuggestions(false);
  };

  const handleChange = (e) => {
    const newVal = e.target.value;
    setInputValue(newVal);
    onChange(newVal);
    setShowSuggestions(true);
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={wrapperRef}
      style={{ position: "relative", width: "100%" }}
      className="no-print"
    >
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onFocus={() => setShowSuggestions(true)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "8px",
          border: "1px solid #ccc",
          borderRadius: "4px",
          fontSize: "13px",
          fontFamily: "Arial, sans-serif",
        }}
      />
      {showSuggestions && filteredSuggestions.length > 0 && (
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: "white",
            border: "1px solid #ddd",
            borderRadius: "0 0 4px 4px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            maxHeight: "200px",
            overflowY: "auto",
            zIndex: 1000,
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {filteredSuggestions.map((desc, idx) => (
            <li
              key={idx}
              onClick={() => handleSelect(desc)}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                borderBottom: "1px solid #f0f0f0",
                fontSize: "12px",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.target.style.background = "#f5f5f5")}
              onMouseLeave={(e) => (e.target.style.background = "white")}
            >
              {desc}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Default sample items if none provided
const DEFAULT_ITEMS = [
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
    description: "Excavate vegetable soil for preservation, average depth 150mm",
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
];

export default function EnglishMethodTakeoffSheet({
  initialItems = DEFAULT_ITEMS,
  onChange,
}) {
  const [projectInfo, setProjectInfo] = useState({
    projectName: "PROPOSED EXTERNAL WORKS",
    location: "Sample Site",
    drawingNo: "DRG No.01",
    date: new Date().toISOString().split("T")[0],
    takenBy: "",
    checkedBy: "",
    scale: "1:100",
  });

  const [takeoffItems, setTakeoffItems] = useState(initialItems);

  // Notify parent of changes whenever items update
  useEffect(() => {
    if (onChange) {
      onChange(takeoffItems);
    }
  }, [takeoffItems, onChange]);

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

  const addNewClass = () => {
    // Find the next Bill No logic could be improved, simplistic for now
    const lastItem = takeoffItems[takeoffItems.length - 1];
    const nextBillNo = lastItem
      ? String.fromCharCode(lastItem.billNo.charCodeAt(0) + 1)
      : "A";

    const newHeader = {
      id: Date.now(),
      billNo: nextBillNo,
      itemNo: "",
      description: "NEW WORK CLASS",
      dimensions: [],
      quantity: null,
      unit: "",
      rate: null,
      amount: null,
      isHeader: true,
    };

    // Add start item for this class
    const newItem = {
      id: Date.now() + 1,
      billNo: nextBillNo,
      itemNo: "1",
      description: "Description of work...",
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

    setTakeoffItems([...takeoffItems, newHeader, newItem]);
  };

  const updateItemNo = (id, newNo) => {
    setTakeoffItems((items) =>
      items.map((item) => (item.id === id ? { ...item, itemNo: newNo } : item))
    );
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

  const addItemBelow = (index) => {
    const newItem = {
      id: Date.now(),
      billNo: takeoffItems[index].billNo, // Inherit Bill No
      itemNo: "",
      description: "",
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
    const newItems = [...takeoffItems];
    newItems.splice(index + 1, 0, newItem);
    setTakeoffItems(newItems);
  };

  const deleteItem = (id) => {
    setTakeoffItems(takeoffItems.filter((item) => item.id !== id));
  };

  const updateItemDescription = (id, newDesc) => {
    setTakeoffItems(
      takeoffItems.map((item) =>
        item.id === id ? { ...item, description: newDesc } : item
      )
    );
  };

  const updateRate = (itemId, newRate) => {
    setTakeoffItems(
      takeoffItems.map((item) => {
        if (item.id === itemId) {
          const rate = parseFloat(newRate) || 0;
          const amount = item.quantity ? item.quantity * rate : 0;
          return { ...item, rate: rate, amount: amount };
        }
        return item;
      })
    );
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
          .no-print { display: none !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          input { border: none !important; padding: 0 !important; }
          button { display: none !important; }
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
        .subtotal-row {
          background: #fffacd;
          font-weight: bold;
        }
        input[type="text"],
        input[type="number"] {
          border: 1px solid #ddd;
          padding: 4px;
          width: 100%;
          box-sizing: border-box;
          font-family: inherit;
        }
        input:focus {
          outline: 2px solid #2196F3;
          border-color: transparent;
        }
        .action-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          margin: 0 2px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .action-btn:hover {
          background-color: #f0f0f0;
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
              onClick={addNewClass}
              style={{
                padding: "10px 20px",
                background: "#673AB7",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Plus size={16} /> Add Class
            </button>
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
            <th className="no-print" style={{ width: "70px" }}>
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
                    <td>
                      <input
                        type="text"
                        value={item.itemNo}
                        onChange={(e) => updateItemNo(item.id, e.target.value)}
                        style={{
                          textAlign: "center",
                          border: "none",
                          background: "transparent",
                          width: "100%",
                          color: "inherit",
                          fontWeight: "inherit"
                        }}
                      />
                    </td>
                    <td colSpan="9">
                      <EditableDescription
                        value={item.description}
                        onChange={(val) =>
                          updateItemDescription(item.id, val)
                        }
                        placeholder="Header Description..."
                      />
                    </td>
                    <td className="no-print">
                      <button
                        className="action-btn"
                        onClick={() => addItemBelow(itemIndex)}
                        title="Add Item Below"
                      >
                        <Plus size={14} color="green" />
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => deleteItem(item.id)}
                        title="Delete Row"
                      >
                        <Trash2 size={14} color="red" />
                      </button>
                    </td>
                  </tr>
                  {/* Show subtotal before next section (if logic applies) */}
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
                        <td rowSpan={dimensionRows.length}>
                          <input
                            type="text"
                            value={item.itemNo}
                            onChange={(e) => updateItemNo(item.id, e.target.value)}
                            style={{
                              textAlign: "center",
                              border: "none",
                              background: "transparent",
                              width: "100%"
                            }}
                          />
                        </td>
                        <td rowSpan={dimensionRows.length}>
                          <EditableDescription
                            value={item.description}
                            onChange={(val) =>
                              updateItemDescription(item.id, val)
                            }
                            placeholder="Type for suggestions..."
                          />
                        </td>
                      </>
                    )}
                    <td>
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
                        style={{ textAlign: "center" }}
                      />
                    </td>
                    <td>
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
                    <td>
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
                    <td>
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
                        style={{ textAlign: "right" }}
                      />
                    </td>
                    {dimIndex === 0 && (
                      <>
                        <td rowSpan={dimensionRows.length}>
                          {item.quantity?.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td rowSpan={dimensionRows.length}>{item.unit}</td>
                        <td rowSpan={dimensionRows.length} style={{ padding: 0 }}>
                          <input
                            type="number"
                            value={item.rate || ""}
                            onChange={(e) => updateRate(item.id, e.target.value)}
                            style={{
                              textAlign: "right",
                              width: "100%",
                              border: "none",
                              background: "transparent",
                              padding: "6px 8px"
                            }}
                            placeholder="0.00"
                          />
                        </td>
                        <td rowSpan={dimensionRows.length}>
                          {item.amount?.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td
                          rowSpan={dimensionRows.length}
                          className="no-print"
                          style={{ verticalAlign: "top" }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex' }}>
                              <button
                                className="action-btn"
                                onClick={() => addItemBelow(itemIndex)}
                                title="Add Item Below"
                              >
                                <Plus size={14} color="green" />
                              </button>
                              <button
                                className="action-btn"
                                onClick={() => deleteItem(item.id)}
                                title="Delete Item"
                              >
                                <Trash2 size={14} color="red" />
                              </button>
                            </div>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
          {/* Grand Total Row */}
          <tr className="subtotal-row" style={{ borderTop: "3px double #000" }}>
            <td colSpan="10" style={{ textAlign: "right", paddingRight: "20px", fontSize: "14px" }}>
              <strong>GRAND TOTAL:</strong>
            </td>
            <td style={{ textAlign: "right", fontSize: "14px" }}>
              {calculateGrandTotal().toLocaleString("en-KE", {
                style: "currency",
                currency: "KES",
                minimumFractionDigits: 2
              })}
            </td>
            <td className="no-print"></td>
          </tr>
        </tbody >
      </table >
    </div >
  );
}
