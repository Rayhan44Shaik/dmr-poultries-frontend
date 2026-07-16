import { useState, useEffect } from "react";
import { subDays, isWithinInterval, startOfDay, endOfDay } from "date-fns";

interface DashboardData {
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

  useEffect(() => {
    if (!fromDate || !toDate) {
      setIsLoading(false);
      return;
    }

    const days = parseInt(comparisonPeriod);
    const currentStart = startOfDay(fromDate);
    const currentEnd = endOfDay(toDate);
    const previousStart = startOfDay(subDays(fromDate, days));
    const previousEnd = endOfDay(subDays(toDate, days));

    const loadData = () => {
      try {
        const trips = JSON.parse(localStorage.getItem("vehicleTrips") || "[]");
        const sales = JSON.parse(localStorage.getItem("shopSales") || "[]");
        const collections = JSON.parse(localStorage.getItem("dmr-collections") || "[]");
        const fuelExpenses = JSON.parse(localStorage.getItem("dmr-fuel-expenses") || "[]");

        // ✅ READ FROM CORRECT MASTER KEYS AND FILTER ACTIVE
        const allVehicles = JSON.parse(localStorage.getItem("dmr-vehicles") || "[]");
        const allEmployees = JSON.parse(localStorage.getItem("dmr-employees") || "[]");
        const allShops = JSON.parse(localStorage.getItem("dmr-shops") || "[]");
        const allFarms = JSON.parse(localStorage.getItem("dmr-farms") || "[]");

        const vehicles = allVehicles.filter((v: any) => v.status === "Active");
        const employees = allEmployees.filter((e: any) => e.status === "Active");
        const shopsMaster = allShops.filter((s: any) => s.status === "Active");
        const farmsMaster = allFarms.filter((f: any) => f.status === "Active");

        const filterByRange = (items: any[], dateField: string, start: Date, end: Date) =>
          items.filter((item: any) => {
            const d = new Date(item[dateField]);
            return isWithinInterval(d, { start, end });
          });

        // Current period
        const currentTrips = filterByRange(trips, "tripDate", currentStart, currentEnd);
        const currentSales = filterByRange(sales, "tripDate", currentStart, currentEnd);
        const currentCollections = filterByRange(collections, "collectionDate", currentStart, currentEnd);
        const currentFuel = filterByRange(fuelExpenses, "date", currentStart, currentEnd);

        // Previous period
        const prevTrips = filterByRange(trips, "tripDate", previousStart, previousEnd);
        const prevSales = filterByRange(sales, "tripDate", previousStart, previousEnd);
        const prevCollections = filterByRange(collections, "collectionDate", previousStart, previousEnd);
        const prevFuel = filterByRange(fuelExpenses, "date", previousStart, previousEnd);

        // ✅ ONLY Completed trips for used counts
        const completedTrips = currentTrips.filter((t: any) => t.status === "Completed");

        // --- Used counts from COMPLETED trips only ---
        const usedVehicles = new Set(
          completedTrips.map((t: any) => t.vehicleNo || t.vehicleNumber).filter(Boolean)
        ).size;
        const usedDrivers = new Set(
          completedTrips.map((t: any) => t.driverName || t.driver).filter(Boolean)
        ).size;
        const usedHelpers = new Set(
          completedTrips.flatMap((t: any) => t.deliveries?.map((d: any) => d.helperName || d.helper) || [])
            .filter(Boolean)
        ).size;
        const usedShops = new Set(
          completedTrips.flatMap((t: any) => t.deliveries?.map((d: any) => d.shopName || d.shop) || [])
            .filter(Boolean)
        ).size;
        const usedFarms = new Set(
          completedTrips.map((t: any) => t.sourceFarm || t.farmName || t.farm).filter(Boolean)
        ).size;

        // --- Current KPIs ---
        const totalTrips = currentTrips.length;
        const totalSalesWeight = currentTrips.reduce((sum: number, t: any) => sum + (t.totalWeight || 0), 0);
        const totalSalesAmount = currentSales.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
        const approvedCollections = currentCollections.filter((c: any) => c.status === "Approved");
        const totalCollections = approvedCollections.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);

        // Pending collections
        const shopSalesMap = new Map<string, number>();
        currentSales.forEach((s: any) => {
          if (!shopSalesMap.has(s.shopName)) shopSalesMap.set(s.shopName, 0);
          shopSalesMap.set(s.shopName, shopSalesMap.get(s.shopName)! + s.amount);
        });
        const shopCollectionsMap = new Map<string, number>();
        approvedCollections.forEach((c: any) => {
          if (!shopCollectionsMap.has(c.shopName)) shopCollectionsMap.set(c.shopName, 0);
          shopCollectionsMap.set(c.shopName, shopCollectionsMap.get(c.shopName)! + c.amount);
        });
        let pendingTotal = 0;
        shopSalesMap.forEach((salesAmt, shopName) => {
          const collAmt = shopCollectionsMap.get(shopName) || 0;
          const pending = salesAmt - collAmt;
          if (pending > 0) pendingTotal += pending;
        });
        const pendingCollections = pendingTotal;

        // Separate fuel and trip expenses
        const fuelExpense = currentFuel.reduce((sum: number, f: any) => sum + (f.amount || 0), 0);
        const tripExpense = currentTrips.reduce((sum: number, t: any) => sum + (t.expense || 0), 0);
        const totalExpenses = fuelExpense + tripExpense;

        // ---- TREND DATA – only COMPLETED trips ----
        const completedForTrend = currentTrips.filter((t: any) => t.status === "Completed");
        const trendMap = new Map<string, { trips: number; weight: number; mortality: number }>();
        completedForTrend.forEach((t: any) => {
          const date = t.tripDate;
          if (!trendMap.has(date)) {
            trendMap.set(date, { trips: 0, weight: 0, mortality: 0 });
          }
          const entry = trendMap.get(date)!;
          entry.trips += 1;
          entry.weight += t.totalWeight || 0;
          entry.mortality += t.totalMortality || 0;
        });
        const trendData = Array.from(trendMap.entries())
          .map(([date, vals]) => ({
            date,
            trips: vals.trips,
            weight: vals.weight,
            mortality: vals.mortality,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // Top 5 shops (kept for consistency)
        const shopSalesAgg = new Map<string, number>();
        currentSales.forEach((s: any) => {
          if (!shopSalesAgg.has(s.shopName)) shopSalesAgg.set(s.shopName, 0);
          shopSalesAgg.set(s.shopName, shopSalesAgg.get(s.shopName)! + s.amount);
        });
        const topShops = Array.from(shopSalesAgg.entries())
          .map(([shopName, amount]) => ({ shopName, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5);

        // Collections by mode
        const modeMap = new Map<string, number>();
        approvedCollections.forEach((c: any) => {
          const mode = c.paymentModeName || "Other";
          if (!modeMap.has(mode)) modeMap.set(mode, 0);
          modeMap.set(mode, modeMap.get(mode)! + c.amount);
        });
        const collectionsByMode = Array.from(modeMap.entries())
          .map(([name, value]) => ({ name, value }));

        // Expenses by category
        const expensesMap = new Map<string, number>();
        currentFuel.forEach((f: any) => {
          const cat = "Fuel";
          if (!expensesMap.has(cat)) expensesMap.set(cat, 0);
          expensesMap.set(cat, expensesMap.get(cat)! + f.amount);
        });
        currentTrips.forEach((t: any) => {
          const cat = "Trip";
          if (!expensesMap.has(cat)) expensesMap.set(cat, 0);
          expensesMap.set(cat, expensesMap.get(cat)! + (t.expense || 0));
        });
        const expensesByCategory = Array.from(expensesMap.entries())
          .map(([name, value]) => ({ name, value }));

        // Mortality data (kept for reference)
        const mortalityMap = new Map<string, number>();
        currentTrips.forEach((t: any) => {
          const date = t.tripDate;
          if (!mortalityMap.has(date)) mortalityMap.set(date, 0);
          mortalityMap.set(date, mortalityMap.get(date)! + (t.totalMortality || 0));
        });
        const mortalityData = Array.from(mortalityMap.entries())
          .map(([date, mortality]) => ({ date, mortality }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // Recent trips (last 5)
        const recentTrips = currentTrips
          .sort((a: any, b: any) => new Date(b.createdAt || b.tripDate).getTime() - new Date(a.createdAt || a.tripDate).getTime())
          .slice(0, 5)
          .map((t: any) => ({
            id: t.id,
            tripNo: t.tripNo,
            vehicleNo: t.vehicleNo,
            shopName: t.deliveries?.[0]?.shopName || t.sourceFarm || "-",
            weight: t.totalWeight || 0,
            status: t.status || "Completed",
          }));

        // Pending collections by shop (Top 10)
        const pendingByShop = Array.from(shopSalesMap.entries())
          .map(([shopName, salesAmt]) => {
            const collAmt = shopCollectionsMap.get(shopName) || 0;
            const pending = salesAmt - collAmt;
            return { shopName, pendingAmount: Math.max(0, pending) };
          })
          .filter((item) => item.pendingAmount > 0)
          .sort((a, b) => b.pendingAmount - a.pendingAmount)
          .slice(0, 10);

        // ✅ Active counts from filtered master data
        const activeVehicles = vehicles.length;
        const activeDrivers = employees.filter((e: any) => e.department === "Driver").length;
        const activeHelpers = employees.filter((e: any) => e.department === "Helper").length;
        const totalShops = shopsMaster.length;
        const totalFarms = farmsMaster.length;

        // --- Previous period KPIs (for trends) ---
        const prevTotalTrips = prevTrips.length;
        const prevTotalSalesWeight = prevTrips.reduce((sum: number, t: any) => sum + (t.totalWeight || 0), 0);
        const prevTotalSalesAmount = prevSales.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
        const prevApproved = prevCollections.filter((c: any) => c.status === "Approved");
        const prevTotalCollections = prevApproved.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);

        const prevShopSalesMap = new Map<string, number>();
        prevSales.forEach((s: any) => {
          if (!prevShopSalesMap.has(s.shopName)) prevShopSalesMap.set(s.shopName, 0);
          prevShopSalesMap.set(s.shopName, prevShopSalesMap.get(s.shopName)! + s.amount);
        });
        const prevShopCollectionsMap = new Map<string, number>();
        prevApproved.forEach((c: any) => {
          if (!prevShopCollectionsMap.has(c.shopName)) prevShopCollectionsMap.set(c.shopName, 0);
          prevShopCollectionsMap.set(c.shopName, prevShopCollectionsMap.get(c.shopName)! + c.amount);
        });
        let prevPendingTotal = 0;
        prevShopSalesMap.forEach((salesAmt, shopName) => {
          const collAmt = prevShopCollectionsMap.get(shopName) || 0;
          const pending = salesAmt - collAmt;
          if (pending > 0) prevPendingTotal += pending;
        });
        const prevPendingCollections = prevPendingTotal;
        const prevFuelExpense = prevFuel.reduce((sum: number, f: any) => sum + (f.amount || 0), 0);
        const prevTripExpense = prevTrips.reduce((sum: number, t: any) => sum + (t.expense || 0), 0);
        const prevTotalExpenses = prevFuelExpense + prevTripExpense;

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
            totalSalesWeight: prevTotalSalesWeight,
            totalSalesAmount: prevTotalSalesAmount,
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
    };

    loadData();
  }, [fromDate, toDate, comparisonPeriod]);

  return { data: data.current, previousData: data.previous, isLoading };
}