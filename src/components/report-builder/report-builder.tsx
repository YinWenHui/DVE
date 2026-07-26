"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GridLayout, { type Layout } from "react-grid-layout";
import { Ban, BarChart3, Bookmark, Copy, CreditCard, Eye, EyeOff, Filter, Layers3, LineChart, MousePointerClick, Navigation, Paintbrush, Plus, RotateCcw, Save, SlidersHorizontal, Sparkles, Table2, Trash2 } from "lucide-react";
import { ReportControl } from "@/components/report/report-control";
import { ReportVisual } from "@/components/report/report-visual";
import type { Aggregation, Dataset, ManufacturingRecord, Report, ReportActionType, ReportBookmarkDefinition, ReportControlDefinition, ReportControlType, ReportFilterDefinition, ReportPage, VisualDefinition, VisualInteractionMode, VisualType } from "@/types";

const tools: Array<{ type: VisualType; label: string; icon: typeof BarChart3 }> = [
  { type: "kpi", label: "KPI card", icon: CreditCard },
  { type: "bar", label: "Bar chart", icon: BarChart3 },
  { type: "column", label: "Column chart", icon: BarChart3 },
  { type: "stackedBar", label: "Stacked bar", icon: Layers3 },
  { type: "stackedColumn", label: "Stacked column", icon: Layers3 },
  { type: "line", label: "Line chart", icon: LineChart },
  { type: "area", label: "Area chart", icon: LineChart },
  { type: "combo", label: "Line + column", icon: LineChart },
  { type: "scatter", label: "Scatter plot", icon: BarChart3 },
  { type: "doughnut", label: "Doughnut", icon: BarChart3 },
  { type: "treemap", label: "Treemap", icon: Layers3 },
  { type: "funnel", label: "Funnel", icon: Layers3 },
  { type: "waterfall", label: "Waterfall", icon: BarChart3 },
  { type: "gauge", label: "Gauge", icon: CreditCard },
  { type: "table", label: "Table", icon: Table2 },
  { type: "matrix", label: "Matrix", icon: Table2 },
  { type: "slicer", label: "Slicer", icon: SlidersHorizontal },
];

type SettingsTab = "build" | "format" | "filters";

