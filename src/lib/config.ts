import { z } from "zod";

const optionalBoolean = z.string().optional().transform((value) => value === "true");

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_TIMEZONE: z.string().default("Asia/Bangkok"),
  APP_ENCRYPTION_KEY: z.string().optional(),
  SESSION_COOKIE_NAME: z.string().min(1).default("dve_session"),
  SESSION_TTL_MINUTES: z.coerce.number().int().positive().max(10_080).default(480),
  AUTH_MODE: z.enum(["mock", "sql"]).optional(),
  DATA_MODE: z.enum(["mock", "sql"]).default("mock"),
  DVE_MAX_UPLOAD_MB: z.coerce.number().positive().max(250).default(25),
  DVE_MAX_QUERY_ROWS: z.coerce.number().int().positive().max(100_000).default(5_000),
  DVE_MAX_EXPORT_ROWS: z.coerce.number().int().positive().max(1_000_000).default(50_000),
  SQL_SERVER: z.string().optional(),
  SQL_PORT: z.coerce.number().int().positive().default(1433),
  SQL_DATABASE: z.string().optional(),
  SQL_USERNAME: z.string().optional(),
  SQL_PASSWORD: z.string().optional(),
  SQL_ENCRYPT: optionalBoolean,
  SQL_TRUST_SERVER_CERTIFICATE: optionalBoolean,
  DVE_INTEGRATION_KEY: z.string().min(24).optional(),
  REFRESH_WORKER_POLL_SECONDS: z.coerce.number().int().min(5).max(3_600).default(30),
});

const parsed = environmentSchema.parse(process.env);

export const config = {
  ...parsed,
  AUTH_MODE: parsed.AUTH_MODE ?? (parsed.NODE_ENV === "production" ? "sql" : "mock"),
};

export function assertProductionConfiguration(): void {
  if (config.NODE_ENV !== "production") return;
  if (config.AUTH_MODE === "mock") throw new Error("Mock authentication is disabled in production.");
  if (config.DATA_MODE === "sql" && (!config.SQL_SERVER || !config.SQL_DATABASE)) {
    throw new Error("SQL_SERVER and SQL_DATABASE are required when DATA_MODE=sql.");
  }
}
