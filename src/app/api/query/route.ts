import { authorizeApi, isAuthorizationError } from "@/lib/auth/server";
import { config } from "@/lib/config";
import { executeInMemoryQuery } from "@/lib/query-engine/engine";
import { queryRequestSchema } from "@/lib/query-engine/schema";
import { repositories } from "@/repositories";

export async function POST(request: Request) {
  const auth = await authorizeApi("datasets:query"); if (isAuthorizationError(auth)) return auth;
  const parsed = queryRequestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: { code: "INVALID_QUERY", message: "Query request is invalid.", details: parsed.error.flatten() } }, { status: 400 });
  const dataset = await repositories.datasets.findById(parsed.data.datasetId, auth);
  if (!dataset) return Response.json({ error: { code: "DATASET_NOT_FOUND", message: "Dataset not found or access is denied." } }, { status: 404 });
  const rows = await repositories.datasets.rows(dataset.id, auth);
  try {
    const safeRequest = { ...parsed.data, limit: Math.min(parsed.data.limit, config.DVE_MAX_QUERY_ROWS) };
    const result = executeInMemoryQuery(dataset, rows, safeRequest);
    return Response.json({ rows: result, rowCount: result.length, truncated: result.length === safeRequest.limit, importedAt: dataset.importedAt, sourceUpdatedAt: dataset.sourceUpdatedAt });
  } catch (error) {
    return Response.json({ error: { code: "QUERY_REJECTED", message: error instanceof Error ? error.message : "The query could not be executed." } }, { status: 400 });
  }
}
