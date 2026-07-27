import { z } from "zod";

export const filterOperators = [
  "equals",
  "notEquals",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual",
  "in",
  "contains",
  "startsWith",
  "between",
  "isNull",
  "isNotNull",
] as const;

export const queryAggregations = ["sum", "average", "minimum", "maximum", "count", "distinctCount"] as const;
const primitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const queryFilterSchema = z.object({
  field: z.string().min(1).max(128),
  operator: z.enum(filterOperators),
  value: z.union([primitive, z.array(primitive).max(500)]).optional(),
}).superRefine((filter, context) => {
  if ((filter.operator === "isNull" || filter.operator === "isNotNull") && filter.value !== undefined) context.addIssue({ code: "custom", message: "Null operators do not accept a value.", path: ["value"] });
  if (filter.operator === "between" && (!Array.isArray(filter.value) || filter.value.length !== 2)) context.addIssue({ code: "custom", message: "Between requires exactly two values.", path: ["value"] });
  if (filter.operator === "in" && (!Array.isArray(filter.value) || filter.value.length === 0)) context.addIssue({ code: "custom", message: "In requires a non-empty value array.", path: ["value"] });
  if (!["isNull", "isNotNull", "between", "in"].includes(filter.operator) && (filter.value === undefined || Array.isArray(filter.value))) context.addIssue({ code: "custom", message: "This operator requires one scalar value.", path: ["value"] });
});

export const queryRequestSchema = z.object({
  datasetId: z.string().min(1).max(128),
  dimensions: z.array(z.string().min(1).max(128)).max(5).default([]),
  measures: z.array(z.object({ field: z.string().min(1).max(128), aggregation: z.enum(queryAggregations), alias: z.string().max(128).optional() })).max(12).default([]),
  filters: z.array(queryFilterSchema).max(30).default([]),
  sort: z.array(z.object({ field: z.string().min(1).max(128), direction: z.enum(["asc", "desc"]) })).max(5).default([]),
  limit: z.number().int().min(1).max(50_000).default(5_000),
});

export type QueryFilter = z.infer<typeof queryFilterSchema>;
export type QueryRequest = z.infer<typeof queryRequestSchema>;
