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
  Menu,
  File,
} from "lucide-react";

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

export default function CadDrawer() {
  // ============ STATE MANAGEMENT ============
  const [projectId] = useState(Date.now().toString());
  const [projectName, setProjectName] = useState("Untitled Project");
  const [mode, setMode] = useState("2D");
  const [activeTool, setActiveTool] = useState(null);
  const [objects, setObjects] = useState([]);
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
  ]);
  const [activeLayerId, setActiveLayerId] = useState("1");
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // History Management
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

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

  // Drawing State
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
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

  // WebSocket
  const wsRef = useRef(null);
  const [wsConnected, setWsConnected] = useState(false);

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

  // ============ WEBSOCKET CONNECTION ============
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket(`ws://localhost:8000/ws/drawing/${projectId}`);

      ws.onopen = () => {
        console.log("WebSocket connected");
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };

      ws.onerror = () => {
        console.log("WebSocket error");
        setWsConnected(false);
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
        setWsConnected(false);
        setTimeout(connectWebSocket, 5000);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [projectId]);

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case "object_added":
        setObjects((prev) => [...prev, data.object]);
        break;
      case "object_updated":
        setObjects((prev) =>
          prev.map((o) => (o.id === data.object.id ? data.object : o))
        );
        break;
      case "object_deleted":
        setObjects((prev) => prev.filter((o) => o.id !== data.object_id));
        break;
      case "ai_drawing_update":
        if (data.objects) {
          setObjects((prev) => [...prev, ...data.objects]);
        }
        break;
    }
  };

  const broadcastChange = (type, data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type, ...data, project_id: projectId })
      );
    }
  };

  // ============ THREE.JS INITIALIZATION ============
  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    const aspect =
      canvasRef.current.clientWidth / canvasRef.current.clientHeight;
    const camera =
      mode === "2D"
        ? new THREE.OrthographicCamera(
            -10 * aspect,
            10 * aspect,
            10,
            -10,
            0.1,
            1000
          )
        : new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);

    camera.position.set(
      panOffset.x,
      panOffset.y,
      mode === "2D" ? 20 / zoomLevel : 30
    );
    if (mode === "3D") camera.position.set(15, 15, 15);
    camera.lookAt(0, 0, 0);
    camera.zoom = zoomLevel;
    camera.updateProjectionMatrix();
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(
      canvasRef.current.clientWidth,
      canvasRef.current.clientHeight
    );
    renderer.setPixelRatio(window.devicePixelRatio);
    canvasRef.current.innerHTML = "";
    canvasRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Grid
    if (gridVisible) {
      const size = 100;
      const divisions = size / gridSpacing;
      const gridHelper = new THREE.GridHelper(
        size,
        divisions,
        0x444444,
        0x222222
      );
      gridHelper.rotation.x = mode === "2D" ? Math.PI / 2 : 0;
      gridHelper.position.z = mode === "2D" ? -0.01 : 0;
      scene.add(gridHelper);
    }

    // Lights for 3D
    if (mode === "3D") {
      const light1 = new THREE.DirectionalLight(0xffffff, 0.8);
      light1.position.set(10, 10, 10);
      scene.add(light1);

      const light2 = new THREE.DirectionalLight(0xffffff, 0.4);
      light2.position.set(-10, -10, -10);
      scene.add(light2);

      scene.add(new THREE.AmbientLight(0x404040, 0.5));
    }

    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      const aspect = width / height;

      if (mode === "2D") {
        camera.left = -10 * aspect;
        camera.right = 10 * aspect;
        camera.top = 10;
        camera.bottom = -10;
      } else {
        camera.aspect = aspect;
      }
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (canvasRef.current && renderer.domElement) {
        try {
          canvasRef.current.removeChild(renderer.domElement);
        } catch (e) {}
      }
      renderer.dispose();
    };
  }, [mode, gridVisible, gridSpacing, zoomLevel, panOffset]);

  // ============ RENDER OBJECTS ============
  useEffect(() => {
    if (!sceneRef.current) return;

    // Clear scene
    while (sceneRef.current.children.length > 0) {
      const obj = sceneRef.current.children[0];
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
      sceneRef.current.remove(obj);
    }

    // Re-add grid
    if (gridVisible) {
      const size = 100;
      const divisions = size / gridSpacing;
      const gridHelper = new THREE.GridHelper(
        size,
        divisions,
        0x444444,
        0x222222
      );
      gridHelper.rotation.x = mode === "2D" ? Math.PI / 2 : 0;
      gridHelper.position.z = mode === "2D" ? -0.01 : 0;
      sceneRef.current.add(gridHelper);
    }

    // Re-add lights
    if (mode === "3D") {
      const light1 = new THREE.DirectionalLight(0xffffff, 0.8);
      light1.position.set(10, 10, 10);
      sceneRef.current.add(light1);

      const light2 = new THREE.DirectionalLight(0xffffff, 0.4);
      light2.position.set(-10, -10, -10);
      sceneRef.current.add(light2);

      sceneRef.current.add(new THREE.AmbientLight(0x404040, 0.5));
    }

    // Render objects
    objects.forEach((obj) => {
      const layer = layers.find((l) => l.id === obj.layerId);
      if (!layer?.visible) return;

      let mesh;
      const color = new THREE.Color(obj.color);
      const lineWidth = obj.lineWidth || 2;

      switch (obj.type) {
        default:
          break;
        case "line":
          const lineGeom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(obj.start.x, obj.start.y, obj.start.z || 0),
            new THREE.Vector3(obj.end.x, obj.end.y, obj.end.z || 0),
          ]);
          mesh = new THREE.Line(
            lineGeom,
            new THREE.LineBasicMaterial({
              color,
              linewidth: lineWidth,
              linecap: "round",
              linejoin: "round",
            })
          );
          break;

        case "polyline":
          if (obj.points && obj.points.length > 1) {
            const points = obj.points.map(
              (p) => new THREE.Vector3(p.x, p.y, p.z || 0)
            );
            const polyGeom = new THREE.BufferGeometry().setFromPoints(points);
            mesh = new THREE.Line(
              polyGeom,
              new THREE.LineBasicMaterial({ color, linewidth: lineWidth })
            );
          }
          break;

        case "circle":
          const circleGeom = new THREE.CircleGeometry(obj.radius, 64);
          mesh = new THREE.Line(
            new THREE.EdgesGeometry(circleGeom),
            new THREE.LineBasicMaterial({ color, linewidth: lineWidth })
          );
          mesh.position.set(obj.center.x, obj.center.y, obj.center.z || 0);
          break;

        case "arc":
          if (obj.startAngle !== undefined && obj.endAngle !== undefined) {
            const arcGeom = new THREE.CircleGeometry(
              obj.radius,
              64,
              obj.startAngle,
              obj.endAngle - obj.startAngle
            );
            mesh = new THREE.Line(
              new THREE.EdgesGeometry(arcGeom),
              new THREE.LineBasicMaterial({ color, linewidth: lineWidth })
            );
            mesh.position.set(obj.center.x, obj.center.y, obj.center.z || 0);
          }
          break;

        case "ellipse":
          const ellipseGeom = new THREE.BufferGeometry();
          const ellipsePoints = [];
          for (let i = 0; i <= 64; i++) {
            const angle = (i / 64) * Math.PI * 2;
            ellipsePoints.push(
              new THREE.Vector3(
                Math.cos(angle) * obj.radiusX,
                Math.sin(angle) * obj.radiusY,
                0
              )
            );
          }
          ellipseGeom.setFromPoints(ellipsePoints);
          mesh = new THREE.Line(
            ellipseGeom,
            new THREE.LineBasicMaterial({ color, linewidth: lineWidth })
          );
          mesh.position.set(obj.center.x, obj.center.y, obj.center.z || 0);
          break;

        case "spline":
          if (obj.points && obj.points.length > 2) {
            const curve = new THREE.CatmullRomCurve3(
              obj.points.map((p) => new THREE.Vector3(p.x, p.y, p.z || 0)),
              obj.closed || false,
              "catmullrom",
              0.5
            );
            const splinePoints = curve.getPoints(100);
            const splineGeom = new THREE.BufferGeometry().setFromPoints(
              splinePoints
            );
            mesh = new THREE.Line(
              splineGeom,
              new THREE.LineBasicMaterial({ color, linewidth: lineWidth })
            );
          }
          break;

        case "rectangle":
          const width = Math.abs(obj.end.x - obj.start.x);
          const height = Math.abs(obj.end.y - obj.start.y);
          const rectGeom = new THREE.PlaneGeometry(width, height);
          mesh = new THREE.Line(
            new THREE.EdgesGeometry(rectGeom),
            new THREE.LineBasicMaterial({ color, linewidth: lineWidth })
          );
          mesh.position.set(
            (obj.start.x + obj.end.x) / 2,
            (obj.start.y + obj.end.y) / 2,
            0
          );
          break;

        case "hatch":
          const hatchWidth = Math.abs(obj.end.x - obj.start.x);
          const hatchHeight = Math.abs(obj.end.y - obj.start.y);
          const hatchGeom = new THREE.PlaneGeometry(hatchWidth, hatchHeight);
          const hatchPattern = hatchPatterns.find((p) => p.id === obj.pattern);
          mesh = new THREE.Mesh(
            hatchGeom,
            new THREE.MeshBasicMaterial({
              color: new THREE.Color(hatchPattern?.color || obj.color),
              transparent: true,
              opacity: obj.opacity || 0.5,
              side: THREE.DoubleSide,
            })
          );
          mesh.position.set(
            (obj.start.x + obj.end.x) / 2,
            (obj.start.y + obj.end.y) / 2,
            -0.05
          );
          break;

        case "dimension":
          if (showDimensions) {
            const dimLineGeom = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(obj.start.x, obj.start.y, 0.1),
              new THREE.Vector3(obj.end.x, obj.end.y, 0.1),
            ]);
            mesh = new THREE.Line(
              dimLineGeom,
              new THREE.LineBasicMaterial({
                color: 0x00ff00,
                linewidth: 2,
              })
            );
          }
          break;

        case "text":
          const textGeom = new THREE.PlaneGeometry(
            (obj.text?.length || 5) * (obj.size || 1) * 0.6,
            obj.size || 1
          );
          mesh = new THREE.Mesh(
            textGeom,
            new THREE.MeshBasicMaterial({
              color,
              transparent: true,
              opacity: 0.8,
              side: THREE.DoubleSide,
            })
          );
          mesh.position.set(obj.position.x, obj.position.y, 0.1);
          if (obj.rotation) mesh.rotation.z = (obj.rotation * Math.PI) / 180;
          break;

        case "box":
          const boxGeom = new THREE.BoxGeometry(
            obj.width,
            obj.height,
            obj.depth
          );
          mesh = new THREE.Mesh(
            boxGeom,
            new THREE.MeshStandardMaterial({
              color,
              metalness: 0.3,
              roughness: 0.7,
            })
          );
          mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
          break;

        case "extrusion":
          if (obj.points && obj.points.length > 2) {
            const shape = new THREE.Shape();
            obj.points.forEach((p, i) => {
              if (i === 0) shape.moveTo(p.x, p.y);
              else shape.lineTo(p.x, p.y);
            });
            shape.closePath();
            const extrudeSettings = {
              depth: obj.depth,
              bevelEnabled: false,
            };
            const extrudeGeom = new THREE.ExtrudeGeometry(
              shape,
              extrudeSettings
            );
            mesh = new THREE.Mesh(
              extrudeGeom,
              new THREE.MeshStandardMaterial({ color })
            );
          }
          break;

        case "revolve":
          if (obj.points && obj.points.length > 1) {
            const points2D = obj.points.map(
              (p) => new THREE.Vector2(Math.abs(p.x), p.y)
            );
            const revolveGeom = new THREE.LatheGeometry(
              points2D,
              obj.segments || 32
            );
            mesh = new THREE.Mesh(
              revolveGeom,
              new THREE.MeshStandardMaterial({ color })
            );
            mesh.position.set(
              obj.position?.x || 0,
              obj.position?.y || 0,
              obj.position?.z || 0
            );
          }
          break;
      }

      if (mesh) {
        mesh.userData = { id: obj.id, type: obj.type };
        if (selectedIds.includes(obj.id)) {
          if (mesh.material && mesh.material.emissive) {
            mesh.material.emissive = new THREE.Color(0x00ff00);
          }
        }
        sceneRef.current.add(mesh);
      }
    });
  }, [
    objects,
    selectedIds,
    layers,
    mode,
    gridVisible,
    gridSpacing,
    showDimensions,
    zoomLevel,
  ]);

  // ============ HISTORY MANAGEMENT ============
  const addToHistory = useCallback(
    (newObjects) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newObjects)));
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setObjects(newObjects);
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

  // ============ COORDINATE CONVERSION ============
  const getWorldCoords = useCallback(
    (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 20 - 10;
      const y = -((e.clientY - rect.top) / rect.height) * 20 + 10;

      let finalX = x / zoomLevel + panOffset.x;
      let finalY = y / zoomLevel + panOffset.y;

      // Grid snap
      if (snapSettings[SNAP_MODES.GRID]) {
        finalX = Math.round(finalX / gridSpacing) * gridSpacing;
        finalY = Math.round(finalY / gridSpacing) * gridSpacing;
      }

      return { x: finalX, y: finalY, z: 0 };
    },
    [zoomLevel, panOffset, snapSettings, gridSpacing]
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
          if (obj.type === "line") endpoints.push(obj.start, obj.end);
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
          if (obj.type === "line") {
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
          if (obj.type === "rectangle") {
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
    if (!activeTool) {
      // Selection mode
      const point = getWorldCoords(e);
      // TODO: Implement object selection by clicking
      return;
    }

    const point = snapPoint || getWorldCoords(e);

    if (activeTool === "polyline") {
      setPolylinePoints([...polylinePoints, point]);
      if (!drawing) setDrawing(true);
      return;
    }

    if (activeTool === "arc") {
      setArcPoints([...arcPoints, point]);
      if (arcPoints.length === 2) {
        createArc();
        return;
      }
      if (!drawing) setDrawing(true);
      return;
    }

    if (activeTool === "spline") {
      setPolylinePoints([...polylinePoints, point]);
      if (!drawing) setDrawing(true);
      return;
    }

    if (orthoMode && startPoint) {
      const dx = Math.abs(point.x - startPoint.x);
      const dy = Math.abs(point.y - startPoint.y);
      if (dx > dy) {
        point.y = startPoint.y;
      } else {
        point.x = startPoint.x;
      }
    }

    setStartPoint(point);
    setDrawing(true);
  };

  const handleCanvasMouseMove = (e) => {
    const point = getWorldCoords(e);

    // Find snap point
    const snap = findSnapPoint(point);
    setSnapPoint(snap);

    if (!drawing || !startPoint) {
      setCurrentPoint(point);
      return;
    }

    let finalPoint = snap || point;

    if (orthoMode && startPoint) {
      const dx = Math.abs(finalPoint.x - startPoint.x);
      const dy = Math.abs(finalPoint.y - startPoint.y);
      if (dx > dy) {
        finalPoint.y = startPoint.y;
      } else {
        finalPoint.x = startPoint.x;
      }
    }

    setCurrentPoint(finalPoint);
  };

  const handleCanvasMouseUp = (e) => {
    if (!drawing || !activeTool || !startPoint) return;

    const endPoint = snapPoint || currentPoint || getWorldCoords(e);
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
      broadcastChange("object_added", { object: newObj });
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
      broadcastChange("object_added", { object: newObj });
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
      broadcastChange("object_added", { object: newObj });
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
    broadcastChange("object_added", { object: newObj });
    setArcPoints([]);
    setDrawing(false);
    setActiveTool(null);
  };

  // ============ ZOOM & PAN ============
  const handleZoom = (delta) => {
    setZoomLevel((prev) => Math.max(0.1, Math.min(10, prev + delta)));
  };

  const handlePan = (dx, dy) => {
    setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handleWheel = (e) => {
    e.preventDefault();
    handleZoom(e.deltaY > 0 ? -0.1 : 0.1);
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
    selectedIds.forEach((id) =>
      broadcastChange("object_deleted", { object_id: id })
    );
    setSelectedIds([]);
  }, [objects, selectedIds, addToHistory, broadcastChange]);

  const handleMove = () => {
    const dx = parseFloat(prompt("Move X distance:", "0")) || 0;
    const dy = parseFloat(prompt("Move Y distance:", "0")) || 0;

    const updated = objects.map((obj) => {
      if (!selectedIds.includes(obj.id)) return obj;

      const moved = { ...obj };
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

  // Initialize history
  useEffect(() => {
    if (history.length === 0) {
      setHistory([[]]);
    }
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      {/* Top Toolbar */}
      <div className="bg-gray-800 border-b border-gray-700 px-3 py-2 flex items-center gap-2 overflow-x-auto text-xs">
        <div className="flex gap-1">
          <button
            onClick={() => alert("New Project")}
            className="p-2 hover:bg-gray-700 rounded"
            title="New"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => alert("Save")}
            className="p-2 hover:bg-gray-700 rounded"
            title="Save"
          >
            <Save size={16} />
          </button>
          <button
            onClick={() => alert("Open")}
            className="p-2 hover:bg-gray-700 rounded"
            title="Open"
          >
            <Upload size={16} />
          </button>
          <button
            onClick={() => alert("Export")}
            className="p-2 hover:bg-gray-700 rounded"
            title="Export"
          >
            <Download size={16} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-700" />

        <div className="flex gap-1">
          <button
            onClick={undo}
            disabled={historyIndex === 0}
            className="p-2 hover:bg-gray-700 rounded disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex === history.length - 1}
            className="p-2 hover:bg-gray-700 rounded disabled:opacity-30"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={16} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-700" />

        {/* Draw Tools */}
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTool("line")}
            className={`px-2 py-1 rounded ${
              activeTool === "line"
                ? "bg-blue-600"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            Line
          </button>
          <button
            onClick={() => {
              setActiveTool("polyline");
              setPolylinePoints([]);
            }}
            className={`px-2 py-1 rounded ${
              activeTool === "polyline"
                ? "bg-blue-600"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            PLine
          </button>
          <button
            onClick={() => setActiveTool("circle")}
            className={`px-2 py-1 rounded ${
              activeTool === "circle"
                ? "bg-blue-600"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            Circle
          </button>
          <button
            onClick={() => {
              setActiveTool("arc");
              setArcPoints([]);
            }}
            className={`px-2 py-1 rounded ${
              activeTool === "arc"
                ? "bg-blue-600"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            Arc
          </button>
          <button
            onClick={() => setActiveTool("ellipse")}
            className={`px-2 py-1 rounded ${
              activeTool === "ellipse"
                ? "bg-blue-600"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            Ellipse
          </button>
          <button
            onClick={() => {
              setActiveTool("spline");
              setPolylinePoints([]);
            }}
            className={`px-2 py-1 rounded ${
              activeTool === "spline"
                ? "bg-blue-600"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            Spline
          </button>
          <button
            onClick={() => setActiveTool("rectangle")}
            className={`px-2 py-1 rounded ${
              activeTool === "rectangle"
                ? "bg-blue-600"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            Rect
          </button>
          <button
            onClick={() => setShowHatchMenu(!showHatchMenu)}
            className={`px-2 py-1 rounded ${
              activeTool === "hatch"
                ? "bg-blue-600"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            Hatch
          </button>
        </div>

        <div className="w-px h-6 bg-gray-700" />

        {/* Modify Tools */}
        <div className="flex gap-1">
          <button
            onClick={handleMove}
            disabled={selectedIds.length === 0}
            className="p-2 hover:bg-gray-700 rounded disabled:opacity-30"
            title="Move"
          >
            <Move size={16} />
          </button>
          <button
            onClick={handleCopy}
            disabled={selectedIds.length === 0}
            className="p-2 hover:bg-gray-700 rounded disabled:opacity-30"
            title="Copy"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={handleMirror}
            disabled={selectedIds.length === 0}
            className="p-2 hover:bg-gray-700 rounded disabled:opacity-30"
            title="Mirror"
          >
            <Maximize size={16} />
          </button>
          <button
            onClick={handleRotate}
            disabled={selectedIds.length === 0}
            className="p-2 hover:bg-gray-700 rounded disabled:opacity-30"
            title="Rotate"
          >
            <RotateCw size={16} />
          </button>
          <button
            onClick={handleScale}
            disabled={selectedIds.length === 0}
            className="p-2 hover:bg-gray-700 rounded disabled:opacity-30"
            title="Scale"
          >
            <Maximize2 size={16} />
          </button>
          <button
            onClick={handleDelete}
            disabled={selectedIds.length === 0}
            className="p-2 hover:bg-gray-700 rounded disabled:opacity-30"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-700" />

        {/* Annotation */}
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTool("dimension")}
            className={`p-2 rounded ${
              activeTool === "dimension"
                ? "bg-blue-600"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
            title="Dimension"
          >
            <Ruler size={16} />
          </button>
          <button
            onClick={() => setActiveTool("text")}
            className={`p-2 rounded ${
              activeTool === "text"
                ? "bg-blue-600"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
            title="Text"
          >
            <Type size={16} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-700" />

        {/* 3D Tools */}
        <div className="flex gap-1">
          {mode === "3D" && (
            <button
              onClick={() => setActiveTool("box")}
              className={`px-2 py-1 rounded ${
                activeTool === "box"
                  ? "bg-blue-600"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              Box
            </button>
          )}
          <button
            onClick={handleExtrude}
            disabled={selectedIds.length === 0}
            className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded disabled:opacity-30"
          >
            Extrude
          </button>
          <button
            onClick={handleRevolve}
            disabled={selectedIds.length === 0}
            className="px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded disabled:opacity-30"
          >
            Revolve
          </button>
        </div>

        <div className="w-px h-6 bg-gray-700" />

        {/* View Controls */}
        <div className="flex gap-1">
          <button
            onClick={() => setMode(mode === "2D" ? "3D" : "2D")}
            className="px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded"
          >
            {mode === "2D" ? "3D" : "2D"}
          </button>
          <button
            onClick={() => setGridVisible(!gridVisible)}
            className={`p-2 rounded ${
              gridVisible ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
            }`}
            title="Grid"
          >
            <Grid3X3 size={16} />
          </button>
          <button
            onClick={() => setOrthoMode(!orthoMode)}
            className={`p-2 rounded ${
              orthoMode ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
            }`}
            title="Ortho"
          >
            <Zap size={16} />
          </button>
          <button
            onClick={() => setShowDimensions(!showDimensions)}
            className={`p-2 rounded ${
              showDimensions ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
            }`}
            title="Dimensions"
          >
            <Ruler size={16} />
          </button>
        </div>

        <div className="ml-auto text-xs text-gray-400 flex gap-3">
          <div>{objects.length} obj</div>
          <div>{selectedIds.length} sel</div>
          <div>{mode}</div>
          <div className={wsConnected ? "text-green-400" : "text-red-400"}>
            ● {wsConnected ? "Online" : "Offline"}
          </div>
        </div>
      </div>

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
                className={`p-2 rounded border-2 ${
                  selectedHatch === p.id
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

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Layers */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-700 flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Layers size={16} /> Layers
            </h3>
            <button
              onClick={addLayer}
              className="p-1 hover:bg-gray-700 rounded"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {layers.map((layer) => (
              <div
                key={layer.id}
                onClick={() => !layer.locked && setActiveLayerId(layer.id)}
                className={`p-3 border-b border-gray-700 cursor-pointer ${
                  activeLayerId === layer.id
                    ? "bg-blue-900"
                    : "hover:bg-gray-700"
                } ${layer.locked ? "opacity-60" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: layer.color }}
                  />
                  <span className="flex-1 text-sm truncate">{layer.name}</span>
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

        {/*        .....................Deletelayer Confirmation              */}
        {pendingDeleteLayerId && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
            <div className="bg-white p-4 rounded shadow-md">
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
                  className="px-3 py-1 rounded border"
                  onClick={() => setPendingDeleteLayerId(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 flex flex-col">
          <div
            ref={canvasRef}
            className="flex-1 relative bg-gray-900 cursor-crosshair"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onDoubleClick={handleCanvasDoubleClick}
            onWheel={handleWheel}
          >
            {/* Active Tool Indicator */}
            {activeTool && (
              <div className="absolute top-4 left-4 bg-gray-800 px-3 py-2 rounded border border-gray-700 text-sm z-10">
                <div className="font-bold text-blue-400">
                  {activeTool.toUpperCase()}
                </div>
                {activeTool === "polyline" && (
                  <div className="text-xs text-gray-400 mt-1">
                    {polylinePoints.length} points | Double-click to finish
                  </div>
                )}
                {activeTool === "arc" && (
                  <div className="text-xs text-gray-400 mt-1">
                    Click 3 points: {arcPoints.length}/3
                  </div>
                )}
                {activeTool === "spline" && (
                  <div className="text-xs text-gray-400 mt-1">
                    {polylinePoints.length} points | Double-click to finish
                  </div>
                )}
                {activeTool === "hatch" && (
                  <div className="text-xs text-gray-400 mt-1">
                    Pattern:{" "}
                    {hatchPatterns.find((p) => p.id === selectedHatch)?.name}
                  </div>
                )}
              </div>
            )}

            {/* Snap Indicator */}
            {snapPoint && (
              <div
                className="absolute w-3 h-3 border-2 border-yellow-400 pointer-events-none rounded-full"
                style={{
                  left: `${
                    (((snapPoint.x - panOffset.x) * zoomLevel + 10) *
                      canvasRef.current?.clientWidth) /
                    20
                  }px`,
                  top: `${
                    (((-snapPoint.y + panOffset.y) * zoomLevel + 10) *
                      canvasRef.current?.clientHeight) /
                    20
                  }px`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div className="absolute inset-0 border border-yellow-300 rounded-full" />
              </div>
            )}

            {/* Coordinates Display */}
            {currentPoint && (
              <div className="absolute bottom-4 left-4 bg-gray-800 px-3 py-2 rounded text-xs font-mono border border-gray-700">
                X: {currentPoint.x.toFixed(2)} | Y: {currentPoint.y.toFixed(2)}
                {snapPoint && (
                  <span className="ml-2 text-yellow-400">
                    ● {snapPoint.snapType}
                  </span>
                )}
              </div>
            )}
          </div>

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
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-sm">Copilot</h3>
              <button onClick={() => setCopilotOpen(false)}>
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-700">
              {[
                { id: "ai", icon: Sparkles, label: "AI" },
                { id: "properties", icon: Settings, label: "Properties" },
                { id: "history", icon: Clock, label: "History" },
                { id: "commands", icon: BookOpen, label: "Commands" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCopilotTab(tab.id)}
                  className={`flex-1 p-2 text-xs flex items-center justify-center gap-1 ${
                    copilotTab === tab.id
                      ? "text-blue-400 border-b-2 border-blue-400"
                      : "text-gray-400 hover:text-gray-300"
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
                  <div className="flex-1 bg-gray-900 rounded p-3 mb-3 overflow-y-auto space-y-2">
                    {aiMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`text-sm p-2 rounded ${
                          msg.type === "user"
                            ? "bg-blue-900 text-blue-100 ml-4"
                            : "bg-gray-700 text-gray-200 mr-4"
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
                      className="flex-1 bg-gray-900 text-gray-100 px-3 py-2 rounded text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
                      disabled={aiProcessing}
                    />
                    <button
                      onClick={handleAISend}
                      disabled={aiProcessing}
                      className="p-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
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
                      <div className="text-sm font-bold mb-2">
                        Selected: {selectedIds.length} object(s)
                      </div>
                      <div className="space-y-2">
                        <button
                          onClick={handleCopy}
                          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                        >
                          Copy
                        </button>
                        <button
                          onClick={handleMove}
                          className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
                        >
                          Move
                        </button>
                        <button
                          onClick={handleRotate}
                          className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm"
                        >
                          Rotate
                        </button>
                        <button
                          onClick={handleScale}
                          className="w-full px-3 py-2 bg-orange-600 hover:bg-orange-700 rounded text-sm"
                        >
                          Scale
                        </button>
                        <button
                          onClick={handleMirror}
                          className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-sm"
                        >
                          Mirror
                        </button>
                        <button
                          onClick={handleExtrude}
                          className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
                        >
                          Extrude 3D
                        </button>
                        <button
                          onClick={handleDelete}
                          className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* History Tab */}
              {copilotTab === "history" && (
                <div className="space-y-2">
                  <div className="text-sm font-bold mb-2">
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
                        className={`p-2 rounded text-xs cursor-pointer ${
                          idx === historyIndex
                            ? "bg-blue-900 text-blue-100"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
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
                  <div className="text-sm font-bold mb-2">
                    Command Reference
                  </div>
                  <div className="space-y-1 text-xs">
                    {Object.entries(commands).map(([key, cmd]) => (
                      <div
                        key={key}
                        className="bg-gray-700 p-2 rounded flex justify-between"
                      >
                        <span className="font-bold text-blue-400">{key}</span>
                        <span className="text-gray-400">{cmd.name}</span>
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
            className="absolute right-4 top-20 p-2 bg-gray-800 rounded-l border border-r-0 border-gray-700 hover:bg-gray-700"
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 flex items-center text-xs">
        {/* Snap Modes */}
        <div className="flex gap-1">
          {Object.entries(SNAP_MODES).map(([key, value]) => (
            <button
              key={value}
              onClick={() =>
                setSnapSettings((prev) => ({ ...prev, [value]: !prev[value] }))
              }
              className={`px-2 py-1 rounded text-xs font-semibold ${
                snapSettings[value]
                  ? "bg-green-600 text-white"
                  : "bg-gray-700 text-gray-400 hover:bg-gray-600"
              }`}
              title={key}
            >
              {key.slice(0, 3)}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-700 mx-3" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleZoom(-0.2)}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <ZoomOut size={14} />
          </button>
          <select
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            className="bg-gray-700 px-2 py-1 rounded text-xs border border-gray-600"
          >
            {[0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4].map((z) => (
              <option key={z} value={z}>
                {Math.round(z * 100)}%
              </option>
            ))}
          </select>
          <button
            onClick={() => handleZoom(0.2)}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => {
              setZoomLevel(1);
              setPanOffset({ x: 0, y: 0 });
            }}
            className="p-1 hover:bg-gray-700 rounded"
            title="Fit All"
          >
            <Home size={14} />
          </button>
        </div>

        <div className="ml-auto flex gap-4 text-gray-400">
          <div>
            Objects: <span className="text-gray-200">{objects.length}</span>
          </div>
          <div>
            Selected:{" "}
            <span className="text-gray-200">{selectedIds.length}</span>
          </div>
          <div>
            Layers: <span className="text-gray-200">{layers.length}</span>
          </div>
          <div>
            Zoom:{" "}
            <span className="text-gray-200">
              {Math.round(zoomLevel * 100)}%
            </span>
          </div>
          <div className="text-green-400">● Ready</div>
        </div>
      </div>
    </div>
  );
}
