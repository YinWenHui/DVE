import type { EChartsOption } from "echarts";
import type { ConditionalFormattingRule, Dataset, ManufacturingRecord, ReportFilterDefinition, ReportPage, VisualDefinition, VisualInteractionMode } from "@/types";

export type ReportCanvasState = "ready" | "stale" | "empty-report" | "no-data" | "no-metadata-results" | "no-results" | "offline" | "error";

export interface VisualDrillSelection {
  field: keyof ManufacturingRecord;
  value: string;
}

export interface VisualInteractionSelection {
  sourceVisualId: string;
  field: keyof ManufacturingRecord;
  value: string;
}

export interface ResolvedVisualInteractionRows {
  rows: ManufacturingRecord[];
  highlightRows?: ManufacturingRecord[];
  filterSelections: VisualInteractionSelection[];
  highlightSelections: VisualInteractionSelection[];
}

export function visualInteractionMode(page: ReportPage, sourceVisualId: string, targetVisualId: string): VisualInteractionMode {
  if (sourceVisualId === targetVisualId) return "none";
  const configured = page.interactions?.find((interaction) => interaction.sourceVisualId === sourceVisualId && interaction.targetVisualId === targetVisualId);
  if (configured) return configured.mode;
  const source = page.visuals.find((visual) => visual.id === sourceVisualId);
  return source?.interaction?.crossFilter === false ? "none" : "filter";
}

function applyVisualSelections(rows: ManufacturingRecord[], selections: VisualInteractionSelection[]): ManufacturingRecord[] {
  if (!selections.length) return rows;
  return rows.filter((row) => selections.every((selection) => String(row[selection.field] ?? "").toLocaleLowerCase() === selection.value.toLocaleLowerCase()));
}

export function resolveVisualInteractionRows(page: ReportPage, targetVisualId: string, rows: ManufacturingRecord[], selections: VisualInteractionSelection[]): ResolvedVisualInteractionRows {
  const validSelections = selections.filter((selection) => page.visuals.some((visual) => visual.id === selection.sourceVisualId));
  const filterSelections = validSelections.filter((selection) => visualInteractionMode(page, selection.sourceVisualId, targetVisualId) === "filter");
  const highlightSelections = validSelections.filter((selection) => visualInteractionMode(page, selection.sourceVisualId, targetVisualId) === "highlight");
  const filteredRows = applyVisualSelections(rows, filterSelections);
  return {
    rows: filteredRows,
    highlightRows: highlightSelections.length ? applyVisualSelections(filteredRows, highlightSelections) : undefined,
    filterSelections,
    highlightSelections,
  };
}

export function visualHierarchy(visual: VisualDefinition): Array<keyof ManufacturingRecord> {
  const fields = [visual.dimension, ...(visual.hierarchy ?? [])].filter((field): field is keyof ManufacturingRecord => Boolean(field));
  return fields.filter((field, index) => fields.indexOf(field) === index);
}

export function applyVisualDrillPath(rows: ManufacturingRecord[], path: VisualDrillSelection[]): ManufacturingRecord[] {
  if (!path.length) return rows;
  return rows.filter((row) => path.every(({ field, value }) => String(row[field] ?? "").toLocaleLowerCase() === value.toLocaleLowerCase()));
}

export function drillthroughTargets(pages: ReportPage[], currentPageId: string, field: keyof ManufacturingRecord | undefined): ReportPage[] {
  if (!field) return [];
  return pages.filter((page) => page.id !== currentPageId && page.drillthrough?.fields.includes(field));
}

export function resolveReportCanvasState(input: {
  datasetStatus: Dataset["status"];
  totalRows: number;
  metadataRows: number;
  filteredRows: number;
  visualCount: number;
}): ReportCanvasState {
  if (input.datasetStatus === "offline" && input.totalRows === 0) return "offline";
  if (input.datasetStatus === "failed" && input.totalRows === 0) return "error";
  if (input.visualCount === 0) return "empty-report";
  if (input.totalRows === 0) return "no-data";
  if (input.metadataRows === 0) return "no-metadata-results";
  if (input.filteredRows === 0) return "no-results";
  if (["refreshing", "delayed", "stale", "failed"].includes(input.datasetStatus)) return "stale";
  return "ready";
}

