import React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  ChevronDown,
} from "lucide-react";
import { status as statusTokens, text, utilisationBand } from "./tokens";

/**
 * Engineering check presentation.
 *
 * Consistency rule: a result is never communicated by colour alone — every
 * badge/banner/gauge prints a word (PASS / FAIL / CHECK), the engineering
 * value, and its unit.
 */

const ICONS = {
  pass: CheckCircle2,
  fail: XCircle,
  warn: AlertTriangle,
  info: Info,
  idle: Info,
};

const normalise = (value) => {
  if (value === true) return "pass";
  if (value === false) return "fail";
  if (value === null || value === undefined) return "idle";
  if (value === "ok" || value === "pass") return "pass";
  if (value === "fail" || value === "error") return "fail";
  if (value === "warning" || value === "warn") return "warn";
  if (value === "idle" || value === "pending") return "idle";
  return "info";
};

/**
 * StatusBadge — compact per-check result (Flexure / Shear / Deflection ...).
 *
 * @param {object} props
 * @param {'pass'|'fail'|'warn'|'info'|'idle'|boolean} props.status
 * @param {string} [props.label] Check name, e.g. "Shear".
 * @param {string} [props.value] Optional engineering ratio/value to print.
 * @param {'sm'|'md'} [props.size='sm']
 * @param {boolean} [props.showWord=true] Print the status word (never colour-only).
 */
export const StatusBadge = ({
  status,
  label,
  value,
  size = "sm",
  showWord = true,
  className = "",
}) => {
  const key = normalise(status);
  const token = statusTokens[key];
  const Icon = ICONS[key] || Info;
  const word = token.label;
  const sizing =
    size === "sm"
      ? "px-2 py-0.5 text-[11px] gap-1"
      : "px-2.5 py-1 text-xs gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-md font-semibold ${sizing} ${token.badge} ${className}`}
    >
      <Icon size={size === "sm" ? 12 : 14} aria-hidden="true" className="shrink-0" />
      {label && <span className="truncate">{label}</span>}
      {showWord && <span className="opacity-80">· {word}</span>}
      {value != null && value !== "" && <span className="font-mono">{value}</span>}
    </span>
  );
};

/**
 * ResultBanner — headline verdict for a calculation run.
 *
 * @param {object} props
 * @param {'pass'|'fail'|'warn'|'info'} props.status
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {React.ReactNode} [props.actions]
 * @param {React.ReactNode} [props.children] Extra detail rows below the copy.
 */
export const ResultBanner = ({
  status = "pass",
  title,
  description,
  actions,
  children,
  className = "",
}) => {
  const key = normalise(status);
  const token = statusTokens[key];
  const Icon = ICONS[key] || Info;
  return (
    <div
      role="status"
      className={`flex flex-col gap-3 rounded-2xl border-l-4 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4 ${token.surface} ${token.border} ${className}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className={`shrink-0 ${token.icon}`}>
          <Icon size={22} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className={`text-sm font-bold leading-tight sm:text-base ${text.title}`}>
            {title}
          </h3>
          {description && (
            <p className={`mt-0.5 text-xs leading-relaxed ${text.subtitle}`}>{description}</p>
          )}
          {children}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
};

/**
 * UtilizationGauge — ratio against capacity.
 *
 * @param {object} props
 * @param {number} props.ratio  0.92 = 92% utilisation (1.0 = capacity).
 * @param {string} props.label  e.g. "Shear V_Ed / V_Rd".
 * @param {string} [props.detail] Secondary text (demand / capacity values).
 * @param {number} [props.allowable=1]
 */
export const UtilizationGauge = ({
  ratio,
  label,
  detail,
  allowable = 1,
  className = "",
}) => {
  const numeric = typeof ratio === "number" && Number.isFinite(ratio) ? ratio : null;
  const band = utilisationBand(numeric);
  const token = statusTokens[band];
  const percent = numeric == null ? null : numeric * 100;
  const width = percent == null ? 0 : Math.min(Math.max(percent, 0), 100);

  return (
    <div className={`min-w-0 ${className}`}>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2">
        <span className={`text-xs font-semibold ${text.label}`}>{label}</span>
        <span className={`text-xs font-mono font-bold ${text.title}`}>
          {percent == null ? "—" : `${percent.toFixed(0)}%`}
          {percent != null && numeric > allowable && (
            <span className="ml-1 font-sans text-[10px] font-bold uppercase text-red-700 dark:text-red-300">
              over capacity
            </span>
          )}
        </span>
      </div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={Math.max(Math.round(allowable * 100), percent == null ? 100 : Math.round(percent))}
        aria-valuenow={percent == null ? undefined : Math.round(percent)}
        aria-valuetext={percent == null ? "not calculated" : `${percent.toFixed(0)} percent of capacity`}
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${token.bar}`}
          style={{ width: `${width}%` }}
        />
      </div>
      {detail && <p className={`mt-1 text-[11px] ${text.helper}`}>{detail}</p>}
    </div>
  );
};

