// src/modules/operations/dashboard/hooks/useDashboardData.ts

import { useState, useEffect, useCallback } from "react";
import { subDays, isWithinInterval, startOfDay, endOfDay } from "date-fns";

// ---------- Types (matches KPICards expectations) ----------
export interface DashboardData {
  totalTrips: number;
  totalSalesWeight: number;
  totalSalesAmount: number;
  totalCollections: number;
  pendingCollections: number;
  totalExpenses: number;
  fuelExpense: number;
  tripExpense: number;
  trendData: { date: string; trips: number; weight: number; mortality: number }[];
  topShops: { shopName: string; amount: number }[];
  collectionsByMode: { name: string; value: number }[];
  expensesByCategory: { name: string; value: number }[];
  mortalityData: { date: string; mortality: number }[];
  recentTrips: any[];
  activeVehicles: number;
  activeDrivers: number;
  activeHelpers: number;
  totalShops: number;
  totalFarms: number;
  pendingCollectionsByShop: { shopName: string; pendingAmount: number }[];
  usedVehicles: number;
  usedDrivers: number;
  usedHelpers: number;
  usedShops: number;
  usedFarms: number;
}

const initialData: DashboardData = {
  totalTrips: 0,
  totalSalesWeight: 0,
  totalSalesAmount: 0,
  totalCollections: 0,
  pendingCollections: 0,
  totalExpenses: 0,
  fuelExpense: 0,
  tripExpense: 0,
  trendData: [],
  topShops: [],
  collectionsByMode: [],
  expensesByCategory: [],
  mortalityData: [],
  recentTrips: [],
  activeVehicles: 0,
  activeDrivers: 0,
  activeHelpers: 0,
  totalShops: 0,
  totalFarms: 0,
  pendingCollectionsByShop: [],
  usedVehicles: 0,
  usedDrivers: 0,
  usedHelpers: 0,
  usedShops: 0,
  usedFarms: 0,
};

// ---------- Helper to safely get a number from various field names ----------
const getNumber = (obj: any, fields: string[]): number => {
  for (const f of fields) {
    const val = obj?.[f];
    if (val !== undefined && val !== null && !isNaN(Number(val))) {
      return Number(val);
    }
  }
  return 0;
};

