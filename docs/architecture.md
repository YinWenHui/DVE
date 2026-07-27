# Architecture

## System context

The internal browser talks to one Next.js process. A separate Node refresh worker polls SQL Server schedules and invokes a Python source adapter. SQL Server is the durable metadata, imported-data, refresh, and audit store. Power Automate uses a machine key and integration route, never a user password.

## Components

- `src/app`: App Router pages and route handlers. Dynamic route `params` and cookies use the asynchronous Next.js 16 APIs.
- `src/components`: narrow client boundaries for filters, ECharts, tables, navigation, themes, comments, and builders.
- `src/lib`: authentication, permissions, validation, query engine, encryption, SQL pooling, dates/freshness, and mock state.
- `src/repositories`: interfaces separating UI/services from mock or future complete SQL persistence.
- `database`: ordered SQL Server migrations and role seed.
- `workers`: independent schedule polling and per-dataset exclusion.
- `etl`: Excel/CSV adapters, validation, transformation, and transactional version writer.

## Request flow

1. Route handler reads the HttpOnly random session token.
2. Only its SHA-256 hash is looked up; production sessions reside in SQL Server.
3. Server permission checks authorize the operation.
4. Zod validates request shape and limits.
5. Dataset metadata validates every dimension, measure, filter, and sort identifier.
6. Values are parameterized. Only registered identifiers are quoted into SQL.
7. Structured data or a sanitized error is returned; connection strings and stacks are never exposed.

## Data refresh flow

1. Worker selects enabled schedules due by UTC `next_run_at`.
2. An in-process set and SQL application lock prevent concurrent refresh of one dataset.
3. A refresh-run record is opened.
4. The approved adapter reads the source, normalizes safe keys, converts declared types, and checks schema/row limits.
5. ETL creates a new uniquely named `dve_data` table with row/batch/import/source-row columns.
6. Values are written through parameterized bulk execution inside a transaction.
7. Row count and schema hash are validated.
8. The previous version is deactivated and the new version activated only in the successful transaction.
9. On error the transaction rolls back; the previous active table remains available and the run records a sanitized failure.

## Authentication

Production password hashes use bcrypt. Login returns a cryptographically random token in an HttpOnly, SameSite=Lax cookie (`Secure` under HTTPS); only the token hash is stored. Logout revokes the session. Local preview uses a signed, expiring, visibly labeled synthetic-role token so Next.js route isolation does not lose the preview; the key is intentionally non-secret because any local user may select any synthetic role. This mode is forbidden when `NODE_ENV=production`.

## Semantic and query model

Phase 1 registers one physical table and typed fields. Controlled calculations are metadata, not executable text. The architecture reserves measures and bookmark tables. Phase 2 adds tables, relationships, cardinality, filter direction, date tables, and a compiled expression tree without changing report visual query contracts.

## Deployment

The web process binds `0.0.0.0:3000`; the worker runs independently. IIS/HTTPS, Windows service hardening, monitoring, backup automation, and disaster recovery are Phase 4 gates. See `windows-deployment.md`.
