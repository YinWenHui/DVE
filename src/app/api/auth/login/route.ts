import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import sql from "mssql";
import { config } from "@/lib/config";
import { createMockSession, isMockAuthenticationEnabled, setSessionCookie } from "@/lib/auth/server";
import { getSqlPool } from "@/lib/db/pool";
import { getMockStore } from "@/lib/mock-store";
import { loginInputSchema } from "@/lib/validation/auth";

async function inputFromRequest(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return request.json();
  const form = await request.formData();
  const previewRole = form.get("previewRole");
  return previewRole ? { previewRole } : { username: form.get("username"), password: form.get("password") };
}

export async function POST(request: Request) {
  const parsed = loginInputSchema.safeParse(await inputFromRequest(request));
  if (!parsed.success) return Response.json({ error: { code: "INVALID_LOGIN", message: "Enter a valid username and password." } }, { status: 400 });
  if ("previewRole" in parsed.data) {
    if (!isMockAuthenticationEnabled()) return Response.json({ error: { code: "MOCK_DISABLED", message: "Preview sessions are unavailable." } }, { status: 403 });
    const previewRole = parsed.data.previewRole;
    const user = getMockStore().users.find((candidate) => candidate.roles.includes(previewRole));
    if (!user) return Response.json({ error: { code: "USER_NOT_FOUND", message: "The synthetic preview user is unavailable." } }, { status: 404 });
    await setSessionCookie(await createMockSession(user));
    if (!(request.headers.get("content-type") ?? "").includes("application/json")) return new Response(null, { status: 303, headers: { Location: "/apps" } });
    return Response.json({ user });
  }
  if (config.AUTH_MODE !== "sql") return Response.json({ error: { code: "PASSWORD_LOGIN_DISABLED", message: "Password login requires SQL authentication mode." } }, { status: 403 });
  const pool = await getSqlPool();
  const result = await pool.request().input("username", sql.NVarChar(100), parsed.data.username).query<{ user_id: string; username: string; email: string; display_name: string; password_hash: string; is_active: boolean; locked_until: Date | null }>(
    "SELECT user_id, username, email, display_name, password_hash, is_active, locked_until FROM dve.users WHERE username = @username",
  );
  const record = result.recordset[0];
  const locked = Boolean(record?.locked_until && record.locked_until > new Date());
  const passwordValid = record && record.is_active && !locked ? await bcrypt.compare(parsed.data.password, record.password_hash) : false;
  if (!record || !record.is_active || locked || !passwordValid) {
    if (record?.is_active && !locked) {
      await pool.request().input("userId", sql.UniqueIdentifier, record.user_id).query("UPDATE dve.users SET failed_login_count = failed_login_count + 1, locked_until = CASE WHEN failed_login_count + 1 >= 5 THEN DATEADD(minute, 15, SYSUTCDATETIME()) ELSE locked_until END, updated_at = SYSUTCDATETIME() WHERE user_id = @userId");
    }
    return Response.json({ error: { code: "INVALID_LOGIN", message: "The username or password is incorrect." } }, { status: 401 });
  }
  const rawToken = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(rawToken).digest("hex");
  const expires = new Date(Date.now() + config.SESSION_TTL_MINUTES * 60_000);
  await pool.request().input("userId", sql.UniqueIdentifier, record.user_id).input("tokenHash", sql.VarChar(64), hash).input("expiresAt", sql.DateTime2, expires)
    .query("INSERT INTO dve.sessions (session_id, user_id, token_hash, expires_at, created_at) VALUES (NEWID(), @userId, @tokenHash, @expiresAt, SYSUTCDATETIME()); UPDATE dve.users SET last_login_at = SYSUTCDATETIME(), failed_login_count = 0 WHERE user_id = @userId;");
  await setSessionCookie(rawToken);
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) return new Response(null, { status: 303, headers: { Location: "/apps" } });
  return Response.json({ user: { id: record.user_id, username: record.username, email: record.email, displayName: record.display_name } });
}
