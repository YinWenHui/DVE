import { describe, expect, it } from "vitest";
import { loginInputSchema } from "@/lib/validation/auth";
describe("login input", () => {
  it("accepts a development preview role", () => { expect(loginInputSchema.safeParse({ previewRole: "ADMINISTRATOR" }).success).toBe(true); });
  it("requires a reasonable password length", () => { expect(loginInputSchema.safeParse({ username: "admin", password: "short" }).success).toBe(false); expect(loginInputSchema.safeParse({ username: "admin", password: "a-long-passphrase" }).success).toBe(true); });
});
