import { z } from "zod";
import { authorizeApi, isAuthorizationError } from "@/lib/auth/server";
import { appendAudit, getMockStore } from "@/lib/mock-store";
import type { ReportBookmarkDefinition, ReportFormatPreset, ReportPage, ReportThemeDefinition } from "@/types";

const input = z.object({ name: z.string().min(2), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), datasetId: z.string().min(1), description: z.string(), status: z.enum(["draft", "published", "archived"]), filters: z.array(z.unknown()).default([]), bookmarks: z.array(z.unknown()).default([]), theme: z.record(z.string(), z.unknown()).optional(), formatPresets: z.array(z.unknown()).default([]), pages: z.array(z.unknown()).min(1) });
export async function PUT(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const auth = await authorizeApi("admin:manage"); if (isAuthorizationError(auth)) return auth; const parsed = input.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: { code: "INVALID_REPORT", message: "Report metadata is invalid." } }, { status: 400 });
  const { reportId } = await params; const store = getMockStore(); const report = store.reports.find((item) => item.id === reportId); if (!report) return Response.json({ error: { code: "NOT_FOUND", message: "Report not found." } }, { status: 404 });
  if (store.reports.some((item) => item.id !== reportId && item.slug === parsed.data.slug)) return Response.json({ error: { code: "DUPLICATE_SLUG", message: "Report slug already exists." } }, { status: 409 });
  Object.assign(report, { ...parsed.data, bookmarks: parsed.data.bookmarks as ReportBookmarkDefinition[], theme: parsed.data.theme as unknown as ReportThemeDefinition | undefined, formatPresets: parsed.data.formatPresets as ReportFormatPreset[], pages: parsed.data.pages as ReportPage[] }); appendAudit("report.update", "report", report.id, auth.displayName, `Updated ${report.name}.`); return Response.json({ report });
}
