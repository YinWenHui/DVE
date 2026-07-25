import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser, isMockAuthenticationEnabled } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/apps");
  return (
    <main className="login-page">
      <section className="login-brand-panel" aria-label="Digital Verse introduction">
        <div className="brand-mark brand-mark-large">DV</div>
        <p className="eyebrow">Internal business intelligence</p>
        <h1>See the whole operation.<br />Act on what matters.</h1>
        <p>Digital Verse brings reports, application navigation, refresh monitoring, and controlled self-service analytics into one self-hosted workspace.</p>
        <div className="login-feature-row"><span>Live refresh state</span><span>Audience-aware access</span><span>Secure exports</span></div>
      </section>
      <LoginForm mockEnabled={isMockAuthenticationEnabled()} />
    </main>
  );
}
