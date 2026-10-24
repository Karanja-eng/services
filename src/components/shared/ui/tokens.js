/**
 * Fundi Studio — shared design tokens.
 *
 * These are *Tailwind class tokens*, not a second styling system: every value is
 * a utility string so components stay tree-shakeable and the existing Tailwind
 * build keeps working. Import these instead of re-typing long class lists in
 * workflow components.
 *
 * Rules of the house:
 * - Light + dark variants always travel together (`dark:` on the root shell sets
 *   `.dark` because tailwind.config.js uses darkMode: "class").
 * - Touch targets: interactive controls should be >= 44px tall on phones.
 * - Engineering values are never recoloured to convey status on their own; a
 *   text label always accompanies colour.
 */

/* ------------------------------------------------------------------ surfaces */
export const surface = {
  page: "bg-gray-50 text-gray-900 dark:bg-slate-950 dark:text-slate-100",
  card: "bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800",
  cardMuted: "bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800",
  inset: "bg-gray-100 dark:bg-slate-800/60",
  stickyBar:
    "bg-white/95 dark:bg-slate-900/95 backdrop-blur border-gray-200 dark:border-slate-800",
};

/* --------------------------------------------------------------------- text */
export const text = {
  title: "text-gray-900 dark:text-white",
  subtitle: "text-gray-600 dark:text-slate-400",
  label: "text-gray-700 dark:text-slate-200",
  helper: "text-gray-500 dark:text-slate-400",
  unit: "text-gray-500 dark:text-slate-400",
  eyebrow:
    "text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400",
  mono: "font-mono tabular-nums",
};

/* -------------------------------------------------------------------- shape */
export const radius = {
  card: "rounded-2xl",
  control: "rounded-lg",
  pill: "rounded-full",
};

export const shadow = {
  card: "shadow-sm",
  floating: "shadow-lg",
};

/* ----------------------------------------------------------------- controls */
/* 44px minimum height on phones, 40px from sm upwards. */
export const control = {
  base:
    "w-full min-h-[44px] sm:min-h-[40px] px-3 py-2 text-sm sm:text-base " +
    "bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 " +
    "border border-gray-300 dark:border-slate-600 rounded-lg " +
    "placeholder-gray-400 dark:placeholder-slate-500 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 " +
    "disabled:opacity-60 disabled:cursor-not-allowed",
  /**
   * Same dimensions and typography as `base`, for panels that are intentionally
   * dark regardless of the application theme (e.g. the slab calculator's dark
   * glass surface). Shares the height, radius and focus ring without repainting
   * the module white.
   */
  onDark:
    "w-full min-h-[44px] sm:min-h-[40px] px-3 py-2 text-sm sm:text-base " +
    "bg-white/5 text-white border border-white/20 rounded-lg " +
    "placeholder-gray-400 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
    "disabled:opacity-60 disabled:cursor-not-allowed",
  invalid:
    "border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500",
  number: "font-mono tabular-nums",
  select: "pr-8 appearance-none",
};

export const action = {
  base:
    "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 " +
    "text-sm font-semibold rounded-lg transition-colors " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
    "focus-visible:ring-blue-500 dark:focus-visible:ring-offset-slate-900 " +
    "disabled:opacity-50 disabled:cursor-not-allowed",
  primary: "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800",
  success: "bg-green-600 text-white hover:bg-green-700 active:bg-green-800",
  secondary:
    "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
  ghost:
    "bg-transparent text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800",
  danger: "bg-red-600 text-white hover:bg-red-700",
  icon:
    "inline-flex items-center justify-center h-11 w-11 rounded-lg " +
    "text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800 " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
};

/* ------------------------------------------------------------------- status */
/* Every status carries a text label; colour is reinforcement only. */
export const status = {
  pass: {
    badge: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
    bar: "bg-green-600",
    border: "border-green-500",
    surface: "bg-green-50 dark:bg-green-900/15",
    icon: "text-green-600 dark:text-green-400",
    label: "PASS",
  },
  fail: {
    badge: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    bar: "bg-red-600",
    border: "border-red-500",
    surface: "bg-red-50 dark:bg-red-900/15",
    icon: "text-red-600 dark:text-red-400",
    label: "FAIL",
  },
  warn: {
    badge: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
    bar: "bg-amber-500",
    border: "border-amber-500",
    surface: "bg-amber-50 dark:bg-amber-900/15",
    icon: "text-amber-600 dark:text-amber-400",
    label: "CHECK",
  },
  info: {
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
    bar: "bg-blue-600",
    border: "border-blue-500",
    surface: "bg-blue-50 dark:bg-blue-900/15",
    icon: "text-blue-600 dark:text-blue-400",
    label: "INFO",
  },
  idle: {
    badge: "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300",
    bar: "bg-gray-400",
    border: "border-gray-300 dark:border-slate-700",
    surface: "bg-gray-50 dark:bg-slate-900/60",
    icon: "text-gray-500 dark:text-slate-400",
    label: "PENDING",
  },
};

/**
 * Utilisation bands shared by every discipline so a 92% shear utilisation reads
 * the same in a beam, a column and a steel member.
 */
export const utilisationBand = (ratio) => {
  if (!Number.isFinite(ratio)) return "idle";
  if (ratio > 1) return "fail";
  if (ratio >= 0.9) return "warn";
  if (ratio >= 0.5) return "pass";
  return "pass";
};

/* --------------------------------------------------------------- breakpoints */
/* Mirrors tailwind defaults so JS that needs a breakpoint stays in one place. */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

/* ------------------------------------------------------------------- layout */
export const layout = {
  pageX: "px-3 sm:px-5 lg:px-8",
  pageY: "py-4 sm:py-6 lg:py-8",
  stack: "space-y-4 sm:space-y-6",
  sectionStack: "space-y-3 sm:space-y-4",
  /* Forms are single column on phones; extra columns appear when they earn it. */
  formGrid: "grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4",
  formGridWide: "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4",
  maxWidth: "max-w-7xl",
};

const tokens = {
  surface,
  text,
  radius,
  shadow,
  control,
  action,
  status,
  utilisationBand,
  breakpoints,
  layout,
};

export default tokens;
