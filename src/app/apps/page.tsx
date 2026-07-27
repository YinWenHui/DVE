import Link from "next/link";
import { Settings } from "lucide-react";
import { WorkspaceGallery } from "@/components/workspace/workspace-gallery";
import { requirePageUser } from "@/lib/auth/server";
import { repositories } from "@/repositories";

export default async function AppsPage() {
  const user = await requirePageUser();
  const apps = await repositories.applications.list(user);
  const reports = await repositories.reports.list(user);
  return <main className="content-page">
    <header className="app-gallery-header">
      <div className="app-gallery-brand"><div className="brand-mark">DV</div><div><strong>Digital Verse</strong><span>Application gallery</span></div></div>
      {user.roles.includes("ADMINISTRATOR") && <Link className="button" href="/admin"><Settings size={16} /> Administration</Link>}
    </header>
    {apps.length ? <WorkspaceGallery apps={apps} reports={reports} userName={user.displayName} /> : <div className="empty-state">No published applications are assigned to your account.</div>}
  </main>;
}
