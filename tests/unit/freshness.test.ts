import { describe, expect, it } from "vitest";
import { classifyFreshness } from "@/lib/freshness";
const now = new Date("2026-07-25T12:00:00Z");
describe("freshness classification", () => {
  it("classifies healthy, delayed, and stale ages", () => {
    expect(classifyFreshness({ sourceUpdatedAt: "2026-07-25T11:56:00Z", refreshIntervalMinutes: 5, staleAfterMinutes: 10, now })).toBe("healthy");
    expect(classifyFreshness({ sourceUpdatedAt: "2026-07-25T11:52:00Z", refreshIntervalMinutes: 5, staleAfterMinutes: 10, now })).toBe("delayed");
    expect(classifyFreshness({ sourceUpdatedAt: "2026-07-25T11:49:00Z", refreshIntervalMinutes: 5, staleAfterMinutes: 10, now })).toBe("stale");
  });
  it("prioritizes offline and failed states", () => {
    expect(classifyFreshness({ online: false, refreshIntervalMinutes: 5, staleAfterMinutes: 10, now })).toBe("offline");
    expect(classifyFreshness({ latestRefreshFailed: true, refreshIntervalMinutes: 5, staleAfterMinutes: 10, now })).toBe("failed");
  });
});
