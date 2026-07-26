import { describe, expect, it } from "vitest";
import { snapReportLayout } from "@/lib/report-authoring";

describe("report authoring", () => {
  it("snaps positions and sizes to the configured authoring grid", () => {
    expect(snapReportLayout([{ i: "visual", x: 3, y: 5, w: 5, h: 3 }], true, 2)).toEqual([
      { i: "visual", x: 4, y: 6, w: 6, h: 4 },
    ]);
  });

  it("keeps single-cell and free placement unchanged", () => {
    const layout = [{ i: "visual", x: 3, y: 5, w: 5, h: 3 }];
    expect(snapReportLayout(layout, true, 1)).toBe(layout);
    expect(snapReportLayout(layout, false, 3)).toBe(layout);
  });
});
