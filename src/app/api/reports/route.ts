import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authorizeApi, isAuthorizationError } from "@/lib/auth/server";
import { appendAudit, getMockStore } from "@/lib/mock-store";
import { repositories } from "@/repositories";
import type { DrillthroughDefinition, ReportBookmarkDefinition, ReportControlDefinition, ReportFilterDefinition, ReportFormatPreset, ReportMobileLayoutDefinition, ReportPageCanvasOptions, ReportThemeDefinition, VisualDefinition, VisualInteractionDefinition } from "@/types";

const metadataRecord = z.record(z.string(), z.unknown());
const reportInput = z.object({ name: z.string().trim().min(2).max(120), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), datasetId: z.string().min(1), description: z.string().max(1_000).default(""), owner: z.string().trim().min(2).max(120).default("Digital Verse Platform Team"), endorsement: z.enum(["promoted", "certified"]).optional(), status: z.enum(["draft", "published", "archived"]).default("draft"), filters: z.array(metadataRecord).default([]), bookmarks: z.array(metadataRecord).default([]), theme: metadataRecord.optional(), formatPresets: z.array(metadataRecord).default([]), pages: z.array(z.object({ id: z.string(), name: z.string().min(1), ordinal: z.number().int(), hidden: z.boolean().optional(), drillthrough: z.object({ fields: z.array(z.string().min(1).max(128)).min(1).max(8), keepAllFilters: z.boolean().default(true) }).optional(), filters: z.array(metadataRecord).default([]), visuals: z.array(metadataRecord), controls: z.array(metadataRecord).default([]), interactions: z.array(metadataRecord).default([]), canvas: metadataRecord.optional(), mobileLayout: metadataRecord.optional() })).min(1) });

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
  const report = { id: randomUUID(), ...parsed.data, lastModifiedAt: new Date().toISOString(), minimumRole: "VIEWER" as const, filters: parsed.data.filters as unknown as ReportFilterDefinition[], bookmarks: parsed.data.bookmarks as unknown as ReportBookmarkDefinition[], theme: parsed.data.theme as unknown as ReportThemeDefinition | undefined, formatPresets: parsed.data.formatPresets as unknown as ReportFormatPreset[], pages: parsed.data.pages.map((page) => ({ ...page, canvas: page.canvas as unknown as ReportPageCanvasOptions | undefined, mobileLayout: page.mobileLayout as unknown as ReportMobileLayoutDefinition | undefined, drillthrough: page.drillthrough as unknown as DrillthroughDefinition | undefined, filters: page.filters as unknown as ReportFilterDefinition[], visuals: page.visuals as unknown as VisualDefinition[], controls: page.controls as unknown as ReportControlDefinition[], interactions: page.interactions as unknown as VisualInteractionDefinition[] })) };
  store.reports.push(report); appendAudit("report.create", "report", report.id, auth.displayName, `Created ${report.name}.`);
  return Response.json({ report }, { status: 201 });
}
