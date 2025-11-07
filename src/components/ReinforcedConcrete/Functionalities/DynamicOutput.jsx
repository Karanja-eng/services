import React from "react";

export default function DynamicOutput({ data, labels = {} }) {
  if (!data) return null;

  return (
    <div className="mt-2 p-2 bg-white rounded-xl shadow-md w-72 h-96">
      <h3 className="text-xl font-bold mb-2 text-center">Design Output</h3>
      {Object.entries(data).map(([key, value]) => (
        <p key={key}>
          <strong>{labels[key] || key.replace(/_/g, " ")} :</strong> {value}
        </p>
      ))}
    </div>
  );
}
