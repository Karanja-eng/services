import React, { useState, useRef, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import axios from "axios";
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
  Box,
  DraftingCompass
} from "lucide-react";
import Sidebar from "./components/Sidebar";
import RightSidebar from "./components/RightSidebar";
import ChatPage from "./components/ChatPage"; // Home Page
import SurveyingApp from "./Surveying/surveying_app";
import EarthworksQSModule from "./Surveying/Earthworks/erathworks";
import SurveyingDashboard from "./Surveying/Setting_&_construction/surveying_dashboard";
import TerrainModeler from "./Surveying/Contouring/Contouring_terrain";
import MonitoringDashboard from "./Surveying/Deformation_&_Monitoring/monitoring_deformation";
import CadDrawer from "./Drawings/cad_drawing";
import StructuralVisualizationComponent from "./Drawings/visualise_component";

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

// Wrapper components for navigation
const QuantityTakeoffWrapper = ({ takeoffData, setTakeoffData }) => {
  const navigate = useNavigate();
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center p-4 bg-white border-b">
        <h1 className="text-2xl font-bold">Quantity Takeoff (English Method)</h1>
        <div className="flex gap-2">
          <button onClick={() => navigate("/quantity/manual/approximate")} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">View Sheet</button>
          <button onClick={() => navigate("/quantity/manual/boq")} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">View BOQ</button>
          <button onClick={() => navigate("/quantity/manual/documents")} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">Documents</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-gray-50 p-4">
        <EnglishMethodTakeoffSheet
          initialItems={takeoffData}
          onChange={setTakeoffData}
          projectInfo={{
            projectName: "Manual Takeoff Project",
            clientName: "Client Name",
            projectDate: new Date().toLocaleDateString()
          }}
        />
      </div>
    </div>
  );
};

const ApproximateQuantitiesWrapper = ({ takeoffData }) => {
  const navigate = useNavigate();
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center p-4 bg-white border-b">
        <h1 className="text-2xl font-bold">Dimension Paper</h1>
        <div className="flex gap-2">
          <button onClick={() => navigate("/quantity/manual/taking-off")} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">Edit Takeoff</button>
          <button onClick={() => navigate("/quantity/manual/boq")} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">View BOQ</button>
          <button onClick={() => navigate("/quantity/manual/documents")} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">Documents</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-gray-50 p-4">
        <UniversalSheet items={takeoffData} />
      </div>
    </div>
  );
};

const BOQWrapper = ({ takeoffData }) => {
  const navigate = useNavigate();
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center p-4 bg-white border-b">
        <h1 className="text-2xl font-bold">Bill of Quantities</h1>
        <div className="flex gap-2">
          <button onClick={() => navigate("/quantity/manual/taking-off")} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">Edit Takeoff</button>
          <button onClick={() => navigate("/quantity/manual/approximate")} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">View Sheet</button>
          <button onClick={() => navigate("/quantity/manual/documents")} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">Documents</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-gray-50 p-4">
        <UniversalBOQ items={takeoffData} />
      </div>
    </div>
  );
};

const DocumentViewerWrapper = () => {
  const navigate = useNavigate();
  return (
    <DocumentViewer
      onViewDiagram={() => { }}
      onGoToTakeoff={() => navigate("/quantity/manual/taking-off")}
      onGoToApproximate={() => navigate("/quantity/manual/approximate")}
      onGoToBOQ={() => navigate("/quantity/manual/boq")}
    />
  );
};

