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

export async function listTripExpenses(params: Record<string, unknown>, signal?: AbortSignal) {
  const { data } = await apiGet<TripExpenseResult>("/operations/expenses", { params, signal });
  return data;
}
