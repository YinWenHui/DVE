"use client";

import { memo, useCallback, useMemo, useState, type CSSProperties, type MouseEvent } from "react";
import { ChevronUp, ChevronsDown, CornerUpRight, GitBranch, Maximize2, TableProperties } from "lucide-react";
import { EChart } from "./echart";
import { ProductionMatrix, ProductionTable } from "./data-table";
import { aggregateRows, applyReportFilters, applyVisualDrillPath, chartOption, resolveConditionalFormatting, sortVisualRows, visualHierarchy, type VisualDrillSelection } from "@/lib/reporting";
import type { ManufacturingRecord, VisualDefinition } from "@/types";

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export type ActiveReportFilters = Partial<Record<keyof ManufacturingRecord, string>>;

interface ReportVisualProps {
  visual: VisualDefinition;
  rows: ManufacturingRecord[];
  highlightRows?: ManufacturingRecord[];
  selectedValue?: string;
  activeFilters?: ActiveReportFilters;
  onSelect?: (field: keyof ManufacturingRecord | undefined, value: string) => void;
  onFocus?: (visual: VisualDefinition) => void;
  onShowData?: (visual: VisualDefinition) => void;
  onDrillthrough?: (visual: VisualDefinition) => void;
  showActions?: boolean;
}

interface DrillState {
  level: number;
  path: VisualDrillSelection[];
}

