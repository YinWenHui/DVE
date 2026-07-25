import { describe, expect, it } from "vitest";
import { hasPermission, meetsMinimumRole } from "@/lib/permissions";
import { mockUsers } from "@/data/seed";

describe("permissions", () => {
  it("inherits viewer actions for higher roles", () => {
    const supervisor = mockUsers.find((user) => user.roles.includes("SUPERVISOR"));
    expect(supervisor && hasPermission(supervisor, "exports:create")).toBe(true);
    expect(supervisor && meetsMinimumRole(supervisor, "VIEWER")).toBe(true);
  });
  it("does not grant administration to managers", () => {
    const manager = mockUsers.find((user) => user.roles.includes("MANAGER"));
    expect(manager && hasPermission(manager, "admin:manage")).toBe(false);
  });
});
