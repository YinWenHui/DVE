export type FreshnessState = "healthy" | "delayed" | "stale" | "failed" | "offline";

export interface FreshnessInput {
  sourceUpdatedAt?: string;
  refreshIntervalMinutes: number;
  staleAfterMinutes: number;
  latestRefreshFailed?: boolean;
  online?: boolean;
  now?: Date;
}

export function classifyFreshness(input: FreshnessInput): FreshnessState {
  if (input.online === false) return "offline";
  if (input.latestRefreshFailed) return "failed";
  if (!input.sourceUpdatedAt) return "stale";
  const ageMinutes = ((input.now ?? new Date()).getTime() - new Date(input.sourceUpdatedAt).getTime()) / 60_000;
  if (ageMinutes > input.staleAfterMinutes) return "stale";
  if (ageMinutes > input.refreshIntervalMinutes + 2) return "delayed";
  return "healthy";
}
