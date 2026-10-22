import React from "react";
import { ArrowLeftRight } from "lucide-react";
import { text } from "./tokens";

/**
 * TableScrollRegion — intentional mobile treatment for wide technical tables
 * (dimension paper, taking-off sheets, BOQ, member schedules).
 *
 * Why not a "responsive card table"? Measured quantities, timesing columns and
 * BOQ rates must stay in their standard columns to remain readable as documents.
 * The safe treatment is a contained, keyboard-scrollable region with a visible
 * scroll affordance on phones — never page-wide horizontal overflow.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children The <table>.
 * @param {string} [props.label] Accessible region name.
 * @param {string} [props.minWidth='48rem'] Minimum table width before scrolling.
 * @param {boolean} [props.hint=true] Show the scroll hint on phones.
 */
export const TableScrollRegion = ({
  children,
  label = "Table",
  minWidth = "48rem",
  hint = true,
  className = "",
  innerClassName = "",
}) => (
  <div className={`min-w-0 ${className}`}>
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={`w-full overflow-x-auto overscroll-x-contain rounded-lg border border-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 ${innerClassName}`}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div style={{ minWidth }}>{children}</div>
    </div>
    {hint && (
      <p className={`mt-1 flex items-center gap-1 text-[10px] sm:hidden ${text.helper}`}>
        <ArrowLeftRight size={11} aria-hidden="true" />
        Scroll the table sideways to see all columns.
      </p>
    )}
  </div>
);

/**
 * StackedTable — genuinely narrow two-column tables (key/value result rows)
 * rendered as rows instead of a grid, so they need no horizontal scrolling.
 */
export const StackedTable = ({ rows = [], label, className = "" }) => (
  <div className={`min-w-0 ${className}`}>
    {label && (
      <p className={`mb-1 text-[11px] font-bold uppercase tracking-wide ${text.helper}`}>
        {label}
      </p>
    )}
    <dl className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 dark:divide-slate-800 dark:border-slate-800">
      {rows.map((row, i) => (
        <div key={`${row.label}-${i}`} className="flex items-baseline justify-between gap-3 px-2.5 py-2">
          <dt className={`min-w-0 text-xs ${text.helper}`}>{row.label}</dt>
          <dd className={`shrink-0 font-mono text-xs font-semibold ${text.title}`}>
            {row.value ?? "—"}
            {row.unit && <span className={`ml-1 font-sans text-[10px] ${text.unit}`}>{row.unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  </div>
);

const tableRegions = { TableScrollRegion, StackedTable };

export default tableRegions;
