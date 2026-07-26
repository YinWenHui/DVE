import type {
  AlertEvent, AlertRule,
  AuditRecord,
  Dataset,
  DatasetField,
  DveApplication,
  ManufacturingRecord,
  Report,
  RoleCode,
  User,
  VisualDefinition,
  VisualInteractionDefinition,
} from "@/types";

const now = new Date();
const isoMinutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
const isoMinutesAhead = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();

const field = (
  key: keyof ManufacturingRecord,
  displayName: string,
  dataType: DatasetField["dataType"],
  semanticType: DatasetField["semanticType"],
  defaultAggregation: DatasetField["defaultAggregation"],
  ordinal: number,
  formatString?: string,
): DatasetField => ({
  id: `field-${key}`,
  sourceName: key,
  key,
  displayName,
  dataType,
  semanticType,
  defaultAggregation,
  formatString,
  hidden: key === "id",
  filterable: key !== "id",
  sortable: true,
  ordinal,
});

export const manufacturingFields: DatasetField[] = [
  field("id", "Record ID", "string", "identifier", "none", 0),
  field("RecordDate", "Record Date", "date", "date", "none", 1, "dd MMM yyyy"),
  field("Shift", "Shift", "string", "dimension", "none", 2),
  field("BusinessUnit", "Business Unit", "string", "dimension", "none", 3),
  field("Customer", "Customer", "string", "dimension", "none", 4),
  field("Line", "Line", "string", "dimension", "none", 5),
  field("Model", "Model", "string", "dimension", "none", 6),
  field("PartNumber", "Part Number", "string", "identifier", "none", 7),
  field("PlanQty", "Plan", "integer", "measure", "sum", 8, "#,##0"),
  field("ActualQty", "Actual", "integer", "measure", "sum", 9, "#,##0"),
  field("GapQty", "Gap", "integer", "measure", "sum", 10, "#,##0"),
  field("AchievementRate", "Achievement Rate", "decimal", "measure", "average", 11, "0.0%"),
  field("YieldRate", "Yield Rate", "decimal", "measure", "average", 12, "0.0%"),
  field("DefectQty", "Defect Quantity", "integer", "measure", "sum", 13, "#,##0"),
  field("PendingQty", "Pending Quantity", "integer", "measure", "sum", 14, "#,##0"),
  field("UpdatedAt", "Source Updated", "datetime", "date", "maximum", 15, "dd MMM yyyy HH:mm"),
];

export function createSyntheticRecords(days = 35): ManufacturingRecord[] {
  const lines = ["Line A", "Line B", "Line C"] as const;
  const records: ManufacturingRecord[] = [];
  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOffset));
    for (const [lineIndex, line] of lines.entries()) {
      for (const [shiftIndex, shift] of (["Day", "Night"] as const).entries()) {
        const plan = 850 + lineIndex * 90 + shiftIndex * 45 + (dayOffset % 5) * 12;
        const variance = ((dayOffset * 17 + lineIndex * 23 + shiftIndex * 11) % 145) - 48;
        const actual = Math.max(0, plan + variance);
        const defect = 8 + ((dayOffset + lineIndex * 3 + shiftIndex * 5) % 29);
        const customer = (dayOffset + lineIndex) % 2 === 0 ? "Customer Alpha" : "Customer Beta";
        const model = (dayOffset + shiftIndex) % 2 === 0 ? "Model X100" : "Model X200";
        records.push({
          id: `MFG-${date.toISOString().slice(0, 10)}-${lineIndex + 1}-${shiftIndex + 1}`,
          RecordDate: date.toISOString().slice(0, 10),
          Shift: shift,
          BusinessUnit: lineIndex === 2 ? "Assembly" : "Production",
          Customer: customer,
          Line: line,
          Model: model,
          PartNumber: model === "Model X100" ? "PN-X100-A" : "PN-X200-B",
          PlanQty: plan,
          ActualQty: actual,
          GapQty: actual - plan,
          AchievementRate: plan === 0 ? 0 : actual / plan,
          YieldRate: actual === 0 ? 0 : (actual - defect) / actual,
          DefectQty: defect,
          PendingQty: Math.max(0, plan - actual) + ((dayOffset + lineIndex) % 18),
          UpdatedAt: new Date(date.getTime() + (16 + shiftIndex * 7) * 3_600_000).toISOString(),
        });
      }
    }
  }
  return records;
}

