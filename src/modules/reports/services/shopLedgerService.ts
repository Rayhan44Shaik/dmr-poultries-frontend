/**
 * Shop Ledger — frontend fetcher for the authoritative backend ledger
 * (GET /operations/shop-ledger). The complete historical ledger for a shop
 * (or all shops) over a custom date range comes straight from PostgreSQL —
 * no localStorage authority, no client-side reconstruction, no 10-row limit.
 */
import { apiGet } from "../../../api";
import type { LedgerTransaction } from "../components/ShopLedgerPDF";

export type ShopLedgerEntryType = "sale" | "collection" | "correction";

export interface ShopLedgerRow {
  id: number;
  shopId: number | null;
  shopName: string;
  subShopName: string;
  remarks: string;
  date: string;
  type: ShopLedgerEntryType;
  referenceType: string;
  referenceId: number;
  /** Trip no / sale no / collection no when the reference resolves. */
  referenceNo: string;
  /** Load 1 / Load 2 represented by this sale row. */
  loadLabel: string;
  description: string;
  debit: number;
  credit: number;
  /** Backend-authoritative running balance as-of this row. */
  balance: number;
  birds: number;
  weight: number;
  farmBirds: number;
  farmWeight: number;
  mortalityBirds: number;
  mortalityWeight: number;
  weightLoss: number;
  rate: number;
  paymentMode: string | null;
  status: string | null;
  createdAt: string | null;
}

export interface ShopLedgerMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ShopLedgerResponse {
  shopId: number | null;
  shopName: string;
  /** Backend-computed balance at the START of the requested range. */
  openingBalance: number;
  openingBalances?: Array<{
    shopId: number;
    shopName: string;
    openingBalance: number;
  }>;
  data: ShopLedgerRow[];
  meta?: ShopLedgerMeta;
}

export interface ShopLedgerLoadBreakdown {
  load: number;
  birds: number;
  weight: number;
  mortalityBirds: number;
  mortalityWeight: number;
  weightLoss: number;
}

export interface ShopLedgerCumulativeQuantity {
  shopId: number;
  shopName: string;
  birds: number;
  weight: number;
  mortalityBirds: number;
  mortalityWeight: number;
  weightLoss: number;
  mortalityByLoad: Array<{
    load: number;
    boxBirds: number;
    boxWeight: number;
    weightModeBirds: number;
  }>;
  /** Per-load delivered/mortality/weight-loss actuals. Same normalized rows
   *  as the shop totals, grouped by load — sums equal the shop totals. */
  deliveriesByLoad: ShopLedgerLoadBreakdown[];
}

export interface ShopLedgerCumulativeRow extends ShopLedgerCumulativeQuantity {
  status: string;
  openingBalance: number;
  sale: number;
  approvedCollection: number;
  closingBalance: number;
}

export async function fetchShopLedgerCumulative(filters: {
  shopId?: number;
  fromDate?: string;
  toDate?: string;
  reportType?: "all" | "sales" | "collection";
} = {}): Promise<ShopLedgerCumulativeRow[]> {
  const params: Record<string, string> = {};
  if (filters.shopId != null) params.shopId = String(filters.shopId);
  if (filters.fromDate) params.fromDate = filters.fromDate;
  if (filters.toDate) params.toDate = filters.toDate;
  if (filters.reportType) params.reportType = filters.reportType;
  const { data } = await apiGet<ShopLedgerCumulativeRow[]>(
    "/operations/shop-ledger/cumulative",
    { params },
  );
  return (data ?? []).map((row) => ({
    shopId: Number(row.shopId),
    shopName: String(row.shopName ?? ""),
    status: String(row.status ?? "Active"),
    birds: Number(row.birds ?? 0),
    weight: Number(row.weight ?? 0),
    mortalityBirds: Number(row.mortalityBirds ?? 0),
    mortalityWeight: Number(row.mortalityWeight ?? 0),
    weightLoss: Number(row.weightLoss ?? 0),
    openingBalance: Number(row.openingBalance ?? 0),
    sale: Number(row.sale ?? 0),
    approvedCollection: Number(row.approvedCollection ?? 0),
    closingBalance: Number(row.closingBalance ?? 0),
    mortalityByLoad: (row.mortalityByLoad ?? []).map((load) => ({
      load: Number(load.load ?? 1),
      boxBirds: Number(load.boxBirds ?? 0),
      boxWeight: Number(load.boxWeight ?? 0),
      weightModeBirds: Number(load.weightModeBirds ?? 0),
    })),
    deliveriesByLoad: (row.deliveriesByLoad ?? []).map((load) => ({
      load: Number(load.load ?? 1),
      birds: Number(load.birds ?? 0),
      weight: Number(load.weight ?? 0),
      mortalityBirds: Number(load.mortalityBirds ?? 0),
      mortalityWeight: Number(load.mortalityWeight ?? 0),
      weightLoss: Number(load.weightLoss ?? 0),
    })),
  }));
}

