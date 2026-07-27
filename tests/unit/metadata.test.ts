import { describe, expect, it } from "vitest";
import { seedDataset, seedReports } from "@/data/seed";
import { serializeDatasetMetadata, serializeReportMetadata } from "@/lib/metadata";
describe("metadata serialization", () => {
  it("serializes dataset field order deterministically", () => { const reversed = { ...seedDataset, fields: [...seedDataset.fields].reverse() }; expect(JSON.parse(serializeDatasetMetadata(reversed)).fields[0].ordinal).toBe(0); });
  it("round-trips report metadata", () => { const parsed = JSON.parse(serializeReportMetadata(seedReports[0])); expect(parsed.slug).toBe(seedReports[0].slug); expect(parsed.pages.length).toBeGreaterThan(0); });
});
