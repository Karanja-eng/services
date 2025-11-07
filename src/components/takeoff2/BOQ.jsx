// BOQ.jsx - Bill of Quantities Component
import React, { useState, useEffect } from "react";
import { FileText, Eye, Calculator, Download, Printer } from "lucide-react";

const BOQ = ({
  approximateData,
  takeoffData,
  onViewDiagram,
  onGoToTakeoff,
  onGoToApproximate,
  onGoToDocuments,
}) => {
  const [manualBOQ, setManualBOQ] = useState([]);
  const [autoBOQ, setAutoBOQ] = useState([]);
  const [activeTab, setActiveTab] = useState("auto");
  const [nextBOQId, setNextBOQId] = useState(1);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (approximateData && approximateData.length > 0) {
      const generatedBOQ = approximateData.map((item, index) => ({
        id: index + 1,
        itemCode: `${String.fromCharCode(65 + Math.floor(index / 100))}${String(
          index + 1
        ).padStart(3, "0")}`,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        rate: item.totalCost / item.quantity,
        amount: item.totalCost,
      }));
      setAutoBOQ(generatedBOQ);
    }
  }, [approximateData]);

  const addManualBOQItem = () => {
    const newItem = {
      id: nextBOQId,
      itemCode: `M${String(nextBOQId).padStart(3, "0")}`,
      description: "",
      unit: "m³",
      quantity: 0,
      rate: 0,
      amount: 0,
    };
    setManualBOQ((prev) => [...prev, newItem]);
    setNextBOQId((prev) => prev + 1);
  };

  const updateManualBOQItem = (id, field, value) => {
    setManualBOQ((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === "quantity" || field === "rate") {
            updated.amount = updated.quantity * updated.rate;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const deleteManualBOQItem = (id) => {
    setManualBOQ((prev) => prev.filter((item) => item.id !== id));
  };

  const currentBOQ = activeTab === "auto" ? autoBOQ : manualBOQ;
  const totalAmount = currentBOQ.reduce(
    (sum, item) => sum + (item.amount || 0),
    0
  );

  // Export functions
  const exportToPDF = () => {
    setShowPreview(true);
    setTimeout(() => {
      window.print();
      setShowPreview(false);
    }, 500);
  };

  const exportToCSV = () => {
    const headers = [
      "Item Code",
      "Description",
      "Unit",
      "Quantity",
      "Rate",
      "Amount",
    ];
    const csvContent = [
      headers.join(","),
      ...currentBOQ.map((item) =>
        [
          item.itemCode,
          `"${item.description}"`,
          item.unit,
          item.quantity,
          item.rate,
          item.amount,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `BOQ_${activeTab}_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const PreviewModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-6xl max-h-[90vh] overflow-auto w-full">
        <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold">BOQ Preview</h3>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Print
            </button>
            <button
              onClick={() => setShowPreview(false)}
              className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
            >
              Close
            </button>
          </div>
        </div>
        <div className="p-6">
          <BOQTable
            data={currentBOQ}
            isManual={activeTab === "manual"}
            preview={true}
          />
        </div>
      </div>
    </div>
  );

  const BOQTable = ({ data, isManual = false, preview = false }) => (
    <div className={`overflow-x-auto ${preview ? "print-content" : ""}`}>
      {preview && (
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            BILL OF QUANTITIES
          </h1>
          <p className="text-gray-600 mt-1">Project: Construction Works</p>
          <p className="text-gray-600">
            Date: {new Date().toLocaleDateString()}
          </p>
          <p className="text-gray-600">
            BOQ Type: {activeTab === "auto" ? "Auto Generated" : "Manual Entry"}
          </p>
        </div>
      )}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-300 p-3 text-left font-semibold w-24">
              Item Code
            </th>
            <th className="border border-gray-300 p-3 text-left font-semibold">
              Description
            </th>
            <th className="border border-gray-300 p-3 text-center font-semibold w-20">
              Unit
            </th>
            <th className="border border-gray-300 p-3 text-right font-semibold w-28">
              Quantity
            </th>
            <th className="border border-gray-300 p-3 text-right font-semibold w-32">
              Rate (KSh)
            </th>
            <th className="border border-gray-300 p-3 text-right font-semibold w-36">
              Amount (KSh)
            </th>
            {isManual && !preview && (
              <th className="border border-gray-300 p-3 text-center font-semibold w-24">
                Action
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={isManual && !preview ? 7 : 6}
                className="border border-gray-300 p-8 text-center text-gray-500"
              >
                {activeTab === "auto"
                  ? "No data available. Complete approximate quantities first."
                  : 'No items added. Click "Add BOQ Item" to start.'}
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="border border-gray-300 p-2 font-mono text-xs">
                  {isManual && !preview ? (
                    <input
                      type="text"
                      value={item.itemCode}
                      onChange={(e) =>
                        updateManualBOQItem(item.id, "itemCode", e.target.value)
                      }
                      className="w-full p-1 border border-gray-200 rounded text-xs"
                    />
                  ) : (
                    item.itemCode
                  )}
                </td>
                <td className="border border-gray-300 p-2">
                  {isManual && !preview ? (
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) =>
                        updateManualBOQItem(
                          item.id,
                          "description",
                          e.target.value
                        )
                      }
                      className="w-full p-1 border border-gray-200 rounded text-sm"
                      placeholder="Enter description"
                    />
                  ) : (
                    item.description
                  )}
                </td>
                <td className="border border-gray-300 p-2 text-center">
                  {isManual && !preview ? (
                    <select
                      value={item.unit}
                      onChange={(e) =>
                        updateManualBOQItem(item.id, "unit", e.target.value)
                      }
                      className="w-full p-1 border border-gray-200 rounded text-sm"
                    >
                      <option value="m">m</option>
                      <option value="m²">m²</option>
                      <option value="m³">m³</option>
                      <option value="kg">kg</option>
                      <option value="t">t</option>
                      <option value="no">no</option>
                      <option value="lump">lump</option>
                      <option value="item">item</option>
                    </select>
                  ) : (
                    item.unit
                  )}
                </td>
                <td className="border border-gray-300 p-2 text-right">
                  {isManual && !preview ? (
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        updateManualBOQItem(
                          item.id,
                          "quantity",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full p-1 border border-gray-200 rounded text-sm text-right"
                      step="0.01"
                    />
                  ) : (
                    item.quantity.toFixed(2)
                  )}
                </td>
                <td className="border border-gray-300 p-2 text-right">
                  {isManual && !preview ? (
                    <input
                      type="number"
                      value={item.rate}
                      onChange={(e) =>
                        updateManualBOQItem(
                          item.id,
                          "rate",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full p-1 border border-gray-200 rounded text-sm text-right"
                      step="0.01"
                    />
                  ) : (
                    item.rate.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  )}
                </td>
                <td className="border border-gray-300 p-2 text-right font-semibold">
                  {item.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                {isManual && !preview && (
                  <td className="border border-gray-300 p-2 text-center">
                    <button
                      onClick={() => deleteManualBOQItem(item.id)}
                      className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 font-bold">
            <td
              colSpan={isManual && !preview ? 6 : 5}
              className="border border-gray-300 p-3 text-right text-lg"
            >
              TOTAL:
            </td>
            <td className="border border-gray-300 p-3 text-right font-bold text-lg">
              KSh{" "}
              {totalAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </td>
            {isManual && !preview && (
              <td className="border border-gray-300 p-3"></td>
            )}
          </tr>
        </tfoot>
      </table>

      {preview && (
        <div className="mt-8 text-sm text-gray-600">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold mb-2">Prepared by:</h4>
              <div className="border-b border-gray-300 mb-2 pb-1 w-64">
                <span className="text-gray-500">Quantity Surveyor</span>
              </div>
              <div>Date: {new Date().toLocaleDateString()}</div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Approved by:</h4>
              <div className="border-b border-gray-300 mb-2 pb-1 w-64">
                <span className="text-gray-500">Project Manager</span>
              </div>
              <div>Date: ________________</div>
            </div>
          </div>
          <div className="mt-6 p-4 bg-gray-50 rounded border">
            <h4 className="font-semibold mb-2">Notes:</h4>
            <ul className="text-xs space-y-1">
              <li>• All rates are in Kenyan Shillings (KSh)</li>
              <li>• Quantities are measured in accordance with CESMM4</li>
              <li>• Rates include materials, labour, and equipment</li>
              <li>• This BOQ is subject to site verification</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Bill of Quantities (BOQ)
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Generate professional BOQ from approximate quantities or create
              manually
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Navigation buttons */}
            <button
              onClick={onViewDiagram}
              className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium flex items-center gap-1"
            >
              <Eye className="h-4 w-4" />
              View Plans
            </button>
            <button
              onClick={onGoToTakeoff}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-1"
            >
              <Calculator className="h-4 w-4" />
              Take-off
            </button>
            <button
              onClick={onGoToApproximate}
              className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium flex items-center gap-1"
            >
              <Calculator className="h-4 w-4" />
              Approximate
            </button>
            <button
              onClick={onGoToDocuments}
              className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium flex items-center gap-1"
            >
              <FileText className="h-4 w-4" />
              Documents
            </button>

            {/* Export buttons */}
            {currentBOQ.length > 0 && (
              <div className="flex gap-2 border-l pl-2">
                <button
                  onClick={() => setShowPreview(true)}
                  className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium flex items-center gap-1"
                >
                  <Eye className="h-4 w-4" />
                  Preview
                </button>
                <button
                  onClick={exportToPDF}
                  className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center gap-1"
                >
                  <Printer className="h-4 w-4" />
                  PDF
                </button>
                <button
                  onClick={exportToCSV}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-1"
                >
                  <Download className="h-4 w-4" />
                  CSV
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("auto")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "auto"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Auto Generated ({autoBOQ.length})
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "manual"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Manual Entry ({manualBOQ.length})
          </button>
        </div>

        {activeTab === "manual" && (
          <div className="mb-4">
            <button
              onClick={addManualBOQItem}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              + Add BOQ Item
            </button>
          </div>
        )}

        {currentBOQ.length > 0 ? (
          <>
            <BOQTable data={currentBOQ} isManual={activeTab === "manual"} />

            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-lg font-semibold text-blue-800">
                    Project Total:
                  </span>
                  <p className="text-sm text-blue-600 mt-1">
                    {activeTab === "auto"
                      ? "Auto-generated from approximate quantities"
                      : "Manual entry BOQ"}
                  </p>
                </div>
                <span className="text-2xl font-bold text-blue-900">
                  KSh{" "}
                  {totalAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeTab === "auto" ? "No Data Available" : "No BOQ Items"}
            </h3>
            <p className="text-gray-600 mb-6">
              {activeTab === "auto"
                ? "Complete the approximate quantities first to generate BOQ automatically."
                : 'Click "Add BOQ Item" to start creating your BOQ manually.'}
            </p>

            {activeTab === "auto" && (
              <div className="flex justify-center gap-3">
                <button
                  onClick={onGoToTakeoff}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Start Take-off
                </button>
                <button
                  onClick={onGoToApproximate}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
                >
                  Go to Approximate
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && <PreviewModal />}

      <style>
        {`
          @media print {
            body { margin: 0; background: white; }
            * { -webkit-print-color-adjust: exact; }
            .no-print, .print\\:hidden { display: none !important; }
            @page { size: A4 landscape; margin: 1cm; }
            .print-content { font-size: 11px; }
          }
        `}
      </style>
    </div>
  );
};

export default BOQ;
