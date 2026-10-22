import React, { useState } from "react";
import { Settings } from "lucide-react";

import DrainageTakeoffForm from "./DrainageTakeoffForm";
// import TakeoffSheet from "./TakeoffSheet"; // Replaced by Universal Components
import EnglishMethodTakeoffSheet from "../ExternalWorks/EnglishMethodTakeoffSheet";
import StructuralVisualizationComponent from "../../Drawings/visualise_component";
import descriptions from "../descriptions";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from '../universal_component';
import {
  WorkspacePage,
  PageHeader,
  Section,
  MetaChip,
  EmptyState,
  text,
} from "../../shared/ui";

// Main App Component
const DrainageComponenet = () => {
  const [activeTab, setActiveTab] = useState("calculator");
  const [projectData, setProjectData] = useState(null);
  const [calculationResults, setCalculationResults] = useState(null);
  const [takeoffData, setTakeoffData] = useState([]);
  const [editorKey, setEditorKey] = useState(0);

  const handleCalculationComplete = (results) => {
    setCalculationResults(results);
    setProjectData(results); // assuming results contains project info too or we mix it

    // Format for Universal Components
    if (results && results.boq_items) {
      const formattedItems = results.boq_items.map((item, index) => ({
        id: index + 1,
        billNo: item.code.split('.')[0] || "A", // Extract A from A.1
        itemNo: item.code,
        description: descriptions[item.name] || item.description || item.name,
        unit: item.unit,
        quantity: item.quantity,
        rate: item.rate || 0,
        amount: item.amount || 0,
        dimensions: (item.dimensions || []).map((dim, dIdx) => ({
          id: dIdx + 1,
          number: dim.number?.toString() || "1",
          length: dim.length?.toString() || "",
          width: dim.width?.toString() || "",
          height: dim.height?.toString() || "",
          description: dim.description || "",
          deduction: false
        })),
        isHeader: false
      }));

      // Group headers for better structure
      const groupedItems = [];
      let currentBill = "";

      formattedItems.forEach(item => {
        const bill = item.billNo;
        if (bill !== currentBill) {
          groupedItems.push({
            id: `header-${bill}`,
            billNo: bill,
            itemNo: "",
            description: `CLASS ${bill}`, // Placeholder, backend could provide more
            dimensions: [],
            isHeader: true
          });
          currentBill = bill;
        }
        groupedItems.push(item);
      });

      setTakeoffData(groupedItems);
      setProjectData(results);
      setEditorKey(prev => prev + 1); // Reset editor on new calculation
      setActiveTab("takeoff");
    }
  };

  return (
    <WorkspacePage width="wide">
      <PageHeader
        title="Drainage and manhole takeoff"
        subtitle="Manholes, pipe runs, trench excavation and ancillary works."
        icon={<Settings size={22} aria-hidden="true" />}
        meta={
          <>
            <MetaChip tone="info">{projectData?.manholes?.length ?? 0} manhole(s)</MetaChip>
            <MetaChip>{projectData?.pipes?.length ?? 0} pipe run(s)</MetaChip>
            <MetaChip>{takeoffData.length} bill row(s)</MetaChip>
          </>
        }
      />

      <div className="mb-4 -mx-1 overflow-x-auto">
        <UniversalTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabs={['calculator', '3d', 'takeoff', 'sheet', 'boq']}
        />
      </div>

      {activeTab === "calculator" && (
        <Section
          title="Drainage inputs"
          description="Project settings, then manholes and pipes. Generate to build the bill."
        >
          <DrainageTakeoffForm onCalculationComplete={handleCalculationComplete} />
        </Section>
      )}

      {activeTab === "3d" && (
        <div className="relative h-[70vh] min-h-[360px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          {calculationResults ? (
            <StructuralVisualizationComponent
              componentType="drainage"
              componentData={{
                projectData: calculationResults,
                calculationResults: calculationResults
              }}
              theme="dark"
            />
          ) : (
            <div className={`flex h-full items-center justify-center p-4 text-center text-sm ${text.subtitle}`}>
              Complete a calculation to view the 3D model.
            </div>
          )}
        </div>
      )}

      {activeTab === "takeoff" && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <EnglishMethodTakeoffSheet
            key={editorKey}
            initialItems={takeoffData.length > 0 ? takeoffData : undefined}
            onChange={setTakeoffData}
            projectInfo={{
              projectName: projectData?.project_name || "Drainage Project",
              clientName: "Client Name",
              projectDate: new Date().toLocaleDateString()
            }}
          />
        </div>
      )}

      {activeTab === "sheet" && (
        <div>
          {takeoffData.length > 0 ? (
            <UniversalSheet items={takeoffData} />
          ) : (
            <EmptyState
              title="No measured items yet"
              description="Complete a drainage calculation to populate the dimension paper."
            />
          )}
        </div>
      )}

      {activeTab === "boq" && (
        <div>
          {takeoffData.length > 0 ? (
            <UniversalBOQ items={takeoffData} />
          ) : (
            <EmptyState
              title="No bill items yet"
              description="Complete a drainage calculation to populate the bill of quantities."
            />
          )}
        </div>
      )}
    </WorkspacePage>
  );
};

export default DrainageComponenet;
