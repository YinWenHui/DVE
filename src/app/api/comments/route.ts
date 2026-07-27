import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authorizeApi, isAuthorizationError } from "@/lib/auth/server";
import { appendAudit, getMockStore } from "@/lib/mock-store";

const commentInput = z.object({ entityType: z.enum(["report", "report-page", "alert", "business-record"]), entityId: z.string().min(1).max(200), body: z.string().trim().min(2).max(2_000) });

export async function GET(request: Request) {
  const auth = await authorizeApi("reports:read"); if (isAuthorizationError(auth)) return auth;
  const url = new URL(request.url); const entityType = url.searchParams.get("entityType"); const entityId = url.searchParams.get("entityId");
  const comments = getMockStore().comments.filter((comment) => (!entityType || comment.entityType === entityType) && (!entityId || comment.entityId === entityId));
  return Response.json({ comments });
}

export async function POST(request: Request) {
  const auth = await authorizeApi("comments:create"); if (isAuthorizationError(auth)) return auth;
  const parsed = commentInput.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: { code: "INVALID_COMMENT", message: "Comment is invalid.", details: parsed.error.flatten() } }, { status: 400 });
  const comment = { id: randomUUID(), ...parsed.data, userId: auth.id, userDisplayName: auth.displayName, createdAt: new Date().toISOString() };
  getMockStore().comments.unshift(comment); appendAudit("comment.create", parsed.data.entityType, parsed.data.entityId, auth.displayName, "Added a comment.");
  return Response.json({ comment }, { status: 201 });
}
