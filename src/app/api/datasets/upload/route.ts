import { randomUUID } from "node:crypto";
import * as XLSX from "@e965/xlsx";
import Papa from "papaparse";
import { authorizeApi, isAuthorizationError } from "@/lib/auth/server";
import { config } from "@/lib/config";
import { getMockStore } from "@/lib/mock-store";
import type { DataType, DatasetField, SemanticType } from "@/types";

function fieldKey(name: string, used: Set<string>): string {
  let key = name.normalize("NFKD").replaceAll(/[^A-Za-z0-9]+/g, "_").replaceAll(/^_+|_+$/g, "") || "Field";
  if (!/^[A-Za-z]/.test(key)) key = `Field_${key}`;
  const base = key; let suffix = 2;
  while (used.has(key)) { key = `${base}_${suffix}`; suffix += 1; }
  used.add(key); return key;
}

function inferType(values: unknown[]): DataType {
  const present = values.filter((value) => value !== null && value !== undefined && value !== "").slice(0, 100);
  if (!present.length) return "string";
  if (present.every((value) => typeof value === "boolean" || /^(true|false)$/i.test(String(value)))) return "boolean";
  if (present.every((value) => Number.isInteger(typeof value === "number" ? value : Number(value)))) return "integer";
  if (present.every((value) => Number.isFinite(typeof value === "number" ? value : Number(value)))) return "decimal";
  if (present.every((value) => value instanceof Date || /^\d{4}-\d{2}-\d{2}$/.test(String(value)))) return "date";
  if (present.every((value) => value instanceof Date || !Number.isNaN(Date.parse(String(value))))) return "datetime";
  return "string";
}

function normalizeCell(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    return String(value);
  }
  return value ?? null;
}

function buildRecords(rawRows: unknown[][], headerIndex: number) {
  const headers = rawRows[headerIndex]?.map((value, index) => String(value ?? "").trim() || `Column ${index + 1}`) ?? [];
  const used = new Set<string>(); const keys = headers.map((header) => fieldKey(header, used));
  const records = rawRows.slice(headerIndex + 1).filter((row) => row.some((value) => value !== null && value !== undefined && value !== "")).map((row) => Object.fromEntries(keys.map((key, index) => [key, row[index] ?? null])));
  const fields: Omit<DatasetField, "id">[] = keys.map((key, ordinal) => {
    const dataType = inferType(records.map((row) => row[key]));
    const semanticType: SemanticType = dataType === "date" || dataType === "datetime" ? "date" : dataType === "integer" || dataType === "decimal" ? "measure" : "dimension";
    return { sourceName: headers[ordinal], key, displayName: headers[ordinal], dataType, semanticType, defaultAggregation: semanticType === "measure" ? "sum" : "none", hidden: false, filterable: true, sortable: true, ordinal };
  });
  return { fields, records };
}

export async function POST(request: Request) {
  const auth = await authorizeApi("admin:manage"); if (isAuthorizationError(auth)) return auth;
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: { code: "FILE_REQUIRED", message: "Choose a CSV or XLSX file." } }, { status: 400 });
  if (file.size > config.DVE_MAX_UPLOAD_MB * 1_048_576) return Response.json({ error: { code: "FILE_TOO_LARGE", message: `Files are limited to ${config.DVE_MAX_UPLOAD_MB} MB.` } }, { status: 413 });
  const extension = file.name.split(".").pop()?.toLocaleLowerCase();
  if (extension !== "csv" && extension !== "xlsx") return Response.json({ error: { code: "UNSUPPORTED_FILE", message: "Only .csv and .xlsx files are supported." } }, { status: 415 });
  const headerRow = Math.max(0, Number(form.get("headerRow") ?? 1) - 1); let rawRows: unknown[][] = []; let sheets: string[] = []; let encoding = "utf-8";
  if (extension === "xlsx") {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true }); sheets = workbook.SheetNames;
    const selected = String(form.get("sheet") ?? ""); const worksheet = workbook.Sheets[selected] ?? workbook.Sheets[workbook.SheetNames[0]];
    if (!worksheet) return Response.json({ error: { code: "EMPTY_WORKBOOK", message: "The workbook has no worksheets." } }, { status: 400 });
    rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: true, defval: null }).map((row) => row.map(normalizeCell));
  } else {
    const bytes = await file.arrayBuffer(); let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { text = new TextDecoder("windows-1252").decode(bytes); encoding = "windows-1252"; }
    const delimiter = String(form.get("delimiter") ?? ""); const parsed = Papa.parse<string[]>(text, { delimiter: delimiter || "", skipEmptyLines: "greedy" });
    if (parsed.errors.some((error) => error.code === "UndetectableDelimiter" && !delimiter)) return Response.json({ error: { code: "DELIMITER_REQUIRED", message: "Delimiter could not be detected. Select one explicitly." } }, { status: 400 });
    rawRows = parsed.data;
  }
  const { fields, records } = buildRecords(rawRows, headerRow);
  if (!fields.length || !records.length) return Response.json({ error: { code: "EMPTY_FILE", message: "No data rows were found below the selected header row." } }, { status: 400 });
  const uploadId = randomUUID(); getMockStore().pendingImports.set(uploadId, { fileName: file.name, sourceType: extension === "xlsx" ? "excel" : "csv", rows: records });
  return Response.json({ uploadId, fileName: file.name, rowCount: records.length, sheets, encoding, fields, preview: records.slice(0, 25) });
}
