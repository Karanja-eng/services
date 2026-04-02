import codecs

file_path = r"C:\Users\HP\Documents\programming\Java script\ReactApps\Services\src\components\Timber\Timber_ui.jsx"
with codecs.open(file_path, "r", "utf-8") as f:
    content = f.read()

# 1. Global replacements
content = content.replace("token.amberDim", "token.primaryDim")
content = content.replace("token.amber", "token.primary")
content = content.replace("'Courier New', monospace", "system-ui, -apple-system, sans-serif")
content = content.replace("borderRadius: 2", "borderRadius: 6")

# 2. Update getTokens and isDarkTheme
old_tokens = """// ─── Design tokens ────────────────────────────────────────────────────────────
// Aesthetic direction: Technical Blueprint / Engineering Drawing
// Dynamic tokens based on isDark prop
const getTokens = (isDark) => ({
    bg: isDark ? "#0f0f0f" : "#f9fafb", // gray-50
    surface: isDark ? "#161616" : "#ffffff",
    border: isDark ? "#2a2a2a" : "#e5e7eb", // gray-200
    borderHi: isDark ? "#3d3d3d" : "#d1d5db", // gray-300
    amber: "#f0a500",
    amberDim: isDark ? "#7d5600" : "#fbbf24",
    green: "#22c55e",
    red: "#ef4444",
    text: isDark ? "#e8e8e8" : "#1f2937", // gray-800
    muted: isDark ? "#6b6b6b" : "#9ca3af", // gray-400
    label: isDark ? "#9a9a9a" : "#6b7280", // gray-500
});

const isDarkTheme = (token) => token.bg === "#0f0f0f";"""

new_tokens = """// ─── Design tokens ────────────────────────────────────────────────────────────
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

const isDarkTheme = (token) => token.bg === "#1f2937";"""
content = content.replace(old_tokens, new_tokens)

# Handle potential CRLF
old_tokens_crlf = old_tokens.replace('\n', '\r\n')
content = content.replace(old_tokens_crlf, new_tokens)

# 3. Remove Background Gradient
old_bg = """            backgroundImage: isDark ? `
        linear-gradient(rgba(240,165,0,0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(240,165,0,0.02) 1px, transparent 1px)
      ` : `
        linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)
      `,
            backgroundSize: "40px 40px","""
new_bg = ""
content = content.replace(old_bg, new_bg)
content = content.replace(old_bg.replace('\n', '\r\n'), new_bg)

# 4. Header Replacement
old_header = """            {/* Header */}
            <div style={{
                borderBottom: `1px solid ${token.border}`,
                padding: "20px 40px",
                display: "flex", alignItems: "center", gap: 20,
            }}>
                <div style={{ fontSize: 11, color: token.primary, letterSpacing: "0.2em", textTransform: "uppercase" }}>
                    ▐ BS 5268 : PART 2
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.05em", color: token.text }}>
                    Structural Timber Design
                </div>
                <button
                    onClick={() => setShowVisualizer(!showVisualizer)}
                    style={{
                        background: showVisualizer ? token.primary : "none",
                        color: showVisualizer ? "#000" : token.primary,
                        border: `1px solid ${token.primary}`,
                        padding: "4px 12px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: "pointer",
                        marginLeft: 20,
                        transition: "all 0.2s"
                    }}
                >
                    {showVisualizer ? "HIDE VISUALIZER" : "SHOW VISUALIZER"}
                </button>
                <div style={{ marginLeft: "auto", fontSize: 10, color: token.muted }}>
                    PERMISSIBLE STRESS · N · mm
                </div>
            </div>"""

new_header = """            {/* Header */}
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
            </header>"""
content = content.replace(old_header, new_header)
content = content.replace(old_header.replace('\n', '\r\n'), new_header)


# 5. Fix tabs container to match ColumnMain styling (bg-white border-b shadow-sm)
old_tabs_container = """            {/* Tab bar */}
            <div style={{
                display: "flex", borderBottom: `1px solid ${token.border}`,
                padding: "0 40px", gap: 0,
            }}>"""
