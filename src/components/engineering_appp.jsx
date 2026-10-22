import React, { useState, useRef, useEffect, useMemo } from "react";
import "./floatingPalette.css";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import {
  Settings,
  House,
  Menu,
  Send,
  Paperclip,
  X,
  Maximize2,
  Minimize2,
  Hammer,
  MessageSquare,
  ChevronLeft,
} from "lucide-react";
import Sidebar from "./components/Sidebar";
import RightSidebar from "./components/RightSidebar";
import ChatPage from "./components/ChatPage"; // Home Page
import SurveyingApp from "./Surveying/surveying_app";
import EarthworksQSModule from "./Surveying/Earthworks/erathworks";
import GNSSModuleDemo from "./Surveying/Geoid_model/geoid_model";
import RouteSurveyingModule from "./Surveying/Road_Railway/main_road";
import UtilitiesInfrastructureModule from "./Surveying/Utilities/Utilities_infrastructure";
import SurveyingDashboard from "./Surveying/Setting_&_construction/surveying_dashboard";
import TerrainModeler from "./Surveying/Contouring/Contouring_terrain";
import MonitoringDashboard from "./Surveying/Deformation_&_Monitoring/monitoring_deformation";
import SoilMechanicsModule from "./Soil_mechanics/soil_mechanics";
import CadDrawer from "./Drawings/cad_drawing";
import StructuralVisualizationComponent from "./Drawings/visualise_component";
// Isolated CAD/BIM/IFC interoperability workbench (MLightCAD + web-ifc).
// The existing Konva drawing page (/drawing) and R3F visualiser (/visualise)
// are untouched; this route is additive and can be removed independently.
import InteropWorkbench from "./interop/InteropWorkbench";
import RoadApp from "./Drawing_Components/Roads/RoadApp";
import ColumnsBeamsApp from "./Drawing_Components/Columns_Beams/ColumnsBeamsApp";
import { RoofStructureApp } from "./Drawing_Components/roof-structure/index";
import SlabModule from "./Drawing_Components/slabs/SlabModule";
import DimensionsApp from "./Drawing_Components/Dimensions/App";
import MaterialsApp from "./Drawing_Components/Materials/App";
import ElectricalApp from "./electrical/ElectricalApp";
import PlumbingApp from "./plumbing/PlumbingApp";

import StructuralEngineeeringSuite from "./ReinforcedConcrete/Beams/StructuralEngineeeringSuite";
import Columnmain from "./ReinforcedConcrete/Columns/Columnmain";
import StairDesignerApp from "./ReinforcedConcrete/Stairs/stair_main_app";
import FoundationMainApp from "./ReinforcedConcrete/Foundations/foundation_main_app";
import WallDesignCalculator from "./ReinforcedConcrete/Walls/main_wall_app";
import MainSlabApp from "./ReinforcedConcrete/Slabs/main_slab_app";
import MainRetainingApp from "./ReinforcedConcrete/Rwall/main_app_component";

import FramedStructureComponent from "./ReinforcedConcrete/FramedandTall/eurocode_structural_app";

import SteelDesignApp from "./SteelDesign/steel_design_app";
import BoltedConnectionsModule from "./SteelDesign/bolted_connections_frontend";
import WeldedConnectionsModule from "./SteelDesign/welded_joints_frontend";

//////////////////////////TakingOff /////////////////////
// REPLACED COMPONENTS
import EnglishMethodTakeoffSheet from "./takeoff2/ExternalWorks/EnglishMethodTakeoffSheet";
import { UniversalSheet, UniversalBOQ } from "./takeoff2/universal_component";

// import QuantityTakeoff from "./takeoff2/QuantityTakeoff"; // REMOVED
// import ApproximateQuantities from "./takeoff2/ApproximateQuantities"; // REMOVED
// import BOQ from "./takeoff2/BOQ"; // REMOVED

import DocumentViewer from "./takeoff2/DocumentViewer";

