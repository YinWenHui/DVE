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
  Province: string;
  Latitude: number;
  Longitude: number;
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
  | "map"
  | "doughnut"
  | "treemap"
  | "funnel"
  | "waterfall"
  | "gauge"
  | "table"
  | "matrix"
  | "slicer";

export type ReportFilterOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "isBlank"
  | "isNotBlank";

export type ReportFilterMode = "basic" | "advanced" | "topN" | "relativeDate";

export interface ReportFilterClause {
  operator: ReportFilterOperator;
  value?: string | number;
}

export interface ReportTopNDefinition {
  direction: "top" | "bottom";
  count: number;
  byMeasure: keyof ManufacturingRecord;
  aggregation?: Aggregation;
}

export interface ReportRelativeDateDefinition {
  direction: "last" | "next" | "current";
  amount: number;
  unit: "days" | "weeks" | "months" | "years";
  includeToday?: boolean;
}

export interface ReportFilterDefinition {
  id: string;
  field: keyof ManufacturingRecord;
  operator: ReportFilterOperator;
  value: string | number;
  mode?: ReportFilterMode;
  clauses?: ReportFilterClause[];
  logicalOperator?: "and" | "or";
  topN?: ReportTopNDefinition;
  relativeDate?: ReportRelativeDateDefinition;
  locked?: boolean;
  hidden?: boolean;
}

export interface VisualSortDefinition {
  field: keyof ManufacturingRecord;
  direction: "asc" | "desc";
}

export type ConditionalFormattingOperator = "greaterThan" | "greaterThanOrEqual" | "lessThan" | "lessThanOrEqual" | "equals" | "between";
export type ConditionalFormattingTarget = "dataColor" | "backgroundColor" | "textColor" | "dataBar";

export interface ConditionalFormattingRule {
  id: string;
  field: keyof ManufacturingRecord;
  operator: ConditionalFormattingOperator;
  value: number;
  secondValue?: number;
  target: ConditionalFormattingTarget;
  color: string;
}