const ChatInputWithLogic = ({ input, setInput, handleSend, attachments, setAttachments, fileInputRef, handleFileSelect }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height
      const scrollHeight = textareaRef.current.scrollHeight;
      // Cap at roughly 6 lines (approx 150px)
      textareaRef.current.style.height = Math.min(scrollHeight, 150) + 'px';
    }
  }, [input]);

  const handleExpandToggle = () => setIsExpanded(!isExpanded);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      // Reset height manually
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
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
                className="w-full bg-transparent border-none focus:ring-0 px-4 py-1.5 text-gray-800 dark:text-white placeholder-gray-500 resize-none max-h-[150px] overflow-y-auto custom-scrollbar leading-relaxed"
                rows={1}
                style={{ minHeight: '36px' }}
              />
            </div>

            <div className="flex items-center pb-1 gap-1 pl-2">
              <button
                onClick={handleExpandToggle}
                className="p-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                title="Expand to fullscreen"
              >
                <Maximize2 size={18} />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <Paperclip size={18} />
              </button>
              <button
                onClick={handleSend}
                className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-md"
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
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
              <h3 className="font-semibold text-gray-700 dark:text-gray-200">Detailed Query Editor</h3>
              <button onClick={handleExpandToggle} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <Minimize2 size={20} />
              </button>
            </div>
            <div className="flex-1 p-4">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full h-full bg-transparent border-none focus:ring-0 text-gray-800 dark:text-white text-lg leading-relaxed resize-none p-0"
                placeholder="Type your detailed engineering query here..."
                autoFocus
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex justify-between items-center">
              <div className="text-xs text-gray-500">
                {attachments.length} attachment(s)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Paperclip size={18} /> Attach
                </button>
                <button
                  onClick={() => { handleSend(); handleExpandToggle(); }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
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

// Internal Layout & Navigation Logic
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
  const [isAiLive, setIsAiLive] = useState(false);
  const timerRef = useRef(null);

  /*
  // Check AI Status every 30 seconds
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:8001/qwen_model/status");
        setIsAiLive(response.data.status === "live");
      } catch (err) {
        setIsAiLive(false);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);
  */

  const navigate = useNavigate();
  const location = useLocation();
  const isHomePage = location.pathname === "/";

  const handleSend = async () => {
    console.log("DEBUG: handleSend triggered", input);
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

    try {
      // Adding a temporary AI message for streaming
      const aiMessageId = Date.now() + 1;
      const aiMessage = {
        id: aiMessageId,
        text: "",
        user: false,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMessage]);

      // Timer Logic for Thinking Time
      setThinkingTime(0);
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setThinkingTime(((Date.now() - startTime) / 1000).toFixed(1));
      }, 100);

      console.log("DEBUG: Calling fetch at http://127.0.0.1:8001/qwen_model/generate_stream");
      const response = await fetch("http://127.0.0.1:8001/qwen_model/generate_stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userMessage.text }),
      });

      console.log("DEBUG: Fetch response status:", response.status);

      if (!response.ok) {
        console.error("DEBUG: Fetch NOT OK:", response.status);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log("DEBUG: Fetch OK, getting reader");
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulatedResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("DEBUG: Reader done");
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        console.log("DEBUG: Received chunk:", chunk);

        // Stop timer on first chunk
        if (accumulatedResponse === "") {
          console.log("DEBUG: Stopping timer (first chunk received)");
          clearInterval(timerRef.current);
        }

        accumulatedResponse += chunk;

        // Update the specific AI message incrementally
        const currentChunkResult = accumulatedResponse; // Capture current state
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId ? { ...msg, text: currentChunkResult } : msg
          )
        );
      }

      console.log("DEBUG: Streaming loop finished. Final length:", accumulatedResponse.length);
      setLoading(false);

    } catch (err) {
      console.error("DEBUG: Backend error caught in handleSend:", err);
      // MOCK RESPONSE FOR TESTING UI
      setTimeout(() => {
        const mockResponse = {
          text: `**Fundi AI Analysis (Mock):**\n\nBased on your query regarding "${userMessage.text.substring(0, 30)}${userMessage.text.length > 30 ? '...' : ''}", here is a preliminary analysis:\n\n1. **Design Considerations:** Checked against Eurocode standards.\n2. **Recommendation:** Verify load cases in the Structural module.\n\n*Note: This is a placeholder response because the backend is currently unreachable (tried http://127.0.0.1:8001/qwen_model/generate_stream).*`,
          user: false,
          timestamp: new Date().toISOString()
        };
        setMessages((prev) =>
          prev.some(m => m.user === false && m.text === "")
            ? prev.map(m => (m.user === false && m.text === "") ? mockResponse : m)
            : [...prev, mockResponse]
        );
        setLoading(false);
        clearInterval(timerRef.current);
      }, 1500);
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
      file: file
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
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

  return (
    <div className={`flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-black transition-colors duration-300 ${isDark ? "dark" : ""}`}>

      {/* Top Bar */}
      <div className={`absolute top-0 left-0 w-full z-40 px-4 py-2 flex items-center justify-between pointer-events-none transition-all duration-300 ${isHomePage ? '' : 'bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-sm'}`}>

        {/* Top Left Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex flex-row items-center gap-1 text-blue-500-to-blue-700 ">
            <Hammer size={16} className="text-blue-600 dark:text-blue-600" />

            <h1 className=" font-bold text-blue-600 dark:text-blue-600">Fundi</h1>

          </div>
          <button
            onClick={() => setLeftSidebarOpen(true)}
            className="p-2 hover:bg-white/20 dark:hover:bg-black/20 rounded-xl transition-colors"
          >
            <Menu size={20} className="text-gray-800 dark:text-white drop-shadow-md" />
          </button>
          <div className="h-6 w-px bg-gray-400/50 dark:bg-gray-500/50 mx-1" />
          <button
            onClick={() => navigate("/")}
            className="p-2 hover:bg-white/20 dark:hover:bg-black/20 rounded-xl transition-colors"
          >
            <House size={20} className="text-gray-800 dark:text-white drop-shadow-md" />
          </button>
        </div>

        {/* Center Top Floating Chat Input - ONLY IF NOT ON HOME PAGE */}
        {!isHomePage && (
          <div className="pointer-events-auto w-full max-w-xl mx-4">
            {renderSearchInput()}
          </div>
        )}

        {/* Top Right Controls */}
        <div className="pointer-events-auto">
          <button
            onClick={() => setRightSidebarOpen(true)}
            className="p-2 hover:bg-white/20 dark:hover:bg-black/20 rounded-xl transition-colors"
          >
            <Settings size={20} className="text-gray-800 dark:text-white drop-shadow-md" />
          </button>
        </div>
      </div>

      {/* Full Screen Chat Overlay */}
      {chatOpen && (
        <div className="fixed inset-0 z-[60] bg-gray-50 dark:bg-black flex flex-col animate-in slide-in-from-bottom-5 duration-300">

          {/* Messages Area - Scrollable */}
          <div className="flex-1 overflow-y-auto w-full mx-auto p-4 space-y-6 pb-32 pt-6">
            <div className="flex justify-between items-center mb-6 pt-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Hammer size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100">Engineering Assistant</h3>
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isAiLive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${isAiLive ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></div>
                      {isAiLive ? "AI Live" : "AI Offline"}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Powered by Fundi AI</p>
                </div>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X size={24} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {messages.length === 0 && (
              <div className="text-center text-gray-400 mt-20">
                <p>Start a new conversation...</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex w-full ${msg.user ? "justify-end" : "justify-start"}`}>
                <div className={`relative max-w-[90%] md:max-w-[80%] rounded-2xl p-4 shadow-sm ${msg.user
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none"
                  }`}>

                  {/* Message Text */}
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {msg.text}
                  </div>

                  {/* Render Mock Attachments/Rich Media if any */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-3 grid gap-2 grid-cols-2">
                      {msg.attachments.map((att, i) => (
                        <div key={i} className="bg-black/10 dark:bg-white/10 p-2 rounded text-xs flex items-center gap-1 overflow-hidden">
                          <Paperclip size={12} />
                          <span className="truncate">{att.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Placeholder for AI Rich Output (Diagrams/3D - Mock implementation) */}
                  {!msg.user && msg.text.includes("structural") && (
                    <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800">
                      <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <Box size={14} /> AI Generated Preview
                      </div>
                      {/* Placeholder visual */}
                      <div className="h-32 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-900 rounded-lg flex items-center justify-center relative overflow-hidden group cursor-pointer hover:ring-2 ring-blue-500 transition-all">
                        <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 opacity-20">
                          {[...Array(36)].map((_, n) => <div key={n} className="border-[0.5px] border-gray-500/30"></div>)}
                        </div>
                        <div className="z-10 text-xs text-gray-500 flex flex-col items-center">
                          <div className="w-16 h-16 border-2 border-blue-500 rounded flex items-center justify-center mb-2 bg-white/50 backdrop-blur-sm">
                            <DraftingCompass size={24} className="text-blue-600" />
                          </div>
                          Click to view interactive model
                        </div>
                      </div>
                    </div>
                  )}

                  <div className={`mt-1 text-[10px] opacity-70 flex items-center gap-1 ${msg.user ? "justify-end text-blue-100" : "text-gray-400"}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex w-full justify-start">
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl rounded-bl-none p-4 flex items-center gap-3 shadow-sm">
                  <Hammer className="animate-hit origin-top text-blue-600 dark:text-blue-400" size={24} />
                  <div className="flex flex-col">
                    <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">Fundi is thinking...</span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      Thinking time: {
                        thinkingTime > 59
                          ? `${Math.floor(thinkingTime / 60)}:${(Math.floor(thinkingTime % 60)).toString().padStart(2, '0')}`
                          : `${thinkingTime}s`
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div id="messages-end" className="h-4" />
          </div>

          {/* Persistent Input Area at Bottom */}
          <div className="absolute bottom-0 left-0 w-full bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800 p-4 pb-8 z-50">
            <div className="max-w-4xl mx-auto">
              {renderSearchInput()}
            </div>
          </div>

        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 relative z-0 pt-0 overflow-hidden">
        <main className={`h-full w-full overflow-y-auto transition-all duration-300 ${isHomePage ? '' : 'pt-24'}`}>
          {/* Pass renderSearchInput to children if they are standard Routes, but since Routes are nested below, we must pass it as a prop to ChatPage explicitly.
          */}
          <Routes>
            <Route path="/" element={<ChatPage isDark={isDark} renderSearch={renderSearchInput} />} />
            <Route
              path="/surveying"
              element={<SurveyingApp isDark={isDark} />}
            />
            <Route
              path="/surveying/earthworks"
              element={<EarthworksQSModule isDark={isDark} />}
            />
            <Route
              path="/surveying/setting-out"
              element={<SurveyingDashboard isDark={isDark} />}
            />
            <Route
              path="/surveying/contouring"
              element={<TerrainModeler isDark={isDark} />}
            />
            <Route
              path="/surveying/monitoring"
              element={<MonitoringDashboard isDark={isDark} />}
            />
            <Route
              path="/visualise"
              element={<StructuralVisualizationComponent isDark={isDark} />}
            />
            <Route
              path="/drawing"
              element={<CadDrawer isDark={isDark} />}
            />

            <Route
              path="/structural/manual/beam"
              element={<StructuralEngineeeringSuite isDark={isDark} />}
            />
            <Route
              path="/structural/manual/column"
              element={<Columnmain isDark={isDark} />}
            />
            <Route
              path="/structural/manual/stairs"
              element={<StairDesignerApp isDark={isDark} />}
            />
            <Route
              path="/structural/manual/retaining"
              element={<MainRetainingApp isDark={isDark} />}
            />
            <Route
              path="/structural/manual/foundation"
              element={<FoundationMainApp isDark={isDark} />}
            />
            <Route
              path="/structural/manual/wall"
              element={<WallDesignCalculator isDark={isDark} />}
            />
            <Route
              path="/structural/manual/slabs"
              element={<MainSlabApp isDark={isDark} />}
            />
            <Route
              path="/structural/manual/steel"
              element={<SteelDesignApp isDark={isDark} />}
            />
            <Route
              path="/structural/automatic/bolt_connections"
              element={<BoltedConnectionsModule isDark={isDark} />}
            />
            <Route
              path="/structural/automatic/weld_connections"
              element={<WeldedConnectionsModule isDark={isDark} />}
            />
            <Route
              path="/quantity/manual/taking-off"
              element={<QuantityTakeoffWrapper takeoffData={takeoffData} setTakeoffData={setTakeoffData} />}
            />
            <Route
              path="/quantity/manual/approximate"
              element={<ApproximateQuantitiesWrapper takeoffData={takeoffData} />}
            />
            <Route path="/quantity/manual/boq" element={<BOQWrapper takeoffData={takeoffData} />} />
            <Route
              path="/quantity/manual/documents"
              element={<DocumentViewerWrapper />}
            />


            {/* // Taking Off ///////////////*/}
            <Route
              path="/quantity/manual/drainage-taking-off"
              element={<DrainageComponenet isDark={isDark} />}
            />
            <Route
              path="/quantity/manual/roof-taking-off"
              element={<RoofComponent isDark={isDark} />}
            />
            <Route
              path="/quantity/manual/external-taking-off"
              element={<ExternalWorksComponent isDark={isDark} />}
            />
            <Route
              path="/quantity/manual/septic-taking-off"
              element={<SepticTakeoffApp isDark={isDark} />}
            />
            <Route
              path="/quantity/manual/swimming-pool-taking-off"
              element={<SwimmingPoolTakeoffApp isDark={isDark} />}
            />
            <Route
              path="/quantity/manual/basement-taking-off"
              element={<BasementTakeoffApp isDark={isDark} />}
            />
            <Route
              path="/quantity/manual/rcc-superstructure"
              element={<RCCSuperstructureApp isDark={isDark} />}
            />
            <Route
              path="/quantity/manual/door_window"
              element={<DoorWindowTakeoff isDark={isDark} />}
            />
            <Route
              path="/quantity/manual/internal_finishes"
              element={<InternalFinishesTakeoff isDark={isDark} />}
            />
            <Route
              path="/quantity/manual/electrical_plumbing"
              element={<ElectricalPlumbingTakeoff isDark={isDark} />}
            />
            <Route
              path="/quantity/manual/superstructure-takeoff"
              element={<SuperstructureTakeoffApp isDark={isDark} />}
            />
            <Route
              path="/quantity/manual/Underground_tank"
              element={<UnderGroundTankComponent isDark={isDark} />}
            />
            <Route
              path="/quantity/manual/substructure_works"
              element={<SubstructureTakeoffApp isDark={isDark} />}
            />
            <Route
              path="/structural/manual/eurocode_structural_app"
              element={<FramedStructureComponent isDark={isDark} />}
            />
            <Route
              path="/quantity/manual/staircase_takeoff"
              element={<StaircaseTakeoffApp isDark={isDark} />}
            />

            {/* // Taking Off ///////////////*/}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Sidebars - Moved to Root for better z-index handling */}
      <Sidebar
        isOpen={leftSidebarOpen}
        onClose={() => setLeftSidebarOpen(false)}
        isDark={isDark}
      />

      <RightSidebar
        isOpen={rightSidebarOpen}
        toggleTheme={toggleTheme}
        onClose={() => setRightSidebarOpen(false)}
        isDark={isDark}
      />

      {/* Thin Footer */}
      <div className="absolute bottom-0 left-0 w-full z-30 pointer-events-none">
        <div className={`backdrop-blur-md px-4 py-1 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 transition-colors duration-300 ${isHomePage ? 'bg-transparent border-t-0' : 'bg-white/90 dark:bg-gray-900/90 border-t border-gray-200 dark:border-gray-800'}`}>
          <span>Fundi Engineering Suite v2.0</span>
          <span>&copy; 2025 All Rights Reserved</span>
        </div>
      </div>

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
