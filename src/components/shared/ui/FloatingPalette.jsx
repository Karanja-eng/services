import React, {
  useState, useRef, useEffect, useCallback, useId
} from 'react';

// ─── Constants ────────────────────────────────────────────
const DOCK_THRESHOLD = 72;   // px from edge to snap
const IDLE_DIM_MS    = 4000; // ms before dimming
const IDLE_COLLAPSE_MS = 9000; // ms before auto-collapse (floating only)
const TOOLBAR_H      = 56;   // height of app top-bar in px

// ─── Utility ──────────────────────────────────────────────
function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

/**
 * FloatingPalette
 *
 * Props:
 *  - title        {string}   Header title
 *  - icon         {string}   Short icon letter / emoji
 *  - accentColor  {string}   Tailwind bg class e.g. 'bg-blue-600'
 *  - defaultSide  {'left'|'right'|null}  Initial dock state
 *  - width        {number}   Palette width in px (default 256)
 *  - children     {ReactNode} Palette body content
 *  - storageKey   {string}   localStorage key to persist position
 */
export default function FloatingPalette({
  title = 'Palette',
  icon = '☰',
  accentColor = 'bg-blue-600',
  defaultSide = 'left',
  width = 258,
  children,
  storageKey,
}) {
  const uid = useId();
  const key = storageKey || `fp_${title}`;

  // ── Persisted initial state ──────────────────────────────
  const getSaved = () => {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  };
  const saved = getSaved();

  const [pos, setPos] = useState(saved?.pos || { x: defaultSide === 'right' ? window.innerWidth - width - 12 : 12, y: TOOLBAR_H + 12 });
  const [docked, setDocked] = useState(saved?.docked ?? defaultSide); // 'left' | 'right' | null
  const [collapsed, setCollapsed] = useState(saved?.collapsed ?? false);
  const [opacity, setOpacity] = useState(0.88);
  const [hovered, setHovered] = useState(false);

  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const idleTimer = useRef(null);
  const collapseTimer = useRef(null);
  const panelRef = useRef(null);

  // ── Persist state ────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify({ pos, docked, collapsed })); }
    catch {}
  }, [pos, docked, collapsed, key]);

  // ── Idle / transparency logic ─────────────────────────────
  const resetIdle = useCallback(() => {
    clearTimeout(idleTimer.current);
    clearTimeout(collapseTimer.current);
    setOpacity(1);
    idleTimer.current = setTimeout(() => {
      if (!hovered) setOpacity(0.88);
      collapseTimer.current = setTimeout(() => {
        if (!docked && !hovered) setCollapsed(true);
      }, IDLE_COLLAPSE_MS - IDLE_DIM_MS);
    }, IDLE_DIM_MS);
  }, [hovered, docked]);

  useEffect(() => {
    resetIdle();
    return () => { clearTimeout(idleTimer.current); clearTimeout(collapseTimer.current); };
  }, []);

  const handleActivity = () => resetIdle();

  // ── Drag logic ────────────────────────────────────────────
  const onHeaderMouseDown = (e) => {
    if (docked) return;               // docked panels aren't freely dragged
    e.preventDefault();
    dragging.current = true;
    dragOffset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    const nx = clamp(e.clientX - dragOffset.current.x, 0, window.innerWidth - width);
    const ny = clamp(e.clientY - dragOffset.current.y, TOOLBAR_H, window.innerHeight - 80);
    setPos({ x: nx, y: ny });
    setOpacity(1);
  }, [width]);

  const onMouseUp = useCallback((e) => {
    if (!dragging.current) return;
    dragging.current = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    const x = e.clientX - dragOffset.current.x;
    // ── Dock snapping ──────────────────────────────────────
    if (x < DOCK_THRESHOLD) {
      setDocked('left');
      setCollapsed(false);
    } else if (x > window.innerWidth - width - DOCK_THRESHOLD) {
      setDocked('right');
      setCollapsed(false);
    } else {
      setDocked(null);
    }
    resetIdle();
  }, [onMouseMove, width, resetIdle]);

  // ── Docked layout helper ──────────────────────────────────
  const dockedStyle = docked
    ? {
        position: 'fixed',
        top: TOOLBAR_H,
        [docked]: 0,
        bottom: 0,
        width: collapsed ? 44 : width,
        zIndex: 50,
        transition: 'width 220ms cubic-bezier(0.4,0,0.2,1)',
      }
    : {
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: collapsed ? 44 : width,
        zIndex: 50,
        transition: 'width 220ms cubic-bezier(0.4,0,0.2,1)',
      };

  // ── Render ────────────────────────────────────────────────
  return (
    <div
      ref={panelRef}
      style={{
        ...dockedStyle,
        opacity: hovered ? 1 : opacity,
        transition: `opacity 300ms ease, width 220ms cubic-bezier(0.4,0,0.2,1)`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      onMouseEnter={() => { setHovered(true); setOpacity(1); resetIdle(); }}
      onMouseLeave={() => { setHovered(false); resetIdle(); }}
      onMouseMove={handleActivity}
      onClick={handleActivity}
    >
      {/* ── Shell ─────────────────────────────────────────── */}
      <div
        className={`h-full flex flex-col rounded-xl shadow-2xl border border-white/10 overflow-hidden
          bg-gray-900/90 text-white`}
        style={{ height: docked ? '100%' : 'auto', maxHeight: docked ? '100%' : 'calc(100vh - 120px)' }}
      >
        {/* ── Header / drag handle ──────────────────────────── */}
        <div
          className={`flex items-center gap-2 px-3 py-2.5 shrink-0 select-none
            ${docked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}
            ${accentColor} rounded-t-xl`}
          onMouseDown={onHeaderMouseDown}
        >
          {/* Icon (always visible even when collapsed) */}
          <span className="text-sm font-black text-white/90 w-5 text-center">{icon}</span>

          {/* Title — hidden when collapsed */}
          {!collapsed && (
            <span className="flex-1 text-[11px] font-bold tracking-wider uppercase truncate text-white/90">
              {title}
            </span>
          )}

          {/* Dock indicators */}
          {!collapsed && docked && (
            <button
              title="Undock"
              onClick={(e) => { e.stopPropagation(); setDocked(null); }}
              className="ml-auto text-white/60 hover:text-white text-[10px] leading-none px-1"
            >
              ⊠
            </button>
          )}

          {/* Collapse toggle */}
          <button
            title={collapsed ? 'Expand' : 'Collapse'}
            onClick={(e) => { e.stopPropagation(); setCollapsed(c => !c); }}
            className="text-white/60 hover:text-white transition-colors"
            style={{ fontSize: 12 }}
          >
            {collapsed
              ? (docked === 'right' ? '◀' : '▶')
              : (docked === 'right' ? '▶' : '◀')}
          </button>
        </div>

        {/* ── Docked-collapsed: icon strip ─────────────────── */}
        {collapsed && (
          <div className="flex flex-col items-center gap-3 py-3 flex-1 overflow-hidden">
            <button
              onClick={() => setCollapsed(false)}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white text-xs transition-colors"
              title={title}
            >
              {icon}
            </button>
          </div>
        )}

        {/* ── Body content ─────────────────────────────────── */}
        {!collapsed && (
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0
            scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
