import { UsageDashboard } from "@/components/admin/usage-dashboard";
import { getMockStore } from "@/lib/mock-store";

export default function UsagePage() {
  const reports = getMockStore().reports;
  return <><div className="page-heading"><div><p className="eyebrow">Adoption and discovery</p><h1>Usage analytics</h1><p>Understand report reach, local engagement, ownership, and endorsement.</p></div></div><UsageDashboard reports={reports} /></>;
}
