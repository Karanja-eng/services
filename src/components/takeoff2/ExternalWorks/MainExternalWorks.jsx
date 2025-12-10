import React, { useState, useEffect } from "react";
import {
  Menu,
  X,
  Home,
  Box,
  FileText,
  Calculator,
  Settings,
  Download,
  Upload,
  Save,
} from "lucide-react";
import ExternalWorks3DVisualizer from "./3DExternalWorksVisualizer";
import ExternalWorksInputForm from "./ExternalWorksInputForm";
import EnglishMethodTakeoffSheet from "./EnglishMethodTakeoffSheet";

// Main Application Component
export default function ExternalWorksComponent({ isDark = false }) {
  const [currentView, setCurrentView] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [projectData, setProjectData] = useState(null);
  const [calculations, setCalculations] = useState(null);

  // Simplified theme using slate/teal palette
  const currentTheme = isDark ? {
    bg: "#0f172a",
    card: "#1e293b",
    text: "#f1f5f9",
    textSecondary: "#94a3b8",
    border: "#334155",
    accent: "#14b8a6",
    accentHover: "#0d9488",
    sidebar: "#1e293b",
    hover: "#334155",
  } : {
    bg: "#f8fafc",
    card: "#ffffff",
    text: "#0f172a",
    textSecondary: "#64748b",
    border: "#e2e8f0",
    accent: "#14b8a6",
    accentHover: "#0d9488",
    sidebar: "#ffffff",
    hover: "#f1f5f9",
  };

  // Sample project state
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
      roadType: "bitumen",
      drivewayLength: 20,
      drivewayWidth: 9,
      drivewayType: "bitumen",
      parkingLength: 25,
      parkingWidth: 9,
      parkingType: "cabro",
      bellmouthRadius1: 3.5,
      bellmouthRadius2: 2.5,
    },
    pavementLayers: {
      bitumenThickness: 0.05,
      bitumenMacadamBase: 0.15,
      murramDepth: 0.2,
      hardcoreThickness: 0.2,
      sandBedThickness: 0.15,
      excavationDepthAfterVeg: 0.5,
      backingAllowance: 0.1,
      concreteBackingThickness: 0.1,
    },
    kerbsChannels: {
      kerbType: "pcc",
      kerbStraightLength: 64,
      kerbCurvedLength: 0,
      channelStraightLength: 64,
      channelCurvedLength: 0,
    },
    drainage: {
      invertBlockCount: 10,
      invertBlockSize: 0.35,
      pccSlabLength: 32,
      pccSlabWidth: 0.5,
      pccSlabThickness: 0.05,
      drainageChannelLength: 32,
    },
    landscaping: {
      grassSeedingArea: 500,
      importedTopsoilThickness: 0.15,
      mahoganyTrees: 3,
      ornamentalTrees: 4,
      euphorbiaHedgeLength: 30,
    },
    fencing: {
      timberPostWireFence: 100,
      fenceType1Length: 50,
      fenceType2Length: 30,
      metalGates: 1,
      normalGates: 2,
    },
  });

  const [view3DConfig, setView3DConfig] = useState({
    roadWidth: 9,
    roadLength: 32,
    parkingWidth: 9,
    parkingLength: 25,
    bellmouthRadius1: 3.5,
    bellmouthRadius2: 2.5,
    drivewayWidth: 9,
    surfaceType: "bitumen",
    showLayers: {
      subBase: true,
      hardcore: true,
      baseCoarse: true,
      bitumen: true,
      kerb: true,
      channel: true,
      invertBlock: true,
      bellmouth: true,
    },
  });

  // Navigation items
  const navItems = [
    { id: "home", label: "Dashboard", icon: Home },
    { id: "3d", label: "3D Visualizer", icon: Box },
    { id: "input", label: "Input Form", icon: FileText },
    { id: "takeoff", label: "Takeoff Sheet", icon: Calculator },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  // Calculate quantities
  const calculateQuantities = () => {
    const clearArea =
      formData.siteData.siteLength * formData.siteData.siteWidth -
      formData.demolition.houseLength * formData.demolition.houseWidth;

    const vegSoilVolume = clearArea * formData.demolition.vegetableSoilDepth;

    const roadArea =
      formData.roadConfig.roadLength * formData.roadConfig.roadWidth;
    const drivewayArea =
      formData.roadConfig.drivewayLength * formData.roadConfig.drivewayWidth;
    const parkingArea =
      formData.roadConfig.parkingLength * formData.roadConfig.parkingWidth;

    const bellmouthArea =
      (3 / 14) *
      Math.PI *
      (Math.pow(formData.roadConfig.bellmouthRadius1, 2) +
        Math.pow(formData.roadConfig.bellmouthRadius2, 2));

    const totalPavedArea =
      roadArea + drivewayArea + parkingArea + bellmouthArea;

    const excavationVolume =
      totalPavedArea * formData.pavementLayers.excavationDepthAfterVeg;

    const murramVolume = totalPavedArea * formData.pavementLayers.murramDepth;
    const hardcoreVolume =
      totalPavedArea * formData.pavementLayers.hardcoreThickness;
    const bitumenVolume =
      totalPavedArea * formData.pavementLayers.bitumenThickness;

    return {
      clearArea,
      vegSoilVolume,
      totalPavedArea,
      excavationVolume,
      murramVolume,
      hardcoreVolume,
      bitumenVolume,
      roadArea,
      drivewayArea,
      parkingArea,
      bellmouthArea,
    };
  };

  const totals = calculateQuantities();

  // Save project
  const saveProject = () => {
    const dataStr = JSON.stringify(
      { formData, view3DConfig },
      null,
      2
    );
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${formData.projectInfo.projectName.replace(
      /\s+/g,
      "-"
    )}_${Date.now()}.json`;
    link.click();
  };

  // Load project
  const loadProject = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.formData) setFormData(data.formData);
          if (data.view3DConfig) setView3DConfig(data.view3DConfig);
          alert("Project loaded successfully!");
        } catch (error) {
          alert("Error loading project file");
        }
      };
      reader.readAsText(file);
    }
  };

  // Render different views
  const renderView = () => {
    switch (currentView) {
      case "home":
        return (
          <DashboardView
            theme={currentTheme}
            totals={totals}
            projectInfo={formData.projectInfo}
          />
        );
      case "3d":
        return (
          <ExternalWorks3DVisualizer
            theme={currentTheme}
            config={view3DConfig}
            setConfig={setView3DConfig}
          />
        );
      case "input":
        return (
          <ExternalWorksInputForm
            theme={currentTheme}
            formData={formData}
            setFormData={setFormData}
          />
        );
      case "takeoff":
        return (
          <EnglishMethodTakeoffSheet
            theme={currentTheme}
            formData={formData}
            totals={totals}
          />
        );
      case "settings":
        return <SettingsView theme={currentTheme} />;
      default:
        return (
          <DashboardView
            theme={currentTheme}
            totals={totals}
            projectInfo={formData.projectInfo}
          />
        );
    }
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: currentTheme.bg,
        color: currentTheme.text,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        transition: "all 0.3s ease",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: sidebarOpen ? "260px" : "0",
          background: currentTheme.sidebar,
          borderRight: `1px solid ${currentTheme.border}`,
          transition: "width 0.3s ease",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Logo Section */}
        <div
          style={{
            padding: "20px",
            borderBottom: `1px solid ${currentTheme.border}`,
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <Box size={32} color={currentTheme.accent} />
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
              External Works
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: currentTheme.textSecondary,
              }}
            >
              Takeoff System
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: "20px 0", overflowY: "auto" }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                style={{
                  width: "100%",
                  padding: "12px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  border: "none",
                  background: isActive ? currentTheme.accent : "transparent",
                  color: isActive ? "#ffffff" : currentTheme.text,
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: isActive ? "600" : "400",
                  transition: "all 0.2s ease",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    e.currentTarget.style.background = currentTheme.hover;
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    e.currentTarget.style.background = "transparent";
                }}
              >
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Project Actions */}
        <div
          style={{
            padding: "20px",
            borderTop: `1px solid ${currentTheme.border}`,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <button
            onClick={saveProject}
            style={{
              padding: "10px",
              background: currentTheme.accent,
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            <Save size={16} />
            Save Project
          </button>
          <label
            style={{
              padding: "10px",
              background: "transparent",
              color: currentTheme.text,
              border: `1px solid ${currentTheme.border}`,
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            <Upload size={16} />
            Load Project
            <input
              type="file"
              accept=".json"
              onChange={loadProject}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <header
          style={{
            background: currentTheme.card,
            borderBottom: `1px solid ${currentTheme.border}`,
            padding: "16px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "8px",
                display: "flex",
                alignItems: "center",
                color: currentTheme.text,
              }}
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "600" }}>
              {navItems.find((item) => item.id === currentView)?.label ||
                "Dashboard"}
            </h1>
          </div>
        </header>

        {/* Main Content Area */}
        <main
          style={{
            flex: 1,
            overflow: "auto",
            padding: "24px",
            background: currentTheme.bg,
          }}
        >
          {renderView()}
        </main>
      </div>
    </div>
  );
}

// Dashboard View Component
function DashboardView({ theme, totals, projectInfo }) {
  const cards = [
    {
      label: "Site Clearance",
      value: totals.clearArea.toFixed(2),
      unit: "m²",
      color: "#4CAF50",
    },
    {
      label: "Total Excavation",
      value: totals.excavationVolume.toFixed(2),
      unit: "m³",
      color: "#FF9800",
    },
    {
      label: "Paved Area",
      value: totals.totalPavedArea.toFixed(2),
      unit: "m²",
      color: "#2196F3",
    },
    {
      label: "Murram Filling",
      value: totals.murramVolume.toFixed(2),
      unit: "m³",
      color: "#9C27B0",
    },
    {
      label: "Hardcore",
      value: totals.hardcoreVolume.toFixed(2),
      unit: "m³",
      color: "#FF5722",
    },
    {
      label: "Bitumen",
      value: totals.bitumenVolume.toFixed(2),
      unit: "m³",
      color: "#607D8B",
    },
  ];

  return (
    <div>
      {/* Welcome Section */}
      <div
        style={{
          background: theme.card,
          borderRadius: "12px",
          padding: "32px",
          marginBottom: "24px",
          border: `1px solid ${theme.border}`,
        }}
      >
        <h2
          style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: "600" }}
        >
          {projectInfo.projectName}
        </h2>
        <p style={{ margin: 0, color: theme.textSecondary, fontSize: "16px" }}>
          {projectInfo.location} • Drawing: {projectInfo.drawingNumber} •{" "}
          {projectInfo.date}
        </p>
      </div>

      {/* Quantity Cards */}
      <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "600" }}>
        Quick Summary
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "20px",
          marginBottom: "32px",
        }}
      >
        {cards.map((card, index) => (
          <div
            key={index}
            style={{
              background: theme.card,
              borderRadius: "12px",
              padding: "24px",
              border: `1px solid ${theme.border}`,
              borderLeft: `4px solid ${card.color}`,
              transition: "transform 0.2s ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.transform = "translateY(-4px)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.transform = "translateY(0)")
            }
          >
            <div
              style={{
                color: theme.textSecondary,
                fontSize: "14px",
                marginBottom: "8px",
              }}
            >
              {card.label}
            </div>
            <div
              style={{ display: "flex", alignItems: "baseline", gap: "8px" }}
            >
              <span
                style={{
                  fontSize: "32px",
                  fontWeight: "700",
                  color: card.color,
                }}
              >
                {card.value}
              </span>
              <span style={{ fontSize: "16px", color: theme.textSecondary }}>
                {card.unit}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Area Breakdown */}
      <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "600" }}>
        Area Breakdown
      </h3>
      <div
        style={{
          background: theme.card,
          borderRadius: "12px",
          padding: "24px",
          border: `1px solid ${theme.border}`,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 8px 0",
                color: theme.textSecondary,
                fontSize: "14px",
              }}
            >
              Road Area
            </p>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "600" }}>
              {totals.roadArea.toFixed(2)} m²
            </p>
          </div>
          <div>
            <p
              style={{
                margin: "0 0 8px 0",
                color: theme.textSecondary,
                fontSize: "14px",
              }}
            >
              Parking Area
            </p>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "600" }}>
              {totals.parkingArea.toFixed(2)} m²
            </p>
          </div>
          <div>
            <p
              style={{
                margin: "0 0 8px 0",
                color: theme.textSecondary,
                fontSize: "14px",
              }}
            >
              Driveway Area
            </p>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "600" }}>
              {totals.drivewayArea.toFixed(2)} m²
            </p>
          </div>
          <div>
            <p
              style={{
                margin: "0 0 8px 0",
                color: theme.textSecondary,
                fontSize: "14px",
              }}
            >
              Bellmouth Area
            </p>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "600" }}>
              {totals.bellmouthArea.toFixed(2)} m²
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}





// Settings View
function SettingsView({ theme }) {
  return (
    <div
      style={{
        background: theme.card,
        borderRadius: "12px",
        padding: "32px",
        border: `1px solid ${theme.border}`,
      }}
    >
      <h3 style={{ margin: "0 0 24px 0", fontSize: "20px", fontWeight: "600" }}>
        Settings
      </h3>

      <div style={{ marginBottom: "24px" }}>
        <h4
          style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600" }}
        >
          API Configuration
        </h4>
        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            Backend API URL
          </label>
          <input
            type="text"
            defaultValue="http://localhost:8001"
            style={{
              width: "100%",
              padding: "12px",
              background: theme.bg,
              border: `1px solid ${theme.border}`,
              borderRadius: "6px",
              color: theme.text,
              fontSize: "14px",
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <h4
          style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600" }}
        >
          Units
        </h4>
        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            Measurement System
          </label>
          <select
            style={{
              width: "100%",
              padding: "12px",
              background: theme.bg,
              border: `1px solid ${theme.border}`,
              borderRadius: "6px",
              color: theme.text,
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            <option value="metric">Metric (m, m², m³)</option>
            <option value="imperial">Imperial (ft, ft², ft³)</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <h4
          style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600" }}
        >
          Standards
        </h4>
        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            Measurement Standard
          </label>
          <select
            style={{
              width: "100%",
              padding: "12px",
              background: theme.bg,
              border: `1px solid ${theme.border}`,
              borderRadius: "6px",
              color: theme.text,
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            <option value="cesmm4">CESMM4</option>
            <option value="cesmm3">CESMM3</option>
            <option value="smm7">SMM7</option>
          </select>
        </div>
      </div>

      <button
        style={{
          padding: "12px 24px",
          background: theme.accent,
          color: "#ffffff",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "500",
        }}
      >
        Save Settings
      </button>
    </div>
  );
}
