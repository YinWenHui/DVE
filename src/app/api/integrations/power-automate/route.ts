import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { config } from "@/lib/config";
import { appendAudit } from "@/lib/mock-store";

const payloadSchema = z.object({ source: z.string().min(1).max(100), eventType: z.enum(["list.item.created", "list.item.updated", "attachment.saved", "workflow.notification", "workflow.approved"]), externalId: z.string().min(1).max(200), occurredAt: z.iso.datetime(), data: z.record(z.string(), z.unknown()) });

function validKey(value: string | null): boolean {
  if (!value || !config.DVE_INTEGRATION_KEY) return false;
  const supplied = Buffer.from(value); const expected = Buffer.from(config.DVE_INTEGRATION_KEY);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function POST(request: Request) {
  if (!config.DVE_INTEGRATION_KEY) return Response.json({ error: { code: "INTEGRATION_DISABLED", message: "Integration key is not configured." } }, { status: 503 });
  if (!validKey(request.headers.get("X-DVE-Integration-Key"))) return Response.json({ error: { code: "UNAUTHORIZED", message: "Integration authentication failed." } }, { status: 401 });
  const parsed = payloadSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: { code: "INVALID_PAYLOAD", message: "Integration payload is invalid.", details: parsed.error.flatten() } }, { status: 400 });
  const eventId = randomUUID(); appendAudit("integration.receive", "integration-event", eventId, "Power Automate", `${parsed.data.eventType} from ${parsed.data.source} (${parsed.data.externalId}).`);
  return Response.json({ eventId, acceptedAt: new Date().toISOString(), status: "accepted" }, { status: 202 });
}
