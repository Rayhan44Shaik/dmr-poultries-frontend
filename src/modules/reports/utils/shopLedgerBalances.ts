import type { LedgerTransaction } from "../components/ShopLedgerPDF";

export type ShopLedgerReportType = "all" | "sales" | "collection" | "All" | "Sales" | "Collection";

/** Rebuild the running Balance column from only the transactions visible in
 * the statement. Sales = Opening + Debits; Collections = Opening - Credits;
 * All = Opening + Debits - Credits. */
export function recalculateStatementBalances(
  data: LedgerTransaction[],
): LedgerTransaction[] {
  if (data.length === 0) return [];
  const opening = { ...data[0] };
  let running = Number(opening.balance) || 0;
  const rows = data.slice(1).map((row) => {
    running = Math.round((running + row.debit - row.credit) * 100) / 100;
    return { ...row, balance: running };
  });
  return [opening, ...rows];
}

/** Preserve the authoritative carried opening while limiting period activity
 * to the requested report type. Recomputed balances therefore close as:
 * sales = opening + sales; collection = opening - collections; all = both. */
export function filterStatementByType(
  data: LedgerTransaction[],
  reportType: ShopLedgerReportType,
): LedgerTransaction[] {
  if (data.length === 0) return [];
  const normalized = reportType.toLowerCase();
  const rows = normalized === "all"
    ? data.slice(1)
    : data.slice(1).filter(
        (row) => row.type === (normalized === "sales" ? "sale" : "collection"),
      );
  return recalculateStatementBalances([{ ...data[0] }, ...rows]);
}
