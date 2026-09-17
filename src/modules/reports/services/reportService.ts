import { apiGet } from '../../../api';
import { listTrips } from '../../operations/vehicle-trips/services/tripHeaderApiService';
import { listShopSales } from '../../operations/shop-sales/services/shopSalesApiService';
import { fuelExpenseService } from '../../operations/fuel-expenses/services/fuelExpenseService';
import { maintenanceApi, mapMaintenanceToEvent } from '../../fleet-operations/services/maintenanceApi';
import type { CollectionApiEntry } from '../../operations/collections/types/collection';
import type { MaintenanceEvent } from '../../fleet-operations/types';
import type { ReportFilters, ReportType, ReportData } from '../types/reportTypes';

/**
 * Reports read the same API-backed registers as Operations and Fleet.  Do not
 * read their old localStorage mirrors here: those caches can be empty until a
 * user has visited the source page and therefore made reports disagree with
 * the quarter dataset.
 */

type Row = Record<string, unknown>;

const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const inWindow = (value: unknown, filters: ReportFilters): boolean => {
  const date = String(value ?? '').slice(0, 10);
  return Boolean(date && date >= filters.dateFrom && date <= filters.dateTo);
};

const groupAndSum = (items: Row[], groupKey: string, sumKeys: string[]): Row[] => {
  const grouped = new Map<string, Row>();
  for (const item of items) {
    const key = String(item[groupKey] || 'Unknown');
    const target = grouped.get(key) ?? { [groupKey]: key };
    for (const sumKey of sumKeys) target[sumKey] = safeNumber(target[sumKey]) + safeNumber(item[sumKey]);
    grouped.set(key, target);
  }
  return [...grouped.values()];
};

interface ReportSources {
  trips: Row[];
  sales: Row[];
  collections: CollectionApiEntry[];
  fuel: Row[];
  maintenance: MaintenanceEvent[];
}

async function loadCollections(filters: ReportFilters): Promise<CollectionApiEntry[]> {
  const { data } = await apiGet<CollectionApiEntry[] | { data?: CollectionApiEntry[] }>(
    '/operations/collection-entry',
    { params: { fromDate: filters.dateFrom, toDate: filters.dateTo, includeDeleted: false } },
  );
  return Array.isArray(data) ? data : data.data ?? [];
}

async function loadMaintenance(filters: ReportFilters): Promise<MaintenanceEvent[]> {
  const payload = await maintenanceApi.list({
    fromDate: filters.dateFrom,
    toDate: filters.dateTo,
    includeDeleted: false,
  });
  const rows = Array.isArray(payload) ? payload : (payload as { data?: unknown[] })?.data ?? [];
  return rows.map(mapMaintenanceToEvent);
}

async function loadSources(filters: ReportFilters): Promise<ReportSources> {
  const [trips, sales, collections, fuelResult, maintenance] = await Promise.all([
    listTrips(),
    listShopSales({ fromDate: filters.dateFrom, toDate: filters.dateTo }),
    loadCollections(filters),
    fuelExpenseService.list({ fromDate: filters.dateFrom, toDate: filters.dateTo, page: 1, limit: 10000 }),
    loadMaintenance(filters),
  ]);
  return {
    trips: trips as unknown as Row[],
    sales: sales as unknown as Row[],
    collections,
    fuel: fuelResult.data as unknown as Row[],
    maintenance,
  };
}

function completedTrips(rows: Row[], filters: ReportFilters): Row[] {
  return rows.filter((trip) =>
    inWindow(trip.tripDate, filters) &&
    String(trip.status).toLowerCase() === 'completed' &&
    trip.deleted !== true
  );
}

function approvedCollections(rows: CollectionApiEntry[]): CollectionApiEntry[] {
  return rows.filter((row) => row.status === 'Approved' && !row.deleted && row.isFinancial !== false);
}

