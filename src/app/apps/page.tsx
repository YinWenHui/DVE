import Link from "next/link";
import { ArrowRight, LayoutGrid, Settings } from "lucide-react";
import { requirePageUser } from "@/lib/auth/server";
import { repositories } from "@/repositories";

export default async function AppsPage() {
  const user = await requirePageUser();
  const apps = await repositories.applications.list(user);
  return <main className="content-page">
    <header className="app-gallery-header">
      <div className="app-gallery-brand"><div className="brand-mark">DV</div><div><strong>Digital Verse</strong><span>Application gallery</span></div></div>
      {user.roles.includes("ADMINISTRATOR") && <Link className="button" href="/admin"><Settings size={16} /> Administration</Link>}
    </header>
    <div className="page-heading"><div><p className="eyebrow">Assigned workspace</p><h1>Your applications</h1><p>Published applications and reports available to {user.displayName}.</p></div></div>
    {apps.length ? <div className="app-grid">{apps.map((app) => <Link className="app-card" href={`/app/${app.slug}`} key={app.id}>
      <div className="app-card-top"><div className="brand-mark">{app.initials}</div><span className="badge published">{app.status}</span></div>
      <div><h2>{app.name}</h2><p>{app.description}</p></div>
      <div className="app-card-footer"><span><LayoutGrid size={14} /> {app.sections.reduce((count, section) => count + section.reportIds.length, 0)} reports</span><span>Open <ArrowRight size={14} /></span></div>
    </Link>)}</div> : <div className="empty-state">No published applications are assigned to your account.</div>}
  </main>;
}
