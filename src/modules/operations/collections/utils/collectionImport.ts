export type CollectionImportField =
  | "serialNo" | "date" | "shopName" | "collector" | "mode"
  | "amount" | "remark" | "referenceNo";

export type CollectionImportDraft = {
  id: string;
  sourceRow: number;
  serialNo: string;
  date: string;
  shopName: string;
  collector: string;
  mode: string;
  amount: string;
  remark: string;
  referenceNo: string;
};

export type CollectionImportIssue = { field: CollectionImportField; message: string };

const key = (value: string) => value.trim().toLocaleLowerCase("en-IN");

/** Preserve ordinary Excel text/numbers, but render genuine Excel date cells
 * consistently across Date, Remark and Reference Number columns. */
export function collectionImportCellText(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // SheetJS constructs Excel calendar dates at local midnight. UTC getters
    // would shift an Indian 19-Oct cell back to 18-Oct.
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    return `${day}-${month}-${value.getFullYear()}`;
  }
  return value == null ? "" : String(value);
}

export function canonicalValue(value: string, choices: string[]): string | null {
  const sought = key(value);
  return choices.find((choice) => key(choice) === sought) ?? null;
}

export function parseDisplayDate(value: string): string | null {
  const text = value.trim();
  let day: string;
  let month: string;
  let year: string;

  const dmy = text.match(/^(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{2}|\d{4})$/);
  const isoDate = text.match(/^(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})$/);
  const named = text.match(/^(\d{1,2})\s*[-/. ]\s*([A-Za-z]{3,9})\s*[-/. ]\s*(\d{2}|\d{4})$/);

  if (dmy) {
    [, day, month, year] = dmy;
  } else if (isoDate) {
    [, year, month, day] = isoDate;
  } else if (named) {
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const monthIndex = monthNames.indexOf(named[2].slice(0, 3).toLowerCase());
    if (monthIndex < 0) return null;
    day = named[1];
    month = String(monthIndex + 1);
    year = named[3];
  } else {
    return null;
  }

  if (year.length === 2) year = `20${year}`;
  const dd = day.padStart(2, "0");
  const mm = month.padStart(2, "0");
  const iso = `${year}-${mm}-${dd}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
}

export function validateCollectionImportRow(
  row: CollectionImportDraft,
  masters: { shops: string[]; collectors: string[]; modes: string[]; existingReferences?: string[]; duplicateReferences?: Set<string> },
): CollectionImportIssue[] {
  const issues: CollectionImportIssue[] = [];
  if (!/^\d+$/.test(row.serialNo.trim())) issues.push({ field: "serialNo", message: "S.No must be a whole number." });
  if (!parseDisplayDate(row.date)) issues.push({ field: "date", message: "Use a valid date such as 19-10-2026 or 19/10/2026." });
  if (!canonicalValue(row.shopName, masters.shops)) issues.push({ field: "shopName", message: "Shop is not in the Shop master." });
  if (!canonicalValue(row.collector, masters.collectors)) issues.push({ field: "collector", message: "Collector is not in the active Collection employee list." });
  if (!canonicalValue(row.mode, masters.modes)) issues.push({ field: "mode", message: "Mode must be Cash or an active Bank master." });
  const amount = Number(row.amount.replace(/,/g, "").trim());
  if (!Number.isFinite(amount) || amount <= 0) issues.push({ field: "amount", message: "Amount must be a positive number." });
  if (row.remark.length > 2_000) issues.push({ field: "remark", message: "Remark cannot exceed 2,000 characters." });
  if (row.referenceNo.length > 200) issues.push({ field: "referenceNo", message: "Reference number cannot exceed 200 characters." });
  const reference = key(row.referenceNo);
  if (reference && (masters.existingReferences ?? []).some((value) => key(value) === reference)) {
    issues.push({ field: "referenceNo", message: "Reference number already exists in Collection Entry." });
  } else if (reference && masters.duplicateReferences?.has(reference)) {
    issues.push({ field: "referenceNo", message: "Reference number is duplicated in this Excel file." });
  }
  return issues;
}

export function importTotals(rows: CollectionImportDraft[]) {
  const byMode = new Map<string, { mode: string; count: number; amount: number }>();
  let amount = 0;
  rows.forEach((row) => {
    const value = Number(row.amount.replace(/,/g, "")) || 0;
    amount += value;
    const modeKey = key(row.mode);
    const current = byMode.get(modeKey) ?? { mode: row.mode.trim() || "Unspecified", count: 0, amount: 0 };
    current.count += 1;
    current.amount += value;
    byMode.set(modeKey, current);
  });
  return { count: rows.length, amount, byMode: [...byMode.values()].sort((a, b) => b.amount - a.amount) };
}