export interface VisualConditionalFormatting {
  defaultColor?: string;
  rules: ConditionalFormattingRule[];
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

export interface ReportThemeDefinition {
  name: string;
  accentColor: string;
  secondaryColor: string;
  canvasColor: string;
  surfaceColor: string;
  textColor: string;
  fontFamily?: string;
}

export interface ReportFormatPreset {
  id: string;
  name: string;
  display: VisualDisplayOptions;
}

export interface ReportPageCanvasOptions {
  backgroundColor?: string;
  wallpaperUrl?: string;
  wallpaperFit?: "cover" | "contain" | "fill";
  showGrid?: boolean;
  snapToGrid?: boolean;
  gridSize?: 1 | 2 | 3;
}

export interface ReportMobileLayoutItem {
  itemId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hidden?: boolean;
}

export interface ReportMobileLayoutDefinition {
  enabled: boolean;
  items: ReportMobileLayoutItem[];
}

export interface VisualInteractionOptions {
  crossFilter?: boolean;
  tooltips?: boolean;
}

export interface KpiTargetDefinition {
  mode: "constant" | "measure";
  value?: number;
  measure?: keyof ManufacturingRecord;
  aggregation?: Aggregation;
  direction?: "higherIsBetter" | "lowerIsBetter";
  varianceFormat?: "value" | "percent";
}

export type TabularColumnFormat = "auto" | "text" | "number" | "percent" | "date";

export interface TabularColumnDefinition {
  field: keyof ManufacturingRecord;
  label?: string;
  width?: number;
  alignment?: "left" | "center" | "right";
  format?: TabularColumnFormat;
  decimalPlaces?: number;
  aggregation?: Aggregation;
}

export interface TabularVisualOptions {
  columns?: TabularColumnDefinition[];
  matrixRows?: Array<keyof ManufacturingRecord>;
  rowLimit?: number;
  showTotals?: boolean;
  stripedRows?: boolean;
  density?: "compact" | "standard" | "comfortable";
}

export interface GeographicVisualOptions {
  locationField?: keyof ManufacturingRecord;
  latitudeField?: keyof ManufacturingRecord;
  longitudeField?: keyof ManufacturingRecord;
  mapName?: "thailand";
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
  categoryFields?: Array<keyof ManufacturingRecord>;
  measure?: keyof ManufacturingRecord;
  secondaryMeasure?: keyof ManufacturingRecord;
  valueFields?: Array<keyof ManufacturingRecord>;
  legendField?: keyof ManufacturingRecord;
  smallMultipleField?: keyof ManufacturingRecord;
  tooltipFields?: Array<keyof ManufacturingRecord>;
  aggregation?: Aggregation;
  format?: "number" | "percent";
  display?: VisualDisplayOptions;
  interaction?: VisualInteractionOptions;
  filters?: ReportFilterDefinition[];
  sort?: VisualSortDefinition;
  conditionalFormatting?: VisualConditionalFormatting;
  target?: KpiTargetDefinition;
  tabular?: TabularVisualOptions;
  geographic?: GeographicVisualOptions;
  hidden?: boolean;
}

export interface DrillthroughDefinition {
  fields: Array<keyof ManufacturingRecord>;
  keepAllFilters?: boolean;
}

export type VisualInteractionMode = "filter" | "highlight" | "none";

export interface VisualInteractionDefinition {
  sourceVisualId: string;
  targetVisualId: string;
  mode: VisualInteractionMode;
}

export interface ReportBookmarkFilters {
  from?: string;
  to?: string;
  Line?: string;
  Model?: string;
  Customer?: string;
  Shift?: string;
}

export interface ReportBookmarkDefinition {
  id: string;
  name: string;
  pageId: string;
  filters?: ReportBookmarkFilters;
}

export type ReportControlType = "button" | "pageNavigator" | "bookmarkNavigator" | "textBox" | "shape" | "image";
export type ReportActionType = "page" | "bookmark" | "back" | "resetFilters";

export interface ReportActionDefinition {
  type: ReportActionType;
  targetId?: string;
}

export interface ReportControlDisplayOptions {
  backgroundColor?: string;
  accentColor?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  fontSize?: number;
  fontWeight?: "normal" | "semibold" | "bold";
  textAlignment?: "left" | "center" | "right";
  verticalAlignment?: "start" | "center" | "end";
  shape?: "rectangle" | "roundedRectangle" | "ellipse" | "line";
  imageFit?: "cover" | "contain" | "fill";
}

export interface ReportControlDefinition {
  id: string;
  type: ReportControlType;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  action?: ReportActionDefinition;
  display?: ReportControlDisplayOptions;
  content?: string;
  imageUrl?: string;
  altText?: string;
  hidden?: boolean;
}

export interface ReportPage {
  id: string;
  name: string;
  ordinal: number;
  hidden?: boolean;
  drillthrough?: DrillthroughDefinition;
  filters?: ReportFilterDefinition[];
  visuals: VisualDefinition[];
  controls?: ReportControlDefinition[];
  interactions?: VisualInteractionDefinition[];
  canvas?: ReportPageCanvasOptions;
  mobileLayout?: ReportMobileLayoutDefinition;
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
  bookmarks?: ReportBookmarkDefinition[];
  theme?: ReportThemeDefinition;
  formatPresets?: ReportFormatPreset[];
  endorsement?: "promoted" | "certified";
  owner?: string;
  lastModifiedAt?: string;
  usage?: {
    views30d: number;
    uniqueViewers30d: number;
    lastViewedAt: string;
  };
  pages: ReportPage[];
}

export type ReportSubscriptionFrequency = "daily" | "weekly" | "monthly";
export type ReportSubscriptionFormat = "pdf" | "pptx";

export interface ReportSubscriptionDefinition {
  id: string;
  reportId: string;
  name: string;
  recipients: string[];
  frequency: ReportSubscriptionFrequency;
  weekday?: number;
  monthDay?: number;
  time: string;
  timezone: string;
  format: ReportSubscriptionFormat;
  enabled: boolean;
  createdAt: string;
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
