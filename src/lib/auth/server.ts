import "server-only";
import sql from "mssql";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { getSqlPool } from "@/lib/db/pool";
import { getMockStore, tokenHash } from "@/lib/mock-store";
import { hasAnyRole, hasPermission } from "@/lib/permissions";
import type { Permission, RoleCode, User } from "@/types";

export function isMockAuthenticationEnabled(): boolean {
  return config.AUTH_MODE === "mock" && config.NODE_ENV !== "production";
}

const previewKey = new TextEncoder().encode("digital-verse-local-preview-token-not-for-production");

export async function createMockSession(user: User): Promise<string> {
  if (!isMockAuthenticationEnabled()) throw new Error("Mock authentication is not available.");
  return new SignJWT({ mode: "mock-preview" }).setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuer("digital-verse-local-preview").setAudience("digital-verse").setIssuedAt().setExpirationTime(`${config.SESSION_TTL_MINUTES}m`).sign(previewKey);
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(config.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.NODE_ENV === "production",
    path: "/",
    maxAge: config.SESSION_TTL_MINUTES * 60,
    priority: "high",
  });
}

export async function revokeCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(config.SESSION_COOKIE_NAME)?.value;
  if (token && config.AUTH_MODE === "sql" && !isMockAuthenticationEnabled()) {
    try {
      await (await getSqlPool()).request().input("tokenHash", sql.VarChar(64), tokenHash(token)).query("UPDATE dve.sessions SET revoked_at = SYSUTCDATETIME() WHERE token_hash = @tokenHash AND revoked_at IS NULL");
    } catch {
      // Cookie deletion still fails closed if SQL Server is offline.
    }
  }
  store.delete(config.SESSION_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(config.SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  if (isMockAuthenticationEnabled()) {
    try {
      const verified = await jwtVerify(token, previewKey, { issuer: "digital-verse-local-preview", audience: "digital-verse" });
      if (verified.payload.mode !== "mock-preview" || !verified.payload.sub) return null;
      return getMockStore().users.find((user) => user.id === verified.payload.sub) ?? null;
    } catch {
      return null;
    }
  }
  if (config.AUTH_MODE !== "sql") return null;
  try {
    const result = await (await getSqlPool()).request().input("tokenHash", sql.VarChar(64), tokenHash(token)).query<{ user_id: string; username: string; email: string; display_name: string; role_code: RoleCode }>(
      "SELECT u.user_id, u.username, u.email, u.display_name, r.code AS role_code FROM dve.sessions s JOIN dve.users u ON u.user_id = s.user_id JOIN dve.user_roles ur ON ur.user_id = u.user_id JOIN dve.roles r ON r.role_id = ur.role_id WHERE s.token_hash = @tokenHash AND s.revoked_at IS NULL AND s.expires_at > SYSUTCDATETIME() AND u.is_active = 1",
    );
    if (!result.recordset.length) return null;
    const first = result.recordset[0];
    return { id: first.user_id, username: first.username, email: first.email, displayName: first.display_name, roles: [...new Set(result.recordset.map((row) => row.role_code))], isMock: false };
  } catch {
    return null;
  }
}

export async function requirePageUser(roles?: RoleCode[]): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !hasAnyRole(user, roles)) redirect("/apps?error=forbidden");
  return user;
}

export async function authorizeApi(permission: Permission): Promise<User | Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required." } }, { status: 401 });
  if (!hasPermission(user, permission)) {
    return Response.json({ error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." } }, { status: 403 });
  }
  return user;
}

export function isAuthorizationError(value: User | Response): value is Response {
  return value instanceof Response;
}
