"use client";

import type { ReactNode } from "react";
import { AlertTriangle, BarChart3, Database, FilterX, RefreshCw } from "lucide-react";
import type { ReportCanvasState as CanvasState } from "@/lib/reporting";
import type { Dataset } from "@/types";

const stateCopy: Record<Exclude<CanvasState, "ready" | "stale">, { title: string; description: string; icon: typeof Database }> = {
  "empty-report": { title: "No visuals on this page", description: "This report page is valid, but its author has not added any visuals yet.", icon: BarChart3 },
  "no-data": { title: "Dataset has no rows", description: "The dataset is connected, but no validated records are currently available.", icon: Database },
  "no-metadata-results": { title: "Report filters exclude all data", description: "A report-level or page-level filter leaves this page with no matching records. An author can adjust those filters in the report builder.", icon: FilterX },
  "no-results": { title: "No matching data", description: "The current viewer filters do not match any records. Reset them to return to the report default.", icon: FilterX },
  "offline": { title: "Dataset is offline", description: "No validated dataset version is available. The report will recover after a successful refresh.", icon: Database },
  "error": { title: "Dataset refresh failed", description: "The latest refresh failed and there is no previous validated version to display.", icon: AlertTriangle },
};

export function ReportCanvasState({ state, datasetStatus, onReset, children }: { state: CanvasState; datasetStatus: Dataset["status"]; onReset: () => void; children: ReactNode }) {
  if (state === "ready") return children;
  if (state === "stale") return <>
    <div className={`report-state-banner ${datasetStatus}`} role="status"><AlertTriangle size={15} /><div><strong>{datasetStatus === "refreshing" ? "Refresh in progress" : `Data is ${datasetStatus}`}</strong><span>{datasetStatus === "refreshing" ? "The current validated version remains visible while new data is loaded." : "The previous validated dataset version remains active."}</span></div></div>
    {children}
  </>;
  const copy = stateCopy[state]; const Icon = copy.icon;
  return <section className={`report-state-panel ${state === "error" ? "error" : ""}`} role={state === "error" ? "alert" : "status"} data-report-state={state}>
    <div className="report-state-icon"><Icon size={23} /></div>
    <h2>{copy.title}</h2><p>{copy.description}</p>
    {state === "no-results" && <button className="button primary" onClick={onReset}><RefreshCw size={14} /> Reset filters</button>}
  </section>;
}
