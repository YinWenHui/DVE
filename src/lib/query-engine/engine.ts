import type { Dataset } from "@/types";
import type { QueryFilter, QueryRequest } from "./schema";

export type QueryValue = string | number | boolean | null;
export type QueryRow = Record<string, QueryValue>;

const comparable = (value: unknown): string | number => {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  return String(value ?? "");
};

function matchesFilter(row: Record<string, unknown>, filter: QueryFilter): boolean {
  const actual = row[filter.field];
  const values = Array.isArray(filter.value) ? filter.value : [filter.value];
  const expected = values[0];
  switch (filter.operator) {
    case "equals": return actual === expected || String(actual ?? "") === String(expected ?? "");
    case "notEquals": return !(actual === expected || String(actual ?? "") === String(expected ?? ""));
    case "greaterThan": return comparable(actual) > comparable(expected);
    case "greaterThanOrEqual": return comparable(actual) >= comparable(expected);
    case "lessThan": return comparable(actual) < comparable(expected);
    case "lessThanOrEqual": return comparable(actual) <= comparable(expected);
    case "in": return values.some((value) => String(value ?? "") === String(actual ?? ""));
    case "contains": return String(actual ?? "").toLocaleLowerCase().includes(String(expected ?? "").toLocaleLowerCase());
    case "startsWith": return String(actual ?? "").toLocaleLowerCase().startsWith(String(expected ?? "").toLocaleLowerCase());
    case "between": return comparable(actual) >= comparable(values[0]) && comparable(actual) <= comparable(values[1]);
    case "isNull": return actual === null || actual === undefined;
    case "isNotNull": return actual !== null && actual !== undefined;
  }
}

function aggregate(rows: Record<string, unknown>[], field: string, operation: QueryRequest["measures"][number]["aggregation"]): number {
  const present = rows.map((row) => row[field]).filter((value) => value !== null && value !== undefined);
  if (operation === "count") return present.length;
  if (operation === "distinctCount") return new Set(present.map(String)).size;
  const numeric = present.map(Number).filter(Number.isFinite);
  if (numeric.length === 0) return 0;
  if (operation === "sum") return numeric.reduce((sum, value) => sum + value, 0);
  if (operation === "average") return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
  if (operation === "minimum") return Math.min(...numeric);
  return Math.max(...numeric);
}

function validateRegisteredFields(dataset: Dataset, request: QueryRequest): void {
  const fields = new Map(dataset.fields.map((field) => [field.key, field]));
  const requested = [
    ...request.dimensions,
    ...request.measures.map((measure) => measure.field),
    ...request.filters.map((filter) => filter.field),
    ...request.sort.map((sort) => sort.field),
  ];
  for (const field of requested) {
    if (!fields.has(field)) throw new Error(`Field '${field}' is not registered for this dataset.`);
  }
  for (const filter of request.filters) {
    if (!fields.get(filter.field)?.filterable) throw new Error(`Field '${filter.field}' is not filterable.`);
  }
}

export function executeInMemoryQuery(dataset: Dataset, sourceRows: Record<string, unknown>[], request: QueryRequest): QueryRow[] {
  validateRegisteredFields(dataset, request);
  const filtered = sourceRows.filter((row) => request.filters.every((filter) => matchesFilter(row, filter)));
  let result: QueryRow[];
  if (request.measures.length === 0) {
    const visible = dataset.fields.filter((field) => !field.hidden).map((field) => field.key);
    result = filtered.map((row) => Object.fromEntries(visible.map((key) => [key, normalizeValue(row[key])]))) as QueryRow[];
  } else {
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const row of filtered) {
      const key = JSON.stringify(request.dimensions.map((dimension) => row[dimension]));
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    if (groups.size === 0 && request.dimensions.length === 0) groups.set("[]", []);
    result = [...groups.values()].map((rows) => {
      const output: QueryRow = {};
      request.dimensions.forEach((dimension) => { output[dimension] = normalizeValue(rows[0]?.[dimension]); });
      request.measures.forEach((measure) => { output[measure.alias ?? `${measure.aggregation}_${measure.field}`] = aggregate(rows, measure.field, measure.aggregation); });
      return output;
    });
  }
  for (const sort of [...request.sort].reverse()) {
    result.sort((left, right) => {
      const comparison = comparable(left[sort.field]) < comparable(right[sort.field]) ? -1 : comparable(left[sort.field]) > comparable(right[sort.field]) ? 1 : 0;
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }
  return result.slice(0, request.limit);
}

function normalizeValue(value: unknown): QueryValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
