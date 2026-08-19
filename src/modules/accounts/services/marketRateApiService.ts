import { apiGet, apiPut } from "../../../api";

export type MarketRateRecord = {
  id: number;
  businessDate: string;
  vij: number;
  gun: number;
  rp: number;
  sneha: number;
  vencobRate: number;
  vencobVii: number;
  vencobGun: number;
  associationVii: number;
  c17: number;
  c15: number;
  c13: number;
  c12: number;
  c10: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MarketRateInput = Omit<MarketRateRecord, "id" | "createdAt" | "updatedAt">;

const MARKET_RATE_PATH = "/masters/market-rates";

export async function listMarketRates(fromDate?: string, toDate?: string): Promise<MarketRateRecord[]> {
  const params = new URLSearchParams();
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const { data } = await apiGet<MarketRateRecord[]>(`${MARKET_RATE_PATH}${suffix}`);
  return Array.isArray(data) ? data : [];
}

export async function saveMarketRates(rows: MarketRateInput[]): Promise<MarketRateRecord[]> {
  const { data } = await apiPut<MarketRateRecord[]>(`${MARKET_RATE_PATH}/batch`, rows);
  return Array.isArray(data) ? data : [];
}
