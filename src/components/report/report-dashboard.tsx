"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft, Bookmark, ChevronLeft, ChevronRight, CornerUpRight, Download, FileImage, FileText, Filter, FilterX, Lock, MonitorPlay, Plus, Presentation, RotateCcw, Trash2, X } from "lucide-react";
import { CommentsPanel } from "./comments-panel";
import { ReportCanvasState } from "./report-canvas-state";
import { ReportControl } from "./report-control";
import { ReportVisual } from "./report-visual";
import { captureReportCanvas, downloadReportImage, downloadReportPdf, downloadReportPowerPoint, type ReportPageCapture } from "@/lib/report-export";
import { applyReportFilters, drillthroughTargets, resolveReportCanvasState, resolveVisualInteractionRows, visualData, visualHierarchy, visualInteractionMode, type VisualInteractionSelection } from "@/lib/reporting";
import type { Dataset, ManufacturingRecord, Report, ReportActionDefinition, ReportBookmarkDefinition, ReportFilterDefinition, ReportPage, VisualDefinition } from "@/types";

interface Filters { from: string; to: string; Line: string; Model: string; Customer: string; Shift: string }
type FilterOverrideMap = Record<string, Partial<ReportFilterDefinition>>;
interface PersonalBookmark { id: string; name: string; pageId: string; filters: Filters; drillContext?: ReportFilterDefinition[]; visualSelections?: VisualInteractionSelection[]; filterOverrides?: FilterOverrideMap; createdAt: string }
interface DrillHistoryEntry { pageId: string; filters: Filters; drillContext: ReportFilterDefinition[]; visualSelections: VisualInteractionSelection[]; filterOverrides: FilterOverrideMap }
type InsightPane = "filters" | "bookmarks" | null;