import DrainageComponenet from "./takeoff2/Manhole/MainTakeoff";
import RoofComponent from "./takeoff2/RoofWorks/RoofMain";
import ExternalWorksComponent from "./takeoff2/ExternalWorks/MainExternalWorks";
import SepticTakeoffApp from "./takeoff2/septik/septik_tank";
import SwimmingPoolTakeoffApp from "./takeoff2/swimming/swimming_pool";
import BasementTakeoffApp from "./takeoff2/Basement_Takeoff";
import RCCSuperstructureApp from "./takeoff2/superstructure";
import DoorWindowTakeoff from "./takeoff2/Door_Window/Doors&Window";
import InternalFinishesTakeoff from "./takeoff2/Internal_Finishes/internal_finishes";
import SuperstructureTakeoffApp from "./takeoff2/Superstructure/Superstructure_takeoff";
import UnderGroundTankComponent from "./takeoff2/underground_tank";
import SubstructureTakeoffApp from "./takeoff2/SubStrucure_works/substructure_works";
import StaircaseTakeoffApp from "./takeoff2/Stairs/Enhanced_Stairs";
import ElectricalPlumbingTakeoff from "./takeoff2/Electrical_Plumbing/ElectricalPlumbingTakeoff";

//////////////////////////TakingOff /////////////////////

///////// Timber //////////
///////// Timber //////////
import TimberUI from "./Timber/Timber_ui";

///////// Timber //////////

//// Masonry //////
import MasonryUI from "./masonry/Masonry_ui";

//// Masonry //////

import { getToolMeta, getGroupLabel } from "../navigation/toolRegistry";
import { action } from "./shared/ui/tokens";
import { TakeoffBridgeProvider } from "../state/TakeoffBridgeContext";
import { rememberToolVisit } from "../state/recentTools";

/* -------------------------------------------------------------------------- */
/*  Quantity-surveying document wrappers                                      */
/*                                                                            */
/*  These deliberately stay thin: the measurement documents (taking-off      */
/*  sheet, dimension paper, BOQ) are standard documents and must not be       */
/*  redesigned. Only the shared page header/action row is standardised, and   */
/*  it collapses to a wrap-friendly layout on phones.                         */
/* -------------------------------------------------------------------------- */

const DocumentShell = ({ title, subtitle, actions, children }) => (
  <div className="flex h-full min-h-0 flex-col">
    <div className="flex flex-col gap-2 border-b border-gray-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3">
      <div className="min-w-0">
        <h1 className="truncate text-base font-bold text-gray-900 dark:text-white sm:text-xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-slate-400 sm:text-xs">
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
    <div className="min-h-0 flex-1 overflow-auto bg-gray-50 p-2 dark:bg-slate-950 sm:p-4">
      {children}
    </div>
  </div>
);

const QuantityTakeoffWrapper = ({ takeoffData, setTakeoffData }) => {
  const navigate = useNavigate();
  return (
    <DocumentShell
      title="Quantity Takeoff (English Method)"
      subtitle="Timesing · dimensioning · squaring"
      actions={
        <>
          <button
            type="button"
            onClick={() => navigate("/quantity/manual/approximate")}
            className={`${action.base} ${action.secondary}`}
          >
            View Sheet
          </button>
          <button
            type="button"
            onClick={() => navigate("/quantity/manual/boq")}
            className={`${action.base} ${action.secondary}`}
          >
            View BOQ
          </button>
          <button
            type="button"
            onClick={() => navigate("/quantity/manual/documents")}
            className={`${action.base} ${action.secondary}`}
          >
            Documents
          </button>
        </>
      }
    >
      <EnglishMethodTakeoffSheet
        initialItems={takeoffData}
        onChange={setTakeoffData}
        projectInfo={{
          projectName: "Manual Takeoff Project",
          clientName: "Client Name",
          projectDate: new Date().toLocaleDateString(),
        }}
      />
    </DocumentShell>
  );
};

