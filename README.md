# Digital Verse

Digital Verse is a self-hosted internal business-intelligence platform for Windows and SQL Server. It recreates the useful structure of a published BI application—grouped navigation, audience-aware reports, refresh state, controlled exports, and administration—without copying Microsoft branding or pretending to import PBIX assets.

The pilot development scripts use Next.js's webpack runtime for predictable detached-process behavior on Windows; production builds remain optimized with Next.js Turbopack.

The repository currently contains a functional Phase 1 prototype with synthetic manufacturing data only.

## Prototype capabilities

- Application-managed, server-authorized sessions with four roles: Viewer, Supervisor, Manager, and Administrator.
- Safe local preview authentication that is unavailable in production and does not use a default password.
- A seeded **Digital Verse Demo** app with five navigation groups, ten reports, and audience-aware visibility.
- Seventeen metadata-driven visuals: KPI, bar, column, stacked bar/column, line, area, combo, scatter, doughnut, treemap, funnel, waterfall, gauge, table, matrix, and slicer.
- Viewer filters plus persisted report/page/visual filters, advanced AND/OR clauses, Top/Bottom N, relative dates, locked and hidden filters, visual sorting, chart cross-filtering, persisted hierarchy drill down/up/expand controls, hidden drillthrough target pages with carried context and back navigation, report-owned and personal bookmarks, authored buttons and page/bookmark navigators, focus mode, show data, report pages, fullscreen, light/dark themes, distinct freshness timestamps, and dedicated loading/empty/no-result/stale/offline/error states.
- Excel/CSV upload, preview, type detection, semantic field editing, retention metadata, and a SQL Server connection test.
- Live-preview report and application builders with draggable/resizable layouts, data field wells, visual sorting and advanced scoped-filter authoring, visual formatting, persisted source-to-target filter/highlight/none interactions, page duplication/hiding, grouped content, audience preview, draft/publish states, and validation.
- Secure structured query validation; the browser cannot submit SQL or unregistered identifiers.
- CSV and Excel exports that enforce authentication, registered visible fields, filters, and row limits.
- Comments, structured alerts, acknowledgements, audit history, manual refresh, countdown, and refresh monitoring.
- SQL Server migrations, a separate refresh-worker process, Python ETL adapters, Power Automate endpoint, Windows scripts, tests, and CI.

## Intentional Phase 1 limitations

- Semantic datasets contain one table. Relationships, star schemas, reusable advanced measures, and bidirectional filters remain a later semantic-model milestone.
- Mock data and administrative changes are process-local and reset when the web process restarts. Mock mode exists for local preview and CI only.
- SQL metadata migrations, connection pooling, administrator bootstrap, session creation, and versioned ETL architecture are included; full CRUD persistence adapters beyond authentication are the next SQL-mode task.
- File imports in mock mode are held in process memory. Production imports use the Python transaction/version path.
- No automatic PBIX, DAX, Power Query, Microsoft Graph, PDF, image, PowerPoint, scheduled email, or production-record correction support is claimed yet.
- The worker contains the due-schedule/locking/run-record orchestration boundary; production source-specific invocation and failure retry policy need deployment integration testing.

## Architecture

```text
Browser -> Next.js App Router -> authorization/services -> repository interfaces
                                             |-> mock synthetic store (preview/CI)
                                             |-> SQL Server (metadata, versions, audit)

Refresh worker -> source adapter -> Python ETL -> new dve_data version -> validate -> activate
Power Automate -> keyed integration API -> staging/event audit
```

See [architecture](docs/architecture.md), [database](docs/database.md), [API](docs/api.md), and the [frozen specification](docs/specification.md).

## Prerequisites

- Windows 11 target host (development also works on supported Node platforms)
- Node.js 22 or newer; Node.js 24 LTS is recommended
- npm 10 or newer
- Python 3.11+ for file ETL
- SQL Server 2019+ and Microsoft ODBC Driver 18 for SQL mode

## Local mock setup

```powershell
npm install
Copy-Item .env.example .env
```

Keep `AUTH_MODE=mock` and `DATA_MODE=mock`. Replace placeholder paths as needed; do not commit `.env`.

```powershell
npm run dev:all
```

Open [http://localhost:3000](http://localhost:3000). The login page offers synthetic role previews without a password. Mock mode is rejected in production.

## SQL Server mode

Set these values in the untracked `.env` file or the process environment:

`AUTH_MODE=sql`, `DATA_MODE=sql`, `APP_ENCRYPTION_KEY`, `SQL_SERVER`, `SQL_PORT`, `SQL_DATABASE`, `SQL_USERNAME`, `SQL_PASSWORD`, `SQL_ENCRYPT`, and `SQL_TRUST_SERVER_CERTIFICATE`.

Generate a 32-byte encryption key without printing it into source control, then run:

```powershell
npm run db:migrate
npm run create-admin -- --username admin --email admin@example.invalid --display-name "Platform Administrator"
```

The bootstrap command reads the password without echo. Non-interactive deployment automation may expose a transient `DVE_ADMIN_PASSWORD` process environment variable through an approved secret manager. See [database setup](docs/database.md) for service-account and permissions guidance.

## Development and production

```powershell
# Web only, bound to all interfaces
npm run dev

# Full validation and build
npm run check

# Production web process
npm run build
npm run start

# Separate production refresh process
npm run worker
```

The default URL is `http://localhost:3000`; another internal device uses `http://<stable-hostname-or-ip>:3000`. Do not expose the prototype directly to the public internet. Use IIS reverse proxy and HTTPS before hardened deployment.

## Database and ETL

```powershell
npm run db:migrate
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r etl\requirements.txt
python etl\import_excel_csv.py --help
```

The ETL writer creates a new physical table, validates row count/schema hash, switches the active version inside a transaction, and leaves the previous valid version untouched when a refresh fails.

## Validation

```powershell
npm run lint
npm run type-check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Normal CI uses mock data and needs no SQL Server secrets.

## Windows deployment

Use `scripts/build.ps1` and `scripts/start-production.ps1`. The firewall and Task Scheduler scripts are optional and must be run explicitly under company policy. Full host hardening, backups, recovery, stable addressing, and IIS guidance are in [Windows deployment](docs/windows-deployment.md).

## Security

Never commit `.env`, connection strings, passwords, upload files, exports, logs, confidential names, or company data. Read [SECURITY.md](SECURITY.md) and [docs/security.md](docs/security.md) before SQL-mode deployment.

## Git workflow

Create a focused branch, run `npm run check`, inspect staged files for secrets, commit intentionally, push, and open a draft PR. See [CONTRIBUTING.md](CONTRIBUTING.md).

The phased delivery plan is in the [roadmap](docs/roadmap.md), with the active Power BI-style front-end matrix in [front-end parity](docs/frontend-parity.md).
