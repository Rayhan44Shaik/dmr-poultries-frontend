import apiClient from '../../../api/client';
import type {
  EmiPayment,
  EmiPaymentInput,
  EmiSchedule,
  EmiScheduleInput,
  EmiStatus,
} from '../types';

const BASE = '/fleet/emi';

export interface EmiListParams {
  vehicleId?: number | string;
  status?: EmiStatus | 'all';
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface EmiListResponse {
  data: EmiSchedule[];
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

const unwrapList = (payload: EmiSchedule[] | EmiListResponse): EmiSchedule[] =>
  Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];

/**
 * Backend-ready EMI contract. The separate backend repository should expose
 * this namespace; the UI never substitutes local or synthetic production data.
 */
export const emiApi = {
  async list(params: EmiListParams = {}): Promise<EmiSchedule[]> {
    const response = await apiClient.get<EmiSchedule[] | EmiListResponse>(BASE, { params });
    return unwrapList(response.data);
  },

  async create(payload: EmiScheduleInput): Promise<EmiSchedule> {
    const response = await apiClient.post<EmiSchedule>(BASE, payload);
    return response.data;
  },

  async update(id: string | number, payload: Partial<EmiScheduleInput>): Promise<EmiSchedule> {
    const response = await apiClient.put<EmiSchedule>(`${BASE}/${id}`, payload);
    return response.data;
  },

  async listPayments(id: string | number): Promise<EmiPayment[]> {
    const response = await apiClient.get<EmiPayment[]>(`${BASE}/${id}/payments`);
    return Array.isArray(response.data) ? response.data : [];
  },

  async recordPayment(id: string | number, payload: EmiPaymentInput): Promise<EmiSchedule> {
    const response = await apiClient.post<EmiSchedule>(`${BASE}/${id}/payments`, payload);
    return response.data;
  },
};

export default emiApi;
