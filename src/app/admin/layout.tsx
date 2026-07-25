import { AdminShell } from "@/components/admin/admin-shell";
import { requirePageUser } from "@/lib/auth/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser(["ADMINISTRATOR"]);
  return <AdminShell>{children}</AdminShell>;
}
