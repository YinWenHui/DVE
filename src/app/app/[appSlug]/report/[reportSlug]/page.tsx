import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { ReportDashboard } from "@/components/report/report-dashboard";
import { requirePageUser } from "@/lib/auth/server";
import { visibleReportIds } from "@/lib/permissions";
import { repositories } from "@/repositories";

export default async function ReportPage({ params }: { params: Promise<{ appSlug: string; reportSlug: string }> }) {
  const user = await requirePageUser();
  const { appSlug, reportSlug } = await params;
  const app = await repositories.applications.findBySlug(appSlug, user);
  const reports = await repositories.reports.list(user);
  const report = reports.find((candidate) => candidate.slug === reportSlug);
  if (!app || !report || !visibleReportIds(app, reports, user).has(report.id)) notFound();
  const dataset = await repositories.datasets.findById(report.datasetId, user);
  if (!dataset) notFound();
  const rows = await repositories.datasets.rows(dataset.id, user);
  return <AppShell app={app} reports={reports} activeReport={report} dataset={dataset} user={user}>
    <ReportDashboard report={report} dataset={dataset} records={rows} canComment={user.roles.some((role) => role !== "VIEWER")} userEmail={user.email} />
  </AppShell>;
}
