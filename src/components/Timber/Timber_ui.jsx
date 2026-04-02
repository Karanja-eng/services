import { useState, useCallback } from "react";
import axios from "axios";
import TimberVisualisation from "./Timber_visualisation";

const API = "http://localhost:8001";

// ─── Design tokens ────────────────────────────────────────────────────────────
// Aesthetic direction: Modern clean UI (like Columnmain)
// Dynamic tokens based on isDark prop
const getTokens = (isDark) => ({
    bg: isDark ? "#1f2937" : "#f3f4f6", // gray-800 : gray-100
    surface: isDark ? "#374151" : "#ffffff", // gray-700 : white
    border: isDark ? "#4b5563" : "#e5e7eb", // gray-600 : gray-200
    borderHi: isDark ? "#6b7280" : "#d1d5db", // gray-500 : gray-300
    primary: "#2563eb", // blue-600
    primaryDim: isDark ? "#1e3a8a" : "#bfdbfe", // blue-900 : blue-200
    green: "#16a34a", // green-600
    red: "#dc2626", // red-600
    text: isDark ? "#f9fafb" : "#1f2937", // gray-50 : gray-800
    muted: isDark ? "#9ca3af" : "#6b7280", // gray-400 : gray-500
    label: isDark ? "#d1d5db" : "#374151", // gray-300 : gray-700
});

const isDarkTheme = (token) => token.bg === "#1f2937";


// ─── Tabs config ─────────────────────────────────────────────────────────────
const TABS = [
    { id: "flexural", label: "Flexural Member" },
    { id: "axial", label: "Compression — Axial" },
    { id: "combined", label: "Compression — Combined" },
    { id: "stud", label: "Stud Wall" },
];

const STRENGTH_CLASSES = [
    "C14", "C16", "C18", "C22", "C24", "TR26", "C27", "C30", "C35", "C40",
    "D30", "D35", "D40", "D50", "D60", "D70",
];
const LOAD_DURATIONS = ["long_term", "medium_term", "short_term", "very_short_term"];
const LATERAL_SUPPORT = [
    "no_lateral_support",
    "ends_held_in_position",
    "ends_held_compression_edge_held_purlins",
    "ends_held_compression_edge_held_direct",
    "ends_held_compression_edge_direct_bridging",
    "ends_held_both_edges_firmly",
];
const END_CONDITIONS = [
    "a_both_ends_position_and_direction",
    "b_both_ends_position_one_end_direction",
    "c_both_ends_position_not_direction",
    "d_one_end_position_direction_other_direction_only",
    "e_one_end_position_direction_other_free",
];

const RESTRAINT_TYPES = END_CONDITIONS.map(v => ({
    value: v,
    label: v.split("_").slice(1).join(" ").replace(/\b\w/g, l => l.toUpperCase())
}));

// ─── Reusable primitives ─────────────────────────────────────────────────────

function Field({ label, unit, children, token }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{
                fontSize: 14, fontWeight: 500,
                color: token.text, fontFamily: "system-ui, -apple-system, sans-serif"
            }}>
                {label}{unit && <span style={{ color: token.muted, marginLeft: 4 }}>[{unit}]</span>}
            </label>
            {children}
        </div>
    );
}


function Input({ value, onChange, token, type = "number", min, step = "1", ...props }) {
    return (
        <input
            type={type}
            value={value}
            min={min}
            step={step}
            onChange={e => onChange(type === "number" ? parseFloat(e.target.value) : e.target.value)}
            style={{
                background: isDarkTheme(token) ? "#1c1c1c" : "#ffffff", border: `1px solid ${token.border}`,
                color: token.text, fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 14,
                padding: "8px 12px", borderRadius: 4, outline: "none", width: "100%",
                boxSizing: "border-box",
                transition: "border-color 0.15s",
            }}
            onFocus={e => e.target.style.borderColor = token.primary}
            onBlur={e => e.target.style.borderColor = token.border}
            {...props}
        />
    );
}


