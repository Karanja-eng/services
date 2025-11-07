import React, { useState, useEffect } from "react";
import { FileText, Calculator, Eye, ArrowLeft } from "lucide-react";

const DocumentViewer = ({
  onGoToTakeoff,
  onGoToApproximate,
  onGoToBOQ,
  onViewDiagram,
}) => {
  const [documents, setDocuments] = useState([]);
  const [activeDocument, setActiveDocument] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load saved documents from localStorage
    const loadDocuments = () => {
      const takeoffData = JSON.parse(
        localStorage.getItem("takeoff-rows") || "[]"
      );
      const boqData = JSON.parse(localStorage.getItem("boq-data") || "[]");
      const approximateData = JSON.parse(
        localStorage.getItem("approximate-data") || "[]"
      );

      const docs = [
        ...takeoffData.map((item) => ({
          type: "takeoff",
          title: `Takeoff Item - ${item.description}`,
          content: `Quantity: ${item.quantity} ${item.unit}`,
          date: new Date().toISOString(),
        })),
        ...boqData.map((item) => ({
          type: "boq",
          title: `BOQ Item - ${item.description}`,
          content: `Amount: KES ${item.amount}`,
          date: new Date().toISOString(),
        })),
        ...approximateData.map((item) => ({
          type: "approximate",
          title: `Approximate Quantity - ${item.description}`,
          content: `Total Cost: KES ${item.totalCost}`,
          date: new Date().toISOString(),
        })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      setDocuments(docs);
      setLoading(false);
    };

    loadDocuments();
  }, []);

  const getTypeColor = (type) => {
    switch (type) {
      case "takeoff":
        return "bg-blue-100 text-blue-800";
      case "boq":
        return "bg-green-100 text-green-800";
      case "approximate":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Document Viewer</h2>
            <p className="text-sm text-gray-600">
              View and manage your project documents
            </p>
          </div>

          {/* Navigation buttons */}
          <div className="flex flex-wrap gap-2">
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
              onClick={onGoToBOQ}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center gap-1"
            >
              <FileText className="h-4 w-4" />
              BOQ
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading documents...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Documents Available
                </h3>
                <p className="text-gray-600 mb-6">
                  Start by creating takeoff, BOQ, or approximate quantities.
                </p>
              </div>
            ) : (
              documents.map((doc, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setActiveDocument(doc)}
                >
                  <div
                    className={`inline-block px-2 py-1 rounded-md text-xs font-medium mb-2 ${getTypeColor(
                      doc.type
                    )}`}
                  >
                    {doc.type.toUpperCase()}
                  </div>
                  <h3 className="font-medium text-gray-800 mb-1">
                    {doc.title}
                  </h3>
                  <p className="text-sm text-gray-600">{doc.content}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(doc.date).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Document Preview Modal */}
        {activeDocument && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
              <div className="p-4 border-b sticky top-0 bg-white">
                <div className="flex justify-between items-center">
                  <div>
                    <div
                      className={`inline-block px-2 py-1 rounded-md text-xs font-medium mb-2 ${getTypeColor(
                        activeDocument.type
                      )}`}
                    >
                      {activeDocument.type.toUpperCase()}
                    </div>
                    <h3 className="font-semibold text-lg">
                      {activeDocument.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveDocument(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <ArrowLeft className="h-6 w-6" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <p className="text-gray-700">{activeDocument.content}</p>
                  <div className="text-sm text-gray-500">
                    Created: {new Date(activeDocument.date).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentViewer;
