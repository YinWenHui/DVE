"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Responsive, WidthProvider, type Layout } from "react-grid-layout";
import { Bookmark, Download, Filter, FilterX, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { CommentsPanel } from "./comments-panel";
import { ReportVisual } from "./report-visual";
import { applyReportFilters, visualData } from "@/lib/reporting";
import type { Dataset, ManufacturingRecord, Report, VisualDefinition } from "@/types";

interface Filters { from: string; to: string; Line: string; Model: string; Customer: string; Shift: string }
interface PersonalBookmark { id: string; name: string; pageId: string; filters: Filters; createdAt: string }
type InsightPane = "filters" | "bookmarks" | null;
const ResponsiveGridLayout = WidthProvider(Responsive);

export function ReportDashboard({ report, dataset, records, canComment }: { report: Report; dataset: Dataset; records: Record<string, unknown>[]; canComment: boolean }) {
  const [typedRecords, setTypedRecords] = useState(() => records as unknown as ManufacturingRecord[]);
  const defaultFilters = useMemo<Filters>(() => {
    const dates = typedRecords.map((row) => row.RecordDate).sort();
    return { from: dates.at(-30) ?? dates[0] ?? "", to: dates.at(-1) ?? "", Line: "", Model: "", Customer: "", Shift: "" };
  }, [typedRecords]);
  const visiblePages = useMemo(() => {
    const visible = report.pages.filter((item) => !item.hidden);
    return visible.length ? visible : report.pages.slice(0, 1);
  }, [report.pages]);
  const [filters, setFilters] = useState(defaultFilters);
  const [browserLoadedAt, setBrowserLoadedAt] = useState("");
  const [freshness, setFreshness] = useState(() => ({ sourceUpdatedAt: dataset.sourceUpdatedAt, importedAt: dataset.importedAt }));
  const [pageIndex, setPageIndex] = useState(0);
  const [pane, setPane] = useState<InsightPane>(null);
  const [bookmarks, setBookmarks] = useState<PersonalBookmark[]>([]);
  const [bookmarkName, setBookmarkName] = useState("");
  const [focusedVisual, setFocusedVisual] = useState<VisualDefinition>();
  const [dataVisual, setDataVisual] = useState<VisualDefinition>();
  const page = (visiblePages[pageIndex] ?? visiblePages[0])!;
  const metadataFiltered = useMemo(() => applyReportFilters(typedRecords, [...(report.filters ?? []), ...(page.filters ?? [])]), [page.filters, report.filters, typedRecords]);
  const filtered = useMemo(() => metadataFiltered.filter((row) =>
    (!filters.from || row.RecordDate >= filters.from) && (!filters.to || row.RecordDate <= filters.to) &&
    (!filters.Line || row.Line === filters.Line) && (!filters.Model || row.Model === filters.Model) &&
    (!filters.Customer || row.Customer === filters.Customer) && (!filters.Shift || row.Shift === filters.Shift)
  ), [filters, metadataFiltered]);
  const unique = useCallback((field: "Line" | "Model" | "Customer" | "Shift") => [...new Set(metadataFiltered.map((row) => String(row[field])))].sort(), [metadataFiltered]);

  useEffect(() => {
    const update = () => setBrowserLoadedAt(new Date().toISOString());
    const updateDataset = async (event: Event) => {
      const next = (event as CustomEvent<Dataset>).detail;
      if (!next) return;
      setFreshness({ sourceUpdatedAt: next.sourceUpdatedAt, importedAt: next.importedAt });
      const response = await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ datasetId: next.id, dimensions: [], measures: [], filters: [], sort: [], limit: 50_000 }) });
      if (response.ok) {
        const payload = await response.json() as { rows: Record<string, unknown>[] };
        setTypedRecords(payload.rows as unknown as ManufacturingRecord[]);
      }
    };
    update(); window.addEventListener("dve:browser-loaded", update);
    window.addEventListener("dve:dataset-refreshed", updateDataset);
    return () => { window.removeEventListener("dve:browser-loaded", update); window.removeEventListener("dve:dataset-refreshed", updateDataset); };
  }, []);

  useEffect(() => {
    let frame = 0;
    try {
      const stored = window.localStorage.getItem(`dve:bookmarks:${report.id}`);
      if (stored) frame = window.requestAnimationFrame(() => setBookmarks(JSON.parse(stored) as PersonalBookmark[]));
    } catch { /* Browser privacy settings can disable local storage. */ }
    return () => window.cancelAnimationFrame(frame);
  }, [report.id]);

  const selectCategory = useCallback((field: keyof ManufacturingRecord | undefined, value: string) => {
    if (field === "Line" || field === "Model" || field === "Customer" || field === "Shift") setFilters((current) => ({ ...current, [field]: current[field] === value ? "" : value }));
  }, []);

  function persistBookmarks(next: PersonalBookmark[]) {
    setBookmarks(next);
    try { window.localStorage.setItem(`dve:bookmarks:${report.id}`, JSON.stringify(next)); } catch { /* Keep session state when storage is unavailable. */ }
  }

  function saveBookmark() {
    const name = bookmarkName.trim() || `Bookmark ${bookmarks.length + 1}`;
    persistBookmarks([...bookmarks, { id: crypto.randomUUID(), name, pageId: page.id, filters: { ...filters }, createdAt: new Date().toISOString() }]);
    setBookmarkName("");
  }

  function applyBookmark(bookmark: PersonalBookmark) {
    setFilters(bookmark.filters);
    const index = visiblePages.findIndex((item) => item.id === bookmark.pageId);
    if (index >= 0) setPageIndex(index);
  }

  async function exportData(format: "csv" | "xlsx") {
    const queryFilters = [
      filters.from ? { field: "RecordDate", operator: "greaterThanOrEqual", value: filters.from } : null,
      filters.to ? { field: "RecordDate", operator: "lessThanOrEqual", value: filters.to } : null,
      ...(["Line", "Model", "Customer", "Shift"] as const).map((field) => filters[field] ? { field, operator: "equals", value: filters[field] } : null),
    ].filter((item): item is { field: string; operator: string; value: string } => item !== null);
    const response = await fetch(`/api/export?format=${format}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ datasetId: dataset.id, dimensions: [], measures: [], filters: queryFilters, sort: [{ field: "RecordDate", direction: "desc" }], limit: 50_000 }) });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `${report.slug}.${format}`; anchor.click(); URL.revokeObjectURL(url);
  }

  const layout = useMemo<Layout[]>(() => page.visuals.map((visual) => ({ i: visual.id, x: visual.x, y: visual.y, w: visual.w, h: visual.h, minH: 2 })), [page.visuals]);
  const layouts = useMemo(() => ({ lg: layout }), [layout]);
  const activeCount = [filters.from, filters.to, filters.Line, filters.Model, filters.Customer, filters.Shift].filter(Boolean).length;

  return <main className="report-page">
    <nav className="report-tabs" aria-label="Report pages">{visiblePages.map((item, index) => <button className={`report-tab ${index === pageIndex ? "active" : ""}`} key={item.id} onClick={() => setPageIndex(index)}>{item.name}</button>)}</nav>
    <div className="report-command-bar">
      <div className="filter-summary"><Filter size={14} /><strong>{activeCount}</strong><span>active filters</span>{filters.Line && <i>{filters.Line}</i>}{filters.Model && <i>{filters.Model}</i>}</div>
      <div className="report-command-actions">
        <button className={`button ${pane === "filters" ? "active" : ""}`} onClick={() => setPane((current) => current === "filters" ? null : "filters")}><Filter size={14} /> Filters</button>
        <button className={`button ${pane === "bookmarks" ? "active" : ""}`} onClick={() => setPane((current) => current === "bookmarks" ? null : "bookmarks")}><Bookmark size={14} /> Bookmarks</button>
        <button className="button" title="Clear all filters" onClick={() => setFilters({ ...defaultFilters, from: "", to: "" })}><FilterX size={14} /> Clear</button>
        <button className="button" title="Reset to the report default" onClick={() => setFilters(defaultFilters)}><RotateCcw size={14} /> Reset</button>
        <button className="button" onClick={() => exportData("csv")}><Download size={14} /> CSV</button>
        <button className="button" onClick={() => exportData("xlsx")}><Download size={14} /> Excel</button>
        {canComment && <CommentsPanel reportId={report.id} />}
      </div>
    </div>
    <div className="report-workspace">
      <div className="report-workspace-main">
        <div className="source-strip"><span>Source updated <strong>{new Date(freshness.sourceUpdatedAt).toLocaleString()}</strong></span><span>Dataset imported <strong>{new Date(freshness.importedAt).toLocaleString()}</strong></span><span>Browser loaded <strong>{browserLoadedAt ? new Date(browserLoadedAt).toLocaleString() : "Loading…"}</strong></span><span>Rows in context <strong>{filtered.length.toLocaleString()}</strong></span></div>
        {dataset.status !== "healthy" && <div className="status-banner">Data freshness is {dataset.status}. The previous validated dataset version remains active.</div>}
        <section className="report-canvas" data-report-canvas>
          <ResponsiveGridLayout className="layout" layouts={layouts} breakpoints={{ lg: 1100, md: 850, sm: 620, xs: 420, xxs: 0 }} cols={{ lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }} rowHeight={54} margin={[10, 10]} isDraggable={false} isResizable={false} measureBeforeMount>
            {page.visuals.map((visual) => <div key={visual.id}><ReportVisual visual={visual} rows={filtered} activeFilters={filters} onSelect={selectCategory} onFocus={setFocusedVisual} onShowData={setDataVisual} /></div>)}
          </ResponsiveGridLayout>
        </section>
      </div>
      {pane === "filters" && <FiltersPane filters={filters} setFilters={setFilters} unique={unique} reportFilterCount={report.filters?.length ?? 0} pageFilterCount={page.filters?.length ?? 0} onClose={() => setPane(null)} />}
      {pane === "bookmarks" && <BookmarksPane bookmarks={bookmarks} name={bookmarkName} setName={setBookmarkName} onSave={saveBookmark} onApply={applyBookmark} onDelete={(id) => persistBookmarks(bookmarks.filter((item) => item.id !== id))} onClose={() => setPane(null)} />}
    </div>
    {focusedVisual && <VisualDialog title={`${focusedVisual.title} — focus mode`} onClose={() => setFocusedVisual(undefined)}><ReportVisual visual={focusedVisual} rows={filtered} activeFilters={filters} onSelect={selectCategory} showActions={false} /></VisualDialog>}
    {dataVisual && <VisualDialog title={`${dataVisual.title} — underlying data`} onClose={() => setDataVisual(undefined)}><VisualDataTable visual={dataVisual} rows={filtered} dataset={dataset} /></VisualDialog>}
  </main>;
}

function FiltersPane({ filters, setFilters, unique, reportFilterCount, pageFilterCount, onClose }: { filters: Filters; setFilters: (filters: Filters) => void; unique: (field: "Line" | "Model" | "Customer" | "Shift") => string[]; reportFilterCount: number; pageFilterCount: number; onClose: () => void }) {
  return <aside className="insight-pane" aria-label="Report filters">
    <div className="insight-pane-header"><div><strong>Filters</strong><span>Report, page, and viewer context</span></div><button className="icon-button" onClick={onClose} aria-label="Close filters"><X size={14} /></button></div>
    {(reportFilterCount > 0 || pageFilterCount > 0) && <div className="filter-scope-summary"><span>{reportFilterCount} report-level</span><span>{pageFilterCount} page-level</span></div>}
    <div className="form-stack insight-pane-body">
      <label>Date from<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
      <label>Date to<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
      {(["Line", "Model", "Customer", "Shift"] as const).map((field) => <label key={field}>{field}<select value={filters[field]} onChange={(event) => setFilters({ ...filters, [field]: event.target.value })}><option value="">All</option>{unique(field).map((value) => <option key={value}>{value}</option>)}</select></label>)}
    </div>
  </aside>;
}

function BookmarksPane({ bookmarks, name, setName, onSave, onApply, onDelete, onClose }: { bookmarks: PersonalBookmark[]; name: string; setName: (value: string) => void; onSave: () => void; onApply: (bookmark: PersonalBookmark) => void; onDelete: (id: string) => void; onClose: () => void }) {
  return <aside className="insight-pane" aria-label="Personal bookmarks">
    <div className="insight-pane-header"><div><strong>Bookmarks</strong><span>Saved in this browser</span></div><button className="icon-button" onClick={onClose} aria-label="Close bookmarks"><X size={14} /></button></div>
    <div className="bookmark-create"><input aria-label="Bookmark name" placeholder={`Bookmark ${bookmarks.length + 1}`} value={name} onChange={(event) => setName(event.target.value)} /><button className="button primary" onClick={onSave}><Plus size={14} /> Add</button></div>
    <div className="bookmark-list">{bookmarks.map((bookmark) => <div className="bookmark-item" key={bookmark.id}><button onClick={() => onApply(bookmark)}><strong>{bookmark.name}</strong><span>{new Date(bookmark.createdAt).toLocaleString()}</span></button><button className="icon-button danger" aria-label={`Delete ${bookmark.name}`} onClick={() => onDelete(bookmark.id)}><Trash2 size={13} /></button></div>)}{!bookmarks.length && <div className="empty-state compact">Capture the current page and filters as a personal bookmark.</div>}</div>
  </aside>;
}

function VisualDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="visual-dialog" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={16} /></button></header><div className="visual-dialog-body">{children}</div></section></div>;
}

function VisualDataTable({ visual, rows, dataset }: { visual: VisualDefinition; rows: ManufacturingRecord[]; dataset: Dataset }) {
  const data = useMemo(() => {
    if (visual.type !== "table" && visual.type !== "matrix") return visualData(visual, rows);
    const columns = dataset.fields.filter((field) => !field.hidden).slice(0, 10).map((field) => field.key);
    return { columns, rows: rows.slice(0, 100).map((row) => columns.map((column) => String(row[column as keyof ManufacturingRecord] ?? ""))) };
  }, [dataset.fields, rows, visual]);
  return <div className="data-table-wrap"><table className="data-table"><thead><tr>{data.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{data.rows.map((row, index) => <tr key={index}>{row.map((value, valueIndex) => <td key={valueIndex}>{typeof value === "number" ? value.toLocaleString() : value}</td>)}</tr>)}</tbody></table></div>;
}
