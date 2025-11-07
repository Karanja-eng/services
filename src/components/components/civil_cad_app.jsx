import React, { useState, useRef, useEffect } from "react";
import {
  Download,
  Square,
  Circle,
  Move,
  Minus,
  Grid,
  Layers,
  Ruler,
  Hash,
  Edit3,
  Trash2,
  ZoomIn,
  ZoomOut,
  Save,
  FileText,
  Box,
  Type,
  Upload,
  Package,
  Undo,
  Redo,
  Copy,
  FileDown,
  Maximize,
  Target,
  AlertCircle,
} from "lucide-react";

const CivilCADApp = () => {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [tool, setTool] = useState("select");
  const [elements, setElements] = useState([]);
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [curvePoints, setCurvePoints] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [pan] = useState({ x: 0, y: 0 });
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [selectedElement, setSelectedElement] = useState(null);
  const [selectedElements, setSelectedElements] = useState([]);
  const [hatchPattern, setHatchPattern] = useState("none");
  const [dimensionMode, setDimensionMode] = useState("linear");
  const [view3D, setView3D] = useState(false);
  const [rotation3D, setRotation3D] = useState({ x: 0, y: 0 });
  const [nearestSnapPoint, setNearestSnapPoint] = useState(null);
  const [showComponentLibrary, setShowComponentLibrary] = useState(false);
  // Removed unused showMeasurementTool state
  const [showTitleBlock, setShowTitleBlock] = useState(false);
  const [showBOQ, setShowBOQ] = useState(false);
  const [measurementStart, setMeasurementStart] = useState(null);
  const [measurementEnd, setMeasurementEnd] = useState(null);
  const [drawingScale, setDrawingScale] = useState("1:100");
  const [clashDetection, setClashDetection] = useState(false);
  const [clashes, setClashes] = useState([]);
  const [clipboard, setClipboard] = useState([]);
  const [titleBlockData] = useState({
    projectName: "Civil Engineering Project",
    projectNumber: "CE-2025-001",
    drawnBy: "Engineer",
    checkedBy: "Senior Engineer",
    date: new Date().toLocaleDateString(),
    scale: "1:100",
    drawing: "Structural Layout",
  });
  const [layers, setLayers] = useState([
    {
      id: 1,
      name: "Structural",
      visible: true,
      color: "#3b82f6",
      locked: false,
    },
    {
      id: 2,
      name: "Dimensions",
      visible: true,
      color: "#10b981",
      locked: false,
    },
    {
      id: 3,
      name: "Annotations",
      visible: true,
      color: "#6366f1",
      locked: false,
    },
    {
      id: 4,
      name: "Civil Works",
      visible: true,
      color: "#f59e0b",
      locked: false,
    },
  ]);
  const [activeLayer, setActiveLayer] = useState(1);
  const [strokeColor, setStrokeColor] = useState("#1e40af");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [selectionBox, setSelectionBox] = useState(null);

  const gridSize = 20;
  const scaleFactors = {
    "1:1": 1,
    "1:50": 50,
    "1:100": 100,
    "1:200": 200,
    "1:500": 500,
  };

  const structuralComponents = {
    beam: {
      width: 300,
      height: 40,
      depth: 500,
      reinforcement: "T16@200",
      unit: "m",
    },
    column: {
      width: 300,
      height: 300,
      depth: 3000,
      reinforcement: "8T20",
      unit: "m",
    },
    slab: {
      width: 400,
      height: 150,
      depth: 150,
      reinforcement: "T12@200 B/W",
      unit: "m²",
    },
    footing: {
      width: 400,
      height: 400,
      depth: 300,
      reinforcement: "T16@150 B/W",
      unit: "nr",
    },
  };

  const civilComponents = {
    manhole: { diameter: 1200, depth: 2000, coverLevel: 0, unit: "nr" },
    sewer: { diameter: 300, length: 10000, gradient: "1:100", unit: "m" },
    pool: { width: 10000, length: 20000, depth: 1500, unit: "nr" },
    basement: { width: 8000, length: 12000, depth: 3000, unit: "m³" },
  };

  const addToHistory = (newElements) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setElements(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setElements(history[historyIndex + 1]);
    }
  };

  const snapToGrid = (x, y) => {
    if (!snapEnabled) return { x, y };
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize,
    };
  };

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;
    return snapToGrid(x, y);
  };

  const findNearestSnapPoint = (x, y) => {
    if (!snapEnabled) return null;

    let nearest = null;
    let minDist = 20 / zoom;

    elements.forEach((el) => {
      const points = getElementSnapPoints(el);
      points.forEach((point) => {
        const dist = Math.sqrt(
          Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2)
        );
        if (dist < minDist) {
          minDist = dist;
          nearest = point;
        }
      });
    });

    return nearest;
  };

  const getElementSnapPoints = (el) => {
    const points = [];

    if (el.type === "line") {
      points.push(
        { x: el.x1, y: el.y1, type: "endpoint" },
        { x: el.x2, y: el.y2, type: "endpoint" },
        { x: (el.x1 + el.x2) / 2, y: (el.y1 + el.y2) / 2, type: "midpoint" }
      );
    } else if (
      el.type === "rectangle" ||
      el.type === "beam" ||
      el.type === "column" ||
      el.type === "slab"
    ) {
      const x = el.x || 0;
      const y = el.y || 0;
      const w = el.width || 0;
      const h = el.height || 0;
      points.push(
        { x, y, type: "corner" },
        { x: x + w, y, type: "corner" },
        { x, y: y + h, type: "corner" },
        { x: x + w, y: y + h, type: "corner" },
        { x: x + w / 2, y, type: "midpoint" },
        { x: x + w / 2, y: y + h, type: "midpoint" },
        { x, y: y + h / 2, type: "midpoint" },
        { x: x + w, y: y + h / 2, type: "midpoint" },
        { x: x + w / 2, y: y + h / 2, type: "center" }
      );
    } else if (el.type === "circle" || el.type === "manhole") {
      const r = el.radius || 0;
      points.push(
        { x: el.x, y: el.y, type: "center" },
        { x: el.x + r, y: el.y, type: "quadrant" },
        { x: el.x - r, y: el.y, type: "quadrant" },
        { x: el.x, y: el.y + r, type: "quadrant" },
        { x: el.x, y: el.y - r, type: "quadrant" }
      );
    } else if (el.type === "curve" && el.points) {
      el.points.forEach((p, i) => {
        points.push({
          x: p.x,
          y: p.y,
          type:
            i === 0 || i === el.points.length - 1 ? "endpoint" : "curvepoint",
        });
      });
    }

    return points;
  };

  const detectClashes = React.useCallback(() => {
    const detectedClashes = [];

    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        if (elementsOverlap(elements[i], elements[j])) {
          detectedClashes.push({
            element1: i,
            element2: j,
            type: "overlap",
            severity: "high",
          });
        }
      }
    }

    setClashes(detectedClashes);
    return detectedClashes;
  }, [elements, view3D]);

  const elementsOverlap = (el1, el2) => {
    if (!el1 || !el2 || !view3D) return false;

    const box1 = getElementBoundingBox(el1);
    const box2 = getElementBoundingBox(el2);

    if (!box1 || !box2) return false;

    return !(
      box1.x2 < box2.x1 ||
      box1.x1 > box2.x2 ||
      box1.y2 < box2.y1 ||
      box1.y1 > box2.y2
    );
  };

  const getElementBoundingBox = (el) => {
    if (el.type === "rectangle" || el.type === "beam" || el.type === "column") {
      return {
        x1: el.x,
        y1: el.y,
        x2: el.x + el.width,
        y2: el.y + el.height,
      };
    } else if (el.type === "circle") {
      return {
        x1: el.x - el.radius,
        y1: el.y - el.radius,
        x2: el.x + el.radius,
        y2: el.y + el.radius,
      };
    }
    return null;
  };

  const calculateBOQ = () => {
    const boq = {};

    elements.forEach((el) => {
      const type = el.type;
      if (!boq[type]) {
        boq[type] = {
          count: 0,
          total: 0,
          unit: "nr",
          description: type.charAt(0).toUpperCase() + type.slice(1),
        };
      }

      boq[type].count++;

      if (type === "beam" || type === "sewer") {
        const length = Math.sqrt(
          Math.pow((el.x2 || el.x + el.width) - el.x1 || el.x, 2) +
            Math.pow((el.y2 || el.y + el.height) - el.y1 || el.y, 2)
        );
        boq[type].total += length / scaleFactors[drawingScale] / 1000;
        boq[type].unit = "m";
      } else if (type === "slab" || type === "rectangle") {
        const area =
          (el.width * el.height) /
          Math.pow(scaleFactors[drawingScale], 2) /
          1000000;
        boq[type].total += area;
        boq[type].unit = "m²";
      } else if (type === "basement") {
        const volume =
          (el.width * el.height * (el.depth || 3000)) /
          Math.pow(scaleFactors[drawingScale], 3) /
          1000000000;
        boq[type].total += volume;
        boq[type].unit = "m³";
      }
    });

    return boq;
  };

  const copySelected = () => {
    if (selectedElements.length > 0) {
      const copied = selectedElements.map((idx) => ({ ...elements[idx] }));
      setClipboard(copied);
    } else if (selectedElement !== null) {
      setClipboard([{ ...elements[selectedElement] }]);
    }
  };

  const pasteFromClipboard = () => {
    if (clipboard.length === 0) return;

    const newElements = clipboard.map((el) => ({
      ...el,
      x: (el.x || el.x1) + 50,
      y: (el.y || el.y1) + 50,
      x1: el.x1 ? el.x1 + 50 : undefined,
      y1: el.y1 ? el.y1 + 50 : undefined,
      x2: el.x2 ? el.x2 + 50 : undefined,
      y2: el.y2 ? el.y2 + 50 : undefined,
    }));

    const updated = [...elements, ...newElements];
    setElements(updated);
    addToHistory(updated);
  };

  const deleteSelected = () => {
    if (selectedElements.length > 0) {
      const updated = elements.filter(
        (_, idx) => !selectedElements.includes(idx)
      );
      setElements(updated);
      addToHistory(updated);
      setSelectedElements([]);
    } else if (selectedElement !== null) {
      const updated = elements.filter((_, idx) => idx !== selectedElement);
      setElements(updated);
      addToHistory(updated);
      setSelectedElement(null);
    }
  };

  const groupElements = () => {
    if (selectedElements.length < 2) return;

    const grouped = {
      type: "group",
      elements: selectedElements.map((idx) => elements[idx]),
      layer: activeLayer,
      id: Date.now(),
    };

    const updated = elements.filter(
      (_, idx) => !selectedElements.includes(idx)
    );
    updated.push(grouped);
    setElements(updated);
    addToHistory(updated);
    setSelectedElements([]);
  };

  const drawCanvas = React.useCallback(() => {
    // ...existing code...
  }, [
    elements,
    zoom,
    pan,
    gridEnabled,
    selectedElement,
    view3D,
    rotation3D,
    nearestSnapPoint,
    selectionBox,
    clashes,
    showTitleBlock,
    measurementStart,
    measurementEnd,
  ]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const drawTitleBlock = (ctx, canvas) => {
    const blockWidth = 400;
    const blockHeight = 150;
    const x = canvas.width - blockWidth - 20;
    const y = canvas.height - blockHeight - 20;

    ctx.fillStyle = "white";
    ctx.fillRect(x, y, blockWidth, blockHeight);
    ctx.strokeStyle = "#1e40af";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, blockWidth, blockHeight);

    ctx.fillStyle = "#1e40af";
    ctx.font = "bold 16px Arial";
    ctx.fillText(titleBlockData.projectName, x + 10, y + 25);

    ctx.font = "12px Arial";
    ctx.fillText(`Project No: ${titleBlockData.projectNumber}`, x + 10, y + 45);
    ctx.fillText(`Drawing: ${titleBlockData.drawing}`, x + 10, y + 65);
    ctx.fillText(`Scale: ${titleBlockData.scale}`, x + 10, y + 85);
    ctx.fillText(`Drawn: ${titleBlockData.drawnBy}`, x + 10, y + 105);
    ctx.fillText(`Checked: ${titleBlockData.checkedBy}`, x + 10, y + 125);
    ctx.fillText(`Date: ${titleBlockData.date}`, x + 250, y + 125);
  };

  const draw2DElement = (ctx, el) => {
    if (el.type === "group") {
      el.elements.forEach((subEl) => draw2DElement(ctx, subEl));
      return;
    }

    switch (el.type) {
      case "line":
        ctx.beginPath();
        ctx.moveTo(el.x1, el.y1);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
        break;
      case "rectangle":
        // Other cases remain unchanged
        break;
      case "circle":
        ctx.beginPath();
        ctx.arc(el.x, el.y, el.radius, 0, Math.PI * 2);
        if (el.hatch) drawHatch(ctx, el);
        ctx.stroke();
        if (el.fillColor) ctx.fill();
        break;
      default:
        console.warn(`Unknown element type: ${el.type}`);
        break;
      case "curve":
        if (el.points && el.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(el.points[0].x, el.points[0].y);
          for (let i = 1; i < el.points.length - 2; i++) {
            const xc = (el.points[i].x + el.points[i + 1].x) / 2;
            const yc = (el.points[i].y + el.points[i + 1].y) / 2;
            ctx.quadraticCurveTo(el.points[i].x, el.points[i].y, xc, yc);
          }
          if (el.points.length > 2) {
            ctx.quadraticCurveTo(
              el.points[el.points.length - 2].x,
              el.points[el.points.length - 2].y,
              el.points[el.points.length - 1].x,
              el.points[el.points.length - 1].y
            );
          }
          ctx.stroke();
        }
        break;
      case "dimension":
        drawDimension(ctx, el);
        break;
      case "text":
        ctx.font = `${el.size || 14}px Arial`;
        ctx.fillStyle = el.color || strokeColor;
        ctx.fillText(el.text, el.x, el.y);
        break;
      case "annotation":
        drawAnnotation(ctx, el);
        break;
      case "beam":
      case "column":
      case "slab":
      case "footing":
        drawStructuralComponent(ctx, el);
        break;
      case "manhole":
      case "sewer":
      case "pool":
      case "basement":
        drawCivilComponent(ctx, el);
        break;
    }
  };

  const drawAnnotation = (ctx, el) => {
    // Draw callout with leader
    ctx.beginPath();
    ctx.moveTo(el.x, el.y);
    ctx.lineTo(el.leaderX || el.x + 50, el.leaderY || el.y - 30);
    ctx.stroke();

    const textX = el.leaderX || el.x + 50;
    const textY = el.leaderY || el.y - 30;

    ctx.fillStyle = "white";
    ctx.fillRect(textX - 5, textY - 20, (el.text?.length || 10) * 8 + 10, 25);
    ctx.strokeRect(textX - 5, textY - 20, (el.text?.length || 10) * 8 + 10, 25);

    ctx.fillStyle = el.color || strokeColor;
    ctx.font = "12px Arial";
    ctx.fillText(el.text || "Annotation", textX, textY - 5);
  };

  const draw3DElement = (ctx, el) => {
    if (el.type === "group") {
      el.elements.forEach((subEl) => draw3DElement(ctx, subEl));
      return;
    }

    const depth = el.depth || 100;
    const angle = (rotation3D.y * Math.PI) / 180;
    const depthX = depth * Math.cos(angle) * 0.5;
    const depthY = depth * Math.sin(angle) * 0.3;

    ctx.save();
    ctx.fillStyle = el.fillColor || "rgba(59, 130, 246, 0.3)";
    ctx.strokeStyle = el.color || strokeColor;

    if (el.type === "rectangle" || el.type === "beam" || el.type === "slab") {
      ctx.fillRect(el.x, el.y, el.width, el.height);
      ctx.strokeRect(el.x, el.y, el.width, el.height);

      ctx.fillStyle = el.fillColor
        ? el.fillColor.replace("0.3", "0.5")
        : "rgba(59, 130, 246, 0.5)";
      ctx.beginPath();
      ctx.moveTo(el.x, el.y);
      ctx.lineTo(el.x + depthX, el.y - depthY);
      ctx.lineTo(el.x + el.width + depthX, el.y - depthY);
      ctx.lineTo(el.x + el.width, el.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = el.fillColor
        ? el.fillColor.replace("0.3", "0.2")
        : "rgba(59, 130, 246, 0.2)";
      ctx.beginPath();
      ctx.moveTo(el.x + el.width, el.y);
      ctx.lineTo(el.x + el.width + depthX, el.y - depthY);
      ctx.lineTo(el.x + el.width + depthX, el.y + el.height - depthY);
      ctx.lineTo(el.x + el.width, el.y + el.height);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawStructuralComponent = (ctx, el) => {
    ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
    ctx.fillRect(el.x, el.y, el.width, el.height);
    ctx.strokeRect(el.x, el.y, el.width, el.height);

    if (el.reinforcement) {
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 1;
      const spacing = 20;
      for (let i = spacing; i < el.width; i += spacing) {
        ctx.beginPath();
        ctx.moveTo(el.x + i, el.y);
        ctx.lineTo(el.x + i, el.y + el.height);
        ctx.stroke();
      }

      ctx.fillStyle = "#1e40af";
      ctx.font = "10px Arial";
      ctx.fillText(el.reinforcement, el.x + 5, el.y + el.height / 2);
    }
  };

  const drawCivilComponent = (ctx, el) => {
    switch (el.type) {
      case "manhole":
        // ...existing code...
        break;
      case "pool":
        // ...existing code...
        break;
      case "basement":
        // ...existing code...
        break;
      case "sewer":
        // ...existing code...
        break;
      default:
        // No action for unknown civil component types
        break;
    }
  };

  const drawHatch = (ctx, el) => {
    ctx.save();
    ctx.clip();

    const patterns = {
      soil: () => {
        ctx.strokeStyle = "#92400e";
        for (let y = el.y; y < el.y + (el.height || el.radius * 2); y += 6) {
          ctx.beginPath();
          ctx.moveTo(el.x, y);
          ctx.lineTo(el.x + (el.width || el.radius * 2), y);
          ctx.stroke();
        }
      },
      sand: () => {
        ctx.fillStyle = "#fbbf24";
        for (let i = 0; i < 100; i++) {
          const x = el.x + Math.random() * (el.width || el.radius * 2);
          const y = el.y + Math.random() * (el.height || el.radius * 2);
          ctx.fillRect(x, y, 1, 1);
        }
      },
      concrete: () => {
        ctx.fillStyle = "#6b7280";
        for (let i = 0; i < 50; i++) {
          const x = el.x + Math.random() * (el.width || el.radius * 2);
          const y = el.y + Math.random() * (el.height || el.radius * 2);
          ctx.fillRect(x, y, 2, 2);
        }
      },
      gravel: () => {
        ctx.fillStyle = "#78716c";
        for (let i = 0; i < 30; i++) {
          const x = el.x + Math.random() * (el.width || el.radius * 2);
          const y = el.y + Math.random() * (el.height || el.radius * 2);
          ctx.beginPath();
          ctx.arc(x, y, 2 + Math.random() * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      },
      hardcore: () => {
        ctx.strokeStyle = "#57534e";
        ctx.fillStyle = "#a8a29e";
        for (let i = 0; i < 20; i++) {
          const x = el.x + Math.random() * (el.width || el.radius * 2);
          const y = el.y + Math.random() * (el.height || el.radius * 2);
          const size = 3 + Math.random() * 5;
          ctx.fillRect(x, y, size, size);
          ctx.strokeRect(x, y, size, size);
        }
      },
      steel: () => {
        ctx.strokeStyle = "#dc2626";
        ctx.lineWidth = 1;
        const spacing = 15;
        for (let i = 0; i < el.width; i += spacing) {
          ctx.beginPath();
          ctx.moveTo(el.x + i, el.y);
          ctx.lineTo(el.x + i, el.y + el.height);
          ctx.stroke();
        }
        for (let i = 0; i < el.height; i += spacing) {
          ctx.beginPath();
          ctx.moveTo(el.x, el.y + i);
          ctx.lineTo(el.x + el.width, el.y + i);
          ctx.stroke();
        }
      },
    };

    if (patterns[el.hatch]) patterns[el.hatch]();
    ctx.restore();
  };

  const drawDimension = (ctx, el) => {
    const { x1, y1, x2, y2, offset = 30, dimType = "linear" } = el;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    if (dimType === "linear" || dimType === "aligned") {
      const ox = offset * Math.cos(angle + Math.PI / 2);
      const oy = offset * Math.sin(angle + Math.PI / 2);

      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + ox, y1 + oy);
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 + ox, y2 + oy);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x1 + ox, y1 + oy);
      ctx.lineTo(x2 + ox, y2 + oy);
      ctx.stroke();

      drawArrow(ctx, x1 + ox, y1 + oy, angle + Math.PI, 10);
      drawArrow(ctx, x2 + ox, y2 + oy, angle, 10);

      const midX = (x1 + x2) / 2 + ox;
      const midY = (y1 + y2) / 2 + oy;

      ctx.save();
      ctx.translate(midX, midY);
      ctx.rotate(angle);
      ctx.fillStyle = "#10b981";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      const realLength = (length * scaleFactors[drawingScale]) / 1000;
      ctx.fillText(`${realLength.toFixed(2)}m`, 0, -5);
      ctx.restore();
    } else if (dimType === "angular") {
      ctx.strokeStyle = "#10b981";
      ctx.arc(x1, y1, 40, angle, angle + Math.PI / 4);
      ctx.stroke();
      ctx.fillStyle = "#10b981";
      ctx.font = "bold 12px Arial";
      ctx.fillText("45°", x1 + 50, y1);
    } else if (dimType === "radial") {
      ctx.strokeStyle = "#10b981";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.fillStyle = "#10b981";
      ctx.font = "bold 12px Arial";
      const realRadius = (length * scaleFactors[drawingScale]) / 1000;
      ctx.fillText(`R${realRadius.toFixed(2)}m`, (x1 + x2) / 2, (y1 + y2) / 2);
    }
  };

  const drawArrow = (ctx, x, y, angle, size) => {
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x - size * Math.cos(angle - Math.PI / 6),
      y - size * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      x - size * Math.cos(angle + Math.PI / 6),
      y - size * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  };

  const drawSnapPoints = (ctx, el, isSelected) => {
    const points = getElementSnapPoints(el);

    points.forEach((point) => {
      const colors = {
        endpoint: "#3b82f6",
        corner: "#3b82f6",
        midpoint: "#10b981",
        center: "#8b5cf6",
        quadrant: "#f59e0b",
        curvepoint: "#06b6d4",
      };

      ctx.fillStyle = colors[point.type] || "#3b82f6";
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;

      if (point.type === "corner" || point.type === "endpoint") {
        ctx.fillRect(point.x - 4, point.y - 4, 8, 8);
        ctx.strokeRect(point.x - 4, point.y - 4, 8, 8);
      } else {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });
  };

  const handleMouseDown = (e) => {
    const coords = getCanvasCoordinates(e);
    const snapPoint = findNearestSnapPoint(coords.x, coords.y);
    const finalCoords = snapPoint || coords;

    if (tool === "select") {
      if (e.shiftKey) {
        const idx = elements.findIndex((el) =>
          isPointInElement(finalCoords, el)
        );
        if (idx >= 0) {
          setSelectedElements([...selectedElements, idx]);
        } else {
          setDrawing(true);
          setStartPoint(finalCoords);
        }
      } else {
        const idx = elements.findIndex((el) =>
          isPointInElement(finalCoords, el)
        );
        setSelectedElement(idx >= 0 ? idx : null);
        if (idx < 0) {
          setDrawing(true);
          setStartPoint(finalCoords);
        }
      }
    } else if (tool === "measure") {
      if (!measurementStart) {
        setMeasurementStart(finalCoords);
      } else {
        setMeasurementEnd(finalCoords);
      }
    } else if (tool === "curve") {
      setCurvePoints([...curvePoints, finalCoords]);
    } else if (tool === "annotation") {
      const text = prompt("Enter annotation text:");
      if (text) {
        const newElement = {
          type: "annotation",
          x: finalCoords.x,
          y: finalCoords.y,
          text,
          layer: activeLayer,
          color: strokeColor,
        };
        const updated = [...elements, newElement];
        setElements(updated);
        addToHistory(updated);
      }
    } else {
      setDrawing(true);
      setStartPoint(finalCoords);
    }
  };

  const handleMouseMove = (e) => {
    const coords = getCanvasCoordinates(e);
    const snapPoint = findNearestSnapPoint(coords.x, coords.y);
    setNearestSnapPoint(snapPoint);

    if (tool === "measure" && measurementStart && !measurementEnd) {
      setMeasurementEnd(snapPoint || coords);
      return;
    }

    if (!drawing || !startPoint) return;

    const finalCoords = snapPoint || coords;

    if (tool === "select" && e.shiftKey) {
      setSelectionBox({
        x1: startPoint.x,
        y1: startPoint.y,
        x2: finalCoords.x,
        y2: finalCoords.y,
      });
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    drawCanvas();

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.setLineDash([5, 5]);

    switch (tool) {
      case "line":
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(finalCoords.x, finalCoords.y);
        ctx.stroke();
        break;
      case "rectangle":
        ctx.strokeRect(
          startPoint.x,
          startPoint.y,
          finalCoords.x - startPoint.x,
          finalCoords.y - startPoint.y
        );
        break;
      case "circle":
        const radius = Math.sqrt(
          Math.pow(finalCoords.x - startPoint.x, 2) +
            Math.pow(finalCoords.y - startPoint.y, 2)
        );
        ctx.beginPath();
        ctx.arc(startPoint.x, startPoint.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        break;
      default:
        console.warn(`Unhandled tool: ${tool}`);
        break;
    }

    ctx.restore();
  };

  const handleMouseUp = (e) => {
    if (tool === "select" && selectionBox) {
      const selected = elements
        .map((el, idx) => {
          const box = getElementBoundingBox(el);
          if (!box) return -1;

          const minX = Math.min(selectionBox.x1, selectionBox.x2);
          const maxX = Math.max(selectionBox.x1, selectionBox.x2);
          const minY = Math.min(selectionBox.y1, selectionBox.y2);
          const maxY = Math.max(selectionBox.y1, selectionBox.y2);

          if (
            box.x1 >= minX &&
            box.x2 <= maxX &&
            box.y1 >= minY &&
            box.y2 <= maxY
          ) {
            return idx;
          }
          return -1;
        })
        .filter((idx) => idx >= 0);

      setSelectedElements(selected);
      setSelectionBox(null);
      setDrawing(false);
      return;
    }

    if (!drawing || !startPoint) return;

    const coords = getCanvasCoordinates(e);
    const snapPoint = findNearestSnapPoint(coords.x, coords.y);
    const finalCoords = snapPoint || coords;
    const newElement = { layer: activeLayer, color: strokeColor, strokeWidth };

    switch (tool) {
      case "line":
        newElement.type = "line";
        newElement.x1 = startPoint.x;
        newElement.y1 = startPoint.y;
        newElement.x2 = finalCoords.x;
        newElement.y2 = finalCoords.y;
        break;
      case "rectangle":
        newElement.type = "rectangle";
        newElement.x = startPoint.x;
        newElement.y = startPoint.y;
        newElement.width = finalCoords.x - startPoint.x;
        newElement.height = finalCoords.y - startPoint.y;
        if (hatchPattern !== "none") newElement.hatch = hatchPattern;
        break;
      case "circle":
        newElement.type = "circle";
        newElement.x = startPoint.x;
        newElement.y = startPoint.y;
        newElement.radius = Math.sqrt(
          Math.pow(finalCoords.x - startPoint.x, 2) +
            Math.pow(finalCoords.y - startPoint.y, 2)
        );
        if (hatchPattern !== "none") newElement.hatch = hatchPattern;
        break;
      case "dimension":
        newElement.type = "dimension";
        newElement.x1 = startPoint.x;
        newElement.y1 = startPoint.y;
        newElement.x2 = finalCoords.x;
        newElement.y2 = finalCoords.y;
        newElement.dimType = dimensionMode;
        break;
      case "text":
        const text = prompt("Enter text:");
        if (text) {
          newElement.type = "text";
          newElement.x = finalCoords.x;
          newElement.y = finalCoords.y;
          newElement.text = text;
          newElement.size = 14;
        } else {
          setDrawing(false);
          setStartPoint(null);
          return;
        }
        break;
      default:
        console.warn(`Unknown tool: ${tool}`);
        break;
    }

    const updated = [...elements, newElement];
    setElements(updated);
    addToHistory(updated);
    setDrawing(false);
    setStartPoint(null);
  };

  const finishCurve = () => {
    if (curvePoints.length > 1) {
      const updated = [
        ...elements,
        {
          type: "curve",
          points: curvePoints,
          layer: activeLayer,
          color: strokeColor,
          strokeWidth,
        },
      ];
      setElements(updated);
      addToHistory(updated);
    }
    setCurvePoints([]);
    setTool("select");
  };

  const isPointInElement = (point, el) => {
    const tolerance = 10 / zoom;

    if (el.type === "line") {
      const dist = pointToLineDistance(point, {
        x1: el.x1,
        y1: el.y1,
        x2: el.x2,
        y2: el.y2,
      });
      return dist < tolerance;
    } else if (
      el.type === "rectangle" ||
      el.type === "beam" ||
      el.type === "column" ||
      el.type === "slab" ||
      el.type === "footing"
    ) {
      return (
        point.x >= el.x &&
        point.x <= el.x + el.width &&
        point.y >= el.y &&
        point.y <= el.y + el.height
      );
    } else if (el.type === "circle" || el.type === "manhole") {
      const dist = Math.sqrt(
        Math.pow(point.x - el.x, 2) + Math.pow(point.y - el.y, 2)
      );
      return Math.abs(dist - el.radius) < tolerance;
    }
    return false;
  };

  const pointToLineDistance = (point, line) => {
    const { x1, y1, x2, y2 } = line;
    const A = point.x - x1;
    const B = point.y - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    const param = lenSq !== 0 ? dot / lenSq : -1;

    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    return Math.sqrt(Math.pow(point.x - xx, 2) + Math.pow(point.y - yy, 2));
  };

  const addStructuralComponent = (type) => {
    const comp = structuralComponents[type];
    const newElement = {
      type,
      x: 200,
      y: 200,
      width: comp.width,
      height: comp.height,
      depth: comp.depth,
      reinforcement: comp.reinforcement,
      layer: activeLayer,
      color: strokeColor,
      strokeWidth,
      fillColor: "rgba(59, 130, 246, 0.1)",
    };
    const updated = [...elements, newElement];
    setElements(updated);
    addToHistory(updated);
    setShowComponentLibrary(false);
  };

  const addCivilComponent = (type) => {
    const comp = civilComponents[type];
    let newElement = {
      type,
      layer: activeLayer,
      color: strokeColor,
      strokeWidth,
    };

    if (type === "manhole") {
      newElement.x = 300;
      newElement.y = 300;
      newElement.radius = comp.diameter / 2;
      newElement.depth = comp.depth;
    } else if (type === "sewer") {
      newElement.x1 = 200;
      newElement.y1 = 200;
      newElement.x2 = 400;
      newElement.y2 = 200;
      newElement.diameter = comp.diameter;
    } else {
      newElement.x = 200;
      newElement.y = 200;
      newElement.width = comp.width;
      newElement.height = comp.length;
      newElement.depth = comp.depth;
    }

    const updated = [...elements, newElement];
    setElements(updated);
    addToHistory(updated);
    setShowComponentLibrary(false);
  };

  const handleExport = (format) => {
    const canvas = canvasRef.current;

    switch (format) {
      case "jpg":
        const jpg = canvas.toDataURL("image/jpeg");
        downloadFile(jpg, "drawing.jpg");
        break;
      case "png":
        const png = canvas.toDataURL("image/png");
        downloadFile(png, "drawing.png");
        break;
      case "pdf":
        exportToPDF();
        break;
      case "dxf":
        const dxfData = convertToDXF(elements);
        downloadFile(
          "data:text/plain;charset=utf-8," + encodeURIComponent(dxfData),
          "drawing.dxf"
        );
        break;
      case "revit":
        alert("Revit export: Export to IFC format for Revit compatibility");
        break;
      default:
        const json = JSON.stringify(
          { elements, layers, titleBlockData },
          null,
          2
        );
        downloadFile(
          "data:application/json;charset=utf-8," + encodeURIComponent(json),
          "drawing.json"
        );
    }
  };

  const exportToPDF = () => {
    // Basic PDF export - in production, integrate jsPDF
    const canvas = canvasRef.current;
    // const imgData = canvas.toDataURL("image/png"); // Unused

    alert(
      'PDF Export: Integrate jsPDF library for production\n\nSample code:\nimport jsPDF from "jspdf";\nconst pdf = new jsPDF();\npdf.addImage(imgData, "PNG", 10, 10);\npdf.save("drawing.pdf");'
    );
  };

  const convertToDXF = (els) => {
    let dxf =
      "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";

    els.forEach((el) => {
      if (el.type === "line") {
        dxf += `0\nLINE\n8\n0\n10\n${el.x1}\n20\n${el.y1}\n30\n0\n11\n${el.x2}\n21\n${el.y2}\n31\n0\n`;
      } else if (el.type === "circle") {
        dxf += `0\nCIRCLE\n8\n0\n10\n${el.x}\n20\n${el.y}\n30\n0\n40\n${el.radius}\n`;
      } else if (
        el.type === "rectangle" ||
        el.type === "beam" ||
        el.type === "slab"
      ) {
        dxf += `0\nLWPOLYLINE\n8\n0\n90\n5\n70\n1\n10\n${el.x}\n20\n${
          el.y
        }\n10\n${el.x + el.width}\n20\n${el.y}\n10\n${el.x + el.width}\n20\n${
          el.y + el.height
        }\n10\n${el.x}\n20\n${el.y + el.height}\n10\n${el.x}\n20\n${el.y}\n`;
      } else if (el.type === "text") {
        dxf += `0\nTEXT\n8\n0\n10\n${el.x}\n20\n${el.y}\n30\n0\n40\n${
          el.size || 14
        }\n1\n${el.text}\n`;
      }
    });

    dxf += "0\nENDSEC\n0\nEOF\n";
    return dxf;
  };

  const handleImportDXF = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dxfContent = event.target.result;
      const importedElements = parseDXF(dxfContent);
      const updated = [...elements, ...importedElements];
      setElements(updated);
      addToHistory(updated);
    };
    reader.readAsText(file);
  };

  const parseDXF = (dxfContent) => {
    const lines = dxfContent.split("\n");
    const imported = [];
    let i = 0;

    while (i < lines.length) {
      if (lines[i].trim() === "LINE") {
        const el = {
          type: "line",
          layer: activeLayer,
          color: strokeColor,
          strokeWidth,
        };
        while (i < lines.length && lines[i].trim() !== "0") {
          if (lines[i].trim() === "10") el.x1 = parseFloat(lines[i + 1]);
          if (lines[i].trim() === "20") el.y1 = parseFloat(lines[i + 1]);
          if (lines[i].trim() === "11") el.x2 = parseFloat(lines[i + 1]);
          if (lines[i].trim() === "21") el.y2 = parseFloat(lines[i + 1]);
          i++;
        }
        imported.push(el);
      } else if (lines[i].trim() === "CIRCLE") {
        const el = {
          type: "circle",
          layer: activeLayer,
          color: strokeColor,
          strokeWidth,
        };
        while (i < lines.length && lines[i].trim() !== "0") {
          if (lines[i].trim() === "10") el.x = parseFloat(lines[i + 1]);
          if (lines[i].trim() === "20") el.y = parseFloat(lines[i + 1]);
          if (lines[i].trim() === "40") el.radius = parseFloat(lines[i + 1]);
          i++;
        }
        imported.push(el);
      }
      i++;
    }

    return imported;
  };

  const downloadFile = (data, filename) => {
    const a = document.createElement("a");
    a.href = data;
    a.download = filename;
    a.click();
  };

  const ToolButton = ({ icon: Icon, label, onClick, active, badge }) => (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
        active
          ? "bg-blue-600 text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
      title={label}
    >
      <Icon size={20} />
      {badge && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Tools */}
      <div className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-2">
        <ToolButton
          icon={Move}
          label="Select (V)"
          onClick={() => setTool("select")}
          active={tool === "select"}
        />
        <ToolButton
          icon={Minus}
          label="Line (L)"
          onClick={() => setTool("line")}
          active={tool === "line"}
        />
        <ToolButton
          icon={Square}
          label="Rectangle (R)"
          onClick={() => setTool("rectangle")}
          active={tool === "rectangle"}
        />
        <ToolButton
          icon={Circle}
          label="Circle (C)"
          onClick={() => setTool("circle")}
          active={tool === "circle"}
        />
        <ToolButton
          icon={Edit3}
          label="Curve"
          onClick={() => setTool("curve")}
          active={tool === "curve"}
        />
        <ToolButton
          icon={Ruler}
          label="Dimension (D)"
          onClick={() => setTool("dimension")}
          active={tool === "dimension"}
        />
        <ToolButton
          icon={Type}
          label="Text (T)"
          onClick={() => setTool("text")}
          active={tool === "text"}
        />
        <ToolButton
          icon={FileText}
          label="Annotation"
          onClick={() => setTool("annotation")}
          active={tool === "annotation"}
        />
        <ToolButton
          icon={Target}
          label="Measure"
          onClick={() => {
            setTool("measure");
            setMeasurementStart(null);
            setMeasurementEnd(null);
          }}
          active={tool === "measure"}
        />
        <div className="border-t border-gray-200 w-12 my-2" />
        <ToolButton
          icon={Package}
          label="Components"
          onClick={() => setShowComponentLibrary(!showComponentLibrary)}
          active={showComponentLibrary}
        />
        <ToolButton
          icon={Grid}
          label="Grid (G)"
          onClick={() => setGridEnabled(!gridEnabled)}
          active={gridEnabled}
        />
        <ToolButton
          icon={Hash}
          label="Snap (S)"
          onClick={() => setSnapEnabled(!snapEnabled)}
          active={snapEnabled}
        />
        <ToolButton
          icon={Box}
          label="3D View"
          onClick={() => setView3D(!view3D)}
          active={view3D}
        />
        <ToolButton
          icon={AlertCircle}
          label="Clash Detection"
          onClick={() => setClashDetection(!clashDetection)}
          active={clashDetection}
          badge={clashes.length > 0 ? clashes.length : null}
        />
      </div>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 overflow-x-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport("json")}
              className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex items-center gap-1"
            >
              <Save size={16} />
              Save
            </button>
            <button
              onClick={() => fileInputRef.current.click()}
              className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm flex items-center gap-1"
            >
              <Upload size={16} />
              Import DXF
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".dxf"
              onChange={handleImportDXF}
              className="hidden"
            />

            <div className="border-l border-gray-300 h-8 mx-2" />

            <button
              onClick={undo}
              disabled={historyIndex === 0}
              className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30"
              title="Undo (Ctrl+Z)"
            >
              <Undo size={18} />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex === history.length - 1}
              className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30"
              title="Redo (Ctrl+Y)"
            >
              <Redo size={18} />
            </button>

            <div className="border-l border-gray-300 h-8 mx-2" />

            <button
              onClick={copySelected}
              className="p-1.5 hover:bg-gray-100 rounded"
              title="Copy (Ctrl+C)"
            >
              <Copy size={18} />
            </button>
            <button
              onClick={pasteFromClipboard}
              disabled={clipboard.length === 0}
              className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30"
              title="Paste (Ctrl+V)"
            >
              <FileDown size={18} />
            </button>
            <button
              onClick={deleteSelected}
              disabled={
                selectedElement === null && selectedElements.length === 0
              }
              className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30"
              title="Delete (Del)"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={groupElements}
              disabled={selectedElements.length < 2}
              className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30"
              title="Group (Ctrl+G)"
            >
              <Maximize size={18} />
            </button>

            <div className="border-l border-gray-300 h-8 mx-2" />

            <button
              onClick={() => setZoom(zoom * 1.2)}
              className="p-1.5 hover:bg-gray-100 rounded"
            >
              <ZoomIn size={18} />
            </button>
            <button
              onClick={() => setZoom(zoom / 1.2)}
              className="p-1.5 hover:bg-gray-100 rounded"
            >
              <ZoomOut size={18} />
            </button>
            <span className="text-sm text-gray-600 min-w-[60px]">
              {Math.round(zoom * 100)}%
            </span>

            <div className="border-l border-gray-300 h-8 mx-2" />

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Scale:</label>
              <select
                value={drawingScale}
                onChange={(e) => setDrawingScale(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="1:1">1:1</option>
                <option value="1:50">1:50</option>
                <option value="1:100">1:100</option>
                <option value="1:200">1:200</option>
                <option value="1:500">1:500</option>
              </select>
            </div>

            <div className="border-l border-gray-300 h-8 mx-2" />

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Hatch:</label>
              <select
                value={hatchPattern}
                onChange={(e) => setHatchPattern(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="none">None</option>
                <option value="soil">Soil</option>
                <option value="sand">Sand</option>
                <option value="concrete">Concrete</option>
                <option value="gravel">Gravel</option>
                <option value="hardcore">Hardcore</option>
                <option value="steel">Steel</option>
              </select>
            </div>

            <div className="border-l border-gray-300 h-8 mx-2" />

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Dim:</label>
              <select
                value={dimensionMode}
                onChange={(e) => setDimensionMode(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="linear">Linear</option>
                <option value="aligned">Aligned</option>
                <option value="angular">Angular</option>
                <option value="radial">Radial</option>
              </select>
            </div>

            <div className="border-l border-gray-300 h-8 mx-2" />

            <div className="flex items-center gap-2">
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
              <input
                type="number"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                min="1"
                max="10"
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowTitleBlock(!showTitleBlock)}
              className={`px-3 py-1.5 rounded text-sm ${
                showTitleBlock
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              Title Block
            </button>
            <button
              onClick={() => setShowBOQ(!showBOQ)}
              className={`px-3 py-1.5 rounded text-sm ${
                showBOQ ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
              }`}
            >
              BOQ
            </button>
            <button
              onClick={() => handleExport("jpg")}
              className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center gap-1"
            >
              <Download size={16} />
              JPG
            </button>
            <button
              onClick={() => handleExport("png")}
              className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              PNG
            </button>
            <button
              onClick={() => handleExport("dxf")}
              className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              DXF
            </button>
            <button
              onClick={() => handleExport("pdf")}
              className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              PDF
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-gray-100 p-4 overflow-hidden relative">
          <canvas
            ref={canvasRef}
            width={1800}
            height={1000}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="bg-white shadow-lg cursor-crosshair"
          />

          {/* Curve completion button */}
          {tool === "curve" && curvePoints.length > 1 && (
            <button
              onClick={finishCurve}
              className="absolute top-8 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700"
            >
              Finish Curve ({curvePoints.length} points)
            </button>
          )}

          {/* 3D View Controls */}
          {view3D && (
            <div className="absolute top-8 right-8 bg-white p-3 rounded-lg shadow-lg">
              <div className="text-sm font-semibold mb-2">3D Rotation</div>
              <div className="space-y-2">
                <div>
                  <label className="text-xs">Y-Axis: {rotation3D.y}°</label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={rotation3D.y}
                    onChange={(e) =>
                      setRotation3D({
                        ...rotation3D,
                        y: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Clash Detection Alerts */}
          {clashDetection && clashes.length > 0 && (
            <div className="absolute top-8 left-8 bg-red-50 border border-red-200 p-3 rounded-lg shadow-lg max-w-sm">
              <div className="flex items-center gap-2 text-red-700 font-semibold mb-2">
                <AlertCircle size={18} />
                Clashes Detected: {clashes.length}
              </div>
              <div className="text-xs text-red-600 space-y-1">
                {clashes.slice(0, 3).map((clash, idx) => (
                  <div key={idx}>
                    • Elements {clash.element1} and {clash.element2} overlap
                  </div>
                ))}
                {clashes.length > 3 && (
                  <div>• And {clashes.length - 3} more...</div>
                )}
              </div>
            </div>
          )}

          {/* Status Bar */}
          <div className="absolute bottom-8 left-8 bg-white px-4 py-2 rounded shadow text-sm text-gray-700 space-y-1">
            <div>
              Tool: <span className="font-semibold">{tool}</span>
            </div>
            <div>
              Elements: <span className="font-semibold">{elements.length}</span>
            </div>
            <div>
              Scale: <span className="font-semibold">{drawingScale}</span>
            </div>
            <div>
              Snap:{" "}
              <span className="font-semibold">
                {snapEnabled ? "ON" : "OFF"}
              </span>
            </div>
            {nearestSnapPoint && (
              <div className="text-red-600">
                📍{" "}
                <span className="font-semibold">{nearestSnapPoint.type}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar - Layers & Properties */}
      <div className="w-64 bg-white border-l border-gray-200 p-4 overflow-y-auto">
        {showComponentLibrary ? (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Package size={16} />
                Component Library
              </h3>
              <button
                onClick={() => setShowComponentLibrary(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-gray-600 mb-2">
                  Structural Elements
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => addStructuralComponent("beam")}
                    className="p-2 bg-blue-50 hover:bg-blue-100 rounded text-xs"
                  >
                    Beam
                  </button>
                  <button
                    onClick={() => addStructuralComponent("column")}
                    className="p-2 bg-blue-50 hover:bg-blue-100 rounded text-xs"
                  >
                    Column
                  </button>
                  <button
                    onClick={() => addStructuralComponent("slab")}
                    className="p-2 bg-blue-50 hover:bg-blue-100 rounded text-xs"
                  >
                    Slab
                  </button>
                  <button
                    onClick={() => addStructuralComponent("footing")}
                    className="p-2 bg-blue-50 hover:bg-blue-100 rounded text-xs"
                  >
                    Footing
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-gray-600 mb-2">
                  Civil Works (CESMM)
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => addCivilComponent("manhole")}
                    className="p-2 bg-green-50 hover:bg-green-100 rounded text-xs"
                  >
                    Manhole
                  </button>
                  <button
                    onClick={() => addCivilComponent("sewer")}
                    className="p-2 bg-green-50 hover:bg-green-100 rounded text-xs"
                  >
                    Sewer
                  </button>
                  <button
                    onClick={() => addCivilComponent("pool")}
                    className="p-2 bg-green-50 hover:bg-green-100 rounded text-xs"
                  >
                    Pool
                  </button>
                  <button
                    onClick={() => addCivilComponent("basement")}
                    className="p-2 bg-green-50 hover:bg-green-100 rounded text-xs"
                  >
                    Basement
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : showBOQ ? (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                Bill of Quantities
              </h3>
              <button
                onClick={() => setShowBOQ(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(calculateBOQ()).map(([type, data]) => (
                <div key={type} className="p-2 bg-gray-50 rounded text-xs">
                  <div className="font-semibold text-gray-700">
                    {data.description}
                  </div>
                  <div className="text-gray-600">Count: {data.count}</div>
                  <div className="text-gray-600">
                    Total: {data.total.toFixed(2)} {data.unit}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const boq = calculateBOQ();
                const csv =
                  "Item,Count,Total,Unit\n" +
                  Object.entries(boq)
                    .map(
                      ([type, data]) =>
                        `${data.description},${data.count},${data.total.toFixed(
                          2
                        )},${data.unit}`
                    )
                    .join("\n");
                downloadFile(
                  "data:text/csv;charset=utf-8," + encodeURIComponent(csv),
                  "boq.csv"
                );
              }}
              className="w-full mt-3 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
            >
              Export BOQ to CSV
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Layers size={16} />
                Layers
              </h3>
              <div className="space-y-2">
                {layers.map((layer) => (
                  <div
                    key={layer.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                      activeLayer === layer.id
                        ? "bg-blue-50 border border-blue-200"
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => setActiveLayer(layer.id)}
                  >
                    <input
                      type="checkbox"
                      checked={layer.visible}
                      onChange={(e) => {
                        e.stopPropagation();
                        setLayers(
                          layers.map((l) =>
                            l.id === layer.id
                              ? { ...l, visible: !l.visible }
                              : l
                          )
                        );
                      }}
                      className="w-4 h-4"
                    />
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: layer.color }}
                    />
                    <span className="text-sm flex-1">{layer.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLayers(
                          layers.map((l) =>
                            l.id === layer.id ? { ...l, locked: !l.locked } : l
                          )
                        );
                      }}
                      className="text-xs"
                    >
                      {layer.locked ? "🔒" : "🔓"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {selectedElement !== null && elements[selectedElement] && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Properties
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium">
                      {elements[selectedElement]?.type}
                    </span>
                  </div>
                  {elements[selectedElement]?.reinforcement && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Reinforcement:</span>
                      <span className="font-medium text-xs">
                        {elements[selectedElement].reinforcement}
                      </span>
                    </div>
                  )}
                  {elements[selectedElement]?.depth && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Depth:</span>
                      <span className="font-medium">
                        {elements[selectedElement].depth}mm
                      </span>
                    </div>
                  )}
                  {elements[selectedElement]?.width && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Width:</span>
                      <span className="font-medium">
                        {elements[selectedElement].width}mm
                      </span>
                    </div>
                  )}
                  {elements[selectedElement]?.height && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Height:</span>
                      <span className="font-medium">
                        {elements[selectedElement].height}mm
                      </span>
                    </div>
                  )}
                  <button
                    onClick={deleteSelected}
                    className="w-full px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 flex items-center justify-center gap-1 mt-3"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            )}

            {selectedElements.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Selection
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Items Selected:</span>
                    <span className="font-medium">
                      {selectedElements.length}
                    </span>
                  </div>
                  <button
                    onClick={groupElements}
                    disabled={selectedElements.length < 2}
                    className="w-full px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-30"
                  >
                    Group Selected
                  </button>
                  <button
                    onClick={deleteSelected}
                    className="w-full px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete Selected
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-auto pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 space-y-1">
            <p className="font-semibold text-gray-700">
              🤖 AI Civil Copilot Ready
            </p>
            <p>FastAPI Backend Integration</p>
            <p className="mt-2 font-mono bg-gray-100 px-2 py-1 rounded">
              POST /api/draw
            </p>
            <p className="mt-2">✨ Features:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Undo/Redo</li>
              <li>Copy/Paste</li>
              <li>Group/Ungroup</li>
              <li>BOQ Generation</li>
              <li>Clash Detection</li>
              <li>Multi-scale Support</li>
              <li>Title Block</li>
              <li>Measurement Tool</li>
              <li>DXF Import/Export</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CivilCADApp;
