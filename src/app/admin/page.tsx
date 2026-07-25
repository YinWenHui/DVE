import Link from "next/link";
import { AlertTriangle, ArrowRight, Database, FileBarChart, RefreshCw, Users } from "lucide-react";
import { getMockStore } from "@/lib/mock-store";

export default function AdminOverviewPage() {
  const store = getMockStore(); const openAlerts = store.alerts.filter((alert) => alert.status === "open").length;
  return <><div className="page-heading"><div><p className="eyebrow">Control plane</p><h1>Administration overview</h1><p>Platform health, content inventory, and recent operational activity.</p></div><span className="badge healthy">Mock services healthy</span></div>
    <section className="stat-grid">
      <div className="stat-card"><span>Datasets</span><strong>{store.datasets.length}</strong><small><Database size={13} /> {store.datasets.reduce((sum, item) => sum + item.rowCount, 0).toLocaleString()} active rows</small></div>
      <div className="stat-card"><span>Published reports</span><strong>{store.reports.filter((item) => item.status === "published").length}</strong><small><FileBarChart size={13} /> Across {store.apps.length} application</small></div>
      <div className="stat-card"><span>Registered users</span><strong>{store.users.length}</strong><small><Users size={13} /> Four prototype roles</small></div>
      <div className="stat-card"><span>Open alerts</span><strong>{openAlerts}</strong><small><AlertTriangle size={13} /> Requires operational review</small></div>
    </section>
    <section className="panel"><div className="panel-header"><div><h2>Dataset freshness</h2><p>Current validated versions remain active when a refresh fails.</p></div><Link className="button" href="/admin/refresh">Refresh monitor <ArrowRight size={14} /></Link></div>
      <table className="admin-table"><thead><tr><th>Dataset</th><th>Status</th><th>Rows</th><th>Last success</th><th>Next run</th></tr></thead><tbody>{store.datasets.map((dataset) => <tr key={dataset.id}><td><strong>{dataset.name}</strong><small>{dataset.sourceType}</small></td><td><span className={`badge ${dataset.status}`}>{dataset.status}</span></td><td>{dataset.rowCount.toLocaleString()}</td><td>{new Date(dataset.lastSuccessfulRefresh).toLocaleString()}</td><td>{new Date(dataset.nextScheduledRefresh).toLocaleString()}</td></tr>)}</tbody></table>
    </section>
    <section className="panel"><div className="panel-header"><div><h2>Recent audit activity</h2><p>Security-sensitive and content-changing events.</p></div><Link className="button" href="/admin/audit">Full audit log <ArrowRight size={14} /></Link></div>
      {store.audit.slice(0, 5).map((record) => <div className="alert-row" key={record.id}><RefreshCw size={15} /><div><h3>{record.action}</h3><p>{record.details} · {record.userDisplayName}</p></div><small>{new Date(record.createdAt).toLocaleString()}</small></div>)}
    </section>
  </>;
}
