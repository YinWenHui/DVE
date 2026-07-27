import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authorizeApi, isAuthorizationError } from "@/lib/auth/server";
import { getMockStore, appendAudit } from "@/lib/mock-store";
import { retentionPolicySchema } from "@/lib/retention";
import { dataTypes, semanticTypes, aggregations } from "@/types";
import { repositories } from "@/repositories";

const fieldInput = z.object({
  sourceName: z.string().min(1).max(128), key: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/), displayName: z.string().min(1).max(128),
  dataType: z.enum(dataTypes), semanticType: z.enum(semanticTypes), defaultAggregation: z.enum(aggregations), formatString: z.string().max(50).optional(),
  hidden: z.boolean().default(false), filterable: z.boolean().default(true), sortable: z.boolean().default(true), ordinal: z.number().int().min(0),
});
const datasetInput = z.object({ name: z.string().trim().min(2).max(150), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().max(1_000).default(""), uploadId: z.string().uuid(), fields: z.array(fieldInput).min(1).max(500), retention: retentionPolicySchema.default({ mode: "permanent" }), refreshIntervalMinutes: z.number().int().min(5).max(10_080).default(5) });

export async function GET() {
  const auth = await authorizeApi("datasets:query"); if (isAuthorizationError(auth)) return auth;
  return Response.json({ datasets: await repositories.datasets.list(auth) });
}

export async function POST(request: Request) {
  const auth = await authorizeApi("admin:manage"); if (isAuthorizationError(auth)) return auth;
  const parsed = datasetInput.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: { code: "INVALID_DATASET", message: "Dataset metadata is invalid.", details: parsed.error.flatten() } }, { status: 400 });
  const store = getMockStore(); const pending = store.pendingImports.get(parsed.data.uploadId);
  if (!pending) return Response.json({ error: { code: "UPLOAD_EXPIRED", message: "The uploaded preview is unavailable. Upload the file again." } }, { status: 410 });
  if (store.datasets.some((dataset) => dataset.slug === parsed.data.slug)) return Response.json({ error: { code: "DUPLICATE_SLUG", message: "Dataset slug already exists." } }, { status: 409 });
  const id = randomUUID(); const now = new Date();
  const dataset = {
    id, name: parsed.data.name, slug: parsed.data.slug, description: parsed.data.description, sourceType: pending.sourceType, storageMode: "mock" as const,
    status: "healthy" as const, owner: auth.displayName, rowCount: pending.rows.length, lastSuccessfulRefresh: now.toISOString(),
    nextScheduledRefresh: new Date(now.getTime() + parsed.data.refreshIntervalMinutes * 60_000).toISOString(), sourceUpdatedAt: now.toISOString(), importedAt: now.toISOString(),
    refreshIntervalMinutes: parsed.data.refreshIntervalMinutes, staleAfterMinutes: Math.max(10, parsed.data.refreshIntervalMinutes * 2), retention: parsed.data.retention,
    fields: parsed.data.fields.map((field) => ({ ...field, id: randomUUID() })),
  };
  store.datasets.push(dataset); store.records.set(id, pending.rows); store.pendingImports.delete(parsed.data.uploadId);
  appendAudit("dataset.import", "dataset", id, auth.displayName, `Imported ${pending.rows.length} synthetic/local rows from ${pending.fileName}.`);
  return Response.json({ dataset }, { status: 201 });
}
