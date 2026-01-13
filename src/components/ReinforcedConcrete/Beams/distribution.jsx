import React, { useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
  BarChart,
  Bar,
} from "recharts";
import {
  Plus,
  Minus,
  BookOpen,
  Settings,
  AlertTriangle,
  CheckCircle,
  Wrench,
  Award,
  Zap,
  GitBranch,
} from "lucide-react";

const API_BASE_URL = "http://localhost:8001/moment_distribution";

const MomentDistributionCalculator = ({ onAnalysisComplete }) => {
  const [joints, setJoints] = useState([
    {
      joint_id: "A",
      joint_type: "Fixed Joint",
      x_coordinate: 0.0,
      y_coordinate: 0.0,
    },
    {
      joint_id: "B",
      joint_type: "Fixed Joint",
      x_coordinate: 6.0,
      y_coordinate: 0.0,
      is_support: true,
    },
  ]);
  const [members, setMembers] = useState([
    {
      member_id: "AB",
      member_type: "Beam",
      start_joint_id: "A",
      end_joint_id: "B",
      length: 6.0,
      E: 200e9,
      I: 8.33e-6,
      start_condition: "Fixed",
      end_condition: "Fixed",
      loads: [],
    },
  ]);
  const [convergenceSettings, setConvergenceSettings] = useState({
    convergence_tolerance: 0.001,
    max_iterations: 50,
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("input");

  const addJoint = () => {
    const newJointId = String.fromCharCode(65 + joints.length); // A, B, C, ...
    setJoints([
      ...joints,
      {
        joint_id: newJointId,
        joint_type: "Fixed Joint",
        x_coordinate: joints.length * 6.0,
        y_coordinate: 0.0,
        is_support: false,
      },
    ]);
  };

  const removeJoint = (index) => {
    if (joints.length > 2) {
      const newJoints = joints.filter((_, i) => i !== index);
      setJoints(newJoints);

      // Remove members that reference this joint
      const removedJointId = joints[index].joint_id;
      setMembers(
        members.filter(
          (member) =>
            member.start_joint_id !== removedJointId &&
            member.end_joint_id !== removedJointId
        )
      );
    }
  };

  const updateJoint = (index, field, value) => {
    const newJoints = [...joints];
    if (field === "is_support") {
      newJoints[index][field] = value;
    } else {
      newJoints[index][field] = field.includes("coordinate")
        ? parseFloat(value) || 0
        : value;
    }
    setJoints(newJoints);
  };

  const addMember = () => {
    if (joints.length < 2) return;

    const availablePairs = [];
    for (let i = 0; i < joints.length; i++) {
      for (let j = i + 1; j < joints.length; j++) {
        const pair = `${joints[i].joint_id}${joints[j].joint_id}`;
        const exists = members.some(
          (m) =>
            (m.start_joint_id === joints[i].joint_id &&
              m.end_joint_id === joints[j].joint_id) ||
            (m.start_joint_id === joints[j].joint_id &&
              m.end_joint_id === joints[i].joint_id)
        );
        if (!exists) {
          availablePairs.push({
            id: pair,
            start: joints[i].joint_id,
            end: joints[j].joint_id,
          });
        }
      }
    }

    if (availablePairs.length > 0) {
      const pair = availablePairs[0];
      const startJoint = joints.find((j) => j.joint_id === pair.start);
      const endJoint = joints.find((j) => j.joint_id === pair.end);

      const length = Math.sqrt(
        Math.pow(endJoint.x_coordinate - startJoint.x_coordinate, 2) +
        Math.pow(endJoint.y_coordinate - startJoint.y_coordinate, 2)
      );

      setMembers([
        ...members,
        {
          member_id: pair.id,
          member_type: "Beam",
          start_joint_id: pair.start,
          end_joint_id: pair.end,
          length: length || 6.0,
          E: 200e9,
          I: 8.33e-6,
          start_condition: "Fixed",
          end_condition: "Fixed",
          loads: [],
        },
      ]);
    }
  };

  const removeMember = (index) => {
    if (members.length > 1) {
      const newMembers = members.filter((_, i) => i !== index);
      setMembers(newMembers);
    }
  };

  const updateMember = (index, field, value) => {
    const newMembers = [...members];
    if (field === "length" || field === "E" || field === "I") {
      newMembers[index][field] = parseFloat(value) || 0;
    } else {
      newMembers[index][field] = value;
    }
    setMembers(newMembers);
  };

  const addLoad = (memberIndex) => {
    const newMembers = [...members];
    newMembers[memberIndex].loads.push({
      load_type: "Point",
      magnitude: 50.0,
      position: 0.0,
      length: 0.0,
      magnitude2: 0.0,
    });
    setMembers(newMembers);
  };

  const updateLoad = (memberIndex, loadIndex, field, value) => {
    const newMembers = [...members];
    newMembers[memberIndex].loads[loadIndex][field] =
      field === "load_type" ? value : parseFloat(value) || 0;
    setMembers(newMembers);
  };

  const removeLoad = (memberIndex, loadIndex) => {
    const newMembers = [...members];
    newMembers[memberIndex].loads.splice(loadIndex, 1);
    setMembers(newMembers);
  };

  const analyzeMomentDistribution = async () => {
    setLoading(true);
    setError(null);

    try {
      const frameData = {
        joints,
        members,
        ...convergenceSettings,
      };

      const response = await axios.post(
        `${API_BASE_URL}/analyze`,
        frameData
      );
      setResults(response.data);
      setActiveTab("results");

      if (onAnalysisComplete) {
        onAnalysisComplete({ ...response.data, inputs: { joints, members } });
      }
    } catch (err) {
      setError(
        err.response?.data?.detail || "Moment Distribution analysis failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const loadExample = async (exampleName) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/examples`
      );
      const example = response.data.find((ex) => ex.name === exampleName);
      if (example) {
        setJoints(example.joints);
        setMembers(example.members);
        setConvergenceSettings({
          convergence_tolerance: example.convergence_tolerance,
          max_iterations: example.max_iterations,
        });
      }
    } catch (err) {
      setError("Failed to load example");
    }
  };

  const FrameSchematic = ({ joints, members, results }) => {
    // Calculate drawing bounds
    const allX = joints.map((j) => j.x_coordinate);
    const allY = joints.map((j) => j.y_coordinate);
    const minX = Math.min(...allX) - 1;
    const maxX = Math.max(...allX) + 1;
    const minY = Math.min(...allY) - 1;
    const maxY = Math.max(...allY) + 1;

    const width = Math.max(800, (maxX - minX) * 50);
    const height = Math.max(400, (maxY - minY) * 50 + 200);

    // Scale factors
    const scaleX = (width - 100) / (maxX - minX || 1);
    const scaleY = (height - 200) / (maxY - minY || 1);
    const scale = Math.min(scaleX, scaleY);

    const offsetX = 50 - minX * scale;
    const offsetY = height - 100 + minY * scale;

    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <GitBranch className="h-5 w-5 mr-2 text-blue-600" />
          Frame Configuration - Moment Distribution Method
        </h3>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* Draw members */}
          {members.map((member, index) => {
            const startJoint = joints.find(
              (j) => j.joint_id === member.start_joint_id
            );
            const endJoint = joints.find(
              (j) => j.joint_id === member.end_joint_id
            );

            if (!startJoint || !endJoint) return null;

            const x1 = startJoint.x_coordinate * scale + offsetX;
            const y1 = offsetY - startJoint.y_coordinate * scale;
            const x2 = endJoint.x_coordinate * scale + offsetX;
            const y2 = offsetY - endJoint.y_coordinate * scale;

            // Member line
            const memberColor =
              member.member_type === "Beam" ? "#3B82F6" : "#10B981";
            const lineWidth = member.member_type === "Beam" ? 6 : 4;

            return (
              <g key={`member-${index}`}>
                {/* Member line */}
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={memberColor}
                  strokeWidth={lineWidth}
                  opacity={0.8}
                />

                {/* Member label */}
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 10}
                  textAnchor="middle"
                  className="text-sm font-semibold fill-gray-700"
                >
                  {member.member_id}
                </text>

                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 + 5}
                  textAnchor="middle"
                  className="text-xs fill-gray-600"
                >
                  {member.member_type} ({member.length.toFixed(1)}m)
                </text>

                {/* Draw loads */}
                {member.loads.map((load, loadIndex) => {
                  const loadPos = load.position / member.length;
                  const loadX = x1 + (x2 - x1) * loadPos;
                  const loadY = y1 + (y2 - y1) * loadPos;

                  if (load.load_type === "Point") {
                    return (
                      <g key={`load-${index}-${loadIndex}`}>
                        <line
                          x1={loadX}
                          y1={loadY - 30}
                          x2={loadX}
                          y2={loadY}
                          stroke="red"
                          strokeWidth="3"
                          markerEnd="url(#arrowhead-red)"
                        />
                        <text
                          x={loadX}
                          y={loadY - 35}
                          textAnchor="middle"
                          className="text-xs fill-red-600"
                        >
                          {load.magnitude}kN
                        </text>
                      </g>
                    );
                  } else if (load.load_type === "UDL") {
                    // Draw distributed load arrows
                    const arrows = [];
                    const numArrows = 8;
                    for (let i = 0; i < numArrows; i++) {
                      const t = i / (numArrows - 1);
                      const arrowX = x1 + (x2 - x1) * t;
                      const arrowY = y1 + (y2 - y1) * t;
                      arrows.push(
                        <line
                          key={i}
                          x1={arrowX}
                          y1={arrowY - 25}
                          x2={arrowX}
                          y2={arrowY}
                          stroke="blue"
                          strokeWidth="2"
                          markerEnd="url(#arrowhead-blue)"
                        />
                      );
                    }
                    return (
                      <g key={`load-${index}-${loadIndex}`}>
                        {arrows}
                        <text
                          x={(x1 + x2) / 2}
                          y={(y1 + y2) / 2 - 30}
                          textAnchor="middle"
                          className="text-xs fill-blue-600"
                        >
                          {load.magnitude}kN/m
                        </text>
                      </g>
                    );
                  }
                  return null;
                })}
              </g>
            );
          })}

          {/* Draw joints */}
          {joints.map((joint, index) => {
            const x = joint.x_coordinate * scale + offsetX;
            const y = offsetY - joint.y_coordinate * scale;

            return (
              <g key={`joint-${index}`}>
                {/* Joint circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={8}
                  fill={joint.is_support ? "#DC2626" : "#1F2937"}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />

                {/* Joint label */}
                <text
                  x={x}
                  y={y - 15}
                  textAnchor="middle"
                  className="text-sm font-bold fill-gray-800"
                >
                  {joint.joint_id}
                </text>

                {/* Support symbol */}
                {joint.is_support && (
                  <g>
                    <polygon
                      points={`${x - 12},${y + 15} ${x + 12},${y + 15} ${x},${y + 8
                        }`}
                      fill="#DC2626"
                      stroke="#B91C1C"
                      strokeWidth={1}
                    />
                    {/* Hatching */}
                    {[...Array(5)].map((_, i) => (
                      <line
                        key={i}
                        x1={x - 10 + i * 5}
                        y1={y + 15}
                        x2={x - 8 + i * 5}
                        y2={y + 20}
                        stroke="#B91C1C"
                        strokeWidth="1"
                      />
                    ))}
                  </g>
                )}

                {/* Display moments if results available */}
                {results && results.final_moments && (
                  <text
                    x={x + 15}
                    y={y - 5}
                    className="text-xs fill-purple-600 font-semibold"
                  >
                    {/* Show sum of moments at joint */}
                    {Object.entries(results.final_moments)
                      .filter(([memberId, moments]) => {
                        const member = members.find(
                          (m) => m.member_id === memberId
                        );
                        return (
                          member &&
                          (member.start_joint_id === joint.joint_id ||
                            member.end_joint_id === joint.joint_id)
                        );
                      })
                      .reduce((sum, [memberId, moments]) => {
                        const member = members.find(
                          (m) => m.member_id === memberId
                        );
                        if (member.start_joint_id === joint.joint_id) {
                          return sum + moments.start;
                        } else {
                          return sum + moments.end;
                        }
                      }, 0)
                      .toFixed(1)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Arrow markers */}
          <defs>
            <marker
              id="arrowhead-red"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="red" />
            </marker>
            <marker
              id="arrowhead-blue"
              markerWidth="8"
              markerHeight="5"
              refX="7"
              refY="2.5"
              orient="auto"
            >
              <polygon points="0 0, 8 2.5, 0 5" fill="blue" />
            </marker>
          </defs>
        </svg>
      </div>
    );
  };

  const IterationHistoryPanel = ({ results }) => {
    if (!results || !results.iteration_history) return null;

    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Zap className="h-5 w-5 mr-2 text-yellow-600" />
          Hardy Cross Iteration History
        </h3>

        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm text-blue-800">
            <div className="font-semibold mb-2">
              Moment Distribution Process:
            </div>
            <div className="space-y-1">
              <div>1. Calculate Fixed-End Moments (FEM) from applied loads</div>
              <div>2. Determine Distribution Factors (DF) at each joint</div>
              <div>3. Distribute unbalanced moments iteratively</div>
              <div>4. Carry-over moments to far ends (factor = 0.5)</div>
              <div>5. Continue until convergence achieved</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {results.iteration_history.map((iteration, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-gray-700">
                  {iteration.type === "Initial FEM"
                    ? "Initial Fixed-End Moments"
                    : `Iteration ${iteration.iteration}`}
                </h4>
                {iteration.max_unbalance && (
                  <span
                    className={`text-sm px-2 py-1 rounded ${iteration.max_unbalance < results.convergence_tolerance
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                      }`}
                  >
                    Max Unbalance: {iteration.max_unbalance.toFixed(6)} kN⋅m
                  </span>
                )}
              </div>

              {/* Moments table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-2 py-1">
                        Joint
                      </th>
                      {Object.keys(iteration.moments || {}).map((jointId) => (
                        <th
                          key={jointId}
                          className="border border-gray-300 px-2 py-1"
                        >
                          {jointId}
                        </th>
                      ))}
                      <th className="border border-gray-300 px-2 py-1">
                        Unbalance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.member_id}>
                        <td className="border border-gray-300 px-2 py-1 font-medium">
                          {member.member_id}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right">
                          {iteration.moments?.[member.start_joint_id]?.[
                            member.member_id
                          ]?.toFixed(2) || "0.00"}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right">
                          {iteration.moments?.[member.end_joint_id]?.[
                            member.member_id
                          ]?.toFixed(2) || "0.00"}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right">
                          {iteration.unbalanced_moments?.[
                            member.start_joint_id
                          ]?.toFixed(3) || "0.000"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Show distribution details for this iteration */}
              {iteration.changes &&
                Object.keys(iteration.changes).length > 0 && (
                  <div className="mt-3 p-3 bg-gray-50 rounded">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      Distribution Details:
                    </div>
                    {Object.entries(iteration.changes).map(
                      ([jointId, change]) => (
                        <div
                          key={jointId}
                          className="text-sm text-gray-600 mb-1"
                        >
                          Joint {jointId}: Distributed{" "}
                          {Math.abs(change.unbalanced_moment).toFixed(2)} kN⋅m
                        </div>
                      )
                    )}
                  </div>
                )}
            </div>
          ))}
        </div>

        {/* Convergence summary */}
        <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="text-green-800">
            <div className="font-semibold mb-1">Analysis Summary:</div>
            <div>
              Convergence:{" "}
              {results.convergence_achieved ? "✓ Achieved" : "✗ Not achieved"}
            </div>
            <div>Iterations performed: {results.iterations_performed}</div>
            <div>Tolerance: {results.convergence_tolerance || 0.001} kN⋅m</div>
          </div>
        </div>
      </div>
    );
  };



  const DistributionFactorsPanel = ({ results }) => {
    if (!results || !results.distribution_factors) return null;

    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-4">
          Distribution Factors & Stiffness
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribution Factors */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">
              Distribution Factors (DF)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-3 py-2">Joint</th>
                    <th className="border border-gray-300 px-3 py-2">Member</th>
                    <th className="border border-gray-300 px-3 py-2">DF</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(results.distribution_factors).map(
                    ([jointId, factors]) =>
                      Object.entries(factors).map(([memberId, factor]) => (
                        <tr key={`${jointId}-${memberId}`}>
                          <td className="border border-gray-300 px-3 py-2 font-medium">
                            {jointId}
                          </td>
                          <td className="border border-gray-300 px-3 py-2">
                            {memberId}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-right">
                            {factor.toFixed(3)}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fixed-End Moments */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">
              Fixed-End Moments (FEM)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-3 py-2">Member</th>
                    <th className="border border-gray-300 px-3 py-2">
                      Start (kN⋅m)
                    </th>
                    <th className="border border-gray-300 px-3 py-2">
                      End (kN⋅m)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(results.fixed_end_moments).map(
                    ([memberId, moments]) => (
                      <tr key={memberId}>
                        <td className="border border-gray-300 px-3 py-2 font-medium">
                          {memberId}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-right">
                          {moments.start.toFixed(2)}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-right">
                          {moments.end.toFixed(2)}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Final Moments */}
        <div className="mt-6">
          <h4 className="font-semibold text-gray-700 mb-3">
            Final Member End Moments
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-4 py-2">Member</th>
                  <th className="border border-gray-300 px-4 py-2">
                    Start Joint
                  </th>
                  <th className="border border-gray-300 px-4 py-2">
                    Start Moment (kN⋅m)
                  </th>
                  <th className="border border-gray-300 px-4 py-2">
                    End Joint
                  </th>
                  <th className="border border-gray-300 px-4 py-2">
                    End Moment (kN⋅m)
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(results.final_moments).map(
                  ([memberId, moments]) => {
                    const member = members.find(
                      (m) => m.member_id === memberId
                    );
                    return (
                      <tr key={memberId}>
                        <td className="border border-gray-300 px-4 py-2 font-semibold">
                          {memberId}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {member?.start_joint_id}
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-right">
                          {moments.start.toFixed(2)}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {member?.end_joint_id}
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-right">
                          {moments.end.toFixed(2)}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const MemberDiagramsPanel = ({ results, members }) => {
    if (!results || !results.moment_data) return null;

    return (
      <div className="space-y-6">
        {Object.entries(results.moment_data).map(([memberId, momentData]) => {
          // Find member to get length for interpolation
          const member = members && members.find((m) => m.member_id === memberId);

          const shearData = results.shear_force_data[memberId] || [];

          // Calculate breakdown if member info is available
          let bmdSupportsData = [];
          let bmdLoadsData = [];

          if (member && results.final_moments && results.final_moments[memberId]) {
            const startMoment = results.final_moments[memberId].start;
            const endMoment = results.final_moments[memberId].end;
            const length = member.length;

            bmdSupportsData = momentData.map((pt) => {
              const x = pt.x;
              // Linear interpolation: M(x) = M_start + (M_end - M_start) * x / L
              const y = startMoment + (endMoment - startMoment) * (x / length);
              return { x, y };
            });

            bmdLoadsData = momentData.map((pt, i) => {
              const supportY = bmdSupportsData[i] ? bmdSupportsData[i].y : 0;
              return { x: pt.x, y: pt.y - supportY };
            });
          }

          return (
            <div key={memberId} className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-lg font-semibold mb-4">
                Member {memberId} - Force Diagrams
              </h3>

              {/* Combined BMD */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-700 mb-3">
                  Bending Moment Diagram (Combined)
                </h4>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={momentData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" label={{ value: "Position (m)", position: "insideBottom", offset: -5 }} />
                    <YAxis label={{ value: "Moment (kN⋅m)", angle: -90, position: "insideLeft" }} />
                    <Tooltip formatter={(value) => [`${value.toFixed(2)} kN⋅m`, "Moment"]} />
                    <ReferenceLine y={0} stroke="black" strokeDasharray="2 2" />
                    <Area
                      type="monotone"
                      dataKey="y"
                      stroke="#3B82F6"
                      fill="#3B82F6"
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* BMD Breakdown */}
              {member && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* BMD - Due to Loads */}
                  <div>
                    <h4 className="font-semibold text-green-600 mb-3">
                      BMD - Due to Vertical Loads Only
                    </h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={bmdLoadsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="x" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`${value.toFixed(2)} kN⋅m`, "Moment (Loads)"]} />
                        <ReferenceLine y={0} stroke="black" strokeDasharray="2 2" />
                        <Area
                          type="monotone"
                          dataKey="y"
                          stroke="#10B981"
                          fill="#10B981"
                          fillOpacity={0.3}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* BMD - Due to Support Moments */}
                  <div>
                    <h4 className="font-semibold text-purple-600 mb-3">
                      BMD - Due to Support Moments
                    </h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={bmdSupportsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="x" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`${value.toFixed(2)} kN⋅m`, "Moment (Supports)"]} />
                        <ReferenceLine y={0} stroke="black" strokeDasharray="2 2" />
                        <Area
                          type="monotone"
                          dataKey="y"
                          stroke="#8B5CF6"
                          fill="#8B5CF6"
                          fillOpacity={0.3}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Shear Force Diagram */}
              {shearData && (
                <div className="mt-6">
                  <h4 className="font-semibold text-gray-700 mb-3">
                    Shear Force Diagram
                  </h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={shearData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="x" label={{ value: "Position (m)", position: "insideBottom", offset: -5 }} />
                      <YAxis label={{ value: "Shear (kN)", angle: -90, position: "insideLeft" }} />
                      <Tooltip formatter={(value) => [`${value.toFixed(2)} kN`, "Shear"]} />
                      <ReferenceLine y={0} stroke="black" strokeDasharray="2 2" />
                      <Area
                        type="monotone"
                        dataKey="y"
                        stroke="#EF4444"
                        fill="#EF4444"
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <GitBranch className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Moment Distribution Method (Hardy Cross)
                </h1>
                <p className="text-sm text-gray-600">
                  Professional Frame Analysis with BS 8110 Design Integration
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => loadExample("Two-Span Continuous Beam")}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
              >
                <BookOpen className="h-4 w-4 inline mr-1" />
                Multi-Span
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-200 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("input")}
              className={`flex-1 px-4 py-2 rounded-md transition-colors ${activeTab === "input"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-800"
                }`}
            >
              <Settings className="h-4 w-4 inline mr-2" />
              Frame Configuration
            </button>
            <button
              onClick={() => setActiveTab("results")}
              className={`flex-1 px-4 py-2 rounded-md transition-colors ${activeTab === "results"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-800"
                }`}
              disabled={!results}
            >
              <Zap className="h-4 w-4 inline mr-2" />
              MD Analysis Results
            </button>
            <button
              onClick={() => setActiveTab("design-config")}
              className={`flex-1 px-4 py-2 rounded-md transition-colors ${activeTab === "design-config"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-800"
                }`}
            >
              <Wrench className="h-4 w-4 inline mr-2" />
              Design Configuration
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Success Display */}
        {results && !error && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
            <span className="text-green-700">
              Moment Distribution analysis completed successfully!
            </span>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === "input" && (
          <div className="space-y-6">
            {/* Joints Configuration */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Joints Configuration</h2>
                <button
                  onClick={addJoint}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Joint
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2">
                        Joint ID
                      </th>
                      <th className="border border-gray-300 px-4 py-2">
                        Joint Type
                      </th>
                      <th className="border border-gray-300 px-4 py-2">
                        X Coordinate (m)
                      </th>
                      <th className="border border-gray-300 px-4 py-2">
                        Y Coordinate (m)
                      </th>
                      <th className="border border-gray-300 px-4 py-2">
                        Support
                      </th>
                      <th className="border border-gray-300 px-4 py-2">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {joints.map((joint, index) => (
                      <tr
                        key={index}
                        className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="border border-gray-300 px-4 py-2">
                          <input
                            type="text"
                            value={joint.joint_id}
                            onChange={(e) =>
                              updateJoint(index, "joint_id", e.target.value)
                            }
                            className="w-full border-0 bg-transparent"
                          />
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <select
                            value={joint.joint_type}
                            onChange={(e) =>
                              updateJoint(index, "joint_type", e.target.value)
                            }
                            className="w-full border-0 bg-transparent"
                          >
                            <option value="Fixed Joint">Fixed Joint</option>
                            <option value="Pinned Joint">Pinned Joint</option>
                            <option value="Free End">Free End</option>
                          </select>
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <input
                            type="number"
                            value={joint.x_coordinate}
                            onChange={(e) =>
                              updateJoint(index, "x_coordinate", e.target.value)
                            }
                            className="w-full border-0 bg-transparent"
                            step="0.1"
                          />
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <input
                            type="number"
                            value={joint.y_coordinate}
                            onChange={(e) =>
                              updateJoint(index, "y_coordinate", e.target.value)
                            }
                            className="w-full border-0 bg-transparent"
                            step="0.1"
                          />
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={joint.is_support}
                            onChange={(e) =>
                              updateJoint(index, "is_support", e.target.checked)
                            }
                            className="form-checkbox"
                          />
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-center">
                          {joints.length > 2 && (
                            <button
                              onClick={() => removeJoint(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Members Configuration */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Members Configuration</h2>
                <button
                  onClick={addMember}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Member
                </button>
              </div>

              <div className="space-y-4">
                {members.map((member, memberIndex) => (
                  <div
                    key={memberIndex}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-medium">
                        Member {member.member_id}
                      </h3>
                      {members.length > 1 && (
                        <button
                          onClick={() => removeMember(memberIndex)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Minus className="h-5 w-5" />
                        </button>
                      )}
                    </div>

                    {/* Member Properties */}
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Member ID
                        </label>
                        <input
                          type="text"
                          value={member.member_id}
                          onChange={(e) =>
                            updateMember(
                              memberIndex,
                              "member_id",
                              e.target.value
                            )
                          }
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Type
                        </label>
                        <select
                          value={member.member_type}
                          onChange={(e) =>
                            updateMember(
                              memberIndex,
                              "member_type",
                              e.target.value
                            )
                          }
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        >
                          <option value="Beam">Beam</option>
                          <option value="Column">Column</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Joint
                        </label>
                        <select
                          value={member.start_joint_id}
                          onChange={(e) =>
                            updateMember(
                              memberIndex,
                              "start_joint_id",
                              e.target.value
                            )
                          }
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        >
                          {joints.map((joint) => (
                            <option key={joint.joint_id} value={joint.joint_id}>
                              {joint.joint_id}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Joint
                        </label>
                        <select
                          value={member.end_joint_id}
                          onChange={(e) =>
                            updateMember(
                              memberIndex,
                              "end_joint_id",
                              e.target.value
                            )
                          }
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        >
                          {joints.map((joint) => (
                            <option key={joint.joint_id} value={joint.joint_id}>
                              {joint.joint_id}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Length (m)
                        </label>
                        <input
                          type="number"
                          value={member.length}
                          onChange={(e) =>
                            updateMember(memberIndex, "length", e.target.value)
                          }
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          step="0.1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          I (m⁴)
                        </label>
                        <input
                          type="number"
                          value={member.I}
                          onChange={(e) =>
                            updateMember(memberIndex, "I", e.target.value)
                          }
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          step="1e-6"
                        />
                      </div>
                    </div>

                    {/* Member Loads */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-gray-700">Loads</h4>
                        <button
                          onClick={() => addLoad(memberIndex)}
                          className="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
                        >
                          <Plus className="h-4 w-4 inline mr-1" />
                          Add Load
                        </button>
                      </div>

                      {member.loads.map((load, loadIndex) => (
                        <div
                          key={loadIndex}
                          className="bg-gray-50 p-3 rounded mb-2"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <h5 className="text-sm font-medium text-gray-600">
                              Load {loadIndex + 1}
                            </h5>
                            <button
                              onClick={() => removeLoad(memberIndex, loadIndex)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Load Type
                              </label>
                              <select
                                value={load.load_type}
                                onChange={(e) =>
                                  updateLoad(
                                    memberIndex,
                                    loadIndex,
                                    "load_type",
                                    e.target.value
                                  )
                                }
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                              >
                                <option value="Point">Point Load</option>
                                <option value="UDL">UDL</option>
                                <option value="Partial UDL">Partial UDL</option>
                                <option value="Triangular">Triangular</option>
                                <option value="Trapezoidal">Trapezoidal</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Magnitude{" "}
                                {load.load_type === "Point" ? "(kN)" : "(kN/m)"}
                              </label>
                              <input
                                type="number"
                                value={load.magnitude}
                                onChange={(e) =>
                                  updateLoad(
                                    memberIndex,
                                    loadIndex,
                                    "magnitude",
                                    e.target.value
                                  )
                                }
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                step="0.1"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Position (m)
                              </label>
                              <input
                                type="number"
                                value={load.position}
                                onChange={(e) =>
                                  updateLoad(
                                    memberIndex,
                                    loadIndex,
                                    "position",
                                    e.target.value
                                  )
                                }
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                step="0.1"
                                max={member.length}
                              />
                            </div>
                            {(load.load_type === "Partial UDL" ||
                              load.load_type === "Triangular" ||
                              load.load_type === "Trapezoidal") && (
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Length (m)
                                  </label>
                                  <input
                                    type="number"
                                    value={load.length}
                                    onChange={(e) =>
                                      updateLoad(
                                        memberIndex,
                                        loadIndex,
                                        "length",
                                        e.target.value
                                      )
                                    }
                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                    step="0.1"
                                  />
                                </div>
                              )}
                          </div>

                          {load.load_type === "Trapezoidal" && (
                            <div className="mt-3">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                End Magnitude (kN/m)
                              </label>
                              <input
                                type="number"
                                value={load.magnitude2}
                                onChange={(e) =>
                                  updateLoad(
                                    memberIndex,
                                    loadIndex,
                                    "magnitude2",
                                    e.target.value
                                  )
                                }
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm md:w-1/4"
                                step="0.1"
                              />
                            </div>
                          )}
                        </div>
                      ))}

                      {member.loads.length === 0 && (
                        <div className="text-gray-500 text-sm text-center py-4">
                          No loads defined for this member
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Analysis Settings */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold mb-4">Analysis Settings</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Convergence Tolerance
                  </label>
                  <input
                    type="number"
                    value={convergenceSettings.convergence_tolerance}
                    onChange={(e) =>
                      setConvergenceSettings({
                        ...convergenceSettings,
                        convergence_tolerance: parseFloat(e.target.value),
                      })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    step="0.0001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Iterations
                  </label>
                  <input
                    type="number"
                    value={convergenceSettings.max_iterations}
                    onChange={(e) =>
                      setConvergenceSettings({
                        ...convergenceSettings,
                        max_iterations: parseInt(e.target.value),
                      })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>
            </div>

            {/* Frame Schematic */}
            <FrameSchematic
              joints={joints}
              members={members}
              results={results}
            />

            {/* Analyze Button */}
            <div className="flex justify-center">
              <button
                onClick={analyzeMomentDistribution}
                disabled={loading}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center text-lg font-semibold"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                ) : (
                  <Zap className="h-5 w-5 mr-3" />
                )}
                {loading ? "Analyzing..." : "Analyze Frame (Hardy Cross)"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "results" && results && (
          <div className="space-y-6">
            <FrameSchematic
              joints={joints}
              members={members}
              results={results}
            />
            <IterationHistoryPanel results={results} />
            <DistributionFactorsPanel results={results} />
            <MemberDiagramsPanel results={results} members={members} />
          </div>
        )}

        {/* 
        {activeTab === "design-config" && (
          <div className="text-center text-gray-500 py-8">
            <p>Design configuration removed. Use RCBeamDesigner component for design.</p>
          </div>
        )} */}


      </div>
    </div>
  );
};

export default MomentDistributionCalculator;
