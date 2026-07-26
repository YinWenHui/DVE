"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Responsive, WidthProvider, type Layout } from "react-grid-layout";
import { Download, FilterX, RotateCcw } from "lucide-react";
import type { EChartsOption } from "echarts";
import { EChart } from "./echart";
import { ProductionMatrix, ProductionTable } from "./data-table";
import { CommentsPanel } from "./comments-panel";
import type { Dataset, ManufacturingRecord, Report, VisualDefinition } from "@/types";

interface Filters { from: string; to: string; Line: string; Model: string; Customer: string; Shift: string }
const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const ResponsiveGridLayout = WidthProvider(Responsive);

export function ReportDashboard({ report, dataset, records, canComment }: { report: Report; dataset: Dataset; records: Record<string, unknown>[]; canComment: boolean }) {
  const typedRecords = useMemo(() => records as unknown as ManufacturingRecord[], [records]);
  const defaultFilters = useMemo<Filters>(() => {
    const dates = typedRecords.map((row) => row.RecordDate).sort();
    return { from: dates.at(-30) ?? dates[0] ?? "", to: dates.at(-1) ?? "", Line: "", Model: "", Customer: "", Shift: "" };
  }, [typedRecords]);
  const [filters, setFilters] = useState(defaultFilters);
  const [browserLoadedAt, setBrowserLoadedAt] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const page = report.pages[pageIndex] ?? report.pages[0];
  const filtered = useMemo(() => typedRecords.filter((row) =>
    (!filters.from || row.RecordDate >= filters.from) && (!filters.to || row.RecordDate <= filters.to) &&
    (!filters.Line || row.Line === filters.Line) && (!filters.Model || row.Model === filters.Model) &&
    (!filters.Customer || row.Customer === filters.Customer) && (!filters.Shift || row.Shift === filters.Shift)
  ), [filters, typedRecords]);
  const unique = useCallback((field: "Line" | "Model" | "Customer" | "Shift") => [...new Set(typedRecords.map((row) => String(row[field])))].sort(), [typedRecords]);
  useEffect(() => {
    const update = () => setBrowserLoadedAt(new Date().toISOString());
    update(); window.addEventListener("dve:browser-loaded", update);
    return () => window.removeEventListener("dve:browser-loaded", update);
  }, []);

  const selectCategory = useCallback((field: keyof ManufacturingRecord | undefined, value: string) => {
    if (field === "Line" || field === "Model" || field === "Customer" || field === "Shift") setFilters((current) => ({ ...current, [field]: current[field] === value ? "" : value }));
  }, []);

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
  return <main className="report-page">
    <nav className="report-tabs" aria-label="Report pages">{report.pages.map((item, index) => <button className={`report-tab ${index === pageIndex ? "active" : ""}`} key={item.id} onClick={() => setPageIndex(index)}>{item.name}</button>)}</nav>
    <div className="filter-bar">
      <div className="filter-field"><label>Date from</label><input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></div>
      <div className="filter-field"><label>Date to</label><input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></div>
      {(["Line", "Model", "Customer", "Shift"] as const).map((field) => <div className="filter-field" key={field}><label>{field}</label><select value={filters[field]} onChange={(event) => setFilters({ ...filters, [field]: event.target.value })}><option value="">All</option>{unique(field).map((value) => <option key={value}>{value}</option>)}</select></div>)}
      <div className="filter-spacer" />
      <button className="button" onClick={() => setFilters({ ...defaultFilters, from: "", to: "" })}><FilterX size={14} /> Clear</button>
      <button className="button" onClick={() => setFilters(defaultFilters)}><RotateCcw size={14} /> Reset</button>
      <button className="button" onClick={() => exportData("csv")}><Download size={14} /> CSV</button>
      <button className="button" onClick={() => exportData("xlsx")}><Download size={14} /> Excel</button>
      {canComment && <CommentsPanel reportId={report.id} />}
    </div>
    <div className="source-strip"><span>Source updated <strong>{new Date(dataset.sourceUpdatedAt).toLocaleString()}</strong></span><span>Dataset imported <strong>{new Date(dataset.importedAt).toLocaleString()}</strong></span><span>Browser loaded <strong>{browserLoadedAt ? new Date(browserLoadedAt).toLocaleString() : "Loading…"}</strong></span><span>Rows in context <strong>{filtered.length.toLocaleString()}</strong></span></div>
    {dataset.status !== "healthy" && <div className="status-banner">Data freshness is {dataset.status}. The previous validated dataset version remains active.</div>}
    <section className="report-canvas" data-report-canvas>
      <ResponsiveGridLayout className="layout" layouts={layouts} breakpoints={{ lg: 1100, md: 850, sm: 620, xs: 420, xxs: 0 }} cols={{ lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }} rowHeight={54} margin={[10, 10]} isDraggable={false} isResizable={false} measureBeforeMount>
        {page.visuals.map((visual) => <div key={visual.id}><VisualCard visual={visual} rows={filtered} activeFilters={filters} onSelect={selectCategory} /></div>)}
      </ResponsiveGridLayout>
    </section>
  </main>;
}

