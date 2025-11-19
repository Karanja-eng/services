import React, { useState, useEffect } from "react";
import {
  Sun,
  Moon,
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

// Main Application Component
export default function ExternalWorksApp() {
  const [currentView, setCurrentView] = useState("home");
  const [theme, setTheme] = useState("light");
  const [colorScheme, setColorScheme] = useState("gray");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [projectData, setProjectData] = useState(null);
  const [calculations, setCalculations] = useState(null);

  // Theme configurations
  const themes = {
    light: {
      gray: {
        bg: "#f5f5f5",
        card: "#ffffff",
        text: "#1a1a1a",
        textSecondary: "#666666",
        border: "#e0e0e0",
        accent: "#4CAF50",
        accentHover: "#45a049",
        sidebar: "#f8f9fa",
        hover: "#e8e8e8",
      },
      white: {
        bg: "#ffffff",
        card: "#fafafa",
        text: "#1a1a1a",
        textSecondary: "#666666",
        border: "#e0e0e0",
        accent: "#2196F3",
        accentHover: "#1976D2",
        sidebar: "#ffffff",
        hover: "#f5f5f5",
      },
    },
    dark: {
      gray: {
        bg: "#1a1a1a",
        card: "#2d2d2d",
        text: "#ffffff",
        textSecondary: "#b0b0b0",
        border: "#404040",
        accent: "#4CAF50",
        accentHover: "#66BB6A",
        sidebar: "#252525",
        hover: "#353535",
      },
      white: {
        bg: "#0d1117",
        card: "#161b22",
        text: "#f0f6fc",
        textSecondary: "#8b949e",
        border: "#30363d",
        accent: "#58a6ff",
        accentHover: "#79c0ff",
        sidebar: "#0d1117",
        hover: "#21262d",
      },
    },
  };

  const currentTheme = themes[theme][colorScheme];

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
      { formData, view3DConfig, theme, colorScheme },
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
          if (data.theme) setTheme(data.theme);
          if (data.colorScheme) setColorScheme(data.colorScheme);
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
          <Visualizer3DView
            theme={currentTheme}
            config={view3DConfig}
            setConfig={setView3DConfig}
          />
        );
      case "input":
        return (
          <InputFormView
            theme={currentTheme}
            formData={formData}
            setFormData={setFormData}
          />
        );
      case "takeoff":
        return (
          <TakeoffSheetView
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

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Color Scheme Selector */}
            <select
              value={colorScheme}
              onChange={(e) => setColorScheme(e.target.value)}
              style={{
                padding: "8px 12px",
                background: currentTheme.bg,
                color: currentTheme.text,
                border: `1px solid ${currentTheme.border}`,
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              <option value="gray">Gray</option>
              <option value="white">White</option>
            </select>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              style={{
                background: currentTheme.bg,
                border: `1px solid ${currentTheme.border}`,
                padding: "8px 12px",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: currentTheme.text,
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
              {theme === "light" ? "Dark" : "Light"}
            </button>
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

// 3D Visualizer View (Placeholder)
function Visualizer3DView({ theme, config, setConfig }) {
  return (
    <div
      style={{
        background: theme.card,
        borderRadius: "12px",
        padding: "32px",
        border: `1px solid ${theme.border}`,
        minHeight: "600px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <Box
          size={64}
          color={theme.textSecondary}
          style={{ margin: "0 auto 16px" }}
        />
        <h3
          style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: "600" }}
        >
          3D Visualizer
        </h3>
        <p style={{ margin: 0, color: theme.textSecondary }}>
          The 3D visualization component will render here.
          <br />
          Use the previously created "3D External Works Visualizer" artifact.
        </p>
      </div>
    </div>
  );
}

// Input Form View (Placeholder)
function InputFormView({ theme, formData, setFormData }) {
  return (
    <div
      style={{
        background: theme.card,
        borderRadius: "12px",
        padding: "32px",
        border: `1px solid ${theme.border}`,
      }}
    >
      <div style={{ textAlign: "center", padding: "64px 32px" }}>
        <FileText
          size={64}
          color={theme.textSecondary}
          style={{ margin: "0 auto 16px" }}
        />
        <h3
          style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: "600" }}
        >
          Input Form
        </h3>
        <p style={{ margin: 0, color: theme.textSecondary }}>
          The comprehensive input form component will render here.
          <br />
          Use the previously created "External Works Input Form" artifact.
        </p>
      </div>
    </div>
  );
}

// Takeoff Sheet View (Placeholder)
function TakeoffSheetView({ theme, formData, totals }) {
  return (
    <div
      style={{
        background: theme.card,
        borderRadius: "12px",
        padding: "32px",
        border: `1px solid ${theme.border}`,
      }}
    >
      <div style={{ textAlign: "center", padding: "64px 32px" }}>
        <Calculator
          size={64}
          color={theme.textSecondary}
          style={{ margin: "0 auto 16px" }}
        />
        <h3
          style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: "600" }}
        >
          Takeoff Sheet
        </h3>
        <p style={{ margin: 0, color: theme.textSecondary }}>
          The English Method takeoff sheet will render here.
          <br />
          Use the previously created "English Method Takeoff Sheet" artifact.
        </p>
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
            defaultValue="http://localhost:8000"
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
