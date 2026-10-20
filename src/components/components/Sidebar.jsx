import { useNavigate } from "react-router-dom";
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
} from "lucide-react";

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

  const handleNavigation = (path) => {
    navigate(path);
    if (window.innerWidth < 1024) onClose();
  };

  // Sample history data. History is not persisted in this build, so it is
  // labelled as sample content rather than presented as saved work.
  const historyItems = [
    { id: 1, title: "Beam Reinforcement Calc", date: "Today", type: "Structural" },
    { id: 2, title: "Foundation Load Analysis", date: "Yesterday", type: "Structural" },
    { id: 3, title: "Site Survey - Sector 4", date: "2 days ago", type: "Surveying" },
    { id: 4, title: "BOQ - Project Alpha", date: "Last week", type: "Quantity Survey" },
    { id: 5, title: "Retaining Wall Design", date: "Last week", type: "Structural" },
    { id: 6, title: "Chat with AI Assistant", date: "2 weeks ago", type: "Chat" },
    { id: 7, title: "Slab Thickness Check", date: "2 weeks ago", type: "Structural" },
  ];

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
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigation(item.path)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-blue-300"
                  >
                    <Icon size={16} aria-hidden="true" className="shrink-0 text-gray-400 dark:text-gray-500" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </nav>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                History
              </h3>
              <Clock size={14} className="text-gray-400 dark:text-gray-500" aria-hidden="true" />
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
              Sample activity — chat history is not stored in this build.
            </p>
            <div className="space-y-2">
              {historyItems.map((item) => (
                <div
                  key={item.id}
                  className="group p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-transparent"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                      {item.type}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      {item.date}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                    <span>Sample</span>
                    <ChevronRight size={10} aria-hidden="true" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
export default Sidebar;
