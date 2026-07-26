"use client";

import { useMemo } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import type { ManufacturingRecord } from "@/types";

export function ProductionTable({ rows, highlightRows }: { rows: ManufacturingRecord[]; highlightRows?: ManufacturingRecord[] }) {
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
  // TanStack Table intentionally owns a stateful function graph, so React Compiler must not memoize this hook result.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: rows.slice(0, 100), columns, getCoreRowModel: getCoreRowModel() });
  const highlightedIds = useMemo(() => new Set(highlightRows?.map((row) => row.id) ?? []), [highlightRows]);
  return <div className="data-table-wrap"><table className="data-table">
    <thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead>
    <tbody>{table.getRowModel().rows.map((row) => <tr className={highlightRows ? highlightedIds.has(row.original.id) ? "interaction-highlighted-row" : "interaction-dimmed-row" : undefined} key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
  </table></div>;
}

export function ProductionMatrix({ rows, highlightRows }: { rows: ManufacturingRecord[]; highlightRows?: ManufacturingRecord[] }) {
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
  return <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Line</th><th>Model</th><th>Plan</th><th>Actual</th><th>Achievement</th><th>Pending</th></tr></thead><tbody>
    {matrix.map((row) => <tr className={highlightRows ? highlightedGroups.has(`${row.line}|${row.model}`) ? "interaction-highlighted-row" : "interaction-dimmed-row" : undefined} key={`${row.line}-${row.model}`}><td>{row.line}</td><td>{row.model}</td><td>{row.plan.toLocaleString()}</td><td>{row.actual.toLocaleString()}</td><td>{row.plan ? `${(row.actual / row.plan * 100).toFixed(1)}%` : "—"}</td><td>{row.pending.toLocaleString()}</td></tr>)}
    <tr className="matrix-total"><td colSpan={2}>Total</td><td>{totals.plan.toLocaleString()}</td><td>{totals.actual.toLocaleString()}</td><td>{totals.plan ? `${(totals.actual / totals.plan * 100).toFixed(1)}%` : "—"}</td><td>{totals.pending.toLocaleString()}</td></tr>
  </tbody></table></div>;
}
