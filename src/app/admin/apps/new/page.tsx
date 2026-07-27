import { AppBuilder } from "@/components/app-builder/app-builder";
import { getMockStore } from "@/lib/mock-store";
export default function NewApplicationPage() { return <><div className="page-heading"><div><p className="eyebrow">Application builder</p><h1>Create application</h1><p>Organize reports, navigation sections, audiences, and publishing state.</p></div></div><AppBuilder reports={getMockStore().reports} /></>; }
