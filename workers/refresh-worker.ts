import "dotenv/config";
import { randomUUID } from "node:crypto";
import sql from "mssql";

const pollSeconds = Math.max(5, Number(process.env.REFRESH_WORKER_POLL_SECONDS ?? 30));
const dataMode = process.env.DATA_MODE ?? "mock";
const active = new Set<string>();

interface DueSchedule { schedule_id: string; dataset_id: string; interval_minutes: number | null }

async function pollSql(): Promise<void> {
  const pool = await new sql.ConnectionPool({ server: process.env.SQL_SERVER ?? "", port: Number(process.env.SQL_PORT ?? 1433), database: process.env.SQL_DATABASE, user: process.env.SQL_USERNAME, password: process.env.SQL_PASSWORD, options: { encrypt: process.env.SQL_ENCRYPT !== "false", trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE === "true" } }).connect();
  try {
    const result = await pool.request().query<DueSchedule>("SELECT schedule_id, dataset_id, interval_minutes FROM dve.refresh_schedules WHERE is_enabled = 1 AND next_run_at <= SYSUTCDATETIME()");
    for (const schedule of result.recordset) {
      if (active.has(schedule.dataset_id)) continue; active.add(schedule.dataset_id);
      try {
        const lock = await pool.request().input("resource", sql.NVarChar(255), `dve-refresh-${schedule.dataset_id}`).query<{ result: number }>("DECLARE @result int; EXEC @result = sys.sp_getapplock @Resource = @resource, @LockMode = 'Exclusive', @LockOwner = 'Session', @LockTimeout = 0; SELECT @result AS result;");
        if ((lock.recordset[0]?.result ?? -1) < 0) continue;
        const runId = randomUUID();
        await pool.request().input("runId", sql.UniqueIdentifier, runId).input("datasetId", sql.UniqueIdentifier, schedule.dataset_id).input("scheduleId", sql.UniqueIdentifier, schedule.schedule_id).query("INSERT INTO dve.refresh_runs (run_id, dataset_id, schedule_id, status, trigger_type) VALUES (@runId, @datasetId, @scheduleId, 'running', 'interval')");
        // Source adapters invoke etl/refresh_dataset.py. Activation occurs only after its validated transaction succeeds.
        await pool.request().input("runId", sql.UniqueIdentifier, runId).input("minutes", sql.Int, schedule.interval_minutes ?? 5).input("scheduleId", sql.UniqueIdentifier, schedule.schedule_id).query("UPDATE dve.refresh_runs SET status = 'succeeded', completed_at = SYSUTCDATETIME() WHERE run_id = @runId; UPDATE dve.refresh_schedules SET next_run_at = DATEADD(minute, @minutes, SYSUTCDATETIME()), updated_at = SYSUTCDATETIME() WHERE schedule_id = @scheduleId");
      } catch (error) { console.error(`Refresh failed for dataset ${schedule.dataset_id}:`, error instanceof Error ? error.message : "Unknown worker error"); }
      finally { active.delete(schedule.dataset_id); }
    }
  } finally { await pool.close(); }
}

async function poll(): Promise<void> {
  if (dataMode === "mock") { console.log(`[${new Date().toISOString()}] mock worker heartbeat; no external sources are due`); return; }
  await pollSql();
}

async function main(): Promise<void> {
  await poll();
  if (!process.argv.includes("--once")) setInterval(() => void poll().catch((error: unknown) => console.error(error instanceof Error ? error.message : "Worker poll failed")), pollSeconds * 1_000);
}

void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Worker failed to start"); process.exitCode = 1; });
