import React, { useState, useEffect } from 'react';
import { BookOpen, Shield, Moon, Sun } from 'lucide-react';

// Import design components
import EnhancedThreeMomentCalculator from './EnhancedThreeMomentCalculator';
import Eurocode2DesignCalculator from './Eurocode2DesignCalculator';

const DesignCodeSelector = () => {
  const [selectedCode, setSelectedCode] = useState('bs8110');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);

  // Listen for theme changes from parent app
  useEffect(() => {
    const handleThemeChange = (event) => {
      if (event.detail && event.detail.isDarkMode !== undefined) {
        setIsDarkMode(event.detail.isDarkMode);
      }
    };

    window.addEventListener('themeChange', handleThemeChange);
    
    // Check initial theme
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(prefersDark);

    return () => window.removeEventListener('themeChange', handleThemeChange);
  }, []);

  const designCodes = [
    {
      id: 'bs8110',
      name: 'BS 8110',
      fullName: 'British Standard 8110',
      region: 'UK & Commonwealth',
      icon: <BookOpen className="h-6 w-6" />,
      color: 'blue',
      description: 'British Standard for structural use of concrete',
      features: [
        'Permissible stress approach',
        'Simple design procedures',
        'Well-established methods',
        'Conservative safety factors'
      ],
      status: 'Legacy but widely used',
      year: '1997 (with 2005 amendments)'
    },
    {
      id: 'eurocode2',
      name: 'Eurocode 2',
      fullName: 'EN 1992-1-1:2004',
      region: 'EU & International',
      icon: <Shield className="h-6 w-6" />,
      color: 'purple',
      description: 'European standard for concrete structures',
      features: [
        'Limit state design approach',
        'Advanced analysis methods',
        'Performance-based design',
        'Harmonized across Europe'
      ],
      status: 'Current European standard',
      year: '2004 (with national annexes)'
    }
  ];

  const themeClasses = {
    bg: isDarkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-gray-50 via-white to-gray-50',
    card: isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    text: isDarkMode ? 'text-gray-100' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-300' : 'text-gray-600',
    hover: isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
  };

  return (
    <div className={`min-h-screen ${themeClasses.bg} transition-colors duration-200`}>
      {/* Header with Theme Toggle */}
      <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-lg border-b`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className={`text-2xl font-bold ${themeClasses.text}`}>
                Reinforced Concrete Design Calculator
              </h1>
              <p className={themeClasses.textSecondary}>
                Choose your preferred design code
              </p>
            </div>
            
            <button
              onClick={() => {
                setIsDarkMode(!isDarkMode);
                window.dispatchEvent(new CustomEvent('themeChange', { 
                  detail: { isDarkMode: !isDarkMode } 
                }));
              }}
              className={`p-2 rounded-lg ${themeClasses.hover} transition-colors`}
              aria-label="Toggle theme"
            >
              {isDarkMode ? (
                <Sun className="h-6 w-6 text-yellow-400" />
              ) : (
                <Moon className="h-6 w-6 text-gray-600" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Code Selector */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className={`text-xl font-semibold ${themeClasses.text} mb-4 text-center`}>
            Select Design Code
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {designCodes.map((code) => (
              <button
                key={code.id}
                onClick={() => setSelectedCode(code.id)}
                className={`${themeClasses.card} border-2 rounded-xl p-6 transition-all duration-200 ${
                  selectedCode === code.id
                    ? code.color === 'blue'
                      ? 'border-blue-500 ring-4 ring-blue-100 dark:ring-blue-900'
                      : 'border-purple-500 ring-4 ring-purple-100 dark:ring-purple-900'
                    : `border-transparent ${themeClasses.hover}`
                } hover:shadow-xl`}
              >
                <div className="flex items-start space-x-4">
                  <div className={`p-3 rounded-lg ${
                    code.color === 'blue'
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                      : 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300'
                  }`}>
                    {code.icon}
                  </div>
                  
                  <div className="flex-1 text-left">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className={`text-xl font-bold ${themeClasses.text}`}>
                        {code.name}
                      </h3>
                      {selectedCode === code.id && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          code.color === 'blue'
                            ? 'bg-blue-500 text-white'
                            : 'bg-purple-500 text-white'
                        }`}>
                          Selected
                        </span>
                      )}
                    </div>
                    
                    <p className={`text-sm ${themeClasses.textSecondary} mb-2`}>
                      {code.fullName