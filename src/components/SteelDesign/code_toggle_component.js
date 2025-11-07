import React, { useState } from 'react';
import { Sun, Moon, BookOpen, FileText } from 'lucide-react';
import EurocodeBeamDesign from './EurocodeBeamDesign';
import EurocodeColumnDesign from './EurocodeColumnDesign';
// Import your existing BS code components
// import SteelDesignApp from './SteelDesignApp'; // Your existing BS app

const CodeToggleApp = () => {
  const [codeStandard, setCodeStandard] = useState('eurocode'); // 'bs' or 'eurocode'
  const [theme, setTheme] = useState('light'); // 'light' or 'dark'
  const [activeModule, setActiveModule] = useState('beam'); // 'beam' or 'column'

  const isDark = theme === 'dark';

  const bgPrimary = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const bgSecondary = isDark ? 'bg-gray-800' : 'bg-white';
  const textPrimary = isDark ? 'text-gray-100' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';

  return (
    <div className={`min-h-screen ${bgPrimary} transition-colors duration-300`}>
      {/* Header */}
      <header className={`${isDark ? 'bg-gradient-to-r from-gray-800 to-gray-900' : 'bg-gradient-to-r from-gray-700 to-gray-800'} text-white shadow-2xl sticky top-0 z-50`}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BookOpen size={32} />
              <div>
                <h1 className="text-2xl font-bold">Steel Design Calculator</h1>
                <p className="text-sm text-gray-300">Professional Structural Engineering Tool</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>

              {/* Code Standard Toggle */}
              <div className="flex bg-white/10 rounded-lg p-1">
                <button
                  onClick={() => setCodeStandard('bs')}
                  className={`px-4 py-2 rounded-md font-semibold transition-all ${
                    codeStandard === 'bs'
                      ? 'bg-white text-gray-800 shadow-lg'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText size={18} />
                    BS 5950
                  </div>
                </button>
                <button
                  onClick={() => setCodeStandard('eurocode')}
                  className={`px-4 py-2 rounded-md font-semibold transition-all ${
                    codeStandard === 'eurocode'
                      ? 'bg-white text-gray-800 shadow-lg'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText size={18} />
                    Eurocode 3
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Standard Information Banner */}
        <div className={`${bgSecondary} rounded-lg p-6 mb-6 border-2 ${borderColor} shadow-lg`}>
          <div className="flex items-start gap-4">
            <FileText className={`${isDark ? 'text-blue-400' : 'text-blue-600'} mt-1`} size={28} />
            <div>
              <h2 className={`text-xl font-bold ${textPrimary} mb-2`}>
                {codeStandard === 'bs' ? 'BS 5950:2000 - British Standard' : 'EN 1993-1-1:2005 - Eurocode 3'}
              </h2>
              <p className={textSecondary}>
                {codeStandard === 'bs' 
                  ? 'Structural use of steelwork in building - Code of practice for design - Rolled and welded sections'
                  : 'Design of steel structures - General rules and rules for buildings'}
              </p>
              <div className="mt-3 flex gap-4">
                <div className={`text-sm ${textSecondary}`}>
                  <strong>Standard:</strong> {codeStandard === 'bs' ? 'BS 5950-1:2000' : 'EN 1993-1-1:2005'}
                </div>
                <div className={`text-sm ${textSecondary}`}>
                  <strong>Region:</strong> {codeStandard === 'bs' ? 'United Kingdom' : 'European Union'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Module Selector for Eurocode */}
        {codeStandard === 'eurocode' && (
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setActiveModule('beam')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeModule === 'beam'
                  ? isDark
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                  : isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Beam Design
            </button>
            <button
              onClick={() => setActiveModule('column')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeModule === 'column'
                  ? isDark
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                  : isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Column Design
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="space-y-6">
          {codeStandard === 'bs' ? (
            // Render your existing BS 5950 app here
            <div className={`${bgSecondary} rounded-lg p-6 border-2 ${borderColor} shadow-lg`}>
              <div className="text-center py-12">
                <BookOpen className={`mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} size={64} />
                <h3 className={`text-2xl font-bold ${textPrimary} mb-2`}>BS 5950 Calculator</h3>
                <p className={textSecondary}>
                  Your existing BS 5950 steel design application will be rendered here.
                </p>
                <p className={`${textSecondary} mt-2`}>
                  Import and place your SteelDesignApp component here.
                </p>
                {/* <SteelDesignApp theme={theme} /> */}
              </div>
            </div>
          ) : (
            // Eurocode modules
            <>
              {activeModule === 'beam' && <EurocodeBeamDesign theme={theme} />}
              {activeModule === 'column' && <EurocodeColumnDesign theme={theme} />}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className={`${isDark ? 'bg-gray-800' : 'bg-gray-800'} text-white py-6 mt-12`}>
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-bold mb-2">Standards Supported</h4>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• BS 5950:2000 (British Standard)</li>
                <li>• EN 1993-1-1:2005 (Eurocode 3)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-2">Design Modules</h4>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Beam Design & Analysis</li>
                <li>• Column Design & Buckling</li>
                <li>• Welded Joint Design</li>
                <li>• Bolted Connection Design</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-2">Features</h4>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Accurate code-compliant calculations</li>
                <li>• Professional-grade results</li>
                <li>• Dark/Light theme support</li>
                <li>• Real-time design verification</li>
              </ul>
            </div>
          </div>
          <div className="text-center text-sm text-gray-400 mt-6 pt-6 border-t border-gray-700">
            Professional Steel Design Software | Always verify calculations independently
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CodeToggleApp;