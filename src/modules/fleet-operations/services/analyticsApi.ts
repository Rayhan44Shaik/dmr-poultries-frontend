// Fleet Analytics API client. The single authoritative source of truth is the
// backend GET /api/fleet/analytics — this layer only fetches and types it.
import apiClient from '../../../api/client';
import type { FleetAnalyticsResponse } from '../types/analytics';

export interface AnalyticsQueryParams {
  fromDate: string;
  toDate: string;
  vehicleId?: number | null;
}

export const analyticsApi = {
  /** GET /fleet/analytics — backend-computed fleet analytics for a range. */
  async get(params: AnalyticsQueryParams): Promise<FleetAnalyticsResponse> {
    const query: Record<string, string | number> = {
      fromDate: params.fromDate,
      toDate: params.toDate,
    };
    if (params.vehicleId != null) query.vehicleId = params.vehicleId;
    const res = await apiClient.get('/fleet/analytics', { params: query });
    return res.data;
  },
};

export default analyticsApi;