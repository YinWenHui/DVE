"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, BarChart3, Clock3, LayoutGrid, Search, Sparkles, Star, TrendingUp, Users } from "lucide-react";
import { toggleFavorite, type LocalReportUsage, type RecentReportEntry } from "@/lib/report-personalization";
import type { DveApplication, Report } from "@/types";

type WorkspaceView = "home" | "favorites" | "recent";
type WorkspaceSort = "recommended" | "name" | "popular" | "updated";

export function WorkspaceGallery({ apps, reports, userName }: { apps: DveApplication[]; reports: Report[]; userName: string }) {
  const [view, setView] = useState<WorkspaceView>("home");
  const [sort, setSort] = useState<WorkspaceSort>("recommended");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<RecentReportEntry[]>([]);
  const [localUsage, setLocalUsage] = useState<LocalReportUsage[]>([]);
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setFavorites(JSON.parse(window.localStorage.getItem("dve:favorite-reports") ?? "[]") as string[]);
        setRecents(JSON.parse(window.localStorage.getItem("dve:recent-reports") ?? "[]") as RecentReportEntry[]);
        setLocalUsage(JSON.parse(window.localStorage.getItem("dve:report-usage") ?? "[]") as LocalReportUsage[]);
      } catch { /* Keep the assigned workspace available without personalization storage. */ }
      setClientReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const reportLocation = useMemo(() => {
    const location = new Map<string, { app: DveApplication; section: string }>();
    apps.forEach((app) => app.sections.forEach((section) => section.reportIds.forEach((reportId) => location.set(reportId, { app, section: section.name }))));
    return location;
  }, [apps]);
  const recentOrder = useMemo(() => new Map(recents.map((entry, index) => [entry.reportId, index])), [recents]);
  const usageById = useMemo(() => new Map(localUsage.map((entry) => [entry.reportId, entry])), [localUsage]);
  const visibleReports = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return reports.filter((report) => reportLocation.has(report.id))
      .filter((report) => !normalized || `${report.name} ${report.description} ${report.owner ?? ""}`.toLocaleLowerCase().includes(normalized))
      .filter((report) => view !== "favorites" || favorites.includes(report.id))
      .filter((report) => view !== "recent" || recentOrder.has(report.id))
      .sort((left, right) => {
        if (view === "recent") return (recentOrder.get(left.id) ?? 999) - (recentOrder.get(right.id) ?? 999);
        if (sort === "name") return left.name.localeCompare(right.name);
        if (sort === "popular") return (right.usage?.views30d ?? 0) - (left.usage?.views30d ?? 0);
        if (sort === "updated") return new Date(right.lastModifiedAt ?? 0).getTime() - new Date(left.lastModifiedAt ?? 0).getTime();
        const rank = (report: Report) => report.endorsement === "certified" ? 2 : report.endorsement === "promoted" ? 1 : 0;
        return rank(right) - rank(left) || (right.usage?.views30d ?? 0) - (left.usage?.views30d ?? 0);
      });
  }, [favorites, query, recentOrder, reportLocation, reports, sort, view]);

  function favorite(reportId: string) {
    const next = toggleFavorite(favorites, reportId);
    setFavorites(next);
    try { window.localStorage.setItem("dve:favorite-reports", JSON.stringify(next)); } catch { /* Keep session state. */ }
  }

  return <div className="workspace-gallery" data-client-ready={clientReady}>
    <div className="page-heading workspace-heading"><div><p className="eyebrow">Assigned workspace</p><h1>Good to see you, {userName.split(" ")[0]}</h1><p>Find certified content, return to recent work, and explore published applications.</p></div></div>
    <section className="workspace-hero"><div><span><Sparkles size={14} /> Digital Verse workspace</span><h2>Operational intelligence in one governed place.</h2><p>Search all reports assigned to you, keep favorites close, and continue where you left off.</p></div><div className="workspace-hero-stats"><strong>{reports.filter((report) => reportLocation.has(report.id)).length}<small>Reports</small></strong><strong>{reports.filter((report) => report.endorsement === "certified").length}<small>Certified</small></strong><strong>{apps.length}<small>Applications</small></strong></div></section>
    <section className="workspace-apps"><header><div><h2>Applications</h2><p>Curated collections published to your audiences.</p></div></header><div className="workspace-app-row">{apps.map((app) => <Link className="workspace-app-card" href={`/app/${app.slug}`} key={app.id}><div className="brand-mark">{app.initials}</div><div><strong>{app.name}</strong><span>{app.description}</span><small><LayoutGrid size={12} /> {app.sections.reduce((count, section) => count + section.reportIds.length, 0)} reports</small></div><ArrowRight size={16} /></Link>)}</div></section>
    <section className="workspace-library"><header><div><h2>Report library</h2><p>Endorsed, recent, and frequently used reporting content.</p></div><div className="workspace-library-controls"><label className="workspace-search"><Search size={14} /><input aria-label="Search workspace reports" placeholder="Search reports" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select aria-label="Sort workspace reports" value={sort} onChange={(event) => setSort(event.target.value as WorkspaceSort)}><option value="recommended">Recommended</option><option value="popular">Most viewed</option><option value="updated">Recently updated</option><option value="name">Name</option></select></div></header>
      <nav className="workspace-tabs" aria-label="Workspace report views"><button className={view === "home" ? "active" : ""} aria-pressed={view === "home"} onClick={() => setView("home")}><BarChart3 size={14} /> All reports</button><button className={view === "favorites" ? "active" : ""} aria-pressed={view === "favorites"} onClick={() => setView("favorites")}><Star size={14} /> Favorites <span>{favorites.length}</span></button><button className={view === "recent" ? "active" : ""} aria-pressed={view === "recent"} onClick={() => setView("recent")}><Clock3 size={14} /> Recent <span>{recents.length}</span></button></nav>
      <div className="workspace-report-grid">{visibleReports.map((report) => { const location = reportLocation.get(report.id)!; const local = usageById.get(report.id); return <article className="workspace-report-card" key={report.id}><div className="workspace-report-card-top"><span className="report-type-icon"><BarChart3 size={17} /></span><button className={`icon-button ${favorites.includes(report.id) ? "favorite" : ""}`} aria-label={`${favorites.includes(report.id) ? "Remove" : "Add"} ${report.name} ${favorites.includes(report.id) ? "from" : "to"} favorites`} aria-pressed={favorites.includes(report.id)} onClick={() => favorite(report.id)}><Star size={15} fill={favorites.includes(report.id) ? "currentColor" : "none"} /></button></div><Link href={`/app/${location.app.slug}/report/${report.slug}`}><div className="workspace-report-labels">{report.endorsement && <span className={`endorsement ${report.endorsement}`}><BadgeCheck size={12} /> {report.endorsement}</span>}<span>{location.section}</span></div><h3>{report.name}</h3><p>{report.description}</p><div className="workspace-report-meta"><span><TrendingUp size={12} /> {(report.usage?.views30d ?? 0).toLocaleString()} views</span><span><Users size={12} /> {report.usage?.uniqueViewers30d ?? 0} viewers</span>{local && <span><Clock3 size={12} /> Opened {local.views}× here</span>}</div><footer><span>{report.owner}</span><span>Open <ArrowRight size={13} /></span></footer></Link></article>; })}</div>
      {!visibleReports.length && <div className="empty-state">{view === "favorites" ? "No favorite reports yet. Use the star on a report to keep it here." : view === "recent" ? "Reports you open will appear here." : "No reports match your search."}</div>}
    </section>
  </div>;
}