function applyFilterOverrides(filters: ReportFilterDefinition[], overrides: FilterOverrideMap): ReportFilterDefinition[] {
  return filters.map((filter) => {
    const override = overrides[filter.id];
    if (!override || filter.locked) return filter;
    return {
      ...filter,
      ...override,
      topN: override.topN ? { ...filter.topN, ...override.topN } as ReportFilterDefinition["topN"] : filter.topN,
      relativeDate: override.relativeDate ? { ...filter.relativeDate, ...override.relativeDate } as ReportFilterDefinition["relativeDate"] : filter.relativeDate,
      clauses: override.clauses ?? filter.clauses,
    };
  });
}

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
  const [filterOverrides, setFilterOverrides] = useState<FilterOverrideMap>({});
  const [exportMenu, setExportMenu] = useState(false);
  const [exportBusy, setExportBusy] = useState<"png" | "pdf" | "pptx">();
  const [exportMessage, setExportMessage] = useState("");
  const [presentationMode, setPresentationMode] = useState(false);
  const page = (report.pages.find((item) => item.id === activePageId) ?? visiblePages[0] ?? report.pages[0])!;
  const effectiveReportFilters = useMemo(() => applyFilterOverrides(report.filters ?? [], filterOverrides), [filterOverrides, report.filters]);
  const effectivePageFilters = useMemo(() => applyFilterOverrides(page.filters ?? [], filterOverrides), [filterOverrides, page.filters]);
  const metadataFiltered = useMemo(() => applyReportFilters(typedRecords, [...effectiveReportFilters, ...effectivePageFilters, ...drillContext]), [drillContext, effectivePageFilters, effectiveReportFilters, typedRecords]);
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

  useEffect(() => {
    if (!presentationMode) return;
    document.documentElement.dataset.presentationMode = "true";
    const exit = () => {
      if (!document.fullscreenElement) setPresentationMode(false);
    };
    document.addEventListener("fullscreenchange", exit);
    return () => {
      delete document.documentElement.dataset.presentationMode;
      document.removeEventListener("fullscreenchange", exit);
    };
  }, [presentationMode]);

  useEffect(() => {
    if (!presentationMode) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      const current = visiblePages.findIndex((item) => item.id === page.id);
      if (event.key === "Escape") { setPresentationMode(false); if (document.fullscreenElement) void document.exitFullscreen(); }
      else if (event.key === "ArrowRight" || event.key === "PageDown") { event.preventDefault(); setActivePageId(visiblePages[(current + 1) % visiblePages.length]?.id ?? page.id); }
      else if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); setActivePageId(visiblePages[(current - 1 + visiblePages.length) % visiblePages.length]?.id ?? page.id); }
      else if (event.key === "Home") { event.preventDefault(); setActivePageId(visiblePages[0]?.id ?? page.id); }
      else if (event.key === "End") { event.preventDefault(); setActivePageId(visiblePages.at(-1)?.id ?? page.id); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [page.id, presentationMode, visiblePages]);

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
    persistBookmarks([...bookmarks, { id: crypto.randomUUID(), name, pageId: page.id, filters: { ...filters }, drillContext: structuredClone(drillContext), visualSelections: structuredClone(visualSelections), filterOverrides: structuredClone(filterOverrides), createdAt: new Date().toISOString() }]);
    setBookmarkName("");
  }

  function applyBookmark(bookmark: PersonalBookmark) {
    setFilters(bookmark.filters);
    setDrillContext(bookmark.drillContext ?? []);
    setVisualSelections(bookmark.visualSelections ?? []);
    setFilterOverrides(bookmark.filterOverrides ?? {});
    if (report.pages.some((item) => item.id === bookmark.pageId)) setActivePageId(bookmark.pageId);
    setDrillHistory([]);
    setActiveReportBookmarkId(undefined);
  }

  function applyReportBookmark(bookmark: ReportBookmarkDefinition, rememberCurrent = false) {
    if (rememberCurrent) setDrillHistory((current) => [...current, { pageId: page.id, filters: { ...filters }, drillContext: structuredClone(drillContext), visualSelections: structuredClone(visualSelections), filterOverrides: structuredClone(filterOverrides) }]);
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
    setFilterOverrides({});
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
    setDrillHistory((current) => [...current, { pageId: page.id, filters: { ...filters }, drillContext: structuredClone(drillContext), visualSelections: structuredClone(visualSelections), filterOverrides: structuredClone(filterOverrides) }]);
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
    setFilterOverrides(previous.filterOverrides);
    setDrillHistory((current) => current.slice(0, -1));
  }

  function runReportAction(action: ReportActionDefinition) {
    if (action.type === "page" && action.targetId && report.pages.some((item) => item.id === action.targetId)) {
      setDrillHistory((current) => [...current, { pageId: page.id, filters: { ...filters }, drillContext: structuredClone(drillContext), visualSelections: structuredClone(visualSelections), filterOverrides: structuredClone(filterOverrides) }]);
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
      setFilterOverrides({});
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

  const nextCanvasPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  async function capturePages(targetPages: ReportPage[]): Promise<ReportPageCapture[]> {
    const previousPageId = page.id;
    const captures: ReportPageCapture[] = [];
    for (const target of targetPages) {
      setActivePageId(target.id);
      await nextCanvasPaint();
      const canvas = document.querySelector<HTMLElement>("[data-report-canvas]");
      if (!canvas) throw new Error(`Unable to capture ${target.name}.`);
      captures.push({ pageName: target.name, ...await captureReportCanvas(canvas) });
    }
    setActivePageId(previousPageId);
    await nextCanvasPaint();
    return captures;
  }

  async function exportReport(format: "png" | "pdf" | "pptx") {
    setExportBusy(format);
    setExportMenu(false);
    setExportMessage(`Preparing ${format === "pptx" ? "PowerPoint" : format.toLocaleUpperCase()}…`);
    try {
      const captures = await capturePages(format === "png" ? [page] : visiblePages);
      if (format === "png") await downloadReportImage(captures[0]!, report.slug);
      else if (format === "pdf") await downloadReportPdf(captures, report.slug);
      else await downloadReportPowerPoint(captures, report.name, report.slug);
      setExportMessage(`${format === "pptx" ? "PowerPoint" : format.toLocaleUpperCase()} export ready.`);
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "Report export failed.");
    } finally {
      setExportBusy(undefined);
    }
  }

  async function enterPresentation() {
    setPane(null);
    setExportMenu(false);
    setPresentationMode(true);
    try { await document.documentElement.requestFullscreen?.(); } catch { /* Presentation mode still works when fullscreen permission is unavailable. */ }
  }

  function exitPresentation() {
    setPresentationMode(false);
    if (document.fullscreenElement) void document.exitFullscreen();
  }

  const activeCount = [filters.from, filters.to, filters.Line, filters.Model, filters.Customer, filters.Shift].filter(Boolean).length + effectiveReportFilters.length + effectivePageFilters.length + drillContext.length + visualSelections.length;
  const visibleVisuals = page.visuals.filter((visual) => !visual.hidden);
  const visibleControls = page.controls?.filter((control) => !control.hidden) ?? [];
  const canvasState = resolveReportCanvasState({ datasetStatus: dataset.status, totalRows: typedRecords.length, metadataRows: metadataFiltered.length, filteredRows: filtered.length, visualCount: visibleVisuals.length + visibleControls.length });
  const interactionRowsFor = (visualId: string) => resolveVisualInteractionRows(page, visualId, filtered, visualSelections);
  const canVisualInteract = (visualId: string) => visibleVisuals.some((target) => visualInteractionMode(page, visualId, target.id) !== "none");
  const focusedRows = focusedVisual ? interactionRowsFor(focusedVisual.id) : undefined;
  const dataRows = dataVisual ? interactionRowsFor(dataVisual.id) : undefined;
  const drillRows = drillVisual ? interactionRowsFor(drillVisual.id) : undefined;

  return <main className={`report-page ${presentationMode ? "presentation-mode" : ""}`} style={reportThemeStyle(report)} data-report-theme={report.theme?.name}>
    {presentationMode && <div className="presentation-toolbar" role="toolbar" aria-label="Presentation navigation"><strong>{report.name}</strong><span>{page.name} · {visiblePages.findIndex((item) => item.id === page.id) + 1} / {visiblePages.length}</span><button className="icon-button" aria-label="Previous report page" onClick={() => setActivePageId(visiblePages[(visiblePages.findIndex((item) => item.id === page.id) - 1 + visiblePages.length) % visiblePages.length]?.id ?? page.id)}><ChevronLeft size={16} /></button><button className="icon-button" aria-label="Next report page" onClick={() => setActivePageId(visiblePages[(visiblePages.findIndex((item) => item.id === page.id) + 1) % visiblePages.length]?.id ?? page.id)}><ChevronRight size={16} /></button><button className="button" onClick={exitPresentation}><X size={14} /> Exit</button></div>}
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
        <button className="button" title="Reset to the report default" onClick={() => { setFilters(defaultFilters); setVisualSelections([]); setFilterOverrides({}); setActiveReportBookmarkId(undefined); }}><RotateCcw size={14} /> Reset</button>
        <button className="button" onClick={() => exportData("csv")}><Download size={14} /> CSV</button>
        <button className="button" onClick={() => exportData("xlsx")}><Download size={14} /> Excel</button>
        <div className="export-menu-wrap"><button className={`button ${exportMenu ? "active" : ""}`} aria-expanded={exportMenu} aria-haspopup="menu" disabled={Boolean(exportBusy)} onClick={() => setExportMenu((current) => !current)}><FileImage size={14} /> {exportBusy ? "Exporting…" : "Export"}</button>{exportMenu && <div className="export-menu" role="menu" aria-label="Report export formats"><button role="menuitem" onClick={() => void exportReport("png")}><FileImage size={14} /><span><strong>PNG image</strong><small>Current report page</small></span></button><button role="menuitem" onClick={() => void exportReport("pdf")}><FileText size={14} /><span><strong>PDF document</strong><small>All visible pages</small></span></button><button role="menuitem" onClick={() => void exportReport("pptx")}><Presentation size={14} /><span><strong>PowerPoint</strong><small>One slide per visible page</small></span></button></div>}</div>
        <button className="button" onClick={() => void enterPresentation()}><MonitorPlay size={14} /> Present</button>
        {canComment && <CommentsPanel reportId={report.id} />}
      </div>
    </div>
    {exportMessage && <div className="export-status" role="status">{exportMessage}<button className="icon-button" aria-label="Dismiss export status" onClick={() => setExportMessage("")}><X size={12} /></button></div>}
    <div className="report-workspace">
      <div className="report-workspace-main">
        <div className="source-strip"><span>Source updated <strong>{new Date(freshness.sourceUpdatedAt).toLocaleString()}</strong></span><span>Dataset imported <strong>{new Date(freshness.importedAt).toLocaleString()}</strong></span><span>Browser loaded <strong>{browserLoadedAt ? new Date(browserLoadedAt).toLocaleString() : "Loading…"}</strong></span><span>Rows in context <strong>{filtered.length.toLocaleString()}</strong></span>{visualSelections.length > 0 && <span>Visual selections <strong>{visualSelections.length}</strong></span>}</div>
        <ReportCanvasState state={canvasState} datasetStatus={dataset.status} onReset={() => { setFilters(defaultFilters); setVisualSelections([]); setFilterOverrides({}); }}>
          <section className="report-canvas" data-report-canvas style={reportCanvasStyle(report, page)}>
            <div className="report-grid">
              {visibleVisuals.map((visual) => {
                const canDrillthrough = visualHierarchy(visual).some((field) => drillthroughTargets(report.pages, page.id, field).length > 0);
                const interactionRows = interactionRowsFor(visual.id);
                const selectedValue = visualSelections.find((selection) => selection.sourceVisualId === visual.id)?.value;
                return <div className={`report-grid-item ${mobileHidden(page, visual.id) ? "mobile-hidden" : ""}`} style={reportGridStyle(visual, page)} data-visual-title={visual.title} data-filtered-rows={interactionRows.rows.length} data-highlighted-rows={interactionRows.highlightRows?.length} key={visual.id}><ReportVisual visual={visual} rows={interactionRows.rows} highlightRows={interactionRows.highlightRows} selectedValue={selectedValue} activeFilters={filters} onSelect={canVisualInteract(visual.id) ? (field, value) => selectCategory(visual.id, field, value) : undefined} onFocus={setFocusedVisual} onShowData={setDataVisual} onDrillthrough={canDrillthrough ? setDrillVisual : undefined} /></div>;
              })}
              {visibleControls.map((control) => <div className={`report-grid-item ${mobileHidden(page, control.id) ? "mobile-hidden" : ""}`} style={reportGridStyle(control, page)} key={control.id}><ReportControl control={control} pages={report.pages} bookmarks={report.bookmarks ?? []} activePageId={page.id} activeBookmarkId={activeReportBookmarkId} onAction={runReportAction} /></div>)}
            </div>
          </section>
        </ReportCanvasState>
      </div>
      {pane === "filters" && <FiltersPane filters={filters} setFilters={(next) => { setFilters(next); setActiveReportBookmarkId(undefined); }} unique={unique} reportFilters={effectiveReportFilters} pageFilters={effectivePageFilters} drillContext={drillContext} onOverride={(filterId, override) => { setFilterOverrides((current) => ({ ...current, [filterId]: { ...current[filterId], ...override } })); setActiveReportBookmarkId(undefined); }} onClose={() => setPane(null)} />}
      {pane === "bookmarks" && <BookmarksPane reportBookmarks={report.bookmarks ?? []} activeReportBookmarkId={activeReportBookmarkId} onApplyReport={applyReportBookmark} bookmarks={bookmarks} name={bookmarkName} setName={setBookmarkName} onSave={saveBookmark} onApply={applyBookmark} onDelete={(id) => persistBookmarks(bookmarks.filter((item) => item.id !== id))} onClose={() => setPane(null)} />}
    </div>
    {focusedVisual && focusedRows && <VisualDialog title={`${focusedVisual.title} — focus mode`} onClose={() => setFocusedVisual(undefined)}><ReportVisual visual={focusedVisual} rows={focusedRows.rows} highlightRows={focusedRows.highlightRows} selectedValue={visualSelections.find((selection) => selection.sourceVisualId === focusedVisual.id)?.value} activeFilters={filters} onSelect={canVisualInteract(focusedVisual.id) ? (field, value) => selectCategory(focusedVisual.id, field, value) : undefined} showActions={false} /></VisualDialog>}
    {dataVisual && dataRows && <VisualDialog title={`${dataVisual.title} — underlying data`} onClose={() => setDataVisual(undefined)}><VisualDataTable visual={dataVisual} rows={dataRows.rows} dataset={dataset} /></VisualDialog>}
    {drillVisual && drillRows && <DrillthroughDialog visual={drillVisual} rows={drillRows.rows} targets={drillthroughTargets(report.pages, page.id, drillVisual.dimension)} onEnter={enterDrillthrough} onClose={() => setDrillVisual(undefined)} />}
  </main>;
}