const ApproximateQuantitiesWrapper = ({ takeoffData }) => {
  const navigate = useNavigate();
  return (
    <DocumentShell
      title="Dimension Paper"
      subtitle="Standard dimension paper derived from the current takeoff"
      actions={
        <>
          <button
            type="button"
            onClick={() => navigate("/quantity/manual/taking-off")}
            className={`${action.base} ${action.secondary}`}
          >
            Edit Takeoff
          </button>
          <button
            type="button"
            onClick={() => navigate("/quantity/manual/boq")}
            className={`${action.base} ${action.secondary}`}
          >
            View BOQ
          </button>
          <button
            type="button"
            onClick={() => navigate("/quantity/manual/documents")}
            className={`${action.base} ${action.secondary}`}
          >
            Documents
          </button>
        </>
      }
    >
      <UniversalSheet items={takeoffData} />
    </DocumentShell>
  );
};

const BOQWrapper = ({ takeoffData }) => {
  const navigate = useNavigate();
  return (
    <DocumentShell
      title="Bill of Quantities"
      subtitle="Priced bill generated from the current takeoff"
      actions={
        <>
          <button
            type="button"
            onClick={() => navigate("/quantity/manual/taking-off")}
            className={`${action.base} ${action.secondary}`}
          >
            Edit Takeoff
          </button>
          <button
            type="button"
            onClick={() => navigate("/quantity/manual/approximate")}
            className={`${action.base} ${action.secondary}`}
          >
            View Sheet
          </button>
          <button
            type="button"
            onClick={() => navigate("/quantity/manual/documents")}
            className={`${action.base} ${action.secondary}`}
          >
            Documents
          </button>
        </>
      }
    >
      <UniversalBOQ items={takeoffData} />
    </DocumentShell>
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

/* -------------------------------------------------------------------------- */
/*  Chat input                                                                */
/* -------------------------------------------------------------------------- */

const ChatInputWithLogic = ({
  input,
  setInput,
  handleSend,
  attachments,
  setAttachments,
  fileInputRef,
  handleFileSelect,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"; // Reset height
      const scrollHeight = textareaRef.current.scrollHeight;
      // Cap at roughly 6 lines (approx 150px)
      textareaRef.current.style.height = Math.min(scrollHeight, 150) + "px";
    }
  }, [input]);

  const handleExpandToggle = () => setIsExpanded(!isExpanded);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      // Reset height manually
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    }
  };

  return (
    <>
      {/* Standard Input Bubble */}
      <div className="relative w-full transition-all duration-300">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl opacity-75 group-hover:opacity-100 transition duration-200 blur shadow-lg filter"></div>
          <div className="relative flex items-end bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden p-1">
            <div className="flex-1 min-h-[36px]">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Fundi anything..."
                aria-label="Ask Fundi"
                className="w-full bg-transparent border-none focus:ring-0 px-4 py-1.5 text-gray-800 dark:text-white placeholder-gray-500 resize-none max-h-[150px] overflow-y-auto custom-scrollbar leading-relaxed"
                rows={1}
                style={{ minHeight: "36px" }}
              />
            </div>

            <div className="flex items-center pb-1 gap-1 pl-2">
              <button
                type="button"
                onClick={handleExpandToggle}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title="Expand to fullscreen"
                aria-label="Expand query editor"
              >
                <Maximize2 size={18} />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Attach files"
              >
                <Paperclip size={18} />
              </button>
              <button
                type="button"
                onClick={handleSend}
                className="inline-flex h-11 w-11 items-center justify-center bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                aria-label="Send message"
              >
                <Send size={18} />
              </button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple />
          </div>
        </div>
        {attachments.length > 0 && (
          <div className="absolute top-full mt-2 left-0 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg flex gap-2 text-xs z-50">
            {attachments.length} file(s) attached
          </div>
        )}
      </div>

      {/* Expanded Fullscreen Input Modal */}
      {isExpanded && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-4xl h-[90dvh] sm:h-[80vh] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
              <h3 className="font-semibold text-gray-700 dark:text-gray-200">Detailed Query Editor</h3>
              <button
                type="button"
                onClick={handleExpandToggle}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Close detailed query editor"
              >
                <Minimize2 size={20} />
              </button>
            </div>
            <div className="flex-1 min-h-0 p-4">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full h-full bg-transparent border-none focus:ring-0 text-gray-800 dark:text-white text-base sm:text-lg leading-relaxed resize-none p-0"
                placeholder="Type your detailed engineering query here..."
                aria-label="Detailed engineering query"
                autoFocus
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex flex-wrap justify-between items-center gap-2">
              <div className="text-xs text-gray-500">
                {attachments.length} attachment(s)
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`${action.base} ${action.secondary}`}
                >
                  <Paperclip size={18} /> Attach
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSend();
                    handleExpandToggle();
                  }}
                  className={`${action.base} ${action.primary}`}
                >
                  <Send size={18} /> Send Query
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  Application shell                                                         */
/* -------------------------------------------------------------------------- */

