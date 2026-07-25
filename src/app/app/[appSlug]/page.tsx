import { notFound, redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/server";
import { repositories } from "@/repositories";

export default async function ApplicationLanding({ params }: { params: Promise<{ appSlug: string }> }) {
  const user = await requirePageUser();
  const { appSlug } = await params;
  const app = await repositories.applications.findBySlug(appSlug, user);
  if (!app) notFound();
  const reports = await repositories.reports.list(user);
  const visibleIds = new Set(app.sections.flatMap((section) => section.reportIds));
  const preferred = reports.find((report) => report.id === app.defaultReportId && visibleIds.has(report.id)) ?? reports.find((report) => visibleIds.has(report.id));
  if (!preferred) redirect("/apps");
  redirect(`/app/${app.slug}/report/${preferred.slug}`);
}
