import { describe, expect, it } from "vitest";
import { nextSubscriptionRun, subscriptionCadenceLabel } from "@/lib/report-subscriptions";
import type { ReportSubscriptionDefinition } from "@/types";

const base: ReportSubscriptionDefinition = {
  id: "subscription-1", reportId: "report-1", name: "Morning report", recipients: ["owner@example.com"], frequency: "daily", time: "08:30", timezone: "Asia/Bangkok", format: "pdf", enabled: true, createdAt: "2026-07-26T00:00:00.000Z",
};

describe("report subscription scheduling", () => {
  it("rolls a daily schedule to the following day after its delivery time", () => {
    const next = nextSubscriptionRun(base, new Date(2026, 6, 26, 9, 0));
    expect(next?.getDate()).toBe(27);
    expect(next?.getHours()).toBe(8);
    expect(next?.getMinutes()).toBe(30);
  });

  it("calculates weekly and monthly cadence labels", () => {
    expect(subscriptionCadenceLabel({ ...base, frequency: "weekly", weekday: 1 })).toBe("Monday at 08:30");
    expect(subscriptionCadenceLabel({ ...base, frequency: "monthly", monthDay: 15 })).toBe("Monthly on day 15 at 08:30");
  });
});