/**
 * AppLayout — the one and only application chrome.
 *
 * Layout contract (responsive):
 * - The header and footer are *in flow* (`shrink-0`) and the main region owns the
 *   scroll (`flex-1 min-h-0 overflow-y-auto`). Workflow pages therefore never
 *   hide content behind fixed bars, and canvases that need the full viewport can
 *   do so inside the main region.
 * - Phones: compact single-row header with menu / home / back / active tool /
 *   chat / settings. The text chat input lives in the chat sheet instead of
 *   consuming a second header row (that two-row header used to eat ~96px of a
 *   360px-wide screen).
 * - Tablets and desktops: the inline chat input is restored in the header.
 * - The active tool name is always visible, so the user knows where they are,
 *   and a back control returns to the tool's registered parent route.
 */
const AppLayout = ({ children, isDark, toggleTheme }) => {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);

  // Chat State
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false); // Toggle for chat results view
  const fileInputRef = useRef(null);

  // Shared Takeoff State
  const [takeoffData, setTakeoffData] = useState([]);

  // AI Quality of Life Features
  const [thinkingTime, setThinkingTime] = useState(0);
  // null = not verified yet; true/false is set from real request outcomes so the
  // status badge never claims the service is online or offline without evidence.
  const [isAiLive, setIsAiLive] = useState(null);
  const timerRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();
  const isHomePage = location.pathname === "/";

  // Route metadata drives the header title, the back control and the document
  // title. Purely presentational — routes themselves are unchanged.
  const activeTool = useMemo(() => getToolMeta(location.pathname), [location.pathname]);
  const groupLabel = getGroupLabel(activeTool.group);

  useEffect(() => {
    document.title = `${activeTool.title} · Fundi Studio`;
  }, [activeTool.title]);

  // Minimal recent-tools history: records the tool route (path/title/group
  // only) in localStorage. No engineering inputs or results are stored.
  useEffect(() => {
    if (isHomePage) return;
    if (!activeTool?.path || activeTool.path === "/") return;
    rememberToolVisit({
      path: activeTool.path,
      title: activeTool.title,
      group: groupLabel,
    });
  }, [activeTool.path, activeTool.title, groupLabel, isHomePage]);

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;

    setChatOpen(true); // Open chat view when sending
    const userMessage = {
      text: input.trim(),
      user: true,
      attachments,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setAttachments([]);
    setLoading(true);

    // Insert an empty assistant message before the request so both streamed
    // text and service errors update the same bubble.
    const aiMessageId = Date.now() + 1;
    setMessages((prev) => [
      ...prev,
      {
        id: aiMessageId,
        text: "",
        user: false,
        timestamp: new Date().toISOString(),
      },
    ]);

    // Timer Logic for Thinking Time
    setThinkingTime(0);
    const startTime = Date.now();
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setThinkingTime(((Date.now() - startTime) / 1000).toFixed(1));
    }, 100);

    try {
      const response = await fetch("http://127.0.0.1:8001/qwen_model/generate_stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userMessage.text }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulatedResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // Stop timer and confirm the service on the first chunk.
        if (accumulatedResponse === "") {
          clearInterval(timerRef.current);
          setIsAiLive(true);
        }

        accumulatedResponse += chunk;

        // Snapshot the text for this update so a deferred state update cannot
        // read a later chunk (also keeps the loop callback lint-clean).
        const currentChunkResult = accumulatedResponse;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId ? { ...msg, text: currentChunkResult } : msg
          )
        );
      }

      if (!accumulatedResponse.trim()) {
        setIsAiLive(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? {
                  ...msg,
                  text: "Fundi service returned no content.\n\nThe AI service responded without any analysis text, so no engineering result is available. Check the service logs, then try again.",
                }
              : msg
          )
        );
      }
      setLoading(false);
    } catch (err) {
      console.error("Fundi AI service error:", err);
      clearInterval(timerRef.current);
      setIsAiLive(false);
      // Never fabricate an engineering answer. Report the service failure
      // explicitly instead of the previous mock "analysis".
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                text: "Fundi service unavailable.\n\nThe assistant could not reach the Fundi AI service at http://127.0.0.1:8001/qwen_model/generate_stream. No engineering analysis was generated.\n\nCheck that the backend is running, then send the request again. The engineering modules remain usable while the assistant is offline.",
              }
            : msg
        )
      );
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    // Basic file handling logic reused
    const files = Array.from(e.target.files);
    const newAttachments = files.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file),
      file: file,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
  };

  // Helper to render search input to pass down or render directly
  const renderSearchInput = () => (
    <ChatInputWithLogic
      input={input}
      setInput={setInput}
      handleSend={handleSend}
      attachments={attachments}
      setAttachments={setAttachments}
      fileInputRef={fileInputRef}
      handleFileSelect={handleFileSelect}
    />
  );

  // Escape closes the topmost open drawer or the chat overlay.
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      if (chatOpen) {
        setChatOpen(false);
      } else if (rightSidebarOpen) {
        setRightSidebarOpen(false);
      } else if (leftSidebarOpen) {
        setLeftSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [chatOpen, rightSidebarOpen, leftSidebarOpen]);

  // Stop the thinking timer if the shell unmounts mid-stream.
  useEffect(() => () => clearInterval(timerRef.current), []);

  const aiStatusMeta = {
    live: {
      badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      dot: "bg-green-500 animate-pulse",
      label: "AI Live",
    },
    offline: {
      badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      dot: "bg-red-500",
      label: "AI Offline",
    },
    connecting: {
      badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      dot: "bg-amber-500 animate-pulse",
      label: "Connecting",
    },
    standby: {
      badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
      dot: "bg-gray-400",
      label: "AI Standby",
    },
  };
  const aiStatus =
    loading ? "connecting" : isAiLive === true ? "live" : isAiLive === false ? "offline" : "standby";
  const { badge: aiBadgeClass, dot: aiDotClass, label: aiStatusLabel } = aiStatusMeta[aiStatus];

  return (
    <div
      className={`flex h-screen w-full flex-col overflow-hidden bg-gray-50 dark:bg-black transition-colors duration-300 ${
        isDark ? "dark" : ""
      }`}
      // `100dvh` accounts for mobile browser chrome; the inline style wins over
      // the `h-screen` fallback regardless of Tailwind's utility ordering.
      style={{ height: "100dvh" }}
      data-active-tool={activeTool.path}
    >
      {/* Keyboard skip link: visible only when focused. */}
      <a
        href="#fundi-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[110] focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      {/* ---------------------------------------------------------------- header */}
      <header
        className={`relative z-40 shrink-0 ${
          isHomePage
            ? "bg-transparent"
            : "border-b border-gray-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
        }`}
      >
        <div className="flex items-center gap-1 px-2 py-1.5 sm:gap-2 sm:px-4">
          {/* Left: navigation cluster */}
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <button
              type="button"
              onClick={() => setLeftSidebarOpen(true)}
              className={action.icon}
              aria-label="Open navigation and history"
              aria-expanded={leftSidebarOpen}
            >
              <Menu size={20} aria-hidden="true" />
            </button>

            {!isHomePage && (
              <button
                type="button"
                onClick={() => navigate(activeTool.parent || "/")}
                className={action.icon}
                aria-label={`Back to ${getToolMeta(activeTool.parent || "/").title}`}
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate("/")}
              className={`${action.icon} ${isHomePage ? "hidden sm:inline-flex" : ""}`}
              aria-label="Go to home"
            >
              <House size={20} aria-hidden="true" />
            </button>

            <span className="hidden items-center gap-1 pl-1 sm:flex">
              <Hammer size={16} className="text-blue-600" aria-hidden="true" />
              <span className="text-sm font-bold text-blue-600">Fundi</span>
            </span>
          </div>

          {/* Middle: active tool identity (and the inline chat input on ≥md) */}
          <div className="min-w-0 flex-1 px-1">
            {!isHomePage && (
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold leading-tight text-gray-900 dark:text-white sm:text-sm">
                  {activeTool.title}
                </p>
                <p className="hidden truncate text-[10px] leading-tight text-gray-500 dark:text-slate-400 sm:block">
                  {groupLabel}
                  {activeTool.standard ? ` · ${activeTool.standard}` : ""}
                </p>
              </div>
            )}
          </div>

          {/* Inline assistant input — desktop/tablet only; phones use the sheet. */}
          {!isHomePage && (
            <div className="hidden min-w-0 max-w-xl flex-1 md:block">
              {renderSearchInput()}
            </div>
          )}

          {/* Right: assistant + settings */}
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className={`${action.icon} md:hidden`}
              aria-label="Open Fundi assistant"
            >
              <MessageSquare size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setRightSidebarOpen(true)}
              className={action.icon}
              aria-label="Open settings"
              aria-expanded={rightSidebarOpen}
            >
              <Settings size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------- chat overlay */}
      {chatOpen && (
        <div
          className="fixed inset-0 z-[70] flex h-[100dvh] flex-col bg-gray-50 dark:bg-black animate-in slide-in-from-bottom-5 duration-300"
          role="dialog"
          aria-modal="true"
          aria-label="Fundi engineering assistant conversation"
        >
          {/* Overlay header */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-slate-800 sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                <Hammer size={18} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-bold text-gray-800 dark:text-gray-100 sm:text-base">
                    Engineering Assistant
                  </h3>
                  <span
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${aiBadgeClass}`}
                    title={
                      aiStatus === "standby"
                        ? "Service status is verified when you send a message."
                        : undefined
                    }
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${aiDotClass}`} aria-hidden="true" />
                    {aiStatusLabel}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 sm:text-xs">
                  Powered by Fundi AI
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label="Close conversation"
            >
              <X size={22} aria-hidden="true" />
            </button>
          </div>

          {/* Messages Area - Scrollable, header/input stay pinned */}
          <div
            className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4"
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
          >
            <div className="mx-auto w-full max-w-4xl space-y-4 sm:space-y-5">
              {messages.length === 0 && (
                <div className="mt-16 text-center text-sm text-gray-400">
                  <p>Start a new conversation…</p>
                  <p className="mt-1 text-xs">
                    Ask about a design check, a quantity or a drawing.
                  </p>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex w-full ${msg.user ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`relative max-w-[92%] rounded-2xl p-3 shadow-sm sm:max-w-[80%] sm:p-4 ${
                      msg.user
                        ? "rounded-br-none bg-blue-600 text-white"
                        : "rounded-bl-none border border-gray-100 bg-white text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
                    }`}
                  >
                    {/* Message Text */}
                    <div className="whitespace-pre-wrap break-words leading-relaxed">
                      {msg.text}
                    </div>

                    {/* Attachments included with the message */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {msg.attachments.map((att, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-1 overflow-hidden rounded bg-black/10 p-2 text-xs dark:bg-white/10"
                          >
                            <Paperclip size={12} aria-hidden="true" />
                            <span className="truncate">{att.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div
                      className={`mt-1 flex items-center gap-1 text-[10px] opacity-70 ${
                        msg.user ? "justify-end text-blue-100" : "text-gray-400"
                      }`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex w-full justify-start">
                  <div className="flex items-center gap-3 rounded-2xl rounded-bl-none border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <Hammer className="animate-hit origin-top text-blue-600 dark:text-blue-400" size={24} />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Fundi is thinking...
                      </span>
                      <span className="font-mono text-[10px] text-gray-400">
                        Thinking time:{" "}
                        {thinkingTime > 59
                          ? `${Math.floor(thinkingTime / 60)}:${String(
                              Math.floor(thinkingTime % 60)
                            ).padStart(2, "0")}`
                          : `${thinkingTime}s`}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div id="messages-end" className="h-2" />
            </div>
          </div>

          {/* Input Area - pinned below the scroll region, safe-area aware */}
          <div className="shrink-0 border-t border-gray-200 bg-white/90 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-lg dark:border-gray-800 dark:bg-gray-950/90 sm:px-4 sm:py-3">
            <div className="mx-auto max-w-4xl">{renderSearchInput()}</div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- main region */}
      <main
        id="fundi-main"
        className="relative z-0 min-h-0 flex-1 overflow-y-auto"
        // Workflow pages own their own padding through the shared layout kit.
        // No `overflow-x-hidden` here on purpose: widening an unwrapped technical
        // table must never silently clip engineering data. Tables are wrapped in
        // the shared `TableScrollRegion` instead.
      >
        {/* Takeoff bridge: specialised tools publish generated items into the
            global taking-off state used by the three document routes. Other
            sources are never overwritten (see src/state/takeoffBridge.js). */}
        <TakeoffBridgeProvider items={takeoffData} setItems={setTakeoffData}>
          <Routes>
          <Route path="/" element={<ChatPage isDark={isDark} renderSearch={renderSearchInput} />} />
          <Route path="/surveying" element={<SurveyingApp isDark={isDark} />} />
          <Route path="/surveying/geoid-model" element={<GNSSModuleDemo isDark={isDark} />} />
          <Route path="/surveying/road-railway" element={<RouteSurveyingModule isDark={isDark} />} />
          <Route path="/surveying/utilities" element={<UtilitiesInfrastructureModule isDark={isDark} />} />
          <Route path="/surveying/earthworks" element={<EarthworksQSModule isDark={isDark} />} />
          <Route path="/surveying/setting-out" element={<SurveyingDashboard isDark={isDark} />} />
          <Route path="/surveying/contouring" element={<TerrainModeler isDark={isDark} />} />
          <Route path="/surveying/monitoring" element={<MonitoringDashboard isDark={isDark} />} />
          <Route path="/surveying/soil-mechanics" element={<SoilMechanicsModule isDark={isDark} />} />
          <Route path="/visualise" element={<StructuralVisualizationComponent isDark={isDark} />} />
          <Route path="/drawing" element={<CadDrawer isDark={isDark} />} />
          <Route path="/interop/cad-bim" element={<InteropWorkbench isDark={isDark} />} />
          <Route path="/drawing/roads" element={<RoadApp isDark={isDark} />} />
          <Route path="/drawing/columns_beams" element={<ColumnsBeamsApp isDark={isDark} />} />
          <Route path="/drawing/roof_structure" element={<RoofStructureApp isDark={isDark} />} />
          <Route path="/drawing/slabs" element={<SlabModule isDark={isDark} />} />
          <Route path="/drawing/dimensions" element={<DimensionsApp /> /* Does not take isDark prop in its App.jsx */} />
          <Route path="/drawing/materials" element={<MaterialsApp /> /* Does not take isDark prop in its App.jsx */} />
          <Route path="/drawing/electrical" element={<ElectricalApp isDark={isDark} />} />
          <Route path="/drawing/plumbing" element={<PlumbingApp isDark={isDark} />} />

          <Route path="/structural/manual/beam" element={<StructuralEngineeeringSuite isDark={isDark} />} />
          <Route path="/structural/manual/column" element={<Columnmain isDark={isDark} />} />
          <Route path="/structural/manual/stairs" element={<StairDesignerApp isDark={isDark} />} />
          <Route path="/structural/manual/retaining" element={<MainRetainingApp isDark={isDark} />} />
          <Route path="/structural/manual/foundation" element={<FoundationMainApp isDark={isDark} />} />
          <Route path="/structural/manual/wall" element={<WallDesignCalculator isDark={isDark} />} />
          <Route path="/structural/manual/slabs" element={<MainSlabApp isDark={isDark} />} />
          <Route path="/structural/manual/steel" element={<SteelDesignApp isDark={isDark} />} />
          <Route path="/structural/automatic/bolt_connections" element={<BoltedConnectionsModule isDark={isDark} />} />
          <Route path="/structural/automatic/weld_connections" element={<WeldedConnectionsModule isDark={isDark} />} />
          <Route
            path="/quantity/manual/taking-off"
            element={<QuantityTakeoffWrapper takeoffData={takeoffData} setTakeoffData={setTakeoffData} />}
          />
          <Route
            path="/quantity/manual/approximate"
            element={<ApproximateQuantitiesWrapper takeoffData={takeoffData} />}
          />
          <Route path="/quantity/manual/boq" element={<BOQWrapper takeoffData={takeoffData} />} />
          <Route path="/quantity/manual/documents" element={<DocumentViewerWrapper />} />

          {/* // Taking Off ///////////////*/}
          <Route path="/quantity/manual/drainage-taking-off" element={<DrainageComponenet isDark={isDark} />} />
          <Route path="/quantity/manual/roof-taking-off" element={<RoofComponent isDark={isDark} />} />
          <Route path="/quantity/manual/external-taking-off" element={<ExternalWorksComponent isDark={isDark} />} />
          <Route path="/quantity/manual/septic-taking-off" element={<SepticTakeoffApp isDark={isDark} />} />
          <Route path="/quantity/manual/swimming-pool-taking-off" element={<SwimmingPoolTakeoffApp isDark={isDark} />} />
          <Route path="/quantity/manual/basement-taking-off" element={<BasementTakeoffApp isDark={isDark} />} />
          <Route path="/quantity/manual/rcc-superstructure" element={<RCCSuperstructureApp isDark={isDark} />} />
          <Route path="/quantity/manual/door_window" element={<DoorWindowTakeoff isDark={isDark} />} />
          <Route path="/quantity/manual/internal_finishes" element={<InternalFinishesTakeoff isDark={isDark} />} />
          <Route path="/quantity/manual/electrical_plumbing" element={<ElectricalPlumbingTakeoff isDark={isDark} />} />
          <Route path="/quantity/manual/superstructure-takeoff" element={<SuperstructureTakeoffApp isDark={isDark} />} />
          <Route path="/quantity/manual/Underground_tank" element={<UnderGroundTankComponent isDark={isDark} />} />
          <Route path="/quantity/manual/substructure_works" element={<SubstructureTakeoffApp isDark={isDark} />} />
          <Route
            path="/structural/manual/eurocode_structural_app"
            element={<FramedStructureComponent isDark={isDark} />}
          />
          <Route path="/quantity/manual/staircase_takeoff" element={<StaircaseTakeoffApp isDark={isDark} />} />
          {/* // Taking Off ///////////////*/}

          {/* Timber  */}
          <Route path="/structural/manual/Timber_design" element={<TimberUI isDark={isDark} />} />

          {/* Masonry */}
          <Route path="/structural/manual/Masonry_design" element={<MasonryUI isDark={isDark} />} />

          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </TakeoffBridgeProvider>
      </main>

      {/* ---------------------------------------------------------- footer */}
      <footer className="relative z-30 shrink-0 border-t border-gray-200 bg-white/90 px-3 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] text-[10px] text-gray-500 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-400 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">Fundi Engineering Suite v2.0</span>
          <span className="hidden sm:inline">&copy; 2025 All Rights Reserved</span>
        </div>
      </footer>

      {/* Sidebars - Moved to Root for better z-index handling */}
      <Sidebar isOpen={leftSidebarOpen} onClose={() => setLeftSidebarOpen(false)} isDark={isDark} />

      <RightSidebar
        isOpen={rightSidebarOpen}
        toggleTheme={toggleTheme}
        onClose={() => setRightSidebarOpen(false)}
        isDark={isDark}
      />
    </div>
  );
};

// Main App Component with Providers
const EngineeringApp = () => {
  const [isDark, setIsDark] = useState(false);
  const toggleTheme = () => setIsDark(!isDark);

  return (
    <Router>
      <AppLayout isDark={isDark} toggleTheme={toggleTheme}>
        {/* Routes are handled inside AppLayout to access renderSearchInput */}
      </AppLayout>
    </Router>
  );
};

export default EngineeringApp;
