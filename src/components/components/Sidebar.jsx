import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Clock,
  X,
  ChevronRight,
  House,
  Building2,
  Calculator,
  Ruler,
  Box,
  LayoutGrid,
  Trash2,
} from "lucide-react";
import { getToolMeta } from "../../navigation/toolRegistry";
import { readRecentTools, clearRecentTools } from "../../state/recentTools";

// Navigation destinations owned by the sidebar. Each path exists in the route
// table in engineering_appp.jsx.
const NAV_ITEMS = [
  { id: "home", label: "Home", path: "/", icon: House },
  {
    id: "structural",
    label: "Structural design",
    path: "/structural/manual/beam",
    icon: Building2,
  },
  {
    id: "quantity",
    label: "Quantity & surveying",
    path: "/quantity/manual/taking-off",
    icon: Calculator,
  },
  { id: "cad", label: "CAD & 3D", path: "/drawing", icon: Ruler },
  {
    id: "interop",
    label: "CAD / BIM / IFC",
    path: "/interop/cad-bim",
    icon: Box,
  },
];

// Sidebar Component: navigation + (sample) history. Settings stay in RightSidebar.
const Sidebar = ({ isOpen, onClose, isDark }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // The active tool is derived from the shared route registry so the drawer and
  // the header can never disagree about "where am I?".
  const activeTool = getToolMeta(location.pathname);

  const isNavItemActive = (item) => {
    if (item.path === "/") return location.pathname === "/";
    if (item.path === "/structural/manual/beam") {
      return location.pathname.startsWith("/structural/");
    }
    if (item.path === "/quantity/manual/taking-off") {
      return location.pathname.startsWith("/quantity/");
    }
    if (item.path === "/drawing") {
      return (
        (location.pathname.startsWith("/drawing") &&
          !location.pathname.startsWith("/drawing/dimensions")) ||
        location.pathname === "/visualise"
      );
    }
    if (item.path === "/interop/cad-bim") {
      return location.pathname.startsWith("/interop/");
    }
    return location.pathname === item.path;
  };

  const handleNavigation = (path) => {
    navigate(path);
    if (window.innerWidth < 1024) onClose();
  };

  // Stop the page behind the drawer from scrolling while it is open (phones).
  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // Recent tools are read from localStorage each time the drawer opens, so the
  // list reflects navigation even though the shell is not re-mounted.
  const [recentTools, setRecentTools] = useState([]);

  useEffect(() => {
    if (isOpen) setRecentTools(readRecentTools());
  }, [isOpen, location.pathname]);

  const handleClearHistory = () => {
    clearRecentTools();
    setRecentTools([]);
  };

  const formatRelative = (timestamp) => {
    const diff = Date.now() - Number(timestamp || 0);
    if (!Number.isFinite(diff) || diff < 0) return "Just now";
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? "Yesterday" : `${days} days ago`;
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-[45] bg-black/20 backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation and history"
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white/60 dark:bg-gray-900/60 backdrop-blur-md border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"
          } shadow-2xl flex flex-col`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <LayoutGrid size={20} className="text-blue-600 dark:text-blue-400" />
            Workspace
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Close navigation and history"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <nav aria-label="Primary">
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Navigate
            </h3>
            <div className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigation(item.path)}
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      active
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200"
                        : "text-gray-700 hover:bg-blue-50 hover:text-blue-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-blue-300"
                    }`}
                  >
                    <Icon
                      size={16}
                      aria-hidden="true"
                      className={`shrink-0 ${
                        active ? "text-blue-600 dark:text-blue-300" : "text-gray-400 dark:text-gray-500"
                      }`}
                    />
                    <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                    {active && (
                      <span className="shrink-0 rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                        Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Current tool — keeps the active workflow identifiable on phones. */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60">
            <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Current tool
            </h3>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {activeTool.title}
            </p>
            <button
              type="button"
              onClick={() => handleNavigation("/")}
              className="mt-2 inline-flex min-h-[36px] items-center gap-1 rounded-lg text-xs font-semibold text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300"
            >
              Open tool directory
              <ChevronRight size={12} aria-hidden="true" />
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Recent tools
              </h3>
              <div className="flex items-center gap-1">
                {recentTools.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-500 dark:hover:bg-gray-800"
                    aria-label="Clear recent tools history"
                    title="Clear history"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                )}
                <Clock size={14} className="text-gray-400 dark:text-gray-500" aria-hidden="true" />
              </div>
            </div>

            {recentTools.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-300 p-3 text-[11px] leading-relaxed text-gray-500 dark:border-gray-700 dark:text-gray-400">
                No tools opened yet. Tools you open are listed here; only the tool
                name and route are stored on this device.
              </p>
            ) : (
              <>
                <p className="mb-2 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
                  Stored on this device only (tool name and route). No project data.
                </p>
                <div className="space-y-2">
                  {recentTools.map((item) => (
                    <button
                      key={`${item.path}-${item.visitedAt}`}
                      type="button"
                      onClick={() => handleNavigation(item.path)}
                      className="group w-full rounded-xl border border-transparent bg-gray-50 p-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-gray-800 dark:hover:border-blue-900 dark:hover:bg-gray-700/70"
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                          {item.group || "Tool"}
                        </span>
                        <span className="shrink-0 text-[10px] text-gray-500 dark:text-gray-400">
                          {formatRelative(item.visitedAt)}
                        </span>
                      </div>
                      <h4 className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                        {item.title}
                      </h4>
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                        <span className="truncate">{item.path}</span>
                        <ChevronRight size={10} aria-hidden="true" className="shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
export default Sidebar;
