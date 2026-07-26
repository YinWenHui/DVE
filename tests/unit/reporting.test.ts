import { describe, expect, it } from "vitest";
import { createSyntheticRecords } from "@/data/seed";
import { aggregateRows, applyReportFilters, chartOption, visualData } from "@/lib/reporting";
import type { VisualDefinition } from "@/types";

describe("report visual metadata", () => {
  const rows = createSyntheticRecords(2);

  it("applies report filters before aggregation", () => {
    const lineA = applyReportFilters(rows, [{ id: "line-a", field: "Line", operator: "equals", value: "Line A" }]);
    expect(lineA).toHaveLength(4);
    expect(aggregateRows(lineA, "ActualQty", "sum")).toBeGreaterThan(0);
  });

  it("creates grouped show-data rows with a secondary measure", () => {
    const visual: VisualDefinition = { id: "combo", type: "combo", title: "Plan and actual", x: 0, y: 0, w: 6, h: 5, dimension: "Line", measure: "ActualQty", secondaryMeasure: "PlanQty", aggregation: "sum" };
    const data = visualData(visual, rows);
    expect(data.columns).toEqual(["Line", "ActualQty", "PlanQty"]);
    expect(data.rows).toHaveLength(3);
  });

  it("builds chart options for the expanded visual catalog", () => {
    const base: VisualDefinition = { id: "chart", type: "treemap", title: "Output", x: 0, y: 0, w: 6, h: 5, dimension: "Model", measure: "ActualQty", aggregation: "sum" };
    expect(chartOption(base, rows)).toMatchObject({ series: [{ type: "treemap" }] });
    expect(chartOption({ ...base, type: "gauge", dimension: undefined }, rows)).toMatchObject({ series: [{ type: "gauge" }] });
    expect(chartOption({ ...base, type: "scatter", secondaryMeasure: "PlanQty" }, rows)).toMatchObject({ series: [{ type: "scatter" }] });
  });
});
