export interface RecentReportEntry { reportId: string; viewedAt: string }
export interface LocalReportUsage { reportId: string; views: number; lastViewedAt: string }

export function recordReportVisit(recents: RecentReportEntry[], usage: LocalReportUsage[], reportId: string, viewedAt = new Date().toISOString()) {
  const nextRecents = [{ reportId, viewedAt }, ...recents.filter((entry) => entry.reportId !== reportId)].slice(0, 20);
  const existing = usage.find((entry) => entry.reportId === reportId);
  const nextUsage = existing
    ? usage.map((entry) => entry.reportId === reportId ? { ...entry, views: entry.views + 1, lastViewedAt: viewedAt } : entry)
    : [...usage, { reportId, views: 1, lastViewedAt: viewedAt }];
  return { recents: nextRecents, usage: nextUsage };
}

export function toggleFavorite(favorites: string[], reportId: string) {
  return favorites.includes(reportId) ? favorites.filter((id) => id !== reportId) : [...favorites, reportId];
}
