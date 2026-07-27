export default function ReportLoading() {
  return <main className="report-loading-page" aria-label="Loading report">
    <div className="loading-line short" />
    <div className="loading-command" />
    <div className="loading-kpis">{Array.from({ length: 6 }, (_, index) => <div key={index} />)}</div>
    <div className="loading-visuals"><div /><div /></div>
    <span className="sr-only">Loading report visuals…</span>
  </main>;
}
