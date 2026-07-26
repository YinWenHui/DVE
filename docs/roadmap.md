# Roadmap

## Phase 0 — Foundation

Repository quality, strict TypeScript, CI, synthetic data, security boundaries, documentation, SQL migrations, and Windows scripts.

## Phase 1 — Core prototype (complete)

Single-table semantic datasets; Excel/CSV upload and preview; SQL table/view source architecture; viewer shell; report/app builders; application authentication; audiences; independent refresh; CSV/XLSX export; comments; alerts and acknowledgement.

The core is functional. Production completion work still includes full SQL repositories for all metadata CRUD, source-adapter subprocess integration, load/performance testing, rate limiting, and deployment security review.

## Front-end milestone — active pilot priority

Finish the Power BI-style report consumption, authoring, personalization, and distribution experience before hosting work. The detailed implemented/remaining matrix is in [frontend-parity.md](frontend-parity.md). The first tranche now includes the expanded visual catalog, scoped filters, live authoring previews, formatting controls, focus/show-data actions, and personal bookmarks.

## Semantic model milestone

Multi-table models, fact/dimension roles, relationships, cardinality and filter direction, reusable controlled measures, and date tables.

## Phase 3

PowerPoint generation, scheduled email/PDF, Teams notifications, Power Automate workflow triggers, advanced writeback, and approval actions.

## Hosting and operations milestone — deferred until front-end acceptance

IIS/HTTPS hardening, Windows service packaging, centralized monitoring, performance tuning, automated backups, disaster recovery exercises, and formal security review.
