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
  const authored = visual.categoryFields?.length ? visual.categoryFields : [visual.dimension, ...(visual.hierarchy ?? [])];
  const fields = authored.filter((field): field is keyof ManufacturingRecord => Boolean(field));
  return fields.filter((field, index) => fields.indexOf(field) === index);
}

export function visualValueFields(visual: VisualDefinition): Array<keyof ManufacturingRecord> {
  const fields = visual.valueFields?.length ? visual.valueFields : [visual.measure, visual.secondaryMeasure];
  return fields.filter((field): field is keyof ManufacturingRecord => Boolean(field)).filter((field, index, values) => values.indexOf(field) === index);
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

export interface ResolvedKpiTarget {
  target: number;
  variance: number;
  variancePercent?: number;
  achieved: boolean;
}

export function resolveKpiTarget(visual: VisualDefinition, rows: ManufacturingRecord[], value: number): ResolvedKpiTarget | undefined {
  if (!visual.target) return undefined;
  const target = visual.target.mode === "measure" && visual.target.measure
    ? aggregateRows(rows, visual.target.measure, visual.target.aggregation ?? visual.aggregation)
    : Number(visual.target.value);
  if (!Number.isFinite(target)) return undefined;
  const variance = value - target;
  return {
    target,
    variance,
    variancePercent: target === 0 ? undefined : variance / Math.abs(target),
    achieved: visual.target.direction === "lowerIsBetter" ? value <= target : value >= target,
  };
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

function groupedLegendSeries(visual: VisualDefinition, rows: ManufacturingRecord[], measure: keyof ManufacturingRecord, categories: string[]) {
  if (!visual.dimension || !visual.legendField) return [];
  const groups = new Map<string, Map<string, ManufacturingRecord[]>>();
  rows.forEach((row) => {
    const legend = String(row[visual.legendField!] ?? "Blank");
    const category = String(row[visual.dimension!] ?? "Blank");
    const categoryMap = groups.get(legend) ?? new Map<string, ManufacturingRecord[]>();
    categoryMap.set(category, [...(categoryMap.get(category) ?? []), row]);
    groups.set(legend, categoryMap);
  });
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([name, categoryMap]) => ({
    name,
    values: categories.map((category) => { const categoryRows = categoryMap.get(category); return categoryRows?.length ? aggregateRows(categoryRows, measure, visual.aggregation) : null; }),
  }));
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
  const valueFields = visualValueFields(visual);
  const primaryMeasure = valueFields[0];
  if (!visual.dimension || !primaryMeasure) {
    if (!primaryMeasure) return { columns: ["Rows"], rows: [[scopedRows.length]] };
    return { columns: [visual.title], rows: [[aggregateRows(scopedRows, primaryMeasure, visual.aggregation)]] };
  }
  const groups = valueFields.map((field) => groupedValues(visual, scopedRows, field));
  const primary = groups[0]!;
  return {
    columns: [String(visual.dimension), ...valueFields.map(String)],
    rows: primary.categories.map((category, index) => [category, ...groups.map((group) => group.values[index] ?? 0)]),
  };
}

export function chartOption(visual: VisualDefinition, inputRows: ManufacturingRecord[], inputHighlightRows?: ManufacturingRecord[]): EChartsOption {
  const rows = applyReportFilters(inputRows, visual.filters);
  const highlightRows = inputHighlightRows ? applyReportFilters(inputHighlightRows, visual.filters) : undefined;
  const hasHighlight = highlightRows !== undefined;
  const accent = visual.conditionalFormatting?.defaultColor ?? visual.display?.accentColor ?? "#5c73e6";
  const palette = [accent, "#2bb7c8", "#75b798", "#e2a45d", "#a78bfa", "#ef7181"];
  const showLabels = visual.display?.showDataLabels ?? false;
  const tooltips = visual.interaction?.tooltips !== false;
  const valueFields = visualValueFields(visual);
  const primaryMeasure = valueFields[0];
  const secondaryMeasure = valueFields[1];
  const showLegend = visual.display?.showLegend ?? Boolean(visual.legendField || valueFields.length > 1 || ["doughnut", "treemap", "funnel", "combo", "stackedBar", "stackedColumn"].includes(visual.type));
  const dataColor = (field: keyof ManufacturingRecord, value: number) => resolveConditionalFormatting(visual, field, value).dataColor ?? accent;

  if (visual.type === "gauge" && primaryMeasure) {
    const rawValue = aggregateRows(highlightRows ?? rows, primaryMeasure, visual.aggregation);
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
        progress: { show: true, width: 14, itemStyle: { color: dataColor(primaryMeasure, rawValue) } },
        axisLine: { lineStyle: { width: 14 } },
        axisTick: { show: false },
        splitLine: { length: 8 },
        axisLabel: { distance: 20, fontSize: 9 },
        pointer: { width: 4, length: "56%" },
        detail: { valueAnimation: true, formatter: percent ? "{value}%" : "{value}", fontSize: 19, offsetCenter: [0, "62%"] },
        data: [{ value: Number(value.toFixed(percent ? 1 : 0)), name: hasHighlight ? `${visual.title} · highlighted` : visual.title, itemStyle: { color: dataColor(primaryMeasure, rawValue) } }],
      }],
    };
  }

  if (visual.type === "scatter" && primaryMeasure && secondaryMeasure) {
    return {
      tooltip: { show: tooltips, trigger: "item" },
      color: palette,
      grid: { left: 52, right: 20, top: 18, bottom: 42 },
      xAxis: { type: "value", name: String(primaryMeasure), splitLine: { show: visual.display?.showGridlines !== false } },
      yAxis: { type: "value", name: String(secondaryMeasure), splitLine: { show: visual.display?.showGridlines !== false } },
      series: [{
        type: "scatter",
        symbolSize: 10,
        itemStyle: hasHighlight ? { opacity: .2, color: "#94a3b8" } : undefined,
        data: rows.slice(0, 500).map((row) => ({
          name: visual.dimension ? String(row[visual.dimension]) : "Record",
          value: [Number(row[primaryMeasure]), Number(row[secondaryMeasure])],
          itemStyle: { color: hasHighlight ? "#94a3b8" : dataColor(primaryMeasure, Number(row[primaryMeasure])), opacity: hasHighlight ? .2 : 1 },
        })),
      }, ...(highlightRows ? [{
        name: "Highlighted",
        type: "scatter" as const,
        symbolSize: 12,
        data: highlightRows.slice(0, 500).map((row) => ({
          name: visual.dimension ? String(row[visual.dimension]) : "Record",
          value: [Number(row[primaryMeasure]), Number(row[secondaryMeasure])],
          itemStyle: { color: dataColor(primaryMeasure, Number(row[primaryMeasure])) },
        })),
      }] : [])],
    };
  }

  if (!visual.dimension || !primaryMeasure) return {};
  const groupedByField = valueFields.map((field) => ({ field, grouped: groupedValues(visual, rows, field) }));
  const primary = groupedByField[0]!.grouped;
  const highlightedByField = highlightRows ? valueFields.map((field) => ({ field, grouped: groupedValues(visual, highlightRows, field) })) : [];
  const highlighted = highlightedByField[0]?.grouped;
  const alignHighlight = (grouped: ReturnType<typeof groupedValues> | undefined) => {
    const values = new Map(grouped?.categories.map((category, index) => [category, grouped.values[index]]) ?? []);
    return primary.categories.map((category) => values.get(category) ?? 0);
  };
  const highlightedValues = alignHighlight(highlighted);
  const authoredSeries = visual.legendField
    ? groupedLegendSeries(visual, rows, primaryMeasure, primary.categories).map((series) => ({ ...series, field: primaryMeasure }))
    : groupedByField.map(({ field, grouped }) => ({ name: String(field), field, values: grouped.values }));
  const highlightedAuthoredSeries = highlightRows
    ? visual.legendField
      ? groupedLegendSeries(visual, highlightRows, primaryMeasure, primary.categories).map((series) => ({ ...series, field: primaryMeasure }))
      : highlightedByField.map(({ field, grouped }) => ({ name: String(field), field, values: alignHighlight(grouped) }))
    : [];
  const escapeTooltip = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const tooltipDetails = (category: string) => (visual.tooltipFields ?? []).map((field) => {
    const categoryRows = rows.filter((row) => String(row[visual.dimension!] ?? "Blank") === category);
    const rawValues = categoryRows.map((row) => row[field]);
    const numericValues = rawValues.map(Number).filter(Number.isFinite);
    const isRate = String(field).endsWith("Rate");
    const aggregate = numericValues.length === rawValues.length && rawValues.length ? aggregateRows(categoryRows, field, isRate ? "average" : visual.aggregation) : undefined;
    const value = aggregate === undefined ? [...new Set(rawValues.map(String))].slice(0, 4).join(", ") : isRate ? `${(aggregate * 100).toFixed(1)}%` : aggregate.toLocaleString();
    return `<span class="tooltip-field">${escapeTooltip(field)}: <b>${escapeTooltip(value)}</b></span>`;
  });
  const tooltipFormatter = (input: unknown) => {
    const params = (Array.isArray(input) ? input : [input]) as Array<{ axisValueLabel?: string; name?: string; seriesName?: string; value?: unknown }>;
    const category = params[0]?.axisValueLabel ?? params[0]?.name ?? "";
    const seriesLines = params.filter((param) => param.seriesName).map((param) => `${escapeTooltip(param.seriesName)}: <b>${escapeTooltip(Array.isArray(param.value) ? param.value.join(", ") : param.value)}</b>`);
    return [`<strong>${escapeTooltip(category)}</strong>`, ...seriesLines, ...tooltipDetails(category)].join("<br/>");
  };
  const axisTooltip = { show: tooltips, trigger: "axis" as const, formatter: tooltipFormatter };
  const itemTooltip = { show: tooltips, trigger: "item" as const, formatter: tooltipFormatter };
  const label = { show: showLabels, position: "top" as const, fontSize: 9 };

  if (visual.type === "doughnut") return {
    tooltip: itemTooltip,
    legend: { show: showLegend, bottom: 0, type: "scroll" },
    color: palette,
    series: [{ type: "pie", radius: ["45%", "72%"], center: ["50%", "44%"], data: primary.categories.map((name, index) => ({ name, value: primary.values[index], itemStyle: { opacity: hasHighlight ? .2 : 1, color: hasHighlight ? "#94a3b8" : dataColor(primaryMeasure, primary.values[index]) } })), label: { show: showLabels } }, ...(highlightRows ? [{ type: "pie" as const, radius: ["45%", "72%"], center: ["50%", "44%"], silent: true, data: primary.categories.map((name, index) => ({ name, value: highlightedValues[index], itemStyle: { color: dataColor(primaryMeasure, highlightedValues[index]) } })).filter((item) => item.value !== 0), label: { show: false } }] : [])],
  };

  if (visual.type === "treemap") return {
    tooltip: itemTooltip,
    color: palette,
    series: [{ type: "treemap", roam: false, breadcrumb: { show: false }, label: { show: true, formatter: "{b}" }, data: primary.categories.map((name, index) => ({ name, value: primary.values[index], itemStyle: { color: dataColor(primaryMeasure, primary.values[index]), opacity: hasHighlight ? highlightedValues[index] ? 1 : .2 : 1 } })) }],
  };

  if (visual.type === "funnel") return {
    tooltip: itemTooltip,
    legend: { show: showLegend, bottom: 0, type: "scroll" },
    color: palette,
    series: [{ type: "funnel", left: "12%", top: 10, bottom: 32, width: "76%", minSize: "8%", maxSize: "100%", sort: "descending", gap: 2, label: { show: showLabels, position: "inside" }, data: primary.categories.map((name, index) => ({ name, value: primary.values[index], itemStyle: { color: dataColor(primaryMeasure, primary.values[index]), opacity: hasHighlight ? highlightedValues[index] ? 1 : .2 : 1 } })) }],
  };

  const horizontal = visual.type === "bar" || visual.type === "stackedBar";
  const categoryAxis = { type: "category" as const, data: primary.categories, axisLabel: { hideOverlap: true }, ...(horizontal ? { inverse: true } : {}) };
  const valueAxis = { type: "value" as const, splitLine: { show: visual.display?.showGridlines !== false } };
  const common = {
    tooltip: axisTooltip,
    legend: { show: showLegend, bottom: 0 },
    grid: { left: horizontal ? 70 : 48, right: 20, top: 20, bottom: showLegend ? 48 : 38, containLabel: false },
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    color: palette,
  };

  if (visual.type === "line" || visual.type === "area") return {
    ...common,
    series: [
      ...authoredSeries.map((series, seriesIndex) => ({ name: series.name, type: "line" as const, smooth: true, data: series.values.map((value) => ({ value, itemStyle: { color: hasHighlight ? "#94a3b8" : resolveConditionalFormatting(visual, series.field, value).dataColor ?? palette[seriesIndex % palette.length], opacity: hasHighlight ? .2 : 1 } })), symbolSize: 5, label, lineStyle: hasHighlight ? { opacity: .2, color: "#94a3b8" } : { color: palette[seriesIndex % palette.length] }, areaStyle: visual.type === "area" ? { opacity: hasHighlight ? .06 : .14 } : undefined })),
      ...highlightedAuthoredSeries.map((series, seriesIndex) => ({ name: `${series.name} highlighted`, type: "line" as const, smooth: true, data: series.values.map((value) => ({ value, itemStyle: { color: resolveConditionalFormatting(visual, series.field, value).dataColor ?? palette[seriesIndex % palette.length] } })), symbolSize: 6, label, areaStyle: visual.type === "area" ? { opacity: .2 } : undefined })),
    ],
  };

  if (visual.type === "combo") return {
    ...common,
    yAxis: [{ ...valueAxis }, { ...valueAxis, splitLine: { show: false } }],
    series: [
      ...authoredSeries.map((series, seriesIndex) => ({ name: series.name, type: seriesIndex === 0 ? "bar" as const : "line" as const, yAxisIndex: seriesIndex === 0 ? 0 : 1, smooth: seriesIndex > 0, data: series.values.map((value) => ({ value, itemStyle: { color: hasHighlight ? "#94a3b8" : resolveConditionalFormatting(visual, series.field, value).dataColor ?? palette[seriesIndex % palette.length], opacity: hasHighlight ? .2 : 1 } })), barMaxWidth: seriesIndex === 0 ? 42 : undefined, label, lineStyle: seriesIndex > 0 && hasHighlight ? { opacity: .2, color: "#94a3b8" } : undefined })),
      ...highlightedAuthoredSeries.map((series, seriesIndex) => ({ name: `${series.name} highlighted`, type: seriesIndex === 0 ? "bar" as const : "line" as const, yAxisIndex: seriesIndex === 0 ? 0 : 1, smooth: seriesIndex > 0, data: series.values.map((value) => ({ value, itemStyle: { color: resolveConditionalFormatting(visual, series.field, value).dataColor ?? palette[seriesIndex % palette.length] } })), barMaxWidth: seriesIndex === 0 ? 42 : undefined, barGap: seriesIndex === 0 ? "-100%" : undefined, label })),
    ],
  };

  if (visual.type === "waterfall") return {
    ...common,
    series: [{
      name: String(primaryMeasure),
      type: "bar",
      data: primary.values.map((value, index) => ({ value, itemStyle: { color: resolveConditionalFormatting(visual, primaryMeasure, value).dataColor ?? (value < 0 ? "#ef7181" : accent), opacity: hasHighlight ? highlightedValues[index] ? 1 : .2 : 1 } })),
      barMaxWidth: 42,
      label,
    }],
  };

  const stacked = visual.type === "stackedBar" || visual.type === "stackedColumn";
  return {
    ...common,
    series: [
      ...authoredSeries.map((series, seriesIndex) => ({ name: series.name, type: "bar" as const, stack: stacked ? "total" : undefined, data: series.values.map((value) => ({ value, itemStyle: { borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0], opacity: hasHighlight ? .2 : 1, color: hasHighlight ? "#94a3b8" : resolveConditionalFormatting(visual, series.field, value).dataColor ?? palette[seriesIndex % palette.length] } })), barMaxWidth: 44, label })),
      ...highlightedAuthoredSeries.map((series, seriesIndex) => ({ name: `${series.name} highlighted`, type: "bar" as const, data: series.values.map((value) => ({ value, itemStyle: { color: resolveConditionalFormatting(visual, series.field, value).dataColor ?? palette[seriesIndex % palette.length], borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] } })), barMaxWidth: 44, barGap: "-100%", label })),
    ],
  };
}