export async function fetchShopLedgerCumulativeQuantities(filters: {
  fromDate?: string;
  toDate?: string;
} = {}): Promise<ShopLedgerCumulativeQuantity[]> {
  const params: Record<string, string> = {};
  if (filters.fromDate) params.fromDate = filters.fromDate;
  if (filters.toDate) params.toDate = filters.toDate;
  const { data } = await apiGet<ShopLedgerCumulativeQuantity[]>(
    "/operations/shop-ledger/cumulative-quantities",
    { params },
  );
  return (data ?? []).map((row) => ({
    shopId: Number(row.shopId), shopName: String(row.shopName ?? ""),
    birds: Number(row.birds ?? 0), weight: Number(row.weight ?? 0),
    mortalityBirds: Number(row.mortalityBirds ?? 0),
    mortalityWeight: Number(row.mortalityWeight ?? 0),
    weightLoss: Number(row.weightLoss ?? 0),
    mortalityByLoad: (row.mortalityByLoad ?? []).map((load) => ({
      load: Number(load.load ?? 1),
      boxBirds: Number(load.boxBirds ?? 0),
      boxWeight: Number(load.boxWeight ?? 0),
      weightModeBirds: Number(load.weightModeBirds ?? 0),
    })),
    deliveriesByLoad: (row.deliveriesByLoad ?? []).map((load) => ({
      load: Number(load.load ?? 1),
      birds: Number(load.birds ?? 0),
      weight: Number(load.weight ?? 0),
      mortalityBirds: Number(load.mortalityBirds ?? 0),
      mortalityWeight: Number(load.mortalityWeight ?? 0),
      weightLoss: Number(load.weightLoss ?? 0),
    })),
  }));
}

/**
 * Fetch the complete ledger for one shop (or all shops when shopId is omitted).
 * `fromDate` / `toDate` are sent as-is (backend DATE semantics, inclusive of
 * the last day). The backend returns every matching transaction — no limit is
 * applied here (optional page/limit defer to backend pagination).
 */
const inflightReads = new Map<string, Promise<ShopLedgerResponse>>();

