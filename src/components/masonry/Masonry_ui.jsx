import { useState, useCallback } from "react";
import { Layout, Eye, Maximize2, Grid, RefreshCw, Play } from "lucide-react";
import axios from "axios";
import MasonryVisualisation from "./masonry_visualiser";

const API = "http://localhost:8001";

// ─── Data ────────────────────────────────────────────────────────────────────

const MORTARS = [
    { value: "i", label: "(i)  — M12  (1:3 cement:sand)" },
    { value: "ii", label: "(ii) — M6   (1:½:4 cement:lime:sand)" },
    { value: "iii", label: "(iii)— M4   (1:1:6 cement:lime:sand)" },
    { value: "iv", label: "(iv) — M2   (1:2:9 cement:lime:sand)" },
];

const UNIT_TYPES = [
    { value: "clay", label: "Clay Bricks" },
    { value: "calcium_silicate", label: "Calcium Silicate Bricks" },
    { value: "concrete_block", label: "Concrete Blocks" },
];

const WATER_ABSORPTIONS = [
    { value: "lt7", label: "< 7%   (low absorption)" },
    { value: "7to12", label: "7–12% (medium absorption)" },
    { value: "gt12", label: "> 12%  (high absorption)" },
];

const PANEL_TYPES = [
    { value: "A", label: "Type A — Simply supported all edges" },
    { value: "C", label: "Type C — One vertical edge free" },
    { value: "E", label: "Type E — Top edge free" },
];

const ECCENTRICITIES = [
    { value: "0.05", label: "0.05t — Axially loaded / small ecc." },
    { value: "0.1", label: "0.1t  — Small eccentricity" },
    { value: "0.2", label: "0.2t  — Moderate eccentricity" },
    { value: "0.3", label: "0.3t  — Large eccentricity" },
];

// ─── Shared primitives ───────────────────────────────────────────────────────

function Label({ children, isDark }) {
    return (
        <span className={`text-[10px] font-mono tracking-widest uppercase mb-1 block ${isDark ? "text-slate-500" : "text-gray-500"}`}>
            {children}
        </span>
    );
}


function Input({ label, unit, isDark, ...props }) {
    return (
        <div className="flex flex-col">
            <Label isDark={isDark}>{label}{unit && ` (${unit})`}</Label>
            <input {...props}
                className={`w-full bg-transparent border rounded px-3 py-1.5 text-xs font-mono transition-colors outline-none
          ${isDark
                        ? "border-slate-800 text-slate-100 focus:border-amber-500"
                        : "border-gray-200 text-gray-900 focus:border-blue-500 bg-white"}`}
            />
        </div>
    );
}