function Select({ value, onChange, options, token }) {
    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{
                background: isDarkTheme(token) ? "#1c1c1c" : "#ffffff", border: `1px solid ${token.border}`,
                color: token.text, fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 14,
                padding: "8px 12px", borderRadius: 4, outline: "none", width: "100%",
                cursor: "pointer",
            }}
        >
            {options.map(o => (
                <option key={o.value ?? o} value={o.value ?? o}>
                    {o.label ?? o.replace(/_/g, " ")}
                </option>
            ))}
        </select>
    );
}


function Toggle({ label, checked, onChange, token }) {
    return (
        <label style={{
            display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
            fontSize: 12, color: token.label, fontFamily: "system-ui, -apple-system, sans-serif"
        }}>
            <div
                onClick={() => onChange(!checked)}
                style={{
                    width: 36, height: 18, borderRadius: 9,
                    background: checked ? token.primary : (isDarkTheme(token) ? "#2a2a2a" : "#e5e7eb"),
                    border: `1px solid ${checked ? token.primary : token.border}`,
                    position: "relative", cursor: "pointer", transition: "all 0.2s",
                }}
            >
                <div style={{
                    position: "absolute", top: 2,
                    left: checked ? 18 : 2,
                    width: 12, height: 12, borderRadius: "50%",
                    background: checked ? "#000" : token.muted,
                    transition: "left 0.2s",
                }} />
            </div>
            {label}
        </label>
    );
}


function SubmitBtn({ loading, token, label = "RUN DESIGN CHECK" }) {
    return (
        <button
            type="submit"
            disabled={loading}
            style={{
                background: loading ? token.primaryDim : token.primary,
                color: "#ffffff", border: "none",
                fontFamily: "system-ui, -apple-system, sans-serif", fontWeight: 500,
                fontSize: 16,
                padding: "12px 24px", borderRadius: 6, cursor: loading ? "not-allowed" : "pointer",
                width: "100%", marginTop: "8px", boxSizing: "border-box",
                transition: "background 0.15s",
            }}
        >
            {loading ? "COMPUTING..." : label}
        </button>
    );
}


// ─── Utilisation bar ─────────────────────────────────────────────────────────
function UtilBar({ value, label, token }) {
    const pct = Math.min(value * 100, 120);
    const color = value > 1 ? token.red : value > 0.85 ? "#f59e0b" : token.green;
    return (
        <div style={{ marginBottom: 8 }}>
            <div style={{
                display: "flex", justifyContent: "space-between",
                fontSize: 11, fontFamily: "system-ui, -apple-system, sans-serif",
                color: token.label, marginBottom: 3
            }}>
                <span>{label}</span>
                <span style={{ color }}>{(value * 100).toFixed(1)}%</span>
            </div>
            <div style={{ height: 4, background: isDarkTheme(token) ? "#1c1c1c" : "#e5e7eb", borderRadius: 6, overflow: "hidden" }}>
                <div style={{
                    height: "100%", width: `${Math.min(pct, 100)}%`,
                    background: color, borderRadius: 6,
                    transition: "width 0.4s ease",
                }} />
                
            </div>
        </div>
    );
}




// ─── Results panel ────────────────────────────────────────────────────────────
function Badge({ ok, token }) {
    return (
        <span style={{
            display: "inline-block",
            background: ok ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            color: ok ? token.green : token.red,
            border: `1px solid ${ok ? token.green : token.red}`,
            borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
            padding: "1px 6px", fontFamily: "system-ui, -apple-system, sans-serif",
        }}>
            {ok ? "PASS" : "FAIL"}
        </span>
    );
}


function KV({ k, v, token, unit = "" }) {
    return (
        <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            borderBottom: `1px solid ${token.border}`, paddingBottom: 5, marginBottom: 5
        }}>
            <span style={{
                fontSize: 14, color: token.label, fontFamily: "system-ui, -apple-system, sans-serif",
                
            }}>{k}</span>
            <span style={{
                fontSize: 13, color: token.text, fontFamily: "system-ui, -apple-system, sans-serif",
                fontWeight: 600
            }}>
                {typeof v === "boolean" ? <Badge ok={v} token={token} /> : `${v}${unit ? " " + unit : ""}`}
            </span>
        </div>
    );
}


