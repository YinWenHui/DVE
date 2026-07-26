export const roleCodes = ["VIEWER", "SUPERVISOR", "MANAGER", "ADMINISTRATOR"] as const;
export type RoleCode = (typeof roleCodes)[number];

export type Permission =
  | "apps:read"
  | "reports:read"
  | "datasets:query"
  | "exports:create"
  | "comments:create"
  | "alerts:acknowledge"
  | "admin:manage";

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  roles: RoleCode[];
  isMock: boolean;
}

export const dataTypes = ["string", "integer", "decimal", "boolean", "date", "datetime"] as const;
export type DataType = (typeof dataTypes)[number];

export const semanticTypes = ["dimension", "measure", "date", "identifier", "geographic"] as const;
export type SemanticType = (typeof semanticTypes)[number];

export const aggregations = ["none", "sum", "average", "minimum", "maximum", "count", "distinctCount"] as const;
export type Aggregation = (typeof aggregations)[number];

export interface DatasetField {
  id: string;
  sourceName: string;
  key: string;
  displayName: string;
  dataType: DataType;
  semanticType: SemanticType;
  defaultAggregation: Aggregation;
  formatString?: string;
  hidden: boolean;
  filterable: boolean;
  sortable: boolean;
  ordinal: number;
}

export interface Dataset {
  id: string;
  name: string;
  slug: string;
  description: string;
  sourceType: "excel" | "csv" | "sql-server" | "power-automate" | "synthetic";
  storageMode: "import" | "direct" | "mock";
  status: "healthy" | "refreshing" | "delayed" | "stale" | "failed" | "offline";
  owner: string;
  rowCount: number;
  lastSuccessfulRefresh: string;
  nextScheduledRefresh: string;
  sourceUpdatedAt: string;
  importedAt: string;
  refreshIntervalMinutes: number;
  staleAfterMinutes: number;
  retention: RetentionPolicy;
  fields: DatasetField[];
}

export type RetentionPolicy =
  | { mode: "permanent" }
  | { mode: "days"; days: number }
  | { mode: "detail-and-summary"; detailDays: number };

export interface ManufacturingRecord {
  id: string;
  RecordDate: string;
  Shift: "Day" | "Night";
  BusinessUnit: string;
  Customer: string;
  Line: string;
  Model: string;
  PartNumber: string;
  PlanQty: number;
  ActualQty: number;
  GapQty: number;
  AchievementRate: number;
  YieldRate: number;
  DefectQty: number;
  PendingQty: number;
  UpdatedAt: string;
}

export type VisualType =
  | "kpi"
  | "bar"
  | "column"
  | "stackedBar"
  | "stackedColumn"
  | "line"
  | "area"
  | "combo"
  | "scatter"
  | "doughnut"
  | "treemap"
  | "funnel"
  | "waterfall"
  | "gauge"
  | "table"
  | "matrix"
  | "slicer";

export type ReportFilterOperator = "equals" | "notEquals" | "contains" | "greaterThanOrEqual" | "lessThanOrEqual";

export interface ReportFilterDefinition {
  id: string;
  field: keyof ManufacturingRecord;
  operator: ReportFilterOperator;
  value: string | number;
}

export interface VisualDisplayOptions {
  showTitle?: boolean;
  showLegend?: boolean;
  showDataLabels?: boolean;
  showGridlines?: boolean;
  backgroundColor?: string;
  accentColor?: string;
  borderRadius?: number;
  titleAlignment?: "left" | "center" | "right";
}

export interface VisualInteractionOptions {
  crossFilter?: boolean;
  tooltips?: boolean;
}

export interface VisualDefinition {
  id: string;
  type: VisualType;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  dimension?: keyof ManufacturingRecord;
  hierarchy?: Array<keyof ManufacturingRecord>;
  measure?: keyof ManufacturingRecord;
  secondaryMeasure?: keyof ManufacturingRecord;
  aggregation?: Aggregation;
  format?: "number" | "percent";
  display?: VisualDisplayOptions;
  interaction?: VisualInteractionOptions;
  filters?: ReportFilterDefinition[];
}

export interface ReportPage {
  id: string;
  name: string;
  ordinal: number;
  hidden?: boolean;
  filters?: ReportFilterDefinition[];
  visuals: VisualDefinition[];
}

export interface Report {
  id: string;
  datasetId: string;
  name: string;
  slug: string;
  description: string;
  status: "draft" | "published" | "archived";
  minimumRole: RoleCode;
  filters?: ReportFilterDefinition[];
  pages: ReportPage[];
}

export interface AppSection {
  id: string;
  name: string;
  ordinal: number;
  collapsedByDefault: boolean;
  reportIds: string[];
}

export interface Audience {
  id: string;
  name: string;
  roles: RoleCode[];
  userIds: string[];
  reportIds: string[];
}

export interface DveApplication {
  id: string;
  name: string;
  slug: string;
  description: string;
  initials: string;
  status: "draft" | "published" | "archived";
  publisher: string;
  publishedAt?: string;
  defaultReportId: string;
  sections: AppSection[];
  audiences: Audience[];
}

export interface CommentRecord {
  id: string;
  entityType: "report" | "report-page" | "alert" | "business-record";
  entityId: string;
  body: string;
  userId: string;
  userDisplayName: string;
  createdAt: string;
}

export interface AlertEvent {
  id: string;
  ruleName: string;
  severity: "info" | "warning" | "critical";
  status: "open" | "acknowledged" | "resolved";
  firedAt: string;
  message: string;
  acknowledgement?: { userId: string; userDisplayName: string; comment: string; acknowledgedAt: string };
}

export interface AlertRule {
  id: string;
  name: string;
  datasetId?: string;
  field: string;
  operator: "lessThan" | "lessThanOrEqual" | "greaterThan" | "greaterThanOrEqual" | "equals";
  threshold: number;
  severity: "info" | "warning" | "critical";
  enabled: boolean;
}

export interface AuditRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userDisplayName: string;
  createdAt: string;
  details: string;
}
