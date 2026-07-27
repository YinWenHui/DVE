"use client";

import { useState } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import type { RoleCode } from "@/types";

const previewRoles: Array<{ role: RoleCode; label: string; description: string }> = [
  { role: "VIEWER", label: "Viewer", description: "Assigned apps and reports" },
  { role: "SUPERVISOR", label: "Supervisor", description: "Comments and alert actions" },
  { role: "MANAGER", label: "Manager", description: "Management reporting" },
  { role: "ADMINISTRATOR", label: "Administrator", description: "Full prototype administration" },
];

export function LoginForm({ mockEnabled }: { mockEnabled: boolean }) {
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  async function preview(role: RoleCode) {
    setBusy(role);
    setError(undefined);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ previewRole: role }) });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: { message?: string } };
      setError(payload.error?.message ?? "Unable to start the preview session.");
      setBusy(undefined);
      return;
    }
    window.location.assign("/apps");
  }

  return (
    <section className="login-card" aria-labelledby="login-title">
      <div className="login-card-heading"><div className="brand-mark">DV</div><div><strong>Digital Verse</strong><span>Enterprise reporting workspace</span></div></div>
      <div><p className="eyebrow">Welcome</p><h2 id="login-title">Sign in to continue</h2><p className="muted">Use your Digital Verse account to access assigned applications.</p></div>
      {mockEnabled ? (
        <div className="mock-login">
          <div className="mock-banner"><ShieldCheck size={18} /><div><strong>Local preview mode</strong><span>Synthetic users and data only. This mode cannot run in production.</span></div></div>
          <div className="preview-role-list">
            {previewRoles.map((item) => (
              <form method="post" action="/api/auth/login" key={item.role}>
                <input type="hidden" name="previewRole" value={item.role} />
                <button type="submit" className="preview-role" onClick={(event) => { event.preventDefault(); void preview(item.role); }} disabled={Boolean(busy)}>
                  <span><strong>{item.label}</strong><small>{item.description}</small></span>
                  <ArrowRight size={17} aria-hidden />
                </button>
              </form>
            ))}
          </div>
        </div>
      ) : (
        <form className="form-stack" method="post" action="/api/auth/login">
          <label>Username<input name="username" autoComplete="username" required minLength={3} /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required minLength={12} /></label>
          <button className="button primary" type="submit"><LockKeyhole size={17} /> Sign in</button>
        </form>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="login-security"><LockKeyhole size={14} /> Sessions use HttpOnly cookies; credentials are never stored in this interface.</p>
    </section>
  );
}
