import { apiDelete, apiGet, apiPost, apiPut } from "../../../api";
import type { Payment } from "../types/payment.types";

const PATH = "/accounts/payments";

type ApiPayment = Omit<Payment, "id" | "createdAt" | "updatedAt" | "remarks" | "attachments"> & {
  id: number;
  createdAt: string | null;
  updatedAt: string | null;
  remarks: string | null;
  attachments?: unknown[];
};

export type PaymentFilters = {
  dateFrom?: string;
  dateTo?: string;
  paymentType?: string;
  paymentMode?: string;
  search?: string;
};

function toPayment(row: ApiPayment): Payment {
  return {
    ...row,
    id: String(row.id),
    createdAt: row.createdAt ?? "",
    updatedAt: row.updatedAt ?? "",
    remarks: row.remarks ?? "",
    attachments: [],
  };
}

function numericId(id: string): number {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("Invalid payment id");
  return parsed;
}

export async function listPayments(filters: PaymentFilters = {}): Promise<Payment[]> {
  const params: Record<string, string> = {};
  if (filters.dateFrom) params.fromDate = filters.dateFrom;
  if (filters.dateTo) params.toDate = filters.dateTo;
  if (filters.paymentType) params.paymentType = filters.paymentType;
  if (filters.paymentMode) params.mode = filters.paymentMode;
  if (filters.search?.trim()) params.search = filters.search.trim();
  const { data } = await apiGet<ApiPayment[]>(PATH, { params });
  return data.map(toPayment);
}

export async function createPayment(body: Omit<Payment, "id" | "paymentNo" | "createdAt" | "updatedAt" | "attachments">): Promise<Payment> {
  const { data } = await apiPost<ApiPayment>(PATH, body);
  return toPayment(data);
}

export async function updatePayment(id: string, body: Partial<Omit<Payment, "id" | "paymentNo" | "createdAt" | "updatedAt" | "attachments">>): Promise<Payment> {
  const { data } = await apiPut<ApiPayment>(`${PATH}/${numericId(id)}`, body);
  return toPayment(data);
}

export async function deletePayment(id: string): Promise<void> {
  await apiDelete(`${PATH}/${numericId(id)}`);
}