function VisualCard({ visual, rows, activeFilters, onSelect }: { visual: VisualDefinition; rows: ManufacturingRecord[]; activeFilters: Filters; onSelect: (field: keyof ManufacturingRecord | undefined, value: string) => void }) {
  if (visual.type === "kpi" && visual.measure) {
    const value = calculate(rows, visual.measure, visual.aggregation ?? "sum");
    return <article className="visual-card kpi-card"><span>{visual.title}</span><strong>{visual.format === "percent" ? `${(value * 100).toFixed(1)}%` : numberFormat.format(value)}</strong><small>{rows.length ? "Within current filter context" : "No matching records"}</small></article>;
  }
  if (visual.type === "table") return <article className="visual-card"><div className="visual-card-header"><h3>{visual.title}</h3><span>{rows.length} rows</span></div><div className="visual-body"><ProductionTable rows={rows} /></div></article>;
  if (visual.type === "matrix") return <article className="visual-card"><div className="visual-card-header"><h3>{visual.title}</h3><span>Grouped detail</span></div><div className="visual-body"><ProductionMatrix rows={rows} /></div></article>;
  if (visual.type === "slicer" && visual.dimension) {
    const values = [...new Set(rows.map((row) => String(row[visual.dimension as keyof ManufacturingRecord])))].sort();
    const selected = visual.dimension === "Line" || visual.dimension === "Model" || visual.dimension === "Customer" || visual.dimension === "Shift" ? activeFilters[visual.dimension] : "";
    return <article className="visual-card"><div className="visual-card-header"><h3>{visual.title}</h3><span>Shared filter</span></div><div className="visual-body"><div className="builder-tool-list">{values.map((value) => <button className={`builder-tool ${selected === value ? "active" : ""}`} key={value} onClick={() => onSelect(visual.dimension, value)}>{value}</button>)}</div></div></article>;
  }
  return <ChartVisual visual={visual} rows={rows} onSelect={onSelect} />;
}

function ChartVisual({ visual, rows, onSelect }: { visual: VisualDefinition; rows: ManufacturingRecord[]; onSelect: (field: keyof ManufacturingRecord | undefined, value: string) => void }) {
  const option = useMemo(() => chartOption(visual, rows), [rows, visual]);
  const select = useCallback((value: string) => onSelect(visual.dimension, value), [onSelect, visual.dimension]);
  return <article className="visual-card interactive"><div className="visual-card-header"><h3>{visual.title}</h3><span>Click a category to filter</span></div><div className="visual-body"><EChart option={option} onSelect={select} /></div></article>;
}

function calculate(rows: ManufacturingRecord[], field: keyof ManufacturingRecord, aggregation: VisualDefinition["aggregation"]): number {
  const values = rows.map((row) => Number(row[field])).filter(Number.isFinite);
  if (aggregation === "count") return rows.length;
  if (aggregation === "distinctCount") return new Set(rows.map((row) => String(row[field]))).size;
  if (!values.length) return 0;
  if (aggregation === "average") return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (aggregation === "minimum") return Math.min(...values);
  if (aggregation === "maximum") return Math.max(...values);
  return values.reduce((sum, value) => sum + value, 0);
}

function chartOption(visual: VisualDefinition, rows: ManufacturingRecord[]): EChartsOption {
  if (!visual.dimension || !visual.measure) return {};
  const grouped = new Map<string, ManufacturingRecord[]>();
  rows.forEach((row) => { const key = String(row[visual.dimension as keyof ManufacturingRecord]); grouped.set(key, [...(grouped.get(key) ?? []), row]); });
  const categories = [...grouped.keys()].sort();
  const values = categories.map((category) => calculate(grouped.get(category) ?? [], visual.measure as keyof ManufacturingRecord, visual.aggregation));
  const common = { tooltip: { trigger: "axis" as const }, grid: { left: 48, right: 18, top: 20, bottom: 42 }, xAxis: { type: "category" as const, data: categories, axisLabel: { hideOverlap: true } }, yAxis: { type: "value" as const }, color: ["#5c73e6", "#2bb7c8"] };
  if (visual.type === "doughnut") return { tooltip: { trigger: "item" }, legend: { bottom: 0 }, color: ["#5c73e6", "#2bb7c8", "#75b798", "#e2a45d"], series: [{ type: "pie", radius: ["46%", "72%"], center: ["50%", "44%"], data: categories.map((name, index) => ({ name, value: values[index] })), label: { show: false } }] };
  if (visual.type === "line" || visual.type === "area") return { ...common, series: [{ type: "line", smooth: true, data: values, symbolSize: 5, areaStyle: visual.type === "area" ? { opacity: .18 } : undefined }] };
  return { ...common, series: [{ type: "bar", data: values, barMaxWidth: 44, itemStyle: { borderRadius: [5, 5, 0, 0] } }] };
}
