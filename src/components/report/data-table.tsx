"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { aggregateRows, resolveConditionalFormatting } from "@/lib/reporting";
import { formatTabularValue, resolvedMatrixRows, resolvedTabularColumns } from "@/lib/tabular";
import type { ManufacturingRecord, TabularColumnDefinition, VisualDefinition } from "@/types";

function columnStyle(column: TabularColumnDefinition): CSSProperties {
  return { width: column.width, minWidth: column.width, textAlign: column.alignment };
}

function ConditionalCell({ visual, column, value, maximum, children }: { visual: VisualDefinition; column: TabularColumnDefinition; value: unknown; maximum: number; children: ReactNode }) {
  const resolved = resolveConditionalFormatting(visual, column.field, value);
  const numericValue = Number(value);
  const width = resolved.dataBar && Number.isFinite(numericValue) && maximum > 0 ? Math.min(100, Math.abs(numericValue) / maximum * 100) : 0;
  const style = { ...columnStyle(column), backgroundColor: resolved.backgroundColor, color: resolved.textColor, "--conditional-bar-color": resolved.dataBar, "--conditional-bar-width": `${width}%` } as CSSProperties;
  return <td className={resolved.dataBar ? "conditional-data-bar-cell" : undefined} style={style} data-field={column.field} data-conditional-background={resolved.backgroundColor} data-conditional-text={resolved.textColor} data-conditional-bar={resolved.dataBar}>
    {resolved.dataBar && <span className="conditional-data-bar" aria-hidden="true" />}
    <span className="conditional-cell-value">{children}</span>
  </td>;
}

function fieldMaximums(rows: ManufacturingRecord[], columns: TabularColumnDefinition[]) {
  return new Map(columns.map((column) => [column.field, Math.max(...rows.map((row) => Math.abs(Number(row[column.field]))).filter(Number.isFinite), 0)]));
}

function tableClass(visual: VisualDefinition) {
  return `data-table density-${visual.tabular?.density ?? "standard"}${visual.tabular?.stripedRows ? " striped" : ""}`;
}

export function ProductionTable({ visual, rows, highlightRows }: { visual: VisualDefinition; rows: ManufacturingRecord[]; highlightRows?: ManufacturingRecord[] }) {
  const configured = resolvedTabularColumns(visual);
  const columns = useMemo<ColumnDef<ManufacturingRecord>[]>(() => configured.map((column) => ({
    id: String(column.field),
    accessorKey: column.field,
    header: column.label?.trim() || String(column.field).replace(/([a-z])([A-Z])/g, "$1 $2"),
    cell: ({ getValue }) => formatTabularValue(getValue(), column),
  })), [configured]);
  const rowLimit = Math.max(1, Math.min(500, visual.tabular?.rowLimit ?? 100));
  const tableRows = useMemo(() => rows.slice(0, rowLimit), [rowLimit, rows]);
  const maximums = useMemo(() => fieldMaximums(tableRows, configured), [configured, tableRows]);
  // TanStack Table intentionally owns a stateful function graph, so React Compiler must not memoize this hook result.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: tableRows, columns, getCoreRowModel: getCoreRowModel() });
  const highlightedIds = useMemo(() => new Set(highlightRows?.map((row) => row.id) ?? []), [highlightRows]);
  return <div className="data-table-wrap" data-column-count={configured.length} data-row-limit={rowLimit}><table className={tableClass(visual)}>
    <thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => { const authored = configured.find((column) => String(column.field) === header.column.id)!; return <th style={columnStyle(authored)} data-field={authored.field} key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>; })}</tr>)}</thead>
    <tbody>{table.getRowModel().rows.map((row) => <tr className={highlightRows ? highlightedIds.has(row.original.id) ? "interaction-highlighted-row" : "interaction-dimmed-row" : undefined} key={row.id}>{row.getVisibleCells().map((cell) => { const column = configured.find((item) => String(item.field) === cell.column.id)!; return <ConditionalCell visual={visual} column={column} value={cell.getValue()} maximum={maximums.get(column.field) ?? 0} key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</ConditionalCell>; })}</tr>)}</tbody>
  </table></div>;
}

export function ProductionMatrix({ visual, rows, highlightRows }: { visual: VisualDefinition; rows: ManufacturingRecord[]; highlightRows?: ManufacturingRecord[] }) {
  const rowFields = resolvedMatrixRows(visual);
  const valueColumns = resolvedTabularColumns(visual);
  const matrix = useMemo(() => {
    const groups = new Map<string, ManufacturingRecord[]>();
    rows.forEach((row) => {
      const key = rowFields.map((field) => String(row[field] ?? "Blank")).join("|");
      groups.set(key, [...(groups.get(key) ?? []), row]);
    });
    return [...groups.entries()].map(([key, groupedRows]) => ({
      key,
      labels: rowFields.map((field) => String(groupedRows[0]?.[field] ?? "Blank")),
      values: valueColumns.map((column) => aggregateRows(groupedRows, column.field, column.aggregation ?? "sum")),
    }));
  }, [rowFields, rows, valueColumns]);
  const highlightedGroups = useMemo(() => new Set(highlightRows?.map((row) => rowFields.map((field) => String(row[field] ?? "Blank")).join("|")) ?? []), [highlightRows, rowFields]);
  const totals = valueColumns.map((column) => aggregateRows(rows, column.field, column.aggregation ?? "sum"));
  const maximums = valueColumns.map((_, index) => Math.max(...matrix.map((row) => Math.abs(row.values[index] ?? 0)), Math.abs(totals[index] ?? 0), 0));
  return <div className="data-table-wrap" data-matrix-row-fields={rowFields.join(",")} data-column-count={valueColumns.length}><table className={tableClass(visual)}><thead><tr>{rowFields.map((field) => <th key={field}>{String(field).replace(/([a-z])([A-Z])/g, "$1 $2")}</th>)}{valueColumns.map((column) => <th style={columnStyle(column)} data-field={column.field} key={column.field}>{column.label?.trim() || String(column.field).replace(/([a-z])([A-Z])/g, "$1 $2")}</th>)}</tr></thead><tbody>
    {matrix.map((row) => <tr className={highlightRows ? highlightedGroups.has(row.key) ? "interaction-highlighted-row" : "interaction-dimmed-row" : undefined} key={row.key}>{row.labels.map((label, index) => <td key={`${row.key}-${rowFields[index]}`}>{label}</td>)}{valueColumns.map((column, index) => <ConditionalCell visual={visual} column={column} value={row.values[index]} maximum={maximums[index] ?? 0} key={`${row.key}-${column.field}`}>{formatTabularValue(row.values[index], column)}</ConditionalCell>)}</tr>)}
    {visual.tabular?.showTotals !== false && <tr className="matrix-total"><td colSpan={rowFields.length}>Total</td>{valueColumns.map((column, index) => <ConditionalCell visual={visual} column={column} value={totals[index]} maximum={maximums[index] ?? 0} key={`total-${column.field}`}>{formatTabularValue(totals[index], column)}</ConditionalCell>)}</tr>}
  </tbody></table></div>;
}
