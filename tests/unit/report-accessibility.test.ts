import { describe, expect, it } from "vitest";
import { auditReportPage, contrastRatio } from "@/lib/report-accessibility";
import type { ReportPage, ReportThemeDefinition } from "@/types";

const theme: ReportThemeDefinition = { name: "Test", accentColor: "#1d4ed8", secondaryColor: "#0f766e", canvasColor: "#f8fafc", surfaceColor: "#ffffff", textColor: "#111827" };

describe("report accessibility inspection", () => {
  it("calculates WCAG contrast ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.478, 2);
  });

  it("finds missing names, alternatives, sources, and mobile placements", () => {
    const page: ReportPage = {
      id: "page", name: "Overview", ordinal: 0,
      visuals: [{ id: "visual", type: "kpi", title: "", x: 0, y: 0, w: 2, h: 2, measure: "ActualQty" }],
      controls: [{ id: "image", type: "image", title: "Logo", x: 0, y: 2, w: 2, h: 2 }],
      mobileLayout: { enabled: true, items: [] },
    };
    const codes = auditReportPage(page, theme).map((issue) => issue.code);
    expect(codes).toContain("missing-name");
    expect(codes).toContain("missing-alt");
    expect(codes).toContain("missing-source");
    expect(codes).toContain("mobile-layout");
  });

  it("flags insufficient theme contrast", () => {
    expect(auditReportPage({ id: "page", name: "Page", ordinal: 0, visuals: [] }, { ...theme, textColor: "#cccccc" }).some((issue) => issue.code === "contrast" && issue.severity === "error")).toBe(true);
  });
});
