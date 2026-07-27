# Digital Verse database

Digital Verse uses SQL Server schemas `dve` (metadata and administration), `dve_data` (versioned imported tables), and `dve_audit` (audit events). Timestamps are stored in UTC and converted to `Asia/Bangkok` by the application.

Run migrations after configuring the `SQL_*` variables:

```powershell
npm run db:migrate
```

Migrations are ordered SQL files in `database/migrations`. The initializer records applied files in `dve.schema_migrations`. Do not modify an applied migration; add a new numbered migration.

No user account or password is seeded. Create the first administrator with `npm run create-admin`.
