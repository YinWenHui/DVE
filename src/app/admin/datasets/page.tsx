import Link from "next/link";
import { Eye, Plus, RefreshCw } from "lucide-react";
import { getMockStore } from "@/lib/mock-store";

export default function DatasetsPage() {
  const datasets = getMockStore().datasets;
  return <><div className="page-heading"><div><p className="eyebrow">Semantic data</p><h1>Datasets</h1><p>Imported files and governed SQL sources with refresh and retention policies.</p></div><Link className="button primary" href="/admin/datasets/new"><Plus size={16} /> New dataset</Link></div>
    <section className="panel"><table className="admin-table"><thead><tr><th>Dataset</th><th>Source / mode</th><th>Status</th><th>Last successful refresh</th><th>Next refresh</th><th>Rows</th><th>Owner</th><th>Retention</th><th>Actions</th></tr></thead><tbody>{datasets.map((dataset) => <tr key={dataset.id}><td><strong>{dataset.name}</strong><small>{dataset.description}</small></td><td>{dataset.sourceType}<small>{dataset.storageMode}</small></td><td><span className={`badge ${dataset.status}`}>{dataset.status}</span></td><td>{new Date(dataset.lastSuccessfulRefresh).toLocaleString()}</td><td>{new Date(dataset.nextScheduledRefresh).toLocaleString()}</td><td>{dataset.rowCount.toLocaleString()}</td><td>{dataset.owner}</td><td>{dataset.retention.mode === "permanent" ? "Permanent" : dataset.retention.mode === "days" ? `${dataset.retention.days} days` : `${dataset.retention.detailDays} detail days`}</td><td><div className="table-actions"><Link className="icon-button" title="View dataset" href={`/admin/datasets/${dataset.id}`}><Eye size={15} /></Link><Link className="icon-button" title="Open refresh monitor" href="/admin/refresh"><RefreshCw size={15} /></Link></div></td></tr>)}</tbody></table></section>
  </>;
}
