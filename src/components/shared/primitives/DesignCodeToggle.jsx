import React from "react";

/**
 * DesignCodeToggle
 * 
 * Reusable, controlled selector for structural design standards
 * (e.g., BS 8110, Eurocode 2, ACI 318, etc.).
 * 
 * Guarantees:
 * - Purely presentational; does not alter underlying state identifiers,
 *   calculation formulas, backend payloads, or engineering logic.
 * - Supports both compact segmented pills and rich card selections.
 * - Fully accessible with keyboard navigation and ARIA attributes.
 * - Light and dark mode support.
 * 
 * @param {Object} props
 * @param {string} props.value - Active option ID
 * @param {function(string): void} props.onChange - Selection change callback
 * @param {Array<{id: string, label: string, sublabel?: string, icon?: React.ReactNode, activeColor?: string}>} props.options - Available standards
 * @param {'default'|'compact'|'cards'} [props.variant='default'] - Visual layout style
 * @param {boolean} [props.isDark=false] - Theme mode
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {string} [props.className=''] - Additional container classes
 * @param {string} [props.ariaLabel='Design Standard Selection'] - Accessible name
 */
export default function DesignCodeToggle({
  value,
  onChange,
  options = [],
  variant = "default",
  isDark = false,
  disabled = false,
  className = "",
  ariaLabel = "Design Standard Selection",
}) {
  if (!options || options.length === 0) {
    return null;
  }

  // Handle keyboard arrow navigation
  const handleKeyDown = (e, index) => {
    if (disabled) return;
    let nextIndex = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextIndex = (index + 1) % options.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIndex = (index - 1 + options.length) % options.length;
    }
    if (nextIndex !== null) {
      e.preventDefault();
      onChange(options[nextIndex].id);
    }
  };

  // Card layout variant (rich cards with icons, labels, and sublabels)
  if (variant === "cards") {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={`w-full ${className}`}
      >
        <div
          className={`grid gap-2 ${
            options.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3"
          }`}
        >
          {options.map((opt, index) => {
            const isSelected = value === opt.id;
            const activeBg = opt.activeColor
              ? `bg-gradient-to-r ${opt.activeColor} text-white shadow-md`
              : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md";

            const unselectedBg = isDark
              ? "bg-slate-700/80 text-slate-300 hover:bg-slate-700 hover:text-white border-transparent"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 border-transparent";

            return (
              <button
                key={opt.id}
                role="tab"
                type="button"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                disabled={disabled}
                onClick={() => onChange(opt.id)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className={`flex items-center justify-center gap-3 px-5 py-3.5 rounded-lg font-semibold transition-all duration-150 border text-left ${
                  disabled
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                } ${isSelected ? activeBg : unselectedBg}`}
              >
                {opt.icon && (
                  <span className="flex-shrink-0" aria-hidden="true">
                    {opt.icon}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="font-bold text-sm leading-tight truncate">
                    {opt.label}
                  </div>
                  {opt.sublabel && (
                    <div className="text-xs opacity-90 font-normal truncate mt-0.5">
                      {opt.sublabel}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Compact / segmented pill layout variant
  const isCompact = variant === "compact";

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex rounded-lg p-1 transition-colors ${
        isDark ? "bg-slate-700/90" : "bg-gray-100"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
    >
      {options.map((opt, index) => {
        const isSelected = value === opt.id;

        const activeClass = isDark
          ? "bg-slate-600 text-blue-300 shadow-sm"
          : "bg-white text-blue-600 shadow-sm";

        const inactiveClass = isDark
          ? "text-slate-400 hover:text-slate-200"
          : "text-gray-500 hover:text-gray-900";

        return (
          <button
            key={opt.id}
            role="tab"
            type="button"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all ${
              isCompact ? "px-4 py-1.5 text-xs" : "px-6 py-2 text-sm"
            } ${
              disabled
                ? "cursor-not-allowed"
                : "cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            } ${isSelected ? activeClass : inactiveClass}`}
          >
            {opt.icon && (
              <span className="w-4 h-4 flex items-center justify-center" aria-hidden="true">
                {opt.icon}
              </span>
            )}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
