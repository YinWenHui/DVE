import { getCurrentUser } from "@/lib/auth/server";

export async function GET() {
  const user = await getCurrentUser();
  return user ? Response.json({ user }) : Response.json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required." } }, { status: 401 });
}