export const ReportVisual = memo(function ReportVisual({ visual, rows, highlightRows, selectedValue, activeFilters = {}, onSelect, onFocus, onShowData, onDrillthrough, showActions = true }: ReportVisualProps) {
  const hierarchy = useMemo(() => visualHierarchy(visual), [visual]);
  const [drill, setDrill] = useState<DrillState>({ level: 0, path: [] });
  const [drillMode, setDrillMode] = useState(false);

  const level = Math.min(drill.level, Math.max(0, hierarchy.length - 1));
  const drillField = hierarchy[level] ?? visual.dimension;
  const supportsDrill = Boolean(drillField && visual.measure && hierarchy.length > 1 && !["gauge", "scatter", "slicer"].includes(visual.type));
  const canAdvance = supportsDrill && level < hierarchy.length - 1;
  const scopedRows = useMemo(() => sortVisualRows(visual, applyReportFilters(rows, visual.filters)), [rows, visual]);
  const drilledRows = useMemo(() => applyVisualDrillPath(scopedRows, drill.path), [drill.path, scopedRows]);
  const scopedHighlightRows = useMemo(() => highlightRows ? sortVisualRows(visual, applyReportFilters(highlightRows, visual.filters)) : undefined, [highlightRows, visual]);
  const drilledHighlightRows = useMemo(() => scopedHighlightRows ? applyVisualDrillPath(scopedHighlightRows, drill.path) : undefined, [drill.path, scopedHighlightRows]);
  const renderedVisual = useMemo(() => drillField ? { ...visual, dimension: drillField } : visual, [drillField, visual]);
  const actionVisual = useMemo<VisualDefinition>(() => ({
    ...renderedVisual,
    hierarchy: undefined,
    filters: [
      ...(visual.filters ?? []),
      ...drill.path.map((selection, index) => ({ id: `drill-${visual.id}-${index}`, field: selection.field, operator: "equals" as const, value: selection.value })),
    ],
  }), [drill.path, renderedVisual, visual.filters, visual.id]);

  const selectCategory = useCallback((field: keyof ManufacturingRecord | undefined, value: string) => {
    if (drillMode && canAdvance && field) {
      setDrill((current) => ({ level: Math.min(current.level + 1, hierarchy.length - 1), path: [...current.path, { field, value }] }));
      return;
    }
    onSelect?.(field, value);
  }, [canAdvance, drillMode, hierarchy.length, onSelect]);

  const drillUp = useCallback(() => {
    setDrill((current) => ({ level: Math.max(0, current.level - 1), path: current.path.slice(0, Math.max(0, current.level - 1)) }));
  }, []);
  const expandNext = useCallback(() => {
    setDrill((current) => ({ ...current, level: Math.min(current.level + 1, hierarchy.length - 1) }));
  }, [hierarchy.length]);

  const style = {
    "--visual-accent": visual.display?.accentColor ?? "var(--accent)",
    backgroundColor: visual.display?.backgroundColor,
    borderRadius: visual.display?.borderRadius,
  } as CSSProperties;
  const actions = showActions && <VisualActions
    visual={visual}
    onFocus={onFocus ? () => onFocus(actionVisual) : undefined}
    onShowData={onShowData ? () => onShowData(actionVisual) : undefined}
    onDrillthrough={onDrillthrough ? () => onDrillthrough(actionVisual) : undefined}
    drill={supportsDrill ? { level, canAdvance, enabled: drillMode, onToggle: () => setDrillMode((current) => !current), onUp: drillUp, onExpand: expandNext } : undefined}
  />;

  if (visual.type === "kpi" && visual.measure) {
    const value = aggregateRows(drilledRows, visual.measure, visual.aggregation);
    const highlightedValue = drilledHighlightRows ? aggregateRows(drilledHighlightRows, visual.measure, visual.aggregation) : undefined;
    const conditional = resolveConditionalFormatting(visual, visual.measure, value);
    const kpiStyle = { ...style, "--visual-accent": conditional.dataColor ?? visual.conditionalFormatting?.defaultColor ?? visual.display?.accentColor ?? "var(--accent)", backgroundColor: conditional.backgroundColor ?? visual.display?.backgroundColor } as CSSProperties;
    const formatValue = (input: number) => visual.format === "percent" ? `${(input * 100).toFixed(1)}%` : numberFormat.format(input);
    return <article className="visual-card kpi-card" style={kpiStyle} data-conditional-rule-count={visual.conditionalFormatting?.rules.length ?? 0} data-conditional-data-color={conditional.dataColor} data-conditional-background={conditional.backgroundColor}>
      {actions}
      <span>{visual.display?.showTitle === false ? null : visual.title}</span>
      <strong style={{ color: conditional.textColor }} data-conditional-text={conditional.textColor}>{formatValue(value)}</strong>
      <small className={highlightedValue === undefined ? undefined : "interaction-highlight-summary"}>{highlightedValue === undefined ? (drilledRows.length ? "Within current filter context" : "No matching records") : `${formatValue(highlightedValue)} highlighted of ${formatValue(value)}`}</small>
    </article>;
  }

  if (visual.type === "table" || visual.type === "matrix") return <article className="visual-card" style={style} data-conditional-rule-count={visual.conditionalFormatting?.rules.length ?? 0}>
    <VisualHeader visual={visual} meta={visual.type === "table" ? `${drilledRows.length} rows` : "Grouped detail"} actions={actions} />
    <div className="visual-body">{visual.type === "table" ? <ProductionTable visual={visual} rows={drilledRows} highlightRows={drilledHighlightRows} /> : <ProductionMatrix visual={visual} rows={drilledRows} highlightRows={drilledHighlightRows} />}</div>
  </article>;

  if (visual.type === "slicer" && visual.dimension) {
    const values = [...new Set(drilledRows.map((row) => String(row[visual.dimension as keyof ManufacturingRecord])))].sort();
    const selected = selectedValue ?? activeFilters[visual.dimension] ?? "";
    const highlightedValues = new Set(drilledHighlightRows?.map((row) => String(row[visual.dimension as keyof ManufacturingRecord])) ?? []);
    return <article className="visual-card" style={style}>
      <VisualHeader visual={visual} meta="Shared filter" actions={actions} />
      <div className="visual-body"><div className="builder-tool-list">{values.map((value) => <button className={`builder-tool ${selected === value ? "active" : highlightedValues.has(value) ? "highlighted" : ""}`} key={value} onClick={() => onSelect?.(visual.dimension, value)}>{value}</button>)}</div></div>
    </article>;
  }

  const fieldName = displayFieldName(drillField);
  const interactionMeta = supportsDrill
    ? `${fieldName} level · ${drillMode && canAdvance ? "select to drill" : onSelect ? selectedValue ? `${selectedValue} selected` : "click to interact" : "interaction off"}`
    : onSelect ? selectedValue ? `${selectedValue} selected` : "Click to interact" : "Interaction off";
  return <ChartVisual visual={renderedVisual} rows={drilledRows} highlightRows={drilledHighlightRows} onSelect={drillMode && canAdvance || onSelect ? selectCategory : undefined} actions={actions} style={style} meta={interactionMeta} />;
});

function displayFieldName(field: keyof ManufacturingRecord | undefined) {
  return field ? String(field).replace(/([a-z])([A-Z])/g, "$1 $2") : "Category";
}

