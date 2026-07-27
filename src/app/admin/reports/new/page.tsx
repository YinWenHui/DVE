import { ReportBuilder } from "@/components/report-builder/report-builder";
import { getMockStore } from "@/lib/mock-store";

export default function NewReportPage() { const store = getMockStore(); const dataset = store.datasets[0]; return <><div className="page-heading"><div><p className="eyebrow">Report builder</p><h1>Create report</h1><p>Build interactive report pages with live visuals, scoped filters, and formatting.</p></div></div><ReportBuilder datasets={store.datasets} records={dataset ? store.records.get(dataset.id) ?? [] : []} /></>; }
