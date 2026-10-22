import React from "react";
import { ChevronLeft } from "lucide-react";
import { layout, surface, text } from "./tokens";

/**
 * Layout primitives shared by every engineering workspace.
 *
 * The application shell owns the top bar and footer, so workflow pages must not
 * add another full-page chrome block; they compose `WorkspacePage` +
 * `PageHeader` + `Section` instead. This keeps padding, heading scale and
 * responsive breakpoints identical across disciplines.
 */

/* ---------------------------------------------------------------- page shell */

/**
 * WorkspacePage — the single scrolling document for a tool.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 * @param {'default'|'wide'|'full'} [props.width] `full` disables the max width for
 *        canvas-first workspaces (CAD viewer, 3D builder).
 * @param {boolean} [props.padded] Set false for edge-to-edge canvases.
 */
export const WorkspacePage = ({
  children,
  className = "",
  width = "default",
  padded = true,
}) => {
  const maxWidth =
    width === "full" ? "max-w-none" : width === "wide" ? "max-w-[1600px]" : layout.maxWidth;
  return (
    <div className={`min-h-full w-full ${surface.page} ${className}`}>
      <div
        className={`mx-auto w-full ${maxWidth} ${padded ? `${layout.pageX} ${layout.pageY}` : ""}`}
      >
        {children}
      </div>
    </div>
  );
};

/* --------------------------------------------------------------- page header */

/**
 * PageHeader — title block for a workflow.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {React.ReactNode} [props.icon]
 * @param {React.ReactNode} [props.actions] Primary actions, right aligned on
 *        desktop and wrapped below the title on phones.
 * @param {React.ReactNode} [props.meta] Small facts (code, units, revision).
 * @param {() => void} [props.onBack] Renders a back control when provided.
 * @param {string} [props.backLabel]
 */
export const PageHeader = ({
  title,
  subtitle,
  icon,
  actions,
  meta,
  onBack,
  backLabel = "Back",
  className = "",
  sticky = false,
}) => (
  <header
    className={`mb-4 sm:mb-6 ${sticky ? "sticky top-0 z-20 -mx-3 sm:-mx-5 lg:-mx-8 px-3 sm:px-5 lg:px-8 py-2 bg-gray-50/95 dark:bg-slate-950/95 backdrop-blur border-b border-gray-200 dark:border-slate-800" : ""} ${className}`}
  >
    {onBack && (
      <button
        type="button"
        onClick={onBack}
        className="mb-2 -ml-1 inline-flex items-center gap-1 min-h-[36px] px-2 rounded-lg text-xs font-semibold text-gray-600 hover:text-blue-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:text-blue-300 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        {backLabel}
      </button>
    )}

    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <div className="mt-0.5 shrink-0 rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className={`text-xl font-bold leading-tight sm:text-2xl lg:text-3xl ${text.title}`}>
            {title}
          </h1>
          {subtitle && (
            <p className={`mt-1 text-xs leading-relaxed sm:text-sm ${text.subtitle}`}>
              {subtitle}
            </p>
          )}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      )}
    </div>
  </header>
);

/* -------------------------------------------------------------------- section */

/**
 * Section — titled card grouping one engineering task.
 * Never nests another Section.
 */
export const Section = ({
  title,
  description,
  icon,
  actions,
  children,
  className = "",
  tone = "card",
  as: Tag = "section",
}) => (
  <Tag
    className={`${tone === "muted" ? surface.cardMuted : surface.card} rounded-2xl p-3 shadow-sm sm:p-5 ${className}`}
  >
    {(title || actions) && (
      <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {icon && <span className="shrink-0 text-blue-600 dark:text-blue-400">{icon}</span>}
          <div className="min-w-0">
            <h2 className={`text-sm font-bold leading-tight sm:text-base ${text.title}`}>
              {title}
            </h2>
            {description && (
              <p className={`mt-0.5 text-[11px] leading-snug sm:text-xs ${text.subtitle}`}>
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    )}
    {children}
  </Tag>
);

/**
 * FormSection — Section that lays its fields out on the shared responsive grid.
 * `columns` caps the number of columns on large screens.
 */
export const FormSection = ({ columns = 2, className = "", children, ...rest }) => {
  const grid =
    columns === 1
      ? "grid grid-cols-1 gap-3 sm:gap-4"
      : columns === 3
      ? layout.formGridWide
      : layout.formGrid;
  return (
    <Section {...rest} className={className}>
      <div className={grid}>{children}</div>
    </Section>
  );
};

/**
 * FormGrid — bare responsive grid for fields inside a custom container.
 */
export const FormGrid = ({ columns = 2, className = "", children }) => {
  const grid =
    columns === 1
      ? "grid grid-cols-1 gap-3 sm:gap-4"
      : columns === 3
      ? layout.formGridWide
      : layout.formGrid;
  return <div className={`${grid} ${className}`}>{children}</div>;
};

/* ------------------------------------------------------------------ action bar */

/**
 * ActionBar — primary calculation actions.
 *
 * On phones it becomes a sticky bottom bar that respects the safe area, so the
 * "Calculate" action stays reachable while the form scrolls. It never overlaps
 * inputs because the parent page keeps bottom padding (see below).
 *
 * @param {object} props
 * @param {boolean} [props.sticky] Stick to the bottom on phones only.
 * @param {string} [props.hint] Optional text shown beside the buttons.
 */
export const ActionBar = ({ children, sticky = true, hint, className = "" }) => (
  <div
    className={
      sticky
        ? `sticky bottom-0 z-30 -mx-3 mt-4 border-t ${surface.stickyBar} px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:pb-0 sm:backdrop-blur-none dark:sm:bg-transparent ${className}`
        : `mt-4 ${className}`
    }
  >
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
      {hint && <p className={`text-[11px] ${text.helper}`}>{hint}</p>}
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">{children}</div>
    </div>
  </div>
);

/**
 * PageBody — keeps the last element clear of the phone action bar / footer.
 */
export const PageBody = ({ children, className = "" }) => (
  <div className={`pb-24 sm:pb-0 ${className}`}>{children}</div>
);

/* --------------------------------------------------------------- misc bits */

export const MetaChip = ({ children, tone = "neutral", className = "" }) => {
  const tones = {
    neutral:
      "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300 border-transparent",
    info: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200 border-blue-100 dark:border-blue-900",
    success:
      "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200 border-green-100 dark:border-green-900",
    warn: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 border-amber-100 dark:border-amber-900",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${tones[tone] || tones.neutral} ${className}`}
    >
      {children}
    </span>
  );
};

const pageLayout = {
  WorkspacePage,
  PageHeader,
  Section,
  FormSection,
  FormGrid,
  ActionBar,
  PageBody,
  MetaChip,
};

export default pageLayout;
