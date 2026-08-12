/**
 * Market Rate master — PostgreSQL ONLY via shared Axios helpers.
 * One record per business date; saves are batched upserts.
 */

import {
  apiGet,
  apiPut,
  handleApiError,
} from "../../../../api";
import type { MarketRate, MarketRateInput } from "../types/marketRate";

const MARKET_RATES_PATH = "/masters/market-rates";

function numOrZero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mapMarketRate(raw: Record<string, unknown>): MarketRate {
  return {
    id: Number(raw.id),
    businessDate: String(raw.businessDate ?? ""),
    vij: numOrZero(raw.vij),
    gun: numOrZero(raw.gun),
    rp: numOrZero(raw.rp),
    sneha: numOrZero(raw.sneha),
    vencobRate: numOrZero(raw.vencobRate),
    vencobVii: numOrZero(raw.vencobVii),
    vencobGun: numOrZero(raw.vencobGun),
    associationVii: numOrZero(raw.associationVii),
    c17: numOrZero(raw.c17),
    c15: numOrZero(raw.c15),
    c13: numOrZero(raw.c13),
    c12: numOrZero(raw.c12),
    c10: numOrZero(raw.c10),
    createdAt: raw.createdAt ? String(raw.createdAt) : null,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : null,
  };
}

/** GET /api/masters/market-rates?fromDate=&toDate= */
export async function loadMarketRates(
  fromDate?: string,
  toDate?: string
): Promise<MarketRate[]> {
  const { data } = await apiGet<Record<string, unknown>[]>(MARKET_RATES_PATH, {
    params: {
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    },
  });
  return Array.isArray(data) ? data.map(mapMarketRate) : [];
}

/** PUT /api/masters/market-rates/batch — upserts every row by business date. */
export async function saveMarketRates(
  inputs: MarketRateInput[]
): Promise<MarketRate[]> {
  const { data } = await apiPut<Record<string, unknown>[]>(
    `${MARKET_RATES_PATH}/batch`,
    inputs
  );
  return Array.isArray(data) ? data.map(mapMarketRate) : [];
}

export { handleApiError };
