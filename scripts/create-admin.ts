import "dotenv/config";
import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import bcrypt from "bcryptjs";
import sql from "mssql";
import { createAdminInputSchema } from "../src/lib/validation/auth";

async function main(): Promise<void> {
const { values } = parseArgs({ options: { username: { type: "string" }, email: { type: "string" }, "display-name": { type: "string" } } });
const reader = createInterface({ input: stdin, output: stdout });
const username = values.username ?? await reader.question("Username: ");
const email = values.email ?? await reader.question("Email: ");
const displayName = values["display-name"] ?? await reader.question("Display name: ");
reader.close();

async function hiddenPassword(): Promise<string> {
  if (process.env.DVE_ADMIN_PASSWORD) return process.env.DVE_ADMIN_PASSWORD;
  if (!stdin.isTTY || !stdin.setRawMode) throw new Error("Set DVE_ADMIN_PASSWORD for a non-interactive administrator bootstrap.");
  stdout.write("Password (12+ characters): "); stdin.setRawMode(true); stdin.resume(); let value = "";
  return new Promise((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      const key = chunk.toString("utf8");
      if (key === "\u0003") { stdin.setRawMode(false); reject(new Error("Cancelled.")); return; }
      if (key === "\r" || key === "\n") { stdin.setRawMode(false); stdin.pause(); stdin.off("data", onData); stdout.write("\n"); resolve(value); return; }
      if (key === "\u007f" || key === "\b") { value = value.slice(0, -1); return; }
      value += key;
    };
    stdin.on("data", onData);
  });
}

const parsed = createAdminInputSchema.safeParse({ username, email, displayName, password: await hiddenPassword() });
if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "));
for (const key of ["SQL_SERVER", "SQL_DATABASE", "SQL_USERNAME", "SQL_PASSWORD"] as const) if (!process.env[key]) throw new Error(`${key} is required.`);
const passwordHash = await bcrypt.hash(parsed.data.password, 12);
const pool = await new sql.ConnectionPool({ server: process.env.SQL_SERVER ?? "", port: Number(process.env.SQL_PORT ?? 1433), database: process.env.SQL_DATABASE, user: process.env.SQL_USERNAME, password: process.env.SQL_PASSWORD, options: { encrypt: process.env.SQL_ENCRYPT !== "false", trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE === "true" } }).connect();
try {
  const transaction = new sql.Transaction(pool); await transaction.begin();
  try {
    const result = await new sql.Request(transaction).input("username", sql.NVarChar(100), parsed.data.username).input("email", sql.NVarChar(254), parsed.data.email).input("displayName", sql.NVarChar(150), parsed.data.displayName).input("passwordHash", sql.NVarChar(255), passwordHash).query<{ user_id: string }>("INSERT INTO dve.users (username, email, display_name, password_hash) OUTPUT inserted.user_id VALUES (@username, @email, @displayName, @passwordHash)");
    await new sql.Request(transaction).input("userId", sql.UniqueIdentifier, result.recordset[0].user_id).query("INSERT INTO dve.user_roles (user_id, role_id) SELECT @userId, role_id FROM dve.roles WHERE code = 'ADMINISTRATOR'");
    await transaction.commit(); console.log(`Administrator '${parsed.data.username}' created.`);
  } catch (error) { await transaction.rollback(); throw error; }
} finally { await pool.close(); }
}

void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Administrator creation failed"); process.exitCode = 1; });