function reportThemeStyle(report: Report): CSSProperties {
  if (!report.theme) return {};
  return {
    "--accent": report.theme.accentColor,
    "--accent-2": report.theme.secondaryColor,
    "--surface": report.theme.surfaceColor,
    "--text": report.theme.textColor,
    fontFamily: report.theme.fontFamily,
  } as CSSProperties;
}

function reportCanvasStyle(report: Report, page: ReportPage): CSSProperties {
  const canvas = page.canvas ?? {};
  const wallpaper = canvas.wallpaperUrl?.trim();
  return {
    backgroundColor: canvas.backgroundColor ?? report.theme?.canvasColor,
    backgroundImage: wallpaper ? `url(${JSON.stringify(wallpaper)})` : undefined,
    backgroundPosition: "center",
    backgroundRepeat: canvas.wallpaperFit === "contain" ? "no-repeat" : undefined,
    backgroundSize: canvas.wallpaperFit === "fill" ? "100% 100%" : canvas.wallpaperFit ?? "cover",
  };
}

function mobileHidden(page: ReportPage, itemId: string) {
  if (!page.mobileLayout?.enabled) return false;
  const item = page.mobileLayout.items.find((entry) => entry.itemId === itemId);
  return !item || Boolean(item.hidden);
}

function reportGridStyle(visual: { id: string; x: number; y: number; w: number; h: number }, page: ReportPage): CSSProperties {
  const mobile = page.mobileLayout?.enabled ? page.mobileLayout.items.find((item) => item.itemId === visual.id) : undefined;
  return {
    "--report-grid-column": `${visual.x + 1} / span ${visual.w}`,
    "--report-grid-row": `${visual.y + 1} / span ${visual.h}`,
    "--report-grid-height": visual.h,
    "--report-grid-compact-width": Math.min(6, visual.w),
    "--report-grid-mobile-width": Math.min(2, visual.w),
    "--report-grid-mobile-column": mobile ? `${mobile.x + 1} / span ${mobile.w}` : `span ${Math.min(2, visual.w)}`,
    "--report-grid-mobile-row": mobile ? `${mobile.y + 1} / span ${mobile.h}` : "auto",
    "--report-grid-mobile-height": mobile?.h ?? visual.h,
  } as CSSProperties;
}