function Select({ label, options, isDark, ...props }) {
    return (
        <div className="flex flex-col">
            <Label isDark={isDark}>{label}</Label>
            <select
                className={`border rounded px-2.5 py-1.5 text-sm font-mono transition-colors focus:outline-none
          ${isDark
                        ? "bg-slate-900 border-slate-700 text-slate-100 focus:border-amber-500"
                        : "bg-white border-gray-200 text-gray-900 focus:border-blue-500"}`}
                {...props}
            >
                {options.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </div>
    );
}

function Toggle({ label, checked, onChange, isDark }) {
    return (
        <label className="flex items-center gap-2 cursor-pointer group py-1">
            <div onClick={onChange}
                className={`w-8 h-4 rounded-full relative transition-colors border
          ${checked
                        ? (isDark ? "bg-amber-500/20 border-amber-500" : "bg-blue-500/20 border-blue-500")
                        : (isDark ? "bg-slate-900 border-slate-800" : "bg-gray-100 border-gray-200")}`}>
                <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all
          ${checked
                        ? `left-4.5 ${isDark ? "bg-amber-500" : "bg-blue-500"}`
                        : `left-0.5 ${isDark ? "bg-slate-700" : "bg-gray-400"}`}
        `} style={{ left: checked ? '1.1rem' : '0.125rem' }} />
            </div>
            <span className={`text-[10px] font-mono uppercase tracking-wider transition-colors
        ${checked
                    ? (isDark ? "text-amber-500" : "text-blue-600")
                    : "text-slate-600 group-hover:text-slate-400"}`}>
                {label}
            </span>
        </label>
    );
}

function SectionBar({ children }) {
    return (
        <div className="flex items-center gap-2 my-4">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-[9px] font-mono tracking-[0.25em] text-amber-600 uppercase shrink-0">
                {children}
            </span>
            <div className="h-px flex-1 bg-slate-800" />
        </div>
    );
}

function PassBadge({ pass, size = "sm", isDark }) {
    const base = "font-mono font-bold rounded uppercase tracking-widest flex items-center justify-center";
    const dims = size === "lg" ? "px-3 py-1 text-[11px]" : "px-2 py-0.5 text-[9px]";
    const colors = pass
        ? (isDark ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-emerald-50 text-emerald-600 border border-emerald-200")
        : (isDark ? "bg-red-500/10 text-red-400 border border-red-500/30" : "bg-red-50 text-red-600 border border-red-200");
    return <div className={`${base} ${dims} ${colors}`}>{pass ? "PASS" : "FAIL"}</div>;
}

function Gauge({ value, pass, label, isDark }) {
    const color = pass ? (isDark ? "bg-emerald-500" : "bg-emerald-600") : "bg-red-500";
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-end">
                <span className={`text-[9px] font-mono uppercase tracking-widest ${isDark ? "text-slate-600" : "text-gray-500"}`}>{label}</span>
                <span className={`text-[10px] font-mono font-bold ${pass ? (isDark ? "text-emerald-500" : "text-emerald-600") : "text-red-500"}`}>
                    {(value * 100).toFixed(1)}%
                </span>
            </div>
            <div className={`h-1 rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-gray-200"}`}>
                <div className={`h-full transition-all duration-700 ${color}`}
                    style={{ width: `${Math.min(100, value * 100)}%` }} />
            </div>
        </div>
    );
}


function KV({ label, value, unit, accent, isDark }) {
    return (
        <div className={`flex justify-between py-1 border-b last:border-0 ${isDark ? "border-slate-800/50" : "border-gray-100"}`}>
            <span className={`text-[10px] font-mono ${isDark ? "text-slate-500" : "text-gray-400"}`}>{label}</span>
            <span className={`text-[11px] font-mono
        ${accent ? (isDark ? "text-amber-400 font-bold" : "text-blue-600 font-bold") : (isDark ? "text-slate-300" : "text-gray-700")}`}>
                {value}<span className={`ml-0.5 opacity-50 ${isDark ? "text-slate-500" : "text-gray-400"}`}>{unit}</span>
            </span>
        </div>
    );
}


function Card({ title, children, highlight, isDark }) {
    return (
        <div className={`border rounded-lg p-4 flex flex-col gap-2 transition-all
      ${isDark
                ? (highlight ? "bg-slate-900 border-slate-700" : "bg-slate-950 border-slate-800")
                : (highlight ? "bg-white border-blue-100 shadow-sm" : "bg-white border-gray-100")}`}>
            <SectionBar isDark={isDark}>{title}</SectionBar>
            <div className="flex flex-col gap-0.5">
                {children}
            </div>
        </div>
    );
}

function RunButton({ onClick, loading, label, isDark }) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={`w-full py-3 rounded text-xs font-mono font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2
        ${loading
                    ? (isDark ? "bg-slate-800 text-slate-500" : "bg-gray-200 text-gray-400 cursor-not-allowed")
                    : (isDark ? "bg-amber-500 text-black hover:bg-amber-400 shadow-lg shadow-amber-500/5" : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/10")}`}
        >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {loading ? "Computing..." : label}
        </button>
    );
}

function ErrorBox({ error, isDark }) {
    if (!error) return null;
    return (
        <div className={`rounded border p-4 text-[11px] font-mono mt-4
      ${isDark ? "bg-red-950/15 border-red-900/40 text-red-500" : "bg-red-50 border-red-200 text-red-600"}`}>
            ⚠ {error}
        </div>
    );
}


