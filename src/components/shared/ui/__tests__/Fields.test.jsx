import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

import {
  EngineeringField,
  NumberField,
  SelectField,
  CheckboxField,
} from "../Fields";

/**
 * These tests use the Jest + jsdom environment that `react-scripts test`
 * already provides, with React's own DOM API. No testing-library dependency is
 * added, and no new test runner is introduced.
 */

function render(ui) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Simulate a user edit on a controlled input the way React sees it. */
function change(input, value) {
  const setter = Object.getOwnPropertyDescriptor(
    input.tagName === "SELECT"
      ? window.HTMLSelectElement.prototype
      : window.HTMLInputElement.prototype,
    "value"
  ).set;
  setter.call(input, value);
  act(() => {
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const byTag = (container, tag, index = 0) => container.querySelectorAll(tag)[index];

describe("EngineeringField", () => {
  test("associates the label with its control and prints the unit", () => {
    const { container, unmount } = render(
      <EngineeringField label="Beam width" unit="mm" hint="Clear width of the web.">
        <input type="number" />
      </EngineeringField>
    );

    const label = byTag(container, "label");
    const input = byTag(container, "input");
    const htmlFor = label.getAttribute("for");

    expect(label.textContent).toContain("Beam width");
    expect(htmlFor).toBeTruthy();
    expect(input.id).toBe(htmlFor);
    expect(container.textContent).toContain("mm");
    expect(container.textContent).toContain("Clear width of the web.");

    unmount();
  });

  test("renders the error beside the field and marks it invalid", () => {
    const { container, unmount } = render(
      <EngineeringField label="Span" unit="m" error="Span must be greater than 0">
        <input type="number" />
      </EngineeringField>
    );

    const input = byTag(container, "input");
    expect(container.textContent).toContain("Span must be greater than 0");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBeTruthy();

    unmount();
  });

  test("does not print the hint when an error is present", () => {
    const { container, unmount } = render(
      <EngineeringField label="Span" hint="in metres" error="Required">
        <input type="number" />
      </EngineeringField>
    );

    expect(container.textContent).toContain("Required");
    expect(container.textContent).not.toContain("in metres");

    unmount();
  });
});

describe("NumberField", () => {
  test("passes the raw string value to onChange (no silent coercion)", () => {
    const onChange = jest.fn();
    const { container, unmount } = render(
      <NumberField label="Span" unit="m" value="" onChange={onChange} />
    );

    change(byTag(container, "input"), "12.50");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toBe("12.50");
    expect(typeof onChange.mock.calls[0][0]).toBe("string");

    unmount();
  });

  test("passes an empty string when the field is cleared", () => {
    const onChange = jest.fn();
    const { container, unmount } = render(
      <NumberField label="Span" unit="m" value="3" onChange={onChange} />
    );

    change(byTag(container, "input"), "");
    expect(onChange.mock.calls[0][0]).toBe("");

    unmount();
  });

  test("keeps the engineering unit visible", () => {
    const { container, unmount } = render(
      <NumberField label="Effective depth" unit="mm" value="450" onChange={() => {}} />
    );
    expect(container.textContent).toContain("Effective depth");
    expect(container.textContent).toContain("mm");
    unmount();
  });
});

describe("SelectField", () => {
  const options = [
    { value: "bs", label: "BS 8110" },
    { value: "ec2", label: "Eurocode 2" },
  ];

  test("renders the supplied options and emits the selected value", () => {
    const onChange = jest.fn();
    const { container, unmount } = render(
      <SelectField label="Design code" value="bs" onChange={onChange} options={options} />
    );

    const select = byTag(container, "select");
    expect(select.options).toHaveLength(2);
    expect(container.textContent).toContain("Eurocode 2");

    change(select, "ec2");
    expect(onChange).toHaveBeenCalledWith("ec2", expect.anything());

    unmount();
  });

  test("supports plain string options", () => {
    const { container, unmount } = render(
      <SelectField
        label="Exposure"
        value="Mild"
        onChange={() => {}}
        options={["Mild", "Severe"]}
      />
    );
    expect(byTag(container, "select").options).toHaveLength(2);
    unmount();
  });
});

describe("CheckboxField", () => {
  test("is labelled and reports the boolean state", () => {
    const onChange = jest.fn();
    const { container, unmount } = render(
      <CheckboxField label="Include rainwater goods" checked={false} onChange={onChange} />
    );

    const checkbox = byTag(container, "input");
    const label = byTag(container, "label");
    expect(label.getAttribute("for")).toBe(checkbox.id);

    act(() => {
      checkbox.click();
    });

    expect(onChange).toHaveBeenCalledWith(true, expect.anything());
    unmount();
  });
});
