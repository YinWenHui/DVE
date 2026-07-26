"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GridLayout, { type Layout } from "react-grid-layout";
import { BarChart3, Copy, CreditCard, Eye, EyeOff, Layers3, LineChart, Paintbrush, Plus, Save, SlidersHorizontal, Table2, Trash2 } from "lucide-react";
import { ReportVisual } from "@/components/report/report-visual";
import type { Aggregation, Dataset, ManufacturingRecord, Report, ReportFilterDefinition, ReportPage, VisualDefinition, VisualType } from "@/types";

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
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string>();
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("build");
  const [message, setMessage] = useState<string>();
  const page = pages[pageIndex] ?? pages[0];
  const selected = page?.visuals.find((visual) => visual.id === selectedId);
  const selectedDataset = datasets.find((item) => item.id === datasetId);
  const dimensions = selectedDataset?.fields.filter((field) => !field.hidden && field.semanticType !== "measure") ?? [];
  const measures = selectedDataset?.fields.filter((field) => !field.hidden && field.semanticType === "measure") ?? [];
  const filterFields = selectedDataset?.fields.filter((field) => !field.hidden && field.filterable) ?? [];
  const previewRows = records as unknown as ManufacturingRecord[];
  const layout = useMemo<Layout[]>(() => page?.visuals.map((visual) => ({ i: visual.id, x: visual.x, y: visual.y, w: visual.w, h: visual.h, minW: 2, minH: 2 })) ?? [], [page]);

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
    setSettingsTab("build");
  }

  function updatePage(nextPage: ReportPage) {
    setPages((current) => current.map((item, index) => index === pageIndex ? nextPage : item));
  }

  function updateSelected(changes: Partial<VisualDefinition>) {
    if (!page || !selectedId) return;
    updatePage({ ...page, visuals: page.visuals.map((visual) => visual.id === selectedId ? { ...visual, ...changes } : visual) });
  }

  function updateDisplay(changes: NonNullable<VisualDefinition["display"]>) {
    if (!selected) return;
    updateSelected({ display: { ...selected.display, ...changes } });
  }

  function updateInteraction(changes: NonNullable<VisualDefinition["interaction"]>) {
    if (!selected) return;
    updateSelected({ interaction: { ...selected.interaction, ...changes } });
  }

  function changeLayout(next: Layout[]) {
    setPages((current) => {
      const currentPage = current[pageIndex];
      if (!currentPage) return current;
      let changed = false;
      const visuals = currentPage.visuals.map((visual) => {
        const position = next.find((item) => item.i === visual.id);
        if (!position || (visual.x === position.x && visual.y === position.y && visual.w === position.w && visual.h === position.h)) return visual;
        changed = true;
        return { ...visual, x: position.x, y: position.y, w: position.w, h: position.h };
      });
      if (!changed) return current;
      return current.map((item, index) => index === pageIndex ? { ...currentPage, visuals } : item);
    });
  }

  function addPage() {
    const next: ReportPage = { id: crypto.randomUUID(), name: `Page ${pages.length + 1}`, ordinal: pages.length, visuals: [], filters: [] };
    setPages((current) => [...current, next]);
    setPageIndex(pages.length);
    setSelectedId(undefined);
  }

  function duplicatePage() {
    if (!page) return;
    const next: ReportPage = { ...structuredClone(page), id: crypto.randomUUID(), name: `${page.name} copy`, ordinal: pages.length, visuals: page.visuals.map((visual) => ({ ...visual, id: crypto.randomUUID() })) };
    setPages((current) => [...current, next]);
    setPageIndex(pages.length);
    setSelectedId(undefined);
  }

  function deletePage() {
    if (!page || pages.length === 1) return;
    const next = pages.filter((item) => item.id !== page.id).map((item, index) => ({ ...item, ordinal: index }));
    setPages(next);
    setPageIndex(Math.max(0, Math.min(pageIndex, next.length - 1)));
    setSelectedId(undefined);
  }

  async function save(status: Report["status"] = initial?.status ?? "draft") {
    const body = { name, slug, datasetId, description, status, filters: reportFilters, pages };
    const response = await fetch(initial ? `/api/reports/${initial.id}` : "/api/reports", { method: initial ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json() as { report?: Report; error?: { message?: string } };
    setMessage(response.ok ? `Report ${status === "published" ? "published" : "saved"}.` : payload.error?.message ?? "Save failed.");
    if (response.ok && !initial && payload.report) router.push(`/admin/reports/${payload.report.id}/edit`);
  }

  return <>
    <div className="panel builder-report-settings"><div className="form-grid"><label>Report name<input value={name} onChange={(event) => { setName(event.target.value); if (!initial) setSlug(event.target.value.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "")); }} /></label><label>Slug<input value={slug} onChange={(event) => setSlug(event.target.value)} /></label><label>Dataset<select value={datasetId} onChange={(event) => setDatasetId(event.target.value)}>{datasets.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Description<input value={description} onChange={(event) => setDescription(event.target.value)} /></label><div className="table-actions full"><button className="button" onClick={() => save()}><Save size={15} /> Save draft</button><button className="button primary" onClick={() => save("published")}>Publish report</button></div></div>{message && <p className="status-banner" style={{ marginTop: 12 }}>{message}</p>}</div>
    <div className="builder-shell">
      <aside className="builder-pane builder-left-pane">
        <div className="panel-header"><div><h3>Visualizations</h3><p>Choose a visual</p></div></div>
        <div className="builder-visual-catalog">{tools.map(({ type, label, icon: Icon }) => <button title={label} aria-label={`Add ${label}`} key={type} onClick={() => addVisual(type)}><Icon size={16} /><span>{label}</span></button>)}</div>
        <div className="panel-header builder-section-heading"><div><h3>Data</h3><p>{selectedDataset?.name}</p></div></div>
        <div className="builder-field-list">{selectedDataset?.fields.filter((field) => !field.hidden).map((field) => <div key={field.id}><span>{field.semanticType === "measure" ? "∑" : field.semanticType === "date" ? "▣" : "▦"}</span><strong>{field.displayName}</strong><small>{field.dataType}</small></div>)}</div>
        <div className="panel-header builder-section-heading"><div><h3>Pages</h3><p>{pages.length} report pages</p></div><button className="icon-button" onClick={addPage} aria-label="Add page"><Plus size={14} /></button></div>
        <div className="builder-tool-list">{pages.map((item, index) => <button className={`builder-tool ${index === pageIndex ? "active" : ""}`} key={item.id} onClick={() => { setPageIndex(index); setSelectedId(undefined); }}><span>{item.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</span>{item.name}</button>)}</div>
        {page && <div className="form-stack page-settings"><label>Page name<input value={page.name} onChange={(event) => updatePage({ ...page, name: event.target.value })} /></label><div className="table-actions"><button className="icon-button" title="Duplicate page" onClick={duplicatePage}><Copy size={14} /></button><button className="icon-button" title={page.hidden ? "Show page" : "Hide page"} onClick={() => updatePage({ ...page, hidden: !page.hidden })}>{page.hidden ? <Eye size={14} /> : <EyeOff size={14} />}</button><button className="icon-button danger" title="Delete page" disabled={pages.length === 1} onClick={deletePage}><Trash2 size={14} /></button></div></div>}
      </aside>
      <section className="builder-canvas">
        <div className="builder-canvas-label"><span>Canvas</span><small>Drag headers to move · drag corners to resize</small></div>
        <GridLayout layout={layout} cols={12} rowHeight={54} width={900} margin={[8, 8]} onLayoutChange={changeLayout} draggableHandle=".builder-visual-handle">
          {page?.visuals.map((visual) => <div key={visual.id} onClick={() => setSelectedId(visual.id)}><div className={`builder-preview ${selectedId === visual.id ? "selected" : ""}`}><button className="builder-visual-handle" aria-label={`Move ${visual.title}`}>{visual.title}</button><div className="builder-preview-body"><ReportVisual visual={visual} rows={previewRows} showActions={false} /></div></div></div>)}
        </GridLayout>
        {!page?.visuals.length && <div className="empty-state">Add a visual from the left pane, then drag and resize it on this canvas.</div>}
      </section>
      <aside className="builder-pane builder-settings-pane">
        <div className="builder-settings-tabs"><button className={settingsTab === "build" ? "active" : ""} onClick={() => setSettingsTab("build")}><Layers3 size={14} /> Build</button><button className={settingsTab === "format" ? "active" : ""} onClick={() => setSettingsTab("format")}><Paintbrush size={14} /> Format</button><button className={settingsTab === "filters" ? "active" : ""} onClick={() => setSettingsTab("filters")}><SlidersHorizontal size={14} /> Filters</button></div>
        {settingsTab === "build" && (selected ? <BuildSettings selected={selected} dimensions={dimensions} measures={measures} updateSelected={updateSelected} onDelete={() => { if (!page) return; updatePage({ ...page, visuals: page.visuals.filter((visual) => visual.id !== selected.id) }); setSelectedId(undefined); }} /> : <div className="empty-state compact">Select a visual to configure its data fields.</div>)}
        {settingsTab === "format" && (selected ? <FormatSettings selected={selected} updateDisplay={updateDisplay} updateInteraction={updateInteraction} /> : <div className="empty-state compact">Select a visual to format its title, colors, labels, and interactions.</div>)}
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
  </div>;
}

function FormatSettings({ selected, updateDisplay, updateInteraction }: { selected: VisualDefinition; updateDisplay: (changes: NonNullable<VisualDefinition["display"]>) => void; updateInteraction: (changes: NonNullable<VisualDefinition["interaction"]>) => void }) {
  const display = selected.display ?? {};
  const interaction = selected.interaction ?? {};
  return <div className="form-stack"><div className="panel-header"><div><h3>Format visual</h3><p>Appearance and behavior</p></div></div><div className="settings-group"><strong>Title and style</strong><label className="toggle-row"><span>Show title</span><input type="checkbox" checked={display.showTitle !== false} onChange={(event) => updateDisplay({ showTitle: event.target.checked })} /></label><label>Title alignment<select value={display.titleAlignment ?? "left"} onChange={(event) => updateDisplay({ titleAlignment: event.target.value as "left" | "center" | "right" })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label><label>Accent color<input type="color" value={display.accentColor ?? "#5c73e6"} onChange={(event) => updateDisplay({ accentColor: event.target.value })} /></label><label>Background<input type="color" value={display.backgroundColor ?? "#ffffff"} onChange={(event) => updateDisplay({ backgroundColor: event.target.value })} /></label><label>Corner radius<input type="range" min="0" max="24" value={display.borderRadius ?? 10} onChange={(event) => updateDisplay({ borderRadius: Number(event.target.value) })} /></label></div><div className="settings-group"><strong>Chart elements</strong><label className="toggle-row"><span>Legend</span><input type="checkbox" checked={display.showLegend ?? false} onChange={(event) => updateDisplay({ showLegend: event.target.checked })} /></label><label className="toggle-row"><span>Data labels</span><input type="checkbox" checked={display.showDataLabels ?? false} onChange={(event) => updateDisplay({ showDataLabels: event.target.checked })} /></label><label className="toggle-row"><span>Gridlines</span><input type="checkbox" checked={display.showGridlines !== false} onChange={(event) => updateDisplay({ showGridlines: event.target.checked })} /></label></div><div className="settings-group"><strong>Interactions</strong><label className="toggle-row"><span>Cross-filter</span><input type="checkbox" checked={interaction.crossFilter !== false} onChange={(event) => updateInteraction({ crossFilter: event.target.checked })} /></label><label className="toggle-row"><span>Tooltips</span><input type="checkbox" checked={interaction.tooltips !== false} onChange={(event) => updateInteraction({ tooltips: event.target.checked })} /></label></div></div>;
}

function FilterEditor({ title, filters, fields, onChange }: { title: string; filters: ReportFilterDefinition[]; fields: Dataset["fields"]; onChange: (filters: ReportFilterDefinition[]) => void }) {
  const add = () => {
    const first = fields[0];
    if (first) onChange([...filters, { id: crypto.randomUUID(), field: first.key as ReportFilterDefinition["field"], operator: "equals", value: "" }]);
  };
  const update = (id: string, changes: Partial<ReportFilterDefinition>) => onChange(filters.map((filter) => filter.id === id ? { ...filter, ...changes } : filter));
  return <section className="filter-editor"><div className="panel-header"><div><h3>{title}</h3><p>{filters.length} configured</p></div><button className="icon-button" onClick={add} aria-label={`Add ${title.toLocaleLowerCase()}`}><Plus size={13} /></button></div>{filters.map((filter) => <div className="filter-editor-card" key={filter.id}><select aria-label="Filter field" value={filter.field} onChange={(event) => update(filter.id, { field: event.target.value as ReportFilterDefinition["field"] })}>{fields.map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select><select aria-label="Filter operator" value={filter.operator} onChange={(event) => update(filter.id, { operator: event.target.value as ReportFilterDefinition["operator"] })}><option value="equals">is</option><option value="notEquals">is not</option><option value="contains">contains</option><option value="greaterThanOrEqual">is at least</option><option value="lessThanOrEqual">is at most</option></select><div><input aria-label="Filter value" value={filter.value} placeholder="Value" onChange={(event) => update(filter.id, { value: event.target.value })} /><button className="icon-button danger" aria-label="Remove filter" onClick={() => onChange(filters.filter((item) => item.id !== filter.id))}><Trash2 size={12} /></button></div></div>)}{!filters.length && <p className="muted filter-empty">No filters at this scope.</p>}</section>;
}
