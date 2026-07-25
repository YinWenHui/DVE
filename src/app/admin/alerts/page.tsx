import { AlertManager } from "@/components/admin/alert-manager";
import { getMockStore } from "@/lib/mock-store";
export default function AlertsPage() { const store = getMockStore(); return <><div className="page-heading"><div><p className="eyebrow">Operational action</p><h1>Alerts</h1><p>Structured rules and auditable acknowledgements without executable expressions.</p></div></div><AlertManager initialAlerts={store.alerts} initialRules={store.alertRules} datasets={store.datasets} /></>; }
