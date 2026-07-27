import { revokeCurrentSession } from "@/lib/auth/server";

export async function POST() {
  await revokeCurrentSession();
  return Response.json({ ok: true });
}
