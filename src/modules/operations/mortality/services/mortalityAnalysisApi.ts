import { apiGet } from "../../../../api";

const BASE = "/operations/mortality-analysis";

export interface MortalityRow {
  tripId: number; tripNo: string; tripDate: string; sourceFarm: string;
  supervisorName: string; vehicleNo: string; driverName: string;
  loaders: string[]; helpers: string[]; status: string;
  farmBirds: number; farmWeight: number; deliveryShops: number;
  deliveredBirds: number; deliveredWeight: number; mortalityCount: number;
  mortalityWeight: number; weightLoss: number; weightLossPercentage: number;
  mortalityPercentage: number; survivalRate: number;
}

export interface MortalityKpis {
  totalTrips: number; farmBirds: number; farmWeight: number; deliveryShops: number;
  deliveredBirds: number; deliveredWeight: number; mortalityCount: number;
  mortalityWeight: number; mortalityPercentage: number; weightLoss: number;
  weightLossPercentage: number;
}

export interface MortalityMeta { total: number; page: number; limit: number; totalPages: number; }
export interface MortalityFilterOptions { farms: string[]; supervisors: string[]; }
export interface MortalityAnalysisResponse { data: MortalityRow[]; meta: MortalityMeta; kpis: MortalityKpis; filterOptions: MortalityFilterOptions; }
export interface MortalityDelivery { id: number; serialNo: number | null; shopName: string; birdType: string; birds: number; weight: number; mortality: number; mortalityWeight: number; rate: number | null; amount: number; remarks: string; }

export type SortBy = "tripDate" | "tripNo" | "sourceFarm" | "supervisorName" | "farmBirds" | "farmWeight" | "deliveryShops" | "deliveredBirds" | "deliveredWeight" | "mortalityCount" | "mortalityWeight" | "mortalityPercentage" | "weightLoss" | "weightLossPercentage";
export interface MortalityQuery { fromDate?: string; toDate?: string; farm?: string; supervisor?: string; search?: string; sortBy?: SortBy; sortDir?: "asc" | "desc"; page?: number; limit?: number; }

function cleanParams(query: MortalityQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null && value !== "") params[key] = value;
  return params;
}

export async function fetchMortalityAnalysis(query: MortalityQuery, signal?: AbortSignal): Promise<MortalityAnalysisResponse> {
  const { data } = await apiGet<MortalityAnalysisResponse>(BASE, { params: cleanParams(query), signal });
  return data;
}

export async function fetchTripDeliveries(tripId: number, signal?: AbortSignal): Promise<MortalityDelivery[]> {
  const { data } = await apiGet<MortalityDelivery[]>(`${BASE}/${tripId}/deliveries`, { signal });
  return data;
}
