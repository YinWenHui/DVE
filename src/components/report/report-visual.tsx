"use client";

import { useCallback, useMemo, type CSSProperties, type MouseEvent } from "react";
import { Maximize2, TableProperties } from "lucide-react";
import { EChart } from "./echart";
import { ProductionMatrix, ProductionTable } from "./data-table";
import { aggregateRows, applyReportFilters, chartOption } from "@/lib/reporting";
import type { ManufacturingRecord, VisualDefinition } from "@/types";

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export type ActiveReportFilters = Partial<Record<keyof ManufacturingRecord, string>>;

interface ReportVisualProps {
  visual: VisualDefinition;
  rows: ManufacturingRecord[];
  activeFilters?: ActiveReportFilters;
  onSelect?: (field: keyof ManufacturingRecord | undefined, value: string) => void;
  onFocus?: (visual: VisualDefinition) => void;
  onShowData?: (visual: VisualDefinition) => void;
  showActions?: boolean;
}

export function ReportVisual({ visual, rows, activeFilters = {}, onSelect, onFocus, onShowData, showActions = true }: ReportVisualProps) {
  const scopedRows = useMemo(() => applyReportFilters(rows, visual.filters), [rows, visual.filters]);
  const style = {
    "--visual-accent": visual.display?.accentColor ?? "var(--accent)",
    backgroundColor: visual.display?.backgroundColor,
    borderRadius: visual.display?.borderRadius,
  } as CSSProperties;
  const actions = showActions && <VisualActions visual={visual} onFocus={onFocus} onShowData={onShowData} />;

  if (visual.type === "kpi" && visual.measure) {
    const value = aggregateRows(scopedRows, visual.measure, visual.aggregation);
    return <article className="visual-card kpi-card" style={style}>
      {actions}
      <span>{visual.display?.showTitle === false ? null : visual.title}</span>
      <strong>{visual.format === "percent" ? `${(value * 100).toFixed(1)}%` : numberFormat.format(value)}</strong>
      <small>{scopedRows.length ? "Within current filter context" : "No matching records"}</small>
    </article>;
  }

  if (visual.type === "table" || visual.type === "matrix") return <article className="visual-card" style={style}>
    <VisualHeader visual={visual} meta={visual.type === "table" ? `${scopedRows.length} rows` : "Grouped detail"} actions={actions} />
    <div className="visual-body">{visual.type === "table" ? <ProductionTable rows={scopedRows} /> : <ProductionMatrix rows={scopedRows} />}</div>
  </article>;

  if (visual.type === "slicer" && visual.dimension) {
    const values = [...new Set(scopedRows.map((row) => String(row[visual.dimension as keyof ManufacturingRecord])))].sort();
    const selected = activeFilters[visual.dimension] ?? "";
    return <article className="visual-card" style={style}>
      <VisualHeader visual={visual} meta="Shared filter" actions={actions} />
      <div className="visual-body"><div className="builder-tool-list">{values.map((value) => <button className={`builder-tool ${selected === value ? "active" : ""}`} key={value} onClick={() => onSelect?.(visual.dimension, value)}>{value}</button>)}</div></div>
    </article>;
  }

  return <ChartVisual visual={visual} rows={scopedRows} onSelect={onSelect} actions={actions} style={style} />;
}

function VisualHeader({ visual, meta, actions }: { visual: VisualDefinition; meta: string; actions: React.ReactNode }) {
  if (visual.display?.showTitle === false && !actions) return null;
  return <div className="visual-card-header">
    <h3 style={{ textAlign: visual.display?.titleAlignment ?? "left" }}>{visual.display?.showTitle === false ? null : visual.title}</h3>
    <div className="visual-header-meta"><span>{meta}</span>{actions}</div>
  </div>;
}

function VisualActions({ visual, onFocus, onShowData }: { visual: VisualDefinition; onFocus?: (visual: VisualDefinition) => void; onShowData?: (visual: VisualDefinition) => void }) {
  const run = (event: MouseEvent<HTMLButtonElement>, action: (() => void) | undefined) => { event.stopPropagation(); action?.(); };
  return <div className="visual-actions">
    {onShowData && <button type="button" title="Show data" aria-label={`Show data for ${visual.title}`} onClick={(event) => run(event, () => onShowData(visual))}><TableProperties size={13} /></button>}
    {onFocus && <button type="button" title="Focus mode" aria-label={`Focus ${visual.title}`} onClick={(event) => run(event, () => onFocus(visual))}><Maximize2 size={13} /></button>}
  </div>;
}

function ChartVisual({ visual, rows, onSelect, actions, style }: { visual: VisualDefinition; rows: ManufacturingRecord[]; onSelect?: ReportVisualProps["onSelect"]; actions: React.ReactNode; style: CSSProperties }) {
  const option = useMemo(() => chartOption(visual, rows), [rows, visual]);
  const select = useCallback((value: string) => {
    if (visual.interaction?.crossFilter !== false) onSelect?.(visual.dimension, value);
  }, [onSelect, visual.dimension, visual.interaction?.crossFilter]);
  return <article className="visual-card interactive" style={style}>
    <VisualHeader visual={visual} meta={visual.interaction?.crossFilter === false ? "Interaction off" : "Click to filter"} actions={actions} />
    <div className="visual-body"><EChart option={option} onSelect={visual.interaction?.crossFilter === false ? undefined : select} /></div>
  </article>;
}
