import React, { useState, useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import {
  Save,
  Undo2,
  Redo2,
  Grid3X3,
  Eye,
  Plus,
  Trash2,
  Copy,
  Move,
  RotateCw,
  Circle,
  Square,
  Zap,
  Download,
  ChevronLeft,
  Upload,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Minus,
  Type,
  Ruler,
  BookOpen,
  Layers,
  EyeOff,
  Lock,
  Unlock,
  Settings,
  Home,
  Maximize,
  Scale,
  Minus as Stretch,
  ArrowRight,
  Send,
  Command,
  Clock,
  Sparkles,
  MessageCircle,
  ChevronRight,
  File,
  MousePointer2,
  Box,
  Hash,
  Share2,
  RefreshCw,
} from "lucide-react";
import { cadStorageService } from "./cadStorageService";
import * as geometry from "./cadGeometryUtils";
import { Stage, Layer, Line as KonvaLine, Circle as KonvaCircle, Rect as KonvaRect, Text as KonvaText, Group as KonvaGroup, Transformer } from 'react-konva';
import StructuralVisualizationComponent from "./visualise_component";
import { BeamKonvaGroup, getBeamCADPrimitives } from "../ReinforcedConcrete/Beams/BeamDrawer";
import { ColumnKonvaGroup, getColumnCADPrimitives } from "../ReinforcedConcrete/Columns/ColumnDrawer";
import { FoundationKonvaGroup, getFoundationCADPrimitives } from "../ReinforcedConcrete/Foundations/Foundation_viewer";

// ============ SNAP MODES ============
const SNAP_MODES = {
  ENDPOINT: "endpoint",
  MIDPOINT: "midpoint",
  CENTER: "center",
  PERPENDICULAR: "perpendicular",
  TANGENT: "tangent",
  INTERSECTION: "intersection",
  EXTENSION: "extension",
  GRID: "grid",
  NEAREST: "nearest",
};

export default function CadDrawer({ isDark, initialObjects = [], isFullScreen, onFullScreenToggle }) {
  // ============ STATE MANAGEMENT ============
  const [projectId] = useState(Date.now().toString());
  const [projectName, setProjectName] = useState("Untitled Project");
  const [mode, setMode] = useState("2D");
  const [activeTool, setActiveTool] = useState(null);
  const [objects, setObjects] = useState(initialObjects);
  const [selectedIds, setSelectedIds] = useState([]);
  const [copiedObjects, setCopiedObjects] = useState([]);

  // Layer Management
  const [layers, setLayers] = useState([
    {
      id: "1",
      name: "Layer 0",
      color: "#FFFFFF",
      visible: true,
      locked: false,
      opacity: 1.0,
    },
    {
      id: "grid",
      name: "Grid Layout",
      color: "#999999",
      visible: true,
      locked: false,
      opacity: 0.8
    },
    {
      id: "columns",
      name: "Columns",
      color: "#3B82F6",
      visible: true,
      locked: false,
      opacity: 1.0
    },
    {
      id: "beams",
      name: "Beams",
      color: "#10B981",
      visible: true,
      locked: false,
      opacity: 1.0
    },
    {
      id: "slabs",
      name: "Slabs",
      color: "#6B7280",
      visible: true,
      locked: false,
      opacity: 0.5
    },
    {
      id: "labels",
      name: "Annotations",
      color: "#F59E0B",
      visible: true,
      locked: false,
      opacity: 1.0
    },
    {
      id: "structural",
      name: "Structural Details",
      color: "#EF4444",
      visible: true,
      locked: false,
      opacity: 1.0
    },
    {
      id: "voids",
      name: "Openings/Voids",
      color: "#000000",
      visible: true,
      locked: false,
      opacity: 1.0
    }
  ]);
  const [activeLayerId, setActiveLayerId] = useState("1");
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // History Management
  const [history, setHistory] = useState([initialObjects]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Sync initialObjects if they change externally (e.g. on first load)
  useEffect(() => {
    if (initialObjects && initialObjects.length > 0) {
      console.log("CadDrawer: Setting objects from props", initialObjects.length);
      setObjects(initialObjects);
      setHistory([initialObjects]);
      setHistoryIndex(0);

      // Auto-fit on load
      setTimeout(() => {
        zoomToFit(initialObjects);
      }, 100);
    }
  }, [initialObjects]);

  const zoomToFit = (targetObjects = objects) => {
    if (!targetObjects || targetObjects.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    targetObjects.forEach(obj => {
      if (obj.type === "line") {
        if (obj.points) {
          obj.points.forEach(p => {
            minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
          });
        } else {
          minX = Math.min(minX, obj.start.x, obj.end.x);
          minY = Math.min(minY, obj.start.y, obj.end.y);
          maxX = Math.max(maxX, obj.start.x, obj.end.x);
          maxY = Math.max(maxY, obj.start.y, obj.end.y);
        }
      } else if (obj.type === "rectangle") {
        minX = Math.min(minX, obj.start.x, obj.end.x);
        minY = Math.min(minY, obj.start.y, obj.end.y);
        maxX = Math.max(maxX, obj.start.x, obj.end.x);
        maxY = Math.max(maxY, obj.start.y, obj.end.y);
      } else if (obj.type === "circle") {
        minX = Math.min(minX, obj.center.x - obj.radius);
        minY = Math.min(minY, obj.center.y - obj.radius);
        maxX = Math.max(maxX, obj.center.x + obj.radius);
        maxY = Math.max(maxY, obj.center.y + obj.radius);
      } else if (obj.type === "text") {
        minX = Math.min(minX, obj.position.x);
        minY = Math.min(minY, obj.position.y);
        maxX = Math.max(maxX, obj.position.x + 10); // Approximation
        maxY = Math.max(maxY, obj.position.y + 2);
      } else if (obj.type === "member") {
        minX = Math.min(minX, obj.x - 100);
        minY = Math.min(minY, obj.y - 100);
        maxX = Math.max(maxX, obj.x + 100);
        maxY = Math.max(maxY, obj.y + 100);
      }
    });

    if (minX === Infinity) return;

    const padding = 50;
    const width = maxX - minX;
    const height = maxY - minY;

    const stageWidth = stageRef.current.width();
    const stageHeight = stageRef.current.height();

    const scaleX = (stageWidth - padding * 2) / width;
    const scaleY = (stageHeight - padding * 2) / height;
    const newZoom = Math.min(scaleX, scaleY, 1.5); // Max zoom 1.5

    setZoomLevel(newZoom);
    setPanOffset({
      x: -minX * newZoom + (stageWidth - width * newZoom) / 2,
      y: -minY * newZoom + (stageHeight - height * newZoom) / 2
    });
  };

  // View Settings
  const [snapSettings, setSnapSettings] = useState({
    [SNAP_MODES.ENDPOINT]: true,
    [SNAP_MODES.MIDPOINT]: true,
    [SNAP_MODES.CENTER]: true,
    [SNAP_MODES.PERPENDICULAR]: true,
    [SNAP_MODES.TANGENT]: true,
    [SNAP_MODES.INTERSECTION]: true,
    [SNAP_MODES.EXTENSION]: false,
    [SNAP_MODES.GRID]: false,
    [SNAP_MODES.NEAREST]: false,
  });
  const [gridVisible, setGridVisible] = useState(true);
  const [gridSpacing, setGridSpacing] = useState(1);
  const [orthoMode, setOrthoMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // UI State
  const [leftPanelVisible, setLeftPanelVisible] = useState(true);
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [copilotTab, setCopilotTab] = useState("ai"); // ai, properties, history, commands
  const [showProperties, setShowProperties] = useState(false);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showHatchMenu, setShowHatchMenu] = useState(false);
  const [selectedHatch, setSelectedHatch] = useState("concrete");
  const [showCommandLine, setShowCommandLine] = useState(true);
  const [commandInput, setCommandInput] = useState("");
  const [commandHistory, setCommandHistory] = useState([]);
  const [commandHistoryIndex, setCommandHistoryIndex] = useState(-1);

  // Toolbar State
  const [activeToolbarTab, setActiveToolbarTab] = useState("draw"); // draw, modify, annotate, 3d, view

  // Drawing State
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const layerRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentPoint, setCurrentPoint] = useState(null);
  const [snapPoint, setSnapPoint] = useState(null);
  const [polylinePoints, setPolylinePoints] = useState([]);
  const [arcPoints, setArcPoints] = useState([]);

  // AI State
  const [aiMessages, setAiMessages] = useState([
    {
      type: "assistant",
      text: "AI Assistant ready. Describe what you want to draw.",
    },
  ]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiProcessing, setAiProcessing] = useState(false);

  // API Persistence
  const [apiConnected, setApiConnected] = useState(false);

  // ============ HATCH PATTERNS ============
  const hatchPatterns = [
    {
      id: "concrete",
      name: "Concrete",
      symbol: "▩",
      color: "#CCCCCC",
      angle: 45,
      spacing: 10,
    },
    {
      id: "steel",
      name: "Steel",
      symbol: "▨",
      color: "#999999",
      angle: 45,
      spacing: 5,
    },
    {
      id: "soil",
      name: "Soil",
      symbol: ":::",
      color: "#8B4513",
      angle: 0,
      spacing: 8,
    },
    {
      id: "sand",
      name: "Sand",
      symbol: "...",
      color: "#DEB887",
      angle: 0,
      spacing: 12,
    },
    {
      id: "gravel",
      name: "Gravel",
      symbol: "***",
      color: "#808080",
      angle: 0,
      spacing: 10,
    },
    {
      id: "grass",
      name: "Grass",
      symbol: "~~~",
      color: "#90EE90",
      angle: 0,
      spacing: 15,
    },
    {
      id: "water",
      name: "Water",
      symbol: "≈≈≈",
      color: "#4682B4",
      angle: 0,
      spacing: 12,
    },
    {
      id: "brick",
      name: "Brick",
      symbol: "╋",
      color: "#B22222",
      angle: 45,
      spacing: 8,
    },
  ];

  // ============ AUTOCAD COMMANDS ============
  const commands = {
    L: { tool: "line", name: "LINE" },
    PL: { tool: "polyline", name: "POLYLINE" },
    C: { tool: "circle", name: "CIRCLE" },
    A: { tool: "arc", name: "ARC" },
    R: { tool: "rectangle", name: "RECTANGLE" },
    H: { tool: "hatch", name: "HATCH" },
    EL: { tool: "ellipse", name: "ELLIPSE" },
    SPL: { tool: "spline", name: "SPLINE" },
    DIM: { tool: "dimension", name: "DIMENSION" },
    T: { tool: "text", name: "TEXT" },
    M: { tool: "move", name: "MOVE" },
    CO: { tool: "copy", name: "COPY" },
    MI: { tool: "mirror", name: "MIRROR" },
    RO: { tool: "rotate", name: "ROTATE" },
    SC: { tool: "scale", name: "SCALE" },
    E: { action: "delete", name: "ERASE" },
    U: { action: "undo", name: "UNDO" },
    Z: { action: "zoom", name: "ZOOM" },
    GRID: { action: "toggleGrid", name: "GRID" },
    ORTHO: { action: "toggleOrtho", name: "ORTHO" },
    SNAP: { action: "toggleSnap", name: "SNAP" },
    EXT: { action: "extrude", name: "EXTRUDE" },
    REV: { action: "revolve", name: "REVOLVE" },
  };

  // ============ API PERSISTENCE ============
  // Load data on mount (Only if initialObjects is empty)
  useEffect(() => {
    const loadData = async () => {
      // If we already have objects from props, don't overwrite from backend on mount
      if (initialObjects && initialObjects.length > 0) return;

      try {
        // Try local storage first
        const localObjects = cadStorageService.getObjects(projectId);
        if (localObjects && localObjects.length > 0) {
          setObjects(localObjects);
          setHistory([localObjects]);
          setHistoryIndex(0);
          setApiConnected(true);
          return;
        }

        // Fallback to backend for persistence
        const response = await fetch(`http://localhost:8001/drawings/projects/default`);
        if (response.ok) {
          const data = await response.json();
          if (data.objects) {
            setObjects(data.objects);
            setHistory([data.objects]);
            setHistoryIndex(0);
          }
        }
        setApiConnected(true);
      } catch (error) {
        console.error("Error loading drawing:", error);
        setApiConnected(false);
      }
    };
    loadData();
  }, [projectId, initialObjects]);

  const saveToBackend = async (newObjects) => {
    // 1. Always sync to local storage for technical logic performance
    cadStorageService.saveObjects(projectId, newObjects);

    // 2. Sync to Python backend for data persistence and history
    try {
      await fetch(`http://localhost:8001/drawings/projects/default/objects/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objects: newObjects }),
      });
    } catch (e) {
      console.error("Failed to save to backend", e);
    }
  };

  // ============ NAVIGATION ENHANCEMENTS ============
  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const speed = 1.1;
    const newScale = e.evt.deltaY > 0 ? oldScale / speed : oldScale * speed;

    setZoomLevel(newScale);
    setPanOffset({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const handleZoom = (delta) => {
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const centerX = stage.width() / 2;
    const centerY = stage.height() / 2;

    const mousePointTo = {
      x: (centerX - stage.x()) / oldScale,
      y: (centerY - stage.y()) / oldScale,
    };

    const newScale = Math.max(0.05, Math.min(20, oldScale + delta));

    setZoomLevel(newScale);
    setPanOffset({
      x: centerX - mousePointTo.x * newScale,
      y: centerY - mousePointTo.y * newScale,
    });
  };

  const [isPanning, setIsPanning] = useState(false);
  const handleStageDragStart = (e) => {
    // Middle button (1) or Space key (check e.evt.code or similar)
    if (e.evt.button === 1 || e.evt.shiftKey) {
      setIsPanning(true);
    }
  };

  const handleStageDragEnd = (e) => {
    setIsPanning(false);
    setPanOffset({
      x: e.target.x(),
      y: e.target.y()
    });
  };

  const handleStageDragMove = (e) => {
    if (isPanning) {
      setPanOffset({
        x: e.target.x(),
        y: e.target.y()
      });
    }
  };

  // ============ RENDER KONVA OBJECTS ============
  const renderKonvaObjects = () => {
    return objects.map((obj) => {
      const layer = layers.find((l) => l.id === obj.layerId);
      // Default to visible if layer not found
      if (layer && !layer.visible) return null;

      const color = obj.color || (layer?.color) || (isDark ? "#FFFFFF" : "#000000");
      const strokeWidth = obj.lineWidth || 2;
      const isSelected = selectedIds.includes(obj.id);

      const handleDragEnd = (e) => {
        const newObjects = objects.map((o) => {
          if (o.id === obj.id) {
            if (o.type === "line" || o.type === "rectangle") {
              const dx = e.target.x();
              const dy = e.target.y();
              // For shapes with start/end, we update them and reset Konva x/y to 0
              return {
                ...o,
                start: { x: o.start.x + dx, y: o.start.y + dy, z: o.start.z },
                end: { x: o.end.x + dx, y: o.end.y + dy, z: o.end.z }
              };
            }
            if (o.type === "circle") {
              return {
                ...o,
                center: { x: o.center.x + e.target.x(), y: o.center.y + e.target.y(), z: o.center.z }
              };
            }
            if (o.type === "text") {
              return {
                ...o,
                position: { x: o.position.x + e.target.x(), y: o.position.y + e.target.y(), z: o.position.z }
              };
            }
            if (o.type === "member") {
              return {
                ...o,
                x: o.x + e.target.x(),
                y: o.y + e.target.y()
              };
            }
          }
          return o;
        });
        // Important: reset internal konva position to 0 because we updated world coordinates
        e.target.position({ x: 0, y: 0 });
        addToHistory(newObjects);
      };

      switch (obj.type) {
        case "line":
          return (
            <KonvaLine
              key={obj.id}
              id={obj.id}
              points={obj.points ? obj.points.flatMap(p => [p.x, p.y]) : [obj.start.x, obj.start.y, obj.end.x, obj.end.y]}
              stroke={color}
              strokeWidth={strokeWidth}
              fill={obj.fill}
              closed={obj.closed}
              dash={obj.dash}
              draggable={!layer.locked}
              onDragEnd={handleDragEnd}
            />
          );
        case "rectangle":
          return (
            <KonvaRect
              key={obj.id}
              id={obj.id}
              x={Math.min(obj.start.x, obj.end.x)}
              y={Math.min(obj.start.y, obj.end.y)}
              width={Math.abs(obj.end.x - obj.start.x)}
              height={Math.abs(obj.end.y - obj.start.y)}
              stroke={color}
              strokeWidth={strokeWidth}
              fill={obj.fill}
              opacity={obj.opacity || 1}
              draggable={!layer.locked}
              onDragEnd={handleDragEnd}
            />
          );
        case "circle":
          return (
            <KonvaCircle
              key={obj.id}
              id={obj.id}
              x={obj.center.x}
              y={obj.center.y}
              radius={obj.radius}
              stroke={color}
              strokeWidth={strokeWidth}
              fill={obj.fill}
              draggable={!layer.locked}
              onDragEnd={handleDragEnd}
            />
          );
        case "text":
          const fontSize = (obj.size || 1) * annotationTextSize;
          return (
            <KonvaText
              key={obj.id}
              id={obj.id}
              x={obj.position.x}
              y={obj.position.y}
              text={obj.text}
              fontSize={fontSize}
              fill={color}
              rotation={obj.rotation || 0}
              align={obj.align || 'left'}
              verticalAlign={obj.verticalAlign || 'top'}
              offsetX={obj.align === 'center' ? 0 : 0} // Standard Konva behavior for simple text
              offsetY={obj.verticalAlign === 'middle' ? fontSize / 2 : 0}
              // If centered, we often want to shift the X as well
              onBeforeRender={(canvas) => {
                if (obj.align === 'center') {
                  // This is a bit complex in Konva without a width, 
                  // but we can approximation with offsetX
                }
              }}
              // Better approach: use width if alignment is needed
              width={obj.align === 'center' ? 500 : undefined}
              offsetX={obj.align === 'center' ? 250 : 0}
              draggable={!layer.locked}
              onDragEnd={handleDragEnd}
              onDblClick={() => {
                const newText = prompt("Edit text:", obj.text);
                if (newText !== null) {
                  const updated = objects.map(o => o.id === obj.id ? { ...o, text: newText } : o);
                  addToHistory(updated);
                }
              }}
            />
          );
        case "member":
          if (obj.memberType === "beam") {
            return (
              <BeamKonvaGroup
                key={obj.id}
                id={obj.id}
                config={obj.config}
                section={obj.section || "midspan"}
                x={obj.x}
                y={obj.y}
                scale={obj.scale || 0.4}
                textSize={annotationTextSize / 2}
                draggable={!layer.locked}
                onDragEnd={handleDragEnd}
              />
            );
          } else if (obj.memberType === "column") {
            const columnProps = obj.config || obj.params || obj;
            return (
              <ColumnKonvaGroup
                key={obj.id}
                id={obj.id}
                width={columnProps.width}
                depth={columnProps.depth}
                numBars={columnProps.numBars}
                barDia={columnProps.barDia}
                cover={columnProps.cover}
                tieDia={columnProps.tieDia}
                x={obj.x}
                y={obj.y}
                scale={obj.scale || 0.8}
                textSize={annotationTextSize / 2}
                draggable={!layer.locked}
                onDragEnd={handleDragEnd}
              />
            );
          } else if (obj.memberType === "foundation") {
            return (
              <FoundationKonvaGroup
                key={obj.id}
                id={obj.id}
                foundationType={obj.config?.foundation_type || obj.foundationType}
                params={obj.config || obj.params}
                x={obj.x}
                y={obj.y}
                scale={obj.scale || 0.15}
                draggable={!layer.locked}
                onDragEnd={handleDragEnd}
              />
            );
          }
          return null;
        default:
          return null;
      }
    });
  };


  // ============ HISTORY MANAGEMENT ============
  const addToHistory = useCallback(
    (newObjects) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newObjects)));
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setObjects(newObjects);
      saveToBackend(newObjects);
    },
    [history, historyIndex]
  );

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setObjects(JSON.parse(JSON.stringify(history[historyIndex - 1])));
      setSelectedIds([]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setObjects(JSON.parse(JSON.stringify(history[historyIndex + 1])));
      setSelectedIds([]);
    }
  }, [history, historyIndex]);

  // ============ COORDINATE CONVERSION (Konva) ============
  const getKonvaCoords = useCallback(
    (e) => {
      const stage = e.target.getStage();
      const pointer = stage.getPointerPosition();

      // Convert pointer to world space
      const x = (pointer.x - stage.x()) / stage.scaleX();
      const y = (pointer.y - stage.y()) / stage.scaleY();

      let finalX = x;
      let finalY = y;

      // Grid snap
      if (snapSettings[SNAP_MODES.GRID]) {
        finalX = Math.round(finalX / gridSpacing) * gridSpacing;
        finalY = Math.round(finalY / gridSpacing) * gridSpacing;
      }

      return { x: finalX, y: finalY, z: 0 };
    },
    [snapSettings, gridSpacing]
  );

  // ============ SNAP POINT DETECTION ============
  const findSnapPoint = useCallback(
    (point) => {
      if (!Object.values(snapSettings).some((v) => v)) return null;

      const threshold = 0.5 / zoomLevel;
      let closest = null;
      let closestDist = threshold;

      objects.forEach((obj) => {
        const layer = layers.find((l) => l.id === obj.layerId);
        if (!layer?.visible) return;

        // Endpoint snap
        if (snapSettings[SNAP_MODES.ENDPOINT]) {
          const endpoints = [];
          if (obj.type === "line") {
            if (obj.points) endpoints.push(...obj.points);
            else endpoints.push(obj.start, obj.end);
          }
          if (obj.type === "polyline" && obj.points)
            endpoints.push(...obj.points);
          if (obj.type === "rectangle") {
            endpoints.push(
              obj.start,
              obj.end,
              { x: obj.start.x, y: obj.end.y, z: 0 },
              { x: obj.end.x, y: obj.start.y, z: 0 }
            );
          }

          endpoints.forEach((ep) => {
            const dist = Math.hypot(point.x - ep.x, point.y - ep.y);
            if (dist < closestDist) {
              closest = { ...ep, snapType: SNAP_MODES.ENDPOINT };
              closestDist = dist;
            }
          });
        }

        // Midpoint snap
        if (snapSettings[SNAP_MODES.MIDPOINT]) {
          if (obj.type === "line" && obj.start && obj.end) {
            const mid = {
              x: (obj.start.x + obj.end.x) / 2,
              y: (obj.start.y + obj.end.y) / 2,
              z: 0,
            };
            const dist = Math.hypot(point.x - mid.x, point.y - mid.y);
            if (dist < closestDist) {
              closest = { ...mid, snapType: SNAP_MODES.MIDPOINT };
              closestDist = dist;
            }
          }
        }

        // Center snap
        if (snapSettings[SNAP_MODES.CENTER]) {
          if (
            obj.type === "circle" ||
            obj.type === "arc" ||
            obj.type === "ellipse"
          ) {
            const center = obj.center;
            const dist = Math.hypot(point.x - center.x, point.y - center.y);
            if (dist < closestDist) {
              closest = { ...center, snapType: SNAP_MODES.CENTER };
              closestDist = dist;
            }
          }
          if (obj.type === "rectangle" && obj.start && obj.end) {
            const center = {
              x: (obj.start.x + obj.end.x) / 2,
              y: (obj.start.y + obj.end.y) / 2,
              z: 0,
            };
            const dist = Math.hypot(point.x - center.x, point.y - center.y);
            if (dist < closestDist) {
              closest = { ...center, snapType: SNAP_MODES.CENTER };
              closestDist = dist;
            }
          }
        }
      });

      return closest;
    },
    [objects, layers, snapSettings, zoomLevel]
  );

  // ============ MOUSE HANDLERS ============
  const handleCanvasMouseDown = (e) => {
    if (mode === "3D") return;
    const point = getKonvaCoords(e);

    // Selection mode
    if (!activeTool) {
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) {
        setSelectedIds([]);
        transformerRef.current?.nodes([]);
      } else {
        const id = e.target.id();
        if (id) {
          const isSelected = selectedIds.includes(id);
          if (e.evt.shiftKey) {
            setSelectedIds(prev => isSelected ? prev.filter(i => i !== id) : [...prev, id]);
          } else {
            setSelectedIds([id]);
          }
          transformerRef.current?.nodes([e.target]);
        }
      }
      return;
    }

    setDrawing(true);
    setStartPoint(point);
    setCurrentPoint(point);

    if (activeTool === "polyline") {
      setPolylinePoints([...polylinePoints, point]);
    } else if (activeTool === "arc") {
      setArcPoints([...arcPoints, point]);
    } else if (activeTool === "spline") {
      setPolylinePoints([...polylinePoints, point]);
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (mode === "3D") return;
    const point = getKonvaCoords(e);

    // Find snap point
    const snap = findSnapPoint(point);
    setSnapPoint(snap);

    setCurrentPoint(snap || point);
  };

  const handleCanvasMouseUp = (e) => {
    if (mode === "3D") return;
    if (!drawing || !activeTool || !startPoint) return;

    const endPoint = snapPoint || currentPoint || getKonvaCoords(e);
    const layer = layers.find((l) => l.id === activeLayerId);
    let newObj = null;

    switch (activeTool) {
      default:
        break;
      case "line":
        newObj = {
          id: Date.now().toString() + Math.random(),
          type: "line",
          start: startPoint,
          end: endPoint,
          color: layer.color,
          layerId: activeLayerId,
          lineWidth: 2,
        };
        break;

      case "circle":
        const radius = Math.hypot(
          endPoint.x - startPoint.x,
          endPoint.y - startPoint.y
        );
        newObj = {
          id: Date.now().toString() + Math.random(),
          type: "circle",
          center: startPoint,
          radius,
          color: layer.color,
          layerId: activeLayerId,
        };
        break;

      case "ellipse":
        const radiusX = Math.abs(endPoint.x - startPoint.x);
        const radiusY = Math.abs(endPoint.y - startPoint.y);
        newObj = {
          id: Date.now().toString() + Math.random(),
          type: "ellipse",
          center: startPoint,
          radiusX,
          radiusY,
          color: layer.color,
          layerId: activeLayerId,
        };
        break;

      case "rectangle":
        newObj = {
          id: Date.now().toString() + Math.random(),
          type: "rectangle",
          start: startPoint,
          end: endPoint,
          color: layer.color,
          layerId: activeLayerId,
        };
        break;

      case "hatch":
        newObj = {
          id: Date.now().toString() + Math.random(),
          type: "hatch",
          start: startPoint,
          end: endPoint,
          pattern: selectedHatch,
          color:
            hatchPatterns.find((p) => p.id === selectedHatch)?.color ||
            layer.color,
          layerId: activeLayerId,
          opacity: 0.5,
        };
        break;

      case "dimension":
        const distance = Math.hypot(
          endPoint.x - startPoint.x,
          endPoint.y - startPoint.y
        );
        newObj = {
          id: Date.now().toString() + Math.random(),
          type: "dimension",
          start: startPoint,
          end: endPoint,
          value: distance.toFixed(2),
          unit: "units",
          color: "#00FF00",
          layerId: activeLayerId,
        };
        break;

      case "text":
        const text = prompt("Enter text:");
        if (text) {
          newObj = {
            id: Date.now().toString() + Math.random(),
            type: "text",
            position: startPoint,
            text,
            size: 1,
            rotation: 0,
            color: layer.color,
            layerId: activeLayerId,
          };
        }
        break;

      case "box":
        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.y - startPoint.y);
        newObj = {
          id: Date.now().toString() + Math.random(),
          type: "box",
          position: {
            x: (startPoint.x + endPoint.x) / 2,
            y: (startPoint.y + endPoint.y) / 2,
            z: 1,
          },
          width,
          height,
          depth: 2,
          color: layer.color,
          layerId: activeLayerId,
        };
        break;
    }

    if (newObj) {
      const updated = [...objects, newObj];
      addToHistory(updated);
    }

    if (
      activeTool !== "polyline" &&
      activeTool !== "arc" &&
      activeTool !== "spline"
    ) {
      setDrawing(false);
      setStartPoint(null);
      setCurrentPoint(null);
      setActiveTool(null);
    }
  };

  const handleCanvasDoubleClick = () => {
    if (activeTool === "polyline" && polylinePoints.length > 1) {
      const layer = layers.find((l) => l.id === activeLayerId);
      const newObj = {
        id: Date.now().toString() + Math.random(),
        type: "polyline",
        points: polylinePoints,
        closed: false,
        color: layer.color,
        layerId: activeLayerId,
      };
      const updated = [...objects, newObj];
      addToHistory(updated);
      setPolylinePoints([]);
      setDrawing(false);
      setActiveTool(null);
    }

    if (activeTool === "spline" && polylinePoints.length > 2) {
      const layer = layers.find((l) => l.id === activeLayerId);
      const newObj = {
        id: Date.now().toString() + Math.random(),
        type: "spline",
        points: polylinePoints,
        closed: false,
        color: layer.color,
        layerId: activeLayerId,
      };
      const updated = [...objects, newObj];
      addToHistory(updated);
      setPolylinePoints([]);
      setDrawing(false);
      setActiveTool(null);
    }
  };

  const createArc = () => {
    if (arcPoints.length !== 3) return;

    const [p1, p2, p3] = arcPoints;
    const center = { x: (p1.x + p3.x) / 2, y: (p1.y + p3.y) / 2, z: 0 };
    const radius = Math.hypot(p1.x - center.x, p1.y - center.y);
    const startAngle = Math.atan2(p1.y - center.y, p1.x - center.x);
    const endAngle = Math.atan2(p3.y - center.y, p3.x - center.x);

    const layer = layers.find((l) => l.id === activeLayerId);
    const newObj = {
      id: Date.now().toString() + Math.random(),
      type: "arc",
      center,
      radius,
      startAngle,
      endAngle,
      color: layer.color,
      layerId: activeLayerId,
    };

    const updated = [...objects, newObj];
    addToHistory(updated);
    setArcPoints([]);
    setDrawing(false);
    setActiveTool(null);
  };


  // ============ 3D OPERATIONS ============
  const handleExtrude = () => {
    const selected = objects.filter((o) => selectedIds.includes(o.id));
    if (selected.length === 0) return alert("Select objects first");

    const depth = parseFloat(prompt("Enter extrusion depth:", "5")) || 5;
    const newObjs = [...objects];

    selected.forEach((obj) => {
      if (["rectangle", "circle", "polyline", "ellipse"].includes(obj.type)) {
        let points = [];

        if (obj.type === "rectangle") {
          points = [
            obj.start,
            { x: obj.end.x, y: obj.start.y, z: 0 },
            obj.end,
            { x: obj.start.x, y: obj.end.y, z: 0 },
          ];
        } else if (obj.type === "polyline") {
          points = obj.points;
        } else if (obj.type === "circle") {
          const segments = 32;
          for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            points.push({
              x: obj.center.x + Math.cos(angle) * obj.radius,
              y: obj.center.y + Math.sin(angle) * obj.radius,
              z: 0,
            });
          }
        } else if (obj.type === "ellipse") {
          const segments = 32;
          for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            points.push({
              x: obj.center.x + Math.cos(angle) * obj.radiusX,
              y: obj.center.y + Math.sin(angle) * obj.radiusY,
              z: 0,
            });
          }
        }

        const extruded = {
          id: Date.now().toString() + Math.random(),
          type: "extrusion",
          points,
          depth,
          color: obj.color,
          layerId: obj.layerId,
        };
        newObjs.push(extruded);
      }
    });

    addToHistory(newObjs);
    setMode("3D");
  };

  const handleRevolve = () => {
    const selected = objects.filter((o) => selectedIds.includes(o.id));
    if (selected.length === 0) return alert("Select a profile first");

    const obj = selected[0];
    let points = [];

    if (obj.type === "polyline") points = obj.points;
    else if (obj.type === "line") points = [obj.start, obj.end];

    if (points.length < 2) return alert("Invalid profile");

    const newObj = {
      id: Date.now().toString() + Math.random(),
      type: "revolve",
      points,
      segments: 32,
      position: { x: 0, y: 0, z: 0 },
      color: obj.color,
      layerId: obj.layerId,
    };

    addToHistory([...objects, newObj]);
    setMode("3D");
  };

  // ============ EDIT OPERATIONS ============
  const handleCopy = useCallback(() => {
    const selected = objects.filter((o) => selectedIds.includes(o.id));
    setCopiedObjects(selected);

    const copies = selected.map((obj) => ({
      ...JSON.parse(JSON.stringify(obj)),
      id: Date.now().toString() + Math.random(),
      x: obj.x !== undefined ? obj.x + 2 : undefined,
      y: obj.y !== undefined ? obj.y + 2 : undefined,
      start: obj.start ? { ...obj.start, x: obj.start.x + 2 } : undefined,
      end: obj.end ? { ...obj.end, x: obj.end.x + 2 } : undefined,
      center: obj.center ? { ...obj.center, x: obj.center.x + 2 } : undefined,
      position: obj.position
        ? { ...obj.position, x: obj.position.x + 2 }
        : undefined,
      points: obj.points
        ? obj.points.map((p) => ({ ...p, x: p.x + 2 }))
        : undefined,
    }));

    addToHistory([...objects, ...copies]);
  }, [objects, selectedIds, addToHistory]);

  const handleDelete = useCallback(() => {
    const filtered = objects.filter((o) => !selectedIds.includes(o.id));
    addToHistory(filtered);
    setSelectedIds([]);
  }, [objects, selectedIds, addToHistory]);

  const handleMove = () => {
    const dx = parseFloat(prompt("Move X distance:", "0")) || 0;
    const dy = parseFloat(prompt("Move Y distance:", "0")) || 0;

    const updated = objects.map((obj) => {
      if (!selectedIds.includes(obj.id)) return obj;

      const moved = { ...obj };
      if (moved.x !== undefined) moved.x += dx;
      if (moved.y !== undefined) moved.y += dy;
      if (moved.start)
        moved.start = {
          ...moved.start,
          x: moved.start.x + dx,
          y: moved.start.y + dy,
        };
      if (moved.end)
        moved.end = { ...moved.end, x: moved.end.x + dx, y: moved.end.y + dy };
      if (moved.center)
        moved.center = {
          ...moved.center,
          x: moved.center.x + dx,
          y: moved.center.y + dy,
        };
      if (moved.position)
        moved.position = {
          ...moved.position,
          x: moved.position.x + dx,
          y: moved.position.y + dy,
        };
      if (moved.points)
        moved.points = moved.points.map((p) => ({
          ...p,
          x: p.x + dx,
          y: p.y + dy,
        }));

      return moved;
    });

    addToHistory(updated);
  };

  const handleRotate = () => {
    const angle = parseFloat(prompt("Rotation angle (degrees):", "90")) || 90;
    const rad = (angle * Math.PI) / 180;
    const cx = 0,
      cy = 0; // Rotation center

    const updated = objects.map((obj) => {
      if (!selectedIds.includes(obj.id)) return obj;

      const rotatePoint = (p) => {
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const x = p.x - cx;
        const y = p.y - cy;
        return {
          x: x * cos - y * sin + cx,
          y: x * sin + y * cos + cy,
          z: p.z || 0,
        };
      };

      const rotated = { ...obj };
      if (rotated.x !== undefined && rotated.y !== undefined) {
        const p = rotatePoint({ x: rotated.x, y: rotated.y });
        rotated.x = p.x;
        rotated.y = p.y;
      }
      if (rotated.start) rotated.start = rotatePoint(rotated.start);
      if (rotated.end) rotated.end = rotatePoint(rotated.end);
      if (rotated.center) rotated.center = rotatePoint(rotated.center);
      if (rotated.position) rotated.position = rotatePoint(rotated.position);
      if (rotated.points) rotated.points = rotated.points.map(rotatePoint);

      return rotated;
    });

    addToHistory(updated);
  };

  const handleScale = () => {
    const scale = parseFloat(prompt("Scale factor:", "2")) || 2;
    const cx = 0,
      cy = 0; // Scale center

    const updated = objects.map((obj) => {
      if (!selectedIds.includes(obj.id)) return obj;

      const scalePoint = (p) => ({
        x: cx + (p.x - cx) * scale,
        y: cy + (p.y - cy) * scale,
        z: p.z || 0,
      });

      const scaled = { ...obj };
      if (scaled.start) scaled.start = scalePoint(scaled.start);
      if (scaled.end) scaled.end = scalePoint(scaled.end);
      if (scaled.center) scaled.center = scalePoint(scaled.center);
      if (scaled.position) scaled.position = scalePoint(scaled.position);
      if (scaled.points) scaled.points = scaled.points.map(scalePoint);
      if (scaled.radius) scaled.radius *= scale;
      if (scaled.radiusX) scaled.radiusX *= scale;
      if (scaled.radiusY) scaled.radiusY *= scale;
      if (scaled.width) scaled.width *= scale;
      if (scaled.height) scaled.height *= scale;
      if (scaled.depth) scaled.depth *= scale;

      return scaled;
    });

    addToHistory(updated);
  };

  const handleMirror = () => {
    const axis = prompt("Mirror axis (X or Y):", "X")?.toUpperCase();
    const axisValue = parseFloat(prompt(`${axis} axis position:`, "0")) || 0;

    const updated = objects.map((obj) => {
      if (!selectedIds.includes(obj.id)) return obj;

      const mirrorPoint = (p) => {
        if (axis === "X") {
          return { ...p, y: 2 * axisValue - p.y };
        } else {
          return { ...p, x: 2 * axisValue - p.x };
        }
      };

      const mirrored = { ...obj };
      if (mirrored.start) mirrored.start = mirrorPoint(mirrored.start);
      if (mirrored.end) mirrored.end = mirrorPoint(mirrored.end);
      if (mirrored.center) mirrored.center = mirrorPoint(mirrored.center);
      if (mirrored.position) mirrored.position = mirrorPoint(mirrored.position);
      if (mirrored.points) mirrored.points = mirrored.points.map(mirrorPoint);

      return mirrored;
    });

    addToHistory(updated);
  };

  const handleExplode = () => {
    const selected = objects.filter(o => selectedIds.includes(o.id) && o.memberType);
    if (selected.length === 0) return alert("Select a structural member to explode");

    let newObjects = [...objects.filter(o => !selectedIds.includes(o.id))];

    selected.forEach(member => {
      let parts = [];
      if (member.memberType === "beam") {
        parts = getBeamCADPrimitives(member.config, member.x, member.y, member.scale);
      } else if (member.memberType === "column") {
        parts = getColumnCADPrimitives(member.config, member.x, member.y, member.scale);
      } else if (member.memberType === "foundation") {
        parts = getFoundationCADPrimitives(member.foundationType || member.config?.foundation_type, member.config || member.params, member.x, member.y, member.scale);
      }
      newObjects.push(...parts);
    });

    addToHistory(newObjects);
    setSelectedIds([]);
  };

  // ============ GLOBAL EVENT LISTENER ============
  useEffect(() => {
    const handleAddMember = (e) => {
      const { memberType, config, x, y } = e.detail;

      // Calculate viewport center
      const stage = stageRef.current;
      let centerX = 0;
      let centerY = 0;
      if (stage) {
        centerX = (stage.width() / 2 - stage.x()) / stage.scaleX();
        centerY = (stage.height() / 2 - stage.y()) / stage.scaleY();
      }

      const newObj = {
        id: "MEMBER_" + Date.now(),
        type: "member",
        memberType,
        config,
        x: x !== undefined ? x : centerX,
        y: y !== undefined ? y : centerY,
        scale: 0.5,
        layerId: activeLayerId
      };
      addToHistory([...objects, newObj]);
    };

    window.addEventListener("CAD_ADD_MEMBER", handleAddMember);

    // Also check for pending member from navigation
    if (window.CAD_PENDING_MEMBER) {
      const { memberType, config, x, y } = window.CAD_PENDING_MEMBER;

      const stage = stageRef.current;
      let centerX = 0;
      let centerY = 0;
      if (stage) {
        centerX = (stage.width() / 2 - stage.x()) / stage.scaleX();
        centerY = (stage.height() / 2 - stage.y()) / stage.scaleY();
      }

      const newObj = {
        id: "MEMBER_" + Date.now(),
        type: "member",
        memberType,
        config,
        x: x !== undefined ? x : centerX,
        y: y !== undefined ? y : centerY,
        scale: 0.5,
        layerId: activeLayerId
      };
      addToHistory([...objects, newObj]);
      window.CAD_PENDING_MEMBER = null; // Clear it
    }

    return () => window.removeEventListener("CAD_ADD_MEMBER", handleAddMember);
  }, [objects, activeLayerId]);

  // ============ LAYER MANAGEMENT ============
  const addLayer = () => {
    const name = prompt("Layer name:", `Layer ${layers.length}`);
    if (!name) return;

    const newLayer = {
      id: Date.now().toString(),
      name,
      color:
        "#" +
        Math.floor(Math.random() * 16777215)
          .toString(16)
          .padStart(6, "0"),
      visible: true,
      locked: false,
      opacity: 1.0,
    };
    setLayers([...layers, newLayer]);
    setActiveLayerId(newLayer.id);
  };
  const [pendingDeleteLayerId, setPendingDeleteLayerId] = useState(null);

  const deleteLayer = (layerId) => {
    setLayers(layers.filter((l) => l.id !== layerId));
    const filtered = objects.filter((o) => o.layerId !== layerId);
    addToHistory(filtered);
    if (activeLayerId === layerId) setActiveLayerId(layers[0].id);
  };

  const toggleLayerVisibility = (layerId) => {
    setLayers(
      layers.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l))
    );
  };

  const toggleLayerLock = (layerId) => {
    setLayers(
      layers.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l))
    );
  };

  // ============ COMMAND LINE ============
  const handleCommand = (e) => {
    if (e.key === "Enter" && commandInput.trim()) {
      const cmd = commandInput.trim().toUpperCase();
      setCommandHistory([...commandHistory, cmd]);
      setCommandHistoryIndex(-1);

      const command = commands[cmd];
      if (command) {
        if (command.tool) {
          setActiveTool(command.tool);
          if (command.tool === "polyline" || command.tool === "spline") {
            setPolylinePoints([]);
          }
          if (command.tool === "arc") {
            setArcPoints([]);
          }
        } else if (command.action) {
          switch (command.action) {
            case "undo":
              undo();
              break;
            case "delete":
              handleDelete();
              break;
            case "toggleGrid":
              setGridVisible(!gridVisible);
              break;
            case "toggleOrtho":
              setOrthoMode(!orthoMode);
              break;
            case "extrude":
              handleExtrude();
              break;
            case "revolve":
              handleRevolve();
              break;
            default:
              console.warn(`Unhandled command action: ${command.action}`);
              break;
          }
        }
      }

      setCommandInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistoryIndex < commandHistory.length - 1) {
        const newIndex = commandHistoryIndex + 1;
        setCommandHistoryIndex(newIndex);
        setCommandInput(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (commandHistoryIndex > 0) {
        const newIndex = commandHistoryIndex - 1;
        setCommandHistoryIndex(newIndex);
        setCommandInput(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (commandHistoryIndex === 0) {
        setCommandHistoryIndex(-1);
        setCommandInput("");
      }
    } else if (e.key === "Escape") {
      setActiveTool(null);
      setPolylinePoints([]);
      setArcPoints([]);
      setDrawing(false);
    }
  };

  // ============ AI ASSISTANT ============
  const handleAISend = async () => {
    if (!aiPrompt.trim()) return;

    setAiMessages([...aiMessages, { type: "user", text: aiPrompt }]);
    setAiProcessing(true);

    try {
      const response = await fetch(`http://localhost:8000/api/ai/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          project_id: projectId,
        }),
      });

      const data = await response.json();
      setAiMessages((prev) => [
        ...prev,
        {
          type: "assistant",
          text: data.message || "AI generation initiated",
        },
      ]);

      if (data.objects && data.objects.length > 0) {
        addToHistory([...objects, ...data.objects]);
      }
    } catch (error) {
      setAiMessages((prev) => [
        ...prev,
        {
          type: "assistant",
          text: "[Placeholder] AI integration ready. Connect to your LLM service.",
        },
      ]);
    } finally {
      setAiProcessing(false);
      setAiPrompt("");
    }
  };

  // ============ KEYBOARD SHORTCUTS ============
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") {
          e.preventDefault();
          undo();
        } else if (e.key === "y") {
          e.preventDefault();
          redo();
        } else if (e.key === "c") {
          e.preventDefault();
          if (selectedIds.length > 0) handleCopy();
        } else if (e.key === "s") {
          e.preventDefault();
          alert("Save functionality - connect to backend");
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleDelete();
        }
      } else if (e.key === "Escape") {
        setActiveTool(null);
        setPolylinePoints([]);
        setArcPoints([]);
        setDrawing(false);
        setSelectedIds([]);
      } else if (e.key === "g" || e.key === "G") {
        setGridVisible(!gridVisible);
      } else if (e.key === "o" || e.key === "O") {
        setOrthoMode(!orthoMode);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    undo,
    redo,
    handleCopy,
    handleDelete,
    selectedIds,
    gridVisible,
    orthoMode,
    activeTool,
  ]);

  const [annotationTextSize, setAnnotationTextSize] = useState(12);

  // Initialize history
  useEffect(() => {
    if (history.length === 0) {
      setHistory([[]]);
    }
  }, []);

  const ToolButton = ({ tool, icon: Icon, label, onClick, isActive }) => (
    <button
      onClick={onClick || (() => setActiveTool(tool))}
      className={`p-2 rounded flex flex-col items-center gap-1 min-w-[50px] transition-all ${isActive || activeTool === tool
        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
        : isDark
          ? "hover:bg-gray-700 text-gray-400 hover:text-gray-200"
          : "hover:bg-gray-200 text-gray-600 hover:text-gray-900"
        }`}
      title={label}
    >
      <Icon size={18} />
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );

  return (
    <div className={`flex flex-col h-full ${isDark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}>

      {/* Sub Toolbar Row - Re-implemented for visibility */}
      <div className={`flex items-center gap-2 p-1.5 border-b overflow-x-auto no-scrollbar scroll-smooth ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200 shadows-sm"}`}>
        {/* Tab Selection */}
        <div className="flex bg-black/5 dark:bg-white/10 rounded-lg p-1 mr-2 shrink-0">
          {[
            { id: 'draw', label: 'Draw' },
            { id: 'modify', label: 'Modify' },
            { id: '3d', label: '3D' },
            { id: 'view', label: 'View' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveToolbarTab(tab.id)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${activeToolbarTab === tab.id
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="h-8 w-px bg-gray-300 dark:bg-gray-700 mx-1 shrink-0" />

        {/* Dynamic Tools based on Tab */}
        <div className="flex items-center gap-1.5 shrink-0 px-1">
          {activeToolbarTab === 'draw' && (
            <>
              <ToolButton tool={null} icon={MousePointer2} label="Select" />
              <ToolButton tool="line" icon={Minus} label="Line" />
              <ToolButton tool="polyline" icon={Zap} label="Poly" />
              <ToolButton tool="circle" icon={Circle} label="Circle" />
              <ToolButton tool="rectangle" icon={Square} label="Rect" />
              <ToolButton tool="arc" icon={RefreshCw} label="Arc" />
              <ToolButton tool="hatch" icon={Hash} label="Hatch" onClick={() => setShowHatchMenu(!showHatchMenu)} isActive={showHatchMenu} />
              <ToolButton tool="text" icon={Type} label="Text" onClick={() => { setActiveTool("text"); setCopilotOpen(true); setCopilotTab("properties"); }} />
              <ToolButton tool="dimension" icon={Ruler} label="Dim" onClick={() => { setActiveTool("dimension"); setCopilotOpen(true); setCopilotTab("properties"); }} />
            </>
          )}

          {activeToolbarTab === 'modify' && (
            <>
              <ToolButton tool="move" icon={Move} label="Move" onClick={handleMove} />
              <ToolButton tool="copy" icon={Copy} label="Copy" onClick={handleCopy} isActive={copiedObjects.length > 0} />
              <ToolButton tool="rotate" icon={RotateCw} label="Rotate" onClick={handleRotate} />
              <ToolButton tool="scale" icon={Scale} label="Scale" onClick={handleScale} />
              <ToolButton tool="mirror" icon={Share2} label="Mirror" onClick={handleMirror} />
              <ToolButton tool="delete" icon={Trash2} label="Erase" onClick={handleDelete} />
              <ToolButton tool="explode" icon={Box} label="Explode" onClick={handleExplode} />
            </>
          )}

          {activeToolbarTab === '3d' && (
            <>
              <ToolButton tool="extrude" icon={Box} label="Extrude" onClick={handleExtrude} />
              <ToolButton tool="revolve" icon={RotateCw} label="Revolve" onClick={handleRevolve} />
              <button
                onClick={() => setMode(mode === "2D" ? "3D" : "2D")}
                className={`p-2 rounded flex flex-col items-center gap-1 min-w-[50px] transition-all ${mode === "3D" ? "bg-blue-600 text-white" : "hover:bg-gray-200 dark:hover:bg-gray-700"}`}
              >
                <Maximize size={18} />
                <span className="text-[10px] font-medium leading-none">{mode === "3D" ? "2D" : "3D"} View</span>
              </button>
            </>
          )}

          {activeToolbarTab === 'view' && (
            <>
              <ToolButton tool="grid" icon={Grid3X3} label="Grid" onClick={() => setGridVisible(!gridVisible)} isActive={gridVisible} />
              <ToolButton tool="layers" icon={Layers} label="Layers" onClick={() => setLeftPanelVisible(!leftPanelVisible)} isActive={leftPanelVisible} />
              <ToolButton tool="copilot" icon={Sparkles} label="Copilot" onClick={() => setCopilotOpen(!copilotOpen)} isActive={copilotOpen} />
              <ToolButton tool="ortho" icon={Minus} label="Ortho" onClick={() => setOrthoMode(!orthoMode)} isActive={orthoMode} />
            </>
          )}
        </div>
      </div>

      {/* Floating Controls */}
      {!isFullScreen && (
        <div className="absolute top-4 right-4 z-50 flex gap-2">
          <button
            onClick={onFullScreenToggle}
            className={`p-2 rounded-full shadow-lg ${isDark ? "bg-gray-800 hover:bg-gray-700 text-gray-200" : "bg-white hover:bg-gray-100 text-gray-800"}`}
            title={isFullScreen ? "Exit Full Screen" : "Enter Full Screen"}
          >
            {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      )}

      {/* Hatch Menu */}
      {showHatchMenu && (
        <div className="absolute top-14 left-1/2 transform -translate-x-1/2 bg-gray-800 border border-gray-700 rounded shadow-lg p-3 z-50">
          <div className="text-sm font-bold mb-2">Hatch Patterns</div>
          <div className="grid grid-cols-4 gap-2">
            {hatchPatterns.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedHatch(p.id);
                  setActiveTool("hatch");
                  setShowHatchMenu(false);
                }}
                className={`p-2 rounded border-2 ${selectedHatch === p.id
                  ? "border-blue-500 bg-gray-700"
                  : "border-gray-600 hover:border-gray-500"
                  }`}
              >
                <div className="text-2xl">{p.symbol}</div>
                <div className="text-xs mt-1">{p.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Panel - Layers */}
        {leftPanelVisible && (
          <div className={`w-64 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} border-r flex flex-col overflow-hidden z-20`}>
            <div className={`p-3 border-b ${isDark ? "border-gray-700" : "border-gray-200"} flex items-center justify-between`}>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Layers size={16} /> Layers
              </h3>
              <button
                onClick={addLayer}
                className={`p-1 ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"} rounded`}
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {layers.map((layer) => (
                <div
                  key={layer.id}
                  onClick={() => !layer.locked && setActiveLayerId(layer.id)}
                  className={`p-3 border-b ${isDark ? "border-gray-700" : "border-gray-200"} cursor-pointer ${activeLayerId === layer.id
                    ? (isDark ? "bg-blue-900" : "bg-blue-50")
                    : (isDark ? "hover:bg-gray-700" : "hover:bg-gray-50")
                    } ${layer.locked ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: layer.color }}
                    />
                    <span className={`flex-1 text-sm truncate ${isDark ? "text-gray-100" : "text-gray-900"}`}>{layer.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLayerVisibility(layer.id);
                      }}
                      className="p-1"
                    >
                      {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLayerLock(layer.id);
                      }}
                      className="p-1"
                    >
                      {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>
                    {layers.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeleteLayerId(layer.id);
                        }}
                        className="p-1 hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {objects.filter((o) => o.layerId === layer.id).length} objects
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/*        .....................Deletelayer Confirmation              */}
        {pendingDeleteLayerId && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
            <div className={`${isDark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"} p-4 rounded shadow-md`}>
              <p>Delete layer and all its objects?</p>

              <div className="flex gap-2 mt-3">
                <button
                  className="bg-red-500 text-white px-3 py-1 rounded"
                  onClick={() => {
                    deleteLayer(pendingDeleteLayerId);
                    setPendingDeleteLayerId(null);
                  }}
                >
                  Delete
                </button>

                <button
                  className={`px-3 py-1 rounded border ${isDark ? "border-gray-600 hover:bg-gray-700" : "border-gray-300 hover:bg-gray-100"}`}
                  onClick={() => setPendingDeleteLayerId(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 flex flex-col relative z-0">
          {mode === "2D" ? (
            <Stage
              ref={stageRef}
              width={window.innerWidth - (copilotOpen ? 320 : 0) - (leftPanelVisible ? 256 : 0)}
              height={window.innerHeight - 48 - 40 - 32} // 48 (header) + 40 (sub) + 32 (bottom bar)
              scaleX={zoomLevel}
              scaleY={zoomLevel}
              x={panOffset.x}
              y={panOffset.y}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onDblClick={handleCanvasDoubleClick}
              onWheel={handleWheel}
              draggable={isPanning}
              onDragStart={handleStageDragStart}
              onDragMove={handleStageDragMove}
              onDragEnd={handleStageDragEnd}
            >
              <Layer>
                {/* Grid */}
                {gridVisible && (
                  <KonvaGroup>
                    {[...Array(200)].map((_, i) => (
                      <React.Fragment key={i}>
                        {/* Vertical lines */}
                        <KonvaLine
                          points={[
                            (i - 100) * gridSpacing * 10,
                            -5000 / zoomLevel,
                            (i - 100) * gridSpacing * 10,
                            5000 / zoomLevel
                          ]}
                          stroke={isDark ? "#333333" : "#e0e0e0"}
                          strokeWidth={0.5 / zoomLevel}
                        />
                        {/* Horizontal lines */}
                        <KonvaLine
                          points={[
                            -5000 / zoomLevel,
                            (i - 100) * gridSpacing * 10,
                            5000 / zoomLevel,
                            (i - 100) * gridSpacing * 10
                          ]}
                          stroke={isDark ? "#333333" : "#e0e0e0"}
                          strokeWidth={0.5 / zoomLevel}
                        />
                      </React.Fragment>
                    ))}
                  </KonvaGroup>
                )}
                {renderKonvaObjects()}
                {/* Transformer for Selection */}
                <Transformer
                  ref={transformerRef}
                  onTransformEnd={(e) => {
                    const nodes = transformerRef.current.nodes();
                    const newObjects = objects.map(obj => {
                      const node = nodes.find(n => n.id() === obj.id);
                      if (node) {
                        if (obj.type === "member") {
                          return {
                            ...obj,
                            x: node.x(),
                            y: node.y(),
                            scale: obj.scale * node.scaleX(),
                            rotation: node.rotation()
                          };
                        }
                        // For other shapes, we could bake the transformation here
                        // but for now let's just save the node's properties if the object supports them
                        return {
                          ...obj,
                          scaleX: node.scaleX(),
                          scaleY: node.scaleY(),
                          rotation: node.rotation(),
                          x: node.x(),
                          y: node.y()
                        };
                      }
                      return obj;
                    });
                    // Reset node transformations to 1/0 to avoid double scaling in next render
                    nodes.forEach(node => {
                      const obj = objects.find(o => o.id === node.id());
                      if (obj && obj.type === "member") {
                        node.scaleX(1);
                        node.scaleY(1);
                      }
                    });
                    addToHistory(newObjects);
                  }}
                  boundBoxFunc={(oldBox, newBox) => {
                    if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
                      return oldBox;
                    }
                    return newBox;
                  }}
                />
              </Layer>
            </Stage>
          ) : (
            <div className="w-full h-full">
              <StructuralVisualizationComponent
                theme="dark"
                componentData={{ objects }}
                visible={true}
              />
            </div>
          )}

          {/* Command Line */}
          {showCommandLine && (
            <div className="bg-gray-800 border-t border-gray-700 p-2">
              <div className="flex items-center gap-2">
                <Command size={16} className="text-gray-400" />
                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  onKeyDown={handleCommand}
                  placeholder="Command: L (Line), C (Circle), R (Rectangle), PL (Polyline)..."
                  className="flex-1 bg-gray-900 text-gray-100 px-3 py-2 rounded text-sm border border-gray-700 focus:outline-none focus:border-blue-500 font-mono"
                />
                <button
                  onClick={() => setShowCommandLine(false)}
                  className="p-2 hover:bg-gray-700 rounded"
                >
                  <Minus size={16} />
                </button>
              </div>
              {commandInput.length > 0 && (
                <div className="mt-2 text-xs text-gray-400">
                  {Object.entries(commands)
                    .filter(([key]) =>
                      key.startsWith(commandInput.toUpperCase())
                    )
                    .slice(0, 5)
                    .map(([key, cmd]) => (
                      <div key={key} className="inline-block mr-3">
                        <span className="font-bold text-blue-400">{key}</span> -{" "}
                        {cmd.name}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
          {!showCommandLine && (
            <button
              onClick={() => setShowCommandLine(true)}
              className="absolute bottom-4 right-4 p-2 bg-gray-800 rounded border border-gray-700 hover:bg-gray-700"
            >
              <Command size={16} />
            </button>
          )}
        </div>

        {/* Right Panel - Copilot */}
        {copilotOpen && (
          <div className={`w-80 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} border-l flex flex-col overflow-hidden z-20`}>
            <div className={`p-3 border-b ${isDark ? "border-gray-700" : "border-gray-200"} flex items-center justify-between`}>
              <h3 className={`font-bold text-sm ${isDark ? "text-gray-100" : "text-gray-900"}`}>Copilot</h3>
              <button
                onClick={() => setCopilotOpen(false)}
                className={`p-1 ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"} rounded`}
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className={`flex border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}>
              {[
                { id: "ai", icon: Sparkles, label: "AI" },
                { id: "properties", icon: Settings, label: "Properties" },
                { id: "history", icon: Clock, label: "History" },
                { id: "commands", icon: BookOpen, label: "Commands" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCopilotTab(tab.id)}
                  className={`flex-1 p-2 text-xs flex items-center justify-center gap-1 ${copilotTab === tab.id
                    ? "text-blue-500 border-b-2 border-blue-500"
                    : (isDark ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700")
                    }`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {/* AI Tab */}
              {copilotTab === "ai" && (
                <div className="flex flex-col h-full">
                  <div className={`flex-1 ${isDark ? "bg-gray-900" : "bg-gray-50"} rounded p-3 mb-3 overflow-y-auto space-y-2`}>
                    {aiMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`text-sm p-2 rounded ${msg.type === "user"
                          ? "bg-blue-600 text-white ml-4"
                          : (isDark ? "bg-gray-700 text-gray-200 mr-4" : "bg-white border border-gray-200 text-gray-800 mr-4")
                          }`}
                      >
                        {msg.text}
                      </div>
                    ))}
                    {aiProcessing && (
                      <div className="text-xs text-gray-500 text-center">
                        AI thinking...
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAISend()}
                      placeholder="Describe what to draw..."
                      className={`flex-1 ${isDark ? "bg-gray-900 text-gray-100 border-gray-700" : "bg-white text-gray-900 border-gray-300"} px-3 py-2 rounded text-sm border focus:outline-none focus:border-blue-500`}
                      disabled={aiProcessing}
                    />
                    <button
                      onClick={handleAISend}
                      disabled={aiProcessing}
                      className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Properties Tab */}
              {copilotTab === "properties" && (
                <div className="space-y-3">
                  {selectedIds.length === 0 ? (
                    <div className="text-gray-500 text-sm">
                      Select objects to view properties
                    </div>
                  ) : (
                    <div>
                      <div className={`text-sm font-bold mb-2 ${isDark ? "text-gray-100" : "text-gray-800"}`}>
                        Selected: {selectedIds.length} object(s)
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={handleCopy} className={`px-2 py-1.5 rounded text-xs font-medium border ${isDark ? "bg-gray-700 border-gray-600 hover:bg-gray-600" : "bg-white border-gray-300 hover:bg-gray-50"}`}>Copy</button>
                        <button onClick={handleMove} className={`px-2 py-1.5 rounded text-xs font-medium border ${isDark ? "bg-gray-700 border-gray-600 hover:bg-gray-600" : "bg-white border-gray-300 hover:bg-gray-50"}`}>Move</button>
                        <button onClick={handleRotate} className={`px-2 py-1.5 rounded text-xs font-medium border ${isDark ? "bg-gray-700 border-gray-600 hover:bg-gray-600" : "bg-white border-gray-300 hover:bg-gray-50"}`}>Rotate</button>
                        <button onClick={handleScale} className={`px-2 py-1.5 rounded text-xs font-medium border ${isDark ? "bg-gray-700 border-gray-600 hover:bg-gray-600" : "bg-white border-gray-300 hover:bg-gray-50"}`}>Scale</button>
                        <button onClick={handleMirror} className={`px-2 py-1.5 rounded text-xs font-medium border ${isDark ? "bg-gray-700 border-gray-600 hover:bg-gray-600" : "bg-white border-gray-300 hover:bg-gray-50"}`}>Mirror</button>
                        <button onClick={handleExtrude} className="px-2 py-1.5 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700">Extrude 3D</button>
                        <button onClick={handleDelete} className="px-2 py-1.5 rounded text-xs font-medium bg-red-600 text-white hover:bg-red-700">Delete</button>
                      </div>
                    </div>
                  )}

                  {/* Always visible Annotation Settings */}
                  <div className={`mt-4 pt-4 border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}>
                    <div className={`text-xs font-bold mb-2 ${isDark ? "text-gray-300" : "text-gray-600"}`}>General Annotation Settings</div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] uppercase font-bold text-gray-500">Global Text Size</label>
                      <input
                        type="number"
                        value={annotationTextSize}
                        onChange={(e) => setAnnotationTextSize(parseInt(e.target.value) || 12)}
                        className={`w-16 px-2 py-1 text-xs rounded border ${isDark ? "bg-gray-900 border-gray-700" : "bg-white border-gray-300 shadow-sm"}`}
                        title="Scales all labelling, dimensions and grid text"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* History Tab */}
              {copilotTab === "history" && (
                <div className="space-y-2">
                  <div className={`text-sm font-bold mb-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}>
                    Edit History ({historyIndex + 1}/{history.length})
                  </div>
                  <div className="space-y-1">
                    {history.map((state, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setHistoryIndex(idx);
                          setObjects(JSON.parse(JSON.stringify(state)));
                        }}
                        className={`p-2 rounded text-xs cursor-pointer ${idx === historyIndex
                          ? "bg-blue-600 text-white"
                          : (isDark ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200")
                          }`}
                      >
                        Step {idx + 1}: {state.length} objects
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Commands Tab */}
              {copilotTab === "commands" && (
                <div className="space-y-2">
                  <div className={`text-sm font-bold mb-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}>
                    Command Reference
                  </div>
                  <div className="space-y-1 text-xs">
                    {Object.entries(commands).map(([key, cmd]) => (
                      <div
                        key={key}
                        className={`${isDark ? "bg-gray-700" : "bg-gray-100"} p-2 rounded flex justify-between`}
                      >
                        <span className="font-bold text-blue-500">{key}</span>
                        <span className={isDark ? "text-gray-400" : "text-gray-600"}>{cmd.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!copilotOpen && (
          <button
            onClick={() => setCopilotOpen(true)}
            className={`absolute right-4 top-20 p-2 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} rounded-l border border-r-0 hover:bg-blue-500 hover:text-white transition-all z-20`}
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className={`${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} border-t px-4 py-2 flex items-center text-xs pb-16`}>
        {/* Snap Modes */}
        <div className="flex gap-1">
          {Object.entries(SNAP_MODES).map(([key, value]) => (
            <button
              key={value}
              onClick={() =>
                setSnapSettings((prev) => ({ ...prev, [value]: !prev[value] }))
              }
              className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${snapSettings[value]
                ? "bg-green-600 text-white"
                : (isDark ? "bg-gray-700 text-gray-400 hover:bg-gray-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200")
                }`}
              title={key}
            >
              {key.slice(0, 3)}
            </button>
          ))}
        </div>

        <div className={`w-px h-6 mx-3 ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleZoom(-0.2)}
            className={`p-1 rounded ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
          >
            <ZoomOut size={14} />
          </button>
          <span className="min-w-[40px] text-center">{Math.round(zoomLevel * 100)}%</span>
          <button
            onClick={() => handleZoom(0.2)}
            className={`p-1 rounded ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => {
              setZoomLevel(1);
              setPanOffset({ x: 0, y: 0 });
            }}
            className={`p-1 rounded ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
            title="Recenter"
          >
            <Home size={14} />
          </button>
        </div>

        <div className="ml-auto flex gap-4 text-gray-500 italic">
          <div>Objects: <span className="font-bold text-blue-500">{objects.length}</span></div>
          <div>Selection: <span className="font-bold text-blue-500">{selectedIds.length}</span></div>
          <div className={apiConnected ? "text-green-500" : "text-red-500"}>● Backend: {apiConnected ? "Live" : "Down"}</div>
        </div>
      </div>
    </div >

  );
}