function formatFilterOperator(operator: ReportFilterDefinition["operator"]) {
  return ({
    equals: "is", notEquals: "is not", contains: "contains", notContains: "does not contain",
    startsWith: "starts with", endsWith: "ends with", greaterThan: "is greater than",
    greaterThanOrEqual: "is on or after", lessThan: "is less than", lessThanOrEqual: "is on or before",
    isBlank: "is blank", isNotBlank: "is not blank",
  } satisfies Record<ReportFilterDefinition["operator"], string>)[operator];
}

function filterSummary(filter: ReportFilterDefinition) {
  if (filter.mode === "topN" && filter.topN) return `${filter.topN.direction === "top" ? "Top" : "Bottom"} ${filter.topN.count} by ${String(filter.topN.byMeasure)}`;
  if (filter.mode === "relativeDate" && filter.relativeDate) {
    const relative = filter.relativeDate;
    if (relative.direction === "current") return `Current ${relative.unit.slice(0, -1)}`;
    return `${relative.direction === "last" ? "Last" : "Next"} ${relative.amount} ${relative.amount === 1 ? relative.unit.slice(0, -1) : relative.unit}${relative.includeToday ? " including today" : ""}`;
  }
  if (filter.mode === "advanced" && filter.clauses?.length) return filter.clauses.map((clause) => `${formatFilterOperator(clause.operator)}${clause.value === undefined || clause.value === "" ? "" : ` ${clause.value}`}`).join(` ${filter.logicalOperator === "or" ? "OR" : "AND"} `);
  return `${formatFilterOperator(filter.operator)}${filter.value === "" ? "" : ` ${filter.value}`}`;
}

