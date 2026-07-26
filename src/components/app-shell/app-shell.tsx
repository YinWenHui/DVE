"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  AppWindow, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Fullscreen, LayoutDashboard,
  LogOut, Moon, RefreshCw, Search, Settings, Sun,
} from "lucide-react";
import type { Dataset, DveApplication, Report, User } from "@/types";

interface AppShellProps {
  app: DveApplication;
  reports: Report[];
  activeReport: Report;
  dataset: Dataset;
  user: User;
  children: React.ReactNode;
}

export function AppShell({ app, reports, activeReport, dataset, user, children }: AppShellProps) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState(() => new Set(app.sections.filter((section) => !section.collapsedByDefault).map((section) => section.id)));
  const [query, setQuery] = useState("");
  const [seconds, setSeconds] = useState(dataset.refreshIntervalMinutes * 60);
  const [refreshing, setRefreshing] = useState(false);
  const [datasetSnapshot, setDatasetSnapshot] = useState(dataset);
  const [browserLoadedAt, setBrowserLoadedAt] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setBrowserLoadedAt(new Date().toISOString()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setSeconds((value) => value <= 1 ? dataset.refreshIntervalMinutes * 60 : value - 1), 1_000);
    return () => window.clearInterval(interval);
  }, [dataset.refreshIntervalMinutes]);

  const reportById = useMemo(() => new Map(reports.map((report) => [report.id, report])), [reports]);
  const visibleSections = app.sections.map((section) => ({
    ...section,
    reportIds: section.reportIds.filter((id) => reportById.get(id)?.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())),
  })).filter((section) => section.reportIds.length > 0);
  const initials = user.displayName.split(" ").map((part) => part[0]).slice(0, 2).join("");
  const isAdmin = user.roles.includes("ADMINISTRATOR");

  async function refresh() {
    setRefreshing(true);
    const response = await fetch(`/api/datasets/${dataset.id}/refresh`, { method: "POST" });
    if (response.ok) {
      const payload = await response.json() as { dataset: Dataset };
      setDatasetSnapshot(payload.dataset);
      setBrowserLoadedAt(new Date().toISOString());
      window.dispatchEvent(new Event("dve:browser-loaded"));
      window.dispatchEvent(new CustomEvent("dve:dataset-refreshed", { detail: payload.dataset }));
      setSeconds(dataset.refreshIntervalMinutes * 60);
    }
    setRefreshing(false);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function fullscreen() {
    const canvas = document.querySelector<HTMLElement>("[data-report-canvas]");
    if (!canvas) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await canvas.requestFullscreen();
  }

  function toggleSection(sectionId: string) {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId); else next.add(sectionId);
      return next;
    });
  }

  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${collapsed ? "collapsed" : ""}`} aria-label="Application navigation">
        <div className="sidebar-brand"><div className="brand-mark">{app.initials}</div><div className="sidebar-brand-copy"><strong>Digital Verse</strong><span>{app.name}</span></div></div>
        <div className="sidebar-scroll">
          <p className="sidebar-label">Report navigation</p>
          {visibleSections.map((section) => {
            const open = openSections.has(section.id) || Boolean(query);
            return <div className="nav-section" key={section.id}>
              <button className="nav-section-toggle" onClick={() => toggleSection(section.id)} aria-expanded={open}>
                <LayoutDashboard size={15} /><span>{section.name}</span>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {open && <div className="nav-report-list">
                {section.reportIds.map((id) => {
                  const report = reportById.get(id);
                  if (!report) return null;
                  return <Link title={report.name} className={`nav-report ${report.id === activeReport.id ? "active" : ""}`} href={`/app/${app.slug}/report/${report.slug}`} key={id}><AppWindow size={14} /><span>{report.name}</span></Link>;
                })}
              </div>}
            </div>;
          })}
        </div>
        <div className="sidebar-footer">
          {isAdmin && <Link href="/admin" className="admin-link"><Settings size={16} /><span>Administration</span></Link>}
          <div className="sidebar-profile"><div className="avatar">{initials}</div><div className="sidebar-profile-copy"><strong>{user.displayName}</strong><span>{user.roles.join(", ")}</span></div></div>
          <button className="icon-button sidebar-collapse" title={collapsed ? "Expand navigation" : "Collapse navigation"} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-title"><span>{app.name}</span><h1>{activeReport.name}</h1></div>
          <div className="topbar-actions">
            <div className="topbar-search"><Search size={15} /><input aria-label="Search reports" placeholder="Search reports" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
            <div className="freshness-pill"><i className="freshness-dot" /><div className="freshness-copy"><strong>{datasetSnapshot.status}</strong><span>Refresh in {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span></div></div>
            <button className="icon-button" title="Refresh now" onClick={refresh} disabled={refreshing}><RefreshCw size={16} className={refreshing ? "spin" : ""} /></button>
            <button className="icon-button" title="Fullscreen report" onClick={fullscreen}><Fullscreen size={16} /></button>
            <button className="icon-button" title="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}><span className="theme-icon theme-icon-light"><Moon size={16} /></span><span className="theme-icon theme-icon-dark"><Sun size={16} /></span></button>
            <button className="icon-button" title="Sign out" onClick={logout}><LogOut size={16} /></button>
          </div>
        </header>
        <div data-browser-loaded-at={browserLoadedAt}>{children}</div>
      </div>
    </div>
  );
}
