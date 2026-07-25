"use client";

import { useState } from "react";
import { Database, PlugZap } from "lucide-react";

export function DataSourceForm() {
  const [message, setMessage] = useState<string>(); const [busy, setBusy] = useState(false);
  async function test(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(undefined); const form = new FormData(event.currentTarget);
    const response = await fetch("/api/data-sources/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ server: form.get("server"), port: Number(form.get("port")), database: form.get("database"), username: form.get("username"), password: form.get("password"), encrypt: form.get("encrypt") === "on", trustServerCertificate: form.get("trust") === "on" }) });
    const payload = await response.json() as { message?: string; error?: { message?: string } }; setMessage(payload.message ?? payload.error?.message); setBusy(false);
  }
  return <form className="panel form-stack" onSubmit={test}><div className="panel-header"><div><h2>Microsoft SQL Server</h2><p>Administrators can test a connection, then select an approved table or view. Raw SQL is not accepted.</p></div><Database /></div><div className="form-grid"><label>Connection name<input name="name" required placeholder="Production reporting" /></label><label>Server<input name="server" required placeholder="sql-host.internal" /></label><label>Port<input name="port" type="number" defaultValue={1433} min={1} max={65535} /></label><label>Database<input name="database" required /></label><label>Username<input name="username" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="new-password" required /></label><label><span>Encryption</span><span><input name="encrypt" type="checkbox" defaultChecked /> Encrypt connection</span></label><label><span>Certificate</span><span><input name="trust" type="checkbox" /> Trust server certificate</span></label></div><div><button className="button primary" disabled={busy} type="submit"><PlugZap size={15} /> {busy ? "Testing…" : "Test connection"}</button></div>{message && <p className="status-banner">{message}</p>}<p className="muted">Credentials entered here are sent only to the server for this connection test. Saved source secrets require APP_ENCRYPTION_KEY and AES-256-GCM encryption.</p></form>;
}
