import { randomUUID } from "node:crypto";
import { authorizeApi, isAuthorizationError } from "@/lib/auth/server";
import { appendAudit, getMockStore } from "@/lib/mock-store";

export async function POST(_request: Request, { params }: { params: Promise<{ datasetId: string }> }) {
  const auth = await authorizeApi("datasets:query"); if (isAuthorizationError(auth)) return auth;
  const { datasetId } = await params; const store = getMockStore(); const dataset = store.datasets.find((candidate) => candidate.id === datasetId);
  if (!dataset) return Response.json({ error: { code: "NOT_FOUND", message: "Dataset not found." } }, { status: 404 });
  if (store.refreshRuns.some((run) => run.datasetId === datasetId && run.status === "running")) return Response.json({ error: { code: "REFRESH_IN_PROGRESS", message: "A refresh is already running for this dataset." } }, { status: 409 });
  const now = new Date(); const run = { id: randomUUID(), datasetId, status: "succeeded" as const, startedAt: now.toISOString(), completedAt: now.toISOString(), rowsWritten: dataset.rowCount };
  store.refreshRuns.unshift(run); dataset.status = "healthy"; dataset.lastSuccessfulRefresh = now.toISOString(); dataset.importedAt = now.toISOString(); dataset.nextScheduledRefresh = new Date(now.getTime() + dataset.refreshIntervalMinutes * 60_000).toISOString();
  appendAudit("dataset.refresh", "dataset", datasetId, auth.displayName, `Validated and retained ${dataset.rowCount} active rows.`);
  return Response.json({ run, dataset });
}