function ResultSection({ title, token, children }) {
    return (
        <div style={{ marginBottom: 20 }}>
            <div style={{
                fontSize: 14, fontWeight: "bold",
                color: token.primary, fontFamily: "system-ui, -apple-system, sans-serif",
                borderBottom: `1px solid ${token.primaryDim}`,
                paddingBottom: 4, marginBottom: 12
            }}>
                {title}
            </div>
            {children}
        </div>
    );
}


function ErrorBox({ msg, token }) {
    return (
        <div style={{
            background: "rgba(239,68,68,0.07)", border: `1px solid ${token.red}`,
            borderRadius: 6, padding: 14, marginTop: 16,
            fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 12, color: token.red,
            whiteSpace: "pre-wrap",
        }}>
            ⚠ {msg}
        </div>
    );
}


// ─── Result renderers ─────────────────────────────────────────────────────────
function FlexuralResult({ r, token }) {
    if (!r) return null;
    return (
        <div style={{ color: token.text }}>
            <ResultSection title="Flexural Capacity" token={token}>
                <UtilBar label="Bending Stress" value={r.bending_util} token={token} />
                <KV k="Applied Stress" v={r.applied_bending_stress} unit="N/mm²" token={token} />
                <KV k="Permissible" v={r.permissible_bending_stress} unit="N/mm²" token={token} />
                <KV k="Result" v={r.bending_pass} token={token} />
            </ResultSection>

            <ResultSection title="Shear Capacity" token={token}>
                <UtilBar label="Shear Stress" value={r.shear_util} token={token} />
                <KV k="Applied Stress" v={r.applied_shear_stress} unit="N/mm²" token={token} />
                <KV k="Permissible" v={r.permissible_shear_stress} unit="N/mm²" token={token} />
                <KV k="Result" v={r.shear_pass} token={token} />
            </ResultSection>

            <ResultSection title="Deflection" token={token}>
                <UtilBar label="Total Deflection" value={r.deflection_util} token={token} />
                <KV k="Actual Δ" v={r.actual_deflection} unit="mm" token={token} />
                <KV k="Permissible Δ" v={r.permissible_deflection} unit="mm" token={token} />
                <KV k="Result" v={r.deflection_pass} token={token} />
            </ResultSection>

            <ResultSection title="Bearing" token={token}>
                <UtilBar label="Bearing Stress" value={r.bearing_util} token={token} />
                <KV k="Applied" v={r.applied_bearing_stress} unit="N/mm²" token={token} />
                <KV k="Permissible" v={r.permissible_bearing_stress} unit="N/mm²" token={token} />
                <KV k="Result" v={r.bearing_pass} token={token} />
            </ResultSection>
        </div>
    );
}

function AxialResult({ r, token }) {
    if (!r) return null;
    return (
        <div style={{ color: token.text }}>
            <ResultSection title="Geometry" token={token}>
                <KV k="Effective Length" v={r.effective_length_mm} unit="mm" token={token} />
                <KV k="Slenderness Ratio λ" v={r.slenderness_ratio} token={token} />
                <KV k="Permissible λ" v={250} token={token} />
            </ResultSection>
            <ResultSection title="Compression" token={token}>
                <UtilBar label="Compression Stress" value={r.compression_util} token={token} />
                <KV k="Applied" v={r.applied_compression_stress} unit="N/mm²" token={token} />
                <KV k="Permissible" v={r.permissible_compression_stress} unit="N/mm²" token={token} />
                <KV k="Result" v={r.compression_pass} token={token} />
            </ResultSection>
        </div>
    );
}

function CombinedResult({ r, token }) {
    if (!r) return null;
    return (
        <div style={{ color: token.text }}>
            <ResultSection title="Combined Interaction" token={token}>
                <UtilBar label="Interaction Value" value={r.interaction_value} token={token} />
                <KV k="Unity Value" v={r.interaction_value} token={token} />
                <KV k="Result" v={r.interaction_pass} token={token} />
            </ResultSection>
            <ResultSection title="Individual Components" token={token}>
                <KV k="Bending Util" v={(r.bending_util * 100).toFixed(1) + "%"} token={token} />
                <KV k="Axial Util" v={(r.axial_util * 100).toFixed(1) + "%"} token={token} />
            </ResultSection>
        </div>
    );
}

