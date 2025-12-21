import { useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Clock,
  X,
  ChevronRight
} from "lucide-react";

// Sidebar Component
const Sidebar = ({ isOpen, onClose, isDark }) => {
  const navigate = useNavigate();

  const handleNavigation = (path) => {
    navigate(path);
    if (window.innerWidth < 1024) onClose();
  };

  // Mock history data
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
    <div
      className={`fixed inset-y-0 left-0 z-50 w-72 bg-white/60 dark:bg-gray-900/60 backdrop-blur-md border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"
        } shadow-2xl flex flex-col`}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
          <Clock size={20} />
          History
        </h2>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
          aria-label="Close sidebar"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {historyItems.map((item) => (
          <div
            key={item.id}
            className="group p-4 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer transition-all duration-200 border border-transparent hover:border-blue-200 dark:hover:border-blue-900"
            onClick={() => handleNavigation("/")} // For now just navigate home or to a dummy route
          >
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                {item.type}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {item.date}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-blue-700 dark:group-hover:text-white transition-colors">
              {item.title}
            </h3>
            <div className="flex items-center gap-1 mt-2 text-xs text-gray-500 group-hover:text-blue-500 transition-colors">
              <span>View details</span>
              <ChevronRight size={12} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default Sidebar;