function VerticalForm({ onResult, isDark }) {
    const [f, sf] = useState({
        wall_type: "single_leaf",
        t_mm: "102.5",
        clear_height_mm: "2600",
        resistance_type: "enhanced",
        unit_category: "II",
        construction_control: "normal",
        eccentricity: "0.05",
        wall_length_mm: "3000",
        Gk_kN_per_m: "45",
        Qk_kN_per_m: "20",
        is_brick_wall: true,
        has_piers: false,
        K: "1.0",
        t2_mm: "102.5",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const set = k => e => sf(prev => ({
        ...prev,
        [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value
    }));

    const run = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const payload = {
                ...f,
                t_mm: parseFloat(f.t_mm),
                clear_height_mm: parseFloat(f.clear_height_mm),
                wall_length_mm: parseFloat(f.wall_length_mm),
                Gk_kN_per_m: parseFloat(f.Gk_kN_per_m),
                Qk_kN_per_m: parseFloat(f.Qk_kN_per_m),
                eccentricity: parseFloat(f.eccentricity),
                K: parseFloat(f.K),
                t2_mm: parseFloat(f.t2_mm),
            };
            const { data } = await axios.post(`${API}/design/vertical_wall`, payload);
            onResult(data);
        } catch (err) {
            setError(err.response?.data?.detail ?? err.message);
        } finally { setLoading(false); }
    }, [f, onResult]);

    return (
        <div className={`border rounded-xl p-6 ${isDark ? "border-slate-800 bg-slate-900/30" : "border-gray-200 bg-white shadow-sm"} flex flex-col gap-4`}>
            <SectionBar isDark={isDark}>Wall Geometry</SectionBar>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Wall Type" isDark={isDark}
                    options={[{ value: "single_leaf", label: "Single Leaf" }, { value: "cavity", label: "Cavity" }]}
                    value={f.wall_type} onChange={set("wall_type")} />
                <Input label="Leaf Thickness t" unit="mm" type="number" isDark={isDark}
                    value={f.t_mm} onChange={set("t_mm")} min="0" />
            </div>
            {f.wall_type === "cavity" && (
                <Input label="Outer Leaf Thickness t₂" unit="mm" type="number" isDark={isDark}
                    value={f.t2_mm} onChange={set("t2_mm")} />
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Clear Height" unit="mm" type="number" isDark={isDark}
                    value={f.clear_height_mm} onChange={set("clear_height_mm")} />
                <Input label="Wall Length" unit="mm" type="number" isDark={isDark}
                    value={f.wall_length_mm} onChange={set("wall_length_mm")} />
            </div>

            <SectionBar isDark={isDark}>Support Conditions</SectionBar>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Horizontal Resistance" isDark={isDark}
                    options={[{ value: "enhanced", label: "Enhanced (hef = 0.75h)" }, { value: "simple", label: "Simple (hef = h)" }]}
                    value={f.resistance_type} onChange={set("resistance_type")} />
                <Select label="Eccentricity" isDark={isDark}
                    options={ECCENTRICITIES}
                    value={f.eccentricity} onChange={set("eccentricity")} />
            </div>

            <SectionBar isDark={isDark}>Materials & Control</SectionBar>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Unit Category" isDark={isDark}
                    options={[{ value: "I", label: "Cat. I" }, { value: "II", label: "Cat. II" }]}
                    value={f.unit_category} onChange={set("unit_category")} />
                <Select label="Construction Control" isDark={isDark}
                    options={[{ value: "special", label: "Special" }, { value: "normal", label: "Normal" }]}
                    value={f.construction_control} onChange={set("construction_control")} />
            </div>
            <div className="flex gap-6 mt-1">
                <Toggle label="Brick wall" checked={f.is_brick_wall} onChange={() => sf(p => ({ ...p, is_brick_wall: !p.is_brick_wall }))} isDark={isDark} />
                <Toggle label="Has piers" checked={f.has_piers} onChange={() => sf(p => ({ ...p, has_piers: !p.has_piers }))} isDark={isDark} />
            </div>
            {f.has_piers && (
                <Input label="Stiffness Coeff. K" type="number" value={f.K} onChange={set("K")} step="0.05" isDark={isDark} />
            )}

            <SectionBar isDark={isDark}>Characteristic Loads</SectionBar>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Gk (Dead)" unit="kN/m" type="number" isDark={isDark}
                    value={f.Gk_kN_per_m} onChange={set("Gk_kN_per_m")} min="0" step="0.5" />
                <Input label="Qk (Imposed)" unit="kN/m" type="number" isDark={isDark}
                    value={f.Qk_kN_per_m} onChange={set("Qk_kN_per_m")} min="0" step="0.5" />
            </div>

            <div className="mt-4">
                <RunButton onClick={run} loading={loading} label="Design Vertical Wall" isDark={isDark} />
            </div>
            <ErrorBox error={error} isDark={isDark} />
        </div>
    );
}

function VerticalResult({ result, isDark }) {
    if (!result) return null;
    return (
        <div className="flex flex-col gap-6">
            <div className={`rounded-xl border p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4
        ${result.SR_pass ? (isDark ? "border-slate-800 bg-slate-900/40" : "border-emerald-100 bg-emerald-50/30") : (isDark ? "border-red-900/40 bg-red-950/15" : "border-red-100 bg-red-50/30")}`}>
                <div>
                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDark ? "text-slate-500" : "text-gray-500"}`}>
                        BS 5628 §5.5 — Vertical Wall Case
                    </h3>
                    <p className={`text-sm font-mono ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                        {result.inputs.t_mm}mm wall · {result.inputs.clear_height_mm}mm height · {result.inputs.resistance_type}
                    </p>
                    <p className={`text-[11px] font-mono mt-1 ${isDark ? "text-slate-500" : "text-gray-400"}`}>{result.load_combination}</p>
                </div>
                <PassBadge pass={result.SR_pass} size="lg" isDark={isDark} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card title="Effective Specs" isDark={isDark}>
                    <KV label="Effective hef" value={result.hef_mm?.toFixed(0)} unit="mm" isDark={isDark} />
                    <KV label="Effective tef" value={result.tef_mm?.toFixed(1)} unit="mm" isDark={isDark} />
                    <KV label="Ratio SR" value={result.SR?.toFixed(2)} accent isDark={isDark} />
                    <KV label="SR Limit" value="27.00" isDark={isDark} />
                </Card>
                <Card title="Capacity Params" isDark={isDark}>
                    <KV label="β (Reduction)" value={result.beta?.toFixed(3)} accent isDark={isDark} />
                    <KV label="γm (Material)" value={result.gamma_m} isDark={isDark} />
                    <KV label="Area Factor" value={result.area_mod_factor?.toFixed(3)} isDark={isDark} />
                    <KV label="Narrow Factor" value={result.narrow_wall_mod_factor?.toFixed(3)} isDark={isDark} />
                </Card>
                <Card title="Design Load" isDark={isDark}>
                    <KV label="Ultimate Load" value={result.inputs?.N_ultimate_N_per_mm?.toFixed(2)} unit="N/mm" accent isDark={isDark} />
                    <KV label="Gk (Dead)" value={result.inputs?.Gk_kN_per_m} unit="kN/m" isDark={isDark} />
                    <KV label="Qk (Imposed)" value={result.inputs?.Qk_kN_per_m} unit="kN/m" isDark={isDark} />
                </Card>
            </div>

            <div className={`rounded-xl border p-6 flex flex-col gap-4 shadow-sm
        ${result.SR_pass ? (isDark ? "border-emerald-800/40 bg-emerald-950/10" : "border-emerald-200 bg-white") : (isDark ? "border-red-900/40 bg-red-950/10" : "border-red-200 bg-white")}`}>
                <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-[0.15em] ${isDark ? "text-slate-500" : "text-gray-400"}`}>
                        Required Characteristic Strength
                    </span>
                    <PassBadge pass={result.SR_pass} size="lg" isDark={isDark} />
                </div>
                <div>
                    <span className={`text-4xl font-mono font-bold ${isDark ? "text-amber-400" : "text-blue-600"}`}>
                        fk ≥ {result.required_fk_basic_N_per_mm2?.toFixed(3)}
                    </span>
                    <span className={`text-lg ml-2 font-mono ${isDark ? "text-slate-500" : "text-gray-400"}`}>N/mm²</span>
                </div>
                <div className="pt-2">
                    <Gauge value={result.SR / 27} pass={result.SR_pass} isDark={isDark}
                        label={`Slenderness Utilization (SR=${result.SR?.toFixed(2)})`} />
                </div>
            </div>
        </div>
    );
}



// ─────────────────────────────────────────────────────────────────────────────
// MODE 2 — Lateral Panel
// ─────────────────────────────────────────────────────────────────────────────

function PanelForm({ onResult, isDark }) {
    const [mode, setMode] = useState("design"); // "design" | "max_wind"
    const [f, sf] = useState({
        panel_height_mm: "2500",
        panel_length_mm: "4500",
        wall_thickness_mm: "102.5",
        mortar_designation: "ii",
        unit_type: "clay",
        water_absorption: "lt7",
        panel_type: "A",
        num_supported_edges: "4",
        continuous_edges: "1",
        Wk_kN_per_m2: "0.5",
        gamma_f: "1.4",
        unit_category: "II",
        construction_control: "normal",
        block_thickness_mm: "102.5",
        block_strength: "7.3",
        block_type: "solid",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const set = k => e => sf(prev => ({ ...prev, [k]: e.target.value }));

    const run = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const payload = {
                ...f,
                panel_height_mm: parseFloat(f.panel_height_mm),
                panel_length_mm: parseFloat(f.panel_length_mm),
                wall_thickness_mm: parseFloat(f.wall_thickness_mm),
                num_supported_edges: parseInt(f.num_supported_edges),
                continuous_edges: parseInt(f.continuous_edges),
                Wk_kN_per_m2: parseFloat(f.Wk_kN_per_m2),
                gamma_f: parseFloat(f.gamma_f),
                block_thickness_mm: parseFloat(f.block_thickness_mm),
                block_strength: parseFloat(f.block_strength),
            };
            const endpoint = mode === "design"
                ? `${API}/design/lateral_panel`
                : `${API}/design/max_wind`;
            const { data } = await axios.post(endpoint, payload);
            onResult({ ...data, _mode: mode, _f: payload });
        } catch (err) {
            setError(err.response?.data?.detail ?? err.message);
        } finally { setLoading(false); }
    }, [f, mode, onResult]);

    const isDesign = mode === "design";

    return (
        <div className={`border rounded-xl p-6 ${isDark ? "border-slate-800 bg-slate-900/30" : "border-gray-200 bg-white"}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-4">
                    {/* Mode toggle */}
                    <div className={`flex gap-1 p-1 rounded-lg border ${isDark ? "bg-slate-900 border-slate-800" : "bg-gray-100 border-gray-200"}`}>
                        {[["design", "Design Check"], ["max_wind", "Max Wind"]].map(([v, l]) => (
                            <button key={v} onClick={() => setMode(v)}
                                className={`flex-1 py-1.5 text-xs font-mono rounded transition-all
                  ${mode === v
                                        ? (isDark ? "bg-amber-500 text-slate-950 font-bold" : "bg-blue-600 text-white font-bold")
                                        : (isDark ? "text-slate-500 hover:text-slate-300" : "text-gray-500 hover:text-gray-700")}`}>
                                {l}
                            </button>
                        ))}
                    </div>

                    <SectionBar isDark={isDark}>Panel Dimensions</SectionBar>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Height h" unit="mm" type="number" isDark={isDark}
                            value={f.panel_height_mm} onChange={set("panel_height_mm")} />
                        <Input label="Length L" unit="mm" type="number" isDark={isDark}
                            value={f.panel_length_mm} onChange={set("panel_length_mm")} />
                    </div>
                    <Input label="Wall Thickness t" unit="mm" type="number" isDark={isDark}
                        value={f.wall_thickness_mm} onChange={set("wall_thickness_mm")} />

                    <SectionBar isDark={isDark}>Masonry Material</SectionBar>
                    <Select label="Unit Type" options={UNIT_TYPES} isDark={isDark}
                        value={f.unit_type} onChange={set("unit_type")} />
                    <Select label="Mortar" options={MORTARS} isDark={isDark}
                        value={f.mortar_designation} onChange={set("mortar_designation")} />
                    {f.unit_type === "clay" && (
                        <Select label="Brick Water Absorption" options={WATER_ABSORPTIONS} isDark={isDark}
                            value={f.water_absorption} onChange={set("water_absorption")} />
                    )}
                </div>

                <div className="flex flex-col gap-4">
                    <SectionBar isDark={isDark}>Panel Support</SectionBar>
                    <Select label="Panel Type" options={PANEL_TYPES} isDark={isDark}
                        value={f.panel_type} onChange={set("panel_type")} />
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Supported Edges" isDark={isDark}
                            options={[{ value: "3", label: "3 edges" }, { value: "4", label: "4 edges" }]}
                            value={f.num_supported_edges} onChange={set("num_supported_edges")} />
                        <Select label="Continuous Edges" isDark={isDark}
                            options={[0, 1, 2, 3, 4].map(n => ({ value: String(n), label: `${n} continuous` }))}
                            value={f.continuous_edges} onChange={set("continuous_edges")} />
                    </div>

                    <SectionBar isDark={isDark}>Loads & Safety</SectionBar>
                    {isDesign && (
                        <Input label="Characteristic Wind Wk" unit="kN/m²" type="number" isDark={isDark}
                            value={f.Wk_kN_per_m2} onChange={set("Wk_kN_per_m2")} min="0" step="0.05" />
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="γf (load factor)" type="number" isDark={isDark}
                            value={f.gamma_f} onChange={set("gamma_f")} step="0.1" />
                        <Select label="Construction Control" isDark={isDark}
                            options={[{ value: "special", label: "Special" }, { value: "normal", label: "Normal" }]}
                            value={f.construction_control} onChange={set("construction_control")} />
                    </div>

                    <div className="mt-auto pt-4">
                        <RunButton onClick={run} loading={loading} isDark={isDark}
                            label={isDesign ? "Check Panel" : "Find Max Wind"} />
                    </div>
                </div>
            </div>
            {error && <div className="mt-4"><ErrorBox error={error} isDark={isDark} /></div>}
        </div>
    );
}

function PanelResult({ result, isDark }) {
    if (!result) return null;
    const isDesign = result._mode === "design";

    return (
        <div className="mt-8">
            {!isDesign ? (
                /* ── Max Wind Results ── */
                <div className="flex flex-col gap-6">
                    <div className={`rounded-xl border p-8 ${isDark ? "border-amber-500/30 bg-amber-500/5 text-amber-50" : "border-blue-500/30 bg-blue-50"}`}>
                        <p className="text-[10px] font-mono tracking-widest uppercase mb-4 opacity-70">
                            BS 5628 §5.6 — Maximum Sustainable Pressure
                        </p>
                        <div className="flex items-baseline gap-3">
                            <span className="text-6xl font-bold tracking-tighter">
                                {result.Wk_max_kN_per_m2?.toFixed(3)}
                            </span>
                            <span className="text-xl opacity-60 font-medium">kN/m²</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Flexural Properties" isDark={isDark}>
                            <KV label="fkx,par" value={`${result.fkx_par?.toFixed(3)}`} unit="N/mm²" isDark={isDark} />
                            <KV label="fkx,perp" value={`${result.fkx_perp?.toFixed(3)}`} unit="N/mm²" isDark={isDark} />
                            <KV label="µ (ratio)" value={result.mu?.toFixed(4)} accent isDark={isDark} />
                            <KV label="α (coeff.)" value={result.alpha?.toFixed(5)} accent isDark={isDark} />
                        </Card>
                        <Card title="Design Context" isDark={isDark}>
                            <KV label="γm (flexure)" value={result.gamma_m} isDark={isDark} />
                            <KV label="h/L ratio" value={(result._f?.panel_height_mm / result._f?.panel_length_mm).toFixed(3)} isDark={isDark} />
                            <KV label="Wk,max (N/mm²)" value={result.Wk_max_N_per_mm2?.toExponential(3)} isDark={isDark} />
                        </Card>
                    </div>
                </div>
            ) : (
                /* ── Design Check Results ── */
                <div className="flex flex-col gap-6">
                    <div className={`rounded-xl border p-6 flex items-center justify-between ${isDark ? "border-slate-800 bg-slate-900/50" : "border-gray-200 bg-white"}`}>
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${result.overall_pass ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                                {result.overall_pass ? <Play className="w-6 h-6" /> : <RefreshCw className="w-6 h-6" />}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Lateral Panel Design</h3>
                                <p className="text-xs opacity-60">BS 5628 Clause 5.6 · Flexural Resistance</p>
                            </div>
                        </div>
                        <PassBadge pass={result.overall_pass} size="lg" isDark={isDark} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card title="Strengths" isDark={isDark}>
                            <KV label="fkx,par" value={`${result.fkx_par_N_mm2?.toFixed(3)}`} unit="N/mm²" isDark={isDark} />
                            <KV label="fkx,perp" value={`${result.fkx_perp_N_mm2?.toFixed(3)}`} unit="N/mm²" isDark={isDark} />
                            <KV label="µ" value={result.mu?.toFixed(4)} accent isDark={isDark} />
                        </Card>
                        <Card title="Applied Moments" isDark={isDark}>
                            <KV label="Mpar" value={`${result.Mpar_kNm_per_m?.toFixed(4)}`} unit="kNm/m" isDark={isDark} />
                            <KV label="Mperp" value={`${result.Mperp_kNm_per_m?.toFixed(4)}`} unit="kNm/m" isDark={isDark} />
                            <KV label="α" value={result.alpha?.toFixed(5)} accent isDark={isDark} />
                        </Card>
                        <Card title="Resistances" isDark={isDark}>
                            <KV label="Mk,par" value={`${result.Mk_par_kNm_per_m?.toFixed(4)}`} unit="kNm/m" isDark={isDark} />
                            <KV label="Mk,perp" value={`${result.Mk_perp_kNm_per_m?.toFixed(4)}`} unit="kNm/m" isDark={isDark} />
                            <KV label="γm" value={result.gamma_m} accent isDark={isDark} />
                        </Card>
                    </div>

                    <div className={`rounded-xl border p-8 ${result.overall_pass ? (isDark ? "border-emerald-500/20 bg-emerald-500/5" : "border-emerald-200 bg-emerald-50") : (isDark ? "border-red-500/20 bg-red-500/5" : "border-red-200 bg-red-50")}`}>
                        <div className="flex items-center justify-between mb-6">
                            <span className="text-[10px] font-mono tracking-widest uppercase opacity-60">
                                Utilisation Summary
                            </span>
                            <span className={`text-sm font-bold ${result.overall_pass ? "text-emerald-500" : "text-red-500"}`}>
                                {Math.max(result.par_utilisation, result.perp_utilisation).toFixed(1)}% Max
                            </span>
                        </div>
                        <div className="flex flex-col gap-4">
                            <Gauge value={result.par_utilisation} pass={result.par_OK} isDark={isDark}
                                label={`Parallel to bed joint: Mpar/Mk,par = ${result.Mpar_kNm_per_m?.toFixed(4)} / ${result.Mk_par_kNm_per_m?.toFixed(4)}`} />
                            <Gauge value={result.perp_utilisation} pass={result.perp_OK} isDark={isDark}
                                label={`Perpendicular to bed joint: Mperp/Mk,perp = ${result.Mperp_kNm_per_m?.toFixed(4)} / ${result.Mk_perp_kNm_per_m?.toFixed(4)}`} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// Root App
// ─── Main App ─────────────────────────────────────────────────────────────────
export default function MasonryUI({ isDark }) {
    const [tab, setTab] = useState("vertical");
    const [vertResult, setVertResult] = useState(null);
    const [panelResult, setPanelResult] = useState(null);
    const [showVisualizer, setShowVisualizer] = useState(false);

    const handleResult = (data) => {
        if (tab === "vertical") setVertResult(data);
        else setPanelResult(data);
    };

    return (
        <div className={`min-h-screen ${isDark ? "bg-slate-950 text-slate-100" : "bg-gray-50 text-gray-900"} font-sans transition-colors duration-300`}>
            {/* Header */}
            <header className={`border-b ${isDark ? "border-slate-800 bg-slate-950/50" : "border-gray-200 bg-white/50"} backdrop-blur-md sticky top-0 z-10`}>
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${isDark ? "bg-blue-500/10" : "bg-blue-50"}`}>
                            <Layout className={`w-5 h-5 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg tracking-tight">Masonry Design</h1>
                            <p className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}>BS 5628-1:2005 · Working Stress</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowVisualizer(!showVisualizer)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${showVisualizer
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                : (isDark ? "bg-slate-900 text-slate-300 hover:bg-slate-800" : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200")
                                }`}
                        >
                            <Eye className="w-4 h-4" />
                            {showVisualizer ? "Hide Visualizer" : "Show Visualizer"}
                        </button>

                        <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isDark ? "bg-slate-900 text-slate-400" : "bg-gray-100 text-gray-500"
                            }`}>
                            Unit: N · mm
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Tabs */}
                <div className={`flex gap-1 p-1 rounded-xl mb-8 w-fit ${isDark ? "bg-slate-900" : "bg-gray-200"}`}>
                    {[
                        { id: "vertical", label: "Vertical Member", icon: Maximize2 },
                        { id: "panel", label: "Lateral Panel", icon: Grid },
                    ].map((t) => (
                        <button
                            key={t.id}
                            onClick={() => { setTab(t.id); setShowVisualizer(false); }}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === t.id
                                ? (isDark ? "bg-slate-800 text-blue-400 shadow-sm" : "bg-white text-blue-600 shadow-sm")
                                : (isDark ? "text-slate-400 hover:text-slate-200" : "text-gray-500 hover:text-gray-700")
                                }`}
                        >
                            <t.icon className="w-4 h-4" />
                            {t.label}
                        </button>
                    ))}
                </div>

                {showVisualizer ? (
                    <div className={`rounded-2xl border ${isDark ? "border-slate-800 bg-slate-900/50" : "border-gray-200 bg-white"} p-8 overflow-hidden`}>
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="font-bold text-xl">Interactive Visualizer</h3>
                            <span className={`text-xs px-2 py-1 rounded ${isDark ? "bg-slate-800 text-slate-400" : "bg-gray-100 text-gray-500"}`}>
                                Scale: 1:20 · Auto-updating
                            </span>
                        </div>
                        <div className="flex justify-center bg-black/5 rounded-xl p-4 overflow-auto">
                            <MasonryVisualisation vertResult={vertResult} panelResult={panelResult} isDark={isDark} />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* Form Column */}
                        <div className="lg:col-span-12">
                            {tab === "vertical" ? (
                                <VerticalForm onResult={handleResult} isDark={isDark} />
                            ) : (
                                <PanelForm onResult={handleResult} isDark={isDark} />
                            )}
                        </div>

                        {/* Result Section */}
                        {(tab === "vertical" ? vertResult : panelResult) && (
                            <div className="lg:col-span-12">
                                {tab === "vertical" ? (
                                    <VerticalResult result={vertResult} isDark={isDark} />
                                ) : (
                                    <PanelResult result={panelResult} isDark={isDark} />
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* ── Footer ── */}
            <footer className={`border-t py-6 text-center mt-12 ${isDark ? "border-slate-800" : "border-gray-200"}`}>
                <p className={`text-[10px] font-mono tracking-widest uppercase ${isDark ? "text-slate-600" : "text-gray-400"}`}>
                    BS 5628: PART 1 — STRUCTURAL USE OF UNREINFORCED MASONRY
                </p>
            </footer>
        </div>
    );
}
