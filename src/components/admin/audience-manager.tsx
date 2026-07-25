"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { DveApplication, Report, RoleCode } from "@/types";

export function AudienceManager({ apps, reports }: { apps: DveApplication[]; reports: Report[] }) {
  const [appId, setAppId] = useState(apps[0]?.id ?? ""); const [name, setName] = useState(""); const [role, setRole] = useState<RoleCode>("VIEWER"); const [reportIds, setReportIds] = useState<string[]>([]); const [message, setMessage] = useState<string>();
  async function create(event: React.FormEvent) { event.preventDefault(); const response = await fetch("/api/audiences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appId, name, roles: [role], reportIds }) }); const payload = await response.json() as { error?: { message?: string } }; setMessage(response.ok ? "Audience created." : payload.error?.message ?? "Unable to create audience."); }
  return <section className="panel"><div className="panel-header"><div><h2>Create audience</h2><p>Assign users or roles to a controlled report set.</p></div></div><form className="form-grid" onSubmit={create}><label>Application<select value={appId} onChange={(event) => setAppId(event.target.value)}>{apps.map((app) => <option value={app.id} key={app.id}>{app.name}</option>)}</select></label><label>Audience name<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} /></label><label>Role<select value={role} onChange={(event) => setRole(event.target.value as RoleCode)}><option>VIEWER</option><option>SUPERVISOR</option><option>MANAGER</option><option>ADMINISTRATOR</option></select></label><label>Visible reports<select multiple value={reportIds} onChange={(event) => setReportIds([...event.target.selectedOptions].map((option) => option.value))} size={6}>{reports.map((report) => <option value={report.id} key={report.id}>{report.name}</option>)}</select></label><div className="full"><button className="button primary" type="submit"><Plus size={14} /> Create audience</button></div></form>{message && <p className="status-banner" style={{ marginTop: 12 }}>{message}</p>}</section>;
}
