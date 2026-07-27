import { describe, expect, it } from "vitest";
import { recordReportVisit, toggleFavorite } from "@/lib/report-personalization";

describe("report personalization", () => {
  it("moves a visited report to the front and increments usage", () => {
    const result = recordReportVisit([{ reportId: "r-2", viewedAt: "old" }, { reportId: "r-1", viewedAt: "older" }], [{ reportId: "r-1", views: 2, lastViewedAt: "older" }], "r-1", "now");
    expect(result.recents).toEqual([{ reportId: "r-1", viewedAt: "now" }, { reportId: "r-2", viewedAt: "old" }]);
    expect(result.usage[0]).toEqual({ reportId: "r-1", views: 3, lastViewedAt: "now" });
  });

  it("toggles report favorites", () => {
    expect(toggleFavorite(["r-1"], "r-2")).toEqual(["r-1", "r-2"]);
    expect(toggleFavorite(["r-1", "r-2"], "r-1")).toEqual(["r-2"]);
  });
});
