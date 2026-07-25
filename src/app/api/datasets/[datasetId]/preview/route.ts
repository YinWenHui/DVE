import { authorizeApi, isAuthorizationError } from "@/lib/auth/server";
import { repositories } from "@/repositories";

export async function GET(_request: Request, { params }: { params: Promise<{ datasetId: string }> }) {
  const auth = await authorizeApi("datasets:query"); if (isAuthorizationError(auth)) return auth;
  const { datasetId } = await params; const dataset = await repositories.datasets.findById(datasetId, auth);
  if (!dataset) return Response.json({ error: { code: "NOT_FOUND", message: "Dataset not found." } }, { status: 404 });
  const rows = await repositories.datasets.rows(datasetId, auth);
  return Response.json({ dataset, rows: rows.slice(0, 50) });
}
