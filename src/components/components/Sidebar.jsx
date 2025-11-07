import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Building2,
  ChevronDown,
  ChevronRight,
  Calculator,
} from "lucide-react";

// Sidebar Component
const Sidebar = ({ isOpen, onClose, isDark }) => {
  const [structuralOpen, setStructuralOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [automaticOpen, setAutomaticOpen] = useState(false);
  const [quantityOpen, setQuantityOpen] = useState(false);
  const [qsManualOpen, setQsManualOpen] = useState(false);
  const [qsAutomaticOpen, setQsAutomaticOpen] = useState(false);
  const navigate = useNavigate();

  const handleNavigation = (path) => {
    navigate(path);
    if (window.innerWidth < 1024) onClose();
  };

  return (
    <div
      className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      } overflow-y-auto`}
    >
      <div className="p-4 space-y-2">
        {/* Chat */}
        <button
          onClick={() => handleNavigation("/")}
          className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <MessageSquare size={20} />
          <span className="font-medium">Chat</span>
        </button>

        {/* Structural */}
        <div>
          <button
            onClick={() => setStructuralOpen(!structuralOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-3">
              <Building2 size={20} />
              <span className="font-medium">Structural</span>
            </div>
            {structuralOpen ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>

          {structuralOpen && (
            <div className="ml-4 mt-2 space-y-1">
              <div>
                <button
                  onClick={() => setManualOpen(!manualOpen)}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                >
                  <span>RConcrete</span>
                  {manualOpen ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </button>
                {manualOpen && (
                  <div className="ml-4 mt-1 space-y-1">
                    <button
                      onClick={() =>
                        handleNavigation("/structural/manual/beam")
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Beam
                    </button>
                    <button
                      onClick={() =>
                        handleNavigation("/structural/manual/column")
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Column
                    </button>
                    <button
                      onClick={() =>
                        handleNavigation("/structural/manual/stairs")
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Stairs
                    </button>
                    <button
                      onClick={() =>
                        handleNavigation("/structural/manual/retaining")
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Retaining
                    </button>
                    <button
                      onClick={() =>
                        handleNavigation("/structural/manual/foundation")
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Foundation
                    </button>
                    <button
                      onClick={() =>
                        handleNavigation("/structural/manual/wall")
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Wall
                    </button>
                    <button
                      onClick={() =>
                        handleNavigation("/structural/manual/slabs")
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Slabs
                    </button>
                  </div>
                )}
              </div>

              {/* */}

              <div>
                <button
                  onClick={() => setAutomaticOpen(!automaticOpen)}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                >
                  <span>Steel</span>
                  {automaticOpen ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </button>
                {automaticOpen && (
                  <div className="ml-4 mt-1 space-y-1">
                    <button
                      onClick={() =>
                        handleNavigation("/structural/manual/steel")
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Member Design
                    </button>
                    <button
                      onClick={() =>
                        handleNavigation(
                          "/structural/automatic/weld_connections"
                        )
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Weld Joints
                    </button>
                    <button
                      onClick={() =>
                        handleNavigation(
                          "/structural/automatic/bolt_connections"
                        )
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Bolt Connection
                    </button>
                  </div>
                )}
              </div>
              {/**   */}
              <div>
                <button
                  onClick={() => setAutomaticOpen(!automaticOpen)}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                >
                  <span>Automatic</span>
                  {automaticOpen ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </button>
                {automaticOpen && (
                  <div className="ml-4 mt-1 space-y-1">
                    <button
                      onClick={() =>
                        handleNavigation("/structural/automatic/scan")
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Scan Plan
                    </button>
                    <button
                      onClick={() =>
                        handleNavigation("/structural/automatic/analyze")
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Analyze
                    </button>
                    <button
                      onClick={() =>
                        handleNavigation("/structural/automatic/inspect")
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Inspect
                    </button>
                    <button
                      onClick={() =>
                        handleNavigation("/structural/automatic/download")
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Download
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quantity Survey */}
        <div>
          <button
            onClick={() => setQuantityOpen(!quantityOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-3">
              <Calculator size={20} />
              <span className="font-medium">Quantity Survey</span>
            </div>
            {quantityOpen ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>

          {quantityOpen && (
            <div className="ml-4 mt-2 space-y-1">
              <div>
                <button
                  onClick={() => setQsManualOpen(!qsManualOpen)}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                >
                  <span>Manual</span>
                  {qsManualOpen ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </button>
                {qsManualOpen && (
                  <div className="ml-4 mt-1 space-y-1">
                    <button
                      onClick={() =>
                        handleNavigation("/quantity/manual/taking-off")
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Taking Off
                    </button>
                    <button
                      onClick={() =>
                        handleNavigation("/quantity/manual/approximate")
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Approximate Quantity
                    </button>
                    <button
                      onClick={() => handleNavigation("/quantity/manual/boq")}
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Bill of Quantity
                    </button>
                    <button
                      onClick={() =>
                        handleNavigation("/quantity/manual/individual-members")
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Individual Members
                    </button>
                  </div>
                )}
              </div>
              <div>
                <button
                  onClick={() => setQsAutomaticOpen(!qsAutomaticOpen)}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                >
                  <span>Automatic</span>
                  {qsAutomaticOpen ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </button>
                {qsAutomaticOpen && (
                  <div className="ml-4 mt-1 space-y-1">
                    <button
                      onClick={() =>
                        handleNavigation("/quantity/automatic/scan")
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Scan Plan
                    </button>
                    <button
                      onClick={() =>
                        handleNavigation("/quantity/automatic/analyze")
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Analyze
                    </button>
                    <button
                      onClick={() =>
                        handleNavigation("/quantity/automatic/inspect")
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Inspect
                    </button>
                    <button
                      onClick={() =>
                        handleNavigation("/quantity/automatic/download")
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Download
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {/* Surveying */}
        <button
          onClick={() => handleNavigation("/surveying")}
          className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          {/* You can use a suitable icon here, e.g., Calculator or MessageSquare or add a new one */}
          <Calculator size={20} />
          <span className="font-medium">Surveying</span>
        </button>

        {/* Drawing */}
        <button
          onClick={() => handleNavigation("/drawing")}
          className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          {/* You can use a suitable icon here, e.g., MessageSquare or add a new one */}
          <MessageSquare size={20} />
          <span className="font-medium">Drawing</span>
        </button>
      </div>
    </div>
  );
};
export default Sidebar;
