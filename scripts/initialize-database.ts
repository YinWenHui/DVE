import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import sql from "mssql";

async function main(): Promise<void> {
const required = ["SQL_SERVER", "SQL_DATABASE", "SQL_USERNAME", "SQL_PASSWORD"] as const;
for (const name of required) if (!process.env[name]) throw new Error(`${name} is required.`);

const pool = await new sql.ConnectionPool({
  server: process.env.SQL_SERVER ?? "",
  port: Number(process.env.SQL_PORT ?? 1433),
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USERNAME,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: process.env.SQL_ENCRYPT !== "false", trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE === "true", enableArithAbort: true },
}).connect();

try {
  await pool.request().query("IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'dve') EXEC('CREATE SCHEMA dve'); IF OBJECT_ID('dve.schema_migrations') IS NULL CREATE TABLE dve.schema_migrations (migration_name nvarchar(260) NOT NULL PRIMARY KEY, applied_at datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME());");
  const migrationDirectory = path.join(process.cwd(), "database", "migrations");
  const files = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const exists = await pool.request().input("name", sql.NVarChar(260), file).query<{ migration_name: string }>("SELECT migration_name FROM dve.schema_migrations WHERE migration_name = @name");
    if (exists.recordset.length) { console.log(`skip ${file}`); continue; }
    const source = await readFile(path.join(migrationDirectory, file), "utf8");
    const batches = source.split(/^\s*GO\s*$/gim).filter((batch) => batch.trim());
    for (const batch of batches) await pool.request().batch(batch);
    await pool.request().input("name", sql.NVarChar(260), file).query("INSERT INTO dve.schema_migrations (migration_name) VALUES (@name)");
    console.log(`applied ${file}`);
  }
} finally {
  await pool.close();
}
}

void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Database initialization failed"); process.exitCode = 1; });