function VisualHeader({ visual, meta, actions }: { visual: VisualDefinition; meta: string; actions: React.ReactNode }) {
  if (visual.display?.showTitle === false && !actions) return null;
  return <div className="visual-card-header">
    <h3 style={{ textAlign: visual.display?.titleAlignment ?? "left" }}>{visual.display?.showTitle === false ? null : visual.title}</h3>
    <div className="visual-header-meta"><span>{meta}</span>{actions}</div>
  </div>;
}

function VisualActions({ visual, onFocus, onShowData, onDrillthrough, drill }: {
  visual: VisualDefinition;
  onFocus?: () => void;
  onShowData?: () => void;
  onDrillthrough?: () => void;
  drill?: { level: number; canAdvance: boolean; enabled: boolean; onToggle: () => void; onUp: () => void; onExpand: () => void };
}) {
  const run = (event: MouseEvent<HTMLButtonElement>, action: (() => void) | undefined) => { event.stopPropagation(); action?.(); };
  return <div className="visual-actions">
    {drill && drill.level > 0 && <button type="button" title="Drill up" aria-label={`Drill up ${visual.title}`} onClick={(event) => run(event, drill.onUp)}><ChevronUp size={13} /></button>}
    {drill?.canAdvance && <button type="button" className={drill.enabled ? "active" : ""} title={drill.enabled ? "Turn off drill down" : "Turn on drill down"} aria-label={`${drill.enabled ? "Turn off" : "Turn on"} drill down for ${visual.title}`} aria-pressed={drill.enabled} onClick={(event) => run(event, drill.onToggle)}><GitBranch size={13} /></button>}
    {drill?.canAdvance && <button type="button" title="Expand to the next hierarchy level" aria-label={`Expand ${visual.title} to next level`} onClick={(event) => run(event, drill.onExpand)}><ChevronsDown size={13} /></button>}
    {onDrillthrough && <button type="button" title="Drill through" aria-label={`Drill through from ${visual.title}`} onClick={(event) => run(event, onDrillthrough)}><CornerUpRight size={13} /></button>}
    {onShowData && <button type="button" title="Show data" aria-label={`Show data for ${visual.title}`} onClick={(event) => run(event, onShowData)}><TableProperties size={13} /></button>}
    {onFocus && <button type="button" title="Focus mode" aria-label={`Focus ${visual.title}`} onClick={(event) => run(event, onFocus)}><Maximize2 size={13} /></button>}
  </div>;
}

function ChartVisual({ visual, rows, highlightRows, onSelect, actions, style, meta }: { visual: VisualDefinition; rows: ManufacturingRecord[]; highlightRows?: ManufacturingRecord[]; onSelect?: ReportVisualProps["onSelect"]; actions: React.ReactNode; style: CSSProperties; meta: string }) {
  const option = useMemo(() => chartOption(visual, rows, highlightRows), [highlightRows, rows, visual]);
  const select = useCallback((value: string) => onSelect?.(visual.dimension, value), [onSelect, visual.dimension]);
  const multiples = useMemo(() => {
    if (!visual.smallMultipleField) return [];
    const values = [...new Set(rows.map((row) => String(row[visual.smallMultipleField!] ?? "Blank")))].sort().slice(0, 8);
    return values.map((value) => ({
      value,
      rows: rows.filter((row) => String(row[visual.smallMultipleField!] ?? "Blank") === value),
      highlightRows: highlightRows?.filter((row) => String(row[visual.smallMultipleField!] ?? "Blank") === value),
    }));
  }, [highlightRows, rows, visual.smallMultipleField]);
  if (visual.smallMultipleField && multiples.length) return <article className="visual-card interactive" style={style} data-conditional-rule-count={visual.conditionalFormatting?.rules.length ?? 0} data-small-multiple-count={multiples.length}>
    <VisualHeader visual={visual} meta={`${displayFieldName(visual.smallMultipleField)} small multiples`} actions={actions} />
    <div className="visual-body small-multiples-grid">{multiples.map((multiple) => <section className="small-multiple" key={multiple.value}><strong>{multiple.value}</strong><EChart option={chartOption({ ...visual, smallMultipleField: undefined }, multiple.rows, multiple.highlightRows)} onSelect={onSelect ? select : undefined} /></section>)}</div>
  </article>;
  return <article className="visual-card interactive" style={style} data-conditional-rule-count={visual.conditionalFormatting?.rules.length ?? 0}>
    <VisualHeader visual={visual} meta={meta} actions={actions} />
    <div className="visual-body"><EChart option={option} onSelect={onSelect ? select : undefined} /></div>
  </article>;
}
