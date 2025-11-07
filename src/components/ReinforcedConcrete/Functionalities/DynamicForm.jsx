import React from "react";

export default function DynamicForm({ fields, formData, onChange }) {
  return (
    <>
      {fields.map(({ name, label, type = "numer", placeholder = "" }) => (
        <div key={name} className="mb-2 ">
          <label className="block text-gray-700 font-medium mb-1">
            {" "}
            {label}
          </label>
          <input
            type={type}
            name={name}
            value={formData[name] || ""}
            onChange={onChange}
            required
            placeholder={placeholder}
            className="w-full p-1  border rounded-md shadow-sm"
          />
        </div>
      ))}
    </>
  );
}
