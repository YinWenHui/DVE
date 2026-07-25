import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authorizeApi, isAuthorizationError } from "@/lib/auth/server";
import { appendAudit, getMockStore } from "@/lib/mock-store";
import { repositories } from "@/repositories";

const appInput = z.object({ name: z.string().trim().min(2).max(120), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().max(1_000), sections: z.array(z.object({ id: z.string(), name: z.string().min(1), reportIds: z.array(z.string()), ordinal: z.number().int(), collapsedByDefault: z.boolean() })).min(1), defaultReportId: z.string().min(1), status: z.enum(["draft", "published", "archived"]).default("draft") });

export async function GET() {
  const auth = await authorizeApi("apps:read"); if (isAuthorizationError(auth)) return auth;
  return Response.json({ apps: await repositories.applications.list(auth) });
}

export async function POST(request: Request) {
  const auth = await authorizeApi("admin:manage"); if (isAuthorizationError(auth)) return auth;
  const parsed = appInput.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: { code: "INVALID_APP", message: "Application metadata is invalid.", details: parsed.error.flatten() } }, { status: 400 });
  const store = getMockStore();
  if (parsed.data.status === "published" && parsed.data.sections.every((section) => section.reportIds.length === 0)) return Response.json({ error: { code: "EMPTY_APP", message: "A published application must contain at least one report." } }, { status: 400 });
  if (store.apps.some((app) => app.slug === parsed.data.slug)) return Response.json({ error: { code: "DUPLICATE_SLUG", message: "Application slug already exists." } }, { status: 409 });
  const reportIds = new Set(store.reports.map((report) => report.id));
  if (parsed.data.sections.flatMap((section) => section.reportIds).some((id) => !reportIds.has(id))) return Response.json({ error: { code: "INVALID_REPORT", message: "An application report does not exist." } }, { status: 400 });
  const app = { id: randomUUID(), ...parsed.data, initials: parsed.data.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase(), publisher: auth.displayName, publishedAt: parsed.data.status === "published" ? new Date().toISOString() : undefined, audiences: [] };
  store.apps.push(app); appendAudit("app.create", "application", app.id, auth.displayName, `Created ${app.name}.`);
  return Response.json({ app }, { status: 201 });
}