export function ReportBuilder({ datasets, records = [], initial }: { datasets: Dataset[]; records?: Record<string, unknown>[]; initial?: Report }) {
  const router = useRouter();
  const dataset = datasets.find((item) => item.id === initial?.datasetId) ?? datasets[0];
  const [name, setName] = useState(initial?.name ?? "Untitled report");
  const [slug, setSlug] = useState(initial?.slug ?? "untitled-report");
  const [description, setDescription] = useState(initial?.description ?? "Created with the Digital Verse report builder.");
  const [datasetId, setDatasetId] = useState(dataset?.id ?? "");
  const [pages, setPages] = useState<ReportPage[]>(() => structuredClone(initial?.pages ?? [{ id: crypto.randomUUID(), name: "Overview", ordinal: 0, visuals: [] }]));
  const [reportFilters, setReportFilters] = useState<ReportFilterDefinition[]>(() => structuredClone(initial?.filters ?? []));
  const [bookmarks, setBookmarks] = useState<ReportBookmarkDefinition[]>(() => structuredClone(initial?.bookmarks ?? []));
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string>();
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("build");
  const [message, setMessage] = useState<string>();
  const page = pages[pageIndex] ?? pages[0];
  const selected = page?.visuals.find((visual) => visual.id === selectedId);
  const selectedControl = page?.controls?.find((control) => control.id === selectedId);
  const selectedBookmark = bookmarks.find((bookmark) => bookmark.id === selectedBookmarkId);
  const selectedDataset = datasets.find((item) => item.id === datasetId);
  const dimensions = selectedDataset?.fields.filter((field) => !field.hidden && field.semanticType !== "measure") ?? [];
  const measures = selectedDataset?.fields.filter((field) => !field.hidden && field.semanticType === "measure") ?? [];
  const filterFields = selectedDataset?.fields.filter((field) => !field.hidden && field.filterable) ?? [];
  const previewRows = records as unknown as ManufacturingRecord[];
  const layout = useMemo<Layout[]>(() => [
    ...(page?.visuals.map((visual) => ({ i: visual.id, x: visual.x, y: visual.y, w: visual.w, h: visual.h, minW: 2, minH: 2 })) ?? []),
    ...(page?.controls?.map((control) => ({ i: control.id, x: control.x, y: control.y, w: control.w, h: control.h, minW: 2, minH: 1 })) ?? []),
  ], [page]);

  function addVisual(type: VisualType) {
    if (!page) return;
    const id = crypto.randomUUID();
    const measure = measures[0]?.key as VisualDefinition["measure"];
    const secondaryMeasure = measures[1]?.key as VisualDefinition["secondaryMeasure"];
    const dimension = dimensions[0]?.key as VisualDefinition["dimension"];
    const nextY = page.visuals.reduce((maximum, visual) => Math.max(maximum, visual.y + visual.h), 0);
    const needsSecondary = ["stackedBar", "stackedColumn", "combo", "scatter"].includes(type);
    const supportsHierarchy = !["kpi", "gauge", "table", "matrix", "slicer", "scatter"].includes(type);
    const compact = type === "kpi";
    const visual: VisualDefinition = {
      id,
      type,
      title: tools.find((item) => item.type === type)?.label ?? "Visual",
      x: 0,
      y: nextY,
      w: compact ? 3 : 6,
      h: compact ? 2 : 5,
      measure: ["table", "matrix", "slicer"].includes(type) ? undefined : measure,
      secondaryMeasure: needsSecondary ? secondaryMeasure : undefined,
      dimension: ["kpi", "gauge", "table", "matrix"].includes(type) ? undefined : dimension,
      hierarchy: supportsHierarchy && dimension ? [dimension] : [],
      aggregation: "sum",
      display: { showTitle: true, showLegend: ["doughnut", "treemap", "funnel", "combo", "stackedBar", "stackedColumn"].includes(type), showDataLabels: false, showGridlines: true, accentColor: "#5c73e6", borderRadius: 10, titleAlignment: "left" },
      interaction: { crossFilter: true, tooltips: true },
      filters: [],
    };
    updatePage({ ...page, visuals: [...page.visuals, visual] });
    setSelectedId(id);
    setSelectedBookmarkId(undefined);
    setSettingsTab("build");
  }

  function addControl(type: ReportControlType) {
    if (!page) return;
    const id = crypto.randomUUID();
    const nextY = [...page.visuals, ...(page.controls ?? [])].reduce((maximum, item) => Math.max(maximum, item.y + item.h), 0);
    const firstVisiblePage = pages.find((item) => !item.hidden) ?? pages[0];
    const control: ReportControlDefinition = {
      id,
      type,
      title: type === "button" ? "Open page" : type === "pageNavigator" ? "Report pages" : "Saved views",
      x: 0,
      y: nextY,
      w: type === "button" ? 3 : 6,
      h: 1,
      action: type === "button" ? { type: "page", targetId: firstVisiblePage?.id } : undefined,
      display: { accentColor: "#5c73e6", backgroundColor: "#ffffff", textColor: "#172033", borderRadius: 9 },
    };
    updatePage({ ...page, controls: [...(page.controls ?? []), control] });
    setSelectedId(id);
    setSelectedBookmarkId(undefined);
    setSettingsTab("build");
  }

  function updatePage(nextPage: ReportPage) {
    setPages((current) => current.map((item, index) => index === pageIndex ? nextPage : item));
  }

  function updateSelected(changes: Partial<VisualDefinition>) {
    if (!page || !selectedId) return;
    updatePage({ ...page, visuals: page.visuals.map((visual) => visual.id === selectedId ? { ...visual, ...changes } : visual) });
  }

  function updateSelectedControl(changes: Partial<ReportControlDefinition>) {
    if (!page || !selectedId) return;
    updatePage({ ...page, controls: (page.controls ?? []).map((control) => control.id === selectedId ? { ...control, ...changes } : control) });
  }

  function updateBookmark(changes: Partial<ReportBookmarkDefinition>) {
    if (!selectedBookmarkId) return;
    setBookmarks((current) => current.map((bookmark) => bookmark.id === selectedBookmarkId ? { ...bookmark, ...changes } : bookmark));
  }

  function addBookmark() {
    if (!page) return;
    const id = crypto.randomUUID();
    setBookmarks((current) => [...current, { id, name: `Bookmark ${current.length + 1}`, pageId: page.id, filters: {} }]);
    setSelectedBookmarkId(id);
    setSelectedId(undefined);
    setSettingsTab("build");
  }

  function updateDisplay(changes: NonNullable<VisualDefinition["display"]>) {
    if (!selected) return;
    updateSelected({ display: { ...selected.display, ...changes } });
  }

  function updateInteraction(changes: NonNullable<VisualDefinition["interaction"]>) {
    if (!selected) return;
    updateSelected({ interaction: { ...selected.interaction, ...changes } });
  }

  function updateVisualInteraction(sourceVisualId: string, targetVisualId: string, mode: VisualInteractionMode) {
    if (!page || sourceVisualId === targetVisualId) return;
    const remaining = (page.interactions ?? []).filter((interaction) => interaction.sourceVisualId !== sourceVisualId || interaction.targetVisualId !== targetVisualId);
    updatePage({ ...page, interactions: [...remaining, { sourceVisualId, targetVisualId, mode }] });
  }

  function changeLayout(next: Layout[]) {
    setPages((current) => {
      const currentPage = current[pageIndex];
      if (!currentPage) return current;
      let changed = false;
      const updatePositions = <T extends { id: string; x: number; y: number; w: number; h: number },>(items: T[]): T[] => items.map((item) => {
        const position = next.find((nextItem) => nextItem.i === item.id);
        if (!position || (item.x === position.x && item.y === position.y && item.w === position.w && item.h === position.h)) return item;
        changed = true;
        return { ...item, x: position.x, y: position.y, w: position.w, h: position.h };
      });
      const visuals = updatePositions(currentPage.visuals);
      const controls = updatePositions(currentPage.controls ?? []);
      if (!changed) return current;
      return current.map((item, index) => index === pageIndex ? { ...currentPage, visuals, controls } : item);
    });
  }

  function addPage() {
    const next: ReportPage = { id: crypto.randomUUID(), name: `Page ${pages.length + 1}`, ordinal: pages.length, visuals: [], filters: [] };
    setPages((current) => [...current, next]);
    setPageIndex(pages.length);
    setSelectedId(undefined);
    setSelectedBookmarkId(undefined);
  }

  function duplicatePage() {
    if (!page) return;
    const visualIds = new Map(page.visuals.map((visual) => [visual.id, crypto.randomUUID()]));
    const next: ReportPage = {
      ...structuredClone(page),
      id: crypto.randomUUID(),
      name: `${page.name} copy`,
      ordinal: pages.length,
      visuals: page.visuals.map((visual) => ({ ...visual, id: visualIds.get(visual.id)! })),
      controls: page.controls?.map((control) => ({ ...control, id: crypto.randomUUID() })),
      interactions: page.interactions?.flatMap((interaction) => {
        const sourceVisualId = visualIds.get(interaction.sourceVisualId);
        const targetVisualId = visualIds.get(interaction.targetVisualId);
        return sourceVisualId && targetVisualId ? [{ ...interaction, sourceVisualId, targetVisualId }] : [];
      }),
    };
    setPages((current) => [...current, next]);
    setPageIndex(pages.length);
    setSelectedId(undefined);
    setSelectedBookmarkId(undefined);
  }

  function deletePage() {
    if (!page || pages.length === 1) return;
    const remaining = pages.filter((item) => item.id !== page.id);
    const fallbackPageId = remaining.find((item) => !item.hidden)?.id ?? remaining[0]?.id;
    const next = remaining.map((item, index) => ({
      ...item,
      ordinal: index,
      controls: item.controls?.map((control) => control.action?.type === "page" && control.action.targetId === page.id ? { ...control, action: { ...control.action, targetId: fallbackPageId } } : control),
    }));
    setPages(next);
    setBookmarks((current) => current.map((bookmark) => bookmark.pageId === page.id && fallbackPageId ? { ...bookmark, pageId: fallbackPageId } : bookmark));
    setPageIndex(Math.max(0, Math.min(pageIndex, next.length - 1)));
    setSelectedId(undefined);
    setSelectedBookmarkId(undefined);
  }

  function setDrillthroughTarget(enabled: boolean) {
    if (!page) return;
    const firstField = dimensions[0]?.key as keyof ManufacturingRecord | undefined;
    updatePage({ ...page, drillthrough: enabled && firstField ? { fields: [firstField], keepAllFilters: true } : undefined });
  }

  function setDrillthroughField(field: keyof ManufacturingRecord, enabled: boolean) {
    if (!page?.drillthrough) return;
    const fields = enabled
      ? [...new Set([...page.drillthrough.fields, field])]
      : page.drillthrough.fields.filter((item) => item !== field);
    if (!fields.length) return;
    updatePage({ ...page, drillthrough: { ...page.drillthrough, fields } });
  }

  async function save(status: Report["status"] = initial?.status ?? "draft") {
    const body = { name, slug, datasetId, description, status, filters: reportFilters, bookmarks, pages };
    const response = await fetch(initial ? `/api/reports/${initial.id}` : "/api/reports", { method: initial ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json() as { report?: Report; error?: { message?: string } };
    setMessage(response.ok ? `Report ${status === "published" ? "published" : "saved"}.` : payload.error?.message ?? "Save failed.");
    if (response.ok && !initial && payload.report) router.push(`/admin/reports/${payload.report.id}/edit`);
  }

  return <>
    <div className="panel builder-report-settings"><div className="form-grid"><label>Report name<input value={name} onChange={(event) => { setName(event.target.value); if (!initial) setSlug(event.target.value.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "")); }} /></label><label>Slug<input value={slug} onChange={(event) => setSlug(event.target.value)} /></label><label>Dataset<select value={datasetId} onChange={(event) => setDatasetId(event.target.value)}>{datasets.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Description<input value={description} onChange={(event) => setDescription(event.target.value)} /></label><div className="table-actions full"><button className="button" onClick={() => save("draft")}><Save size={15} /> Save draft</button><button className="button primary" onClick={() => save("published")}>Publish report</button></div></div>{message && <p className="status-banner" style={{ marginTop: 12 }}>{message}</p>}</div>
    <div className="builder-shell">
      <aside className="builder-pane builder-left-pane">
        <div className="panel-header"><div><h3>Visualizations</h3><p>Choose a visual</p></div></div>
        <div className="builder-visual-catalog">{tools.map(({ type, label, icon: Icon }) => <button title={label} aria-label={`Add ${label}`} key={type} onClick={() => addVisual(type)}><Icon size={16} /><span>{label}</span></button>)}</div>
        <div className="panel-header builder-section-heading"><div><h3>Insert controls</h3><p>Buttons and navigators</p></div></div>
        <div className="builder-visual-catalog builder-control-catalog">
          <button aria-label="Add Button" onClick={() => addControl("button")}><MousePointerClick size={16} /><span>Button</span></button>
          <button aria-label="Add Page navigator" onClick={() => addControl("pageNavigator")}><Navigation size={16} /><span>Page nav</span></button>
          <button aria-label="Add Bookmark navigator" onClick={() => addControl("bookmarkNavigator")}><Bookmark size={16} /><span>Bookmark nav</span></button>
        </div>
        <div className="panel-header builder-section-heading"><div><h3>Data</h3><p>{selectedDataset?.name}</p></div></div>
        <div className="builder-field-list">{selectedDataset?.fields.filter((field) => !field.hidden).map((field) => <div key={field.id}><span>{field.semanticType === "measure" ? "∑" : field.semanticType === "date" ? "▣" : "▦"}</span><strong>{field.displayName}</strong><small>{field.dataType}</small></div>)}</div>
        <div className="panel-header builder-section-heading"><div><h3>Pages</h3><p>{pages.length} report pages</p></div><button className="icon-button" onClick={addPage} aria-label="Add page"><Plus size={14} /></button></div>
        <div className="builder-tool-list">{pages.map((item, index) => <button className={`builder-tool ${index === pageIndex ? "active" : ""}`} aria-label={`Edit page ${item.name}`} key={item.id} onClick={() => { setPageIndex(index); setSelectedId(undefined); setSelectedBookmarkId(undefined); }}><span>{item.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</span>{item.name}</button>)}</div>
        {page && <div className="form-stack page-settings"><label>Page name<input value={page.name} onChange={(event) => updatePage({ ...page, name: event.target.value })} /></label><div className="table-actions"><button className="icon-button" title="Duplicate page" onClick={duplicatePage}><Copy size={14} /></button><button className="icon-button" title={page.hidden ? "Show page" : "Hide page"} onClick={() => updatePage({ ...page, hidden: !page.hidden })}>{page.hidden ? <Eye size={14} /> : <EyeOff size={14} />}</button><button className="icon-button danger" title="Delete page" disabled={pages.length === 1} onClick={deletePage}><Trash2 size={14} /></button></div></div>}
        {page && <div className="page-drillthrough-settings">
          <label className="toggle-row"><span>Drillthrough target</span><input aria-label="Use page as drillthrough target" type="checkbox" checked={Boolean(page.drillthrough)} onChange={(event) => setDrillthroughTarget(event.target.checked)} /></label>
          {page.drillthrough && <><p>Fields accepted from source visuals</p><div className="page-drillthrough-fields">{dimensions.map((field) => { const checked = page.drillthrough?.fields.includes(field.key as keyof ManufacturingRecord) ?? false; return <label key={field.id}><input type="checkbox" aria-label={`Drillthrough field ${field.displayName}`} checked={checked} disabled={checked && page.drillthrough?.fields.length === 1} onChange={(event) => setDrillthroughField(field.key as keyof ManufacturingRecord, event.target.checked)} /> {field.displayName}</label>; })}</div><label className="toggle-row"><span>Keep all filters</span><input aria-label="Keep all drillthrough filters" type="checkbox" checked={page.drillthrough.keepAllFilters !== false} onChange={(event) => updatePage({ ...page, drillthrough: { ...page.drillthrough!, keepAllFilters: event.target.checked } })} /></label></>}
        </div>}
        <div className="panel-header builder-section-heading"><div><h3>Report bookmarks</h3><p>{bookmarks.length} published views</p></div><button className="icon-button" onClick={addBookmark} aria-label="Add report bookmark"><Plus size={14} /></button></div>
        <div className="builder-tool-list">{bookmarks.map((bookmark) => <button className={`builder-tool ${bookmark.id === selectedBookmarkId ? "active" : ""}`} key={bookmark.id} onClick={() => { setSelectedBookmarkId(bookmark.id); setSelectedId(undefined); setSettingsTab("build"); }}><Bookmark size={13} />{bookmark.name}</button>)}{!bookmarks.length && <p className="muted filter-empty">Add a shared view for buttons and bookmark navigators.</p>}</div>
      </aside>
      <section className="builder-canvas">
        <div className="builder-canvas-label"><span>Canvas</span><small>Drag headers to move · drag corners to resize</small></div>
        <GridLayout layout={layout} cols={12} rowHeight={54} width={900} margin={[8, 8]} onLayoutChange={changeLayout} draggableHandle=".builder-visual-handle">
          {page?.visuals.map((visual) => <div key={visual.id} onClick={() => { setSelectedId(visual.id); setSelectedBookmarkId(undefined); }}><div className={`builder-preview ${selectedId === visual.id ? "selected" : ""}`}><button className="builder-visual-handle" aria-label={`Move ${visual.title}`}>{visual.title}</button><div className="builder-preview-body"><ReportVisual visual={visual} rows={previewRows} showActions={false} /></div></div></div>)}
          {page?.controls?.map((control) => <div key={control.id} onClick={() => { setSelectedId(control.id); setSelectedBookmarkId(undefined); }}><div className={`builder-preview ${selectedId === control.id ? "selected" : ""}`}><button className="builder-visual-handle" aria-label={`Move ${control.title}`}>{control.title}</button><div className="builder-preview-body"><ReportControl control={control} pages={pages} bookmarks={bookmarks} activePageId={page.id} /></div></div></div>)}
        </GridLayout>
        {!page?.visuals.length && !page?.controls?.length && <div className="empty-state">Add a visual or navigation control from the left pane, then drag and resize it on this canvas.</div>}
      </section>
      <aside className="builder-pane builder-settings-pane">
        <div className="builder-settings-tabs"><button className={settingsTab === "build" ? "active" : ""} onClick={() => setSettingsTab("build")}><Layers3 size={14} /> Build</button><button className={settingsTab === "format" ? "active" : ""} onClick={() => setSettingsTab("format")}><Paintbrush size={14} /> Format</button><button className={settingsTab === "filters" ? "active" : ""} onClick={() => setSettingsTab("filters")}><SlidersHorizontal size={14} /> Filters</button></div>
        {settingsTab === "build" && (selected ? <BuildSettings selected={selected} dimensions={dimensions} measures={measures} updateSelected={updateSelected} onDelete={() => { if (!page) return; updatePage({ ...page, visuals: page.visuals.filter((visual) => visual.id !== selected.id), interactions: page.interactions?.filter((interaction) => interaction.sourceVisualId !== selected.id && interaction.targetVisualId !== selected.id) }); setSelectedId(undefined); }} /> : selectedControl ? <ControlBuildSettings selected={selectedControl} pages={pages} bookmarks={bookmarks} updateSelected={updateSelectedControl} onDelete={() => { if (!page) return; updatePage({ ...page, controls: (page.controls ?? []).filter((control) => control.id !== selectedControl.id) }); setSelectedId(undefined); }} /> : selectedBookmark ? <BookmarkSettings selected={selectedBookmark} pages={pages} rows={previewRows} updateSelected={updateBookmark} onDelete={() => { setBookmarks((current) => current.filter((bookmark) => bookmark.id !== selectedBookmark.id)); setPages((current) => current.map((item) => ({ ...item, controls: item.controls?.map((control) => control.action?.type === "bookmark" && control.action.targetId === selectedBookmark.id ? { ...control, action: { type: "resetFilters" } } : control) }))); setSelectedBookmarkId(undefined); }} /> : <div className="empty-state compact">Select a visual, control, or report bookmark to configure it.</div>)}
        {settingsTab === "format" && (selected ? <FormatSettings selected={selected} page={page} updateDisplay={updateDisplay} updateInteraction={updateInteraction} updateVisualInteraction={updateVisualInteraction} /> : selectedControl ? <ControlFormatSettings selected={selectedControl} updateSelected={updateSelectedControl} /> : <div className="empty-state compact">Select a visual or control to format its appearance and behavior.</div>)}
        {settingsTab === "filters" && <div className="builder-filter-scopes">{selected && <FilterEditor title="Filters on this visual" filters={selected.filters ?? []} fields={filterFields} onChange={(filters) => updateSelected({ filters })} />}<FilterEditor title="Filters on this page" filters={page?.filters ?? []} fields={filterFields} onChange={(filters) => page && updatePage({ ...page, filters })} /><FilterEditor title="Filters on all pages" filters={reportFilters} fields={filterFields} onChange={setReportFilters} /></div>}
      </aside>
    </div>
  </>;
}

function BuildSettings({ selected, dimensions, measures, updateSelected, onDelete }: { selected: VisualDefinition; dimensions: Dataset["fields"]; measures: Dataset["fields"]; updateSelected: (changes: Partial<VisualDefinition>) => void; onDelete: () => void }) {
  const supportsHierarchy = Boolean(selected.dimension && selected.measure && !["gauge", "scatter", "slicer", "kpi", "table", "matrix"].includes(selected.type));
  const hierarchy = [selected.dimension, ...(selected.hierarchy ?? [])]
    .filter((field): field is keyof ManufacturingRecord => Boolean(field))
    .filter((field, index, fields) => fields.indexOf(field) === index);
  const updateDimension = (value: string) => {
    const dimension = value as VisualDefinition["dimension"] || undefined;
    const remaining = hierarchy.filter((field) => field !== dimension && field !== selected.dimension);
    updateSelected({ dimension, hierarchy: dimension ? [dimension, ...remaining] : [] });
  };
  const updateHierarchyLevel = (index: number, value: string) => {
    const next = [...hierarchy];
    if (value) next[index] = value as keyof ManufacturingRecord;
    else next.splice(index);
    const unique = next.filter((field, fieldIndex, fields) => fields.indexOf(field) === fieldIndex);
    updateSelected({ hierarchy: unique });
  };
  return <div className="form-stack">
    <div className="panel-header"><div><h3>Build visual</h3><p>{tools.find((item) => item.type === selected.type)?.label}</p></div><button className="icon-button danger" aria-label="Delete visual" onClick={onDelete}><Trash2 size={14} /></button></div>
    <label>Title<input value={selected.title} onChange={(event) => updateSelected({ title: event.target.value })} /></label>
    <label>Visual type<select value={selected.type} onChange={(event) => updateSelected({ type: event.target.value as VisualType })}>{tools.map((item) => <option value={item.type} key={item.type}>{item.label}</option>)}</select></label>
    <label>Category / X-axis<select value={selected.dimension ?? ""} onChange={(event) => updateDimension(event.target.value)}><option value="">None</option>{dimensions.map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label>
    {supportsHierarchy && <div className="settings-group hierarchy-settings"><strong>Drill hierarchy</strong><p>Click a category to drill when drill mode is active.</p>
      <label>Drill level 2<select value={hierarchy[1] ?? ""} disabled={!selected.dimension} onChange={(event) => updateHierarchyLevel(1, event.target.value)}><option value="">None</option>{dimensions.filter((field) => field.key !== selected.dimension).map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label>
      <label>Drill level 3<select value={hierarchy[2] ?? ""} disabled={hierarchy.length < 2} onChange={(event) => updateHierarchyLevel(2, event.target.value)}><option value="">None</option>{dimensions.filter((field) => !hierarchy.slice(0, 2).includes(field.key as keyof ManufacturingRecord)).map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label>
    </div>}
    <label>Value / Y-axis<select value={selected.measure ?? ""} onChange={(event) => updateSelected({ measure: event.target.value as VisualDefinition["measure"] || undefined })}><option value="">None</option>{measures.map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label>
    <label>Secondary value<select value={selected.secondaryMeasure ?? ""} onChange={(event) => updateSelected({ secondaryMeasure: event.target.value as VisualDefinition["secondaryMeasure"] || undefined })}><option value="">None</option>{measures.map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label>
    <label>Aggregation<select value={selected.aggregation ?? "sum"} onChange={(event) => updateSelected({ aggregation: event.target.value as Aggregation })}>{["sum", "average", "minimum", "maximum", "count", "distinctCount"].map((value) => <option key={value}>{value}</option>)}</select></label>
    <label>Number format<select value={selected.format ?? "number"} onChange={(event) => updateSelected({ format: event.target.value as VisualDefinition["format"] })}><option value="number">Number</option><option value="percent">Percentage</option></select></label>
    <div className="settings-group"><strong>Sort</strong><label>Sort by<select aria-label="Sort visual by" value={selected.sort?.field ?? ""} onChange={(event) => updateSelected({ sort: event.target.value ? { field: event.target.value as keyof ManufacturingRecord, direction: selected.sort?.direction ?? "asc" } : undefined })}><option value="">Default order</option>{[...dimensions, ...measures].map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label><label>Direction<select aria-label="Sort visual direction" value={selected.sort?.direction ?? "asc"} disabled={!selected.sort} onChange={(event) => selected.sort && updateSelected({ sort: { ...selected.sort, direction: event.target.value as "asc" | "desc" } })}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label></div>
  </div>;
}

function FormatSettings({ selected, page, updateDisplay, updateInteraction, updateVisualInteraction }: { selected: VisualDefinition; page: ReportPage; updateDisplay: (changes: NonNullable<VisualDefinition["display"]>) => void; updateInteraction: (changes: NonNullable<VisualDefinition["interaction"]>) => void; updateVisualInteraction: (sourceVisualId: string, targetVisualId: string, mode: VisualInteractionMode) => void }) {
  const display = selected.display ?? {};
  const interaction = selected.interaction ?? {};
  const targets = page.visuals.filter((visual) => visual.id !== selected.id);
  return <div className="form-stack">
    <div className="panel-header"><div><h3>Format visual</h3><p>Appearance and behavior</p></div></div>
    <div className="settings-group"><strong>Title and style</strong><label className="toggle-row"><span>Show title</span><input type="checkbox" checked={display.showTitle !== false} onChange={(event) => updateDisplay({ showTitle: event.target.checked })} /></label><label>Title alignment<select value={display.titleAlignment ?? "left"} onChange={(event) => updateDisplay({ titleAlignment: event.target.value as "left" | "center" | "right" })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label><label>Accent color<input type="color" value={display.accentColor ?? "#5c73e6"} onChange={(event) => updateDisplay({ accentColor: event.target.value })} /></label><label>Background<input type="color" value={display.backgroundColor ?? "#ffffff"} onChange={(event) => updateDisplay({ backgroundColor: event.target.value })} /></label><label>Corner radius<input type="range" min="0" max="24" value={display.borderRadius ?? 10} onChange={(event) => updateDisplay({ borderRadius: Number(event.target.value) })} /></label></div>
    <div className="settings-group"><strong>Chart elements</strong><label className="toggle-row"><span>Legend</span><input type="checkbox" checked={display.showLegend ?? false} onChange={(event) => updateDisplay({ showLegend: event.target.checked })} /></label><label className="toggle-row"><span>Data labels</span><input type="checkbox" checked={display.showDataLabels ?? false} onChange={(event) => updateDisplay({ showDataLabels: event.target.checked })} /></label><label className="toggle-row"><span>Gridlines</span><input type="checkbox" checked={display.showGridlines !== false} onChange={(event) => updateDisplay({ showGridlines: event.target.checked })} /></label></div>
    <div className="settings-group"><strong>Source behavior</strong><label className="toggle-row"><span>Interactions enabled by default</span><input type="checkbox" checked={interaction.crossFilter !== false} onChange={(event) => updateInteraction({ crossFilter: event.target.checked })} /></label><label className="toggle-row"><span>Tooltips</span><input type="checkbox" checked={interaction.tooltips !== false} onChange={(event) => updateInteraction({ tooltips: event.target.checked })} /></label></div>
    <div className="settings-group interaction-editor"><strong>Edit visual interactions</strong><p>Choose how a selection in <b>{selected.title}</b> affects every target.</p>{selected.dimension ? targets.map((target) => {
      const configured = page.interactions?.find((item) => item.sourceVisualId === selected.id && item.targetVisualId === target.id);
      const mode = configured?.mode ?? (interaction.crossFilter === false ? "none" : "filter");
      return <div className="interaction-target-row" key={target.id}><span title={target.title}>{target.title}</span><div role="group" aria-label={`${selected.title} to ${target.title}`}><button type="button" className={mode === "filter" ? "active" : ""} aria-label={`Filter ${selected.title} to ${target.title}`} aria-pressed={mode === "filter"} title="Filter" onClick={() => updateVisualInteraction(selected.id, target.id, "filter")}><Filter size={13} /></button><button type="button" className={mode === "highlight" ? "active" : ""} aria-label={`Highlight ${selected.title} to ${target.title}`} aria-pressed={mode === "highlight"} title="Highlight" onClick={() => updateVisualInteraction(selected.id, target.id, "highlight")}><Sparkles size={13} /></button><button type="button" className={mode === "none" ? "active" : ""} aria-label={`No interaction from ${selected.title} to ${target.title}`} aria-pressed={mode === "none"} title="None" onClick={() => updateVisualInteraction(selected.id, target.id, "none")}><Ban size={13} /></button></div></div>;
    }) : <p className="muted">Assign a category field before configuring this visual as an interaction source.</p>}</div>
  </div>;
}

function ControlBuildSettings({ selected, pages, bookmarks, updateSelected, onDelete }: { selected: ReportControlDefinition; pages: ReportPage[]; bookmarks: ReportBookmarkDefinition[]; updateSelected: (changes: Partial<ReportControlDefinition>) => void; onDelete: () => void }) {
  const visiblePages = pages.filter((page) => !page.hidden);
  const action = selected.action ?? { type: "page" as const, targetId: visiblePages[0]?.id };
  const changeType = (type: ReportControlType) => updateSelected({ type, title: type === "button" ? selected.title || "Open page" : type === "pageNavigator" ? "Report pages" : "Saved views", action: type === "button" ? action : undefined });
  const changeAction = (type: ReportActionType) => updateSelected({ action: { type, targetId: type === "page" ? visiblePages[0]?.id : type === "bookmark" ? bookmarks[0]?.id : undefined } });
  return <div className="form-stack">
    <div className="panel-header"><div><h3>Build control</h3><p>Published report navigation</p></div><button className="icon-button danger" aria-label="Delete control" onClick={onDelete}><Trash2 size={14} /></button></div>
    <label>Control type<select aria-label="Control type" value={selected.type} onChange={(event) => changeType(event.target.value as ReportControlType)}><option value="button">Button</option><option value="pageNavigator">Page navigator</option><option value="bookmarkNavigator">Bookmark navigator</option></select></label>
    <label>Accessible title<input aria-label="Control title" value={selected.title} onChange={(event) => updateSelected({ title: event.target.value })} /></label>
    {selected.type === "button" && <div className="settings-group"><strong>Action</strong><label>Action type<select aria-label="Button action" value={action.type} onChange={(event) => changeAction(event.target.value as ReportActionType)}><option value="page">Page navigation</option><option value="bookmark">Report bookmark</option><option value="back">Back / drillthrough return</option><option value="resetFilters">Reset filters</option></select></label>{action.type === "page" && <label>Target page<select aria-label="Button target page" value={action.targetId ?? ""} onChange={(event) => updateSelected({ action: { type: "page", targetId: event.target.value } })}>{visiblePages.map((page) => <option value={page.id} key={page.id}>{page.name}</option>)}</select></label>}{action.type === "bookmark" && <label>Target bookmark<select aria-label="Button target bookmark" value={action.targetId ?? ""} onChange={(event) => updateSelected({ action: { type: "bookmark", targetId: event.target.value } })}>{bookmarks.map((bookmark) => <option value={bookmark.id} key={bookmark.id}>{bookmark.name}</option>)}</select></label>}</div>}
    {selected.type === "pageNavigator" && <p className="muted">Automatically shows all visible report pages and tracks the active page.</p>}
    {selected.type === "bookmarkNavigator" && <p className="muted">Automatically shows every report-owned bookmark in its saved order.</p>}
  </div>;
}

function ControlFormatSettings({ selected, updateSelected }: { selected: ReportControlDefinition; updateSelected: (changes: Partial<ReportControlDefinition>) => void }) {
  const display = selected.display ?? {};
  const updateDisplay = (changes: NonNullable<ReportControlDefinition["display"]>) => updateSelected({ display: { ...display, ...changes } });
  return <div className="form-stack"><div className="panel-header"><div><h3>Format control</h3><p>Navigation appearance</p></div></div><div className="settings-group"><strong>Colors and shape</strong><label>Accent color<input type="color" value={display.accentColor ?? "#5c73e6"} onChange={(event) => updateDisplay({ accentColor: event.target.value })} /></label><label>Background<input type="color" value={display.backgroundColor ?? "#ffffff"} onChange={(event) => updateDisplay({ backgroundColor: event.target.value })} /></label><label>Text color<input type="color" value={display.textColor ?? "#172033"} onChange={(event) => updateDisplay({ textColor: event.target.value })} /></label><label>Corner radius<input type="range" min="0" max="24" value={display.borderRadius ?? 9} onChange={(event) => updateDisplay({ borderRadius: Number(event.target.value) })} /></label></div></div>;
}

function BookmarkSettings({ selected, pages, rows, updateSelected, onDelete }: { selected: ReportBookmarkDefinition; pages: ReportPage[]; rows: ManufacturingRecord[]; updateSelected: (changes: Partial<ReportBookmarkDefinition>) => void; onDelete: () => void }) {
  const filters = selected.filters ?? {};
  const updateFilter = (field: keyof NonNullable<ReportBookmarkDefinition["filters"]>, value: string) => updateSelected({ filters: { ...filters, [field]: value } });
  const unique = (field: "Line" | "Model" | "Customer" | "Shift") => [...new Set(rows.map((row) => String(row[field])))].sort();
  return <div className="form-stack">
    <div className="panel-header"><div><h3>Report bookmark</h3><p>Shared with every viewer</p></div><button className="icon-button danger" aria-label="Delete report bookmark" onClick={onDelete}><Trash2 size={14} /></button></div>
    <label>Bookmark name<input aria-label="Report bookmark name" value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} /></label>
    <label>Target page<select aria-label="Report bookmark page" value={selected.pageId} onChange={(event) => updateSelected({ pageId: event.target.value })}>{pages.map((page) => <option value={page.id} key={page.id}>{page.name}{page.hidden ? " (hidden)" : ""}</option>)}</select></label>
    <div className="settings-group"><strong>Captured filters</strong><label>Date from<input aria-label="Report bookmark date from" type="date" value={filters.from ?? ""} onChange={(event) => updateFilter("from", event.target.value)} /></label><label>Date to<input aria-label="Report bookmark date to" type="date" value={filters.to ?? ""} onChange={(event) => updateFilter("to", event.target.value)} /></label>{(["Line", "Model", "Customer", "Shift"] as const).map((field) => <label key={field}>{field}<select aria-label={`Report bookmark ${field}`} value={filters[field] ?? ""} onChange={(event) => updateFilter(field, event.target.value)}><option value="">All</option>{unique(field).map((value) => <option key={value}>{value}</option>)}</select></label>)}<button className="button" type="button" onClick={() => updateSelected({ filters: {} })}><RotateCcw size={13} /> Clear captured filters</button></div>
  </div>;
}

function FilterEditor({ title, filters, fields, onChange }: { title: string; filters: ReportFilterDefinition[]; fields: Dataset["fields"]; onChange: (filters: ReportFilterDefinition[]) => void }) {
  const operatorOptions: Array<{ value: ReportFilterDefinition["operator"]; label: string }> = [
    { value: "equals", label: "is" }, { value: "notEquals", label: "is not" }, { value: "contains", label: "contains" }, { value: "notContains", label: "does not contain" },
    { value: "startsWith", label: "starts with" }, { value: "endsWith", label: "ends with" }, { value: "greaterThan", label: "is greater than" }, { value: "greaterThanOrEqual", label: "is at least" },
    { value: "lessThan", label: "is less than" }, { value: "lessThanOrEqual", label: "is at most" }, { value: "isBlank", label: "is blank" }, { value: "isNotBlank", label: "is not blank" },
  ];
  const measures = fields.filter((field) => field.semanticType === "measure");
  const dimensions = fields.filter((field) => field.semanticType !== "measure");
  const dates = fields.filter((field) => field.semanticType === "date" || field.dataType === "date" || field.dataType === "datetime");
  const add = () => {
    const first = fields[0];
    if (first) onChange([...filters, { id: crypto.randomUUID(), field: first.key as ReportFilterDefinition["field"], operator: "equals", value: "", mode: "basic" }]);
  };
  const update = (id: string, changes: Partial<ReportFilterDefinition>) => onChange(filters.map((filter) => filter.id === id ? { ...filter, ...changes } : filter));
  const changeMode = (filter: ReportFilterDefinition, mode: NonNullable<ReportFilterDefinition["mode"]>) => {
    if (mode === "relativeDate") update(filter.id, { mode, field: (dates[0]?.key ?? filter.field) as keyof ManufacturingRecord, relativeDate: filter.relativeDate ?? { direction: "last", amount: 30, unit: "days", includeToday: true } });
    else if (mode === "topN") update(filter.id, { mode, field: (dimensions[0]?.key ?? filter.field) as keyof ManufacturingRecord, topN: filter.topN ?? { direction: "top", count: 5, byMeasure: (measures[0]?.key ?? "ActualQty") as keyof ManufacturingRecord, aggregation: "sum" } });
    else if (mode === "advanced") update(filter.id, { mode, clauses: filter.clauses?.length ? filter.clauses : [{ operator: filter.operator, value: filter.value }, { operator: "notEquals", value: "" }], logicalOperator: filter.logicalOperator ?? "and" });
    else update(filter.id, { mode });
  };
  return <section className="filter-editor">
    <div className="panel-header"><div><h3>{title}</h3><p>{filters.length} configured</p></div><button className="icon-button" onClick={add} aria-label={`Add ${title.toLocaleLowerCase()}`}><Plus size={13} /></button></div>
    {filters.map((filter) => {
      const mode = filter.mode ?? "basic";
      return <div className="filter-editor-card advanced-filter-card" data-filter-id={filter.id} key={filter.id}>
        <div className="filter-editor-heading"><strong>{String(filter.field)}</strong><button className="icon-button danger" aria-label={`Remove ${String(filter.field)} filter`} onClick={() => onChange(filters.filter((item) => item.id !== filter.id))}><Trash2 size={12} /></button></div>
        <select aria-label="Filter type" value={mode} onChange={(event) => changeMode(filter, event.target.value as NonNullable<ReportFilterDefinition["mode"]>)}><option value="basic">Basic filter</option><option value="advanced">Advanced clauses</option><option value="topN">Top / Bottom N</option><option value="relativeDate">Relative date</option></select>
        <select aria-label="Filter field" value={filter.field} onChange={(event) => update(filter.id, { field: event.target.value as ReportFilterDefinition["field"] })}>{(mode === "topN" ? dimensions : mode === "relativeDate" ? dates : fields).map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select>
        {mode === "basic" && <><select aria-label="Filter operator" value={filter.operator} onChange={(event) => update(filter.id, { operator: event.target.value as ReportFilterDefinition["operator"] })}>{operatorOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>{!(["isBlank", "isNotBlank"] as const).includes(filter.operator as "isBlank" | "isNotBlank") && <input aria-label="Filter value" value={filter.value} placeholder="Value" onChange={(event) => update(filter.id, { value: event.target.value })} />}</>}
        {mode === "advanced" && <div className="advanced-clause-editor"><label>Combine clauses<select aria-label="Advanced filter logic" value={filter.logicalOperator ?? "and"} onChange={(event) => update(filter.id, { logicalOperator: event.target.value as "and" | "or" })}><option value="and">AND</option><option value="or">OR</option></select></label>{(filter.clauses ?? []).map((clause, index) => <div className="advanced-clause-row" key={index}><select aria-label={`Clause ${index + 1} operator`} value={clause.operator} onChange={(event) => update(filter.id, { clauses: (filter.clauses ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, operator: event.target.value as ReportFilterDefinition["operator"] } : item) })}>{operatorOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>{!(["isBlank", "isNotBlank"] as const).includes(clause.operator as "isBlank" | "isNotBlank") && <input aria-label={`Clause ${index + 1} value`} value={clause.value ?? ""} onChange={(event) => update(filter.id, { clauses: (filter.clauses ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) })} />}{(filter.clauses?.length ?? 0) > 1 && <button className="icon-button danger" aria-label={`Remove clause ${index + 1}`} onClick={() => update(filter.id, { clauses: filter.clauses?.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={11} /></button>}</div>)}<button className="button" type="button" disabled={(filter.clauses?.length ?? 0) >= 5} onClick={() => update(filter.id, { clauses: [...(filter.clauses ?? []), { operator: "equals", value: "" }] })}><Plus size={12} /> Add clause</button></div>}
        {mode === "topN" && <div className="advanced-clause-editor"><label>Direction<select aria-label="Top N direction" value={filter.topN?.direction ?? "top"} onChange={(event) => update(filter.id, { topN: { ...(filter.topN ?? { count: 5, byMeasure: (measures[0]?.key ?? "ActualQty") as keyof ManufacturingRecord }), direction: event.target.value as "top" | "bottom" } })}><option value="top">Top</option><option value="bottom">Bottom</option></select></label><label>Count<input aria-label="Top N count" type="number" min="1" max="1000" value={filter.topN?.count ?? 5} onChange={(event) => update(filter.id, { topN: { ...(filter.topN ?? { direction: "top", byMeasure: (measures[0]?.key ?? "ActualQty") as keyof ManufacturingRecord }), count: Math.max(1, Number(event.target.value)) } })} /></label><label>By measure<select aria-label="Top N measure" value={filter.topN?.byMeasure ?? measures[0]?.key ?? ""} onChange={(event) => update(filter.id, { topN: { ...(filter.topN ?? { direction: "top", count: 5 }), byMeasure: event.target.value as keyof ManufacturingRecord } })}>{measures.map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label><label>Aggregation<select aria-label="Top N aggregation" value={filter.topN?.aggregation ?? "sum"} onChange={(event) => update(filter.id, { topN: { ...(filter.topN ?? { direction: "top", count: 5, byMeasure: (measures[0]?.key ?? "ActualQty") as keyof ManufacturingRecord }), aggregation: event.target.value as Aggregation } })}>{["sum", "average", "minimum", "maximum", "count", "distinctCount"].map((value) => <option key={value}>{value}</option>)}</select></label></div>}
        {mode === "relativeDate" && <div className="advanced-clause-editor"><label>Direction<select aria-label="Relative date direction" value={filter.relativeDate?.direction ?? "last"} onChange={(event) => update(filter.id, { relativeDate: { ...(filter.relativeDate ?? { amount: 30, unit: "days" }), direction: event.target.value as "last" | "next" | "current" } })}><option value="last">Last</option><option value="next">Next</option><option value="current">Current period</option></select></label><label>Amount<input aria-label="Relative date amount" type="number" min="1" max="1000" disabled={filter.relativeDate?.direction === "current"} value={filter.relativeDate?.amount ?? 30} onChange={(event) => update(filter.id, { relativeDate: { ...(filter.relativeDate ?? { direction: "last", unit: "days" }), amount: Math.max(1, Number(event.target.value)) } })} /></label><label>Unit<select aria-label="Relative date unit" value={filter.relativeDate?.unit ?? "days"} onChange={(event) => update(filter.id, { relativeDate: { ...(filter.relativeDate ?? { direction: "last", amount: 30 }), unit: event.target.value as "days" | "weeks" | "months" | "years" } })}><option value="days">Days</option><option value="weeks">Weeks</option><option value="months">Months</option><option value="years">Years</option></select></label><label className="toggle-row"><span>Include today</span><input aria-label="Include today" type="checkbox" checked={filter.relativeDate?.includeToday !== false} onChange={(event) => update(filter.id, { relativeDate: { ...(filter.relativeDate ?? { direction: "last", amount: 30, unit: "days" }), includeToday: event.target.checked } })} /></label></div>}
        <div className="filter-permissions"><label className="toggle-row"><span>Lock for viewers</span><input aria-label="Lock filter" type="checkbox" checked={filter.locked ?? false} onChange={(event) => update(filter.id, { locked: event.target.checked })} /></label><label className="toggle-row"><span>Hide from viewers</span><input aria-label="Hide filter" type="checkbox" checked={filter.hidden ?? false} onChange={(event) => update(filter.id, { hidden: event.target.checked })} /></label></div>
      </div>;
    })}
    {!filters.length && <p className="muted filter-empty">No filters at this scope.</p>}
  </section>;
}
