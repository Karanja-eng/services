import { useStore } from './useStore';

export function StatusBar() {
  const { elements, selectedIds, gridVisible, toggleGrid, showMarkings, toggleMarkings, showTrees, toggleTrees } = useStore();

  const counts = elements.reduce((acc, el) => {
    acc[el.type] = (acc[el.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <footer className="flex items-center justify-between px-4 py-1 bg-[#0d1220] border-t border-[#1e2840] font-mono text-[10px]">
      {/* Left: element counts */}
      <div className="flex items-center gap-3 text-[#3a5a7a]">
        <span className="text-[#4a6fa5]">Elements:</span>
        {Object.entries(counts).map(([type, count]) => (
          <span key={type}>
            <span className="text-[#00d4ff]">{count}</span>
            <span className="text-[#2a4060] ml-0.5">{type}</span>
          </span>
        ))}
        {elements.length === 0 && <span className="text-[#2a3a50]">none</span>}
      </div>

      {/* Centre: selection info */}
      <div className="text-[#3a5a7a]">
        {selectedIds.length > 0
          ? <span><span className="text-[#00ff88]">{selectedIds.length}</span> selected</span>
          : <span className="text-[#2a3a50]">No selection</span>
        }
      </div>

      {/* Right: toggles */}
      <div className="flex items-center gap-2">
        <ToggleBtn label="Grid" active={gridVisible} onClick={toggleGrid} />
        <ToggleBtn label="Markings" active={showMarkings} onClick={toggleMarkings} />
        <ToggleBtn label="Trees" active={showTrees} onClick={toggleTrees} />
        <span className="text-[#2a3a50] ml-2">SiteCraft v2.0</span>
      </div>
    </footer>
  );
}

function ToggleBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-wider transition-all ${
        active
          ? 'text-[#00d4ff] border border-[#00d4ff33] bg-[#00d4ff0a]'
          : 'text-[#2a4060] border border-[#1e2840] hover:text-[#4a6fa5]'
      }`}
    >
      {label}
    </button>
  );
}