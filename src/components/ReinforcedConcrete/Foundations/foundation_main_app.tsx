import React, { useState } from 'react';
import { Moon, Sun, Book, FileText } from 'lucide-react';

// Import components (in actual implementation, these would be separate files)
// For this demo, we'll simulate the imports
const BSFoundationApp = ({ theme }) => {
  // This would be imported from the BS codes artifact
  return <div className={`p-8 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>
    <div className="text-center py-20">
      <Book className="w-16 h-16 mx-auto mb-4 text-blue-500" />
      <h2 className="text-2xl font-bold mb-2">BS Standards Foundation Design</h2>
      <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
        BS EN 1992-1-1, BS 8004, BS EN 1997-1 Compliant Calculator
      </p>
      <p className="text-sm mt-4 text-gray-500">
        (Use the previously created BS Foundation component here)
      </p>
    </div>
  </div>;
};

// Eurocode component would be imported from the Eurocode artifact
const EurocodeFoundationApp = ({ theme }) => {
  return <div className={`p-8 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>
    <div className="text-center py-20">
      <FileText className="w-16 h-16 mx-auto mb-4 text-green-500" />
      <h2 className="text-2xl font-bold mb-2">Eurocode Foundation Design</h2>
      <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
        EN 1990, EN 1991, EN 1992-1-1, EN 1997-1 Compliant Calculator
      </p>
      <p className="text-sm mt-4 text-gray-500">
        (Use the previously created Eurocode Foundation component here)
      </p>
    </div>
  </div>;
};

const FoundationMainApp = () => {
  const [theme, setTheme] = useState('light');
  const [activeStandard, setActiveStandard] = useState('bs');
  
  const isDark = theme === 'dark';
  
  // Theme-aware classes
  const bgPrimary = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const bgSecondary = isDark ? 'bg-gray-800' : 'bg-white';
  const textPrimary = isDark ? 'text-gray-100' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-600';
  const border = isDark ? 'border-gray-700' : 'border-gray-200';

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className={`min-h-screen ${bgPrimary} transition-colors duration-200`}>
      {/* Header */}
      <header className={`${isDark ? 'bg-gray-800' : 'bg-white'} shadow-lg border-b ${border}`}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-2xl md:text-3xl font-bold ${textPrimary}`}>
                Professional Foundation Design System
              </h1>
              <p className={`${textSecondary} mt-1 text-sm md:text-base`}>
                BS Standards & Eurocode Compliant Engineering Calculator
              </p>
            </div>
            
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`p-3 rounded-lg ${
                isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
              } transition-colors`}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-yellow-400" />
              ) : (
                <Moon className="w-5 h-5 text-gray-700" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Standard Selector */}
      <div className={`${bgSecondary} border-b ${border} sticky top-0 z-10 shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div className="flex gap-3">
              <button
                onClick={() => setActiveStandard('bs')}
                className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                  activeStandard === 'bs'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : isDark
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Book className="w-5 h-5" />
                <span className="hidden md:inline">BS Standards</span>
                <span className="md:hidden">BS</span>
              </button>
              
              <button
                onClick={() => setActiveStandard('eurocode')}
                className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                  activeStandard === 'eurocode'
                    ? 'bg-green-600 text-white shadow-lg'
                    : isDark
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <FileText className="w-5 h-5" />
                <span className="hidden md:inline">Eurocodes</span>
                <span className="md:hidden">EC</span>
              </button>
            </div>
            
            {/* Standard Info Badge */}
            <div className={`px-4 py-2 rounded-lg ${
              isDark ? 'bg-gray-700' : 'bg-gray-100'
            }`}>
              <p className={`text-xs ${textSecondary} uppercase tracking-wide`}>Active Standard</p>
              <p className={`text-sm font-bold ${textPrimary}`}>
                {activeStandard === 'bs' ? 'British Standards (BS)' : 'European Standards (EN)'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className={`${bgSecondary} rounded-lg shadow-xl border ${border} min-h-[600px]`}>
          {/* Standard-specific Info Bar */}
          <div className={`px-6 py-4 border-b ${border} ${
            activeStandard === 'bs' 
              ? 'bg-blue-50 dark:bg-blue-900/20' 
              : 'bg-green-50 dark:bg-green-900/20'
          }`}>
            <div className="flex items-start gap-3">
              {activeStandard === 'bs' ? (
                <Book className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              ) : (
                <FileText className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
              )}
              <div className="flex-1">
                <h3 className={`font-semibold ${textPrimary} mb-1`}>
                  {activeStandard === 'bs' 
                    ? 'BS Standards Design System' 
                    : 'Eurocode Design System'}
                </h3>
                <p className={`text-sm ${textSecondary}`}>
                  {activeStandard === 'bs' 
                    ? 'Design foundations according to BS EN 1992-1-1:2004, BS 8004:2015, and BS EN 1997-1:2004'
                    : 'Design foundations according to EN 1990:2002, EN 1991, EN 1992-1-1:2004, and EN 1997-1:2004'}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {activeStandard === 'bs' ? (
                    <>
                      <span className="px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-medium">
                        BS EN 1992-1-1
                      </span>
                      <span className="px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-medium">
                        BS 8004:2015
                      </span>
                      <span className="px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-medium">
                        BS EN 1997-1
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="px-2 py-1 text-xs rounded bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 font-medium">
                        EN 1990:2002
                      </span>
                      <span className="px-2 py-1 text-xs rounded bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 font-medium">
                        EN 1992-1-1:2004
                      </span>
                      <span className="px-2 py-1 text-xs rounded bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 font-medium">
                        EN 1997-1:2004
                      </span>
                      <span className="px-2 py-1 text-xs rounded bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 font-medium">
                        EN 1991 Series
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Component Container */}
          <div className="p-6">
            {activeStandard === 'bs' ? (
              <BSFoundationApp theme={theme} />
            ) : (
              <EurocodeFoundationApp theme={theme} />
            )}
          </div>
        </div>

        {/* Feature Comparison Footer */}
        <div className={`mt-6 grid grid-cols-1 md:grid-cols-2 gap-4`}>
          <div className={`${bgSecondary} p-6 rounded-lg border ${border}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Book className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 className={`font-bold ${textPrimary}`}>BS Standards Features</h4>
            </div>
            <ul className={`space-y-2 ${textSecondary} text-sm`}>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-1">✓</span>
                <span>UK-specific design methodology</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-1">✓</span>
                <span>BS 8004:2015 foundation code compliance</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-1">✓</span>
                <span>UK National Annex parameters</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-1">✓</span>
                <span>Load factors: 1.35Gk + 1.5Qk</span>
              </li>
            </ul>
          </div>

          <div className={`${bgSecondary} p-6 rounded-lg border ${border}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <h4 className={`font-bold ${textPrimary}`}>Eurocode Features</h4>
            </div>
            <ul className={`space-y-2 ${textSecondary} text-sm`}>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                <span>Pan-European standardized approach</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                <span>Design Approach 1, 2, 3 (EN 1997-1)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                <span>Comprehensive action combinations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                <span>National Annex selection support</span>
              </li>
            </ul>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={`${isDark ? 'bg-gray-800' : 'bg-white'} border-t ${border} mt-12`}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className={`text-sm ${textSecondary} text-center md:text-left`}>
              © 2025 Professional Foundation Design System | For use by qualified structural engineers
            </p>
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 rounded text-xs font-medium ${
                isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
              }`}>
                Version 1.0.0
              </span>
              <span className={`px-3 py-1 rounded text-xs font-medium ${
                activeStandard === 'bs'
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300'
                  : 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
              }`}>
                {activeStandard === 'bs' ? 'BS Mode' : 'EN Mode'}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default FoundationMainApp;