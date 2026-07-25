import { UserManager } from "@/components/admin/user-manager";
import { getMockStore } from "@/lib/mock-store";
export default function UsersPage() { return <><div className="page-heading"><div><p className="eyebrow">Identity</p><h1>Users and roles</h1><p>Application-managed accounts with server-enforced role membership.</p></div><span className="badge warning">Mock users</span></div><UserManager initialUsers={getMockStore().users} /></>; }