export async function fetchShopLedger(
  filters: {
    shopId?: number;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<ShopLedgerResponse> {
  const key = JSON.stringify({
    shopId: filters.shopId ?? null,
    fromDate: filters.fromDate ?? "",
    toDate: filters.toDate ?? "",
    page: filters.page ?? null,
    limit: filters.limit ?? null,
  });
  const existing = inflightReads.get(key);
  if (existing) return existing;

  const request = (async () => {
    const params: Record<string, string> = {};
    if (filters.shopId != null) params.shopId = String(filters.shopId);
    if (filters.fromDate) params.fromDate = filters.fromDate;
    if (filters.toDate) params.toDate = filters.toDate;
    if (filters.page != null) params.page = String(filters.page);
    if (filters.limit != null) params.limit = String(filters.limit);
    const { data } = await apiGet<ShopLedgerResponse>(
      "/operations/shop-ledger",
      {
        params,
      },
    );
    return {
      shopId: data.shopId ?? null,
      shopName: data.shopName ?? "",
      openingBalance: Number(data.openingBalance ?? 0),
      openingBalances: (data.openingBalances ?? []).map((row) => ({
        shopId: Number(row.shopId),
        shopName: String(row.shopName ?? ""),
        openingBalance: Number(row.openingBalance ?? 0),
      })),
      data: (data.data ?? []).map((row) => ({
        id: Number(row.id),
        shopId: row.shopId == null ? null : Number(row.shopId),
        shopName: String(row.shopName ?? ""),
        subShopName: String(row.subShopName ?? ""),
        remarks: String(row.remarks ?? ""),
        date: String(row.date ?? ""),
        // The backend preserves correction rows so an amount-only adjustment
        // never masquerades as a second sale with zero birds and weight.
        type: (row.type ?? "sale") as ShopLedgerEntryType,
        referenceType: String(row.referenceType ?? ""),
        referenceId: Number(row.referenceId ?? 0),
        referenceNo: String(row.referenceNo ?? ""),
        loadLabel: String(row.loadLabel ?? ""),
        description: String(row.description ?? ""),
        debit: Number(row.debit ?? 0),
        credit: Number(row.credit ?? 0),
        balance: Number(row.balance ?? 0),
        birds: Number(row.birds ?? 0),
        weight: Number(row.weight ?? 0),
        farmBirds: Number(row.farmBirds ?? 0),
        farmWeight: Number(row.farmWeight ?? 0),
        mortalityBirds: Number(row.mortalityBirds ?? 0),
        mortalityWeight: Number(row.mortalityWeight ?? 0),
        weightLoss: Number(row.weightLoss ?? 0),
        rate: Number(row.rate ?? 0),
        paymentMode: row.paymentMode == null ? null : String(row.paymentMode),
        status: row.status == null ? null : String(row.status),
        createdAt: row.createdAt == null ? null : String(row.createdAt),
      })),
      meta: data.meta,
    };
  })();

  inflightReads.set(key, request);
  try {
    return await request;
  } finally {
    if (inflightReads.get(key) === request) inflightReads.delete(key);
  }
}

// ─── Shared ledger row mapping — the exact LedgerTransaction shape the shop
//     ledger table, cumulative view and Shop Ledger PDF already consume.
//     Birds/weight/rate belong to sale rows (backend trip-delivery detail);
//     collections carry their number. Lives here (not in the page) so the
//     detail modal and every other consumer share one mapping — never a
//     second ledger calculation system.
const txParticulars = (row: ShopLedgerRow): string => {
  // Particulars = shop name only. Trip/collection reference numbers are still
  // kept on the transaction (collectionNo) for search, but never shown here.
  return row.shopName || row.description || row.referenceNo || "Ledger";
};

export const mapLedgerRowToTx = (row: ShopLedgerRow): LedgerTransaction => {
  const isSale = row.type === "sale";
  return {
    id: row.id,
    createdAt: row.createdAt ?? undefined,
    date: row.date,
    particulars: txParticulars(row),
    birds: isSale ? row.birds : 0,
    weight: isSale ? row.weight : 0,
    farmBirds: isSale ? row.farmBirds : 0,
    farmWeight: isSale ? row.farmWeight : 0,
    mortalityBirds: isSale ? row.mortalityBirds : 0,
    mortalityWeight: isSale ? row.mortalityWeight : 0,
    weightLoss: isSale ? row.weightLoss : 0,
    rate: isSale ? row.rate : 0,
    debit: Number(row.debit) || 0,
    credit: Number(row.credit) || 0,
    balance: Number(row.balance) || 0,
    type: row.type,
    paymentMode: row.paymentMode ?? undefined,
    collectionNo: row.referenceNo || undefined,
    loadLabel: isSale && row.loadLabel ? row.loadLabel : undefined,
    subShopName: row.subShopName?.trim() || undefined,
    remarks: row.remarks?.trim() || undefined,
  };
};

/** Fetch the COMPLETE ledger, walking server pagination until every row has
 *  arrived — without this, All-Shops ranges with more than one page of
 *  transactions would silently truncate at the server's page size. */
export async function fetchAllLedgerPages(filters: {
  shopId?: number;
  fromDate?: string;
  toDate?: string;
}): Promise<ShopLedgerResponse> {
  const first = await fetchShopLedger({ ...filters, page: 1, limit: 500 });
  const totalPages = Math.max(1, first.meta?.totalPages ?? 1);
  const dedupeRows = (rows: ShopLedgerRow[]): ShopLedgerRow[] => {
    const seen = new Set<string>();
    return rows.filter((row) => {
      const key = row.id > 0
        ? `${row.type}:id:${row.id}`
        : `${row.shopId}:${row.type}:${row.referenceType}:${row.referenceId}:${row.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  if (totalPages <= 1) return { ...first, data: dedupeRows(first.data) };
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetchShopLedger({ ...filters, page: index + 2, limit: 500 }),
    ),
  );
  return {
    ...first,
    data: dedupeRows([
      ...first.data,
      ...rest.flatMap((page) => page.data),
    ]),
  };
}
