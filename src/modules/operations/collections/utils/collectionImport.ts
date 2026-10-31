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

export function canonicalValue(value: string, choices: string[]): string | null {
  const sought = key(value);
  return choices.find((choice) => key(choice) === sought) ?? null;
}

export function parseDisplayDate(value: string): string | null {
  const match = value.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm}-${dd}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
}

export function validateCollectionImportRow(
  row: CollectionImportDraft,
  masters: { shops: string[]; collectors: string[]; modes: string[]; existingReferences?: string[]; duplicateReferences?: Set<string> },
): CollectionImportIssue[] {
  const issues: CollectionImportIssue[] = [];
  if (!/^\d+$/.test(row.serialNo.trim())) issues.push({ field: "serialNo", message: "S.No must be a whole number." });
  if (!parseDisplayDate(row.date)) issues.push({ field: "date", message: "Use DD-MM-YYYY (for example 12-10-2026)." });
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
