import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import {
  placeSiteElement,
  generateParkingLayout,
  generateTerrain,
  plantTrees,
} from '../../utils/agentInterface';

const EXAMPLE_COMMANDS = [
  'Place a 7m wide asphalt road from [0,0] to [50,0] to [50,30]',
  'Generate a 40×15m parking lot with 90° bays at origin [10,10]',
  'Plant 20 deciduous trees in a grid pattern across the site',
  'Create terrain with gentle rolling hills over 100×100m area',
  'Add a footpath 1.8m wide from [0,0] to [30,20] with slab paving',
  'Place a roundabout at [25,25] with 12m outer radius',
  'Plant avenue of conifers along the site boundary',
];

export function AICommandPanel() {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { agentLog, pushAgentLog } = useStore();
  const logRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [agentLog]);

  const handleCommand = async () => {
    const cmd = input.trim();
    if (!cmd) return;
    setInput('');
    setIsProcessing(true);
    pushAgentLog(`> ${cmd}`);

    try {
      await processNaturalLanguageCommand(cmd);
    } catch (err) {
      pushAgentLog(`✗ Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommand();
    }
  };

  return (
    <div className="border-t border-[#2a3144] flex flex-col" style={{ height: '260px' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2a3144]">
        <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-[#ffaa00] animate-pulse' : 'bg-[#00ff88]'}`} />
        <span className="text-[10px] font-bold text-[#a0b4d0] uppercase tracking-widest font-mono">
          AI Agent
        </span>
      </div>

      {/* Log */}
      <div
        ref={logRef}
        className="flex-1 overflow-y-auto px-2 py-1 font-mono text-[10px] space-y-0.5"
      >
        {agentLog.length === 0 && (
          <div className="text-[#2a3a55] italic py-2 text-center">
            Type a command or ask AI to place site elements…
          </div>
        )}
        {agentLog.map((msg, i) => (
          <div
            key={i}
            className={`leading-relaxed ${
              msg.startsWith('>')
                ? 'text-[#6080a0]'
                : msg.startsWith('✓')
                ? 'text-[#00ff88]'
                : msg.startsWith('✗')
                ? 'text-[#ff6060]'
                : 'text-[#a0b4d0]'
            }`}
          >
            {msg}
          </div>
        ))}
        {isProcessing && (
          <div className="text-[#ffaa00] animate-pulse">⟳ Processing…</div>
        )}
      </div>

      {/* Example chips */}
      <div className="px-2 pb-1 flex gap-1 overflow-x-auto">
        {EXAMPLE_COMMANDS.slice(0, 3).map((ex, i) => (
          <button
            key={i}
            onClick={() => setInput(ex)}
            className="text-[9px] font-mono text-[#3a5a7a] border border-[#2a3144]
              rounded px-1.5 py-0.5 whitespace-nowrap hover:border-[#00d4ff] hover:text-[#00d4ff]
              transition-all flex-shrink-0"
          >
            eg{i + 1}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-2 pb-2 flex gap-1">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type command… (Enter to run)"
          rows={2}
          className="flex-1 bg-[#0d1420] border border-[#2a3144] rounded px-2 py-1
            text-[10px] text-[#a0c4e0] font-mono resize-none
            focus:outline-none focus:border-[#00d4ff] placeholder-[#2a3a55] transition-colors"
        />
        <button
          onClick={handleCommand}
          disabled={isProcessing || !input.trim()}
          className="w-8 flex items-center justify-center bg-[#00d4ff] text-[#0d1420]
            rounded font-bold text-sm disabled:opacity-30 hover:bg-[#00bbee] transition-all"
        >
          ▶
        </button>
      </div>
    </div>
  );
}

// ── Natural Language Command Parser ───────────────────────────────────────
// Parses user text into structured agent calls.

async function processNaturalLanguageCommand(text) {
  const lower = text.toLowerCase();

  // ── Terrain ──
  if (lower.includes('terrain') || lower.includes('hill') || lower.includes('elevation')) {
    const sizeMatch = text.match(/(\d+)\s*[×x]\s*(\d+)/);
    const w = sizeMatch ? parseInt(sizeMatch[1]) : 100;
    const d = sizeMatch ? parseInt(sizeMatch[2]) : 100;
    generateTerrain({ bounds: { width: w, depth: d } });
    return;
  }

  // ── Parking ──
  if (lower.includes('parking') || lower.includes('car park')) {
    const sizeMatch = text.match(/(\d+)\s*[×x]\s*(\d+)/);
    const originMatch = text.match(/\[(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\]/g);
    const angleMatch = text.match(/(\d+)°/);
    const origin = originMatch ? parseCoords(originMatch[0]) : [0, 0];
    const w = sizeMatch ? parseInt(sizeMatch[1]) : 40;
    const d = sizeMatch ? parseInt(sizeMatch[2]) : 15;
    generateParkingLayout({
      area: { x: origin[0], z: origin[1], width: w, depth: d },
      bayAngle: angleMatch ? parseInt(angleMatch[1]) : 90,
    });
    return;
  }

  // ── Trees ──
  if (lower.includes('tree') || lower.includes('plant') || lower.includes('shrub')) {
    const species = lower.includes('conifer') ? 'conifer'
      : lower.includes('palm') ? 'palm'
      : lower.includes('shrub') ? 'shrub'
      : 'deciduous';
    const pattern = lower.includes('avenue') ? 'avenue'
      : lower.includes('random') ? 'random'
      : 'grid';
    const spacingMatch = text.match(/(\d+(?:\.\d+)?)\s*m\s*spac/i);
    const spacing = spacingMatch ? parseFloat(spacingMatch[1]) : 8;
    const boundary = [[-40, -30], [40, -30], [40, 30], [-40, 30]];
    plantTrees({ boundary, species, spacing, pattern });
    return;
  }

  // ── Road / Path / Driveway ──
  const isPath = lower.includes('footpath') || lower.includes('path') || lower.includes('pedestrian');
  const isDriveway = lower.includes('driveway') || lower.includes('drive');
  const isRoundabout = lower.includes('roundabout') || lower.includes('traffic circle');

  const type = isRoundabout ? 'road' : isPath ? 'path' : isDriveway ? 'driveway' : 'road';
  const subType = isRoundabout ? 'roundabout' : lower.includes('curved') ? 'curved' : 'straight';

  const coords = [...text.matchAll(/\[(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\]/g)]
    .map(m => [parseFloat(m[1]), parseFloat(m[2])]);

  const widthMatch = text.match(/(\d+(?:\.\d+)?)\s*m\s*wide/i);
  const width = widthMatch ? parseFloat(widthMatch[1]) : isPath ? 1.8 : isDriveway ? 3.2 : 7;

  const material = lower.includes('concrete') ? 'concrete'
    : lower.includes('block') || lower.includes('brick') ? 'block_paving'
    : lower.includes('gravel') ? 'gravel'
    : lower.includes('slab') ? 'paving'
    : isPath ? 'paving' : isDriveway ? 'block_paving' : 'asphalt';

  const markings = isPath ? [] : isDriveway ? [] : ['centre', 'edge'];

  if (isRoundabout) {
    const origin = coords[0] || [0, 0];
    const outerR = width / 2 + 3;
    placeSiteElement({
      elementType: 'road',
      subType: 'roundabout',
      path: [origin],
      origin,
      width: outerR * 2,
      material,
      markings: ['centre'],
      kerb: 'upstand',
      verge: 0,
    });
    return;
  }

  if (coords.length < 2) {
    // Generate a default demo path
    const demoPath = [[0, 0], [20, 0], [20, 15]];
    placeSiteElement({ elementType: type, subType, path: demoPath, width, material, markings, kerb: 'upstand', verge: 0.5 });
    useStore.getState().pushAgentLog('  ℹ No coords found — placed demo path. Specify [x,z] points.');
    return;
  }

  placeSiteElement({ elementType: type, subType, path: coords, width, material, markings, kerb: 'upstand', verge: isPath ? 0 : 0.5 });
}

function parseCoords(str) {
  const m = str.match(/\[(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\]/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : [0, 0];
}