import "server-only";
import sql from "mssql";
import { config } from "@/lib/config";

declare global {
  var __digitalVerseSqlPool: Promise<sql.ConnectionPool> | undefined;
}

export function sqlConfigured(): boolean {
  return Boolean(config.SQL_SERVER && config.SQL_DATABASE && config.SQL_USERNAME && config.SQL_PASSWORD);
}

export async function getSqlPool(): Promise<sql.ConnectionPool> {
  if (!sqlConfigured()) throw new Error("SQL Server is not configured.");
  globalThis.__digitalVerseSqlPool ??= new sql.ConnectionPool({
    server: config.SQL_SERVER ?? "",
    port: config.SQL_PORT,
    database: config.SQL_DATABASE,
    user: config.SQL_USERNAME,
    password: config.SQL_PASSWORD,
    options: {
      encrypt: config.SQL_ENCRYPT,
      trustServerCertificate: config.SQL_TRUST_SERVER_CERTIFICATE,
      enableArithAbort: true,
    },
    pool: { min: 0, max: 10, idleTimeoutMillis: 30_000 },
    requestTimeout: 30_000,
    connectionTimeout: 15_000,
  }).connect();
  return globalThis.__digitalVerseSqlPool;
}
