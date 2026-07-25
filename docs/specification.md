# Frozen Phase 1 specification

## Product

Digital Verse is an English-only, self-hosted, multi-application BI platform for an always-on Windows 11 workstation. It targets roughly 50 registered and 20 concurrent internal users. The default timezone is `Asia/Bangkok`; timestamps are stored in UTC and the fiscal year starts January 1.

The experience uses a dark grouped application sidebar, report command bar, neutral canvas, audience-based navigation, administration modules, and metadata-defined visuals. It does not copy Microsoft identity or assets.

## Roles

- **Viewer:** assigned applications/reports, filters, and permitted exports.
- **Supervisor:** Viewer plus operational detail, comments, and alert acknowledgement.
- **Manager:** Supervisor plus management-assigned reports and broader assigned access.
- **Administrator:** datasets, sources, reports, applications, audiences, users/roles, refresh, alerts, audit, and settings.

Authorization is required on the server; hidden controls are not a security boundary.

## Phase 1 functional scope

- Application-managed password authentication, secure hashes, random sessions, HttpOnly cookies, expiration, revocation, and administrator bootstrap without a default password.
- Multi-application metadata, grouped/collapsible navigation, sections, reports, audiences, default landing report, and draft/published/archived states.
- Single-table semantic datasets with safe field keys, display names, String/Integer/Decimal/Boolean/Date/DateTime types; Dimension/Measure/Date/Identifier semantics; and controlled aggregations.
- Built-in calculated forms: difference, ratio, defect ratio, sum, average, count, and distinct count. No arbitrary browser SQL or JavaScript.
- Excel and CSV validation/preview/import; SQL Server table/view source architecture; Power Automate integration endpoint for Lists and workflow events.
- KPI, bar, line, area, doughnut, table, matrix, and slicer visuals; shared filters; coherent chart-category filtering; optional month-to-day drill only where implemented.
- Report pages, constrained drag/resize report authoring, metadata persistence, preview, and publishing.
- Application setup, section/report ordering, audience management and preview, and publish validation.
- Independent refresh worker, manual and interval refresh, UTC schedules interpreted for Bangkok, concurrency protection, run history, versioned activation, and previous-valid-version preservation.
- CSV/Excel export, comments, alert rule metadata, acknowledgement history, light/dark theme, fullscreen, freshness states, offline/error/empty/loading states.
- SQL migrations, Python ETL, Windows deployment scripts, documentation, tests, and mock-data CI.

## Seeded information architecture

**Digital Verse Demo** contains Daily Report (DL Report DC Line, DL Report Main Line), Monthly Report (Production Monthly, Model Performance), Workspace (Workspace Overview, Team Performance), MES (Routing Status, Pending WIP), and PQM (Quality Summary, Defect Analysis). Administration is separate.

Synthetic manufacturing records include date, shift, business unit, neutral customer/line/model/part identifiers, plan, actual, gap, achievement, yield, defect, pending, and update time for at least 30 days.

## Boundaries

PBIX import is unsupported. Power Query becomes Python/SQL ETL; DAX becomes approved calculations; report pages become metadata; visuals become ECharts/TanStack components; Apps/sections/audiences map to Digital Verse metadata. Excel Desktop is not the unattended refresh engine. Microsoft Graph, multi-table relationships, advanced DAX, advanced drill, direct source correction, PDF/image/PowerPoint, scheduled delivery, Teams, kiosk rotation, and production IIS hardening are later phases.

## Acceptance criteria

The prototype must install, lint, type-check, test, build, start, authenticate in safe preview mode, render at least six seeded reports, filter visuals, upload/preview files, edit semantic metadata, author report/app layouts, enforce audiences, refresh, export CSV/XLSX, comment, acknowledge alerts, switch themes, enter fullscreen, provide SQL/ETL/worker/deployment architecture, pass CI, contain no secrets, and identify every mocked or deferred area.
