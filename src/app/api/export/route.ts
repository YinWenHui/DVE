import * as XLSX from "@e965/xlsx";
import { authorizeApi, isAuthorizationError } from "@/lib/auth/server";
import { config } from "@/lib/config";
import { executeInMemoryQuery } from "@/lib/query-engine/engine";
import { queryRequestSchema } from "@/lib/query-engine/schema";
import { repositories } from "@/repositories";

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function POST(request: Request) {
  const auth = await authorizeApi("exports:create"); if (isAuthorizationError(auth)) return auth;
  const format = new URL(request.url).searchParams.get("format");
  if (format !== "csv" && format !== "xlsx") return Response.json({ error: { code: "INVALID_FORMAT", message: "Supported export formats are csv and xlsx." } }, { status: 400 });
  const parsed = queryRequestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: { code: "INVALID_QUERY", message: "Export query is invalid.", details: parsed.error.flatten() } }, { status: 400 });
  const dataset = await repositories.datasets.findById(parsed.data.datasetId, auth);
  if (!dataset) return Response.json({ error: { code: "DATASET_NOT_FOUND", message: "Dataset not found or access is denied." } }, { status: 404 });
  const source = await repositories.datasets.rows(dataset.id, auth);
  let rows;
  try { rows = executeInMemoryQuery(dataset, source, { ...parsed.data, limit: Math.min(parsed.data.limit, config.DVE_MAX_EXPORT_ROWS) }); }
  catch (error) { return Response.json({ error: { code: "EXPORT_REJECTED", message: error instanceof Error ? error.message : "Export failed." } }, { status: 400 }); }
  const headers = rows.length ? Object.keys(rows[0]) : dataset.fields.filter((field) => !field.hidden).map((field) => field.key);
  if (format === "csv") {
    const csv = [headers.map(csvCell).join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\r\n");
    return new Response(`\uFEFF${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${dataset.slug}.csv"`, "Cache-Control": "no-store" } });
  }
  const displayHeaders = headers.map((header) => dataset.fields.find((field) => field.key === header)?.displayName ?? header);
  const worksheet = XLSX.utils.aoa_to_sheet([displayHeaders, ...rows.map((row) => headers.map((header) => row[header]))]);
  worksheet["!autofilter"] = { ref: worksheet["!ref"] ?? "A1:A1" };
  worksheet["!cols"] = headers.map(() => ({ wch: 18 }));
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, "Filtered data");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true });
  return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${dataset.slug}.xlsx"`, "Cache-Control": "no-store" } });
}