export function aggregateRows(
  rows: ManufacturingRecord[],
  field: keyof ManufacturingRecord,
  aggregation: VisualDefinition["aggregation"] = "sum",
): number {
  const values = rows.map((row) => Number(row[field])).filter(Number.isFinite);
  if (aggregation === "count") return rows.length;
  if (aggregation === "distinctCount") return new Set(rows.map((row) => String(row[field]))).size;
  if (!values.length) return 0;
  if (aggregation === "average") return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (aggregation === "minimum") return Math.min(...values);
  if (aggregation === "maximum") return Math.max(...values);
  return values.reduce((sum, value) => sum + value, 0);
}

export interface ResolvedConditionalFormatting {
  dataColor?: string;
  backgroundColor?: string;
  textColor?: string;
  dataBar?: string;
}

export function matchesConditionalFormattingRule(value: number, rule: ConditionalFormattingRule): boolean {
  if (!Number.isFinite(value)) return false;
  if (rule.operator === "greaterThan") return value > rule.value;
  if (rule.operator === "greaterThanOrEqual") return value >= rule.value;
  if (rule.operator === "lessThan") return value < rule.value;
  if (rule.operator === "lessThanOrEqual") return value <= rule.value;
  if (rule.operator === "between") {
    const second = rule.secondValue ?? rule.value;
    return value >= Math.min(rule.value, second) && value <= Math.max(rule.value, second);
  }
  return value === rule.value;
}

export function resolveConditionalFormatting(visual: VisualDefinition, field: keyof ManufacturingRecord, rawValue: unknown): ResolvedConditionalFormatting {
  const value = Number(rawValue);
  const resolved: ResolvedConditionalFormatting = {};
  for (const rule of visual.conditionalFormatting?.rules ?? []) {
    if (rule.field !== field || resolved[rule.target] || !matchesConditionalFormattingRule(value, rule)) continue;
    resolved[rule.target] = rule.color;
  }
  return resolved;
}

function matchesClause(actual: ManufacturingRecord[keyof ManufacturingRecord], operator: ReportFilterDefinition["operator"], value: string | number | undefined): boolean {
  const actualText = String(actual ?? "").toLocaleLowerCase();
  const expectedText = String(value ?? "").toLocaleLowerCase();
  const actualNumber = Number(actual);
  const expectedNumber = Number(value);
  if (operator === "isBlank") return actual === null || actual === undefined || actualText.trim() === "";
  if (operator === "isNotBlank") return actual !== null && actual !== undefined && actualText.trim() !== "";
  if (operator === "notEquals") return actualText !== expectedText;
  if (operator === "contains") return actualText.includes(expectedText);
  if (operator === "notContains") return !actualText.includes(expectedText);
  if (operator === "startsWith") return actualText.startsWith(expectedText);
  if (operator === "endsWith") return actualText.endsWith(expectedText);
  if (operator === "greaterThan") return Number.isFinite(actualNumber) && Number.isFinite(expectedNumber) ? actualNumber > expectedNumber : actualText > expectedText;
  if (operator === "greaterThanOrEqual") return Number.isFinite(actualNumber) && Number.isFinite(expectedNumber) ? actualNumber >= expectedNumber : actualText >= expectedText;
  if (operator === "lessThan") return Number.isFinite(actualNumber) && Number.isFinite(expectedNumber) ? actualNumber < expectedNumber : actualText < expectedText;
  if (operator === "lessThanOrEqual") return Number.isFinite(actualNumber) && Number.isFinite(expectedNumber) ? actualNumber <= expectedNumber : actualText <= expectedText;
  return actualText === expectedText;
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addUtcRelative(date: Date, amount: number, unit: NonNullable<ReportFilterDefinition["relativeDate"]>["unit"]): Date {
  const next = new Date(date);
  if (unit === "days") next.setUTCDate(next.getUTCDate() + amount);
  else if (unit === "weeks") next.setUTCDate(next.getUTCDate() + amount * 7);
  else if (unit === "months") next.setUTCMonth(next.getUTCMonth() + amount);
  else next.setUTCFullYear(next.getUTCFullYear() + amount);
  return next;
}

function currentPeriod(date: Date, unit: NonNullable<ReportFilterDefinition["relativeDate"]>["unit"]): [Date, Date] {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  if (unit === "days") return [new Date(Date.UTC(year, month, day)), new Date(Date.UTC(year, month, day))];
  if (unit === "weeks") {
    const today = new Date(Date.UTC(year, month, day));
    const mondayOffset = (today.getUTCDay() + 6) % 7;
    const start = addUtcDays(today, -mondayOffset);
    return [start, addUtcDays(start, 6)];
  }
  if (unit === "months") return [new Date(Date.UTC(year, month, 1)), new Date(Date.UTC(year, month + 1, 0))];
  return [new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year, 11, 31))];
}