export const syntheticRecords = createSyntheticRecords();

export const seedDataset: Dataset = {
  id: "dataset-manufacturing-output",
  name: "Manufacturing Output",
  slug: "manufacturing-output",
  description: "Synthetic production plan, output, quality, and pending quantity by day, line, and shift.",
  sourceType: "synthetic",
  storageMode: "mock",
  status: "healthy",
  owner: "Digital Verse Demo",
  rowCount: syntheticRecords.length,
  lastSuccessfulRefresh: isoMinutesAgo(3),
  nextScheduledRefresh: isoMinutesAhead(2),
  sourceUpdatedAt: isoMinutesAgo(4),
  importedAt: isoMinutesAgo(3),
  refreshIntervalMinutes: 5,
  staleAfterMinutes: 10,
  retention: { mode: "permanent" },
  fields: manufacturingFields,
};

const baseVisuals = (variant: number): VisualDefinition[] => [
  { id: `v-${variant}-plan`, type: "kpi", title: "Plan", x: 0, y: 0, w: 2, h: 2, measure: "PlanQty", aggregation: "sum", format: "number" },
  { id: `v-${variant}-actual`, type: "kpi", title: "Actual", x: 2, y: 0, w: 2, h: 2, measure: "ActualQty", aggregation: "sum", format: "number", target: { mode: "measure", measure: "PlanQty", aggregation: "sum", direction: "higherIsBetter", varianceFormat: "percent" } },
  { id: `v-${variant}-gap`, type: "kpi", title: "Gap", x: 4, y: 0, w: 2, h: 2, measure: "GapQty", aggregation: "sum", format: "number" },
  { id: `v-${variant}-achievement`, type: "kpi", title: "Achievement", x: 6, y: 0, w: 2, h: 2, measure: "AchievementRate", aggregation: "average", format: "percent", target: { mode: "constant", value: 1, direction: "higherIsBetter", varianceFormat: "percent" }, conditionalFormatting: { defaultColor: "#5c73e6", rules: [
    { id: `cf-${variant}-achievement-low`, field: "AchievementRate", operator: "lessThan", value: 1, target: "dataColor", color: "#dc3545" },
    { id: `cf-${variant}-achievement-ok`, field: "AchievementRate", operator: "greaterThanOrEqual", value: 1, target: "dataColor", color: "#18a66a" },
  ] } },
  { id: `v-${variant}-yield`, type: "kpi", title: "Yield", x: 8, y: 0, w: 2, h: 2, measure: "YieldRate", aggregation: "average", format: "percent" },
  { id: `v-${variant}-pending`, type: "kpi", title: "Pending", x: 10, y: 0, w: 2, h: 2, measure: "PendingQty", aggregation: "sum", format: "number" },
  { id: `v-${variant}-bar`, type: "bar", title: "Actual by Line", x: 0, y: 2, w: 6, h: 5, dimension: "Line", hierarchy: ["Line", "Model", "Shift"], categoryFields: ["Line", "Model", "Shift"], measure: "ActualQty", secondaryMeasure: "PlanQty", valueFields: ["ActualQty", "PlanQty"], tooltipFields: ["PendingQty", "YieldRate"], aggregation: "sum", sort: { field: "ActualQty", direction: "desc" }, conditionalFormatting: { defaultColor: "#5c73e6", rules: [
    { id: `cf-${variant}-line-high`, field: "ActualQty", operator: "greaterThanOrEqual", value: 10_000, target: "dataColor", color: "#18a66a" },
    { id: `cf-${variant}-line-mid`, field: "ActualQty", operator: "between", value: 9_000, secondValue: 9_999, target: "dataColor", color: "#e2a45d" },
    { id: `cf-${variant}-line-low`, field: "ActualQty", operator: "lessThan", value: 9_000, target: "dataColor", color: "#dc3545" },
  ] } },
  { id: `v-${variant}-line`, type: variant % 2 === 0 ? "area" : "line", title: "Output Trend", x: 6, y: 2, w: 6, h: 5, dimension: "RecordDate", categoryFields: ["RecordDate"], measure: "ActualQty", valueFields: ["ActualQty"], legendField: "Model", smallMultipleField: "Shift", tooltipFields: ["PlanQty", "PendingQty"], aggregation: "sum", filters: [{ id: `filter-${variant}-recent-trend`, field: "RecordDate", operator: "greaterThanOrEqual", value: "", mode: "relativeDate", relativeDate: { direction: "last", amount: 7, unit: "days", includeToday: true }, locked: true }] },
  { id: `v-${variant}-donut`, type: "doughnut", title: "Output by Model", x: 0, y: 7, w: 4, h: 5, dimension: "Model", measure: "ActualQty", aggregation: "sum", filters: [{ id: `filter-${variant}-top-models`, field: "Model", operator: "equals", value: "", mode: "topN", topN: { direction: "top", count: 2, byMeasure: "ActualQty", aggregation: "sum" } }] },
  { id: `v-${variant}-matrix`, type: variant % 3 === 0 ? "matrix" : "table", title: variant % 3 === 0 ? "Line / Model Matrix" : "Production Detail", x: 4, y: 7, w: 8, h: 5, tabular: variant % 3 === 0 ? { matrixRows: ["Line", "Model"], columns: [{ field: "PlanQty", label: "Plan", format: "number", aggregation: "sum", alignment: "right", width: 95 }, { field: "ActualQty", label: "Actual", format: "number", aggregation: "sum", alignment: "right", width: 95 }, { field: "AchievementRate", label: "Achievement", format: "percent", decimalPlaces: 1, aggregation: "average", alignment: "right", width: 110 }, { field: "PendingQty", label: "Pending", format: "number", aggregation: "sum", alignment: "right", width: 95 }], showTotals: true, stripedRows: true, density: "compact" } : { columns: [{ field: "RecordDate", label: "Production date", format: "date", width: 110 }, { field: "Line", label: "Line", format: "text", width: 75 }, { field: "Shift", label: "Shift", format: "text", width: 70 }, { field: "Model", label: "Model", format: "text", width: 100 }, { field: "Customer", label: "Customer", format: "text", width: 120 }, { field: "ActualQty", label: "Actual", format: "number", alignment: "right", width: 90 }, { field: "GapQty", label: "Variance", format: "number", alignment: "right", width: 90 }, { field: "PendingQty", label: "Pending", format: "number", alignment: "right", width: 90 }], rowLimit: 50, stripedRows: true, density: "compact" }, conditionalFormatting: { rules: [
    { id: `cf-${variant}-gap-positive-bg`, field: "GapQty", operator: "greaterThanOrEqual", value: 0, target: "backgroundColor", color: "#dcfce7" },
    { id: `cf-${variant}-gap-positive-text`, field: "GapQty", operator: "greaterThanOrEqual", value: 0, target: "textColor", color: "#166534" },
    { id: `cf-${variant}-gap-negative-bg`, field: "GapQty", operator: "lessThan", value: 0, target: "backgroundColor", color: "#fee2e2" },
    { id: `cf-${variant}-gap-negative-text`, field: "GapQty", operator: "lessThan", value: 0, target: "textColor", color: "#991b1b" },
    { id: `cf-${variant}-pending-bar`, field: "PendingQty", operator: "greaterThanOrEqual", value: 0, target: "dataBar", color: "#5c73e6" },
  ] } },
  { id: `v-${variant}-slicer`, type: "slicer", title: "Line slicer", x: 0, y: 12, w: 4, h: 3, dimension: "Line" },
];

