import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

import { StatusBadge, ResultBanner, UtilizationGauge, KeyValueGrid } from "../Status";
import { EmptyState, ErrorNotice, LoadingState } from "../Feedback";
import { TableScrollRegion } from "../TableRegion";
import { PageHeader, Section, ActionBar } from "../PageLayout";

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

describe("status presentation", () => {
  test("StatusBadge always prints the status word, not colour alone", () => {
    const { container, unmount } = render(<StatusBadge label="Shear" status={false} />);
    expect(container.textContent).toContain("Shear");
    expect(container.textContent).toContain("FAIL");
    unmount();
  });

  test("StatusBadge maps boolean, string and missing values", () => {
    const cases = [
      { status: true, expected: "PASS" },
      { status: "warning", expected: "CHECK" },
      { status: undefined, expected: "PENDING" },
    ];
    for (const { status, expected } of cases) {
      const { container, unmount } = render(<StatusBadge label="Check" status={status} />);
      expect(container.textContent).toContain(expected);
      unmount();
    }
  });

  test("ResultBanner exposes a status role and the verdict text", () => {
    const { container, unmount } = render(
      <ResultBanner status="fail" title="Design issues detected" description="Review spans." />
    );
    const banner = container.querySelector('[role="status"]');
    expect(banner).not.toBeNull();
    expect(container.textContent).toContain("Design issues detected");
    expect(container.textContent).toContain("Review spans.");
    unmount();
  });

  test("UtilizationGauge reports demand as an accessible meter", () => {
    const { container, unmount } = render(
      <UtilizationGauge ratio={1.2} label="Shear V_Ed / V_Rd" detail="120 kN / 100 kN" />
    );
    const meter = container.querySelector('[role="meter"]');
    expect(meter).not.toBeNull();
    expect(meter.getAttribute("aria-valuenow")).toBe("120");
    expect(Number(meter.getAttribute("aria-valuemax"))).toBeGreaterThanOrEqual(120);
    expect(container.textContent).toContain("over capacity");
    unmount();
  });

  test("KeyValueGrid renders values with explicit units", () => {
    const { container, unmount } = render(
      <KeyValueGrid items={[{ label: "Concrete", value: 2.4, unit: "m³" }]} />
    );
    expect(container.textContent).toContain("Concrete");
    expect(container.textContent).toContain("2.4");
    expect(container.textContent).toContain("m³");
    unmount();
  });
});

describe("empty / loading / error states", () => {
  test("EmptyState shows a title and description", () => {
    const { container, unmount } = render(
      <EmptyState title="No items yet" description="Calculate to populate." />
    );
    expect(container.textContent).toContain("No items yet");
    expect(container.textContent).toContain("Calculate to populate.");
    unmount();
  });

  test("LoadingState is announced and shows the label", () => {
    const { container, unmount } = render(<LoadingState label="Calculating…" />);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.textContent).toContain("Calculating…");
    unmount();
  });

  test("ErrorNotice is an alert and offers a working retry", () => {
    const onRetry = jest.fn();
    const { container, unmount } = render(
      <ErrorNotice title="Design failed" message="Backend offline" onRetry={onRetry} />
    );
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain("Backend offline");

    act(() => {
      container.querySelector("button").click();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
    unmount();
  });
});

describe("table region", () => {
  test("provides a labelled, focusable horizontal scroll region", () => {
    const { container, unmount } = render(
      <TableScrollRegion label="Taking-off sheet" minWidth="40rem">
        <table>
          <tbody>
            <tr>
              <td>Item</td>
            </tr>
          </tbody>
        </table>
      </TableScrollRegion>
    );

    const region = container.querySelector('[role="region"]');
    expect(region).not.toBeNull();
    expect(region.getAttribute("aria-label")).toBe("Taking-off sheet");
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(container.querySelector("table")).not.toBeNull();

    unmount();
  });
});

describe("layout primitives", () => {
  test("PageHeader renders the title, meta and back control", () => {
    const onBack = jest.fn();
    const { container, unmount } = render(
      <PageHeader
        title="RC Beam Designer"
        subtitle="BS 8110"
        meta={<span>Meta</span>}
        onBack={onBack}
        backLabel="Edit parameters"
      />
    );

    expect(container.querySelector("h1").textContent).toContain("RC Beam Designer");
    expect(container.textContent).toContain("Edit parameters");

    act(() => {
      container.querySelector("button").click();
    });
    expect(onBack).toHaveBeenCalledTimes(1);

    unmount();
  });

  test("Section renders a titled region with its content", () => {
    const { container, unmount } = render(
      <Section title="Materials" description="Concrete and steel">
        <p>Fields</p>
      </Section>
    );
    expect(container.querySelector("h2").textContent).toBe("Materials");
    expect(container.textContent).toContain("Fields");
    unmount();
  });

  test("ActionBar renders its actions and optional hint", () => {
    const { container, unmount } = render(
      <ActionBar hint="Recalculates only the current span">
        <button type="button">Calculate</button>
      </ActionBar>
    );
    expect(container.textContent).toContain("Recalculates only the current span");
    expect(container.querySelector("button").textContent).toBe("Calculate");
    unmount();
  });
});
