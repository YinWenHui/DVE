"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GridLayout, { type Layout } from "react-grid-layout";
import { BarChart3, CreditCard, LineChart, Plus, Save, Table2, Trash2 } from "lucide-react";
import type { Aggregation, Dataset, Report, VisualDefinition, VisualType } from "@/types";

const tools: Array<{ type: VisualType; label: string; icon: typeof BarChart3 }> = [
  { type: "kpi", label: "KPI card", icon: CreditCard }, { type: "bar", label: "Bar chart", icon: BarChart3 },
  { type: "line", label: "Line chart", icon: LineChart }, { type: "area", label: "Area chart", icon: LineChart },
  { type: "doughnut", label: "Doughnut", icon: BarChart3 }, { type: "table", label: "Table", icon: Table2 },
  { type: "matrix", label: "Matrix", icon: Table2 }, { type: "slicer", label: "Slicer", icon: Table2 },
];

export function ReportBuilder({ datasets, initial }: { datasets: Dataset[]; initial?: Report }) {
  const router = useRouter(); const dataset = datasets.find((item) => item.id === initial?.datasetId) ?? datasets[0];
  const [name, setName] = useState(initial?.name ?? "Untitled report"); const [slug, setSlug] = useState(initial?.slug ?? "untitled-report"); const [datasetId, setDatasetId] = useState(dataset?.id ?? "");
  const [pages, setPages] = useState(() => structuredClone(initial?.pages ?? [{ id: crypto.randomUUID(), name: "Overview", ordinal: 0, visuals: [] }])); const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string>(); const [message, setMessage] = useState<string>(); const page = pages[pageIndex]; const selected = page?.visuals.find((visual) => visual.id === selectedId);
  const selectedDataset = datasets.find((item) => item.id === datasetId); const dimensions = selectedDataset?.fields.filter((field) => !field.hidden && field.semanticType !== "measure") ?? []; const measures = selectedDataset?.fields.filter((field) => !field.hidden && field.semanticType === "measure") ?? [];
  const layout = useMemo<Layout[]>(() => page?.visuals.map((visual) => ({ i: visual.id, x: visual.x, y: visual.y, w: visual.w, h: visual.h, minW: 2, minH: 2 })) ?? [], [page]);

  function addVisual(type: VisualType) {
    if (!page) return; const id = crypto.randomUUID(); const measure = measures[0]?.key as VisualDefinition["measure"]; const dimension = dimensions[0]?.key as VisualDefinition["dimension"];
    const nextY = page.visuals.reduce((maximum, visual) => Math.max(maximum, visual.y + visual.h), 0);
    const visual: VisualDefinition = { id, type, title: tools.find((item) => item.type === type)?.label ?? "Visual", x: 0, y: nextY, w: type === "kpi" ? 3 : 6, h: type === "kpi" ? 2 : 5, measure, dimension, aggregation: "sum" };
    updatePage({ ...page, visuals: [...page.visuals, visual] }); setSelectedId(id);
  }
  function updatePage(nextPage: typeof page) { if (!nextPage) return; setPages((current) => current.map((item, index) => index === pageIndex ? nextPage : item)); }
  function updateSelected(changes: Partial<VisualDefinition>) { if (!page || !selectedId) return; updatePage({ ...page, visuals: page.visuals.map((visual) => visual.id === selectedId ? { ...visual, ...changes } : visual) }); }
  function changeLayout(next: Layout[]) { if (!page) return; updatePage({ ...page, visuals: page.visuals.map((visual) => { const position = next.find((item) => item.i === visual.id); return position ? { ...visual, x: position.x, y: position.y, w: position.w, h: position.h } : visual; }) }); }
  function addPage() { const next = { id: crypto.randomUUID(), name: `Page ${pages.length + 1}`, ordinal: pages.length, visuals: [] as VisualDefinition[] }; setPages((current) => [...current, next]); setPageIndex(pages.length); setSelectedId(undefined); }

  async function save(status: Report["status"] = initial?.status ?? "draft") {
    const body = { name, slug, datasetId, description: initial?.description ?? "Created with the Digital Verse report builder.", status, pages };
    const response = await fetch(initial ? `/api/reports/${initial.id}` : "/api/reports", { method: initial ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json() as { report?: Report; error?: { message?: string } }; setMessage(response.ok ? `Report ${status === "published" ? "published" : "saved"}.` : payload.error?.message ?? "Save failed.");
    if (response.ok && !initial && payload.report) router.push(`/admin/reports/${payload.report.id}/edit`);
  }

  return <>
    <div className="panel"><div className="form-grid"><label>Report name<input value={name} onChange={(event) => { setName(event.target.value); if (!initial) setSlug(event.target.value.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "")); }} /></label><label>Slug<input value={slug} onChange={(event) => setSlug(event.target.value)} /></label><label>Dataset<select value={datasetId} onChange={(event) => setDatasetId(event.target.value)}>{datasets.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div className="table-actions" style={{ alignItems: "end" }}><button className="button" onClick={() => save()}><Save size={15} /> Save draft</button><button className="button primary" onClick={() => save("published")}>Publish report</button></div></div>{message && <p className="status-banner" style={{ marginTop: 12 }}>{message}</p>}</div>
    <div className="builder-shell">
      <aside className="builder-pane"><div className="panel-header"><h3>Visuals</h3></div><div className="builder-tool-list">{tools.map(({ type, label, icon: Icon }) => <button className="builder-tool" key={type} onClick={() => addVisual(type)}><Icon size={15} />{label}<Plus size={13} /></button>)}</div><div className="panel-header" style={{ marginTop: 20 }}><h3>Pages</h3><button className="icon-button" onClick={addPage}><Plus size={14} /></button></div><div className="builder-tool-list">{pages.map((item, index) => <button className={`builder-tool ${index === pageIndex ? "active" : ""}`} key={item.id} onClick={() => { setPageIndex(index); setSelectedId(undefined); }}>{item.name}</button>)}</div>{page && <label className="form-stack" style={{ marginTop: 12 }}>Page name<input value={page.name} onChange={(event) => updatePage({ ...page, name: event.target.value })} /></label>}</aside>
      <section className="builder-canvas"><GridLayout layout={layout} cols={12} rowHeight={46} width={850} margin={[8, 8]} onLayoutChange={changeLayout} draggableHandle=".builder-visual-handle">{page?.visuals.map((visual) => <div key={visual.id} onClick={() => setSelectedId(visual.id)}><div className="builder-visual"><strong className="builder-visual-handle">{visual.title}</strong><p className="muted">{visual.type} · {visual.dimension ?? "no dimension"} · {visual.aggregation} {visual.measure}</p></div></div>)}</GridLayout>{!page?.visuals.length && <div className="empty-state">Add a visual from the left pane, then drag and resize it on this canvas.</div>}</section>
      <aside className="builder-pane">{selected ? <div className="form-stack"><div className="panel-header"><h3>Visual settings</h3><button className="icon-button danger" onClick={() => { updatePage({ ...page, visuals: page.visuals.filter((visual) => visual.id !== selected.id) }); setSelectedId(undefined); }}><Trash2 size={14} /></button></div><label>Title<input value={selected.title} onChange={(event) => updateSelected({ title: event.target.value })} /></label><label>Visual type<select value={selected.type} onChange={(event) => updateSelected({ type: event.target.value as VisualType })}>{tools.map((item) => <option value={item.type} key={item.type}>{item.label}</option>)}</select></label><label>Dimension<select value={selected.dimension ?? ""} onChange={(event) => updateSelected({ dimension: event.target.value as VisualDefinition["dimension"] })}><option value="">None</option>{dimensions.map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label><label>Measure<select value={selected.measure ?? ""} onChange={(event) => updateSelected({ measure: event.target.value as VisualDefinition["measure"] })}><option value="">None</option>{measures.map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label><label>Aggregation<select value={selected.aggregation ?? "sum"} onChange={(event) => updateSelected({ aggregation: event.target.value as Aggregation })}>{["sum", "average", "minimum", "maximum", "count", "distinctCount"].map((value) => <option key={value}>{value}</option>)}</select></label></div> : <div className="empty-state">Select a visual to edit its metadata.</div>}</aside>
    </div>
  </>;
}
