import type { FuelExpense } from "../types/fuelExpense";

const STORAGE_KEY = "dmr-fuel-expenses";

// ----- Helpers -----
function getData(): FuelExpense[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveData(expenses: FuelExpense[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

// ----- Generate Bill No -----
function generateBillNo(date: string): string {
  const dateStr = date.replace(/-/g, "");
  const existing = getData().filter((e) => e.date === date);
  const seq = String(existing.length + 1).padStart(3, "0");
  return `BILL-${dateStr}-${seq}`;
}

// ----- CRUD -----
function getAll(): FuelExpense[] {
  return getData();
}

function getById(id: string): FuelExpense | undefined {
  return getData().find((e) => e.id === id);
}

function save(expense: Omit<FuelExpense, "id" | "billNo" | "createdDate" | "createdBy" | "status">): boolean {
  try {
    const all = getData();
    const newExpense: FuelExpense = {
      id: Date.now().toString(),
      billNo: generateBillNo(expense.date),
      ...expense,
      status: "Pending",
      createdDate: new Date().toISOString(),
      createdBy: "Admin",
    };
    all.unshift(newExpense);
    saveData(all);
    return true;
  } catch {
    return false;
  }
}

function update(id: string, updates: Partial<FuelExpense>): boolean {
  const all = getData();
  const index = all.findIndex((e) => e.id === id);
  if (index === -1) return false;
  const existing = all[index];
  if (existing.status === "Approved") return false;
  const created = new Date(existing.createdDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 10) return false;
  all[index] = { ...existing, ...updates, updatedDate: new Date().toISOString() };
  saveData(all);
  return true;
}

function remove(id: string): boolean {
  const all = getData();
  const index = all.findIndex((e) => e.id === id);
  if (index === -1) return false;
  const existing = all[index];
  if (existing.status === "Approved") return false;
  const created = new Date(existing.createdDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 10) return false;
  all.splice(index, 1);
  saveData(all);
  return true;
}

function approve(id: string, approvedBy: string = "Admin"): boolean {
  const all = getData();
  const index = all.findIndex((e) => e.id === id);
  if (index === -1) return false;
  const existing = all[index];
  if (existing.status === "Approved") return false;
  all[index] = {
    ...existing,
    status: "Approved",
    approvedDate: new Date().toISOString(),
    approvedBy,
  };
  saveData(all);
  return true;
}

function getRecent(count: number = 5): FuelExpense[] {
  return getData().sort((a, b) => b.createdDate.localeCompare(a.createdDate)).slice(0, count);
}

// ----- Summary with totals -----
function getSummary() {
  const all = getData();
  return {
    totalLitres: all.reduce((sum, e) => sum + e.litres, 0),
    totalAmount: all.reduce((sum, e) => sum + e.amount, 0),
    pendingCount: all.filter((e) => e.status === "Pending").length,
    approvedCount: all.filter((e) => e.status === "Approved").length,
  };
}

// ✅ NEW: Get latest meter reading for a vehicle
function getLatestMeterReading(vehicleId: number): number {
  const all = getData();
  const filtered = all
    .filter((e) => e.vehicleId === vehicleId)
    .sort((a, b) => b.createdDate.localeCompare(a.createdDate));
  return filtered.length > 0 ? filtered[0].meterReading : 0;
}

// ✅ NEW: Get total mileage (sum of distance covered per vehicle)
function getTotalMileage(): number {
  const all = getData();
  const vehicleMap = new Map<number, { min: number; max: number }>();
  all.forEach((e) => {
    if (!vehicleMap.has(e.vehicleId)) {
      vehicleMap.set(e.vehicleId, { min: e.meterReading, max: e.meterReading });
    } else {
      const entry = vehicleMap.get(e.vehicleId)!;
      if (e.meterReading < entry.min) entry.min = e.meterReading;
      if (e.meterReading > entry.max) entry.max = e.meterReading;
    }
  });
  let total = 0;
  vehicleMap.forEach((v) => {
    total += v.max - v.min;
  });
  return total;
}

export const fuelExpenseService = {
  getAll,
  getById,
  save,
  update,
  remove,
  approve,
  getRecent,
  getSummary,
  getLatestMeterReading,
  getTotalMileage,
};