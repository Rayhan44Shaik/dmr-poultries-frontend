import { useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Loader2, Search, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";
import MasterDialog from "../../../../masters/components/MasterDialog";
import { collectionService } from "../../services/collectionService";
import {
  canonicalValue, importTotals, parseDisplayDate, validateCollectionImportRow,
  type CollectionImportDraft, type CollectionImportField,
} from "../../utils/collectionImport";

type Props = {
  open: boolean;
  onClose: () => void;
  shops: string[];
  collectors: string[];
  modes: string[];
  existingReferences: string[];
  onImported: () => Promise<unknown> | void;
};

type Step = 1 | 2 | 3;
const columns: Array<{ field: CollectionImportField; label: string }> = [
  { field: "serialNo", label: "S.No" }, { field: "date", label: "Date" },
  { field: "shopName", label: "Shop Name" }, { field: "collector", label: "Collector" },
  { field: "mode", label: "Mode" }, { field: "amount", label: "Amount" },
  { field: "remark", label: "Remark" }, { field: "referenceNo", label: "Reference Number" },
];
const headerAliases: Record<CollectionImportField, string[]> = {
  serialNo: ["s.no", "s no", "sno", "serial no"], date: ["date", "collection date"],
  shopName: ["shop name", "shop"], collector: ["collector", "collector name"],
  mode: ["mode", "payment mode", "bank"], amount: ["amount", "collection amount"],
  remark: ["remark", "remarks"], referenceNo: ["reference number", "reference no", "ref no"],
};
const normal = (v: unknown) => String(v ?? "").trim().toLocaleLowerCase("en-IN").replace(/\s+/g, " ");
const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);

function ImportSummary({ total }: { total: ReturnType<typeof importTotals> }) {
  return <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3"><div className="text-[11px] font-bold uppercase text-emerald-700">Transactions</div><div className="text-xl font-black text-emerald-950">{total.count}</div></div>
    <div className="rounded-xl border border-sky-100 bg-sky-50 p-3"><div className="text-[11px] font-bold uppercase text-sky-700">Cumulative amount</div><div className="text-xl font-black text-sky-950">{money(total.amount)}</div></div>
    {total.byMode.slice(0, 2).map((mode) => <div key={mode.mode} className="rounded-xl border border-slate-200 bg-white p-3"><div className="truncate text-[11px] font-bold uppercase text-slate-500">{mode.mode} · {mode.count}</div><div className="text-lg font-black text-slate-800">{money(mode.amount)}</div></div>)}
  </div>;
}