const baseInteractions = (variant: number, withKpis: boolean): VisualInteractionDefinition[] => withKpis ? [
  { sourceVisualId: `v-${variant}-slicer`, targetVisualId: `v-${variant}-plan`, mode: "filter" },
  { sourceVisualId: `v-${variant}-slicer`, targetVisualId: `v-${variant}-actual`, mode: "highlight" },
  { sourceVisualId: `v-${variant}-slicer`, targetVisualId: `v-${variant}-gap`, mode: "none" },
] : [
  { sourceVisualId: `v-${variant}-slicer`, targetVisualId: `v-${variant}-bar`, mode: "filter" },
  { sourceVisualId: `v-${variant}-slicer`, targetVisualId: `v-${variant}-line`, mode: "highlight" },
  { sourceVisualId: `v-${variant}-slicer`, targetVisualId: `v-${variant}-donut`, mode: "none" },
];

const reportNames = [
  ["DL Report DC Line", "dl-report-dc-line", "Daily production health for DC line operations."],
  ["DL Report Main Line", "dl-report-main-line", "Daily plan and actual performance across primary lines."],
  ["Production Monthly", "production-monthly", "Monthly output, achievement, and quality trends."],
  ["Model Performance", "model-performance", "Model mix and manufacturing performance."],
  ["Workspace Overview", "workspace-overview", "Shared operational overview for the reporting workspace."],
  ["Team Performance", "team-performance", "Shift and line performance comparison."],
  ["Routing Status", "routing-status", "Synthetic routing throughput and status overview."],
  ["Pending WIP", "pending-wip", "Pending quantity and work-in-progress signals."],
  ["Quality Summary", "quality-summary", "Yield and defect summary by production slice."],
  ["Defect Analysis", "defect-analysis", "Defect patterns by model, line, and day."],
] as const;

