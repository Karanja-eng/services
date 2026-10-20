import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Box,
  Building2,
  Calculator,
  ChevronRight,
  FolderOpen,
  Ruler,
  Search,
  X,
} from "lucide-react";
import bgImage from "../Gemini_Generated_Image_nwcnzmnwcnzmnwcn (1).png";
import { useNavigate } from "react-router-dom";

/**
 * Home data.
 *
 * Every entry points at a route that already exists in
 * `src/components/engineering_appp.jsx`. Keep those two lists in sync: the
 * home page must never send a user to a route the app does not render.
 */
const QUICK_ACTIONS = [
  {
    id: "structural",
    label: "Structural design",
    description: "Beams, columns, slabs, foundations and frames.",
    path: "/structural/manual/beam",
    icon: Building2,
    iconClass: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300",
  },
  {
    id: "measurement",
    label: "Drawing measurement",
    description: "Dimensions, annotation and drawing-based quantities.",
    path: "/drawing/dimensions",
    icon: Ruler,
    iconClass: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300",
  },
  {
    id: "boq",
    label: "BOQ creation",
    description: "Turn a measured takeoff into a bill of quantities.",
    path: "/quantity/manual/boq",
    icon: Calculator,
    iconClass:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  {
    id: "cad",
    label: "CAD/3D inspection",
    description: "Open CAD, IFC and BIM models in the workbench.",
    path: "/interop/cad-bim",
    icon: Box,
    iconClass:
      "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300",
  },
];

const TOOL_GROUPS = [
  {
    id: "structural",
    title: "Structural design",
    cardTitle: "Structural design",
    buttonLabel: "structural design",
    description:
      "Concrete, steel, timber and masonry design with geotechnical checks.",
    icon: Building2,
    iconClass: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300",
    chipClass:
      "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-200 dark:hover:bg-blue-900/50",
    borderHover:
      "hover:border-blue-300 dark:hover:border-blue-800",
    sections: [
      {
        id: "reinforced-concrete",
        title: "Reinforced concrete",
        items: [
          {
            label: "Framed & Tall Buildings",
            path: "/structural/manual/eurocode_structural_app",
          },
          { label: "Beams", path: "/structural/manual/beam" },
          { label: "Columns", path: "/structural/manual/column" },
          { label: "Stairs", path: "/structural/manual/stairs" },
          { label: "Retaining Walls", path: "/structural/manual/retaining" },
          { label: "Foundations", path: "/structural/manual/foundation" },
          { label: "Walls", path: "/structural/manual/wall" },
          { label: "Slabs", path: "/structural/manual/slabs" },
        ],
      },
      {
        id: "steel",
        title: "Steel design",
        items: [
          { label: "Member Design", path: "/structural/manual/steel" },
          {
            label: "Weld Connections",
            path: "/structural/automatic/weld_connections",
          },
          {
            label: "Bolt Connections",
            path: "/structural/automatic/bolt_connections",
          },
        ],
      },
      {
        id: "materials-ground",
        title: "Timber, masonry & ground",
        items: [
          { label: "Timber Design", path: "/structural/manual/Timber_design" },
          {
            label: "Masonry Design",
            path: "/structural/manual/Masonry_design",
          },
          { label: "Soil Mechanics", path: "/surveying/soil-mechanics" },
        ],
      },
    ],
  },
  {
    id: "quantity",
    title: "Quantity & surveying",
    cardTitle: "Quantity & surveying",
    buttonLabel: "quantity and surveying",
    description:
      "Measured takeoffs, bills of quantities and site surveying tools.",
    icon: Calculator,
    iconClass:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300",
    chipClass:
      "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900/50",
    borderHover:
      "hover:border-emerald-300 dark:hover:border-emerald-800",
    sections: [
      {
        id: "quantity-surveying",
        title: "Quantity surveying",
        items: [
          { label: "Taking Off", path: "/quantity/manual/taking-off" },
          { label: "Dimension Paper", path: "/quantity/manual/approximate" },
          { label: "Bill of Quantities", path: "/quantity/manual/boq" },
          { label: "Takeoff Documents", path: "/quantity/manual/documents" },
          {
            label: "Substructure Works",
            path: "/quantity/manual/substructure_works",
          },
          {
            label: "Superstructure",
            path: "/quantity/manual/superstructure-takeoff",
          },
          {
            label: "RCC Superstructure",
            path: "/quantity/manual/rcc-superstructure",
          },
          { label: "Roof Works", path: "/quantity/manual/roof-taking-off" },
          {
            label: "External Works",
            path: "/quantity/manual/external-taking-off",
          },
          { label: "Drainage", path: "/quantity/manual/drainage-taking-off" },
          { label: "Doors & Windows", path: "/quantity/manual/door_window" },
          {
            label: "Internal Finishes",
            path: "/quantity/manual/internal_finishes",
          },
          {
            label: "Electrical & Plumbing",
            path: "/quantity/manual/electrical_plumbing",
          },
          {
            label: "Underground Tank",
            path: "/quantity/manual/Underground_tank",
          },
          { label: "Basement", path: "/quantity/manual/basement-taking-off" },
          {
            label: "Stairs",
            path: "/quantity/manual/staircase_takeoff",
          },
          { label: "Septic Tank", path: "/quantity/manual/septic-taking-off" },
          {
            label: "Swimming Pool",
            path: "/quantity/manual/swimming-pool-taking-off",
          },
        ],
      },
      {
        id: "surveying",
        title: "Surveying",
        items: [
          { label: "Main Surveying App", path: "/surveying" },
          {
            label: "Setting Out & Construction",
            path: "/surveying/setting-out",
          },
          { label: "Earthworks", path: "/surveying/earthworks" },
          {
            label: "Contouring & Terrain",
            path: "/surveying/contouring",
          },
          {
            label: "Deformation & Monitoring",
            path: "/surveying/monitoring",
          },
          { label: "Geoid & GNSS", path: "/surveying/geoid-model" },
          { label: "Road & Railway Design", path: "/surveying/road-railway" },
          {
            label: "Utilities & Infrastructure",
            path: "/surveying/utilities",
          },
        ],
      },
    ],
  },
  {
    id: "cad",
    title: "CAD & 3D",
    cardTitle: "CAD & 3D",
    buttonLabel: "CAD and 3D",
    description:
      "Drawing, measurement, visualisation and CAD/IFC model inspection.",
    icon: Ruler,
    iconClass: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300",
    chipClass:
      "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50",
    borderHover:
      "hover:border-amber-300 dark:hover:border-amber-800",
    sections: [
      {
        id: "drawing",
        title: "Drawing & visualisation",
        items: [
          { label: "2D CAD Drawer", path: "/drawing" },
          { label: "3D Visualization", path: "/visualise" },
          { label: "CAD / BIM / IFC Workbench", path: "/interop/cad-bim" },
          { label: "Road & Site Design", path: "/drawing/roads" },
          { label: "Columns & Beams", path: "/drawing/columns_beams" },
          { label: "Roof Structure", path: "/drawing/roof_structure" },
          { label: "Slab Designer", path: "/drawing/slabs" },
          { label: "Dimensions & Annotations", path: "/drawing/dimensions" },
          { label: "Material & Rendering", path: "/drawing/materials" },
          { label: "Electrical Systems", path: "/drawing/electrical" },
          { label: "Plumbing & Drainage", path: "/drawing/plumbing" },
        ],
      },
    ],
  },
];

const TOTAL_TOOL_COUNT = TOOL_GROUPS.reduce(
  (total, group) =>
    total +
    group.sections.reduce((sectionTotal, section) => sectionTotal + section.items.length, 0),
  0
);

/**
 * Projects are data-driven. No project store is connected to this build yet, so
 * the source is deliberately empty: the home page never invents saved projects
 * or pretends that work has been persisted.
 */
const SAVED_PROJECTS = [];

const QuickActionCard = ({ action, onNavigate }) => {
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={() => onNavigate(action.path)}
      className="group flex h-full flex-col rounded-2xl border border-gray-200/80 bg-white/75 p-3.5 text-left shadow-sm backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-800 dark:bg-gray-900/70 dark:hover:border-blue-800 sm:p-4"
    >
      <span className="flex w-full items-center justify-between">
        <span className={`rounded-xl p-2 ${action.iconClass}`}>
          <Icon size={18} aria-hidden="true" />
        </span>
        <ArrowRight
          size={16}
          aria-hidden="true"
          className="text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400"
        />
      </span>
      <span className="mt-3 block text-sm font-semibold text-gray-900 dark:text-white">
        {action.label}
      </span>
      <span className="mt-1 block text-[11px] leading-relaxed text-gray-600 dark:text-gray-400">
        {action.description}
      </span>
    </button>
  );
};

