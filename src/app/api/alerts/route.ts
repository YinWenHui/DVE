import { authorizeApi, isAuthorizationError } from "@/lib/auth/server";
import { getMockStore } from "@/lib/mock-store";

export async function GET() {
  const auth = await authorizeApi("apps:read"); if (isAuthorizationError(auth)) return auth;
  return Response.json({ alerts: getMockStore().alerts });
}
