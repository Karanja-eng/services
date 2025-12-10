import React, { useState } from 'react';
import { Book, FileText } from 'lucide-react';
import BSFoundationApp from './BsCodes';
import EurocodeFoundationApp from './eurocode_foundation_app';


const FoundationMainApp = ({ isDark = false }) => {
  const [activeStandard, setActiveStandard] = useState('bs');

  // Theme-aware classes
  const bgPrimary = isDark ? 'bg-slate-900' : 'bg-slate-50';
  const bgSecondary = isDark ? 'bg-slate-800' : 'bg-white';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-600';
  const border = isDark ? 'border-slate-700' : 'border-slate-200';

  return (
    <div className={`min-h-screen ${bgPrimary} transition-colors duration-200`}>
      {/* Header */}
      <header className={`${isDark ? 'bg-slate-800' : 'bg-white'} shadow-lg border-b ${border}`}>
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
          </div>
        </div>
      </header>

      {/* Standard Selector */}
      <div className={`${bgSecondary} border-b ${border}  top-0 z-10 shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div className="flex gap-3">
              <button
                onClick={() => setActiveStandard('bs')}
                className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${activeStandard === 'bs'
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
                className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${activeStandard === 'eurocode'
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
            <div className={`px-4 py-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'
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
          <div className={`px-6 py-4 border-b ${border} ${activeStandard === 'bs'
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
              <BSFoundationApp isDark={isDark} />
            ) : (
              <EurocodeFoundationApp isDark={isDark} />
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


    </div>
  );
};

export default FoundationMainApp;