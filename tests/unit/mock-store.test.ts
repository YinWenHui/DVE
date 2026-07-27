import { afterEach, describe, expect, it } from "vitest";
import { seedAlertRules } from "@/data/seed";
import { getMockStore, type MockStore } from "@/lib/mock-store";

describe("mock store hot-reload compatibility", () => {
  afterEach(() => {
    globalThis.__digitalVerseMockStore = undefined;
  });

  it("backfills fields missing from an older in-memory store", () => {
    const staleStore = getMockStore();
    delete (staleStore as Partial<MockStore>).alertRules;

    const hydratedStore = getMockStore();

    expect(hydratedStore).toBe(staleStore);
    expect(hydratedStore.alertRules).toEqual(seedAlertRules);
  });
});
