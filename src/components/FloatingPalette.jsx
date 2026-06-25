import React, { useState, useEffect, useRef } from "react";
import Draggable from "react-draggable";
import { X } from "lucide-react";

/**
 * FloatingPalette – a draggable side-panel that floats above the canvas.
 * Stays exactly where dropped (no snapping). No transparency effects.
 *
 * Props:
 *  - title    (string)      : Header label.
 *  - children (ReactNode)   : Panel body content.
 *  - onClose  (fn)          : Called when X is clicked.
 *  - width    (number|string): Explicit panel width in px, e.g. 300. Defaults to 240.
 */
export default function FloatingPalette({ title = "Tools", children, onClose, width = 240 }) {
  const positionKey = `palettePos_${title.replace(/\s+/g, "_")}`;

  const [position, setPosition] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(positionKey));
      if (saved && typeof saved.x === "number" && typeof saved.y === "number") return saved;
    } catch {}
    return { x: 20, y: 80 };
  });

  const paletteRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(positionKey, JSON.stringify(position));
  }, [position, positionKey]);

  const panelWidth = typeof width === "number" ? `${width}px` : width;

  return (
    <Draggable
      nodeRef={paletteRef}
      handle=".fp-drag-handle"
      position={position}
      onDrag={(e, data) => setPosition({ x: data.x, y: data.y })}
    >
      <div
        ref={paletteRef}
        style={{
          position: "absolute",
          width: panelWidth,
          zIndex: 9999,
          boxShadow: "0 8px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.4)",
          borderRadius: "8px",
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.10)",
          left: position.x,
          top: position.y,
        }}
      >
        {/* ── Drag Handle Header ── */}
        <div
          className="fp-drag-handle"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            background: "linear-gradient(135deg, #1a2035 0%, #0f1628 100%)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            cursor: "grab",
            userSelect: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: "#4a9eff", boxShadow: "0 0 6px #4a9eff88",
            }} />
            <span style={{
              fontSize: "11px", fontWeight: "700", color: "#a0b8d8",
              letterSpacing: "0.08em", textTransform: "uppercase",
              fontFamily: "monospace",
            }}>
              {title}
            </span>
          </div>
          <button
            onClick={onClose}
            title="Close palette"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#4a6080",
              display: "flex",
              alignItems: "center",
              padding: "2px",
              borderRadius: "4px",
              transition: "color 0.15s, background 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "#ff6b6b"; e.currentTarget.style.background = "rgba(255,107,107,0.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#4a6080"; e.currentTarget.style.background = "transparent"; }}
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{
          background: "#0f1628",
          maxHeight: "82vh",
          overflowY: "auto",
          overflowX: "hidden",
        }}>
          {children}
        </div>
      </div>
    </Draggable>
  );
}

