import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Loader2, Search, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";
import MasterDialog from "../../../../masters/components/MasterDialog";
import { collectionService } from "../../services/collectionService";
import {
  canonicalValue, collectionImportCellText, importTotals, parseDisplayDate, validateCollectionImportRow,
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
type RowView = "notReady" | "ready";
type ImportMasters = { shops: string[]; collectors: string[]; modes: string[]; existingReferences: string[] };
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

function ImportSummary({ total, selectedKey = null, onSelect }: { total: ReturnType<typeof importTotals>; selectedKey?: string | null; onSelect?: (key: string) => void }) {
  return <div className="grid auto-rows-fr grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-6">
    <button type="button" disabled={!onSelect} onClick={() => onSelect?.("__all__")} aria-pressed={selectedKey === "__all__"} className={`group rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-left transition duration-200 enabled:hover:-translate-y-0.5 enabled:hover:shadow-sm ${selectedKey === "__all__" ? "ring-2 ring-emerald-300 ring-offset-2" : ""}`}><div className="text-[11px] font-bold uppercase text-emerald-700">Uploaded transactions</div><div className="text-xl font-black tabular-nums text-emerald-950">{total.count}</div>{onSelect && <div className="mt-1 text-[10px] font-bold text-emerald-600">{selectedKey === "__all__" ? "Hide details" : "View all"}</div>}</button>
    <button type="button" disabled={!onSelect} onClick={() => onSelect?.("__all__")} aria-pressed={selectedKey === "__all__"} className={`group rounded-xl border border-sky-100 bg-sky-50 p-3 text-left transition duration-200 enabled:hover:-translate-y-0.5 enabled:hover:shadow-sm ${selectedKey === "__all__" ? "ring-2 ring-sky-300 ring-offset-2" : ""}`}><div className="text-[11px] font-bold uppercase text-sky-700">Uploaded amount</div><div className="text-xl font-black tabular-nums text-sky-950">{money(total.amount)}</div>{onSelect && <div className="mt-1 text-[10px] font-bold text-sky-600">{selectedKey === "__all__" ? "Hide details" : "View all"}</div>}</button>
    {total.byMode.map((mode, index) => <button type="button" disabled={!onSelect} onClick={() => onSelect?.(mode.mode)} aria-pressed={selectedKey === mode.mode} key={mode.mode} className={`group rounded-xl border p-3 text-left transition duration-200 enabled:hover:-translate-y-0.5 enabled:hover:shadow-sm ${index % 3 === 0 ? "border-violet-100 bg-violet-50" : index % 3 === 1 ? "border-amber-100 bg-amber-50" : "border-cyan-100 bg-cyan-50"} ${selectedKey === mode.mode ? "ring-2 ring-violet-300 ring-offset-2" : ""}`}><div className="truncate text-[11px] font-bold uppercase text-slate-600" title={mode.mode}>{mode.mode || "Unspecified"} · {mode.count}</div><div className="text-lg font-black tabular-nums text-slate-800">{money(mode.amount)}</div>{onSelect && <div className="mt-1 text-[10px] font-bold text-slate-500">{selectedKey === mode.mode ? "Hide details" : `View ${mode.mode}`}</div>}</button>)}
  </div>;
}

export default function CollectionImportModal({ open, onClose, shops, collectors, modes, existingReferences, onImported }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [rows, setRows] = useState<CollectionImportDraft[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [rowView, setRowView] = useState<RowView>("notReady");
  const [sortField, setSortField] = useState<CollectionImportField | null>(null);
  const [importing, setImporting] = useState(false);
  const [importedRows, setImportedRows] = useState<CollectionImportDraft[]>([]);
  const [resultFilter, setResultFilter] = useState<string | null>(null);
  const [serverIssues, setServerIssues] = useState<Map<number, Set<string>>>(new Map());
  const [liveMasters, setLiveMasters] = useState<ImportMasters>({ shops, collectors, modes, existingReferences });
  const [batchId, setBatchId] = useState(() => crypto.randomUUID());
  const fileRef = useRef<HTMLInputElement>(null);
  const previewTopScrollRef = useRef<HTMLDivElement>(null);
  const previewTableScrollRef = useRef<HTMLDivElement>(null);
  const previewTableRef = useRef<HTMLTableElement>(null);
  const [previewScrollWidth, setPreviewScrollWidth] = useState(1180);
  const duplicateReferences = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => { const value = normal(row.referenceNo); if (value) counts.set(value, (counts.get(value) ?? 0) + 1); });
    return new Set([...counts].filter(([, count]) => count > 1).map(([value]) => value));
  }, [rows]);
  const masters = useMemo(() => ({ ...liveMasters, duplicateReferences }), [liveMasters, duplicateReferences]);
  const rowIssues = useMemo(() => new Map(rows.map((row) => {
    const issues = validateCollectionImportRow(row, masters);
    const staleFields = serverIssues.get(row.sourceRow);
    if (staleFields) {
      const fieldMap: Partial<Record<string, CollectionImportField>> = { shopName: "shopName", collector: "collector", paymentMode: "mode", referenceNo: "referenceNo", collectionDate: "date" };
      staleFields.forEach((serverField) => {
        const field = fieldMap[serverField];
        if (field && !issues.some((issue) => issue.field === field)) issues.push({ field, message: "This value changed in master data. Select or enter the current active value." });
      });
    }
    return [row.id, issues];
  })), [rows, masters, serverIssues]);
  const validRows = useMemo(() => rows.filter((row) => !(rowIssues.get(row.id)?.length)), [rows, rowIssues]);
  const invalidCount = rows.length - validRows.length;
  const uploadedTotals = useMemo(() => importTotals(rows), [rows]);
  const validTotals = useMemo(() => importTotals(validRows), [validRows]);
  const finalTotals = useMemo(() => importTotals(importedRows), [importedRows]);
  const resultRows = useMemo(() => resultFilter === "__all__" ? importedRows : resultFilter ? importedRows.filter((row) => normal(row.mode) === normal(resultFilter)) : [], [importedRows, resultFilter]);
  const visibleRows = useMemo(() => {
    const q = normal(query);
    const result = rows.filter((row) => ((rowIssues.get(row.id)?.length ?? 0) > 0) === (rowView === "notReady") &&
      (!q || columns.some(({ field }) => normal(row[field]).includes(q))));
    if (sortField) result.sort((a, b) => normal(a[sortField]).localeCompare(normal(b[sortField]), "en", { numeric: true }));
    return result;
  }, [rows, rowIssues, rowView, query, sortField]);

  useEffect(() => {
    if (step !== 2) return;
    const table = previewTableRef.current;
    if (!table) return;
    const measure = () => setPreviewScrollWidth(Math.max(table.scrollWidth, 1180));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(table);
    return () => observer.disconnect();
  }, [step, visibleRows.length]);

  const syncPreviewScroll = (source: "top" | "table") => {
    const top = previewTopScrollRef.current;
    const table = previewTableScrollRef.current;
    if (!top || !table) return;
    if (source === "top") table.scrollLeft = top.scrollLeft;
    else top.scrollLeft = table.scrollLeft;
  };

  const reset = () => { setStep(1); setRows([]); setFileName(""); setError(""); setQuery(""); setRowView("notReady"); setSortField(null); setImportedRows([]); setResultFilter(null); setServerIssues(new Map()); setBatchId(crypto.randomUUID()); if (fileRef.current) fileRef.current.value = ""; };
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
      const currentMasters = await collectionService.fetchCollectionImportMasters();
      setLiveMasters(currentMasters);
      const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = book.Sheets[book.SheetNames[0]];
      // `raw: true` preserves typed Excel dates as Date objects. Formatting
      // through cell.w/raw:false would turn Remark dates into locale-specific
      // values such as 10/26/2026 even when the workbook contains 26-10-2026.
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
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
        serialNo: collectionImportCellText(record[resolved.serialNo]), date: collectionImportCellText(record[resolved.date]),
        shopName: collectionImportCellText(record[resolved.shopName]), collector: collectionImportCellText(record[resolved.collector]),
        mode: collectionImportCellText(record[resolved.mode]), amount: collectionImportCellText(record[resolved.amount]),
        remark: resolved.remark ? collectionImportCellText(record[resolved.remark]) : "",
        referenceNo: resolved.referenceNo ? collectionImportCellText(record[resolved.referenceNo]) : "",
      }));
      const referenceCounts = new Map<string, number>();
      parsed.forEach((row) => { const value = normal(row.referenceNo); if (value) referenceCounts.set(value, (referenceCounts.get(value) ?? 0) + 1); });
      const currentValidation = { ...currentMasters, duplicateReferences: new Set([...referenceCounts].filter(([, count]) => count > 1).map(([value]) => value)) };
      setRows(parsed); setServerIssues(new Map()); setFileName(file.name); setStep(2); setRowView(parsed.some((row) => validateCollectionImportRow(row, currentValidation).length > 0) ? "notReady" : "ready");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not read this Excel file."); }
  };

  const update = (id: string, field: CollectionImportField, value: string) => {
    const sourceRow = rows.find((row) => row.id === id)?.sourceRow;
    setError("");
    setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
    if (sourceRow != null) setServerIssues((current) => {
      if (!current.has(sourceRow)) return current;
      const next = new Map(current);
      next.delete(sourceRow);
      return next;
    });
  };
  const doImport = async () => {
    if (!validRows.length || importing) return;
    setImporting(true); setError("");
    try {
      // Re-read the exact server-authoritative master set immediately before
      // import. A row cannot remain Ready if a Shop, Collector, Bank, or
      // reference changed after the spreadsheet was opened.
      const currentMasters = await collectionService.fetchCollectionImportMasters();
      setLiveMasters(currentMasters);
      const currentValidation = { ...currentMasters, duplicateReferences };
      const nowInvalid = validRows.filter((row) => validateCollectionImportRow(row, currentValidation).length > 0);
      if (nowInvalid.length) {
        setRowView("notReady");
        setError(`${nowInvalid.length} ${nowInvalid.length === 1 ? "row needs" : "rows need"} review. The active master list was refreshed; correct the highlighted value before importing.`);
        return;
      }
      const canonical = validRows.map((row) => ({ sourceRow: row.sourceRow, collectionDate: parseDisplayDate(row.date)!, shopName: canonicalValue(row.shopName, currentMasters.shops)!, collector: canonicalValue(row.collector, currentMasters.collectors)!, paymentMode: canonicalValue(row.mode, currentMasters.modes)!, amount: Number(row.amount.replace(/,/g, "")), remarks: row.remark.trim(), referenceNo: row.referenceNo.trim() }));
      const preflightIssues = await collectionService.validateCollectionImport(batchId, canonical);
      if (preflightIssues.length) {
        const next = new Map<number, Set<string>>();
        preflightIssues.forEach((issue) => next.set(issue.sourceRow, new Set(issue.fields)));
        setServerIssues(next);
        setRowView("notReady");
        setError(`${preflightIssues.length} ${preflightIssues.length === 1 ? "row needs" : "rows need"} review. Correct the highlighted value before importing.`);
        return;
      }
      await collectionService.importCollections(batchId, canonical);
      setImportedRows(validRows); setResultFilter(null); setStep(3); await Promise.resolve(onImported());
    } catch (cause) {
      const response = cause as { details?: { details?: { issues?: Array<{ sourceRow?: number; fields?: string[] }> } } };
      const stale = response.details?.details?.issues;
      if (Array.isArray(stale) && stale.length) {
        const next = new Map<number, Set<string>>();
        stale.forEach((issue) => {
          if (Number.isInteger(issue.sourceRow)) next.set(Number(issue.sourceRow), new Set(issue.fields ?? []));
        });
        setServerIssues(next);
        setRowView("notReady");
        setError(`${stale.length} ${stale.length === 1 ? "row needs" : "rows need"} review. It has been moved to Not ready; update the highlighted value and try again.`);
        await Promise.resolve(onImported());
      } else {
        const message = cause instanceof Error ? cause.message : "";
        if (message.includes("no longer match active master data")) {
          setRowView("notReady");
          setError("A Shop, Collector, or Bank value is no longer active. Review the Not ready rows and choose a current master value.");
          await Promise.resolve(onImported());
        } else {
          setError(message || "Import could not be completed. No rows were saved; review the highlighted rows and try again.");
        }
      }
    }
    finally { setImporting(false); }
  };

  if (!open) return null;

  return <MasterDialog label="Import Collection Entries" onClose={close} isSaving={importing} width="full">
    <div className="flex max-h-[calc(100vh-6rem)] w-full max-w-[96rem] flex-col rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
    <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
      <div className="flex items-center gap-3"><div className="group flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-blue-600 hover:text-white hover:shadow-md"><Upload size={20} className="transition-transform duration-300 group-hover:-translate-y-1"/></div><div><h2 id="collection-import-title" className="text-lg font-bold text-slate-800">Import Collection Entries</h2><p className="text-xs text-slate-500">Excel review, correction and atomic backend import</p></div></div>
      <button type="button" onClick={close} disabled={importing} className="group rounded-lg p-2 text-slate-400 transition-all duration-200 hover:rotate-90 hover:bg-rose-50 hover:text-rose-600 active:scale-90 disabled:opacity-40" aria-label="Close import"><X size={18} className="transition-transform duration-200 group-hover:scale-110"/></button>
    </header>
    <div className="flex shrink-0 items-center gap-1.5 px-6 pt-4 text-[11px] font-medium text-slate-500">{[1,2,3].map((n) => <div key={n} className="flex items-center gap-1.5"><span className={`inline-flex items-center gap-1 ${step === n ? "text-blue-700" : step > n ? "text-emerald-600" : "text-slate-400"}`}><span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${step === n ? "border-blue-600 bg-blue-600 text-white" : step > n ? "border-emerald-200 bg-emerald-100 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}`}>{step > n ? <CheckCircle2 size={12}/> : n}</span>{n === 1 ? "Upload" : n === 2 ? "Preview" : "Result"}</span>{n < 3 && <span className="h-px w-5 bg-slate-300"/>}</div>)}</div>
    <main className="min-h-0 flex-1 overflow-y-auto p-6">
      {error && <div className="mb-4 inline-flex max-w-3xl items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2.5 text-xs font-semibold leading-5 text-amber-900 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200" role="status"><span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[10px] font-black text-amber-800">!</span><span>{error}</span></div>}
      {step === 1 && <div className="space-y-5">
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600"><Download size={18}/></div><div><p className="text-sm font-semibold text-slate-700">Step 1: Download the template</p><p className="text-xs text-slate-500">Use the sample with S.No, Date, Shop, Collector, Mode, Amount, Remark and Reference Number.</p></div></div><button type="button" onClick={downloadTemplate} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"><FileSpreadsheet size={16}/>Download Template</button></div>
        <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-white py-12 transition-colors hover:border-blue-400 hover:bg-slate-50"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600"><Upload size={22}/></div><p className="text-sm font-semibold text-slate-700">Step 2: Upload your Excel file</p><p className="text-xs text-slate-500">Click to browse · .xlsx or .xls only · dates may use DD-MM-YYYY or DD/MM/YYYY</p></button>
        <input ref={fileRef} id="collection-import-file" name="collectionImportFile" type="file" className="hidden" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(e) => void loadFile(e.target.files?.[0])}/>{fileName && <p className="text-center text-sm text-slate-500">Selected: {fileName}</p>}
      </div>}
      {step === 2 && <div className="space-y-4"><ImportSummary total={uploadedTotals}/><div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="relative w-full sm:w-[22rem] lg:w-[26rem]"><Search size={15} className="absolute left-3 top-2.5 text-slate-400"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${rowView === "ready" ? "ready" : "not ready"} rows…`} className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-sm outline-none transition-all duration-200 hover:bg-white focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"/></div><div className="ml-auto flex flex-wrap items-center justify-end gap-2"><div className="relative grid h-11 w-[19rem] grid-cols-2 rounded-full border border-slate-200 bg-slate-50 p-1 shadow-sm" role="group" aria-label="Collection import row status"><span aria-hidden className={`absolute bottom-1 top-1 w-[calc(50%-0.25rem)] rounded-full border shadow-sm transition-all duration-300 ease-out ${rowView === "ready" ? "translate-x-[calc(100%+0.25rem)] border-emerald-200 bg-emerald-50" : "translate-x-0 border-amber-200 bg-amber-50"}`}/><button type="button" onClick={() => setRowView("notReady")} aria-pressed={rowView === "notReady"} className={`relative z-10 flex items-center justify-center gap-2 rounded-full px-3 text-xs font-extrabold transition-colors duration-300 ${rowView === "notReady" ? "text-amber-800" : "text-slate-400 hover:text-slate-600"}`}><span className={`h-2 w-2 rounded-full transition-all duration-300 ${rowView === "notReady" ? "scale-110 bg-amber-500 ring-4 ring-amber-100" : "bg-amber-300"}`}/>Not ready <span className={`rounded-full px-1.5 py-0.5 tabular-nums ${rowView === "notReady" ? "bg-amber-100 text-amber-800" : "bg-slate-200/70 text-slate-500"}`}>{invalidCount}</span></button><button type="button" onClick={() => setRowView("ready")} aria-pressed={rowView === "ready"} className={`relative z-10 flex items-center justify-center gap-2 rounded-full px-3 text-xs font-extrabold transition-colors duration-300 ${rowView === "ready" ? "text-emerald-800" : "text-slate-400 hover:text-slate-600"}`}><span className={`h-2 w-2 rounded-full transition-all duration-300 ${rowView === "ready" ? "scale-110 bg-emerald-500 ring-4 ring-emerald-100" : "bg-emerald-300"}`}/>Ready <span className={`rounded-full px-1.5 py-0.5 tabular-nums ${rowView === "ready" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200/70 text-slate-500"}`}>{validRows.length}</span></button></div><span className={`rounded-full border px-3 py-2 text-xs font-bold transition-colors duration-300 ${rowView === "ready" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-amber-100 bg-amber-50 text-amber-800"}`}>Showing {visibleRows.length} {rowView === "ready" ? "ready" : "not ready"}</span></div></div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div ref={previewTopScrollRef} onScroll={() => syncPreviewScroll("top")} className="overflow-x-auto overflow-y-hidden border-b border-slate-200 bg-slate-50" aria-label="Scroll collection import columns"><div className="h-2" style={{ width: previewScrollWidth }}/></div>
          <div ref={previewTableScrollRef} onScroll={() => syncPreviewScroll("table")} className="max-h-[calc(100vh-27rem)] min-h-[18rem] overflow-auto"><table ref={previewTableRef} className="w-full min-w-[1180px] table-fixed text-left text-xs"><colgroup><col style={{ width: "5%" }}/><col style={{ width: "12%" }}/><col style={{ width: "18%" }}/><col style={{ width: "13%" }}/><col style={{ width: "12%" }}/><col style={{ width: "12%" }}/><col style={{ width: "14%" }}/><col style={{ width: "14%" }}/></colgroup><thead className="sticky top-0 z-10 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600"><tr>{columns.map((column) => <th key={column.field} className={`cursor-pointer px-2 py-3 transition-colors hover:bg-slate-200/70 ${column.field === "serialNo" ? "text-center" : "text-left"}`} onClick={() => setSortField(column.field)}>{column.label}{sortField === column.field ? " ↑" : ""}</th>)}</tr></thead><tbody>{visibleRows.map((row) => { const issues = rowIssues.get(row.id) ?? []; return <tr key={row.id} className={`transition-colors ${issues.length ? "bg-amber-50/60" : "hover:bg-emerald-50/40"}`}>{columns.map(({ field }) => { const issue = issues.find((item) => item.field === field); return <td key={field} className="border-t border-slate-100 p-1.5 align-top"><input value={row[field]} onChange={(e) => update(row.id, field, e.target.value)} title={issue?.message} className={`h-9 w-full min-w-0 rounded-lg border px-2 outline-none transition-all duration-200 focus:ring-2 ${field === "serialNo" ? "text-center" : ""} ${issue ? "border-rose-400 bg-rose-50 text-rose-900 focus:ring-rose-100" : "border-transparent bg-transparent hover:bg-white/70 focus:border-emerald-400 focus:bg-white focus:ring-emerald-100"}`}/>{issue && <div className="mt-1 break-words text-[10px] font-semibold leading-4 text-rose-600">{issue.message}</div>}</td>})}</tr>})}</tbody></table>{!visibleRows.length && <div className="p-10 text-center text-sm text-slate-500">No {rowView === "ready" ? "ready" : "not ready"} rows match this search.</div>}</div>
        </div>
        <div className="flex flex-wrap gap-2">{validTotals.byMode.map((item) => <span key={item.mode} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">{item.mode}: {item.count} · {money(item.amount)}</span>)}</div>
      </div>}
      {step === 3 && <div className="mx-auto max-w-6xl space-y-5"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center"><CheckCircle2 size={42} className="mx-auto mb-3 text-emerald-600"/><h3 className="text-xl font-black text-emerald-950">{importedRows.length} {importedRows.length === 1 ? "transaction" : "transactions"} imported successfully</h3></div><ImportSummary total={finalTotals} selectedKey={resultFilter} onSelect={(key) => setResultFilter((current) => current === key ? null : key)}/>{resultFilter && <div className="animate-in fade-in slide-in-from-top-2 duration-200"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{resultFilter === "__all__" ? "All imported transactions" : `${resultFilter} transactions`} · {resultRows.length}</p><button type="button" onClick={() => setResultFilter(null)} className="text-xs font-bold text-slate-500 transition hover:text-slate-800">Hide details</button></div><div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="min-w-[1000px] w-full text-xs"><thead className="bg-slate-100 text-left uppercase text-slate-600"><tr>{columns.map((c) => <th key={c.field} className="px-3 py-3">{c.label}</th>)}</tr></thead><tbody>{resultRows.map((row) => <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">{columns.map((c) => <td key={c.field} className="px-3 py-2">{row[c.field]}</td>)}</tr>)}</tbody></table></div></div>}</div>}
    </main>
    <footer className="flex shrink-0 items-center justify-between border-t border-slate-200 px-6 py-4"><button type="button" onClick={close} disabled={importing} className="group flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 hover:shadow-sm active:translate-y-0 disabled:opacity-40"><X size={15} className="transition-transform duration-200 group-hover:rotate-90 group-hover:scale-110"/>{step === 3 ? "Close" : "Cancel"}</button><div className="flex gap-2">{step === 2 && <><button onClick={() => setStep(1)} className="group flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm"><ArrowLeft size={16} className="transition-transform duration-200 group-hover:-translate-x-1"/> Choose another file</button><button onClick={() => void doImport()} disabled={!validRows.length || importing} className="group flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none">{importing ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16} className="transition-transform duration-300 group-hover:-translate-y-1"/>} Import {validRows.length} transactions</button></>}{step === 3 && <button onClick={close} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md">Done</button>}</div></footer>
    </div>
  </MasterDialog>;
}
