import sql from "mssql";
import { z } from "zod";
import { authorizeApi, isAuthorizationError } from "@/lib/auth/server";

const connectionInput = z.object({ server: z.string().min(1).max(255), port: z.number().int().min(1).max(65_535).default(1433), database: z.string().min(1).max(128), username: z.string().min(1).max(128), password: z.string().min(1).max(256), encrypt: z.boolean().default(true), trustServerCertificate: z.boolean().default(false) });

export async function POST(request: Request) {
  const auth = await authorizeApi("admin:manage"); if (isAuthorizationError(auth)) return auth;
  const parsed = connectionInput.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: { code: "INVALID_CONNECTION", message: "Connection settings are invalid." } }, { status: 400 });
  const pool = new sql.ConnectionPool({ ...parsed.data, user: parsed.data.username, options: { encrypt: parsed.data.encrypt, trustServerCertificate: parsed.data.trustServerCertificate }, connectionTimeout: 10_000, requestTimeout: 10_000 });
  try {
    await pool.connect(); const result = await pool.request().query<{ database_name: string }>("SELECT DB_NAME() AS database_name");
    return Response.json({ ok: true, database: result.recordset[0]?.database_name, message: "Connection succeeded. Credentials were not retained." });
  } catch {
    return Response.json({ error: { code: "CONNECTION_FAILED", message: "Connection failed. Verify server access, credentials, encryption, and firewall settings." } }, { status: 400 });
  } finally { await pool.close().catch(() => undefined); }
}
