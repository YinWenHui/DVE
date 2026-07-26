"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { resolveConditionalFormatting } from "@/lib/reporting";
import type { ManufacturingRecord, VisualDefinition } from "@/types";

function ConditionalCell({ visual, field, value, maximum, children }: { visual: VisualDefinition; field: keyof ManufacturingRecord; value: unknown; maximum: number; children: ReactNode }) {
  const resolved = resolveConditionalFormatting(visual, field, value);
  const numericValue = Number(value);
  const width = resolved.dataBar && Number.isFinite(numericValue) && maximum > 0 ? Math.min(100, Math.abs(numericValue) / maximum * 100) : 0;
  const style = { backgroundColor: resolved.backgroundColor, color: resolved.textColor, "--conditional-bar-color": resolved.dataBar, "--conditional-bar-width": `${width}%` } as CSSProperties;
  return <td className={resolved.dataBar ? "conditional-data-bar-cell" : undefined} style={style} data-conditional-background={resolved.backgroundColor} data-conditional-text={resolved.textColor} data-conditional-bar={resolved.dataBar}>
    {resolved.dataBar && <span className="conditional-data-bar" aria-hidden="true" />}
    <span className="conditional-cell-value">{children}</span>
  </td>;
}

function fieldMaximums(rows: ManufacturingRecord[]) {
  const maximums = new Map<keyof ManufacturingRecord, number>();
  rows.forEach((row) => Object.entries(row).forEach(([field, rawValue]) => {
    const value = Math.abs(Number(rawValue));
    if (Number.isFinite(value)) maximums.set(field as keyof ManufacturingRecord, Math.max(maximums.get(field as keyof ManufacturingRecord) ?? 0, value));
  }));
  return maximums;
}

export function ProductionTable({ visual, rows, highlightRows }: { visual: VisualDefinition; rows: ManufacturingRecord[]; highlightRows?: ManufacturingRecord[] }) {
  const columns = useMemo<ColumnDef<ManufacturingRecord>[]>(() => [
    { accessorKey: "RecordDate", header: "Date" },
    { accessorKey: "Line", header: "Line" },
    { accessorKey: "Shift", header: "Shift" },
    { accessorKey: "Model", header: "Model" },
    { accessorKey: "Customer", header: "Customer" },
    { accessorKey: "PlanQty", header: "Plan", cell: ({ getValue }) => Number(getValue()).toLocaleString() },
    { accessorKey: "ActualQty", header: "Actual", cell: ({ getValue }) => Number(getValue()).toLocaleString() },
    { accessorKey: "GapQty", header: "Gap", cell: ({ getValue }) => Number(getValue()).toLocaleString() },
    { accessorKey: "YieldRate", header: "Yield", cell: ({ getValue }) => `${(Number(getValue()) * 100).toFixed(1)}%` },
    { accessorKey: "PendingQty", header: "Pending", cell: ({ getValue }) => Number(getValue()).toLocaleString() },
  ], []);
  const tableRows = useMemo(() => rows.slice(0, 100), [rows]);
  const maximums = useMemo(() => fieldMaximums(tableRows), [tableRows]);
  // TanStack Table intentionally owns a stateful function graph, so React Compiler must not memoize this hook result.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: tableRows, columns, getCoreRowModel: getCoreRowModel() });
  const highlightedIds = useMemo(() => new Set(highlightRows?.map((row) => row.id) ?? []), [highlightRows]);
  return <div className="data-table-wrap"><table className="data-table">
    <thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead>
    <tbody>{table.getRowModel().rows.map((row) => <tr className={highlightRows ? highlightedIds.has(row.original.id) ? "interaction-highlighted-row" : "interaction-dimmed-row" : undefined} key={row.id}>{row.getVisibleCells().map((cell) => { const field = cell.column.id as keyof ManufacturingRecord; return <ConditionalCell visual={visual} field={field} value={cell.getValue()} maximum={maximums.get(field) ?? 0} key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</ConditionalCell>; })}</tr>)}</tbody>
  </table></div>;
}

export function ProductionMatrix({ visual, rows, highlightRows }: { visual: VisualDefinition; rows: ManufacturingRecord[]; highlightRows?: ManufacturingRecord[] }) {
  const matrix = useMemo(() => {
    const values = new Map<string, { line: string; model: string; plan: number; actual: number; pending: number }>();
    rows.forEach((row) => {
      const key = `${row.Line}|${row.Model}`;
      const current = values.get(key) ?? { line: row.Line, model: row.Model, plan: 0, actual: 0, pending: 0 };
      current.plan += row.PlanQty; current.actual += row.ActualQty; current.pending += row.PendingQty;
      values.set(key, current);
    });
    return [...values.values()];
  }, [rows]);
  const highlightedGroups = useMemo(() => new Set(highlightRows?.map((row) => `${row.Line}|${row.Model}`) ?? []), [highlightRows]);
  const totals = matrix.reduce((acc, row) => ({ plan: acc.plan + row.plan, actual: acc.actual + row.actual, pending: acc.pending + row.pending }), { plan: 0, actual: 0, pending: 0 });
  const maximums = {
    PlanQty: Math.max(...matrix.map((row) => Math.abs(row.plan)), Math.abs(totals.plan), 0),
    ActualQty: Math.max(...matrix.map((row) => Math.abs(row.actual)), Math.abs(totals.actual), 0),
    PendingQty: Math.max(...matrix.map((row) => Math.abs(row.pending)), Math.abs(totals.pending), 0),
  };
  return <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Line</th><th>Model</th><th>Plan</th><th>Actual</th><th>Achievement</th><th>Pending</th></tr></thead><tbody>
    {matrix.map((row) => <tr className={highlightRows ? highlightedGroups.has(`${row.line}|${row.model}`) ? "interaction-highlighted-row" : "interaction-dimmed-row" : undefined} key={`${row.line}-${row.model}`}><td>{row.line}</td><td>{row.model}</td><ConditionalCell visual={visual} field="PlanQty" value={row.plan} maximum={maximums.PlanQty}>{row.plan.toLocaleString()}</ConditionalCell><ConditionalCell visual={visual} field="ActualQty" value={row.actual} maximum={maximums.ActualQty}>{row.actual.toLocaleString()}</ConditionalCell><td>{row.plan ? `${(row.actual / row.plan * 100).toFixed(1)}%` : "—"}</td><ConditionalCell visual={visual} field="PendingQty" value={row.pending} maximum={maximums.PendingQty}>{row.pending.toLocaleString()}</ConditionalCell></tr>)}
    <tr className="matrix-total"><td colSpan={2}>Total</td><ConditionalCell visual={visual} field="PlanQty" value={totals.plan} maximum={maximums.PlanQty}>{totals.plan.toLocaleString()}</ConditionalCell><ConditionalCell visual={visual} field="ActualQty" value={totals.actual} maximum={maximums.ActualQty}>{totals.actual.toLocaleString()}</ConditionalCell><td>{totals.plan ? `${(totals.actual / totals.plan * 100).toFixed(1)}%` : "—"}</td><ConditionalCell visual={visual} field="PendingQty" value={totals.pending} maximum={maximums.PendingQty}>{totals.pending.toLocaleString()}</ConditionalCell></tr>
  </tbody></table></div>;
}
