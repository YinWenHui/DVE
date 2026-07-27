import { DatasetWizard } from "@/components/dataset-manager/dataset-wizard";

export default function NewDatasetPage() { return <><div className="page-heading"><div><p className="eyebrow">Dataset manager</p><h1>Create dataset</h1><p>Import a governed single-table dataset from Excel or CSV.</p></div></div><DatasetWizard /></>; }
