import { z } from "zod";

export const retentionPolicySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("permanent") }),
  z.object({ mode: z.literal("days"), days: z.number().int().min(1).max(3_650) }),
  z.object({ mode: z.literal("detail-and-summary"), detailDays: z.number().int().min(1).max(3_650) }),
]);

export function validateRetentionPolicy(value: unknown) {
  return retentionPolicySchema.safeParse(value);
}
