import { z } from "zod";
import { authorizeApi, isAuthorizationError } from "@/lib/auth/server";
import { appendAudit, getMockStore } from "@/lib/mock-store";

const input = z.object({ comment: z.string().trim().min(2).max(1_000) });

export async function POST(request: Request, { params }: { params: Promise<{ alertId: string }> }) {
  const auth = await authorizeApi("alerts:acknowledge"); if (isAuthorizationError(auth)) return auth;
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: { code: "INVALID_ACKNOWLEDGEMENT", message: "Add an acknowledgement comment." } }, { status: 400 });
  const { alertId } = await params; const alert = getMockStore().alerts.find((candidate) => candidate.id === alertId);
  if (!alert) return Response.json({ error: { code: "NOT_FOUND", message: "Alert event not found." } }, { status: 404 });
  if (alert.status === "resolved") return Response.json({ error: { code: "ALREADY_RESOLVED", message: "Resolved alerts cannot be acknowledged." } }, { status: 409 });
  alert.status = "acknowledged"; alert.acknowledgement = { userId: auth.id, userDisplayName: auth.displayName, comment: parsed.data.comment, acknowledgedAt: new Date().toISOString() };
  appendAudit("alert.acknowledge", "alert", alert.id, auth.displayName, parsed.data.comment);
  return Response.json({ alert });
}
