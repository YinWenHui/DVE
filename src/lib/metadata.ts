import type { Dataset, Report } from "@/types";

export function serializeDatasetMetadata(dataset: Dataset): string {
  return JSON.stringify({
    ...dataset,
    fields: [...dataset.fields].sort((left, right) => left.ordinal - right.ordinal),
  });
}

export function serializeReportMetadata(report: Report): string {
  return JSON.stringify({
    ...report,
    pages: [...report.pages]
      .sort((left, right) => left.ordinal - right.ordinal)
      .map((page) => ({ ...page, visuals: [...page.visuals].sort((left, right) => left.y - right.y || left.x - right.x) })),
  });
}
