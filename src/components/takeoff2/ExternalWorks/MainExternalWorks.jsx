import React, { useState } from "react";
import { Save, Upload, Calculator, Ruler } from "lucide-react";
import axios from "axios";
import StructuralVisualizationComponent from "../../Drawings/visualise_component";
import ExternalWorksInputForm from "./ExternalWorksInputForm";
import EnglishMethodTakeoffSheet from "./EnglishMethodTakeoffSheet";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from '../universal_component';
import {
  WorkspacePage,
  PageHeader,
  Section,
  MetaChip,
  ErrorNotice,
  EmptyState,
  action,
} from "../../shared/ui";

/**
 * ExternalWorksComponent — external works quantity takeoff.
 *
 * UI cleanup:
 * - The bespoke header/toolbar is replaced by the shared page header, with the
 *   working Save / Load project actions kept (they download and read a JSON
 *   project file — real behaviour, not placeholders).
 * - Calculation failures now surface in an in-page error notice instead of an
 *   `alert()`; no quantities are fabricated.
 * - The calculator is hosted in a shared `Section`, and the tabs scroll instead
 *   of squeezing the header on phones.
 *
 * Preserved exactly: the `formData` model, the camelCase → snake_case payload
 * mapping, the endpoint, and the takeoff item mapping.
 */
