import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import { Menu, Settings, HammerIcon } from "lucide-react";
import Sidebar from "./components/Sidebar";
import RightSidebar from "./components/RightSidebar";
import ChatPage from "./components/ChatPage";
import SurveyingApp from "./Surveying/surveying_app";
import CadDrawer from "./Drawings/cad_drawing";
import StructuralEngineeeringSuite from "./ReinforcedConcrete/Beams/StructuralEngineeeringSuite";
import Columnmain from "./ReinforcedConcrete/Columns/Columnmain";
import StairDesignerApp from "./ReinforcedConcrete/Stairs/stair_main_app";
import FoundationDesignApp from "./ReinforcedConcrete/Foundations/foundation_design_app";
import WallDesignCalculator from "./ReinforcedConcrete/Walls/main_wall_app";
import MainSlabApp from "./ReinforcedConcrete/Slabs/main_slab_app";
import SteelDesignApp from "./SteelDesign/steel_design_app";
import QuantityTakeoff from "./takeoff2/QuantityTakeoff";
import ApproximateQuantities from "./takeoff2/ApproximateQuantities";
import BOQ from "./takeoff2/BOQ";
import DocumentViewer from "./takeoff2/DocumentViewer";
import IndividualMembers from "./takeoff2/IndividualMembers";
import MainRetainingApp from "./ReinforcedConcrete/Rwall/main_app_component";
import BoltedConnectionsModule from "./SteelDesign/bolted_connections_frontend";
import WeldedConnectionsModule from "./SteelDesign/welded_joints_frontend";

// Wrapper components for navigation
const QuantityTakeoffWrapper = () => {
  const navigate = useNavigate();
  return (
    <QuantityTakeoff
      onViewDiagram={() => {}}
      onGoToApproximate={() => navigate("/quantity/manual/approximate")}
      onGoToBOQ={() => navigate("/quantity/manual/boq")}
      onGoToDocuments={() => navigate("/quantity/manual/documents")}
    />
  );
};

const ApproximateQuantitiesWrapper = () => {
  const navigate = useNavigate();
  return (
    <ApproximateQuantities
      onViewDiagram={() => {}}
      onGoToTakeoff={() => navigate("/quantity/manual/taking-off")}
      onGoToBOQ={() => navigate("/quantity/manual/boq")}
      onGoToDocuments={() => navigate("/quantity/manual/documents")}
    />
  );
};

const BOQWrapper = () => {
  const navigate = useNavigate();
  return (
    <BOQ
      onViewDiagram={() => {}}
      onGoToTakeoff={() => navigate("/quantity/manual/taking-off")}
      onGoToApproximate={() => navigate("/quantity/manual/approximate")}
      onGoToDocuments={() => navigate("/quantity/manual/documents")}
    />
  );
};

const DocumentViewerWrapper = () => {
  const navigate = useNavigate();
  return (
    <DocumentViewer
      onViewDiagram={() => {}}
      onGoToTakeoff={() => navigate("/quantity/manual/taking-off")}
      onGoToApproximate={() => navigate("/quantity/manual/approximate")}
      onGoToBOQ={() => navigate("/quantity/manual/boq")}
    />
  );
};

// Main App Component
const EngineeringApp = () => {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  return (
    <Router>
      <div className={isDark ? "dark" : ""}>
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
          {/* Header */}
          <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
                className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <Menu size={24} className="text-gray-700 dark:text-gray-300" />
              </button>
              <div className="flex items-center gap-1">
                <div className="w-10 h-10  rounded-lg flex items-center justify-center">
                  <HammerIcon size={24} className="text-black" />
                </div>
                <h1 className="text-xl font-bold text-gray-800 dark:text-white">
                  Fundi
                </h1>
              </div>
            </div>
            <button
              onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <Settings
                size={24}
                className="text-gray-700 dark:text-gray-300"
              />
            </button>
          </header>

          {/* Main Content */}
          <div className="flex-1 flex overflow-hidden relative">
            <Sidebar
              isOpen={leftSidebarOpen}
              onClose={() => setLeftSidebarOpen(false)}
              isDark={isDark}
            />
            <main className="flex-1 overflow-y-auto p-6">
              <Routes>
                <Route path="/" element={<ChatPage />} />
                <Route path="/surveying" element={<SurveyingApp />} />
                <Route path="/drawing" element={<CadDrawer />} />
                <Route
                  path="/structural/manual/beam"
                  element={<StructuralEngineeeringSuite />}
                />
                <Route
                  path="/structural/manual/column"
                  element={<Columnmain />}
                />
                <Route
                  path="/structural/manual/stairs"
                  element={<StairDesignerApp />}
                />
                <Route
                  path="/structural/manual/retaining"
                  element={<MainRetainingApp />}
                />
                <Route
                  path="/structural/manual/foundation"
                  element={<FoundationDesignApp />}
                />
                <Route
                  path="/structural/manual/wall"
                  element={<WallDesignCalculator />}
                />
                <Route
                  path="/structural/manual/slabs"
                  element={<MainSlabApp />}
                />
                <Route
                  path="/structural/manual/steel"
                  element={<SteelDesignApp />}
                />
                <Route
                  path="/structural/automatic/bolt_connections"
                  element={<BoltedConnectionsModule />}
                />
                <Route
                  path="/structural/automatic/weld_connections"
                  element={<WeldedConnectionsModule />}
                />
                <Route
                  path="/quantity/manual/taking-off"
                  element={<QuantityTakeoffWrapper />}
                />
                <Route
                  path="/quantity/manual/approximate"
                  element={<ApproximateQuantitiesWrapper />}
                />
                <Route path="/quantity/manual/boq" element={<BOQWrapper />} />
                <Route
                  path="/quantity/manual/documents"
                  element={<DocumentViewerWrapper />}
                />
                <Route
                  path="/quantity/manual/individual-members"
                  element={<IndividualMembers />}
                />
              </Routes>
            </main>
            {/* RightSidebar overlays on the right, not inline */}
            <RightSidebar
              isOpen={rightSidebarOpen}
              toggleTheme={toggleTheme}
              onClose={() => setRightSidebarOpen(false)}
              isDark={isDark}
            />
          </div>

          {/* Footer */}
          <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <p>© 2024 Fundi - Professional Construction Assistant</p>
              <p>v1.0.0</p>
            </div>
          </footer>
        </div>
      </div>
    </Router>
  );
};

export default EngineeringApp;
