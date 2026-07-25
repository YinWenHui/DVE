import { ReportBuilder } from "@/components/report-builder/report-builder";
import { getMockStore } from "@/lib/mock-store";

export default function NewReportPage() { return <><div className="page-heading"><div><p className="eyebrow">Report builder</p><h1>Create report</h1><p>Add pages and metadata-driven visuals to a governed dataset.</p></div></div><ReportBuilder datasets={getMockStore().datasets} /></>; }
