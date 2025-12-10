import React, { useRef } from "react";
import descriptions from "../descriptions";



const TakeoffSheet = ({ calculationResults, projectData }) => {
  const tableRef = useRef();

  if (!calculationResults || !calculationResults.boq_items) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <p className="text-gray-500 text-center py-8">
          No calculation results available. Please complete the form and
          calculate.
        </p>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const content = generateExportContent();
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectData.project_name || "drainage"}_takeoff.txt`;
    a.click();
  };

  const generateExportContent = () => {
    let content = `BILL OF QUANTITIES - DRAINAGE WORKS\n`;
    content += `Project: ${projectData.project_name}\n`;
    content += `Date: ${new Date().toLocaleDateString()}\n\n`;

    content += `ITEM NO.\tDESCRIPTION\tUNIT\tQUANTITY\tRATE\tAMOUNT\n`;
    content += `------------------------------------------------------------------------------------------------------------------\n`;

    let totalAmount = 0;
    calculationResults.boq_items.forEach((item, index) => {
      // Use the description from the descriptions object, falling back to item.name if not found
      const itemDescription = descriptions[item.name] || item.name;
      content += `${index + 1}\t${itemDescription}\t${item.unit}\t${item.quantity}\t${item.rate}\t${item.amount}\n`;
      totalAmount += item.amount;
    });

    content += `------------------------------------------------------------------------------------------------------------------\n`;
    content += `TOTAL AMOUNT:\t\t\t\t\t${totalAmount.toFixed(2)}\n`; // Format total amount to 2 decimal places

    return content;
  };

  // Group items by section
  const groupedItems = calculationResults.boq_items.reduce((acc, item) => {
    const section = item.code.split(".")[0];
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  const sectionTitles = {
    A: "SITE CLEARANCE & PREPARATION",
    B: "EXCAVATION",
    C: "TEMPORARY WORKS",
    D: "CONCRETE WORK",
    E: "FINISHES",
    F: "MANHOLE FITTINGS",
    G: "PIPES & BEDDING",
    H: "BACKFILLING",
    I: "TESTING & COMMISSIONING",
    J: "CONNECTIONS",
    K: "ANCILLARY WORKS",
    L: "GULLY TRAPS",
    M: "PROVISIONAL & GENERAL",
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
      {/* Header */}
      <div className="mb-6 pb-4 border-b-2 border-gray-800">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          BILL OF QUANTITIES
        </h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-4">
          DRAINAGE WORKS
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p>
              <span className="font-semibold">Project:</span>{" "}
              {projectData.project_name}
            </p>
            <p>
              <span className="font-semibold">Date:</span>{" "}
              {new Date().toLocaleDateString()}
            </p>
          </div>
          <div>
            <p>
              <span className="font-semibold">Total Manholes:</span>{" "}
              {projectData.manholes?.length || 0}
            </p>
            <p>
              <span className="font-semibold">Total Pipe Runs:</span>{" "}
              {projectData.pipes?.length || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex justify-end space-x-4 print:hidden">
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Print
        </button>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
        >
          Export
        </button>
      </div>

      {/* Takeoff Sheet Table */}
      <div ref={tableRef} className="overflow-x-auto">
        <table className="w-full border-collapse border-2 border-gray-800 text-sm">
          <thead>
            <tr className="bg-gray-200 dark:bg-slate-700">
              <th className="border border-gray-700 px-3 py-2 text-left w-20">
                Item No.
              </th>
              <th className="border border-gray-700 px-3 py-2 text-left">
                Description
              </th>
              <th className="border border-gray-700 px-3 py-2 text-center w-16">
                Unit
              </th>
              <th className="border border-gray-700 px-3 py-2 text-right w-24">
                Quantity
              </th>
              <th className="border border-gray-700 px-3 py-2 text-right w-24">
                Rate
              </th>
              <th className="border border-gray-700 px-3 py-2 text-right w-28">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(sectionTitles).map(
              ([sectionCode, sectionTitle]) => {
                const items = groupedItems[sectionCode];
                if (!items || items.length === 0) return null;

                return (
                  <React.Fragment key={sectionCode}>
                    {/* Section Header */}
                    <tr className="bg-gray-100 dark:bg-slate-700">
                      <td
                        colSpan="6"
                        className="border border-gray-700 px-3 py-2 font-bold"
                      >
                        {sectionCode}. {sectionTitle}
                      </td>
                    </tr>

                    {/* Section Items */}
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="border border-gray-700 px-3 py-2 font-mono text-xs">
                          {item.code}
                        </td>
                        <td className="border border-gray-700 px-3 py-2">
                          {item.description}
                        </td>
                        <td className="border border-gray-700 px-3 py-2 text-center font-semibold">
                          {item.unit}
                        </td>
                        <td className="border border-gray-700 px-3 py-2 text-right font-mono">
                          {typeof item.quantity === "number"
                            ? item.quantity.toFixed(2)
                            : item.quantity}
                        </td>
                        <td className="border border-gray-700 px-3 py-2 text-right text-gray-400">
                          -
                        </td>
                        <td className="border border-gray-700 px-3 py-2 text-right text-gray-400">
                          -
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              }
            )}

            {/* Summary Row */}
            <tr className="bg-gray-200 dark:bg-slate-700 font-bold">
              <td
                colSpan="3"
                className="border border-gray-700 px-3 py-2 text-right"
              >
                TOTAL ITEMS:
              </td>
              <td className="border border-gray-700 px-3 py-2 text-right">
                {calculationResults.boq_items.length}
              </td>
              <td className="border border-gray-700 px-3 py-2"></td>
              <td className="border border-gray-700 px-3 py-2"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Detailed Breakdown */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
        {/* Manhole Summary */}
        <div className="border border-gray-300 rounded p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Manhole Summary
          </h3>
          <div className="space-y-2 text-sm">
            {calculationResults.manholes?.map((mh, idx) => (
              <div key={idx} className="pb-2 border-b border-gray-200">
                <p className="font-semibold text-gray-700">{mh.manhole_id}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mt-1">
                  <p>Type: {mh.type === "circ" ? "Circular" : "Rectangular"}</p>
                  <p>Depth: {mh.depth?.toFixed(2)}m</p>
                  <p>GL: {mh.ground_level}m</p>
                  <p>IL: {mh.invert_level}m</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pipe Summary */}
        <div className="border border-gray-300 rounded p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Pipe Summary
          </h3>
          <div className="space-y-2 text-sm">
            {calculationResults.pipes?.map((pipe, idx) => (
              <div key={idx} className="pb-2 border-b border-gray-200">
                <p className="font-semibold text-gray-700">{pipe.pipe_id}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mt-1">
                  <p>From: {pipe.from}</p>
                  <p>To: {pipe.to}</p>
                  <p>Ø {pipe.diameter_mm}mm</p>
                  <p>Length: {pipe.pipe_length_m?.toFixed(2)}m</p>
                  <p>Material: {pipe.material?.toUpperCase()}</p>
                  <p>Gradient: {pipe.gradient}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Totals Summary */}
      <div className="mt-8 p-6 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-300 dark:border-slate-600 print:hidden">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Quantities Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {calculationResults.totals?.manholes && (
            <>
              <div className="p-3 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700">
                <p className="text-gray-600 text-xs">Excavation (Pits)</p>
                <p className="text-lg font-bold text-gray-900">
                  {(
                    calculationResults.totals.manholes.excav_stage1_m3 +
                    calculationResults.totals.manholes.excav_stage2_m3
                  ).toFixed(2)}{" "}
                  m³
                </p>
              </div>

              <div className="p-3 bg-white rounded border border-gray-200">
                <p className="text-gray-600 text-xs">Concrete (Total)</p>
                <p className="text-lg font-bold text-gray-900">
                  {(
                    calculationResults.totals.manholes.conc_bed_m3 +
                    calculationResults.totals.manholes.slab_m3 +
                    calculationResults.totals.manholes.bench_conc_m3
                  ).toFixed(2)}{" "}
                  m³
                </p>
              </div>
            </>
          )}

          {calculationResults.totals?.pipes && (
            <>
              <div className="p-3 bg-white rounded border border-gray-200">
                <p className="text-gray-600 text-xs">Trench Excavation</p>
                <p className="text-lg font-bold text-gray-900">
                  {(
                    calculationResults.totals.pipes.trench_stage1_m3 +
                    calculationResults.totals.pipes.trench_stage2_m3
                  ).toFixed(2)}{" "}
                  m³
                </p>
              </div>

              <div className="p-3 bg-white rounded border border-gray-200">
                <p className="text-gray-600 text-xs">Pipe Length (Total)</p>
                <p className="text-lg font-bold text-gray-900">
                  {(
                    calculationResults.totals.pipes.pipe_upvc_m +
                    calculationResults.totals.pipes.pipe_pcc_m
                  ).toFixed(2)}{" "}
                  m
                </p>
              </div>

              <div className="p-3 bg-white rounded border border-gray-200">
                <p className="text-gray-600 text-xs">Bedding Material</p>
                <p className="text-lg font-bold text-gray-900">
                  {(
                    calculationResults.totals.pipes.bedding_granular_m3 +
                    calculationResults.totals.pipes.bedding_sand_m3 +
                    calculationResults.totals.pipes.bedding_concrete_m3
                  ).toFixed(2)}{" "}
                  m³
                </p>
              </div>

              <div className="p-3 bg-white rounded border border-gray-200">
                <p className="text-gray-600 text-xs">Backfill (Total)</p>
                <p className="text-lg font-bold text-gray-900">
                  {(
                    calculationResults.totals.pipes.backfill_m3 +
                    (calculationResults.totals.manholes?.backfill_m3 || 0)
                  ).toFixed(2)}{" "}
                  m³
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notes Section */}
      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h3 className="text-md font-semibold text-gray-800 mb-2">NOTES:</h3>
        <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
          <li>
            All quantities are net and no allowance has been made for waste
            unless otherwise stated.
          </li>
          <li>
            Rates to include for all labor, materials, tools, equipment, and
            incidental costs.
          </li>
          <li>
            Excavation depths measured from existing ground level unless
            otherwise noted.
          </li>
          <li>
            All concrete to be specified grade with proper curing as per
            specifications.
          </li>
          <li>
            Testing and commissioning to be carried out as per relevant
            standards.
          </li>
          <li>
            Contractor to verify all dimensions and levels on site before
            commencement.
          </li>
          <li>Rates column to be filled by the contractor for pricing.</li>
        </ol>
      </div>

      {/* Signature Block */}
      <div className="mt-8 grid grid-cols-2 gap-12 print:block">
        <div>
          <p className="text-sm font-semibold mb-8">Prepared By:</p>
          <div className="border-t border-gray-400 pt-2">
            <p className="text-xs text-gray-600">Signature & Date</p>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold mb-8">Checked By:</p>
          <div className="border-t border-gray-400 pt-2">
            <p className="text-xs text-gray-600">Signature & Date</p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          @page {
            margin: 1.5cm;
          }
        }
      `}</style>
    </div>
  );
};

export default TakeoffSheet;