function computeWeeklyReport(sources: ReportSources, filters: ReportFilters): ReportData {
  const trips = completedTrips(sources.trips, filters);
  const sales = sources.sales.filter((sale) => inWindow(sale.saleDate ?? sale.tripDate, filters));
  const collections = approvedCollections(sources.collections).filter((row) => inWindow(row.collectionDate, filters));
  const fuel = sources.fuel.filter((row) => inWindow(row.date ?? row.billDate, filters));
  const maintenance = sources.maintenance.filter((row) => inWindow(row.date, filters) && !row.deletedAt);

  const totalSales = sales.reduce((sum, row) => sum + safeNumber(row.amount), 0);
  const totalCollections = collections.reduce((sum, row) => sum + safeNumber(row.amountCollected ?? row.amount), 0);
  const fuelExpense = fuel.reduce((sum, row) => sum + safeNumber(row.amount), 0);
  const maintenanceExpense = maintenance.reduce((sum, row) => sum + safeNumber(row.totalCost), 0);
  const otherTripExpense = trips.reduce((sum, row) => sum + safeNumber(row.expense), 0);
  const totalExpenses = fuelExpense + maintenanceExpense + otherTripExpense;
  const totalBirds = trips.reduce((sum, row) => sum + safeNumber(row.totalBirds), 0);
  const totalWeight = trips.reduce((sum, row) => sum + safeNumber(row.totalWeight ?? row.farmWeight), 0);
  const mortality = trips.reduce((sum, row) => sum + safeNumber(row.totalMortality), 0);

  return {
    title: 'Weekly Report',
    summary: {
      'Total Trips': trips.length,
      'Total Birds': totalBirds,
      'Total Weight (KG)': totalWeight,
      'Total Mortality': mortality,
      'Total Sales': totalSales,
      'Total Collections': totalCollections,
      'Outstanding': totalSales - totalCollections,
      'Fuel Expense': fuelExpense,
      'Maintenance Expense': maintenanceExpense,
      'Total Expenses': totalExpenses,
      'Operating Result': totalSales - totalExpenses,
    },
    details: trips.map((trip) => ({
      tripNo: trip.tripNo || 'N/A',
      date: trip.tripDate || 'N/A',
      vehicle: trip.vehicleNo || 'N/A',
      shops: safeNumber(trip.totalShops),
      birds: safeNumber(trip.totalBirds),
      weight: safeNumber(trip.totalWeight ?? trip.farmWeight),
      mortality: safeNumber(trip.totalMortality),
      expense: safeNumber(trip.expense),
    })),
    total: {
      trips: trips.length,
      birds: totalBirds,
      weight: totalWeight,
      mortality,
      sales: totalSales,
      collections: totalCollections,
      expenses: totalExpenses,
      profit: totalSales - totalExpenses,
    },
    isEmpty: trips.length === 0 && sales.length === 0 && collections.length === 0,
  };
}

function computeShopSalesReport(sources: ReportSources, filters: ReportFilters): ReportData {
  let sales = sources.sales.filter((sale) => inWindow(sale.saleDate ?? sale.tripDate, filters));
  if (filters.shop && filters.shop !== 'All Shops') sales = sales.filter((sale) => sale.shopName === filters.shop);
  const groups = groupAndSum(sales, 'shopName', ['amount', 'birds', 'weight', 'boxes']);
  const topShops = [...groups].sort((a, b) => safeNumber(b.amount) - safeNumber(a.amount)).slice(0, 5);
  const total = (field: string) => groups.reduce((sum, row) => sum + safeNumber(row[field]), 0);
  return {
    title: 'Shop Sales Report',
    summary: groups.length ? {
      'Total Shops': groups.length,
      'Sale Lines': sales.length,
      'Total Sales': total('amount'),
      'Total Birds': total('birds'),
      'Total Weight (KG)': total('weight'),
    } : {},
    details: groups,
    total: { shops: groups.length, amount: total('amount'), birds: total('birds'), weight: total('weight'), boxes: total('boxes') },
    charts: topShops.map((row) => ({ name: String(row.shopName), value: safeNumber(row.amount) })),
    isEmpty: groups.length === 0,
  };
}

function computeExpensesReport(sources: ReportSources, filters: ReportFilters): ReportData {
  const fuel = sources.fuel
    .filter((row) => inWindow(row.date ?? row.billDate, filters))
    .reduce((sum, row) => sum + safeNumber(row.amount), 0);
  const maintenance = sources.maintenance
    .filter((row) => inWindow(row.date, filters) && !row.deletedAt)
    .reduce((sum, row) => sum + safeNumber(row.totalCost), 0);
  const tripOther = completedTrips(sources.trips, filters).reduce((sum, row) => sum + safeNumber(row.expense), 0);
  const details = [
    { category: 'Fuel', amount: fuel },
    { category: 'Maintenance', amount: maintenance },
    { category: 'Trip / Other', amount: tripOther },
  ];
  const total = details.reduce((sum, row) => sum + row.amount, 0);
  return {
    title: 'Expenses Report',
    summary: total ? { 'Total Expense': total, 'Fuel Expense': fuel, 'Maintenance Expense': maintenance, 'Trip / Other Expense': tripOther } : {},
    details,
    total: { total },
    isEmpty: total === 0,
  };
}

/** Load and derive a report from the live registers used by Operations. */
export async function getReportData(type: ReportType, filters: ReportFilters): Promise<ReportData | null> {
  if (type === 'shopLedger' || type === 'vehicle') return null;
  const sources = await loadSources(filters);
  switch (type) {
    case 'weekly': return computeWeeklyReport(sources, filters);
    case 'shopSales': return computeShopSalesReport(sources, filters);
    case 'expenses': return computeExpensesReport(sources, filters);
    default: return null;
  }
}
