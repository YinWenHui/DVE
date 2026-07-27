import { describe, expect, it } from "vitest";
import { seedDataset, syntheticRecords } from "@/data/seed";
import { executeInMemoryQuery } from "@/lib/query-engine/engine";
import { queryRequestSchema } from "@/lib/query-engine/schema";

describe("in-memory query engine", () => {
  it("groups and aggregates registered fields", () => {
    const request = queryRequestSchema.parse({ datasetId: seedDataset.id, dimensions: ["Line"], measures: [{ field: "ActualQty", aggregation: "sum", alias: "Actual" }], filters: [{ field: "Shift", operator: "equals", value: "Day" }], sort: [], limit: 100 });
    const rows = executeInMemoryQuery(seedDataset, syntheticRecords.map((row) => ({ ...row })), request);
    expect(rows).toHaveLength(3); expect(rows.every((row) => typeof row.Actual === "number")).toBe(true);
  });
  it("rejects unregistered identifiers", () => {
    const request = queryRequestSchema.parse({ datasetId: seedDataset.id, dimensions: ["Password"], measures: [], filters: [], sort: [], limit: 10 });
    expect(() => executeInMemoryQuery(seedDataset, [], request)).toThrow("not registered");
  });
});
