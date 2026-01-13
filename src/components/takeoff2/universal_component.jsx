import React, { useState } from 'react';
import { FileText, List, Grid, Calculator, Box } from 'lucide-react';

// Universal Tab Navigation
export const UniversalTabs = ({ activeTab, setActiveTab, tabs = ['calculator', 'takeoff', 'sheet', 'boq'] }) => {
    const getLabel = (tab) => {
        switch (tab) {
            case 'calculator': return 'Calculator';
            case '3d': return '3D View';
            case 'takeoff': return 'Takeoff (Editor)';
            case 'sheet': return 'Dimension Paper';
            case 'boq': return 'Bill of Quantities';
            default: return tab.charAt(0).toUpperCase() + tab.slice(1);
        }
    };

    const getIcon = (tab) => {
        switch (tab) {
            case 'calculator': return <Calculator className="w-4 h-4" />;
            case '3d': return <Box className="w-4 h-4" />;
            case 'takeoff': return <FileText className="w-4 h-4" />;
            case 'sheet': return <Grid className="w-4 h-4" />;
            case 'boq': return <List className="w-4 h-4" />;
            default: return null;
        }
    };

    return (
        <div className="flex border-b border-gray-200 mb-4 bg-white rounded-t-lg overflow-hidden">
            {tabs.map(tab => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === tab
                        ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                >
                    {getIcon(tab)}
                    {getLabel(tab)}
                </button>
            ))}
        </div>
    );
};

