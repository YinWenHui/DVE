import type { ReportSubscriptionDefinition } from "@/types";

function atTime(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(date);
  next.setHours(Number.isFinite(hours) ? hours : 8, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return next;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function nextSubscriptionRun(subscription: ReportSubscriptionDefinition, now = new Date()): Date | undefined {
  if (!subscription.enabled) return undefined;
  if (subscription.frequency === "daily") {
    const next = atTime(now, subscription.time);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }
  if (subscription.frequency === "weekly") {
    const targetDay = Math.max(0, Math.min(6, subscription.weekday ?? 1));
    const next = atTime(now, subscription.time);
    next.setDate(next.getDate() + ((targetDay - next.getDay() + 7) % 7));
    if (next <= now) next.setDate(next.getDate() + 7);
    return next;
  }
  const targetDay = Math.max(1, Math.min(31, subscription.monthDay ?? 1));
  const next = atTime(now, subscription.time);
  next.setDate(Math.min(targetDay, daysInMonth(next.getFullYear(), next.getMonth())));
  if (next <= now) {
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    next.setDate(Math.min(targetDay, daysInMonth(next.getFullYear(), next.getMonth())));
  }
  return next;
}

export function subscriptionCadenceLabel(subscription: ReportSubscriptionDefinition): string {
  if (subscription.frequency === "daily") return `Daily at ${subscription.time}`;
  if (subscription.frequency === "weekly") return `${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][subscription.weekday ?? 1]} at ${subscription.time}`;
  return `Monthly on day ${subscription.monthDay ?? 1} at ${subscription.time}`;
}