/**
 * TechnicalDetails — collapsible block for dense technical output.
 * Uses native <details> so it works without JS and is keyboard accessible.
 */
export const TechnicalDetails = ({ summary = "Technical details", children, open = false, className = "" }) => (
  <details
    className={`group rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-800 dark:bg-slate-900/60 ${className}`}
    open={open}
  >
    <summary className="flex min-h-[36px] cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-200">
      <span>{summary}</span>
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="shrink-0 transition-transform group-open:rotate-180"
      />
    </summary>
    <div className="mt-3 space-y-2 text-xs">{children}</div>
  </details>
);

/**
 * KeyValueGrid — compact results summary that never overflows a phone.
 * Two columns on phones (value + unit), more on wider screens.
 */
export const KeyValueGrid = ({ items = [], columns = 2, className = "" }) => (
  <dl
    className={`grid grid-cols-2 gap-2 sm:gap-3 ${
      columns >= 3 ? "lg:grid-cols-3" : columns === 4 ? "md:grid-cols-4" : "md:grid-cols-2"
    } ${className}`}
  >
    {items.map((item, i) => (
      <div
        key={`${item.label}-${i}`}
        className="min-w-0 rounded-lg border border-gray-200 bg-white px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900"
      >
        <dt className={`truncate text-[10px] font-semibold uppercase tracking-wide ${text.helper}`}>
          {item.label}
        </dt>
        <dd className={`mt-0.5 break-words font-mono text-sm font-bold ${text.title}`}>
          {item.value ?? "—"}
          {item.unit && (
            <span className={`ml-1 font-sans text-[10px] font-medium ${text.unit}`}>
              {item.unit}
            </span>
          )}
        </dd>
      </div>
    ))}
  </dl>
);

/**
 * CalculationStatus — small "checking / done / failed" line used near actions.
 */
export const CalculationStatus = ({ state = "idle", message, className = "" }) => {
  const map = {
    idle: { key: "idle", text: "Not calculated yet" },
    running: { key: "info", text: "Calculating…" },
    done: { key: "pass", text: "Calculation complete" },
    error: { key: "fail", text: "Calculation failed" },
    stale: { key: "warn", text: "Inputs changed — recalculate" },
  };
  const entry = map[state] || map.idle;
  const token = statusTokens[entry.key];
  return (
    <p
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${className}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-1.5 w-1.5 rounded-full ${token.bar} ${
          state === "running" ? "animate-pulse" : ""
        }`}
      />
      <span className={text.helper}>{message || entry.text}</span>
    </p>
  );
};

const statusComponents = {
  StatusBadge,
  ResultBanner,
  UtilizationGauge,
  TechnicalDetails,
  KeyValueGrid,
  CalculationStatus,
};

export default statusComponents;
