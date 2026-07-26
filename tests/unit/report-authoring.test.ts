import { describe, expect, it } from "vitest";
import { createMobileLayout, nudgeLayoutItem, snapReportLayout } from "@/lib/report-authoring";

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

  it("creates a deterministic two-column mobile layout", () => {
    const layout = createMobileLayout([
      { i: "wide", x: 0, y: 2, w: 6, h: 4 },
      { i: "left", x: 0, y: 0, w: 2, h: 2 },
      { i: "right", x: 2, y: 0, w: 2, h: 2 },
    ]);
    expect(layout).toEqual([
      { i: "left", x: 0, y: 0, w: 1, h: 2 },
      { i: "right", x: 1, y: 0, w: 1, h: 2 },
      { i: "wide", x: 0, y: 2, w: 2, h: 4 },
    ]);
  });

  it("nudges and resizes selected items within canvas bounds", () => {
    const item = { i: "visual", x: 1, y: 2, w: 2, h: 3 };
    expect(nudgeLayoutItem(item, "ArrowRight", false, 12)).toMatchObject({ x: 2, y: 2 });
    expect(nudgeLayoutItem(item, "ArrowUp", false, 12)).toMatchObject({ x: 1, y: 1 });
    expect(nudgeLayoutItem(item, "ArrowLeft", true, 12)).toMatchObject({ w: 1, h: 3 });
    expect(nudgeLayoutItem(item, "ArrowDown", true, 12)).toMatchObject({ w: 2, h: 4 });
  });
});
