import React from 'react';
import { Toolbar } from './Toolbar';
import { PropertiesPanel } from './Propertiespanel';
import { StatusBar } from './StatusBar';

export function MainLayout({ children }) {
  return (
    <div className="flex flex-col h-screen bg-[#0d1420] text-gray-200 overflow-hidden font-sans">
      <div className="flex flex-1 overflow-hidden">
        <Toolbar />
        <main className="flex-1 flex flex-col relative overflow-hidden border-x border-[#1e2840]">
          {children}
        </main>
        <aside className="w-72 flex flex-col bg-[#0d1220] border-l border-[#1e2840]">
          <PropertiesPanel />
        </aside>
      </div>
      <StatusBar />
    </div>
  );
}