const CategoryCard = ({ group, onNavigate, onOpenDirectory }) => {
  const Icon = group.icon;
  const itemCount = group.sections.reduce(
    (total, section) => total + section.items.length,
    0
  );
  const featured = group.sections
    .flatMap((section) => section.items)
    .slice(0, 3);

  return (
    <article
      className={`flex flex-col rounded-2xl border border-gray-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-md transition-colors dark:border-gray-800 dark:bg-gray-900/70 ${group.borderHover}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-xl p-2 ${group.iconClass}`}>
          <Icon size={18} aria-hidden="true" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {itemCount} tools
        </span>
      </div>
      <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
        {group.cardTitle}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
        {group.description}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {featured.map((item) => (
          <button
            key={item.path}
            type="button"
            onClick={() => onNavigate(item.path)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${group.chipClass}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={(event) => onOpenDirectory(group.id, event.currentTarget)}
        className="mt-4 inline-flex items-center gap-1 self-start rounded text-xs font-semibold text-blue-700 transition-colors hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
      >
        Browse all {group.buttonLabel} tools
        <ArrowRight size={12} aria-hidden="true" />
      </button>
    </article>
  );
};

const ToolDirectoryDialog = ({
  open,
  dialogRef,
  searchRef,
  query,
  setQuery,
  activeGroup,
  setActiveGroup,
  allGroups,
  groups,
  resultCount,
  onClose,
  onNavigate,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-gray-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tool-directory-title"
        aria-describedby="tool-directory-description"
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 sm:max-h-[85vh] sm:max-w-4xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-4 py-3 dark:border-gray-800 sm:px-6 sm:py-4">
          <div>
            <h2
              id="tool-directory-title"
              className="text-base font-semibold text-gray-900 dark:text-white"
            >
              All tools
            </h2>
            <p
              id="tool-directory-description"
              className="mt-0.5 text-xs text-gray-500 dark:text-gray-400"
            >
              Every engineering module and its existing route.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tool directory"
            className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800 sm:px-6">
          <div
            role="group"
            aria-label="Filter tools by category"
            className="custom-scrollbar flex gap-1.5 overflow-x-auto pb-1"
          >
            {[{ id: "all", title: "All" }, ...allGroups].map((group) => (
              <button
                key={group.id}
                type="button"
                aria-pressed={activeGroup === group.id}
                onClick={() => setActiveGroup(group.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  activeGroup === group.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                {group.title}
              </button>
            ))}
          </div>

          <label htmlFor="tool-directory-search" className="sr-only">
            Search tools
          </label>
          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              ref={searchRef}
              id="tool-directory-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tools, e.g. beam, BOQ, roof, IFC"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>

          <p
            aria-live="polite"
            className="text-[11px] text-gray-500 dark:text-gray-400"
          >
            {resultCount} {resultCount === 1 ? "tool" : "tools"} shown
          </p>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-3 sm:px-6">
          {resultCount === 0 ? (
            <div className="py-12 text-center">
              <Search
                size={22}
                aria-hidden="true"
                className="mx-auto text-gray-400"
              />
              <p className="mt-3 text-sm font-medium text-gray-800 dark:text-gray-200">
                No tools match "{query}".
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-2 text-xs font-semibold text-blue-700 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map((group) => (
                <section
                  key={group.id}
                  aria-labelledby={`tool-group-${group.id}`}
                >
                  <h3
                    id={`tool-group-${group.id}`}
                    className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    {group.title}
                  </h3>
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {group.sections.map((section) => (
                      <div
                        key={section.id}
                        className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-950/40"
                      >
                        <h4 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                          {section.title}
                        </h4>
                        <ul className="mt-1.5 space-y-0.5">
                          {section.items.map((item) => (
                            <li key={item.path}>
                              <button
                                type="button"
                                onClick={() => onNavigate(item.path)}
                                className="group flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-gray-700 transition-colors hover:bg-white hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-blue-300"
                              >
                                <span className="truncate">{item.label}</span>
                                <ChevronRight
                                  size={12}
                                  aria-hidden="true"
                                  className="shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5"
                                />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-4 py-3 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400 sm:px-6">
          All {TOTAL_TOOL_COUNT} tool routes are preserved. Press Esc to close.
        </div>
      </div>
    </div>
  );
};

const ChatPage = ({ renderSearch, isDark }) => {
  const navigate = useNavigate();
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [directoryGroup, setDirectoryGroup] = useState("all");
  const [directoryQuery, setDirectoryQuery] = useState("");

  const dialogRef = useRef(null);
  const searchRef = useRef(null);
  const directoryTriggerRef = useRef(null);

  const openDirectory = useCallback((groupId = "all", trigger = null) => {
    directoryTriggerRef.current = trigger;
    setDirectoryGroup(groupId);
    setDirectoryQuery("");
    setDirectoryOpen(true);
  }, []);

  const closeDirectory = useCallback(() => {
    setDirectoryOpen(false);
    const trigger = directoryTriggerRef.current;
    directoryTriggerRef.current = null;
    if (trigger && typeof trigger.focus === "function") {
      window.requestAnimationFrame(() => trigger.focus());
    }
  }, []);

  const goToTool = useCallback(
    (path) => {
      setDirectoryOpen(false);
      navigate(path);
    },
    [navigate]
  );

  const filteredGroups = useMemo(() => {
    const query = directoryQuery.trim().toLowerCase();
    return TOOL_GROUPS.filter(
      (group) => directoryGroup === "all" || group.id === directoryGroup
    )
      .map((group) => ({
        ...group,
        sections: group.sections
          .map((section) => ({
            ...section,
            items: section.items.filter((item) => {
              if (!query) return true;
              const haystack = `${group.title} ${section.title} ${item.label} ${item.path}`.toLowerCase();
              return haystack.includes(query);
            }),
          }))
          .filter((section) => section.items.length > 0),
      }))
      .filter((group) => group.sections.length > 0);
  }, [directoryGroup, directoryQuery]);

  const resultCount = useMemo(
    () =>
      filteredGroups.reduce(
        (total, group) =>
          total +
          group.sections.reduce(
            (sectionTotal, section) => sectionTotal + section.items.length,
            0
          ),
        0
      ),
    [filteredGroups]
  );

  // Escape closes the directory; Tab is kept inside the modal while it is open.
  useEffect(() => {
    if (!directoryOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeDirectory();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const nodes = Array.from(focusable).filter(
        (node) => node.offsetParent !== null
      );
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [directoryOpen, closeDirectory]);

  return (
    <div className="relative min-h-full w-full">
      {/* Background image with theme-aware overlay (theme is owned by AppLayout). */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <img
          src={bgImage}
          alt=""
          className="h-full w-full object-cover opacity-25 dark:opacity-10"
        />
        <div
          className={`absolute inset-0 transition-colors duration-500 ${
            isDark
              ? "bg-gradient-to-br from-gray-950/95 via-gray-950/90 to-blue-950/90"
              : "bg-gradient-to-br from-white/95 via-blue-50/90 to-gray-50/95"
          }`}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-16 pt-16 sm:px-6 sm:pt-20">
        {/* Agent input is the primary interaction. */}
        <section aria-labelledby="home-heading" className="text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700 backdrop-blur dark:border-blue-900/60 dark:bg-gray-900/60 dark:text-blue-300">
            <span
              className="h-1.5 w-1.5 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            Fundi Studio · Agent workspace
          </p>
          <h1
            id="home-heading"
            className="mt-4 text-2xl font-bold tracking-tight text-gray-900 drop-shadow-sm dark:text-white sm:text-4xl"
          >
            What are we engineering today?
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            Describe the task in your own words, or jump straight into a tool.
            Every engineering module stays one step away.
          </p>

          <div className="mx-auto mt-6 w-full max-w-2xl text-left">
            {renderSearch ? renderSearch() : null}
          </div>
          <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
            Enter to send · Shift + Enter for a new line · Attach drawings or
            schedules
          </p>
        </section>

        {/* Four quick actions, each backed by an existing route. */}
        <section aria-labelledby="quick-actions-heading" className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="quick-actions-heading"
                className="text-sm font-semibold text-gray-900 dark:text-white"
              >
                Quick actions
              </h2>
              <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                Start from a common engineering task.
              </p>
            </div>
            <span className="shrink-0 text-[11px] text-gray-500 dark:text-gray-400">
              {TOTAL_TOOL_COUNT} tools available
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {QUICK_ACTIONS.map((action) => (
              <QuickActionCard
                key={action.id}
                action={action}
                onNavigate={navigate}
              />
            ))}
          </div>
        </section>

        {/* Compact category cards replace the old oversized accordion panels. */}
        <section aria-labelledby="tool-categories-heading" className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="tool-categories-heading"
                className="text-sm font-semibold text-gray-900 dark:text-white"
              >
                Tool categories
              </h2>
              <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                Compact entry points. Open the directory for the full list.
              </p>
            </div>
            <button
              type="button"
              onClick={(event) => openDirectory("all", event.currentTarget)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm backdrop-blur transition-colors hover:border-blue-300 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-200 dark:hover:border-blue-800 dark:hover:text-blue-300"
            >
              All tools
              <span className="font-normal text-gray-500 dark:text-gray-400">
                ({TOTAL_TOOL_COUNT})
              </span>
              <ArrowRight size={12} aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
            {TOOL_GROUPS.map((group) => (
              <CategoryCard
                key={group.id}
                group={group}
                onNavigate={navigate}
                onOpenDirectory={openDirectory}
              />
            ))}
          </div>
        </section>

        {/* Data-driven projects area; no persistence is simulated. */}
        <section aria-labelledby="projects-heading" className="mt-10">
          <h2
            id="projects-heading"
            className="text-sm font-semibold text-gray-900 dark:text-white"
          >
            Projects
          </h2>
          {SAVED_PROJECTS.length > 0 ? (
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SAVED_PROJECTS.map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => navigate(project.path)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/80 px-4 py-3 text-left shadow-sm transition-colors hover:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-800 dark:bg-gray-900/70 dark:hover:border-blue-800"
                  >
                    <span>
                      <span className="block text-sm font-medium text-gray-900 dark:text-white">
                        {project.name}
                      </span>
                      <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                        {project.detail}
                      </span>
                    </span>
                    <ArrowRight
                      size={14}
                      aria-hidden="true"
                      className="shrink-0 text-gray-400"
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-white/60 px-6 py-8 text-center backdrop-blur dark:border-gray-700 dark:bg-gray-900/50">
              <span className="rounded-xl bg-gray-100 p-2.5 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <FolderOpen size={18} aria-hidden="true" />
              </span>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                No saved projects
              </p>
              <p className="max-w-md text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                Projects you save will appear here once a project store is
                connected. This build does not persist project data.
              </p>
            </div>
          )}
        </section>
      </div>

      <ToolDirectoryDialog
        open={directoryOpen}
        dialogRef={dialogRef}
        searchRef={searchRef}
        query={directoryQuery}
        setQuery={setDirectoryQuery}
        activeGroup={directoryGroup}
        setActiveGroup={setDirectoryGroup}
        allGroups={TOOL_GROUPS}
        groups={filteredGroups}
        resultCount={resultCount}
        onClose={closeDirectory}
        onNavigate={goToTool}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(107, 114, 128, 0.35);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(107, 114, 128, 0.55);
        }
      `}</style>
    </div>
  );
};

export default ChatPage;
