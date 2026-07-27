import { describe, expect, it } from "vitest";
import { queryFilterSchema, queryRequestSchema } from "@/lib/query-engine/schema";

describe("query validation", () => {
  it("accepts supported aggregation and structured filter", () => {
    expect(queryRequestSchema.safeParse({ datasetId: "d1", dimensions: ["Line"], measures: [{ field: "ActualQty", aggregation: "sum" }], filters: [{ field: "Line", operator: "in", value: ["Line A"] }], sort: [], limit: 100 }).success).toBe(true);
  });
  it("rejects unsupported aggregation", () => {
    expect(queryRequestSchema.safeParse({ datasetId: "d1", measures: [{ field: "ActualQty", aggregation: "median" }] }).success).toBe(false);
  });
  it("enforces filter value shape", () => {
    expect(queryFilterSchema.safeParse({ field: "RecordDate", operator: "between", value: ["2026-01-01"] }).success).toBe(false);
    expect(queryFilterSchema.safeParse({ field: "Line", operator: "execute", value: "DROP TABLE" }).success).toBe(false);
  });
});