new_tabs_container = """            {/* Tab bar */}
            <div style={{
                display: "flex", borderBottom: `1px solid ${token.border}`,
                padding: "0 40px", gap: 4,
                background: token.surface,
                boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
            }}>"""
content = content.replace(old_tabs_container, new_tabs_container)
content = content.replace(old_tabs_container.replace('\n', '\r\n'), new_tabs_container)

# 6. Fix tab buttons padding and borders to match TabButton
old_tab_button = """                        style={{
                            background: "none", border: "none", cursor: "pointer",
                            padding: "14px 20px", fontSize: 11, letterSpacing: "0.1em",
                            textTransform: "uppercase", color: tab === t.id ? token.primary : token.muted,
                            borderBottom: tab === t.id ? `2px solid ${token.primary}` : "2px solid transparent",
                            transition: "all 0.15s",
                        }}"""
new_tab_button = """                        style={{
                            background: tab === t.id ? (isDarkTheme(token) ? "#374151" : "#eff6ff") : "transparent",
                            border: "none", cursor: "pointer",
                            padding: "16px 24px", fontSize: 16, fontWeight: 500,
                            color: tab === t.id ? token.primary : token.muted,
                            borderBottom: tab === t.id ? `2px solid ${token.primary}` : "2px solid transparent",
                            transition: "all 0.15s",
                            display: "flex", alignItems: "center", gap: 8
                        }}"""
content = content.replace(old_tab_button, new_tab_button)
content = content.replace(old_tab_button.replace('\n', '\r\n'), new_tab_button)

# 7. Left/Right Layout (Input Form styling) -> add a bit of padding and proper bg like max-w panels
old_body_container = """            {/* Body */}
            <div style={{ display: "grid", gridTemplateColumns: showVisualizer ? "1fr" : "1fr 380px", gap: 0, minHeight: "calc(100vh - 120px)" }}>"""

new_body_container = """            {/* Body */}
            <div style={{ padding: "32px 0" }}>
                <div style={{
                    display: "grid", 
                    gridTemplateColumns: showVisualizer ? "1fr" : "1fr 450px", 
                    gap: 32, 
                    maxWidth: "1280px", 
                    margin: "0 auto", 
                    padding: "0 16px",
                    minHeight: "calc(100vh - 200px)"
                }}>"""
content = content.replace(old_body_container, new_body_container)
content = content.replace(old_body_container.replace('\n', '\r\n'), new_body_container)

old_left_panel = """                        {/* Left — inputs */}
                        <div style={{ padding: "32px 40px", borderRight: `1px solid ${token.border}` }}>"""
new_left_panel = """                        {/* Left — inputs */}
                        <div style={{ 
                            padding: "24px", 
                            background: token.surface, 
                            borderRadius: "8px", 
                            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                            border: `1px solid ${token.border}` 
                        }}>"""
content = content.replace(old_left_panel, new_left_panel)
content = content.replace(old_left_panel.replace('\n', '\r\n'), new_left_panel)

old_right_panel = """                        {/* Right — results */}
                        <div style={{ padding: "32px 24px", overflowY: "auto" }}>"""
new_right_panel = """                        {/* Right — results */}
                        <div style={{ 
                            padding: "24px", 
                            background: token.surface, 
                            borderRadius: "8px", 
                            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                            border: `1px solid ${token.border}`,
                            overflowY: "auto" 
                        }}>"""
content = content.replace(old_right_panel, new_right_panel)
content = content.replace(old_right_panel.replace('\n', '\r\n'), new_right_panel)

# Handle the closing divs adjustment because we wrapped it in an extra div.
content = content.replace("            </div>\n        </div>\n    );\n}\n", "                </div>\n            </div>\n        </div>\n    );\n}\n")
content = content.replace("            </div>\r\n        </div>\r\n    );\r\n}\r\n", "                </div>\r\n            </div>\r\n        </div>\r\n    );\r\n}\r\n")

