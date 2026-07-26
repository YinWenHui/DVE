import { describe, expect, it } from "vitest";
import { containRect, exportFileName } from "@/lib/report-export";

describe("report export helpers", () => {
  it("creates filesystem-safe image names", () => {
    expect(exportFileName("daily-output", "Line A / Detail", "png")).toBe("daily-output-line-a-detail.png");
  });

  it("fits wide report captures inside a target without distortion", () => {
    const frame = containRect(1600, 900, 12, 6);
    expect(frame.x).toBeCloseTo(2 / 3);
    expect(frame.y).toBe(0);
    expect(frame.width).toBeCloseTo(32 / 3);
    expect(frame.height).toBe(6);
  });
});
