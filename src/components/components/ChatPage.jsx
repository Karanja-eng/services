import React, { useState } from "react";
import {
  Building2,
  Calculator,
  Ruler,
  ChevronDown,
  ChevronRight,
  Circle,
  DraftingCompass,
  Box
} from "lucide-react";
import bgImage from "../Gemini_Generated_Image_nwcnzmnwcnzmnwcn (1).png";
import { useNavigate } from "react-router-dom";

const ChatPage = ({ renderSearch, isDark }) => {
  const navigate = useNavigate();
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const navData = [
    {
      id: "structural",
      title: "Structural Design",
      icon: Building2,
      color: "from-blue-500 to-blue-700",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      description: "Analysis & Design",
      children: [
        {
          id: "rconcrete",
          title: "Reinforced Concrete",
          type: "section",
          items: [
            { label: "Framed & Tall Buildings", path: "/structural/manual/eurocode_structural_app" },
            { label: "Beams", path: "/structural/manual/beam" },
            { label: "Columns", path: "/structural/manual/column" },
            { label: "Stairs", path: "/structural/manual/stairs" },
            { label: "Retaining Walls", path: "/structural/manual/retaining" },
            { label: "Foundations", path: "/structural/manual/foundation" },
            { label: "Walls", path: "/structural/manual/wall" },
            { label: "Slabs", path: "/structural/manual/slabs" },
          ]
        },
        {
          id: "steel",
          title: "Steel Design",
          type: "section",
          items: [
            { label: "Member Design", path: "/structural/manual/steel" },
            { label: "Weld Connections", path: "/structural/automatic/weld_connections" },
            { label: "Bolt Connections", path: "/structural/automatic/bolt_connections" },
          ]
        }
      ]
    },
    {
      id: "quantity",
      title: "Quantity Survey",
      icon: Calculator,
      color: "from-emerald-500 to-emerald-700",
      bg: "bg-emerald-50 dark:bg-emerald-900/20 ",
      description: "Taking off & BOQ",
      children: [
        {
          id: "qs_manual",
          title: "Manual Taking Off",
          type: "section",
          items: [
            { label: "Taking Off", path: "/quantity/manual/taking-off" },
            { label: "Dimension Paper", path: "/quantity/manual/approximate" },
            { label: "Bill of Quantities", path: "/quantity/manual/boq" },

            { label: "Substructure Works", path: "/quantity/manual/substructure_works" },
            { label: "Superstructure", path: "/quantity/manual/superstructure-takeoff" },
            { label: "RCC Superstructure", path: "/quantity/manual/rcc-superstructure" },
            { label: "Roof Works", path: "/quantity/manual/roof-taking-off" },
            { label: "External Works", path: "/quantity/manual/external-taking-off" },
            { label: "Drainage", path: "/quantity/manual/drainage-taking-off" },
            { label: "Doors & Windows", path: "/quantity/manual/door_window" },
            { label: "Internal Finishes", path: "/quantity/manual/internal_finishes" },
            { label: "Electrical & Plumbing", path: "/quantity/manual/electrical_plumbing" },
            { label: "Underground Tank", path: "/quantity/manual/Underground_tank" },
            { label: "Basement", path: "/quantity/manual/basement-taking-off" },
            { label: "Stairs", path: "/quantity/manual/staircase_takeoff" },
            { label: "Septic Tank", path: "/quantity/manual/septic-taking-off" },
            { label: "Swimming Pool", path: "/quantity/manual/swimming-pool-taking-off" },

          ]
        }
      ]
    },
    {
      id: "surveying_tools",
      title: "Surveying & CAD",
      icon: Ruler,
      color: "from-amber-500 to-amber-700",
      bg: "bg-amber-50 dark:bg-amber-900/20",
      description: "Map & Draw",
      children: [
        {
          id: "surveying_main",
          title: "Surveying Tools",
          type: "section",
          items: [
            { label: "Main Surveying App", path: "/surveying" }
          ]
        },
        {
          id: "drawing_tools",
          title: "Drawing & 3D",
          type: "section",
          items: [
            { label: "2D CAD Drawer", path: "/drawing" },
            { label: "3D Visualization", path: "/visualise" }
          ]
        }
      ]
    }
  ];

  return (
    <div className="relative h-full w-full overflow-hidden flex flex-col items-center justify-center p-4 bg-transparent">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img
          src={bgImage}
          alt="Civil Engineering Background"
          className="w-full h-full object-cover"
        />
        <div className={`absolute inset-0 backdrop-blur-[1px] transition-colors duration-500 ${isDark ? 'bg-gradient-to-br from-gray-900/80 via-gray-900/80 to-blue-950/80' : 'bg-gradient-to-br from-blue-50/40 via-white/40 to-blue-100/40'}`} />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl flex flex-col items-center h-full pt-12 pb-12">
        <div className="text-center mb-24 space-y-2 flex-shrink-0 w-full flex flex-col items-center">
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-md">
            <span className="text-blue-600 dark:text-blue-400">Welcome Fundi</span> Let's Build
          </h1>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-xl mx-auto drop-shadow-sm">
            Professional tools for every stage.
          </p>

          {/* Render Search Here */}
          <div className="w-full max-w-xl mt-4 z-50">
            {renderSearch && renderSearch()}
          </div>
        </div>

        <div className="flex-1 w-full overflow-hidden flex items-start justify-center">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full px-4 max-w-6xl">
            {navData.map((feature) => (
              <div
                key={feature.id}
                className="bg-white/40 dark:bg-black/30 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-xl overflow-hidden flex flex-col shadow-lg h-full max-h-[50vh]"
              >
                {/* Header */}
                <div className={`p-3 bg-gradient-to-r ${feature.color} text-white flex items-center gap-3 shrink-0`}>
                  <div className="p-1.5 bg-white/20 rounded-lg">
                    <feature.icon size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">{feature.title}</h3>
                    <p className="text-[10px] text-white/80">{feature.description}</p>
                  </div>
                </div>

                {/* Body - SCROLLABLE */}
                <div className="p-2 overflow-y-auto custom-scrollbar space-y-2 flex-1">
                  {feature.children.map((section) => (
                    <div key={section.id} className="bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5 overflow-hidden">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSection(section.id); }}
                        className="w-full flex items-center justify-between p-2 text-xs font-medium text-gray-900 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          {section.id.includes('concrete') && <Box size={12} className="text-blue-600 dark:text-blue-300" />}
                          {section.id.includes('steel') && <DraftingCompass size={12} className="text-blue-600 dark:text-blue-300" />}
                          {section.id.includes('qs') && <Calculator size={12} className="text-emerald-600 dark:text-emerald-300" />}
                          {section.title}
                        </span>
                        {expandedSections[section.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>

                      {/* Dropdown Items */}
                      {expandedSections[section.id] && (
                        <div className="bg-black/5 dark:bg-black/20 p-1 space-y-0.5">
                          {section.items.map((item, idx) => (
                            <button
                              key={idx}
                              onClick={(e) => { e.stopPropagation(); navigate(item.path); }}
                              className="w-full text-left p-1.5 text-[11px] text-gray-700 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded transition-all pl-5 relative"
                            >
                              <span className="absolute left-1.5 top-1/2 -translate-y-1/2">
                                <Circle size={3} className="fill-current" />
                              </span>
                              {item.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
};

export default ChatPage;
