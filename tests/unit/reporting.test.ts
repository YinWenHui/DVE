import { describe, expect, it } from "vitest";
import { createSyntheticRecords, seedReports } from "@/data/seed";
import { aggregateRows, applyReportFilters, applyVisualDrillPath, chartOption, drillthroughTargets, matchesConditionalFormattingRule, resolveConditionalFormatting, resolveKpiTarget, resolveReportCanvasState, resolveVisualInteractionRows, sortVisualRows, visualData, visualHierarchy, visualInteractionMode } from "@/lib/reporting";
import type { ReportPage, VisualDefinition } from "@/types";

describe("report visual metadata", () => {
  const rows = createSyntheticRecords(2);

  it("applies report filters before aggregation", () => {
    const lineA = applyReportFilters(rows, [{ id: "line-a", field: "Line", operator: "equals", value: "Line A" }]);
    expect(lineA).toHaveLength(4);
    expect(aggregateRows(lineA, "ActualQty", "sum")).toBeGreaterThan(0);
  });

  it("executes advanced AND and OR clauses", () => {
    const production = applyReportFilters(rows, [{ id: "production", field: "BusinessUnit", operator: "equals", value: "", mode: "advanced", logicalOperator: "and", clauses: [{ operator: "equals", value: "Production" }, { operator: "isNotBlank" }] }]);
    expect(new Set(production.map((row) => row.Line))).toEqual(new Set(["Line A", "Line B"]));
    const allUnits = applyReportFilters(rows, [{ id: "units", field: "BusinessUnit", operator: "equals", value: "", mode: "advanced", logicalOperator: "or", clauses: [{ operator: "equals", value: "Production" }, { operator: "equals", value: "Assembly" }], locked: true, hidden: true }]);
    expect(allUnits).toHaveLength(rows.length);
  });

  it("applies relative-date windows from a stable reference date", () => {
    const datedRows = createSyntheticRecords(10);
    const latestDate = [...datedRows].map((row) => row.RecordDate).sort().at(-1)!;
    const recent = applyReportFilters(datedRows, [{ id: "recent", field: "RecordDate", operator: "greaterThanOrEqual", value: "", mode: "relativeDate", relativeDate: { direction: "last", amount: 3, unit: "days", includeToday: true } }], new Date(`${latestDate}T12:00:00.000Z`));
    expect(new Set(recent.map((row) => row.RecordDate)).size).toBe(3);
    expect(recent.every((row) => row.RecordDate <= latestDate)).toBe(true);
  });

  it("ranks Top and Bottom N categories by an aggregated measure", () => {
    const topLine = applyReportFilters(rows, [{ id: "top-line", field: "Line", operator: "equals", value: "", mode: "topN", topN: { direction: "top", count: 1, byMeasure: "ActualQty", aggregation: "sum" } }]);
    const bottomLine = applyReportFilters(rows, [{ id: "bottom-line", field: "Line", operator: "equals", value: "", mode: "topN", topN: { direction: "bottom", count: 1, byMeasure: "ActualQty", aggregation: "sum" } }]);
    expect(new Set(topLine.map((row) => row.Line))).toEqual(new Set(["Line C"]));
    expect(new Set(bottomLine.map((row) => row.Line))).toEqual(new Set(["Line A"]));
  });

  it("sorts grouped charts and table rows with authored visual metadata", () => {
    const visual: VisualDefinition = { id: "sorted", type: "bar", title: "Actual by line", x: 0, y: 0, w: 6, h: 5, dimension: "Line", measure: "ActualQty", aggregation: "sum", sort: { field: "ActualQty", direction: "desc" } };
    expect(visualData(visual, rows).rows.map((row) => row[0])).toEqual(["Line C", "Line B", "Line A"]);
    expect(sortVisualRows({ ...visual, sort: { field: "Line", direction: "desc" } }, rows).at(0)?.Line).toBe("Line C");
  });

  it("resolves ordered conditional-formatting targets and between thresholds", () => {
    const visual: VisualDefinition = { id: "conditional", type: "kpi", title: "Achievement", x: 0, y: 0, w: 2, h: 2, measure: "AchievementRate", conditionalFormatting: { rules: [
      { id: "green", field: "AchievementRate", operator: "greaterThanOrEqual", value: 1, target: "dataColor", color: "#18a66a" },
      { id: "later", field: "AchievementRate", operator: "greaterThan", value: 1, target: "dataColor", color: "#000000" },
      { id: "background", field: "AchievementRate", operator: "between", value: .95, secondValue: 1.05, target: "backgroundColor", color: "#dcfce7" },
    ] } };
    expect(matchesConditionalFormattingRule(1.02, visual.conditionalFormatting!.rules[2]!)).toBe(true);
    expect(resolveConditionalFormatting(visual, "AchievementRate", 1.02)).toEqual({ dataColor: "#18a66a", backgroundColor: "#dcfce7" });
    expect(resolveConditionalFormatting(visual, "ActualQty", 1.02)).toEqual({});
  });

  it("emits conditional data colors for grouped chart values", () => {
    const visual: VisualDefinition = { id: "colored", type: "bar", title: "Actual by line", x: 0, y: 0, w: 6, h: 5, dimension: "Line", measure: "ActualQty", aggregation: "sum", conditionalFormatting: { defaultColor: "#5c73e6", rules: [{ id: "all-green", field: "ActualQty", operator: "greaterThan", value: 0, target: "dataColor", color: "#18a66a" }] } };
    const option = chartOption(visual, rows) as { series: Array<{ data: Array<{ itemStyle?: { color?: string } }> }> };
    expect(option.series[0]?.data.every((item) => item.itemStyle?.color === "#18a66a")).toBe(true);
  });

  it("creates grouped show-data rows with a secondary measure", () => {
    const visual: VisualDefinition = { id: "combo", type: "combo", title: "Plan and actual", x: 0, y: 0, w: 6, h: 5, dimension: "Line", measure: "ActualQty", secondaryMeasure: "PlanQty", aggregation: "sum" };
    const data = visualData(visual, rows);
    expect(data.columns).toEqual(["Line", "ActualQty", "PlanQty"]);
    expect(data.rows).toHaveLength(3);
  });

  it("renders ordered multi-value wells and legend series", () => {
    const multiValue: VisualDefinition = { id: "multi", type: "column", title: "Plan, actual, and gap", x: 0, y: 0, w: 6, h: 5, dimension: "Line", categoryFields: ["Line", "Model"], measure: "ActualQty", secondaryMeasure: "PlanQty", valueFields: ["ActualQty", "PlanQty", "GapQty"], aggregation: "sum" };
    expect(visualHierarchy(multiValue)).toEqual(["Line", "Model"]);
    expect(visualData(multiValue, rows).columns).toEqual(["Line", "ActualQty", "PlanQty", "GapQty"]);
    expect((chartOption(multiValue, rows) as { series: unknown[] }).series).toHaveLength(3);
    const legend: VisualDefinition = { ...multiValue, valueFields: ["ActualQty"], secondaryMeasure: undefined, legendField: "Shift" };
    const option = chartOption(legend, rows) as { legend: { show: boolean }; series: Array<{ name: string }> };
    expect(option.legend.show).toBe(true);
    expect(option.series.map((series) => series.name)).toEqual(["Day", "Night"]);
  });

  it("adds authored tooltip fields with escaped values", () => {
    const visual: VisualDefinition = { id: "tooltip", type: "bar", title: "Actual by customer", x: 0, y: 0, w: 6, h: 5, dimension: "Customer", measure: "ActualQty", tooltipFields: ["PendingQty", "Model"] };
    const unsafeRows = rows.map((row) => row.Customer === "Customer Alpha" ? { ...row, Model: "<script>alert(1)</script>" } : row);
    const option = chartOption(visual, unsafeRows) as { tooltip: { formatter: (value: unknown) => string } };
    const html = option.tooltip.formatter([{ axisValueLabel: "Customer Alpha", seriesName: "ActualQty", value: 100 }]);
    expect(html).toContain("PendingQty");
    expect(html).toContain("Model");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
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

  it("keeps authored bookmark and button targets inside their report", () => {
    for (const report of seedReports) {
      const pageIds = new Set(report.pages.map((page) => page.id));
      const bookmarkIds = new Set(report.bookmarks?.map((bookmark) => bookmark.id));
      expect(report.bookmarks?.every((bookmark) => pageIds.has(bookmark.pageId))).toBe(true);
      for (const control of report.pages.flatMap((page) => page.controls ?? [])) {
        if (control.action?.type === "page") expect(pageIds.has(control.action.targetId ?? "")).toBe(true);
        if (control.action?.type === "bookmark") expect(bookmarkIds.has(control.action.targetId ?? "")).toBe(true);
      }
      for (const page of report.pages) {
        const visualIds = new Set(page.visuals.map((visual) => visual.id));
        expect(page.interactions?.every((interaction) => visualIds.has(interaction.sourceVisualId) && visualIds.has(interaction.targetVisualId))).toBe(true);
      }
    }
  });

  it("resolves filter, highlight, and none independently for each visual pair", () => {
    const page: ReportPage = {
      id: "page",
      name: "Overview",
      ordinal: 0,
      visuals: [
        { id: "source", type: "slicer", title: "Line", x: 0, y: 0, w: 2, h: 2, dimension: "Line" },
        { id: "filter", type: "kpi", title: "Filtered", x: 2, y: 0, w: 2, h: 2, measure: "ActualQty" },
        { id: "highlight", type: "kpi", title: "Highlighted", x: 4, y: 0, w: 2, h: 2, measure: "ActualQty" },
        { id: "none", type: "kpi", title: "Unchanged", x: 6, y: 0, w: 2, h: 2, measure: "ActualQty" },
      ],
      interactions: [
        { sourceVisualId: "source", targetVisualId: "filter", mode: "filter" },
        { sourceVisualId: "source", targetVisualId: "highlight", mode: "highlight" },
        { sourceVisualId: "source", targetVisualId: "none", mode: "none" },
      ],
    };
    const selection = [{ sourceVisualId: "source", field: "Line" as const, value: "Line A" }];
    expect(visualInteractionMode(page, "source", "filter")).toBe("filter");
    expect(resolveVisualInteractionRows(page, "filter", rows, selection).rows).toHaveLength(4);
    const highlighted = resolveVisualInteractionRows(page, "highlight", rows, selection);
    expect(highlighted.rows).toHaveLength(rows.length);
    expect(highlighted.highlightRows).toHaveLength(4);
    expect(resolveVisualInteractionRows(page, "none", rows, selection)).toMatchObject({ rows });
  });

  it("builds chart options for the expanded visual catalog", () => {
    const base: VisualDefinition = { id: "chart", type: "treemap", title: "Output", x: 0, y: 0, w: 6, h: 5, dimension: "Model", measure: "ActualQty", aggregation: "sum" };
    expect(chartOption(base, rows)).toMatchObject({ series: [{ type: "treemap" }] });
    expect(chartOption({ ...base, type: "gauge", dimension: undefined }, rows)).toMatchObject({ series: [{ type: "gauge" }] });
    expect(chartOption({ ...base, type: "scatter", secondaryMeasure: "PlanQty" }, rows)).toMatchObject({ series: [{ type: "scatter" }] });
    expect(chartOption({ ...base, type: "line" }, rows, rows.filter((row) => row.Line === "Line A"))).toMatchObject({ series: [{ type: "line" }, { name: "ActualQty highlighted", type: "line" }] });
  });

  it("resolves KPI targets from constants or another measure", () => {
    const constant: VisualDefinition = { id: "kpi", type: "kpi", title: "Achievement", x: 0, y: 0, w: 2, h: 2, measure: "AchievementRate", target: { mode: "constant", value: 1 } };
    const resolved = resolveKpiTarget(constant, rows, 1.024);
    expect(resolved).toMatchObject({ target: 1, achieved: true });
    expect(resolved?.variance).toBeCloseTo(0.024);
    expect(resolved?.variancePercent).toBeCloseTo(0.024);
    const measured: VisualDefinition = { ...constant, measure: "ActualQty", target: { mode: "measure", measure: "PlanQty", aggregation: "sum", direction: "higherIsBetter" } };
    const target = aggregateRows(rows, "PlanQty", "sum");
    expect(resolveKpiTarget(measured, rows, target - 10)).toMatchObject({ target, variance: -10, achieved: false });
    expect(resolveKpiTarget({ ...constant, target: { mode: "constant", value: 5, direction: "lowerIsBetter" } }, rows, 4)?.achieved).toBe(true);
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
