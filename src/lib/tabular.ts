import type { ManufacturingRecord, TabularColumnDefinition, VisualDefinition } from "@/types";

export const defaultTableColumns: TabularColumnDefinition[] = [
  { field: "RecordDate", label: "Date", format: "date", width: 105 },
  { field: "Line", label: "Line", format: "text", width: 80 },
  { field: "Shift", label: "Shift", format: "text", width: 75 },
  { field: "Model", label: "Model", format: "text", width: 105 },
  { field: "Customer", label: "Customer", format: "text", width: 125 },
  { field: "PlanQty", label: "Plan", format: "number", alignment: "right", width: 90 },
  { field: "ActualQty", label: "Actual", format: "number", alignment: "right", width: 90 },
  { field: "GapQty", label: "Gap", format: "number", alignment: "right", width: 80 },
  { field: "YieldRate", label: "Yield", format: "percent", decimalPlaces: 1, alignment: "right", width: 85 },
  { field: "PendingQty", label: "Pending", format: "number", alignment: "right", width: 90 },
];

export const defaultMatrixColumns: TabularColumnDefinition[] = [
  { field: "PlanQty", label: "Plan", format: "number", aggregation: "sum", alignment: "right", width: 95 },
  { field: "ActualQty", label: "Actual", format: "number", aggregation: "sum", alignment: "right", width: 95 },
  { field: "AchievementRate", label: "Achievement", format: "percent", decimalPlaces: 1, aggregation: "average", alignment: "right", width: 105 },
  { field: "PendingQty", label: "Pending", format: "number", aggregation: "sum", alignment: "right", width: 95 },
];

export function resolvedTabularColumns(visual: VisualDefinition): TabularColumnDefinition[] {
  const configured = visual.tabular?.columns;
  if (configured?.length) return configured;
  return visual.type === "matrix" ? defaultMatrixColumns : defaultTableColumns;
}

export function resolvedMatrixRows(visual: VisualDefinition): Array<keyof ManufacturingRecord> {
  return visual.tabular?.matrixRows?.length ? visual.tabular.matrixRows : ["Line", "Model"];
}

export function formatTabularValue(value: unknown, column: TabularColumnDefinition): string {
  if (value === null || value === undefined || value === "") return "—";
  const format = column.format ?? "auto";
  if (format === "text" || format === "date") return String(value);
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  const decimals = Math.max(0, Math.min(6, column.decimalPlaces ?? (format === "percent" ? 1 : 0)));
  if (format === "percent") return `${(numeric * 100).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
  if (format === "number") return numeric.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  if (["AchievementRate", "YieldRate"].includes(String(column.field))) return `${(numeric * 100).toFixed(decimals || 1)}%`;
  return numeric.toLocaleString("en-US", { maximumFractionDigits: decimals });
}
