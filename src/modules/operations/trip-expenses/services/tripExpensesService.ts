import { apiGet } from "../../../../api";

export type ExpenseDetail = { name: string; amount: number };
export type DieselDetail = { bunk: string; litres: number; rate: number; amount: number };
export type EmployeeDetail = { name: string; role: string };

export type TripExpenseRow = {
  id: number;
  tripNo: string;
  tripDate: string;
  vehicleId: number | null;
  vehicleNo: string;
  supervisorId: number | null;
  supervisorName: string;
  driverName: string;
  advanceAmount: number;
  meals: number;
  loading: number;
  tiffin: number;
  supervisorPc: number;
  vehicleMaintenance: number;
  vehicleMaintenanceNote: string;
  rto: number;
  others: number;
  diesel: number;
  totalExpense: number;
  remarks: string;
  employeeCount: number;
  employees: EmployeeDetail[];
  dieselBreakdown: DieselDetail[];
  otherBreakdown: ExpenseDetail[];
  expenseBreakdown: ExpenseDetail[];
};

export type TripExpenseResult = {
  data: TripExpenseRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

export type TripExpenseQuery = {
  fromDate?: string;
  toDate?: string;
  vehicleId?: string;
  supervisorId?: string;
  search?: string;
  sortBy?: string;
  sortDir?: string;
  includeMasterBunks?: boolean;
  page?: number;
  limit?: number;
  export?: boolean;
};

const emptyMeta = { total: 0, page: 1, limit: 20, totalPages: 1 };

function asRows(value: unknown): TripExpenseRow[] {
  return Array.isArray(value) ? (value as TripExpenseRow[]) : [];
}

export async function listTripExpenses(params: TripExpenseQuery, signal?: AbortSignal) {
  const { data } = await apiGet<TripExpenseResult>("/operations/expenses", {
    params: {
      fromDate: params.fromDate || undefined,
      toDate: params.toDate || undefined,
      vehicleId: params.vehicleId || undefined,
      supervisorId: params.supervisorId || undefined,
      search: params.search?.trim() || undefined,
      sortBy: params.sortBy || undefined,
      sortDir: params.sortDir === "asc" ? "asc" : "desc",
      includeMasterBunks: params.includeMasterBunks === false ? "false" : "true",
      page: params.export ? undefined : params.page,
      limit: params.export ? undefined : params.limit,
      export: params.export ? "true" : undefined,
    },
    signal,
  });
  return {
    data: asRows(data?.data),
    meta: {
      total: Number(data?.meta?.total) || 0,
      page: Number(data?.meta?.page) || params.page || 1,
      limit: Number(data?.meta?.limit) || params.limit || emptyMeta.limit,
      totalPages: Math.max(1, Number(data?.meta?.totalPages) || 1),
    },
  };
}