const minimumRoles: RoleCode[] = ["VIEWER", "VIEWER", "MANAGER", "MANAGER", "VIEWER", "SUPERVISOR", "SUPERVISOR", "SUPERVISOR", "VIEWER", "SUPERVISOR"];

export const seedReports: Report[] = reportNames.map(([name, slug, description], index) => ({
  id: `report-${index + 1}`,
  datasetId: seedDataset.id,
  name,
  slug,
  description,
  status: "published",
  minimumRole: minimumRoles[index],
  theme: {
    name: index === 0 ? "Digital Verse" : "Operations blue",
    accentColor: "#5c73e6",
    secondaryColor: "#2fb3c2",
    canvasColor: "#eef2f8",
    surfaceColor: "#ffffff",
    textColor: "#172033",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
  formatPresets: [
    { id: `preset-${index + 1}-executive`, name: "Executive card", display: { showTitle: true, showLegend: false, showDataLabels: true, showGridlines: false, backgroundColor: "#ffffff", accentColor: "#5c73e6", borderRadius: 12, titleAlignment: "left" } },
  ],
  filters: [
    { id: `filter-${index + 1}-recent-report`, field: "RecordDate", operator: "greaterThanOrEqual", value: "", mode: "relativeDate", relativeDate: { direction: "last", amount: 30, unit: "days", includeToday: true }, locked: true },
    { id: `filter-${index + 1}-business-unit`, field: "BusinessUnit", operator: "equals", value: "", mode: "advanced", logicalOperator: "or", clauses: [{ operator: "equals", value: "Production" }, { operator: "equals", value: "Assembly" }], hidden: true, locked: true },
  ],
  bookmarks: [
    { id: `bookmark-${index + 1}-overview`, name: "Overview", pageId: `page-${index + 1}-overview`, filters: {} },
    { id: `bookmark-${index + 1}-line-a`, name: "Line A focus", pageId: `page-${index + 1}-overview`, filters: { Line: "Line A" } },
  ],
  pages: [
    { id: `page-${index + 1}-overview`, name: "Overview", ordinal: 0, canvas: { backgroundColor: "#eef2f8", showGrid: true, snapToGrid: true, gridSize: 1 }, mobileLayout: index === 0 ? { enabled: true, items: [
      { itemId: "v-1-plan", x: 0, y: 0, w: 1, h: 2 }, { itemId: "v-1-actual", x: 1, y: 0, w: 1, h: 2 }, { itemId: "v-1-gap", x: 0, y: 2, w: 1, h: 2 }, { itemId: "v-1-achievement", x: 1, y: 2, w: 1, h: 2 }, { itemId: "v-1-yield", x: 0, y: 4, w: 1, h: 2 }, { itemId: "v-1-pending", x: 1, y: 4, w: 1, h: 2 },
      { itemId: "v-1-bar", x: 0, y: 6, w: 2, h: 5 }, { itemId: "v-1-line", x: 0, y: 11, w: 2, h: 5 }, { itemId: "v-1-donut", x: 0, y: 16, w: 2, h: 5 }, { itemId: "v-1-matrix", x: 0, y: 21, w: 2, h: 5 }, { itemId: "v-1-slicer", x: 0, y: 26, w: 2, h: 3 },
      { itemId: "control-1-pages", x: 0, y: 29, w: 2, h: 1 }, { itemId: "control-1-bookmarks", x: 0, y: 30, w: 2, h: 1 }, { itemId: "control-1-detail", x: 0, y: 31, w: 2, h: 1 }, { itemId: "control-1-note", x: 0, y: 32, w: 2, h: 2 }, { itemId: "control-1-shape", x: 0, y: 34, w: 1, h: 2, hidden: true }, { itemId: "control-1-image", x: 1, y: 34, w: 1, h: 2 },
    ] } : undefined, filters: [{ id: `filter-${index + 1}-top-model-context`, field: "Model", operator: "equals", value: "", mode: "topN", topN: { direction: "top", count: 2, byMeasure: "ActualQty", aggregation: "sum" } }], visuals: baseVisuals(index + 1), interactions: baseInteractions(index + 1, true), controls: [
      { id: `control-${index + 1}-pages`, type: "pageNavigator", title: "Page navigator", x: 0, y: 15, w: 6, h: 1 },
      { id: `control-${index + 1}-bookmarks`, type: "bookmarkNavigator", title: "Saved views", x: 6, y: 15, w: 6, h: 1 },
      { id: `control-${index + 1}-detail`, type: "button", title: "Open detail", x: 0, y: 16, w: 3, h: 1, action: { type: "page", targetId: `page-${index + 1}-detail` } },
      ...(index === 0 ? [
        { id: "control-1-note", type: "textBox" as const, title: "Operations note", content: "DC line performance is refreshed every five minutes. Select a line or model to explore the current production context.", x: 0, y: 17, w: 6, h: 2, display: { backgroundColor: "#ffffff", textColor: "#172033", borderColor: "#cfd8e8", borderWidth: 1, borderRadius: 10, fontSize: 13, fontWeight: "semibold" as const, textAlignment: "left" as const, verticalAlignment: "center" as const } },
        { id: "control-1-shape", type: "shape" as const, title: "Operations marker", altText: "Blue decorative ellipse", x: 6, y: 17, w: 2, h: 2, display: { backgroundColor: "#5c73e6", borderColor: "#4057c7", borderWidth: 2, borderRadius: 40, shape: "ellipse" as const } },
        { id: "control-1-image", type: "image" as const, title: "Digital Verse mark", altText: "Digital Verse DV mark", imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 120'%3E%3Crect width='320' height='120' rx='24' fill='%235c73e6'/%3E%3Ctext x='160' y='74' text-anchor='middle' font-family='Arial' font-size='42' font-weight='700' fill='white'%3EDigital Verse%3C/text%3E%3C/svg%3E", x: 8, y: 17, w: 4, h: 2, display: { backgroundColor: "#ffffff", borderColor: "#cfd8e8", borderWidth: 1, borderRadius: 10, imageFit: "contain" as const } },
      ] : []),
    ] },
    { id: `page-${index + 1}-detail`, name: "Detail", ordinal: 1, filters: [{ id: `filter-${index + 1}-valid-customer`, field: "Customer", operator: "contains", value: "Customer", mode: "advanced", clauses: [{ operator: "contains", value: "Customer" }, { operator: "isNotBlank" }], logicalOperator: "and", locked: true }], visuals: baseVisuals(index + 11).slice(6), interactions: baseInteractions(index + 11, false), controls: [
      { id: `control-${index + 1}-detail-pages`, type: "pageNavigator", title: "Page navigator", x: 0, y: 15, w: 6, h: 1 },
      { id: `control-${index + 1}-overview`, type: "button", title: "Back to overview", x: 6, y: 15, w: 3, h: 1, action: { type: "page", targetId: `page-${index + 1}-overview` } },
    ] },
    { id: `page-${index + 1}-line-detail`, name: "Line detail", ordinal: 2, hidden: true, drillthrough: { fields: ["Line", "Model"], keepAllFilters: true }, visuals: baseVisuals(index + 21).slice(6), interactions: baseInteractions(index + 21, false), controls: [
      { id: `control-${index + 1}-drill-back`, type: "button", title: "Return to source", x: 0, y: 15, w: 3, h: 1, action: { type: "back" } },
    ] },
  ],
}));

const reportId = (slug: string) => seedReports.find((report) => report.slug === slug)?.id ?? "";

export const seedApp: DveApplication = {
  id: "app-digital-verse-demo",
  name: "Digital Verse Demo",
  slug: "digital-verse-demo",
  description: "A synthetic manufacturing intelligence application demonstrating grouped navigation and audience-aware reports.",
  initials: "DV",
  status: "published",
  publisher: "Digital Verse Platform Team",
  publishedAt: isoMinutesAgo(120),
  defaultReportId: reportId("dl-report-dc-line"),
  sections: [
    { id: "section-daily", name: "Daily Report", ordinal: 0, collapsedByDefault: false, reportIds: [reportId("dl-report-dc-line"), reportId("dl-report-main-line")] },
    { id: "section-monthly", name: "Monthly Report", ordinal: 1, collapsedByDefault: false, reportIds: [reportId("production-monthly"), reportId("model-performance")] },
    { id: "section-workspace", name: "Workspace", ordinal: 2, collapsedByDefault: false, reportIds: [reportId("workspace-overview"), reportId("team-performance")] },
    { id: "section-mes", name: "MES", ordinal: 3, collapsedByDefault: true, reportIds: [reportId("routing-status"), reportId("pending-wip")] },
    { id: "section-pqm", name: "PQM", ordinal: 4, collapsedByDefault: true, reportIds: [reportId("quality-summary"), reportId("defect-analysis")] },
  ],
  audiences: [
    { id: "audience-all", name: "All Operations", roles: ["VIEWER", "SUPERVISOR", "MANAGER", "ADMINISTRATOR"], userIds: [], reportIds: seedReports.filter((report) => report.minimumRole === "VIEWER").map((report) => report.id) },
    { id: "audience-operations", name: "Operations", roles: ["SUPERVISOR", "MANAGER", "ADMINISTRATOR"], userIds: [], reportIds: seedReports.filter((report) => report.minimumRole !== "MANAGER").map((report) => report.id) },
    { id: "audience-management", name: "Management", roles: ["MANAGER", "ADMINISTRATOR"], userIds: [], reportIds: seedReports.map((report) => report.id) },
  ],
};

export const mockUsers: User[] = [
  { id: "user-viewer", username: "viewer.demo", email: "viewer@example.invalid", displayName: "Avery Viewer", roles: ["VIEWER"], isMock: true },
  { id: "user-supervisor", username: "supervisor.demo", email: "supervisor@example.invalid", displayName: "Jordan Supervisor", roles: ["SUPERVISOR"], isMock: true },
  { id: "user-manager", username: "manager.demo", email: "manager@example.invalid", displayName: "Morgan Manager", roles: ["MANAGER"], isMock: true },
  { id: "user-admin", username: "admin.demo", email: "admin@example.invalid", displayName: "Taylor Administrator", roles: ["ADMINISTRATOR"], isMock: true },
];

export const seedAlerts: AlertEvent[] = [
  { id: "alert-achievement", ruleName: "Achievement below target", severity: "warning", status: "open", firedAt: isoMinutesAgo(9), message: "Line B achievement is below the configured 95% target." },
  { id: "alert-pending", ruleName: "Pending quantity above threshold", severity: "critical", status: "open", firedAt: isoMinutesAgo(18), message: "Pending quantity exceeded the threshold for Model X200." },
  { id: "alert-refresh", ruleName: "Dataset stale", severity: "info", status: "resolved", firedAt: isoMinutesAgo(180), message: "Manufacturing Output refresh recovered after a transient delay." },
];

export const seedAlertRules: AlertRule[] = [
  { id: "rule-achievement", name: "Achievement below target", datasetId: seedDataset.id, field: "AchievementRate", operator: "lessThan", threshold: 0.95, severity: "warning", enabled: true },
  { id: "rule-pending", name: "Pending quantity above threshold", datasetId: seedDataset.id, field: "PendingQty", operator: "greaterThan", threshold: 100, severity: "critical", enabled: true },
  { id: "rule-yield", name: "Yield below target", datasetId: seedDataset.id, field: "YieldRate", operator: "lessThan", threshold: 0.97, severity: "warning", enabled: true },
];

export const seedAudit: AuditRecord[] = [
  { id: "audit-1", action: "app.publish", entityType: "application", entityId: seedApp.id, userDisplayName: "Taylor Administrator", createdAt: isoMinutesAgo(120), details: "Published Digital Verse Demo." },
  { id: "audit-2", action: "dataset.refresh", entityType: "dataset", entityId: seedDataset.id, userDisplayName: "Refresh Worker", createdAt: isoMinutesAgo(3), details: `Activated a validated version with ${syntheticRecords.length} rows.` },
];
