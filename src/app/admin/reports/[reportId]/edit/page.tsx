import { notFound } from "next/navigation";
import { ReportBuilder } from "@/components/report-builder/report-builder";
import { getMockStore } from "@/lib/mock-store";

export default async function EditReportPage({ params }: { params: Promise<{ reportId: string }> }) { const { reportId } = await params; const store = getMockStore(); const report = store.reports.find((item) => item.id === reportId); if (!report) notFound(); return <><div className="page-heading"><div><p className="eyebrow">Report builder</p><h1>Edit {report.name}</h1><p>Move, resize, configure, preview, and publish report visuals.</p></div></div><ReportBuilder datasets={store.datasets} records={store.records.get(report.datasetId) ?? []} initial={report} /></>; }
