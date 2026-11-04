import { useCallback, useEffect, useRef, useState } from "react";
import { onShopDataChanged } from "../../../shared/events/shopDataEvents";
import {
  fetchAllLedgerPages,
  mapLedgerRowToTx,
} from "../services/shopLedgerService";
import type {
  LedgerTransaction,
  ShopLedgerPdfEntry,
} from "./ShopLedgerPDF";
import { scopeShopLedgersForPdf } from "../utils/shopLedgerBalances";
import {
  isCurrentDetailRequest,
  shopDetailCacheKey,
} from "../utils/shopLedgerDetailNav";

export type ShopDetailReportType = "all" | "sales" | "collection";

export interface ShopDetailFilters {
  shopId: number;
  shopName: string;
  fromDate: string;
  toDate: string;
  reportType: ShopDetailReportType;
  searchTerm: string;
  ownerName?: string;
  mobile?: string;
  city?: string;
}

/** Raw (unscoped) ledger cache: one in-flight or settled promise per
 *  shop + applied date range. Type/search scoping is pure and instant, so it
 *  never triggers a fetch — reopening the same shop is always instant. */
const detailLedgerCache = new Map<string, Promise<LedgerTransaction[]>>();
const DETAIL_CACHE_LIMIT = 20;

function cacheDetailLedger(
  key: string,
  loader: () => Promise<LedgerTransaction[]>,
): Promise<LedgerTransaction[]> {
  const hit = detailLedgerCache.get(key);
  if (hit) return hit;
  const request = loader().catch((error: unknown) => {
    if (detailLedgerCache.get(key) === request) detailLedgerCache.delete(key);
    throw error;
  });
  detailLedgerCache.set(key, request);
  while (detailLedgerCache.size > DETAIL_CACHE_LIMIT) {
    const oldest = detailLedgerCache.keys().next().value;
    if (oldest === undefined) break;
    detailLedgerCache.delete(oldest);
  }
  return request;
}

/** Drop cached raw ledgers after sale/collection changes. A known shop clears
 *  only its own entries; an unknown scope clears everything (never stale). */
export function invalidateShopDetailCache(shopId?: number | null): void {
  if (shopId == null) {
    detailLedgerCache.clear();
    return;
  }
  const prefix = `${shopId}|`;
  for (const key of [...detailLedgerCache.keys()]) {
    if (key.startsWith(prefix)) detailLedgerCache.delete(key);
  }
}

/**
 * Authoritative single-shop ledger for the applied range, in the same
 * chronological order the PDF prints (date ascending, then id). Balances
 * come from the backend rows; only post-filter arithmetic (which the
 * Transactions table and PDF already perform) re-derives running balances
 * after report-type/search scoping.
 */
export async function loadShopDetailLedger(
  filters: Pick<ShopDetailFilters, "shopId" | "fromDate" | "toDate">,
): Promise<LedgerTransaction[]> {
  const key = shopDetailCacheKey(filters.shopId, filters.fromDate, filters.toDate);
  return cacheDetailLedger(key, async () => {
    const res = await fetchAllLedgerPages({
      shopId: filters.shopId,
      fromDate: filters.fromDate || undefined,
      toDate: filters.toDate || undefined,
    });
    const openingTotal = Number(res.openingBalance) || 0;
    const body = [...res.data]
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
      .map(mapLedgerRowToTx);
    const opening: LedgerTransaction = {
      date: filters.fromDate,
      particulars: "Opening Balance",
      birds: 0,
      weight: 0,
      rate: 0,
      debit: 0,
      credit: 0,
      balance: openingTotal,
      type: "sale",
    };
    return [opening, ...body];
  });
}

/** Fire-and-forget prefetch for the neighbouring shops. Cache and in-flight
 *  dedupe make repeat calls free; failures stay silent (the open on demand
 *  path surfaces real errors with retry). */
export function prefetchShopDetailLedger(
  filters: Pick<ShopDetailFilters, "shopId" | "fromDate" | "toDate">,
): void {
  void loadShopDetailLedger(filters).catch(() => undefined);
}

