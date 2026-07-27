import { config } from "@/lib/config";
import { getSqlPool } from "@/lib/db/pool";

export async function GET() {
  const checkedAt = new Date().toISOString();
  if (config.DATA_MODE === "mock") return Response.json({ status: "healthy", mode: "mock", checkedAt, database: "synthetic in-memory store" });
  try {
    await (await getSqlPool()).request().query("SELECT 1 AS healthy");
    return Response.json({ status: "healthy", mode: "sql", checkedAt, database: "available" });
  } catch {
    return Response.json({ status: "offline", mode: "sql", checkedAt, database: "unavailable" }, { status: 503 });
  }
}
