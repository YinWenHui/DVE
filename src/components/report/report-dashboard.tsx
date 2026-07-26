"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft, Bookmark, CornerUpRight, Download, Filter, FilterX, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { CommentsPanel } from "./comments-panel";
import { ReportCanvasState } from "./report-canvas-state";
import { ReportControl } from "./report-control";
import { ReportVisual } from "./report-visual";
import { applyReportFilters, drillthroughTargets, resolveReportCanvasState, resolveVisualInteractionRows, visualData, visualHierarchy, visualInteractionMode, type VisualInteractionSelection } from "@/lib/reporting";
import type { Dataset, ManufacturingRecord, Report, ReportActionDefinition, ReportBookmarkDefinition, ReportFilterDefinition, ReportPage, VisualDefinition } from "@/types";

interface Filters { from: string; to: string; Line: string; Model: string; Customer: string; Shift: string }
interface PersonalBookmark { id: string; name: string; pageId: string; filters: Filters; drillContext?: ReportFilterDefinition[]; visualSelections?: VisualInteractionSelection[]; createdAt: string }
interface DrillHistoryEntry { pageId: string; filters: Filters; drillContext: ReportFilterDefinition[]; visualSelections: VisualInteractionSelection[] }
type InsightPane = "filters" | "bookmarks" | null;

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
  const [activePageId, setActivePageId] = useState(() => visiblePages[0]?.id ?? report.pages[0]?.id ?? "");
  const [pane, setPane] = useState<InsightPane>(null);
  const [bookmarks, setBookmarks] = useState<PersonalBookmark[]>([]);
  const [bookmarkName, setBookmarkName] = useState("");
  const [activeReportBookmarkId, setActiveReportBookmarkId] = useState<string>();
  const [focusedVisual, setFocusedVisual] = useState<VisualDefinition>();
  const [dataVisual, setDataVisual] = useState<VisualDefinition>();
  const [drillVisual, setDrillVisual] = useState<VisualDefinition>();
  const [drillContext, setDrillContext] = useState<ReportFilterDefinition[]>([]);
  const [drillHistory, setDrillHistory] = useState<DrillHistoryEntry[]>([]);
  const [visualSelections, setVisualSelections] = useState<VisualInteractionSelection[]>([]);
  const page = (report.pages.find((item) => item.id === activePageId) ?? visiblePages[0] ?? report.pages[0])!;
  const metadataFiltered = useMemo(() => applyReportFilters(typedRecords, [...(report.filters ?? []), ...(page.filters ?? []), ...drillContext]), [drillContext, page.filters, report.filters, typedRecords]);
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

  const selectCategory = useCallback((sourceVisualId: string, field: keyof ManufacturingRecord | undefined, value: string) => {
    if (!field) return;
    setActiveReportBookmarkId(undefined);
    setVisualSelections((current) => {
      const existing = current.find((selection) => selection.sourceVisualId === sourceVisualId);
      const remaining = current.filter((selection) => selection.sourceVisualId !== sourceVisualId);
      return existing?.field === field && existing.value === value ? remaining : [...remaining, { sourceVisualId, field, value }];
    });
  }, []);

  function persistBookmarks(next: PersonalBookmark[]) {
    setBookmarks(next);
    try { window.localStorage.setItem(`dve:bookmarks:${report.id}`, JSON.stringify(next)); } catch { /* Keep session state when storage is unavailable. */ }
  }

  function saveBookmark() {
    const name = bookmarkName.trim() || `Bookmark ${bookmarks.length + 1}`;
    persistBookmarks([...bookmarks, { id: crypto.randomUUID(), name, pageId: page.id, filters: { ...filters }, drillContext: structuredClone(drillContext), visualSelections: structuredClone(visualSelections), createdAt: new Date().toISOString() }]);
    setBookmarkName("");
  }

  function applyBookmark(bookmark: PersonalBookmark) {
    setFilters(bookmark.filters);
    setDrillContext(bookmark.drillContext ?? []);
    setVisualSelections(bookmark.visualSelections ?? []);
    if (report.pages.some((item) => item.id === bookmark.pageId)) setActivePageId(bookmark.pageId);
    setDrillHistory([]);
    setActiveReportBookmarkId(undefined);
  }

  function applyReportBookmark(bookmark: ReportBookmarkDefinition, rememberCurrent = false) {
    if (rememberCurrent) setDrillHistory((current) => [...current, { pageId: page.id, filters: { ...filters }, drillContext: structuredClone(drillContext), visualSelections: structuredClone(visualSelections) }]);
    setFilters({
      from: bookmark.filters?.from ?? defaultFilters.from,
      to: bookmark.filters?.to ?? defaultFilters.to,
      Line: bookmark.filters?.Line ?? "",
      Model: bookmark.filters?.Model ?? "",
      Customer: bookmark.filters?.Customer ?? "",
      Shift: bookmark.filters?.Shift ?? "",
    });
    if (report.pages.some((item) => item.id === bookmark.pageId)) setActivePageId(bookmark.pageId);
    setDrillContext([]);
    setVisualSelections([]);
    if (!rememberCurrent) setDrillHistory([]);
    setDrillVisual(undefined);
    setActiveReportBookmarkId(bookmark.id);
  }

  function openPage(pageId: string) {
    setActivePageId(pageId);
    setDrillContext([]);
    setDrillHistory([]);
    setDrillVisual(undefined);
    setFocusedVisual(undefined);
    setDataVisual(undefined);
    setActiveReportBookmarkId(undefined);
    setVisualSelections([]);
  }

  function enterDrillthrough(target: ReportPage, field: keyof ManufacturingRecord, value: string) {
    setDrillHistory((current) => [...current, { pageId: page.id, filters: { ...filters }, drillContext: structuredClone(drillContext), visualSelections: structuredClone(visualSelections) }]);
    if (target.drillthrough?.keepAllFilters === false) setFilters({ from: "", to: "", Line: "", Model: "", Customer: "", Shift: "" });
    setDrillContext([{ id: `drillthrough-${target.id}-${field}`, field, operator: "equals", value }]);
    setVisualSelections([]);
    setActivePageId(target.id);
    setDrillVisual(undefined);
    setPane(null);
  }

  function returnFromDrillthrough() {
    const previous = drillHistory.at(-1);
    if (!previous) return;
    setActivePageId(previous.pageId);
    setFilters(previous.filters);
    setDrillContext(previous.drillContext);
    setVisualSelections(previous.visualSelections);
    setDrillHistory((current) => current.slice(0, -1));
  }

  function runReportAction(action: ReportActionDefinition) {
    if (action.type === "page" && action.targetId && report.pages.some((item) => item.id === action.targetId)) {
      setDrillHistory((current) => [...current, { pageId: page.id, filters: { ...filters }, drillContext: structuredClone(drillContext), visualSelections: structuredClone(visualSelections) }]);
      setActivePageId(action.targetId);
      setDrillContext([]);
      setDrillVisual(undefined);
      setFocusedVisual(undefined);
      setDataVisual(undefined);
      setActiveReportBookmarkId(undefined);
      setVisualSelections([]);
      return;
    }
    if (action.type === "bookmark" && action.targetId) {
      const bookmark = report.bookmarks?.find((item) => item.id === action.targetId);
      if (bookmark) applyReportBookmark(bookmark, true);
      return;
    }
    if (action.type === "back") {
      returnFromDrillthrough();
      return;
    }
    if (action.type === "resetFilters") {
      setFilters(defaultFilters);
      setDrillContext([]);
      setDrillHistory([]);
      setActiveReportBookmarkId(undefined);
      setVisualSelections([]);
    }
  }

  async function exportData(format: "csv" | "xlsx") {
    const queryFilters = [
      filters.from ? { field: "RecordDate", operator: "greaterThanOrEqual", value: filters.from } : null,
      filters.to ? { field: "RecordDate", operator: "lessThanOrEqual", value: filters.to } : null,
      ...(["Line", "Model", "Customer", "Shift"] as const).map((field) => filters[field] ? { field, operator: "equals", value: filters[field] } : null),
      ...drillContext.map((filter) => ({ field: String(filter.field), operator: filter.operator, value: String(filter.value) })),
    ].filter((item): item is { field: string; operator: string; value: string } => item !== null);
    const response = await fetch(`/api/export?format=${format}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ datasetId: dataset.id, dimensions: [], measures: [], filters: queryFilters, sort: [{ field: "RecordDate", direction: "desc" }], limit: 50_000 }) });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `${report.slug}.${format}`; anchor.click(); URL.revokeObjectURL(url);
  }

  const activeCount = [filters.from, filters.to, filters.Line, filters.Model, filters.Customer, filters.Shift].filter(Boolean).length + drillContext.length + visualSelections.length;
  const canvasState = resolveReportCanvasState({ datasetStatus: dataset.status, totalRows: typedRecords.length, metadataRows: metadataFiltered.length, filteredRows: filtered.length, visualCount: page.visuals.length + (page.controls?.length ?? 0) });
  const interactionRowsFor = (visualId: string) => resolveVisualInteractionRows(page, visualId, filtered, visualSelections);
  const canVisualInteract = (visualId: string) => page.visuals.some((target) => visualInteractionMode(page, visualId, target.id) !== "none");
  const focusedRows = focusedVisual ? interactionRowsFor(focusedVisual.id) : undefined;
  const dataRows = dataVisual ? interactionRowsFor(dataVisual.id) : undefined;
  const drillRows = drillVisual ? interactionRowsFor(drillVisual.id) : undefined;

  return <main className="report-page">
    <nav className="report-tabs" aria-label="Report pages">
      {drillHistory.length > 0 && <button className="report-tab drillthrough-back" onClick={returnFromDrillthrough}><ArrowLeft size={13} /> Back</button>}
      {visiblePages.map((item) => <button className={`report-tab ${item.id === page.id ? "active" : ""}`} key={item.id} onClick={() => openPage(item.id)}>{item.name}</button>)}
      {page.hidden && <span className="report-tab drillthrough-current"><CornerUpRight size={13} /> {page.name}</span>}
    </nav>
    <div className="report-command-bar">
      <div className="filter-summary"><Filter size={14} /><strong>{activeCount}</strong><span>active filters</span>{filters.Line && <i>{filters.Line}</i>}{filters.Model && <i>{filters.Model}</i>}{visualSelections.map((selection) => <i key={selection.sourceVisualId}>{selection.value}</i>)}</div>
      <div className="report-command-actions">
        <button className={`button ${pane === "filters" ? "active" : ""}`} onClick={() => setPane((current) => current === "filters" ? null : "filters")}><Filter size={14} /> Filters</button>
        <button className={`button ${pane === "bookmarks" ? "active" : ""}`} onClick={() => setPane((current) => current === "bookmarks" ? null : "bookmarks")}><Bookmark size={14} /> Bookmarks</button>
        <button className="button" title="Clear all filters" onClick={() => { setFilters({ ...defaultFilters, from: "", to: "" }); setVisualSelections([]); setActiveReportBookmarkId(undefined); }}><FilterX size={14} /> Clear</button>
        <button className="button" title="Reset to the report default" onClick={() => { setFilters(defaultFilters); setVisualSelections([]); setActiveReportBookmarkId(undefined); }}><RotateCcw size={14} /> Reset</button>
        <button className="button" onClick={() => exportData("csv")}><Download size={14} /> CSV</button>
        <button className="button" onClick={() => exportData("xlsx")}><Download size={14} /> Excel</button>
        {canComment && <CommentsPanel reportId={report.id} />}
      </div>
    </div>
    <div className="report-workspace">
      <div className="report-workspace-main">
        <div className="source-strip"><span>Source updated <strong>{new Date(freshness.sourceUpdatedAt).toLocaleString()}</strong></span><span>Dataset imported <strong>{new Date(freshness.importedAt).toLocaleString()}</strong></span><span>Browser loaded <strong>{browserLoadedAt ? new Date(browserLoadedAt).toLocaleString() : "Loading…"}</strong></span><span>Rows in context <strong>{filtered.length.toLocaleString()}</strong></span>{visualSelections.length > 0 && <span>Visual selections <strong>{visualSelections.length}</strong></span>}</div>
        <ReportCanvasState state={canvasState} datasetStatus={dataset.status} onReset={() => { setFilters(defaultFilters); setVisualSelections([]); }}>
          <section className="report-canvas" data-report-canvas>
            <div className="report-grid">
              {page.visuals.map((visual) => {
                const canDrillthrough = visualHierarchy(visual).some((field) => drillthroughTargets(report.pages, page.id, field).length > 0);
                const interactionRows = interactionRowsFor(visual.id);
                const selectedValue = visualSelections.find((selection) => selection.sourceVisualId === visual.id)?.value;
                return <div className="report-grid-item" style={reportGridStyle(visual)} data-visual-title={visual.title} data-filtered-rows={interactionRows.rows.length} data-highlighted-rows={interactionRows.highlightRows?.length} key={visual.id}><ReportVisual visual={visual} rows={interactionRows.rows} highlightRows={interactionRows.highlightRows} selectedValue={selectedValue} activeFilters={filters} onSelect={canVisualInteract(visual.id) ? (field, value) => selectCategory(visual.id, field, value) : undefined} onFocus={setFocusedVisual} onShowData={setDataVisual} onDrillthrough={canDrillthrough ? setDrillVisual : undefined} /></div>;
              })}
              {page.controls?.map((control) => <div className="report-grid-item" style={reportGridStyle(control)} key={control.id}><ReportControl control={control} pages={report.pages} bookmarks={report.bookmarks ?? []} activePageId={page.id} activeBookmarkId={activeReportBookmarkId} onAction={runReportAction} /></div>)}
            </div>
          </section>
        </ReportCanvasState>
      </div>
      {pane === "filters" && <FiltersPane filters={filters} setFilters={(next) => { setFilters(next); setActiveReportBookmarkId(undefined); }} unique={unique} reportFilterCount={report.filters?.length ?? 0} pageFilterCount={page.filters?.length ?? 0} drillContext={drillContext} onClose={() => setPane(null)} />}
      {pane === "bookmarks" && <BookmarksPane reportBookmarks={report.bookmarks ?? []} activeReportBookmarkId={activeReportBookmarkId} onApplyReport={applyReportBookmark} bookmarks={bookmarks} name={bookmarkName} setName={setBookmarkName} onSave={saveBookmark} onApply={applyBookmark} onDelete={(id) => persistBookmarks(bookmarks.filter((item) => item.id !== id))} onClose={() => setPane(null)} />}
    </div>
    {focusedVisual && focusedRows && <VisualDialog title={`${focusedVisual.title} — focus mode`} onClose={() => setFocusedVisual(undefined)}><ReportVisual visual={focusedVisual} rows={focusedRows.rows} highlightRows={focusedRows.highlightRows} selectedValue={visualSelections.find((selection) => selection.sourceVisualId === focusedVisual.id)?.value} activeFilters={filters} onSelect={canVisualInteract(focusedVisual.id) ? (field, value) => selectCategory(focusedVisual.id, field, value) : undefined} showActions={false} /></VisualDialog>}
    {dataVisual && dataRows && <VisualDialog title={`${dataVisual.title} — underlying data`} onClose={() => setDataVisual(undefined)}><VisualDataTable visual={dataVisual} rows={dataRows.rows} dataset={dataset} /></VisualDialog>}
    {drillVisual && drillRows && <DrillthroughDialog visual={drillVisual} rows={drillRows.rows} targets={drillthroughTargets(report.pages, page.id, drillVisual.dimension)} onEnter={enterDrillthrough} onClose={() => setDrillVisual(undefined)} />}
  </main>;
}

function reportGridStyle(visual: { x: number; y: number; w: number; h: number }): CSSProperties {
  return {
    "--report-grid-column": `${visual.x + 1} / span ${visual.w}`,
    "--report-grid-row": `${visual.y + 1} / span ${visual.h}`,
    "--report-grid-height": visual.h,
    "--report-grid-compact-width": Math.min(6, visual.w),
    "--report-grid-mobile-width": Math.min(2, visual.w),
  } as CSSProperties;
}

function FiltersPane({ filters, setFilters, unique, reportFilterCount, pageFilterCount, drillContext, onClose }: { filters: Filters; setFilters: (filters: Filters) => void; unique: (field: "Line" | "Model" | "Customer" | "Shift") => string[]; reportFilterCount: number; pageFilterCount: number; drillContext: ReportFilterDefinition[]; onClose: () => void }) {
  return <aside className="insight-pane" aria-label="Report filters">
    <div className="insight-pane-header"><div><strong>Filters</strong><span>Report, page, and viewer context</span></div><button className="icon-button" onClick={onClose} aria-label="Close filters"><X size={14} /></button></div>
    {(reportFilterCount > 0 || pageFilterCount > 0 || drillContext.length > 0) && <div className="filter-scope-summary"><span>{reportFilterCount} report-level</span><span>{pageFilterCount} page-level</span>{drillContext.map((filter) => <span key={filter.id}>Drillthrough: {String(filter.field)} = {String(filter.value)}</span>)}</div>}
    <div className="form-stack insight-pane-body">
      <label>Date from<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
      <label>Date to<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
      {(["Line", "Model", "Customer", "Shift"] as const).map((field) => <label key={field}>{field}<select value={filters[field]} onChange={(event) => setFilters({ ...filters, [field]: event.target.value })}><option value="">All</option>{unique(field).map((value) => <option key={value}>{value}</option>)}</select></label>)}
    </div>
  </aside>;
}

function BookmarksPane({ reportBookmarks, activeReportBookmarkId, onApplyReport, bookmarks, name, setName, onSave, onApply, onDelete, onClose }: { reportBookmarks: ReportBookmarkDefinition[]; activeReportBookmarkId?: string; onApplyReport: (bookmark: ReportBookmarkDefinition) => void; bookmarks: PersonalBookmark[]; name: string; setName: (value: string) => void; onSave: () => void; onApply: (bookmark: PersonalBookmark) => void; onDelete: (id: string) => void; onClose: () => void }) {
  return <aside className="insight-pane" aria-label="Personal bookmarks">
    <div className="insight-pane-header"><div><strong>Bookmarks</strong><span>Published and personal views</span></div><button className="icon-button" onClick={onClose} aria-label="Close bookmarks"><X size={14} /></button></div>
    <div className="bookmark-section-label"><strong>Report bookmarks</strong><span>Authored with this report</span></div>
    <div className="bookmark-list report-bookmark-list">{reportBookmarks.map((bookmark) => <div className={`bookmark-item ${bookmark.id === activeReportBookmarkId ? "active" : ""}`} key={bookmark.id}><button onClick={() => onApplyReport(bookmark)}><strong>{bookmark.name}</strong><span>{bookmark.id === activeReportBookmarkId ? "Current shared view" : "Shared report view"}</span></button></div>)}{!reportBookmarks.length && <div className="empty-state compact">This report has no published bookmarks yet.</div>}</div>
    <div className="bookmark-section-label"><strong>Personal bookmarks</strong><span>Saved in this browser</span></div>
    <div className="bookmark-create"><input aria-label="Bookmark name" placeholder={`Bookmark ${bookmarks.length + 1}`} value={name} onChange={(event) => setName(event.target.value)} /><button className="button primary" onClick={onSave}><Plus size={14} /> Add</button></div>
    <div className="bookmark-list">{bookmarks.map((bookmark) => <div className="bookmark-item" key={bookmark.id}><button onClick={() => onApply(bookmark)}><strong>{bookmark.name}</strong><span>{new Date(bookmark.createdAt).toLocaleString()}</span></button><button className="icon-button danger" aria-label={`Delete ${bookmark.name}`} onClick={() => onDelete(bookmark.id)}><Trash2 size={13} /></button></div>)}{!bookmarks.length && <div className="empty-state compact">Capture the current page and filters as a personal bookmark.</div>}</div>
  </aside>;
}

function DrillthroughDialog({ visual, rows, targets, onEnter, onClose }: { visual: VisualDefinition; rows: ManufacturingRecord[]; targets: ReportPage[]; onEnter: (target: ReportPage, field: keyof ManufacturingRecord, value: string) => void; onClose: () => void }) {
  const field = visual.dimension;
  const values = useMemo(() => field ? [...new Set(applyReportFilters(rows, visual.filters).map((row) => String(row[field] ?? "")))].filter(Boolean).sort() : [], [field, rows, visual.filters]);
  const [value, setValue] = useState(values[0] ?? "");
  const [targetId, setTargetId] = useState(targets[0]?.id ?? "");
  const target = targets.find((item) => item.id === targetId);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="drillthrough-dialog" role="dialog" aria-modal="true" aria-label={`${visual.title} — drill through`}>
      <header><div><span className="eyebrow">Drill through</span><h2>{visual.title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close drillthrough"><X size={16} /></button></header>
      <div className="form-stack">
        <p>Open a detail page with the selected category and current viewer filters.</p>
        <label>Field<input value={field ? String(field) : "No category field"} readOnly /></label>
        <label>Value<select aria-label="Drillthrough value" value={value} onChange={(event) => setValue(event.target.value)}>{values.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Target page<select aria-label="Drillthrough target page" value={targetId} onChange={(event) => setTargetId(event.target.value)}>{targets.map((item) => <option value={item.id} key={item.id}>{item.name}{item.hidden ? " (hidden)" : ""}</option>)}</select></label>
        {target?.drillthrough?.keepAllFilters !== false && <small>Current date and viewer filters will be preserved.</small>}
        {!targets.length && <div className="empty-state compact">No page accepts this field as drillthrough context.</div>}
      </div>
      <footer><button className="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={!field || !value || !target} onClick={() => { if (field && value && target) onEnter(target, field, value); }}><CornerUpRight size={14} /> Open detail</button></footer>
    </section>
  </div>;
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