const getDate = (obj: any, fields: string[]): Date | null => {
  for (const f of fields) {
    const val = obj?.[f];
    if (val) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
};

export function useDashboardData(
  fromDate: Date | null,
  toDate: Date | null,
  comparisonPeriod: "7d" | "15d" | "30d"
) {
  const [data, setData] = useState<{ current: DashboardData; previous: DashboardData }>({
    current: initialData,
    previous: initialData,
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(() => {
    if (!fromDate || !toDate) {
      setIsLoading(false);
      return;
    }

    const days = parseInt(comparisonPeriod);
    const currentStart = startOfDay(fromDate);
    const currentEnd = endOfDay(toDate);
    const previousStart = startOfDay(subDays(fromDate, days));
    const previousEnd = endOfDay(subDays(toDate, days));

    try {
      // ---------- Read from localStorage ----------
      const trips = JSON.parse(localStorage.getItem("vehicleTrips") || "[]");
      const sales = JSON.parse(localStorage.getItem("shopSales") || "[]");
      const collections = JSON.parse(localStorage.getItem("dmr-collections") || "[]");
      const fuelExpenses = JSON.parse(localStorage.getItem("dmr-fuel-expenses") || "[]");

      // Master data (active only)
      const allVehicles = JSON.parse(localStorage.getItem("dmr-vehicles") || "[]");
      const allEmployees = JSON.parse(localStorage.getItem("dmr-employees") || "[]");
      const allShops = JSON.parse(localStorage.getItem("dmr-shops") || "[]");
      const allFarms = JSON.parse(localStorage.getItem("dmr-farms") || "[]");

      const vehicles = allVehicles.filter((v: any) => v.status === "Active");
      const employees = allEmployees.filter((e: any) => e.status === "Active");
      const shopsMaster = allShops.filter((s: any) => s.status === "Active");
      const farmsMaster = allFarms.filter((f: any) => f.status === "Active");

      // ---------- Date filter ----------
      const filterByRange = (items: any[], dateFields: string[], start: Date, end: Date) =>
        items.filter((item) => {
          const d = getDate(item, dateFields);
          return d && isWithinInterval(d, { start, end });
        });

      // Current period
      const currentTrips = filterByRange(trips, ["tripDate", "date", "createdAt"], currentStart, currentEnd);
      const currentSales = filterByRange(sales, ["tripDate", "date", "createdAt"], currentStart, currentEnd);
      const currentCollections = filterByRange(collections, ["collectionDate", "date", "createdAt"], currentStart, currentEnd);
      const currentFuel = filterByRange(fuelExpenses, ["date", "createdAt"], currentStart, currentEnd);

      // Previous period
      const prevTrips = filterByRange(trips, ["tripDate", "date", "createdAt"], previousStart, previousEnd);
      const prevSales = filterByRange(sales, ["tripDate", "date", "createdAt"], previousStart, previousEnd);
      const prevCollections = filterByRange(collections, ["collectionDate", "date", "createdAt"], previousStart, previousEnd);
      const prevFuel = filterByRange(fuelExpenses, ["date", "createdAt"], previousStart, previousEnd);

      // ---------- Compute weight (try multiple fields) ----------
      const getTripWeight = (trip: any): number => {
        if (trip.deliveries && Array.isArray(trip.deliveries)) {
          return trip.deliveries.reduce((sum: number, d: any) => sum + getNumber(d, ["weight", "kg"]), 0);
        }
        return getNumber(trip, ["totalWeight", "weight", "kg", "totalKg"]);
      };

      // ---------- Current KPIs ----------
      const totalTrips = currentTrips.length;
      const totalSalesWeight = currentTrips.reduce((sum, t) => sum + getTripWeight(t), 0);
      const totalSalesAmount = currentSales.reduce((sum, s) => sum + getNumber(s, ["amount", "totalAmount", "sales"]), 0);

      const approvedCollections = currentCollections.filter((c: any) => c.status === "Approved");
      const totalCollections = approvedCollections.reduce((sum, c) => sum + getNumber(c, ["amount", "totalAmount"]), 0);

      // Pending collections per shop
      const shopSalesMap = new Map<string, number>();
      currentSales.forEach((s: any) => {
        const name = s.shopName || s.shop || "Unknown";
        shopSalesMap.set(name, (shopSalesMap.get(name) || 0) + getNumber(s, ["amount", "totalAmount"]));
      });
      const shopCollectionsMap = new Map<string, number>();
      approvedCollections.forEach((c: any) => {
        const name = c.shopName || c.shop || "Unknown";
        shopCollectionsMap.set(name, (shopCollectionsMap.get(name) || 0) + getNumber(c, ["amount", "totalAmount"]));
      });
      let pendingTotal = 0;
      shopSalesMap.forEach((salesAmt, shopName) => {
        const collAmt = shopCollectionsMap.get(shopName) || 0;
        const pending = salesAmt - collAmt;
        if (pending > 0) pendingTotal += pending;
      });
      const pendingCollections = pendingTotal;

      // Expenses
      const fuelExpense = currentFuel.reduce((sum, f) => sum + getNumber(f, ["amount", "total"]), 0);
      const tripExpense = currentTrips.reduce((sum, t) => sum + getNumber(t, ["expense", "tripExpense", "totalExpense"]), 0);
      const totalExpenses = fuelExpense + tripExpense;

      // ---------- Trend data (only Completed trips) ----------
      const completedTrips = currentTrips.filter((t: any) => t.status === "Completed");
      const trendMap = new Map<string, { trips: number; weight: number; mortality: number }>();
      completedTrips.forEach((t: any) => {
        const date = getDate(t, ["tripDate", "date"]);
        if (!date) return;
        const key = date.toISOString().split('T')[0];
        if (!trendMap.has(key)) {
          trendMap.set(key, { trips: 0, weight: 0, mortality: 0 });
        }
        const entry = trendMap.get(key)!;
        entry.trips += 1;
        entry.weight += getTripWeight(t);
        entry.mortality += getNumber(t, ["totalMortality", "mortality"]);
      });
      const trendData = Array.from(trendMap.entries())
        .map(([date, vals]) => ({ date, trips: vals.trips, weight: vals.weight, mortality: vals.mortality }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // ---------- Top shops (for reference) ----------
      const topShops = Array.from(shopSalesMap.entries())
        .map(([shopName, amount]) => ({ shopName, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      // Collections by payment mode
      const modeMap = new Map<string, number>();
      approvedCollections.forEach((c: any) => {
        const mode = c.paymentModeName || c.paymentMode || "Other";
        modeMap.set(mode, (modeMap.get(mode) || 0) + getNumber(c, ["amount"]));
      });
      const collectionsByMode = Array.from(modeMap.entries())
        .map(([name, value]) => ({ name, value }));

      // Expenses by category
      const expensesMap = new Map<string, number>();
      currentFuel.forEach((f: any) => {
        const cat = "Fuel";
        expensesMap.set(cat, (expensesMap.get(cat) || 0) + getNumber(f, ["amount"]));
      });
      currentTrips.forEach((t: any) => {
        const cat = "Trip";
        expensesMap.set(cat, (expensesMap.get(cat) || 0) + getNumber(t, ["expense", "tripExpense"]));
      });
      const expensesByCategory = Array.from(expensesMap.entries())
        .map(([name, value]) => ({ name, value }));

      // Mortality data (all trips, not just completed)
      const mortalityMap = new Map<string, number>();
      currentTrips.forEach((t: any) => {
        const date = getDate(t, ["tripDate", "date"]);
        if (!date) return;
        const key = date.toISOString().split('T')[0];
        mortalityMap.set(key, (mortalityMap.get(key) || 0) + getNumber(t, ["totalMortality", "mortality"]));
      });
      const mortalityData = Array.from(mortalityMap.entries())
        .map(([date, mortality]) => ({ date, mortality }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Recent trips (last 5)
      const recentTrips = currentTrips
        .sort((a: any, b: any) => {
          const da = getDate(a, ["createdAt", "tripDate", "date"]);
          const db = getDate(b, ["createdAt", "tripDate", "date"]);
          return (db?.getTime() || 0) - (da?.getTime() || 0);
        })
        .slice(0, 5)
        .map((t: any) => ({
          id: t.id || t._id,
          tripNo: t.tripNo || t.tripNumber,
          vehicleNo: t.vehicleNo || t.vehicleNumber,
          shopName: t.deliveries?.[0]?.shopName || t.sourceFarm || "-",
          weight: getTripWeight(t),
          status: t.status || "Completed",
        }));

      // Pending collections by shop (Top 10)
      const pendingByShop = Array.from(shopSalesMap.entries())
        .map(([shopName, salesAmt]) => {
          const collAmt = shopCollectionsMap.get(shopName) || 0;
          return { shopName, pendingAmount: Math.max(0, salesAmt - collAmt) };
        })
        .filter((item) => item.pendingAmount > 0)
        .sort((a, b) => b.pendingAmount - a.pendingAmount)
        .slice(0, 10);

      // Active master counts
      const activeVehicles = vehicles.length;
      const activeDrivers = employees.filter((e: any) => e.department === "Driver").length;
      const activeHelpers = employees.filter((e: any) => e.department === "Helper").length;
      const totalShops = shopsMaster.length;
      const totalFarms = farmsMaster.length;

      // ---------- Previous period KPIs ----------
      const prevTotalTrips = prevTrips.length;
      const prevTotalWeight = prevTrips.reduce((sum, t) => sum + getTripWeight(t), 0);
      const prevTotalSales = prevSales.reduce((sum, s) => sum + getNumber(s, ["amount", "totalAmount"]), 0);
      const prevApproved = prevCollections.filter((c: any) => c.status === "Approved");
      const prevTotalCollections = prevApproved.reduce((sum, c) => sum + getNumber(c, ["amount"]), 0);

      const prevShopSalesMap = new Map<string, number>();
      prevSales.forEach((s: any) => {
        const name = s.shopName || s.shop || "Unknown";
        prevShopSalesMap.set(name, (prevShopSalesMap.get(name) || 0) + getNumber(s, ["amount"]));
      });
      const prevShopCollectionsMap = new Map<string, number>();
      prevApproved.forEach((c: any) => {
        const name = c.shopName || c.shop || "Unknown";
        prevShopCollectionsMap.set(name, (prevShopCollectionsMap.get(name) || 0) + getNumber(c, ["amount"]));
      });
      let prevPendingTotal = 0;
      prevShopSalesMap.forEach((salesAmt, shopName) => {
        const collAmt = prevShopCollectionsMap.get(shopName) || 0;
        const pending = salesAmt - collAmt;
        if (pending > 0) prevPendingTotal += pending;
      });
      const prevPendingCollections = prevPendingTotal;
      const prevFuelExpense = prevFuel.reduce((sum, f) => sum + getNumber(f, ["amount"]), 0);
      const prevTripExpense = prevTrips.reduce((sum, t) => sum + getNumber(t, ["expense", "tripExpense"]), 0);
      const prevTotalExpenses = prevFuelExpense + prevTripExpense;

      // ---------- Used counts from completed trips ----------
      const usedVehicles = new Set(completedTrips.map((t: any) => t.vehicleNo || t.vehicleNumber).filter(Boolean)).size;
      const usedDrivers = new Set(completedTrips.map((t: any) => t.driverName || t.driver).filter(Boolean)).size;
      const usedHelpers = new Set(
        completedTrips.flatMap((t: any) => t.deliveries?.map((d: any) => d.helperName || d.helper) || [])
          .filter(Boolean)
      ).size;
      const usedShops = new Set(
        completedTrips.flatMap((t: any) => t.deliveries?.map((d: any) => d.shopName || d.shop) || [])
          .filter(Boolean)
      ).size;
      const usedFarms = new Set(
        completedTrips.map((t: any) => t.sourceFarm || t.farmName).filter(Boolean)
      ).size;

      // ---------- Set state ----------
      setData({
        current: {
          totalTrips,
          totalSalesWeight,
          totalSalesAmount,
          totalCollections,
          pendingCollections,
          totalExpenses,
          fuelExpense,
          tripExpense,
          trendData,
          topShops,
          collectionsByMode,
          expensesByCategory,
          mortalityData,
          recentTrips,
          activeVehicles,
          activeDrivers,
          activeHelpers,
          totalShops,
          totalFarms,
          pendingCollectionsByShop: pendingByShop,
          usedVehicles,
          usedDrivers,
          usedHelpers,
          usedShops,
          usedFarms,
        },
        previous: {
          totalTrips: prevTotalTrips,
          totalSalesWeight: prevTotalWeight,
          totalSalesAmount: prevTotalSales,
          totalCollections: prevTotalCollections,
          pendingCollections: prevPendingCollections,
          totalExpenses: prevTotalExpenses,
          fuelExpense: prevFuelExpense,
          tripExpense: prevTripExpense,
          trendData: [],
          topShops: [],
          collectionsByMode: [],
          expensesByCategory: [],
          mortalityData: [],
          recentTrips: [],
          activeVehicles,
          activeDrivers,
          activeHelpers,
          totalShops,
          totalFarms,
          pendingCollectionsByShop: [],
          usedVehicles: 0,
          usedDrivers: 0,
          usedHelpers: 0,
          usedShops: 0,
          usedFarms: 0,
        },
      });
    } catch (error) {
      console.error("Dashboard data error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, comparisonPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    loadData();
  }, [loadData]);

  // ✅ CORRECT EXPORT – returns the hook data
  return { data: data.current, previousData: data.previous, isLoading, refetch };
}