# Extra styling fixes to match ColumnMain inputs
content = content.replace(
    'fontSize: 10, color: token.label, letterSpacing: "0.15em",\n                                textTransform: "uppercase", marginBottom: 20,\n                                borderBottom: `1px solid ${token.border}`, paddingBottom: 10',
    'fontSize: 20, fontWeight: "bold", color: token.text, marginBottom: 16,\n                                paddingBottom: 0'
)
content = content.replace(
    'fontSize: 10, color: token.label, letterSpacing: "0.15em",\r\n                                textTransform: "uppercase", marginBottom: 20,\r\n                                borderBottom: `1px solid ${token.border}`, paddingBottom: 10',
    'fontSize: 20, fontWeight: "bold", color: token.text, marginBottom: 16,\r\n                                paddingBottom: 0'
)


# Input fields styling adjustments
old_field = """            <label style={{
                fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                color: token.label, fontFamily: "system-ui, -apple-system, sans-serif"
            }}>"""
new_field = """            <label style={{
                fontSize: 14, fontWeight: 500,
                color: token.text, fontFamily: "system-ui, -apple-system, sans-serif"
            }}>"""
content = content.replace(old_field, new_field)
content = content.replace(old_field.replace('\n', '\r\n'), new_field)

old_input = """                background: isDarkTheme(token) ? "#1c1c1c" : "#ffffff", border: `1px solid ${token.border}`,
                color: token.text, fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 13,
                padding: "6px 10px", borderRadius: 6, outline: "none", width: "100%","""
new_input = """                background: isDarkTheme(token) ? "#1c1c1c" : "#ffffff", border: `1px solid ${token.border}`,
                color: token.text, fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 14,
                padding: "8px 12px", borderRadius: 4, outline: "none", width: "100%","""
content = content.replace(old_input, new_input)
content = content.replace(old_input.replace('\n', '\r\n'), new_input)

old_select = """                background: isDarkTheme(token) ? "#1c1c1c" : "#ffffff", border: `1px solid ${token.border}`,
                color: token.text, fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 12,
                padding: "6px 10px", borderRadius: 6, outline: "none", width: "100%","""
new_select = """                background: isDarkTheme(token) ? "#1c1c1c" : "#ffffff", border: `1px solid ${token.border}`,
                color: token.text, fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 14,
                padding: "8px 12px", borderRadius: 4, outline: "none", width: "100%","""
content = content.replace(old_select, new_select)
content = content.replace(old_select.replace('\n', '\r\n'), new_select)

# Submit button styling
old_submit_btn = """                background: loading ? token.primaryDim : token.primary,
                color: "#000", border: "none",
                fontFamily: "system-ui, -apple-system, sans-serif", fontWeight: 700,
                fontSize: 12, letterSpacing: "0.15em",
                padding: "10px 28px", borderRadius: 6, cursor: loading ? "not-allowed" : "pointer","""

new_submit_btn = """                background: loading ? token.primaryDim : token.primary,
                color: "#ffffff", border: "none",
                fontFamily: "system-ui, -apple-system, sans-serif", fontWeight: 500,
                fontSize: 16,
                padding: "12px 24px", borderRadius: 6, cursor: loading ? "not-allowed" : "pointer",
                width: "100%", marginTop: "8px", boxSizing: "border-box","""
content = content.replace(old_submit_btn, new_submit_btn)
content = content.replace(old_submit_btn.replace('\n', '\r\n'), new_submit_btn)

# Make badges and subheaders look better
content = content.replace('fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",', 'fontSize: 14, fontWeight: "bold",')
content = content.replace('paddingBottom: 4, marginBottom: 10', 'paddingBottom: 4, marginBottom: 12')
content = content.replace('fontSize: 11, color: token.label,', 'fontSize: 14, color: token.label,')
content = content.replace('letterSpacing: "0.05em"', '')

with codecs.open(file_path, "w", "utf-8") as f:
    f.write(content)

print("Modification complete.")
