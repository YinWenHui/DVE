import { notFound } from "next/navigation";
import { AppBuilder } from "@/components/app-builder/app-builder";
import { getMockStore } from "@/lib/mock-store";
export default async function EditApplicationPage({ params }: { params: Promise<{ appId: string }> }) { const { appId } = await params; const store = getMockStore(); const app = store.apps.find((item) => item.id === appId); if (!app) notFound(); return <><div className="page-heading"><div><p className="eyebrow">Application builder</p><h1>Edit {app.name}</h1><p>Manage setup, report content, audiences, and publishing.</p></div></div><AppBuilder reports={store.reports} initial={app} /></>; }
