"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ReportError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Report route failed", error); }, [error]);
  return <main className="report-route-error" role="alert"><div className="report-state-icon"><AlertTriangle size={24} /></div><h1>Couldn&apos;t open this report</h1><p>The report route encountered an unexpected error. Retry without leaving the application.</p>{error.digest && <small>Reference: {error.digest}</small>}<button className="button primary" onClick={reset}><RefreshCw size={14} /> Try again</button></main>;
}
