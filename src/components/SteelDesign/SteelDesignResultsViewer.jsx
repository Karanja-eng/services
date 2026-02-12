import React, { useState } from 'react';
import { CheckCircle, AlertCircle, FileText, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { SteelSectionProperties } from './SteelSectionRenderer';

/**
 * Steel Design Results Viewer
 * Displays design results for all steel members after analysis and design
 */

const SteelDesignResultsViewer = ({ designResults, onClose }) => {
    const [selectedMember, setSelectedMember] = useState(null);
    const [viewMode, setViewMode] = useState('summary'); // 'summary' or 'detailed'

    if (!designResults) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6">
                <p className="text-gray-500">No design results available. Run analysis and design first.</p>
            </div>
        );
    }

    const { beams = [], columns = [], summary = {} } = designResults;
    const allMembers = [...beams, ...columns];

    // Summary statistics
    const passRate = summary.totalMembers > 0
        ? ((summary.passedMembers / summary.totalMembers) * 100).toFixed(1)
        : 0;

    return (
        <div className="bg-white rounded-lg shadow-xl border-2 border-gray-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white p-6 rounded-t-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <FileText size={32} />
                        <div>
                            <h2 className="text-2xl font-bold">Steel Design Results</h2>
                            <p className="text-blue-100 text-sm">BS 5950:2000 Design Summary</p>
                        </div>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 border-b">
                <div className="bg-white rounded-lg p-4 shadow">
                    <div className="text-sm text-gray-600 mb-1">Total Members</div>
                    <div className="text-3xl font-bold text-blue-600">{summary.totalMembers || 0}</div>
                </div>

                <div className="bg-white rounded-lg p-4 shadow">
                    <div className="text-sm text-gray-600 mb-1">Passed</div>
                    <div className="text-3xl font-bold text-green-600 flex items-center gap-2">
                        {summary.passedMembers || 0}
                        <CheckCircle size={24} />
                    </div>
                </div>

                <div className="bg-white rounded-lg p-4 shadow">
                    <div className="text-sm text-gray-600 mb-1">Failed</div>
                    <div className="text-3xl font-bold text-red-600 flex items-center gap-2">
                        {summary.failedMembers || 0}
                        <AlertCircle size={24} />
                    </div>
                </div>
            </div>

            {/* Pass Rate Indicator */}
            <div className="p-6 bg-white border-b">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">Overall Pass Rate</span>
                    <span className="text-lg font-bold text-gray-800">{passRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                        className={`h-4 rounded-full transition-all ${passRate >= 90 ? 'bg-green-600' : passRate >= 70 ? 'bg-yellow-600' : 'bg-red-600'
                            }`}
                        style={{ width: `${passRate}%` }}
                    />
                </div>
            </div>

            {/* View Mode Toggle */}
            <div className="p-4 bg-gray-50 border-b flex gap-2">
                <button
                    onClick={() => setViewMode('summary')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${viewMode === 'summary'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                >
                    Summary View
                </button>
                <button
                    onClick={() => setViewMode('detailed')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${viewMode === 'detailed'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                >
                    Detailed View
                </button>
            </div>

            {/* Results Table */}
            <div className="p-6">
                {viewMode === 'summary' ? (
                    <SummaryTable members={allMembers} onSelectMember={setSelectedMember} />
                ) : (
                    <DetailedView members={allMembers} />
                )}
            </div>

            {/* Selected Member Details */}
            {selectedMember && (
                <MemberDetailModal member={selectedMember} onClose={() => setSelectedMember(null)} />
            )}

            {/* Export Button */}
            <div className="p-4 bg-gray-50 border-t rounded-b-lg">
                <button className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-green-700 transition-all flex items-center justify-center gap-2">
                    <Download size={20} />
                    Export Results to PDF
                </button>
            </div>
        </div>
    );
};

// Summary Table Component
const SummaryTable = ({ members, onSelectMember }) => {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b-2 border-gray-300">
                    <tr>
                        <th className="px-4 py-3 text-left font-semibold">Member</th>
                        <th className="px-4 py-3 text-left font-semibold">Type</th>
                        <th className="px-4 py-3 text-left font-semibold">Section</th>
                        <th className="px-4 py-3 text-center font-semibold">Utilization</th>
                        <th className="px-4 py-3 text-center font-semibold">Status</th>
                        <th className="px-4 py-3 text-center font-semibold">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {members.map((member, index) => {
                        const isBeam = member.bending_ratio !== undefined;
                        const utilization = isBeam
                            ? Math.max(
                                parseFloat(member.bending_ratio || 0),
                                parseFloat(member.shear_ratio || 0),
                                parseFloat(member.deflection_ratio || 0)
                            )
                            : parseFloat(member.interaction || 0);

                        return (
                            <tr key={index} className="border-b hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 font-medium">{member.memberLabel || member.memberId}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${isBeam ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                        {isBeam ? 'Beam' : 'Column'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs">{member.section}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-24 bg-gray-200 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full ${utilization > 100 ? 'bg-red-600' : utilization > 90 ? 'bg-yellow-600' : 'bg-green-600'
                                                    }`}
                                                style={{ width: `${Math.min(utilization, 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-semibold">{utilization.toFixed(1)}%</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {member.passed ? (
                                        <CheckCircle className="inline text-green-600" size={20} />
                                    ) : (
                                        <AlertCircle className="inline text-red-600" size={20} />
                                    )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <button
                                        onClick={() => onSelectMember(member)}
                                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-semibold"
                                    >
                                        Details
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// Detailed View Component
const DetailedView = ({ members }) => {
    return (
        <div className="space-y-6">
            {members.map((member, index) => {
                const isBeam = member.bending_ratio !== undefined;

                return (
                    <div key={index} className="bg-white border-2 border-gray-200 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">
                                    {member.memberLabel || member.memberId}
                                </h3>
                                <p className="text-sm text-gray-600">{member.section}</p>
                            </div>
                            <div className={`px-4 py-2 rounded-lg font-bold ${member.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                {member.passed ? 'PASS' : 'FAIL'}
                            </div>
                        </div>

                        {isBeam ? (
                            <BeamDetails member={member} />
                        ) : (
                            <ColumnDetails member={member} />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// Beam Details Component
const BeamDetails = ({ member }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DetailCard label="Max Moment" value={`${member.M_max} kNm`} />
            <DetailCard label="Max Shear" value={`${member.V_max} kN`} />
            <DetailCard label="Moment Capacity" value={`${member.Mb} kNm`} />
            <DetailCard label="Shear Capacity" value={`${member.Pv} kN`} />
            <DetailCard label="Bending Ratio" value={`${member.bending_ratio}%`} status={parseFloat(member.bending_ratio)} />
            <DetailCard label="Shear Ratio" value={`${member.shear_ratio}%`} status={parseFloat(member.shear_ratio)} />
            <DetailCard label="Deflection Ratio" value={`${member.deflection_ratio}%`} status={parseFloat(member.deflection_ratio)} />
            <DetailCard label="Classification" value={member.classification} />
        </div>
    );
};

// Column Details Component
const ColumnDetails = ({ member }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DetailCard label="Axial Load" value={`${member.P} kN`} />
            <DetailCard label="Axial Capacity" value={`${member.Pc} kN`} />
            <DetailCard label="Major Moment" value={`${member.Mx} kNm`} />
            <DetailCard label="Moment Capacity" value={`${member.Mcx} kNm`} />
            <DetailCard label="Axial Ratio" value={`${member.axial_ratio}%`} status={parseFloat(member.axial_ratio)} />
            <DetailCard label="Moment Ratio" value={`${member.moment_ratio}%`} status={parseFloat(member.moment_ratio)} />
            <DetailCard label="Interaction" value={`${member.interaction}%`} status={parseFloat(member.interaction)} />
            <DetailCard label="Slenderness" value={member.lambda_} />
        </div>
    );
};

// Detail Card Component
const DetailCard = ({ label, value, status }) => {
    const getStatusColor = () => {
        if (status === undefined) return 'bg-gray-50';
        if (status > 100) return 'bg-red-50 border-red-200';
        if (status > 90) return 'bg-yellow-50 border-yellow-200';
        return 'bg-green-50 border-green-200';
    };

    return (
        <div className={`p-3 rounded-lg border ${getStatusColor()}`}>
            <div className="text-xs text-gray-600 mb-1">{label}</div>
            <div className="text-sm font-bold text-gray-800">{value}</div>
        </div>
    );
};

// Member Detail Modal
const MemberDetailModal = ({ member, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white p-6 rounded-t-lg">
                    <h3 className="text-xl font-bold">{member.memberLabel || member.memberId}</h3>
                    <p className="text-blue-100 text-sm">{member.section}</p>
                </div>

                <div className="p-6">
                    {member.bending_ratio !== undefined ? (
                        <BeamDetails member={member} />
                    ) : (
                        <ColumnDetails member={member} />
                    )}
                </div>

                <div className="p-4 bg-gray-50 border-t rounded-b-lg">
                    <button
                        onClick={onClose}
                        className="w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SteelDesignResultsViewer;
