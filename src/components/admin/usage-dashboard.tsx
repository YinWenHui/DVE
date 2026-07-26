"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Clock3, Eye, Users } from "lucide-react";
import type { LocalReportUsage } from "@/lib/report-personalization";
import type { Report } from "@/types";

export function UsageDashboard({ reports }: { reports: Report[] }) {
  const [localUsage, setLocalUsage] = useState<LocalReportUsage[]>([]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try { setLocalUsage(JSON.parse(window.localStorage.getItem("dve:report-usage") ?? "[]") as LocalReportUsage[]); } catch { /* Local usage is supplemental. */ }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const localById = useMemo(() => new Map(localUsage.map((entry) => [entry.reportId, entry])), [localUsage]);
  const ordered = [...reports].sort((left, right) => (right.usage?.views30d ?? 0) - (left.usage?.views30d ?? 0));
  const maximum = Math.max(1, ...ordered.map((report) => report.usage?.views30d ?? 0));
  const totalViews = reports.reduce((total, report) => total + (report.usage?.views30d ?? 0), 0);
  const totalViewers = reports.reduce((total, report) => total + (report.usage?.uniqueViewers30d ?? 0), 0);
  return <>
    <div className="usage-stat-grid"><article><Eye size={18} /><div><strong>{totalViews.toLocaleString()}</strong><span>Views in 30 days</span></div></article><article><Users size={18} /><div><strong>{totalViewers.toLocaleString()}</strong><span>Report viewers</span></div></article><article><BadgeCheck size={18} /><div><strong>{reports.filter((report) => report.endorsement).length}</strong><span>Endorsed reports</span></div></article><article><Clock3 size={18} /><div><strong>{localUsage.reduce((total, entry) => total + entry.views, 0)}</strong><span>Views on this pilot PC</span></div></article></div>
    <section className="panel usage-panel"><div className="panel-header"><div><h2>Report usage</h2><p>Thirty-day engagement with supplemental activity recorded on this pilot PC.</p></div><span className="badge healthy">Frontend analytics</span></div><div className="usage-chart" aria-label="Report views chart">{ordered.map((report) => <div className="usage-chart-row" key={report.id}><span>{report.name}</span><div><i style={{ width: `${((report.usage?.views30d ?? 0) / maximum) * 100}%` }} /></div><strong>{report.usage?.views30d.toLocaleString()}</strong></div>)}</div></section>
    <section className="panel"><div className="panel-header"><div><h2>Content performance</h2><p>Ownership, endorsement, reach, and recent local activity.</p></div></div><table className="admin-table"><thead><tr><th>Report</th><th>Owner</th><th>Endorsement</th><th>Views</th><th>Viewers</th><th>Local opens</th><th>Last opened here</th></tr></thead><tbody>{ordered.map((report) => { const local = localById.get(report.id); return <tr key={report.id}><td><strong>{report.name}</strong><small>{report.description}</small></td><td>{report.owner}</td><td>{report.endorsement ? <span className={`endorsement ${report.endorsement}`}><BadgeCheck size={12} /> {report.endorsement}</span> : "—"}</td><td>{report.usage?.views30d.toLocaleString()}</td><td>{report.usage?.uniqueViewers30d.toLocaleString()}</td><td>{local?.views ?? 0}</td><td>{local ? new Date(local.lastViewedAt).toLocaleString() : "—"}</td></tr>; })}</tbody></table></section>
  </>;
}
