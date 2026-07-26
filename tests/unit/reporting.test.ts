import { describe, expect, it } from "vitest";
import { createSyntheticRecords } from "@/data/seed";
import { aggregateRows, applyReportFilters, applyVisualDrillPath, chartOption, drillthroughTargets, resolveReportCanvasState, visualData, visualHierarchy } from "@/lib/reporting";
import type { ReportPage, VisualDefinition } from "@/types";

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

  it("resolves hierarchy levels and carries the selected parent context", () => {
    const visual: VisualDefinition = { id: "drill", type: "bar", title: "Output hierarchy", x: 0, y: 0, w: 6, h: 5, dimension: "Line", hierarchy: ["Line", "Model", "Shift", "Line"], measure: "ActualQty", aggregation: "sum" };
    expect(visualHierarchy(visual)).toEqual(["Line", "Model", "Shift"]);
    const drilled = applyVisualDrillPath(rows, [{ field: "Line", value: "line a" }, { field: "Model", value: "Model X100" }]);
    expect(drilled).not.toHaveLength(0);
    expect(drilled.every((row) => row.Line === "Line A" && row.Model === "Model X100")).toBe(true);
  });

  it("finds hidden drillthrough pages that accept the selected field", () => {
    const pages: ReportPage[] = [
      { id: "overview", name: "Overview", ordinal: 0, visuals: [] },
      { id: "line-detail", name: "Line detail", ordinal: 1, hidden: true, drillthrough: { fields: ["Line", "Model"], keepAllFilters: true }, visuals: [] },
    ];
    expect(drillthroughTargets(pages, "overview", "Line").map((page) => page.id)).toEqual(["line-detail"]);
    expect(drillthroughTargets(pages, "overview", "Shift")).toEqual([]);
    expect(drillthroughTargets(pages, "line-detail", "Line")).toEqual([]);
  });

  it("builds chart options for the expanded visual catalog", () => {
    const base: VisualDefinition = { id: "chart", type: "treemap", title: "Output", x: 0, y: 0, w: 6, h: 5, dimension: "Model", measure: "ActualQty", aggregation: "sum" };
    expect(chartOption(base, rows)).toMatchObject({ series: [{ type: "treemap" }] });
    expect(chartOption({ ...base, type: "gauge", dimension: undefined }, rows)).toMatchObject({ series: [{ type: "gauge" }] });
    expect(chartOption({ ...base, type: "scatter", secondaryMeasure: "PlanQty" }, rows)).toMatchObject({ series: [{ type: "scatter" }] });
  });

  it("resolves honest report canvas states without hiding a valid previous version", () => {
    const base = { datasetStatus: "healthy" as const, totalRows: 100, metadataRows: 50, filteredRows: 25, visualCount: 4 };
    expect(resolveReportCanvasState(base)).toBe("ready");
    expect(resolveReportCanvasState({ ...base, datasetStatus: "stale" })).toBe("stale");
    expect(resolveReportCanvasState({ ...base, datasetStatus: "failed" })).toBe("stale");
    expect(resolveReportCanvasState({ ...base, datasetStatus: "offline", totalRows: 0, metadataRows: 0, filteredRows: 0 })).toBe("offline");
    expect(resolveReportCanvasState({ ...base, datasetStatus: "failed", totalRows: 0, metadataRows: 0, filteredRows: 0 })).toBe("error");
    expect(resolveReportCanvasState({ ...base, visualCount: 0 })).toBe("empty-report");
    expect(resolveReportCanvasState({ ...base, metadataRows: 0, filteredRows: 0 })).toBe("no-metadata-results");
    expect(resolveReportCanvasState({ ...base, filteredRows: 0 })).toBe("no-results");
  });
});
