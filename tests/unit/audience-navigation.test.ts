import { describe, expect, it } from "vitest";
import { mockUsers, seedApp, seedReports } from "@/data/seed";
import { filterAppNavigation } from "@/lib/permissions";
describe("audience navigation", () => {
  it("limits viewers and expands manager navigation", () => {
    const viewer = mockUsers.find((user) => user.roles.includes("VIEWER")); const manager = mockUsers.find((user) => user.roles.includes("MANAGER"));
    if (!viewer || !manager) throw new Error("Seed users missing");
    const viewerCount = filterAppNavigation(seedApp, seedReports, viewer).sections.flatMap((section) => section.reportIds).length;
    const managerCount = filterAppNavigation(seedApp, seedReports, manager).sections.flatMap((section) => section.reportIds).length;
    expect(viewerCount).toBeGreaterThan(0); expect(managerCount).toBeGreaterThan(viewerCount);
  });
});
