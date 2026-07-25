# Architecture decisions

## ADR-001: Next.js full-stack web process

Use App Router pages and route handlers for a compact Windows-deployable prototype. Keep server/client boundaries narrow and run refresh outside request handlers.

## ADR-002: SQL Server durability with mock adapters

SQL Server is the production system of record. Repository interfaces permit a process-local synthetic adapter for development/CI without SQL secrets. Mock mode is not production persistence.

## ADR-003: Single-table semantic model first

Deliver coherent governed fields, aggregations, filters, and reports before relationships. Reserve tables/relationships/reusable measures for an additive Phase 2 model.

## ADR-004: Controlled queries and calculations

Accept structured query metadata only. Compile registered identifiers and parameterized values. Do not execute browser SQL, JavaScript, DAX, or executable expression strings.

## ADR-005: Versioned imported data

Write each refresh to a new physical table/version, validate it, then atomically activate. Failure leaves the previous valid version accessible.

## ADR-006: Power Automate as Microsoft Lists bridge

Defer Graph integration. Use a machine-key endpoint and audited event/staging pattern so workflows remain independent of user passwords.

## ADR-007: No automatic PBIX import

Treat Power Query, DAX, pages, visuals, apps, and audiences as migration references requiring explicit reconstruction and validation.