// Universal Dimension Paper Sheet (Read-Only View)
export const UniversalSheet = ({ items, projectInfo = {} }) => {
    if (!items || items.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow">
                No items to display. Please add items in the Takeoff tab first.
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow p-6 h-full overflow-auto font-mono text-sm">
            <div className="mb-6 border-b pb-4">
                <h3 className="text-lg font-bold text-gray-800">DIMENSION PAPER</h3>
                <div className="text-xs text-gray-500 mt-1 grid grid-cols-2 gap-4">
                    <p><strong>Project:</strong> {projectInfo.projectName || 'N/A'}</p>
                    <p><strong>Date:</strong> {projectInfo.date || new Date().toLocaleDateString()}</p>
                    <p><strong>Location:</strong> {projectInfo.location || 'N/A'}</p>
                    <p><strong>Client:</strong> {projectInfo.clientName || 'N/A'}</p>
                </div>
            </div>

            <table className="w-full border-collapse border border-gray-300">
                <thead>
                    <tr className="bg-gray-100 text-xs uppercase text-gray-600">
                        <th className="border border-gray-300 p-2 w-16 text-center">Timesing</th>
                        <th className="border border-gray-300 p-2 w-24 text-center">Dimension</th>
                        <th className="border border-gray-300 p-2 w-24 text-center">Squaring</th>
                        <th className="border border-gray-300 p-2 text-left">Description</th>
                        <th className="border border-gray-300 p-2 w-24 text-right">Quantity</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => {
                        // Handle headers differently
                        if (item.isHeader) {
                            return (
                                <tr key={item.id || index} className="bg-gray-50 font-bold border-b border-gray-300">
                                    <td className="border border-gray-300 p-2 text-center text-gray-400">-</td>
                                    <td className="border border-gray-300 p-2"></td>
                                    <td className="border border-gray-300 p-2"></td>
                                    <td className="border border-gray-300 p-2 text-blue-800 uppercase underline">{item.description}</td>
                                    <td className="border border-gray-300 p-2"></td>
                                </tr>
                            );
                        }

                        // Handle regular items with dimensions
                        const hasDimensions = item.dimensions && item.dimensions.length > 0;

                        if (!hasDimensions) {
                            // If item has no dimensions but has a quantity (direct entry)
                            return (
                                <tr key={item.id || index} className="border-b border-gray-300 hover:bg-gray-50">
                                    <td className="border border-gray-300 p-2"></td>
                                    <td className="border border-gray-300 p-2"></td>
                                    <td className="border border-gray-300 p-2"></td>
                                    <td className="border border-gray-300 p-2">
                                        <span className="font-semibold text-gray-900">{item.description}</span>
                                    </td>
                                    <td className="border border-gray-300 p-2 text-right font-bold">
                                        {item.quantity ? parseFloat(item.quantity).toFixed(2) : ''} {item.unit}
                                    </td>
                                </tr>
                            );
                        }

                        return (
                            <React.Fragment key={item.id || index}>
                                {item.dimensions.map((dim, dimIndex) => {
                                    const isLastDim = dimIndex === item.dimensions.length - 1;

                                    // Calculate squaring for this row
                                    const num = parseFloat(dim.number) || 1;
                                    const len = parseFloat(dim.length) || 0;
                                    const wid = parseFloat(dim.width) || 1;
                                    const hgt = parseFloat(dim.height) || 1;
                                    // Only squared if length is provided
                                    const squared = dim.length ? (num * len * (dim.width ? wid : 1) * (dim.height ? hgt : 1)) : null;

                                    return (
                                        <tr key={`${item.id}-dim-${dimIndex}`} className="border-b border-gray-300 hover:bg-gray-50">
                                            <td className="border-r border-gray-300 p-2 text-center align-top text-gray-600">
                                                {dim.number > 1 ? dim.number : ''}
                                                {dim.deduction ? <span className="text-red-500 text-xs block">(Ded)</span> : ''}
                                            </td>
                                            <td className="border-r border-gray-300 p-2 text-center align-top">
                                                {dim.length && (
                                                    <div className="flex flex-col items-center leading-tight">
                                                        <span>{parseFloat(dim.length).toFixed(2)}</span>
                                                        {dim.width && <span>{parseFloat(dim.width).toFixed(2)}</span>}
                                                        {dim.height && <span>{parseFloat(dim.height).toFixed(2)}</span>}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="border-r border-gray-300 p-2 text-center align-top font-medium text-blue-600">
                                                {squared !== null ? squared.toFixed(2) : ''}
                                            </td>
                                            <td className="border-r border-gray-300 p-2 align-top relative">
                                                {dimIndex === 0 && (
                                                    <div className="font-medium text-gray-800">
                                                        {item.description}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="border-r border-gray-300 p-2 text-right align-bottom font-bold text-gray-900 bg-gray-50">
                                                {isLastDim && item.quantity ? `${parseFloat(item.quantity).toFixed(2)} ${item.unit}` : ''}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// Universal BOQ (Read-Only View)
export const UniversalBOQ = ({ items, projectInfo = {} }) => {
    if (!items || items.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow">
                No items to display. Please add items in the Takeoff tab first.
            </div>
        );
    }

    // Filter out empty items or invalid ones, but keep headers and items with descriptions
    const validItems = items.filter(item => item.isHeader || (item.description && (item.quantity !== undefined || item.amount !== undefined)));

    const totalAmount = validItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    return (
        <div className="bg-white rounded-lg shadow p-6 h-full overflow-auto">
            <div className="mb-6">
                <h3 className="text-xl font-bold border-b border-gray-800 pb-2">BILL OF QUANTITIES</h3>
                <div className="mt-2 text-sm text-gray-900 grid grid-cols-2 gap-4">
                    <p><strong>Project:</strong> {projectInfo.projectName || 'N/A'}</p>
                    <p><strong>Client:</strong> {projectInfo.clientName || 'N/A'}</p>
                    <p><strong>Date:</strong> {projectInfo.date || new Date().toLocaleDateString()}</p>
                    <p><strong>Currency:</strong> {projectInfo.currency || 'KES'}</p>
                </div>
            </div>

            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="bg-gray-800 text-white">
                        <th className="p-3 text-left w-20 border border-gray-700">Item</th>
                        <th className="p-3 text-left border border-gray-700">Description</th>
                        <th className="p-3 text-center w-24 border border-gray-700">Unit</th>
                        <th className="p-3 text-right w-32 border border-gray-700">Quantity</th>
                        <th className="p-3 text-right w-32 border border-gray-700">Rate</th>
                        <th className="p-3 text-right w-40 border border-gray-700">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {validItems.map((item, index) => {
                        if (item.isHeader) {
                            return (
                                <tr key={item.id || index} className="bg-gray-100 font-bold text-black text-lg">
                                    <td className="p-3 border border-gray-300">{item.billNo}</td>
                                    <td className="p-3 border border-gray-300 uppercase" colSpan={5}>{item.description}</td>
                                </tr>
                            );
                        }
                        return (
                            <tr key={item.id || index} className="border-b hover:bg-gray-50 text-black">
                                <td className="p-3 border border-gray-300 text-gray-900">{item.itemNo || item.billNo}</td>
                                <td className="p-3 border border-gray-300 font-medium">{item.description}</td>
                                <td className="p-3 border border-gray-300 text-center">{item.unit}</td>
                                <td className="p-3 border border-gray-300 text-right font-mono font-bold">{item.quantity ? parseFloat(item.quantity).toFixed(2) : '-'}</td>
                                <td className="p-3 border border-gray-300 text-right font-mono">{item.rate ? parseFloat(item.rate).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                                <td className="p-3 border border-gray-300 text-right font-bold font-mono text-blue-900">
                                    {item.amount ? parseFloat(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                                </td>
                            </tr>
                        );
                    })}

                    {/* Total Row */}
                    <tr className="bg-gray-200 font-bold text-lg">
                        <td colSpan={5} className="p-4 text-right border border-gray-300">TOTAL AMOUNT</td>
                        <td className="p-4 text-right border border-gray-300 text-blue-800">
                            {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                    </tr>
                </tbody>
            </table>

            <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600">
                <p className="font-semibold mb-2">Notes:</p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Rates are inclusive of overheads and profit unless otherwise stated.</li>
                    <li>Quantities are net in place.</li>
                </ul>
            </div>
        </div>
    );
};

export default { UniversalTabs, UniversalSheet, UniversalBOQ };
