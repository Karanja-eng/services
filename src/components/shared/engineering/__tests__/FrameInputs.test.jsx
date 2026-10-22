import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

import { StoreyGridFields, MaterialGradeFields } from "../FrameInputs";

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

function changeInput(input, value) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  ).set;
  setter.call(input, value);
  act(() => {
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function changeSelect(select, value) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value"
  ).set;
  setter.call(select, value);
  act(() => {
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("StoreyGridFields (regular frame composition)", () => {
  test("renders the shared storey/bay geometry fields", () => {
    const { container, unmount } = render(
      <StoreyGridFields
        value={{ floors: "", bays: "", storyHeight: "", bayWidth: "" }}
        onChange={() => {}}
      />
    );

    expect(container.textContent).toContain("Number of storeys");
    expect(container.textContent).toContain("Number of bays");
    expect(container.textContent).toContain("Storey height");
    expect(container.textContent).toContain("Bay width");
    // Lateral load is only shown when asked for.
    expect(container.textContent).not.toContain("Lateral load");

    unmount();
  });

  test("emits only the changed field as a patch", () => {
    const onChange = jest.fn();
    const { container, unmount } = render(
      <StoreyGridFields
        value={{ floors: "", bays: "", storyHeight: "", bayWidth: "" }}
        onChange={onChange}
      />
    );

    changeInput(container.querySelectorAll("input")[0], "6");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ floors: "6" });

    unmount();
  });

  test("includes the lateral load field when enabled", () => {
    const onChange = jest.fn();
    const { container, unmount } = render(
      <StoreyGridFields
        value={{ floors: "5", bays: "3", storyHeight: "3.2", bayWidth: "6", lateralLoad: "" }}
        onChange={onChange}
        showLateralLoad
        lateralLabel="Wind shear"
      />
    );

    expect(container.textContent).toContain("Wind shear");
    const inputs = container.querySelectorAll("input");
    changeInput(inputs[inputs.length - 1], "120");
    expect(onChange).toHaveBeenCalledWith({ lateralLoad: "120" });

    unmount();
  });

  test("renders an explanatory note without altering field values", () => {
    const { container, unmount } = render(
      <StoreyGridFields
        value={{ floors: "7" }}
        onChange={() => {}}
        note="Shared with the tall-building modules."
      />
    );
    expect(container.textContent).toContain("Shared with the tall-building modules.");
    expect(container.querySelectorAll("input")[0].value).toBe("7");
    unmount();
  });
});

describe("MaterialGradeFields", () => {
  test("emits the concrete grade under the caller's key", () => {
    const onChange = jest.fn();
    const { container, unmount } = render(
      <MaterialGradeFields
        value={{ concreteGrade: "C30", steelGrade: "500" }}
        onChange={onChange}
        concreteOptions={[
          { value: "C25", label: "C25" },
          { value: "C30", label: "C30" },
        ]}
        steelOptions={[
          { value: "250", label: "250" },
          { value: "500", label: "500" },
        ]}
      />
    );

    changeSelect(container.querySelectorAll("select")[0], "C25");
    expect(onChange).toHaveBeenCalledWith({ concreteGrade: "C25" });

    unmount();
  });

  test("keeps the reinforcement grade separate from the concrete grade", () => {
    const onChange = jest.fn();
    const { container, unmount } = render(
      <MaterialGradeFields
        value={{ concreteGrade: "C30", steelGrade: "500" }}
        onChange={onChange}
        steelOptions={[
          { value: "250", label: "250" },
          { value: "500", label: "500" },
        ]}
        concreteOptions={[{ value: "C30", label: "C30" }]}
      />
    );

    changeSelect(container.querySelectorAll("select")[1], "250");
    expect(onChange).toHaveBeenCalledWith({ steelGrade: "250" });

    unmount();
  });
});