export default function CollectionImportModal({ open, onClose, shops, collectors, modes, existingReferences, onImported }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [rows, setRows] = useState<CollectionImportDraft[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [issuesOnly, setIssuesOnly] = useState(true);
  const [sortField, setSortField] = useState<CollectionImportField | null>(null);
  const [importing, setImporting] = useState(false);
  const [importedRows, setImportedRows] = useState<CollectionImportDraft[]>([]);
  const [batchId, setBatchId] = useState(() => crypto.randomUUID());
  const fileRef = useRef<HTMLInputElement>(null);
  const duplicateReferences = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => { const value = normal(row.referenceNo); if (value) counts.set(value, (counts.get(value) ?? 0) + 1); });
    return new Set([...counts].filter(([, count]) => count > 1).map(([value]) => value));
  }, [rows]);
  const masters = useMemo(() => ({ shops, collectors, modes, existingReferences, duplicateReferences }), [shops, collectors, modes, existingReferences, duplicateReferences]);
  const rowIssues = useMemo(() => new Map(rows.map((row) => [row.id, validateCollectionImportRow(row, masters)])), [rows, masters]);
  const validRows = useMemo(() => rows.filter((row) => !(rowIssues.get(row.id)?.length)), [rows, rowIssues]);
  const invalidCount = rows.length - validRows.length;
  const validTotals = useMemo(() => importTotals(validRows), [validRows]);
  const finalTotals = useMemo(() => importTotals(importedRows), [importedRows]);
  const visibleRows = useMemo(() => {
    const q = normal(query);
    const result = rows.filter((row) => (!issuesOnly || (rowIssues.get(row.id)?.length ?? 0) > 0) &&
      (!q || columns.some(({ field }) => normal(row[field]).includes(q))));
    if (sortField) result.sort((a, b) => normal(a[sortField]).localeCompare(normal(b[sortField]), "en", { numeric: true }));
    return result;
  }, [rows, rowIssues, issuesOnly, query, sortField]);

  const reset = () => { setStep(1); setRows([]); setFileName(""); setError(""); setQuery(""); setIssuesOnly(true); setSortField(null); setImportedRows([]); setBatchId(crypto.randomUUID()); if (fileRef.current) fileRef.current.value = ""; };
  const close = () => { if (importing) return; reset(); onClose(); };

  const downloadTemplate = () => {
    const sheet = XLSX.utils.json_to_sheet([{ "S.No": 1, Date: "12-10-2026", "Shop Name": shops[0] ?? "Sample Shop", Collector: collectors[0] ?? "Sample Collector", Mode: modes[0] ?? "Cash", Amount: 12500, Remark: "Weekly collection", "Reference Number": "REF-001" }]);
    sheet["!cols"] = [{ wch: 8 }, { wch: 14 }, { wch: 28 }, { wch: 24 }, { wch: 22 }, { wch: 15 }, { wch: 30 }, { wch: 22 }];
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Collection Import"); XLSX.writeFile(book, "Collection_Entry_Import_Template.xlsx");
  };

  const loadFile = async (file?: File) => {
    if (!file) return;
    setError("");
    if (!/\.xlsx?$/i.test(file.name)) { setError("Only Excel .xlsx or .xls files are supported."); return; }
    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const sheet = book.Sheets[book.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false, dateNF: "dd-mm-yyyy" });
      if (!data.length) throw new Error("The first worksheet has no data rows.");
      const sourceHeaders = Object.keys(data[0]).reduce<Record<string, string>>((acc, header) => { acc[normal(header)] = header; return acc; }, {});
      const resolved = Object.fromEntries(columns.map(({ field, label }) => {
        const alias = [label, ...headerAliases[field]].map(normal).find((candidate) => sourceHeaders[candidate]);
        return [field, alias ? sourceHeaders[alias] : ""];
      })) as Record<CollectionImportField, string>;
      const required: CollectionImportField[] = ["serialNo", "date", "shopName", "collector", "mode", "amount"];
      const missing = required.filter((field) => !resolved[field]);
      if (missing.length) throw new Error(`Missing required columns: ${missing.map((f) => columns.find((c) => c.field === f)?.label).join(", ")}.`);
      const parsed = data.map((record, index): CollectionImportDraft => ({
        id: `${index + 2}-${crypto.randomUUID()}`, sourceRow: index + 2,
        serialNo: String(record[resolved.serialNo] ?? ""), date: String(record[resolved.date] ?? ""),
        shopName: String(record[resolved.shopName] ?? ""), collector: String(record[resolved.collector] ?? ""),
        mode: String(record[resolved.mode] ?? ""), amount: String(record[resolved.amount] ?? ""),
        remark: resolved.remark ? String(record[resolved.remark] ?? "") : "",
        referenceNo: resolved.referenceNo ? String(record[resolved.referenceNo] ?? "") : "",
      }));
      setRows(parsed); setFileName(file.name); setStep(2); setIssuesOnly(parsed.some((row) => validateCollectionImportRow(row, masters).length > 0));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not read this Excel file."); }
  };

  const update = (id: string, field: CollectionImportField, value: string) => setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
  const doImport = async () => {
    if (!validRows.length || importing) return;
    setImporting(true); setError("");
    try {
      const canonical = validRows.map((row) => ({ sourceRow: row.sourceRow, collectionDate: parseDisplayDate(row.date)!, shopName: canonicalValue(row.shopName, shops)!, collector: canonicalValue(row.collector, collectors)!, paymentMode: canonicalValue(row.mode, modes)!, amount: Number(row.amount.replace(/,/g, "")), remarks: row.remark.trim(), referenceNo: row.referenceNo.trim() }));
      await collectionService.importCollections(batchId, canonical);
      setImportedRows(validRows); setStep(3); await Promise.resolve(onImported());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Import failed. No rows were saved."); }
    finally { setImporting(false); }
  };

  if (!open) return null;

  return <MasterDialog label="Import Collection Entries" onClose={close} isSaving={importing} width="wide">
    <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
    <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600"><Upload size={20}/></div><div><h2 id="collection-import-title" className="text-lg font-bold text-slate-800">Import Collection Entries</h2><p className="text-xs text-slate-500">Excel review, correction and atomic backend import</p></div></div>
      <button type="button" onClick={close} disabled={importing} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40" aria-label="Close import"><X size={18}/></button>
    </header>
    <div className="flex shrink-0 items-center gap-1.5 px-6 pt-4 text-[11px] font-medium text-slate-500">{[1,2,3].map((n) => <div key={n} className="flex items-center gap-1.5"><span className={`inline-flex items-center gap-1 ${step === n ? "text-blue-700" : step > n ? "text-emerald-600" : "text-slate-400"}`}><span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${step === n ? "border-blue-600 bg-blue-600 text-white" : step > n ? "border-emerald-200 bg-emerald-100 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}`}>{step > n ? <CheckCircle2 size={12}/> : n}</span>{n === 1 ? "Upload" : n === 2 ? "Preview" : "Result"}</span>{n < 3 && <span className="h-px w-5 bg-slate-300"/>}</div>)}</div>
    <main className="min-h-0 flex-1 overflow-y-auto p-6">
      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
      {step === 1 && <div className="space-y-5">
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600"><Download size={18}/></div><div><p className="text-sm font-semibold text-slate-700">Step 1: Download the template</p><p className="text-xs text-slate-500">Use the sample with S.No, Date, Shop, Collector, Mode, Amount, Remark and Reference Number.</p></div></div><button type="button" onClick={downloadTemplate} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"><FileSpreadsheet size={16}/>Download Template</button></div>
        <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-white py-12 transition-colors hover:border-blue-400 hover:bg-slate-50"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600"><Upload size={22}/></div><p className="text-sm font-semibold text-slate-700">Step 2: Upload your Excel file</p><p className="text-xs text-slate-500">Click to browse · .xlsx or .xls only · dates use DD-MM-YYYY</p></button>
        <input ref={fileRef} type="file" className="hidden" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(e) => void loadFile(e.target.files?.[0])}/>{fileName && <p className="text-center text-sm text-slate-500">Selected: {fileName}</p>}
      </div>}
      {step === 2 && <div className="space-y-4"><ImportSummary total={validTotals}/><div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="relative min-w-[240px] flex-1"><Search size={15} className="absolute left-3 top-2.5 text-slate-400"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search uploaded rows…" className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-emerald-400"/></div><button onClick={() => setIssuesOnly((v) => !v)} className={`h-9 rounded-lg px-3 text-xs font-bold transition ${issuesOnly ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{issuesOnly ? `Showing ${invalidCount} highlighted rows` : `Show issues only (${invalidCount})`}</button><span className="text-xs font-semibold text-slate-500">{validRows.length} ready · {invalidCount} neglected</span></div>
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="min-w-[1180px] w-full text-left text-xs"><thead className="sticky top-0 z-10 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600"><tr>{columns.map((column) => <th key={column.field} className="cursor-pointer px-2 py-3" onClick={() => setSortField(column.field)}>{column.label}{sortField === column.field ? " ↑" : ""}</th>)}</tr></thead><tbody>{visibleRows.map((row) => { const issues = rowIssues.get(row.id) ?? []; return <tr key={row.id} className={issues.length ? "bg-amber-50/60" : "hover:bg-emerald-50/40"}>{columns.map(({ field }) => { const issue = issues.find((item) => item.field === field); return <td key={field} className="border-t border-slate-100 p-1.5"><input value={row[field]} onChange={(e) => update(row.id, field, e.target.value)} title={issue?.message} className={`h-9 w-full min-w-[90px] rounded-lg border px-2 outline-none transition focus:ring-2 ${issue ? "border-rose-400 bg-rose-50 text-rose-900 focus:ring-rose-100" : "border-transparent bg-transparent focus:border-emerald-400 focus:bg-white focus:ring-emerald-100"}`}/>{issue && <div className="mt-1 max-w-[180px] text-[10px] font-semibold text-rose-600">{issue.message}</div>}</td>})}</tr>})}</tbody></table>{!visibleRows.length && <div className="p-10 text-center text-sm text-slate-500">No rows match this view.</div>}</div>
        <div className="flex flex-wrap gap-2">{validTotals.byMode.map((item) => <span key={item.mode} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">{item.mode}: {item.count} · {money(item.amount)}</span>)}</div>
      </div>}
      {step === 3 && <div className="mx-auto max-w-6xl space-y-5"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center"><CheckCircle2 size={42} className="mx-auto mb-3 text-emerald-600"/><h3 className="text-xl font-black text-emerald-950">{importedRows.length} transactions imported</h3><p className="mt-1 text-sm text-emerald-700">Collection numbers were generated by the backend in date sequence. No invalid row was imported.</p></div><ImportSummary total={finalTotals}/><div className="overflow-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-[1000px] w-full text-xs"><thead className="bg-slate-100 text-left uppercase text-slate-600"><tr>{columns.map((c) => <th key={c.field} className="px-3 py-3">{c.label}</th>)}</tr></thead><tbody>{importedRows.map((row) => <tr key={row.id} className="border-t border-slate-100">{columns.map((c) => <td key={c.field} className="px-3 py-2">{row[c.field]}</td>)}</tr>)}</tbody></table></div></div>}
    </main>
    <footer className="flex shrink-0 items-center justify-between border-t border-slate-200 px-6 py-4"><button type="button" onClick={close} disabled={importing} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40">{step === 3 ? "Close" : "Cancel"}</button><div className="flex gap-2">{step === 2 && <><button onClick={() => setStep(1)} className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"><ArrowLeft size={16}/> Choose another file</button><button onClick={() => void doImport()} disabled={!validRows.length || importing} className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{importing ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>} Import {validRows.length} transactions</button></>}{step === 3 && <button onClick={close} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">Done</button>}</div></footer>
    </div>
  </MasterDialog>;
}
