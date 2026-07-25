import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authorizeApi, isAuthorizationError } from "@/lib/auth/server";
import { appendAudit, getMockStore } from "@/lib/mock-store";
import { repositories } from "@/repositories";

const reportInput = z.object({ name: z.string().trim().min(2).max(120), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), datasetId: z.string().min(1), description: z.string().max(1_000).default(""), status: z.enum(["draft", "published", "archived"]).default("draft"), pages: z.array(z.object({ id: z.string(), name: z.string().min(1), ordinal: z.number().int(), visuals: z.array(z.record(z.string(), z.unknown())) })).min(1) });

export async function GET() {
  const auth = await authorizeApi("reports:read"); if (isAuthorizationError(auth)) return auth;
  return Response.json({ reports: await repositories.reports.list(auth) });
}

export async function POST(request: Request) {
  const auth = await authorizeApi("admin:manage"); if (isAuthorizationError(auth)) return auth;
  const parsed = reportInput.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: { code: "INVALID_REPORT", message: "Report metadata is invalid.", details: parsed.error.flatten() } }, { status: 400 });
  const store = getMockStore();
  if (!store.datasets.some((dataset) => dataset.id === parsed.data.datasetId)) return Response.json({ error: { code: "DATASET_NOT_FOUND", message: "The selected dataset does not exist." } }, { status: 400 });
  if (store.reports.some((report) => report.slug === parsed.data.slug)) return Response.json({ error: { code: "DUPLICATE_SLUG", message: "Report slug already exists." } }, { status: 409 });
  const report = { id: randomUUID(), ...parsed.data, minimumRole: "VIEWER" as const, pages: parsed.data.pages.map((page) => ({ ...page, visuals: page.visuals as unknown as import("@/types").VisualDefinition[] })) };
  store.reports.push(report); appendAudit("report.create", "report", report.id, auth.displayName, `Created ${report.name}.`);
  return Response.json({ report }, { status: 201 });
}
