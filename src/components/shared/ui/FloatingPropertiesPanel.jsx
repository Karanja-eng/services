import React, {
  useState, useRef, useEffect, useCallback
} from 'react';

const DOCK_THRESHOLD = 72;
const IDLE_DIM_MS    = 4000;
const TOOLBAR_H      = 56;

function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

/**
 * FloatingPropertiesPanel
 *
 * Props:
 *  - title        {string}
 *  - icon         {string}
 *  - accentColor  {string}  Tailwind bg class
 *  - width        {number}
 *  - children     {ReactNode}
 *  - storageKey   {string}
 */
export default function FloatingPropertiesPanel({
  title = 'Properties',
  icon = '⚙',
  accentColor = 'bg-slate-700',
  width = 280,
  children,
  storageKey,
}) {
  const key = storageKey || `fpp_${title}`;

  const getSaved = () => {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  };
  const saved = getSaved();

  const [pos, setPos]       = useState(saved?.pos || { x: window.innerWidth - width - 12, y: TOOLBAR_H + 12 });
  const [docked, setDocked] = useState(saved?.docked ?? 'right');
  const [collapsed, setCollapsed] = useState(saved?.collapsed ?? false);
  const [opacity, setOpacity]     = useState(0.88);
  const [hovered, setHovered]     = useState(false);

  const dragging   = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const idleTimer  = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify({ pos, docked, collapsed })); }
    catch {}
  }, [pos, docked, collapsed, key]);

  const resetIdle = useCallback(() => {
    clearTimeout(idleTimer.current);
    setOpacity(1);
    idleTimer.current = setTimeout(() => {
      if (!hovered) setOpacity(0.88);
    }, IDLE_DIM_MS);
  }, [hovered]);

  useEffect(() => { resetIdle(); return () => clearTimeout(idleTimer.current); }, []);

  const onHeaderMouseDown = (e) => {
    if (docked) return;
    e.preventDefault();
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    setPos({
      x: clamp(e.clientX - dragOffset.current.x, 0, window.innerWidth - width),
      y: clamp(e.clientY - dragOffset.current.y, TOOLBAR_H, window.innerHeight - 80),
    });
    setOpacity(1);
  }, [width]);

  const onMouseUp = useCallback((e) => {
    if (!dragging.current) return;
    dragging.current = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    const x = e.clientX - dragOffset.current.x;
    if (x < DOCK_THRESHOLD) { setDocked('left'); setCollapsed(false); }
    else if (x > window.innerWidth - width - DOCK_THRESHOLD) { setDocked('right'); setCollapsed(false); }
    else setDocked(null);
    resetIdle();
  }, [onMouseMove, width, resetIdle]);

  const dockedStyle = docked
    ? { position: 'fixed', top: TOOLBAR_H, [docked]: 0, bottom: 0, width: collapsed ? 44 : width, zIndex: 50 }
    : { position: 'fixed', left: pos.x, top: pos.y, width: collapsed ? 44 : width, zIndex: 50 };

  return (
    <div
      style={{
        ...dockedStyle,
        opacity: hovered ? 1 : opacity,
        transition: 'opacity 300ms ease, width 220ms cubic-bezier(0.4,0,0.2,1)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      onMouseEnter={() => { setHovered(true); setOpacity(1); }}
      onMouseLeave={() => { setHovered(false); resetIdle(); }}
      onMouseMove={resetIdle}
      onClick={resetIdle}
    >
      <div
        className="h-full flex flex-col rounded-xl shadow-2xl border border-white/10 overflow-hidden bg-gray-900/90 text-white"
        style={{ height: docked ? '100%' : 'auto', maxHeight: docked ? '100%' : 'calc(100vh - 120px)' }}
      >
        {/* Header */}
        <div
          className={`flex items-center gap-2 px-3 py-2.5 shrink-0 select-none
            ${docked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}
            ${accentColor} rounded-t-xl`}
          onMouseDown={onHeaderMouseDown}
        >
          <span className="text-sm font-black text-white/90 w-5 text-center">{icon}</span>
          {!collapsed && (
            <span className="flex-1 text-[11px] font-bold tracking-wider uppercase truncate text-white/90">
              {title}
            </span>
          )}
          {!collapsed && docked && (
            <button onClick={(e) => { e.stopPropagation(); setDocked(null); }} className="text-white/60 hover:text-white text-[10px] px-1">⊠</button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setCollapsed(c => !c); }}
            className="text-white/60 hover:text-white text-xs"
          >
            {collapsed ? (docked === 'left' ? '▶' : '◀') : (docked === 'left' ? '◀' : '▶')}
          </button>
        </div>

        {collapsed && (
          <div className="flex flex-col items-center gap-3 py-3 flex-1">
            <button onClick={() => setCollapsed(false)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-xs flex items-center justify-center">{icon}</button>
          </div>
        )}

        {!collapsed && (
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
