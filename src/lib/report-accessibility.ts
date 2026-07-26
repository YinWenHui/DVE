import type { ReportPage, ReportThemeDefinition } from "@/types";

export interface ReportAccessibilityIssue {
  id: string;
  severity: "error" | "warning";
  code: "contrast" | "missing-name" | "missing-alt" | "missing-source" | "duplicate-name" | "mobile-layout";
  message: string;
  itemId?: string;
}

function rgb(hex: string): [number, number, number] | undefined {
  const value = hex.trim().replace(/^#/, "");
  const expanded = value.length === 3 ? value.split("").map((part) => `${part}${part}`).join("") : value;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return undefined;
  return [0, 2, 4].map((index) => Number.parseInt(expanded.slice(index, index + 2), 16)) as [number, number, number];
}

function luminance(color: string) {
  const channels = rgb(color);
  if (!channels) return undefined;
  const values = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * values[0]! + 0.7152 * values[1]! + 0.0722 * values[2]!;
}

export function contrastRatio(foreground: string, background: string): number | undefined {
  const first = luminance(foreground);
  const second = luminance(background);
  if (first === undefined || second === undefined) return undefined;
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function auditReportPage(page: ReportPage, theme: ReportThemeDefinition): ReportAccessibilityIssue[] {
  const issues: ReportAccessibilityIssue[] = [];
  const textContrast = contrastRatio(theme.textColor, theme.surfaceColor);
  const accentContrast = contrastRatio(theme.accentColor, theme.surfaceColor);
  if (textContrast !== undefined && textContrast < 4.5) issues.push({ id: "theme-text-contrast", severity: "error", code: "contrast", message: `Theme text contrast is ${textContrast.toFixed(2)}:1; normal text needs at least 4.5:1.` });
  if (accentContrast !== undefined && accentContrast < 3) issues.push({ id: "theme-accent-contrast", severity: "warning", code: "contrast", message: `Theme accent contrast is ${accentContrast.toFixed(2)}:1; controls and large text need at least 3:1.` });

  const visibleItems = [...page.visuals.filter((item) => !item.hidden), ...(page.controls ?? []).filter((item) => !item.hidden)];
  visibleItems.forEach((item) => {
    if (!item.title.trim()) issues.push({ id: `${item.id}-name`, severity: "error", code: "missing-name", itemId: item.id, message: "Visible report object has no accessible name." });
  });
  (page.controls ?? []).filter((control) => !control.hidden).forEach((control) => {
    if (["shape", "image"].includes(control.type) && !control.altText?.trim()) issues.push({ id: `${control.id}-alt`, severity: "error", code: "missing-alt", itemId: control.id, message: `${control.type === "image" ? "Image" : "Shape"} needs alternative text.` });
    if (control.type === "image" && !control.imageUrl?.trim()) issues.push({ id: `${control.id}-source`, severity: "warning", code: "missing-source", itemId: control.id, message: "Image source is not configured." });
    if (control.type === "textBox" && !control.content?.trim()) issues.push({ id: `${control.id}-content`, severity: "warning", code: "missing-name", itemId: control.id, message: "Text box has no visible content." });
  });

  const titles = new Map<string, string[]>();
  visibleItems.forEach((item) => { const name = item.title.trim().toLocaleLowerCase(); if (name) titles.set(name, [...(titles.get(name) ?? []), item.id]); });
  titles.forEach((ids, name) => { if (ids.length > 1) issues.push({ id: `duplicate-${name}`, severity: "warning", code: "duplicate-name", itemId: ids[0], message: `${ids.length} visible objects share the name “${name}”. Use distinct names for navigation.` }); });

  if (page.mobileLayout?.enabled) {
    const mobileIds = new Set(page.mobileLayout.items.filter((item) => !item.hidden).map((item) => item.itemId));
    visibleItems.filter((item) => !mobileIds.has(item.id)).forEach((item) => issues.push({ id: `${item.id}-mobile`, severity: "warning", code: "mobile-layout", itemId: item.id, message: `${item.title || "Unnamed object"} is missing from the authored mobile layout.` }));
  }
  return issues;
}
