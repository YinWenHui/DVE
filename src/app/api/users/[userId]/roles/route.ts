import { z } from "zod";
import { authorizeApi, isAuthorizationError } from "@/lib/auth/server";
import { appendAudit, getMockStore } from "@/lib/mock-store";
import { roleCodes } from "@/types";
const input = z.object({ roles: z.array(z.enum(roleCodes)).min(1).max(4) });
export async function PUT(request: Request, { params }: { params: Promise<{ userId: string }> }) { const auth = await authorizeApi("admin:manage"); if (isAuthorizationError(auth)) return auth; const parsed = input.safeParse(await request.json()); if (!parsed.success) return Response.json({ error: { code: "INVALID_ROLES", message: "Role assignment is invalid." } }, { status: 400 }); const { userId } = await params; const user = getMockStore().users.find((item) => item.id === userId); if (!user) return Response.json({ error: { code: "NOT_FOUND", message: "User not found." } }, { status: 404 }); user.roles = [...new Set(parsed.data.roles)]; appendAudit("user.roles.update", "user", user.id, auth.displayName, `Assigned ${user.roles.join(", ")}.`); return Response.json({ user }); }
