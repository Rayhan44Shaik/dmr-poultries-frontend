import type {
  LedgerTransaction,
  ShopLedgerPdfEntry,
} from "../components/ShopLedgerPDF";

export type ShopLedgerReportType = "all" | "sales" | "collection" | "All" | "Sales" | "Collection";

function ledgerSearchHaystack(tx: LedgerTransaction): string {
  return [
    tx.date,
    tx.particulars,
    tx.collectionNo,
    tx.loadLabel,
    tx.paymentMode,
    tx.type,
    tx.subShopName,
    tx.remarks,
    tx.birds || "",
    tx.weight > 0 ? tx.weight : "",
    tx.rate > 0 ? tx.rate : "",
    tx.debit > 0 ? tx.debit : "",
    tx.credit > 0 ? tx.credit : "",
    tx.balance !== 0 ? tx.balance : "",
  ]
    .filter((value) => value !== "" && value != null)
    .join(" ")
    .toLowerCase();
}

export function shopLedgerHasPrintableActivity(data: LedgerTransaction[]): boolean {
  return data.slice(1).some(
    (row) =>
      row.debit !== 0 ||
      row.credit !== 0 ||
      row.birds !== 0 ||
      row.weight !== 0,
  );
}

/** Apply the page's report-type + search filters to shop statements so the
 *  PDF matches the table, even when no shop or date is selected. */
export function scopeShopLedgersForPdf(
  entries: ShopLedgerPdfEntry[],
  opts: {
    reportType: ShopLedgerReportType;
    searchTerm?: string;
    keepEmptySelectedShop?: string;
  },
): ShopLedgerPdfEntry[] {
  const needle = opts.searchTerm?.trim().toLowerCase() ?? "";
  const keepShop = opts.keepEmptySelectedShop?.trim() ?? "";

  return entries
    .map((entry) => {
      const typed = filterStatementByType(entry.data, opts.reportType);
      if (!needle) return { ...entry, data: typed };

      const shopHit = entry.shop.toLowerCase().includes(needle);
      if (shopHit) return { ...entry, data: typed };

      const opening = typed[0];
      const body = typed.slice(1).filter((tx) => ledgerSearchHaystack(tx).includes(needle));
      return {
        ...entry,
        data: opening ? recalculateStatementBalances([opening, ...body]) : body,
      };
    })
    .filter((entry) => {
      if (keepShop && entry.shop === keepShop) return true;
      if (needle && entry.shop.toLowerCase().includes(needle)) {
        return shopLedgerHasPrintableActivity(entry.data) || Number(entry.data[0]?.balance) !== 0;
      }
      return shopLedgerHasPrintableActivity(entry.data);
    });
}

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