function StudResult({ r, token }) {
    if (!r) return null;
    return (
        <div style={{ color: token.text }}>
            <ResultSection title="Stud Capacity" token={token}>
                <UtilBar label="Interaction" value={r.interaction_value} token={token} />
                <KV k="Total Axial Load" v={r.N_total_per_stud} unit="N" token={token} />
                <KV k="Interaction Result" v={r.interaction_pass} token={token} />
            </ResultSection>
            <ResultSection title="Details" token={token}>
                <KV k="Effective Height" v={r.effective_height} unit="mm" token={token} />
                <KV k="Slenderness" v={r.slenderness_ratio} token={token} />
            </ResultSection>
        </div>
    );
}

// ─── Form panels ──────────────────────────────────────────────────────────────

function FlexuralForm({ onResult, token }) {
    const [form, setForm] = useState({
        strength_class: "C16", service_class: 1, load_duration: "long_term",
        load_sharing: false, b_mm: 75, h_mm: 250,
        clear_span_mm: 2850, bearing_length_mm: 150, W_total_N: 10000,
        lateral_support_key: "ends_held_compression_edge_held_direct",
        notch_type: "none", h_e_mm: 0, a_notch_mm: 0,
        wane_prohibited_at_bearing: false, is_domestic_floor_joist: false,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError(null);
        try {
            const { data } = await axios.post(`${API}/design/flexural-member`, form);
            onResult(data);
        } catch (err) {
            setError(err.response?.data?.detail ?? err.message);
        } finally { setLoading(false); }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                <Field label="Strength Class" token={token}>
                    <Select value={form.strength_class} onChange={v => set("strength_class", v)} options={STRENGTH_CLASSES} token={token} />
                </Field>
                <Field label="Service Class" token={token}>
                    <Select value={form.service_class} onChange={v => set("service_class", parseInt(v))} options={["1", "2", "3"].map(v => ({ value: v, label: `Class ${v}` }))} token={token} />
                </Field>
                <Field label="Load Duration" token={token}>
                    <Select value={form.load_duration} onChange={v => set("load_duration", v)} options={LOAD_DURATIONS} token={token} />
                </Field>
                <Field label="Breadth b" unit="mm" token={token}>
                    <Input value={form.b_mm} onChange={v => set("b_mm", v)} min={22} token={token} />
                </Field>
                <Field label="Depth h" unit="mm" token={token}>
                    <Input value={form.h_mm} onChange={v => set("h_mm", v)} min={50} token={token} />
                </Field>
                <Field label="Clear Span" unit="mm" token={token}>
                    <Input value={form.clear_span_mm} onChange={v => set("clear_span_mm", v)} min={100} token={token} />
                </Field>
                <Field label="Bearing Length" unit="mm" token={token}>
                    <Input value={form.bearing_length_mm} onChange={v => set("bearing_length_mm", v)} min={10} token={token} />
                </Field>
                <Field label="Total UDL W" unit="N" token={token}>
                    <Input value={form.W_total_N} onChange={v => set("W_total_N", v)} min={1} token={token} />
                </Field>
                <Field label="Lateral Support" token={token}>
                    <Select value={form.lateral_support_key} onChange={v => set("lateral_support_key", v)} options={LATERAL_SUPPORT} token={token} />
                </Field>
                <Field label="Notch Type" token={token}>
                    <Select value={form.notch_type} onChange={v => set("notch_type", v)} options={["none", "top", "bottom"]} token={token} />
                </Field>
                {form.notch_type !== "none" && <>
                    <Field label="h_e (effective depth)" unit="mm" token={token}>
                        <Input value={form.h_e_mm} onChange={v => set("h_e_mm", v)} min={0} token={token} />
                    </Field>
                    {form.notch_type === "top" &&
                        <Field label="a (notch length)" unit="mm" token={token}>
                            <Input value={form.a_notch_mm} onChange={v => set("a_notch_mm", v)} min={0} token={token} />
                        </Field>
                    }
                </>}
            </div>
            <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
                <Toggle label="Load sharing (K8)" checked={form.load_sharing} onChange={v => set("load_sharing", v)} token={token} />
                <Toggle label="Wane prohibited at bearing" checked={form.wane_prohibited_at_bearing} onChange={v => set("wane_prohibited_at_bearing", v)} token={token} />
                <Toggle label="Domestic floor joist" checked={form.is_domestic_floor_joist} onChange={v => set("is_domestic_floor_joist", v)} token={token} />
            </div>
            <SubmitBtn loading={loading} token={token} />
            {error && <ErrorBox msg={error} token={token} />}
        </form>
    );
}

function AxialForm({ onResult, token }) {
    const [form, setForm] = useState({
        strength_class: "C16", service_class: 1, load_duration: "long_term",
        b_mm: 100, h_mm: 100, L_mm: 2400,
        restraint_type: "pinned_both", axial_load_N: 15000,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError(null);
        try {
            const { data } = await axios.post(`${API}/design/axial-member`, form);
            onResult(data);
        } catch (err) {
            setError(err.response?.data?.detail ?? err.message);
        } finally { setLoading(false); }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <Field label="Strength Class" token={token}>
                    <Select value={form.strength_class} onChange={v => set("strength_class", v)} options={STRENGTH_CLASSES} token={token} />
                </Field>
                <Field label="Service Class" token={token}>
                    <Select value={form.service_class} onChange={v => set("service_class", parseInt(v))} options={["1", "2", "3"].map(v => ({ value: v, label: `Class ${v}` }))} token={token} />
                </Field>
                <Field label="Load Duration" token={token}>
                    <Select value={form.load_duration} onChange={v => set("load_duration", v)} options={LOAD_DURATIONS} token={token} />
                </Field>
                <Field label="Width b" unit="mm" token={token}>
                    <Input value={form.b_mm} onChange={v => set("b_mm", v)} min={22} token={token} />
                </Field>
                <Field label="Depth h" unit="mm" token={token}>
                    <Input value={form.h_mm} onChange={v => set("h_mm", v)} min={22} token={token} />
                </Field>
                <Field label="Length L" unit="mm" token={token}>
                    <Input value={form.L_mm} onChange={v => set("L_mm", v)} min={100} token={token} />
                </Field>
                <Field label="Restraint Type" token={token}>
                    <Select value={form.restraint_type} onChange={v => set("restraint_type", v)} options={RESTRAINT_TYPES} token={token} />
                </Field>
                <Field label="Axial Load" unit="N" token={token}>
                    <Input value={form.axial_load_N} onChange={v => set("axial_load_N", v)} min={1} token={token} />
                </Field>
            </div>
            <SubmitBtn loading={loading} token={token} />
            {error && <ErrorBox msg={error} token={token} />}
        </form>
    );
}

function CombinedForm({ onResult, token }) {
    const [form, setForm] = useState({
        strength_class: "C16", service_class: 1, load_duration: "long_term",
        b_mm: 100, h_mm: 200, L_mm: 3000,
        restraint_type: "c_both_ends_position_not_direction", axial_load_N: 10000, M_kNm: 2.5,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError(null);
        try {
            const { data } = await axios.post(`${API}/design/combined-axial-bending`, form);
            onResult(data);
        } catch (err) {
            setError(err.response?.data?.detail ?? err.message);
        } finally { setLoading(false); }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <Field label="Strength Class" token={token}>
                    <Select value={form.strength_class} onChange={v => set("strength_class", v)} options={STRENGTH_CLASSES} token={token} />
                </Field>
                <Field label="Width b" unit="mm" token={token}>
                    <Input value={form.b_mm} onChange={v => set("b_mm", v)} min={22} token={token} />
                </Field>
                <Field label="Depth h" unit="mm" token={token}>
                    <Input value={form.h_mm} onChange={v => set("h_mm", v)} min={22} token={token} />
                </Field>
                <Field label="Length L" unit="mm" token={token}>
                    <Input value={form.L_mm} onChange={v => set("L_mm", v)} min={100} token={token} />
                </Field>
                <Field label="Axial Load" unit="N" token={token}>
                    <Input value={form.axial_load_N} onChange={v => set("axial_load_N", v)} min={1} token={token} />
                </Field>
                <Field label="Moment M" unit="kNm" token={token}>
                    <Input value={form.M_kNm} onChange={v => set("M_kNm", v)} min={0} step="0.1" token={token} />
                </Field>
            </div>
            <SubmitBtn loading={loading} token={token} />
            {error && <ErrorBox msg={error} token={token} />}
        </form>
    );
}

function StudForm({ onResult, token }) {
    const [form, setForm] = useState({
        strength_class: "C16", b_mm: 38, h_mm: 89, H_mm: 2400,
        spacing_mm: 600, q_kN_m2: 2.5, sheathing_one_side: true,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError(null);
        try {
            const { data } = await axios.post(`${API}/design/timber-stud-wall`, form);
            onResult(data);
        } catch (err) {
            setError(err.response?.data?.detail ?? err.message);
        } finally { setLoading(false); }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <Field label="Strength Class" token={token}>
                    <Select value={form.strength_class} onChange={v => set("strength_class", v)} options={STRENGTH_CLASSES} token={token} />
                </Field>
                <Field label="Stud Breadth b" unit="mm" token={token}>
                    <Input value={form.b_mm} onChange={v => set("b_mm", v)} min={38} token={token} />
                </Field>
                <Field label="Stud Depth h" unit="mm" token={token}>
                    <Input value={form.h_mm} onChange={v => set("h_mm", v)} min={38} token={token} />
                </Field>
                <Field label="Wall Height H" unit="mm" token={token}>
                    <Input value={form.H_mm} onChange={v => set("H_mm", v)} min={100} token={token} />
                </Field>
                <Field label="Stud Spacing" unit="mm" token={token}>
                    <Input value={form.spacing_mm} onChange={v => set("spacing_mm", v)} min={100} token={token} />
                </Field>
                <Field label="Lateral Load q" unit="kN/m²" token={token}>
                    <Input value={form.q_kN_m2} onChange={v => set("q_kN_m2", v)} min={0} step="0.1" token={token} />
                </Field>
            </div>
            <div style={{ marginBottom: 20 }}>
                <Toggle label="Sheathing on one side (min)" checked={form.sheathing_one_side} onChange={v => set("sheathing_one_side", v)} token={token} />
            </div>
            <SubmitBtn loading={loading} token={token} />
            {error && <ErrorBox msg={error} token={token} />}
        </form>
    );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function TimberUI({ isDark }) {
    const [tab, setTab] = useState("flexural");
    const [result, setResult] = useState(null);
    const [resultType, setResultType] = useState(null);
    const [showVisualizer, setShowVisualizer] = useState(false);

    const token = getTokens(isDark);

    const handleResult = useCallback((data, type) => {
        setResult(data);
        setResultType(type);
    }, []);

    const FORMS = {
        flexural: <FlexuralForm onResult={d => handleResult(d, "flexural")} token={token} />,
        axial: <AxialForm onResult={d => handleResult(d, "axial")} token={token} />,
        combined: <CombinedForm onResult={d => handleResult(d, "combined")} token={token} />,
        stud: <StudForm onResult={d => handleResult(d, "stud")} token={token} />,
    };

    const RESULTS = {
        flexural: result && resultType === "flexural" && <FlexuralResult r={result} token={token} />,
        axial: result && resultType === "axial" && <AxialResult r={result} token={token} />,
        combined: result && resultType === "combined" && <CombinedResult r={result} token={token} />,
        stud: result && resultType === "stud" && <StudResult r={result} token={token} />,
    };

    return (
        <div style={{
            minHeight: "100vh", background: token.bg, color: token.text,
            fontFamily: "system-ui, -apple-system, sans-serif",

        }}>
            {/* Header */}
            <header style={{
                background: "#1f2937",
                color: "#ffffff",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                padding: "24px 40px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
                <div>
                    <h1 style={{ fontSize: "1.875rem", lineHeight: "2.25rem", fontWeight: 700, margin: 0, padding: 0 }}>
                        Timber Design System
                    </h1>
                    <p style={{ color: "#d1d5db", marginTop: "4px", marginBottom: 0, padding: 0, fontSize: "1rem" }}>
                        Professional BS 5268: Part 2 Compliant Tool
                    </p>
                </div>
                <button
                    onClick={() => setShowVisualizer(!showVisualizer)}
                    style={{
                        background: showVisualizer ? "rgba(255,255,255,0.2)" : "none",
                        color: "#ffffff",
                        border: `1px solid rgba(255,255,255,0.4)`,
                        padding: "8px 16px",
                        borderRadius: 6,
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s"
                    }}
                >
                    {showVisualizer ? "Hide Visualizer" : "Show Visualizer"}
                </button>
            </header>

            {/* Tab bar */}
            <div style={{
                display: "flex", borderBottom: `1px solid ${token.border}`,
                padding: "0 40px", gap: 4,
                background: token.surface,
                boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
            }}>
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => { setTab(t.id); setResult(null); }}
                        style={{
                            background: tab === t.id ? (isDarkTheme(token) ? "#374151" : "#eff6ff") : "transparent",
                            border: "none", cursor: "pointer",
                            padding: "16px 24px", fontSize: 16, fontWeight: 500,
                            color: tab === t.id ? token.primary : token.muted,
                            borderBottom: tab === t.id ? `2px solid ${token.primary}` : "2px solid transparent",
                            transition: "all 0.15s",
                            display: "flex", alignItems: "center", gap: 8
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Body */}
            <div style={{ padding: "32px 0" }}>
                <div style={{
                    display: "grid", 
                    gridTemplateColumns: showVisualizer ? "1fr" : "1fr 450px", 
                    gap: 32, 
                    maxWidth: "1280px", 
                    margin: "0 auto", 
                    padding: "0 16px",
                    minHeight: "calc(100vh - 200px)"
                }}>

                {showVisualizer ? (
                    <div style={{ padding: "40px", display: "flex", justifyContent: "center" }}>
                        <div style={{
                            background: "#000",
                            padding: "20px",
                            borderRadius: 8,
                            border: `1px solid ${token.borderHi}`,
                            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
                        }}>
                            <TimberVisualisation />
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Left — inputs */}
                        <div style={{ 
                            padding: "24px", 
                            background: token.surface, 
                            borderRadius: "8px", 
                            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                            border: `1px solid ${token.border}` 
                        }}>
                            <div style={{
                                fontSize: 20, fontWeight: "bold", color: token.text, marginBottom: 16,
                                paddingBottom: 0
                            }}>
                                Input Parameters — {TABS.find(t => t.id === tab)?.label}
                            </div>
                            {/* Pass token to forms if needed, but since they are defined inside the same file they can use the local token if we change them to accept it */}
                            {tab === "flexural" && <FlexuralForm onResult={d => handleResult(d, "flexural")} token={token} />}
                            {tab === "axial" && <AxialForm onResult={d => handleResult(d, "axial")} token={token} />}
                            {tab === "combined" && <CombinedForm onResult={d => handleResult(d, "combined")} token={token} />}
                            {tab === "stud" && <StudForm onResult={d => handleResult(d, "stud")} token={token} />}
                        </div>

                        {/* Right — results */}
                        <div style={{ 
                            padding: "24px", 
                            background: token.surface, 
                            borderRadius: "8px", 
                            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                            border: `1px solid ${token.border}`,
                            overflowY: "auto" 
                        }}>
                            <div style={{
                                fontSize: 20, fontWeight: "bold", color: token.text, marginBottom: 16,
                                paddingBottom: 0
                            }}>
                                Design Output
                            </div>
                            {result && resultType === tab
                                ? (
                                    <>
                                        {tab === "flexural" && <FlexuralResult r={result} token={token} />}
                                        {tab === "axial" && <AxialResult r={result} token={token} />}
                                        {tab === "combined" && <CombinedResult r={result} token={token} />}
                                        {tab === "stud" && <StudResult r={result} token={token} />}
                                    </>
                                )
                                : (
                                    <div style={{ color: token.muted, fontSize: 12, marginTop: 40, textAlign: "center" }}>
                                        ↑ fill parameters and run check
                                    </div>
                                )
                            }
                        </div>
                    </>
                )}

                </div>
            </div>
        </div>
    );
}