function MetadataFilterCard({ filter, scope, onOverride }: { filter: ReportFilterDefinition; scope: "Report" | "Page"; onOverride: (filterId: string, override: Partial<ReportFilterDefinition>) => void }) {
  const mode = filter.mode ?? "basic";
  return <section className={`viewer-metadata-filter ${filter.locked ? "locked" : ""}`} data-filter-id={filter.id}>
    <header><div><span>{scope} filter</span><strong>{String(filter.field)}</strong></div>{filter.locked && <span className="filter-lock-badge"><Lock size={11} /> Locked</span>}</header>
    {filter.locked ? <p>{filterSummary(filter)}</p> : <div className="form-stack compact">
      {mode === "basic" && !["isBlank", "isNotBlank"].includes(filter.operator) && <label>{formatFilterOperator(filter.operator)}<input aria-label={`Filter value for ${String(filter.field)}`} value={String(filter.value ?? "")} onChange={(event) => onOverride(filter.id, { value: event.target.value })} /></label>}
      {mode === "advanced" && <>
        <span className="metadata-filter-logic">Match {filter.logicalOperator === "or" ? "any" : "all"} conditions</span>
        {(filter.clauses ?? []).map((clause, index) => <label key={`${filter.id}-clause-${index}`}>{formatFilterOperator(clause.operator)}{!["isBlank", "isNotBlank"].includes(clause.operator) && <input aria-label={`Condition ${index + 1} for ${String(filter.field)}`} value={String(clause.value ?? "")} onChange={(event) => { const clauses = [...(filter.clauses ?? [])]; clauses[index] = { ...clause, value: event.target.value }; onOverride(filter.id, { clauses }); }} />}</label>)}
      </>}
      {mode === "topN" && filter.topN && <div className="viewer-filter-inline"><label>{filter.topN.direction === "top" ? "Top" : "Bottom"}<input type="number" min={1} max={100} aria-label={`Top N count for ${String(filter.field)}`} value={filter.topN.count} onChange={(event) => onOverride(filter.id, { topN: { ...filter.topN!, count: Math.max(1, Number(event.target.value) || 1) } })} /></label><span>by {String(filter.topN.byMeasure)}</span></div>}
      {mode === "relativeDate" && filter.relativeDate && <div className="viewer-filter-inline"><label>{filter.relativeDate.direction === "last" ? "Last" : filter.relativeDate.direction === "next" ? "Next" : "Current"}<input type="number" min={1} max={3650} disabled={filter.relativeDate.direction === "current"} aria-label={`Relative date amount for ${String(filter.field)}`} value={filter.relativeDate.amount} onChange={(event) => onOverride(filter.id, { relativeDate: { ...filter.relativeDate!, amount: Math.max(1, Number(event.target.value) || 1) } })} /></label><span>{filter.relativeDate.unit}</span></div>}
    </div>}
  </section>;
}