export interface ScopedShopDetail {
  /** The exact rows shown on screen — also the exact rows handed to the PDF. */
  scoped: LedgerTransaction[];
  opening: number;
  totalSales: number;
  totalCollections: number;
  closing: number;
  totalBirds: number;
  totalWeight: number;
}

/**
 * Apply the page's committed transaction scope (report type + search) to one
 * shop's authoritative ledger. The modal and its per-shop PDF both read this
 * one result, so screen, cumulative totals and PDF can never disagree.
 */
export function scopeShopDetailLedger(
  entry: ShopLedgerPdfEntry,
  opts: { reportType: ShopDetailReportType; searchTerm: string },
): ScopedShopDetail {
  const [scopedEntry] = scopeShopLedgersForPdf([entry], {
    reportType: opts.reportType,
    searchTerm: opts.searchTerm,
    keepEmptySelectedShop: entry.shop,
  });
  const scoped = scopedEntry?.data ?? [];
  const body = scoped.slice(1);
  const sumDebit = (type: LedgerTransaction["type"]) =>
    body.reduce((sum, tx) => (tx.type === type ? sum + tx.debit : sum), 0);
  const sumCredit = (type: LedgerTransaction["type"]) =>
    body.reduce((sum, tx) => (tx.type === type ? sum + tx.credit : sum), 0);
  return {
    scoped,
    opening: scoped[0]?.balance ?? 0,
    totalSales: sumDebit("sale") + sumDebit("correction"),
    totalCollections: sumCredit("collection") + sumCredit("correction"),
    closing: scoped.length > 0 ? scoped[scoped.length - 1].balance : 0,
    totalBirds: body.reduce((sum, tx) => sum + (tx.birds || 0), 0),
    totalWeight: body.reduce((sum, tx) => sum + (tx.weight || 0), 0),
  };
}

export type ShopDetailStatus =
  | { kind: "loading" }
  | { kind: "ready"; raw: LedgerTransaction[] }
  | { kind: "error"; message: string };

/**
 * On-demand authoritative ledger for the open detail modal. Loads once per
 * shop + range (shared cache), refetches only after relevant sale/collection
 * changes, and never lets a stale request overwrite a newer selection.
 */
export function useShopLedgerDetail(
  filters: ShopDetailFilters | null,
): ShopDetailStatus & { retry: () => void } {
  const requestKey = filters
    ? `${filters.shopId}|${filters.fromDate}|${filters.toDate}`
    : null;
  const [status, setStatus] = useState<ShopDetailStatus>({ kind: "loading" });
  // Render-phase sync (never an effect): a new shop or range shows loading
  // immediately; only the newest request may then commit its rows.
  const [syncedKey, setSyncedKey] = useState<string | null>(requestKey);
  if (syncedKey !== requestKey) {
    setSyncedKey(requestKey);
    setStatus({ kind: "loading" });
  }
  const [nonce, setNonce] = useState(0);
  const requestRef = useRef(0);
  const activeShopId = filters?.shopId ?? null;

  useEffect(() => {
    if (!filters || !requestKey) return undefined;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    let cancelled = false;
    void loadShopDetailLedger(filters).then(
      (raw) => {
        if (isCurrentDetailRequest(requestId, requestRef.current, cancelled)) {
          setStatus({ kind: "ready", raw });
        }
      },
      (error: unknown) => {
        if (isCurrentDetailRequest(requestId, requestRef.current, cancelled)) {
          setStatus({
            kind: "error",
            message: error instanceof Error ? error.message : "Unable to load this shop ledger.",
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
    // Re-run on shop/range/nonce only — type/search scoping is sync memo work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, nonce]);

  // Sale/collection edits anywhere invalidate this shop's cache and refresh
  // the open modal; other shops' cached ledgers are left alone.
  useEffect(() => {
    if (activeShopId == null) return undefined;
    return onShopDataChanged((detail) => {
      if (detail.shopId != null && detail.shopId !== activeShopId) return;
      invalidateShopDetailCache(detail.shopId ?? activeShopId);
      setNonce((value) => value + 1);
    });
  }, [activeShopId]);

  const retry = useCallback(() => setNonce((value) => value + 1), []);
  return { ...status, retry };
}
