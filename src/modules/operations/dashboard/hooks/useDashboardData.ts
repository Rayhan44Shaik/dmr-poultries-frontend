import { useState, useEffect } from "react";
import { subDays, isWithinInterval, startOfDay, endOfDay } from "date-fns";

interface DashboardData {
  totalTrips: number;
  totalSalesWeight: number;
  totalSalesAmount: number;
  totalCollections: number;
  pendingCollections: number;
  totalExpenses: number;
  trendData: { date: string; trips: number; weight: number }[];
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
}

const initialData: DashboardData = {
  totalTrips: 0,
  totalSalesWeight: 0,
  totalSalesAmount: 0,
  totalCollections: 0,
  pendingCollections: 0,
  totalExpenses: 0,
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
        const vehicles = JSON.parse(localStorage.getItem("vehicles") || "[]");
        const employees = JSON.parse(localStorage.getItem("employees") || "[]");
        const shopsMaster = JSON.parse(localStorage.getItem("shops") || "[]");
        const farmsMaster = JSON.parse(localStorage.getItem("farms") || "[]");

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
        const totalExpenses = currentFuel.reduce((sum: number, f: any) => sum + (f.amount || 0), 0) +
          currentTrips.reduce((sum: number, t: any) => sum + (t.expense || 0), 0);

        // Trend data
        const trendMap = new Map<string, { trips: number; weight: number }>();
        currentTrips.forEach((t: any) => {
          const date = t.tripDate;
          if (!trendMap.has(date)) trendMap.set(date, { trips: 0, weight: 0 });
          const entry = trendMap.get(date)!;
          entry.trips += 1;
          entry.weight += t.totalWeight || 0;
        });
        const trendData = Array.from(trendMap.entries())
          .map(([date, vals]) => ({ date, trips: vals.trips, weight: vals.weight }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // Top 5 shops
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

        // Mortality data
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

        // Active counts
        const activeVehicles = vehicles.filter((v: any) => v.status === "Active").length;
        const activeDrivers = employees.filter((e: any) => e.department === "Driver" && e.status === "Active").length;
        const activeHelpers = employees.filter((e: any) => e.department === "Helper" && e.status === "Active").length;
        const totalShops = shopsMaster.length;
        const totalFarms = farmsMaster.length;

        // --- Previous period KPIs ---
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
        const prevTotalExpenses = prevFuel.reduce((sum: number, f: any) => sum + (f.amount || 0), 0) +
          prevTrips.reduce((sum: number, t: any) => sum + (t.expense || 0), 0);

        setData({
          current: {
            totalTrips,
            totalSalesWeight,
            totalSalesAmount,
            totalCollections,
            pendingCollections,
            totalExpenses,
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
          },
          previous: {
            totalTrips: prevTotalTrips,
            totalSalesWeight: prevTotalSalesWeight,
            totalSalesAmount: prevTotalSalesAmount,
            totalCollections: prevTotalCollections,
            pendingCollections: prevPendingCollections,
            totalExpenses: prevTotalExpenses,
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