function FiltersPane({ filters, setFilters, unique, reportFilters, pageFilters, drillContext, onOverride, onClose }: { filters: Filters; setFilters: (filters: Filters) => void; unique: (field: "Line" | "Model" | "Customer" | "Shift") => string[]; reportFilters: ReportFilterDefinition[]; pageFilters: ReportFilterDefinition[]; drillContext: ReportFilterDefinition[]; onOverride: (filterId: string, override: Partial<ReportFilterDefinition>) => void; onClose: () => void }) {
  const visibleReportFilters = reportFilters.filter((filter) => !filter.hidden);
  const visiblePageFilters = pageFilters.filter((filter) => !filter.hidden);
  return <aside className="insight-pane" aria-label="Report filters">
    <div className="insight-pane-header"><div><strong>Filters</strong><span>Report, page, and viewer context</span></div><button className="icon-button" onClick={onClose} aria-label="Close filters"><X size={14} /></button></div>
    {(visibleReportFilters.length > 0 || visiblePageFilters.length > 0 || drillContext.length > 0) && <div className="filter-scope-summary"><span>{visibleReportFilters.length} report-level</span><span>{visiblePageFilters.length} page-level</span>{drillContext.map((filter) => <span key={filter.id}>Drillthrough: {String(filter.field)} = {String(filter.value)}</span>)}</div>}
    <div className="form-stack insight-pane-body">
      {visibleReportFilters.map((filter) => <MetadataFilterCard key={filter.id} filter={filter} scope="Report" onOverride={onOverride} />)}
      {visiblePageFilters.map((filter) => <MetadataFilterCard key={filter.id} filter={filter} scope="Page" onOverride={onOverride} />)}
      {(visibleReportFilters.length > 0 || visiblePageFilters.length > 0) && <div className="viewer-filter-divider"><span>Viewer filters</span></div>}
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