export default function ExternalWorksComponent({ isDark = false }) {
  const [activeTab, setActiveTab] = useState("calculator");
  const [calcError, setCalcError] = useState(null);

  // Sample project state aligned with backend Pydantic models
  const [formData, setFormData] = useState({
    projectInfo: {
      projectName: "External Works Project",
      location: "Nairobi, Kenya",
      drawingNumber: "DRG No.01",
      date: new Date().toISOString().split("T")[0],
      takenBy: "",
      checkedBy: "",
      scale: "1:100",
    },
    siteData: {
      siteLength: 50,
      siteWidth: 40,
    },
    demolition: {
      houseLength: 12,
      houseWidth: 10,
      buildingDemolitionVolume: 0,
      treesSmall: 3,
      treesLarge: 2,
      stumps: 1,
      pipelineRemovalLength: 0,
      pipelineDiameter: 225,
      vegetableSoilDepth: 0.15,
    },
    roadConfig: {
      roadLength: 32,
      roadWidth: 9,
      roadType: 'bitumen',
      drivewayLength: 20,
      drivewayWidth: 9,
      drivewayType: 'bitumen',
      parkingLength: 25,
      parkingWidth: 9,
      parkingType: 'cabro',
      bellmouthRadius1: 3.5,
      bellmouthRadius2: 2.5,
    },
    pavementLayers: {
      bitumenThickness: 0.05,
      bitumenMacadamBase: 0.15,
      murramDepth: 0.20,
      hardcoreThickness: 0.20,
      sandBedThickness: 0.15,
      excavationDepthAfterVeg: 0.50,
      backingAllowance: 0.10,
      concreteBackingThickness: 0.10,
    },
    kerbsChannels: {
      kerbType: 'pcc',
      kerbStraightLength: 0,
      kerbCurvedLength: 0,
      channelStraightLength: 0,
      channelCurvedLength: 0,
    },
    drainage: {
      invertBlockCount: 0,
      invertBlockSize: 0.35,
      pccSlabLength: 0,
      pccSlabWidth: 0.50,
      pccSlabThickness: 0.05,
      drainageChannelLength: 0,
    },
    landscaping: {
      grassSeedingArea: 0,
      importedTopsoilThickness: 0.15,
      mahoganyTrees: 0,
      ornamentalTrees: 0,
      euphorbiaHedgeLength: 0,
    },
    fencing: {
      timberPostWireFence: 0,
      fenceType1Length: 0,
      fenceType2Length: 0,
      metalGates: 0,
      normalGates: 0,
    }
  });

  const [takeoffData, setTakeoffData] = useState([]);
  const [editorKey, setEditorKey] = useState(0);

  const handleCalculate = async () => {
    setCalcError(null);
    try {
      // Transform camelCase keys to snake_case for backend validation
      const payload = {
        project_info: {
          project_name: formData.projectInfo.projectName,
          location: formData.projectInfo.location,
          drawing_number: formData.projectInfo.drawingNumber,
          date: formData.projectInfo.date,
          taken_by: formData.projectInfo.takenBy,
          checked_by: formData.projectInfo.checkedBy,
          scale: formData.projectInfo.scale
        },
        site_data: {
          site_length: formData.siteData.siteLength,
          site_width: formData.siteData.siteWidth
        },
        demolition: {
          house_length: formData.demolition.houseLength,
          house_width: formData.demolition.houseWidth,
          building_demolition_volume: formData.demolition.buildingDemolitionVolume,
          trees_small: formData.demolition.treesSmall,
          trees_large: formData.demolition.treesLarge,
          stumps: formData.demolition.stumps,
          pipeline_removal_length: formData.demolition.pipelineRemovalLength,
          pipeline_diameter: formData.demolition.pipelineDiameter,
          vegetable_soil_depth: formData.demolition.vegetableSoilDepth
        },
        road_config: {
          road_length: formData.roadConfig.roadLength,
          road_width: formData.roadConfig.roadWidth,
          road_type: formData.roadConfig.roadType,
          driveway_length: formData.roadConfig.drivewayLength,
          driveway_width: formData.roadConfig.drivewayWidth,
          driveway_type: formData.roadConfig.drivewayType,
          parking_length: formData.roadConfig.parkingLength,
          parking_width: formData.roadConfig.parkingWidth,
          parking_type: formData.roadConfig.parkingType,
          bellmouth_radius_1: formData.roadConfig.bellmouthRadius1,
          bellmouth_radius_2: formData.roadConfig.bellmouthRadius2
        },
        pavement_layers: {
          bitumen_thickness: formData.pavementLayers.bitumenThickness,
          bitumen_macadam_base: formData.pavementLayers.bitumenMacadamBase,
          murram_depth: formData.pavementLayers.murramDepth,
          hardcore_thickness: formData.pavementLayers.hardcoreThickness,
          sand_bed_thickness: formData.pavementLayers.sandBedThickness,
          excavation_depth_after_veg: formData.pavementLayers.excavationDepthAfterVeg,
          backing_allowance: formData.pavementLayers.backingAllowance,
          concrete_backing_thickness: formData.pavementLayers.concreteBackingThickness
        },
        kerbs_channels: {
          kerb_type: formData.kerbsChannels.kerbType,
          kerb_straight_length: formData.kerbsChannels.kerbStraightLength,
          kerb_curved_length: formData.kerbsChannels.kerbCurvedLength,
          channel_straight_length: formData.kerbsChannels.channelStraightLength,
          channel_curved_length: formData.kerbsChannels.channelCurvedLength
        },
        drainage: {
          invert_block_count: formData.drainage.invertBlockCount,
          invert_block_size: formData.drainage.invertBlockSize,
          pcc_slab_length: formData.drainage.pccSlabLength,
          pcc_slab_width: formData.drainage.pccSlabWidth,
          pcc_slab_thickness: formData.drainage.pccSlabThickness,
          drainage_channel_length: formData.drainage.drainageChannelLength
        },
        landscaping: {
          grass_seeding_area: formData.landscaping.grassSeedingArea,
          imported_topsoil_thickness: formData.landscaping.importedTopsoilThickness,
          mahogany_trees: formData.landscaping.mahoganyTrees,
          ornamental_trees: formData.landscaping.ornamentalTrees,
          euphorbia_hedge_length: formData.landscaping.euphorbiaHedgeLength
        },
        fencing: {
          timber_post_wire_fence: formData.fencing.timberPostWireFence,
          fence_type_1_length: formData.fencing.fenceType1Length,
          fence_type_2_length: formData.fencing.fenceType2Length,
          metal_gates: formData.fencing.metalGates,
          normal_gates: formData.fencing.normalGates
        }
      };

      const response = await axios.post("http://localhost:8001/external_works/calculate", payload);
      const data = response.data;

      if (data && data.items) {
        const formattedItems = data.items.map((item, index) => ({
          id: index + 1,
          billNo: item.bill_no,
          itemNo: item.item_no,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          rate: item.rate || 0,
          amount: item.amount || 0,
          dimensions: item.dimensions || [],
          isHeader: item.is_header || false
        }));
        setTakeoffData(formattedItems);
        setEditorKey(prev => prev + 1);
        setActiveTab("takeoff"); // Switch to results view automatically
      }
    } catch (error) {
      console.error("Error calculating external works:", error);
      const detail = error.response?.data?.detail;
      setCalcError(
        typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : error.message
      );
    }
  };

  const saveProject = () => {
    const dataStr = JSON.stringify({ formData }, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${formData.projectInfo.projectName.replace(/\s+/g, "-")}_${Date.now()}.json`;
    link.click();
  };

  const loadProject = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.formData) setFormData(data.formData);
        } catch (error) {
          setCalcError("That file could not be read as a saved external-works project.");
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <WorkspacePage width="wide">
      <PageHeader
        title="External works takeoff"
        subtitle="Site clearance, roads, paving, kerbs, drainage, landscaping and fencing (CESMM4 classes)."
        icon={<Ruler size={22} aria-hidden="true" />}
        meta={
          <>
            <MetaChip tone="info">{formData.projectInfo.projectName}</MetaChip>
            <MetaChip>{takeoffData.length} bill row(s)</MetaChip>
          </>
        }
        actions={
          <>
            <button type="button" onClick={handleCalculate} className={`${action.base} ${action.primary}`}>
              <Calculator size={16} aria-hidden="true" /> Calculate
            </button>
            <button type="button" onClick={saveProject} className={`${action.base} ${action.secondary}`}>
              <Save size={16} aria-hidden="true" /> Save
            </button>
            <label
              className={`${action.base} ${action.secondary} cursor-pointer`}
              title="Load a previously saved external-works project"
            >
              <Upload size={16} aria-hidden="true" /> Load
              <input type="file" accept=".json" onChange={loadProject} className="sr-only" />
            </label>
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

      {calcError && (
        <ErrorNotice
          className="mb-4"
          title="External works calculation failed"
          message={calcError}
          onRetry={handleCalculate}
        />
      )}

      {activeTab === "calculator" && (
        <Section
          title="Measured quantities"
          description="Enter the site quantities section by section, then calculate."
        >
          <ExternalWorksInputForm
            theme={{
              bg: isDark ? "#0f172a" : "#f8fafc",
              card: isDark ? "#1e293b" : "#ffffff",
              text: isDark ? "#f1f5f9" : "#0f172a",
              border: isDark ? "#334155" : "#e2e8f0",
              accent: "#14b8a6"
            }}
            formData={formData}
            setFormData={setFormData}
            handleCalculate={handleCalculate}
          />
        </Section>
      )}

      {activeTab === "3d" && (
        <div className="relative h-[70vh] min-h-[360px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <StructuralVisualizationComponent
            componentType="externalWorks"
            componentData={{
              settings: formData.roadConfig,
            }}
            onSettingsChange={(newSettings) => setFormData({ ...formData, roadConfig: newSettings })}
            theme={isDark ? "dark" : "light"}
          />
        </div>
      )}

      {activeTab === "takeoff" && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <EnglishMethodTakeoffSheet
            key={editorKey}
            initialItems={takeoffData}
            onChange={setTakeoffData}
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
              description="Calculate the external works takeoff to populate the dimension paper."
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
              description="Calculate the external works takeoff to populate the bill of quantities."
            />
          )}
        </div>
      )}
    </WorkspacePage>
  );
}
