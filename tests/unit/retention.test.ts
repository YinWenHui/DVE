import { describe, expect, it } from "vitest";
import { validateRetentionPolicy } from "@/lib/retention";
describe("retention configuration", () => {
  it("accepts supported policies", () => { expect(validateRetentionPolicy({ mode: "permanent" }).success).toBe(true); expect(validateRetentionPolicy({ mode: "days", days: 90 }).success).toBe(true); expect(validateRetentionPolicy({ mode: "detail-and-summary", detailDays: 30 }).success).toBe(true); });
  it("rejects invalid day windows", () => { expect(validateRetentionPolicy({ mode: "days", days: 0 }).success).toBe(false); expect(validateRetentionPolicy({ mode: "custom", days: 30 }).success).toBe(false); });
});
