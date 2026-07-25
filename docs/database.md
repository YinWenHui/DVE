# Database design

## Schemas

- `dve`: roles, users, sessions, sources, datasets, fields, versions, measures, reports/pages/visuals, apps/sections/content/audiences, schedules/runs, alerts, comments, bookmarks, and migration history.
- `dve_data`: imported dataset-version tables with safe internal names.
- `dve_audit`: append-oriented audit records.

The first migration defines primary/foreign/unique constraints and indexes for session expiry, datasets, active versions, due schedules, refresh history, open alerts, comments, and audit time. Roles are seeded; users and credentials are never seeded.

## Imported versions

Physical names derive from a dataset UUID and batch UUID, not display text. Every table includes `__row_id`, `__import_batch_id`, `__imported_at`, and `__source_row_number`. The version row stores a SHA-256 schema hash, row count, source timestamp, import timestamp, and active flag. A filtered unique index allows one active version per dataset.

## Migration process

1. Back up the database.
2. Set the `SQL_*` environment variables for a migration principal.
3. Run `npm run db:migrate`.
4. The initializer executes unapplied numbered SQL files and records them in `dve.schema_migrations`.
5. Review output and application health before removing the backup window.

Never edit an applied migration. Add the next numbered file. Test upgrade and rollback/recovery on a non-production database.

## Administrator bootstrap

Run `npm run create-admin -- --username <name> --email <email> --display-name <display>`. The password is read without echo; automation may provide the transient `DVE_ADMIN_PASSWORD` environment variable. It is hashed with bcrypt before the transactional user/role insert and is never logged.

## Runtime SQL permissions

Use a dedicated login with only the DML and controlled DDL required for metadata and version imports. Normal web users never receive SQL credentials. Consider separate identities for migrations, web runtime, and ETL. Deny unrestricted access to source databases and expose approved tables/views only.