function matchesRelativeDate(actual: ManufacturingRecord[keyof ManufacturingRecord], filter: ReportFilterDefinition, now: Date): boolean {
  const definition = filter.relativeDate;
  if (!definition) return true;
  const value = new Date(`${String(actual).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(value.getTime())) return false;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let start: Date;
  let end: Date;
  if (definition.direction === "current") [start, end] = currentPeriod(today, definition.unit);
  else if (definition.direction === "last") {
    end = definition.includeToday === false ? addUtcDays(today, -1) : today;
    start = addUtcDays(addUtcRelative(end, -Math.max(1, definition.amount), definition.unit), 1);
  } else {
    start = definition.includeToday === false ? addUtcDays(today, 1) : today;
    end = addUtcDays(addUtcRelative(start, Math.max(1, definition.amount), definition.unit), -1);
  }
  return value >= start && value <= end;
}

function matchesFilter(row: ManufacturingRecord, filter: ReportFilterDefinition, now: Date): boolean {
  const actual = row[filter.field];
  if (filter.mode === "relativeDate") return matchesRelativeDate(actual, filter, now);
  if (filter.mode === "advanced" && filter.clauses?.length) {
    const matches = filter.clauses.map((clause) => matchesClause(actual, clause.operator, clause.value));
    return filter.logicalOperator === "or" ? matches.some(Boolean) : matches.every(Boolean);
  }
  return matchesClause(actual, filter.operator, filter.value);
}

function applyTopNFilter(rows: ManufacturingRecord[], filter: ReportFilterDefinition): ManufacturingRecord[] {
  const definition = filter.topN;
  if (!definition) return rows;
  const groups = new Map<string, ManufacturingRecord[]>();
  rows.forEach((row) => {
    const key = String(row[filter.field] ?? "");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });
  const ranked = [...groups.entries()].map(([key, groupRows]) => ({ key, value: aggregateRows(groupRows, definition.byMeasure, definition.aggregation ?? "sum") }));
  ranked.sort((left, right) => (definition.direction === "top" ? right.value - left.value : left.value - right.value) || left.key.localeCompare(right.key));
  const allowed = new Set(ranked.slice(0, Math.max(1, Math.min(1_000, Math.floor(definition.count)))).map((item) => item.key));
  return rows.filter((row) => allowed.has(String(row[filter.field] ?? "")));
}

export function applyReportFilters(rows: ManufacturingRecord[], filters: ReportFilterDefinition[] = [], now = new Date()): ManufacturingRecord[] {
  if (!filters.length) return rows;
  const regularFilters = filters.filter((filter) => filter.mode !== "topN");
  let result = rows.filter((row) => regularFilters.every((filter) => matchesFilter(row, filter, now)));
  filters.filter((filter) => filter.mode === "topN").forEach((filter) => { result = applyTopNFilter(result, filter); });
  return result;
}

function groupedValues(visual: VisualDefinition, rows: ManufacturingRecord[], measure = visual.measure) {
  if (!visual.dimension || !measure) return { categories: [] as string[], values: [] as number[] };
  const grouped = new Map<string, ManufacturingRecord[]>();
  rows.forEach((row) => {
    const key = String(row[visual.dimension as keyof ManufacturingRecord] ?? "Blank");
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  });
  const categories = [...grouped.keys()];
  categories.sort((left, right) => {
    if (!visual.sort) return left.localeCompare(right);
    const leftRows = grouped.get(left) ?? [];
    const rightRows = grouped.get(right) ?? [];
    const leftValue = visual.sort.field === visual.dimension ? left : aggregateRows(leftRows, visual.sort.field, visual.aggregation);
    const rightValue = visual.sort.field === visual.dimension ? right : aggregateRows(rightRows, visual.sort.field, visual.aggregation);
    const comparison = typeof leftValue === "number" && typeof rightValue === "number" ? leftValue - rightValue : String(leftValue).localeCompare(String(rightValue));
    return visual.sort.direction === "asc" ? comparison : -comparison;
  });
  return {
    categories,
    values: categories.map((category) => aggregateRows(grouped.get(category) ?? [], measure, visual.aggregation)),
  };
}

export function sortVisualRows(visual: VisualDefinition, rows: ManufacturingRecord[]): ManufacturingRecord[] {
  if (!visual.sort) return rows;
  const direction = visual.sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const leftValue = left[visual.sort!.field];
    const rightValue = right[visual.sort!.field];
    const leftNumber = Number(leftValue);
    const rightNumber = Number(rightValue);
    const comparison = Number.isFinite(leftNumber) && Number.isFinite(rightNumber) ? leftNumber - rightNumber : String(leftValue ?? "").localeCompare(String(rightValue ?? ""));
    return comparison * direction;
  });
}

export function visualData(visual: VisualDefinition, rows: ManufacturingRecord[]): { columns: string[]; rows: Array<Array<string | number>> } {
  const scopedRows = applyReportFilters(rows, visual.filters);
  if (!visual.dimension || !visual.measure) {
    if (!visual.measure) return { columns: ["Rows"], rows: [[scopedRows.length]] };
    return { columns: [visual.title], rows: [[aggregateRows(scopedRows, visual.measure, visual.aggregation)]] };
  }
  const primary = groupedValues(visual, scopedRows);
  const secondary = visual.secondaryMeasure ? groupedValues(visual, scopedRows, visual.secondaryMeasure).values : undefined;
  return {
    columns: [String(visual.dimension), String(visual.measure), ...(visual.secondaryMeasure ? [String(visual.secondaryMeasure)] : [])],
    rows: primary.categories.map((category, index) => [category, primary.values[index], ...(secondary ? [secondary[index]] : [])]),
  };
}

export function chartOption(visual: VisualDefinition, inputRows: ManufacturingRecord[], inputHighlightRows?: ManufacturingRecord[]): EChartsOption {
  const rows = applyReportFilters(inputRows, visual.filters);
  const highlightRows = inputHighlightRows ? applyReportFilters(inputHighlightRows, visual.filters) : undefined;
  const hasHighlight = highlightRows !== undefined;
  const accent = visual.conditionalFormatting?.defaultColor ?? visual.display?.accentColor ?? "#5c73e6";
  const palette = [accent, "#2bb7c8", "#75b798", "#e2a45d", "#a78bfa", "#ef7181"];
  const showLabels = visual.display?.showDataLabels ?? false;
  const showLegend = visual.display?.showLegend ?? ["doughnut", "treemap", "funnel", "combo", "stackedBar", "stackedColumn"].includes(visual.type);
  const tooltips = visual.interaction?.tooltips !== false;
  const dataColor = (field: keyof ManufacturingRecord, value: number) => resolveConditionalFormatting(visual, field, value).dataColor ?? accent;

  if (visual.type === "gauge" && visual.measure) {
    const rawValue = aggregateRows(highlightRows ?? rows, visual.measure, visual.aggregation);
    const percent = visual.format === "percent";
    const value = percent ? rawValue * 100 : rawValue;
    const maximum = percent ? 100 : Math.max(1, Math.ceil(value * 1.2));
    return {
      tooltip: { show: tooltips },
      color: palette,
      series: [{
        type: "gauge",
        min: 0,
        max: maximum,
        startAngle: 210,
        endAngle: -30,
        progress: { show: true, width: 14, itemStyle: { color: dataColor(visual.measure, rawValue) } },
        axisLine: { lineStyle: { width: 14 } },
        axisTick: { show: false },
        splitLine: { length: 8 },
        axisLabel: { distance: 20, fontSize: 9 },
        pointer: { width: 4, length: "56%" },
        detail: { valueAnimation: true, formatter: percent ? "{value}%" : "{value}", fontSize: 19, offsetCenter: [0, "62%"] },
        data: [{ value: Number(value.toFixed(percent ? 1 : 0)), name: hasHighlight ? `${visual.title} · highlighted` : visual.title, itemStyle: { color: dataColor(visual.measure, rawValue) } }],
      }],
    };
  }

  if (visual.type === "scatter" && visual.measure && visual.secondaryMeasure) {
    return {
      tooltip: { show: tooltips, trigger: "item" },
      color: palette,
      grid: { left: 52, right: 20, top: 18, bottom: 42 },
      xAxis: { type: "value", name: String(visual.measure), splitLine: { show: visual.display?.showGridlines !== false } },
      yAxis: { type: "value", name: String(visual.secondaryMeasure), splitLine: { show: visual.display?.showGridlines !== false } },
      series: [{
        type: "scatter",
        symbolSize: 10,
        itemStyle: hasHighlight ? { opacity: .2, color: "#94a3b8" } : undefined,
        data: rows.slice(0, 500).map((row) => ({
          name: visual.dimension ? String(row[visual.dimension]) : "Record",
          value: [Number(row[visual.measure as keyof ManufacturingRecord]), Number(row[visual.secondaryMeasure as keyof ManufacturingRecord])],
          itemStyle: { color: hasHighlight ? "#94a3b8" : dataColor(visual.measure!, Number(row[visual.measure!])), opacity: hasHighlight ? .2 : 1 },
        })),
      }, ...(highlightRows ? [{
        name: "Highlighted",
        type: "scatter" as const,
        symbolSize: 12,
        data: highlightRows.slice(0, 500).map((row) => ({
          name: visual.dimension ? String(row[visual.dimension]) : "Record",
          value: [Number(row[visual.measure as keyof ManufacturingRecord]), Number(row[visual.secondaryMeasure as keyof ManufacturingRecord])],
          itemStyle: { color: dataColor(visual.measure!, Number(row[visual.measure!])) },
        })),
      }] : [])],
    };
  }

  if (!visual.dimension || !visual.measure) return {};
  const primary = groupedValues(visual, rows);
  const secondary = visual.secondaryMeasure ? groupedValues(visual, rows, visual.secondaryMeasure).values : undefined;
  const highlighted = highlightRows ? groupedValues(visual, highlightRows) : undefined;
  const highlightedSecondary = highlightRows && visual.secondaryMeasure ? groupedValues(visual, highlightRows, visual.secondaryMeasure) : undefined;
  const alignHighlight = (grouped: ReturnType<typeof groupedValues> | undefined) => {
    const values = new Map(grouped?.categories.map((category, index) => [category, grouped.values[index]]) ?? []);
    return primary.categories.map((category) => values.get(category) ?? 0);
  };
  const highlightedValues = alignHighlight(highlighted);
  const highlightedSecondaryValues = alignHighlight(highlightedSecondary);
  const label = { show: showLabels, position: "top" as const, fontSize: 9 };

  if (visual.type === "doughnut") return {
    tooltip: { show: tooltips, trigger: "item" },
    legend: { show: showLegend, bottom: 0, type: "scroll" },
    color: palette,
    series: [{ type: "pie", radius: ["45%", "72%"], center: ["50%", "44%"], data: primary.categories.map((name, index) => ({ name, value: primary.values[index], itemStyle: { opacity: hasHighlight ? .2 : 1, color: hasHighlight ? "#94a3b8" : dataColor(visual.measure!, primary.values[index]) } })), label: { show: showLabels } }, ...(highlightRows ? [{ type: "pie" as const, radius: ["45%", "72%"], center: ["50%", "44%"], silent: true, data: primary.categories.map((name, index) => ({ name, value: highlightedValues[index], itemStyle: { color: dataColor(visual.measure!, highlightedValues[index]) } })).filter((item) => item.value !== 0), label: { show: false } }] : [])],
  };

  if (visual.type === "treemap") return {
    tooltip: { show: tooltips, trigger: "item" },
    color: palette,
    series: [{ type: "treemap", roam: false, breadcrumb: { show: false }, label: { show: true, formatter: "{b}" }, data: primary.categories.map((name, index) => ({ name, value: primary.values[index], itemStyle: { color: dataColor(visual.measure!, primary.values[index]), opacity: hasHighlight ? highlightedValues[index] ? 1 : .2 : 1 } })) }],
  };

  if (visual.type === "funnel") return {
    tooltip: { show: tooltips, trigger: "item" },
    legend: { show: showLegend, bottom: 0, type: "scroll" },
    color: palette,
    series: [{ type: "funnel", left: "12%", top: 10, bottom: 32, width: "76%", minSize: "8%", maxSize: "100%", sort: "descending", gap: 2, label: { show: showLabels, position: "inside" }, data: primary.categories.map((name, index) => ({ name, value: primary.values[index], itemStyle: { color: dataColor(visual.measure!, primary.values[index]), opacity: hasHighlight ? highlightedValues[index] ? 1 : .2 : 1 } })) }],
  };

  const horizontal = visual.type === "bar" || visual.type === "stackedBar";
  const categoryAxis = { type: "category" as const, data: primary.categories, axisLabel: { hideOverlap: true }, ...(horizontal ? { inverse: true } : {}) };
  const valueAxis = { type: "value" as const, splitLine: { show: visual.display?.showGridlines !== false } };
  const common = {
    tooltip: { show: tooltips, trigger: "axis" as const },
    legend: { show: showLegend, bottom: 0 },
    grid: { left: horizontal ? 70 : 48, right: 20, top: 20, bottom: showLegend ? 48 : 38, containLabel: false },
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    color: palette,
  };

  if (visual.type === "line" || visual.type === "area") return {
    ...common,
    series: [{ name: String(visual.measure), type: "line", smooth: true, data: primary.values.map((value) => ({ value, itemStyle: { color: hasHighlight ? "#94a3b8" : dataColor(visual.measure!, value), opacity: hasHighlight ? .2 : 1 } })), symbolSize: 5, label, lineStyle: hasHighlight ? { opacity: .2, color: "#94a3b8" } : undefined, areaStyle: visual.type === "area" ? { opacity: hasHighlight ? .06 : .18 } : undefined }, ...(highlightRows ? [{ name: "Highlighted", type: "line" as const, smooth: true, data: highlightedValues.map((value) => ({ value, itemStyle: { color: dataColor(visual.measure!, value) } })), symbolSize: 6, label, areaStyle: visual.type === "area" ? { opacity: .2 } : undefined }] : [])],
  };

  if (visual.type === "combo") return {
    ...common,
    yAxis: [{ ...valueAxis }, { ...valueAxis, splitLine: { show: false } }],
    series: [
      { name: String(visual.measure), type: "bar", data: primary.values.map((value) => ({ value, itemStyle: { color: hasHighlight ? "#94a3b8" : dataColor(visual.measure!, value), opacity: hasHighlight ? .2 : 1 } })), barMaxWidth: 42, label },
      { name: String(visual.secondaryMeasure ?? visual.measure), type: "line", yAxisIndex: 1, smooth: true, data: (secondary ?? primary.values).map((value) => ({ value, itemStyle: { color: hasHighlight ? "#94a3b8" : dataColor(visual.secondaryMeasure ?? visual.measure!, value), opacity: hasHighlight ? .2 : 1 } })), label, lineStyle: hasHighlight ? { opacity: .2, color: "#94a3b8" } : undefined },
      ...(highlightRows ? [{ name: "Highlighted", type: "bar" as const, data: highlightedValues.map((value) => ({ value, itemStyle: { color: dataColor(visual.measure!, value) } })), barMaxWidth: 42, barGap: "-100%", label }, { name: "Highlighted secondary", type: "line" as const, yAxisIndex: 1, smooth: true, data: highlightedSecondaryValues.map((value) => ({ value, itemStyle: { color: dataColor(visual.secondaryMeasure ?? visual.measure!, value) } })), label }] : []),
    ],
  };

  if (visual.type === "waterfall") return {
    ...common,
    series: [{
      name: String(visual.measure),
      type: "bar",
      data: primary.values.map((value, index) => ({ value, itemStyle: { color: resolveConditionalFormatting(visual, visual.measure!, value).dataColor ?? (value < 0 ? "#ef7181" : accent), opacity: hasHighlight ? highlightedValues[index] ? 1 : .2 : 1 } })),
      barMaxWidth: 42,
      label,
    }],
  };

  const stacked = visual.type === "stackedBar" || visual.type === "stackedColumn";
  return {
    ...common,
    series: [
      { name: String(visual.measure), type: "bar", stack: stacked ? "total" : undefined, data: primary.values.map((value) => ({ value, itemStyle: { borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0], opacity: hasHighlight ? .2 : 1, color: hasHighlight ? "#94a3b8" : dataColor(visual.measure!, value) } })), barMaxWidth: 44, label },
      ...(stacked && secondary ? [{ name: String(visual.secondaryMeasure), type: "bar" as const, stack: "total", data: secondary.map((value) => ({ value, itemStyle: { color: hasHighlight ? "#cbd5e1" : dataColor(visual.secondaryMeasure!, value), opacity: hasHighlight ? .2 : 1 } })), barMaxWidth: 44, label }] : []),
      ...(highlightRows ? [{ name: "Highlighted", type: "bar" as const, data: highlightedValues.map((value) => ({ value, itemStyle: { color: dataColor(visual.measure!, value), borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] } })), barMaxWidth: 44, barGap: "-100%", label }] : []),
    ],
  };
}
