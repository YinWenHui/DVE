"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, AppWindow, BarChart3, Bell, ChevronLeft, Database, FileBarChart, Gauge, History, LayoutDashboard,
  Settings, ShieldCheck, Users, Workflow,
} from "lucide-react";

const navigation = [
  ["/admin", "Overview", Gauge], ["/admin/datasets", "Datasets", Database], ["/admin/data-sources", "Data Sources", Workflow],
  ["/admin/reports", "Reports", FileBarChart], ["/admin/apps", "Applications", AppWindow], ["/admin/audiences", "Audiences", ShieldCheck],
  ["/admin/users", "Users", Users], ["/admin/refresh", "Refresh Monitor", Activity], ["/admin/alerts", "Alerts", Bell],
  ["/admin/usage", "Usage Analytics", BarChart3], ["/admin/audit", "Audit Log", History], ["/admin/settings", "System Settings", Settings],
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className="admin-shell">
    <aside className="admin-sidebar"><div className="admin-brand"><div className="brand-mark">DV</div><div><strong>Administration</strong><span>Digital Verse control plane</span></div></div>
      <nav className="admin-nav" aria-label="Administration">{navigation.map(([href, label, Icon]) => <Link href={href} key={href} className={pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`)) ? "active" : ""}><Icon size={16} />{label}</Link>)}</nav>
      <Link className="admin-back" href="/apps"><ChevronLeft size={15} /><LayoutDashboard size={15} /> Back to applications</Link>
    </aside>
    <main className="admin-content">{children}</main>
  </div>;
}
