"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FileSpreadsheet, UploadCloud } from "lucide-react";
import type { Aggregation, DataType, DatasetField, SemanticType } from "@/types";

interface PreviewResponse {
  uploadId: string; fileName: string; rowCount: number; sheets: string[]; encoding: string;
  fields: Array<Omit<DatasetField, "id">>; preview: Record<string, unknown>[];
}

export function DatasetWizard() {
  const router = useRouter(); const [step, setStep] = useState(1); const [file, setFile] = useState<File>(); const [preview, setPreview] = useState<PreviewResponse>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string>(); const [sheet, setSheet] = useState(""); const [delimiter, setDelimiter] = useState(""); const [headerRow, setHeaderRow] = useState(1);
  const [name, setName] = useState(""); const [slug, setSlug] = useState(""); const [description, setDescription] = useState(""); const [retention, setRetention] = useState("permanent");

  async function upload(selectedFile = file, selectedSheet = sheet) {
    if (!selectedFile) return; setBusy(true); setError(undefined); const form = new FormData(); form.set("file", selectedFile); form.set("headerRow", String(headerRow));
    if (selectedSheet) form.set("sheet", selectedSheet); if (delimiter) form.set("delimiter", delimiter);
    const response = await fetch("/api/datasets/upload", { method: "POST", body: form }); const payload = await response.json() as PreviewResponse & { error?: { message?: string } };
    if (!response.ok) { setError(payload.error?.message ?? "Upload failed."); setBusy(false); return; }
    setPreview(payload); setName(selectedFile.name.replace(/\.(csv|xlsx)$/i, "").replaceAll(/[_-]+/g, " ")); setSlug(selectedFile.name.replace(/\.(csv|xlsx)$/i, "").toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "")); setStep(2); setBusy(false);
  }

  function updateField(index: number, changes: Partial<Omit<DatasetField, "id">>) { setPreview((current) => current ? { ...current, fields: current.fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...changes } : field) } : current); }

  async function save() {
    if (!preview) return; setBusy(true); setError(undefined);
    const retentionPolicy = retention === "permanent" ? { mode: "permanent" } : { mode: "days", days: Number(retention) };
    const response = await fetch("/api/datasets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug, description, uploadId: preview.uploadId, fields: preview.fields, retention: retentionPolicy, refreshIntervalMinutes: 5 }) });
    const payload = await response.json() as { dataset?: { id: string }; error?: { message?: string } };
    if (!response.ok || !payload.dataset) { setError(payload.error?.message ?? "Dataset could not be saved."); setBusy(false); return; }
    setStep(4); window.setTimeout(() => router.push(`/admin/datasets/${payload.dataset?.id}`), 700);
  }

  return <>
    <div className="wizard-steps">{["Source", "Preview", "Semantic model", "Complete"].map((label, index) => <div className={`wizard-step ${step >= index + 1 ? "active" : ""}`} key={label}><span>{step > index + 1 ? <Check size={13} /> : index + 1}</span>{label}</div>)}</div>
    {step === 1 && <section className="panel"><div className="panel-header"><div><h2>Upload Excel or CSV</h2><p>Files are validated and previewed before semantic metadata is saved.</p></div><FileSpreadsheet /></div><div className="dropzone"><div><UploadCloud size={32} /><h3>Choose a local data file</h3><p>.xlsx or .csv, up to the configured upload limit</p><input type="file" accept=".xlsx,.csv" onChange={(event) => { const selected = event.target.files?.[0]; setFile(selected); if (selected) upload(selected); }} /></div></div><div className="form-grid" style={{ marginTop: 15 }}><label>Header row<input type="number" min={1} value={headerRow} onChange={(event) => setHeaderRow(Number(event.target.value))} /></label><label>CSV delimiter (optional)<select value={delimiter} onChange={(event) => setDelimiter(event.target.value)}><option value="">Auto detect</option><option value=",">Comma</option><option value=";">Semicolon</option><option value="\t">Tab</option><option value="|">Pipe</option></select></label></div></section>}
    {step === 2 && preview && <><section className="panel"><div className="panel-header"><div><h2>Validate detected structure</h2><p>{preview.fileName} · {preview.rowCount.toLocaleString()} rows · {preview.encoding}</p></div>{preview.sheets.length > 0 && <select value={sheet || preview.sheets[0]} onChange={(event) => { setSheet(event.target.value); upload(file, event.target.value); }}>{preview.sheets.map((item) => <option key={item}>{item}</option>)}</select>}</div><div className="data-table-wrap"><table className="admin-table"><thead><tr>{preview.fields.slice(0, 10).map((field) => <th key={field.key}>{field.displayName}</th>)}</tr></thead><tbody>{preview.preview.slice(0, 10).map((row, rowIndex) => <tr key={rowIndex}>{preview.fields.slice(0, 10).map((field) => <td key={field.key}>{String(row[field.key] ?? "")}</td>)}</tr>)}</tbody></table></div></section><div className="table-actions"><button className="button" onClick={() => setStep(1)}>Back</button><button className="button primary" onClick={() => setStep(3)}>Define semantic fields</button></div></>}
    {step === 3 && preview && <><section className="panel"><div className="panel-header"><div><h2>Dataset identity</h2><p>Display names are separated from safe internal field keys.</p></div></div><div className="form-grid"><label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Slug<input value={slug} onChange={(event) => setSlug(event.target.value)} /></label><label className="full">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label><label>Retention<select value={retention} onChange={(event) => setRetention(event.target.value)}><option value="permanent">Permanent</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">One year</option></select></label></div></section><section className="panel"><div className="panel-header"><div><h2>Field metadata</h2><p>Review detected types and default aggregation behavior.</p></div></div><div className="field-editor">{preview.fields.map((field, index) => <div className="field-row" key={`${field.key}-${index}`}><input aria-label="Source name" value={field.sourceName} disabled /><input aria-label="Display name" value={field.displayName} onChange={(event) => updateField(index, { displayName: event.target.value })} /><select aria-label="Data type" value={field.dataType} onChange={(event) => updateField(index, { dataType: event.target.value as DataType })}>{["string", "integer", "decimal", "boolean", "date", "datetime"].map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Semantic type" value={field.semanticType} onChange={(event) => updateField(index, { semanticType: event.target.value as SemanticType })}>{["dimension", "measure", "date", "identifier", "geographic"].map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Aggregation" value={field.defaultAggregation} onChange={(event) => updateField(index, { defaultAggregation: event.target.value as Aggregation })}>{["none", "sum", "average", "minimum", "maximum", "count", "distinctCount"].map((value) => <option key={value}>{value}</option>)}</select><label><input type="checkbox" checked={!field.hidden} onChange={(event) => updateField(index, { hidden: !event.target.checked })} /> Show</label></div>)}</div></section><div className="table-actions"><button className="button" onClick={() => setStep(2)}>Back</button><button className="button primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Import dataset"}</button></div></>}
    {step === 4 && <section className="panel empty-state"><div><Check size={36} /><h2>Dataset imported</h2><p>The new validated version is active and ready for report authoring.</p></div></section>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </>;
}
