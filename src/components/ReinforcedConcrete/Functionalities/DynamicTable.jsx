import React, { useEffect, useState } from "react";
import axios from "axios";

const BeamHistoryPage = () => {
  const [beamData, setBeamData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("http://localhost:8000/beam-records") // Adjust the endpoint accordingly
      .then((res) => {
        setBeamData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching beam data", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Beam Design Records</h2>
      {loading ? <p>Loading...</p> : <DynamicTable data={beamData} />}
    </div>
  );
};

const DynamicTable = ({ data }) => {
  if (!data || data.length === 0) return <p>No data available.</p>;

  // Get table headers from the keys of the first row
  const headers = Object.keys(data[0]);

  return (
    <div className="overflow-x-auto p-4">
      <table className="min-w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            {headers.map((header) => (
              <th key={header} className="border p-2 font-semibold text-left">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              {headers.map((header) => (
                <td key={header} className="border p-2">
                  {row[header]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BeamHistoryPage;
