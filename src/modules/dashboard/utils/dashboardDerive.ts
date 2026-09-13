// src/modules/dashboard/utils/dashboardDerive.ts
// Pure derivation of every dashboard view from the aggregated rows.
// No side effects — easy to reuse from any client (web / mobile).

import type { LucideIcon } from "lucide-react";
import { toBusinessDate } from '../../../utils/businessDate';
import {
  Bird,
  CreditCard,
  IndianRupee,
  Sprout,
  Store,
  TrendingUp,
  TrendingDown,
  Truck,
  Users,
  Weight,
  Scale,
  Wallet,
  Hourglass,
  ReceiptText,
  ShoppingBag
} from "lucide-react";
import { getDateRanges } from "./dashboardDates";
import { PeriodId } from "../components/DashboardFilters";
import type { DashboardData, VehicleRow } from "../services/dashboardService";
import type { Trip } from "../../operations/vehicle-trips/types/trip";
import { getMaintenance } from "../../fleet-operations/services/storage";
import { formatINR, formatINRCompact, formatNumber, formatWeight } from "../../../utils/format";
import { translate } from "../../../i18n";

export interface KpiDatum {
  key: string;
  label: string;
  value: string;
  sub: string;
  delta: number | null;
  trend: "up" | "down" | "flat";
  icon: LucideIcon;
  tone: "brand" | "sky" | "amber" | "rose" | "violet" | "slate" | "emerald" | "teal";
  spark: { x: string; y: number }[];
}

export interface TripView {
  tripNo: string;
  vehicle: string;
  driver: string;
  supervisor: string;
  farm: string;
  shop: string;
  birds: number;
  weight: number;
  status: Trip["status"];
}

export interface FleetVehicleView {
  id: number;
  number: string;
  type: string;
  status: "On Trip" | "Available" | "Inactive";
  driver: string;
  currentTrip: string;
  fuel: number;
  /** Latest known odometer reading (from the most recent trip), null if unknown. */
  km: number | null;
  maintenanceNote: string;
  insuranceExpiry: string;
  permitExpiry: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  time: string;
  tone: "brand" | "sky" | "amber" | "rose" | "violet" | "slate";
  icon: LucideIcon;
}

export interface DerivedDashboard {
  kpis: KpiDatum[];
  salesVsCollections: { date: string; sales: number; collections: number }[];
  weeklyRevenue: { day: string; revenue: number }[];
  deliveryVolume: { date: string; birds: number; weight: number }[];
  vehicleActivity: { name: string; value: number; color: string }[];
  todayTrips: TripView[];
  latestTrips: TripView[];
  pendingCollections: DashboardData["pendingCollections"];
  fleet: FleetVehicleView[];
  activity: ActivityItem[];
  hasAnyData: boolean;
  totals: {
    pendingAmount: number;
    overdueCount: number;
    todaySales: number;
    todayCollections: number;
    todayProfit: number;
    todayBirds: number;
    todayWeight: number;
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function todayIso(): string {
  return toBusinessDate(new Date());
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function sum(arr: number[]): number {
  return arr.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/* ------------------------------------------------------------------ */
/*  Main derivation                                                    */
/* ------------------------------------------------------------------ */
const getT = (t?: (key: string, params?: Record<string, string | number>) => string) => t ?? translate;

export function deriveDashboard(
  data: DashboardData,
  t?: (key: string, params?: Record<string, string | number>) => string,
  filterOpts?: {
    period: PeriodId;
    comparePrevious: boolean;
    customStart: string;
    customEnd: string;
  }
): DerivedDashboard {
  const tFunc = getT(t);
  const today = todayIso();
  const yesterday = isoDaysAgo(1);

  const period = filterOpts?.period || 'week';
  const { start, end, prevStart, prevEnd } = getDateRanges(period, filterOpts?.customStart || '', filterOpts?.customEnd || '');
  
  const inRange = (dStr: string, s: Date, e: Date) => {
    const d = new Date(dStr);
    return d >= s && d <= e;
  };

  const currTrips = data.trips.filter(t => inRange(t.tripDate, start, end));
  const currSales = sum(data.shopSales.filter(s => inRange(s.tripDate, start, end)).map(s => Number(s.amount) || 0));
  const currCollections = sum(data.collections.filter(c => inRange(c.collectionDate, start, end)).map(c => Number(c.amount) || 0));
  const currFuel = sum(data.fuelExpenses.filter(f => inRange(f.date, start, end)).map(f => Number(f.amount) || 0));
  const currTripExp = sum(currTrips.map(t => Number(t.expense) || 0));
  const currExpenses = currFuel + currTripExp;
  const currBirds = sum(data.shopSales.filter(s => inRange(s.tripDate, start, end)).map(s => Number(s.totalBirds) || 0));
  const currWeight = sum(data.shopSales.filter(s => inRange(s.tripDate, start, end)).map(s => Number(s.totalWeight) || 0));
  const currPending = sum(data.pendingCollections.map(p => Number(p.currentPending) || 0));

  const prevTrips = data.trips.filter(t => inRange(t.tripDate, prevStart, prevEnd));
  const prevSales = sum(data.shopSales.filter(s => inRange(s.tripDate, prevStart, prevEnd)).map(s => Number(s.amount) || 0));
  const prevCollections = sum(data.collections.filter(c => inRange(c.collectionDate, prevStart, prevEnd)).map(c => Number(c.amount) || 0));
  const prevFuel = sum(data.fuelExpenses.filter(f => inRange(f.date, prevStart, prevEnd)).map(f => Number(f.amount) || 0));
  const prevTripExp = sum(prevTrips.map(t => Number(t.expense) || 0));
  const prevExpenses = prevFuel + prevTripExp;
  const prevBirds = sum(data.shopSales.filter(s => inRange(s.tripDate, prevStart, prevEnd)).map(s => Number(s.totalBirds) || 0));
  const prevWeight = sum(data.shopSales.filter(s => inRange(s.tripDate, prevStart, prevEnd)).map(s => Number(s.totalWeight) || 0));
  
  const doCompare = filterOpts?.comparePrevious;
  const getTrend = (curr: number, prev: number) => curr >= prev ? "up" : "down";
  const daysDiff = Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
  const periodStr = `${daysDiff}d`;


  const todaySales = sum(data.shopSales.filter((s) => s.tripDate === today).map((s) => Number(s.amount) || 0));
  const yesterdaySales = sum(data.shopSales.filter((s) => s.tripDate === yesterday).map((s) => Number(s.amount) || 0));
  const todayCollections = sum(data.collections.filter((c) => c.collectionDate === today).map((c) => Number(c.amount) || 0));
  const yesterdayCollections = sum(data.collections.filter((c) => c.collectionDate === yesterday).map((c) => Number(c.amount) || 0));
  const todayFuel = sum(data.fuelExpenses.filter((f) => f.date === today).map((f) => Number(f.amount) || 0));
  const todayTripExpense = sum(data.trips.filter((t) => t.tripDate === today).map((t) => Number(t.expense) || 0));
  const yesterdayFuel = sum(data.fuelExpenses.filter((f) => f.date === yesterday).map((f) => Number(f.amount) || 0));
  const yesterdayTripExpense = sum(data.trips.filter((t) => t.tripDate === yesterday).map((t) => Number(t.expense) || 0));
  const todayProfit = todaySales - todayFuel - todayTripExpense;
  const yesterdayProfit = yesterdaySales - yesterdayFuel - yesterdayTripExpense;

  const pendingAmount = sum(data.pendingCollections.map((p) => Number(p.currentPending) || 0));
  const overdueCount = data.pendingCollections.filter((p) => Number(p.overdueDays) > 0).length;

  const activeShops = data.shops.filter((s) => s.status === "Active").length;
  const activeFarms = data.farms.filter((f) => f.status === "Active").length;
  const activeVehicles = data.vehicles.filter((v) => v.status === "Active").length;
  const activeEmployees = data.employees.filter((e) => e.status === "Active").length;

  /* ----- 7-day series ----- */
  const series = Array.from({ length: 7 }, (_, i) => {
    const date = isoDaysAgo(6 - i);
    const sales = sum(data.shopSales.filter((s) => s.tripDate === date).map((s) => Number(s.amount) || 0));
    const collections = sum(data.collections.filter((c) => c.collectionDate === date).map((c) => Number(c.amount) || 0));
    const birds = sum(data.shopSales.filter((s) => s.tripDate === date).map((s) => Number(s.totalBirds) || 0));
    const weight = sum(data.shopSales.filter((s) => s.tripDate === date).map((s) => Number(s.totalWeight) || 0));
    const fuel = sum(data.fuelExpenses.filter((f) => f.date === date).map((f) => Number(f.amount) || 0));
    const tripExpense = sum(data.trips.filter((t) => t.tripDate === date).map((t) => Number(t.expense) || 0));
    const label = new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" });
    return { date: label, iso: date, sales, collections, birds, weight, expenses: fuel + tripExpense };
  });

  const salesVsCollections = series.map((s) => ({
    date: s.date,
    sales: Math.round(s.sales),
    collections: Math.round(s.collections),
  }));
  const weeklyRevenue = series.map((s) => ({ day: s.date, revenue: Math.round(s.sales) }));
  const deliveryVolume = series.map((s) => ({ date: s.date, birds: s.birds, weight: Math.round(s.weight * 10) / 10 }));

  /* ----- Today's trips ----- */
  const todaysTrips = data.trips.filter((t) => t.tripDate === today);
  const latestTrips = todaysTrips.length > 0 ? todaysTrips : data.trips.slice(0, 5);

  const toTripView = (t: Trip): TripView => ({
    tripNo: t.tripNo || "—",
    vehicle: t.vehicleNo || "—",
    driver: t.driverName || "—",
    supervisor: t.supervisorName || "—",
    farm: t.sourceFarm || "—",
    shop: t.deliveries?.[0]?.shopName || t.lastShop || "—",
    birds: t.totalBirdsDelivered || t.totalBirds || t.birds || 0,
    weight: t.totalDeliveredWeight || t.totalWeight || t.weight || 0,
    status: t.status,
  });

  const tripViews = (latestTrips.length > 0 ? latestTrips : []).map(toTripView);
  const todayTripViews = todaysTrips.map(toTripView);

  /* ----- Fleet status ----- */
  const todayPendingTrips = data.trips.filter((t) => t.tripDate === today && (t.status === "Pending" || t.status === "Draft"));
  const maintenanceRecords = (() => {
    try {
      return getMaintenance() as unknown[];
    } catch {
      return [];
    }
  })();

  const fleet: FleetVehicleView[] = data.vehicles.map((v) => {
    const vehicleTrips = data.trips.filter((t) => t.vehicleNo === v.number);
    const latestTrip = vehicleTrips.sort((a, b) => b.tripDate.localeCompare(a.tripDate))[0];
    const onTrip = todayPendingTrips.find((t) => t.vehicleNo === v.number);
    const recentMaintenance = maintenanceRecords
      .map((m) => m as { vehicleId?: string | number; vehicleNo?: string; date?: string; nextServiceKM?: number })
      .filter((m) => String(m.vehicleId ?? "") === String(v.id) || m.vehicleNo === v.number)
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
    const fuelRecords = data.fuelExpenses.filter((f) => f.vehicleNo === v.number);
    const lastFuel = fuelRecords.sort((a, b) => b.date.localeCompare(a.date))[0];

    // Status follows the real backend contract — the vehicle master record
    // only persists Active/Inactive (no persisted "Maintenance" state):
    //  · Inactive  → master record status "Inactive"
    //  · On Trip   → master status Active + a current active trip
    //  · Available → master status Active + no current active trip
    // Service due and recent servicing are alerts/info, never a status.
    const status: FleetVehicleView["status"] =
      v.status === "Inactive" ? "Inactive" : onTrip ? "On Trip" : "Available";

    const lastMeter = latestTrip
      ? Number(latestTrip.closingMeter) || Number(latestTrip.openingMeter) + Number(latestTrip.totalKm) || null
      : null;

    return {
      id: v.id,
      number: v.number,
      type: v.type,
      status,
      driver: latestTrip?.driverName || "—",
      currentTrip: onTrip?.tripNo || "",
      fuel: lastFuel ? Number(lastFuel.amount) || 0 : 0,
      km: lastMeter,
      maintenanceNote: recentMaintenance ? `Next service ${recentMaintenance.nextServiceKM ? `${recentMaintenance.nextServiceKM} km` : "due"}` : "No open issues",
      insuranceExpiry: v.insuranceExpiry,
      permitExpiry: v.permitExpiry,
    };
  });

  const vehicleActivity = (["On Trip", "Available", "Inactive"] as const).map((status, i) => ({
    name: status,
    value: fleet.filter((f) => f.status === status).length,
    color: ["#059669", "#0ea5e9", "#94a3b8"][i],
  }));

  /* ----- Activity timeline ----- */
  const activity: ActivityItem[] = [];

  data.trips
    .filter((t) => t.tripDate === today && t.status === "Completed")
    .slice(0, 3)
    .forEach((t) => {
      activity.push({
        id: `trip-${t.tripNo}`,
        title: tFunc("dashboard.activity.delivery_completed", { tripNo: t.tripNo }),
        description: tFunc("dashboard.activity.delivery_desc", {
          vehicle: t.vehicleNo,
          count: t.deliveries?.length ?? 0,
          weight: formatWeight(t.totalDeliveredWeight || 0),
        }),
        time: tFunc("time.today"),
        tone: "brand",
        icon: Truck,
      });
    });

  data.collections
    .filter((c) => c.collectionDate === today)
    .slice(0, 3)
    .forEach((c) => {
      activity.push({
        id: `col-${c.collectionNo}`,
        title: tFunc("dashboard.activity.collection_received", { shopName: c.shopName }),
        description: tFunc("dashboard.activity.collection_desc", {
          amount: formatINR(Number(c.amount) || 0),
          paymentMode: c.paymentModeName,
        }),
        time: tFunc("time.today"),
        tone: "sky",
        icon: CreditCard,
      });
    });

  data.fuelExpenses
    .filter((f) => f.date === today)
    .slice(0, 2)
    .forEach((f) => {
      activity.push({
        id: `fuel-${f.billNo}`,
        title: tFunc("dashboard.activity.fuel_entry", { billNo: f.billNo }),
        description: tFunc("dashboard.activity.fuel_desc", {
          vehicle: f.vehicleNo,
          litres: f.litres,
          amount: formatINR(Number(f.amount) || 0),
        }),
        time: tFunc("time.today"),
        tone: "amber",
        icon: Bird,
      });
    });

  (maintenanceRecords as { vehicleNo?: string; date?: string; totalCost?: number }[])
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, 2)
    .forEach((m) => {
      activity.push({
        id: `maint-${m.vehicleNo}-${m.date}`,
        title: tFunc("dashboard.activity.maintenance_completed", { vehicleNo: m.vehicleNo ?? tFunc("common.vehicle") }),
        description: tFunc("dashboard.activity.maintenance_desc", { amount: formatINR(Number(m.totalCost) || 0) }),
        time: m.date ?? "",
        tone: "violet",
        icon: Truck,
      });
    });

  activity.sort((a, b) => b.time.localeCompare(a.time));

  /* ----- KPIs ----- */
  const kpis: KpiDatum[] = [
    {
      key: "trips",
      label: tFunc("dashboard.kpi.trips") || "Trips",
      value: formatNumber(currTrips.length),
      sub: doCompare ? periodStr : "",
      delta: doCompare ? pctChange(currTrips.length, prevTrips.length) : null,
      trend: getTrend(currTrips.length, prevTrips.length),
      icon: Truck,
      tone: "emerald",
      spark: []
    },
    {
      key: "birds",
      label: tFunc("dashboard.kpi.birds") || "Birds",
      value: formatNumber(currBirds),
      sub: doCompare ? periodStr : "",
      delta: doCompare ? pctChange(currBirds, prevBirds) : null,
      trend: getTrend(currBirds, prevBirds),
      icon: Bird,
      tone: "amber",
      spark: []
    },
    {
      key: "weight",
      label: tFunc("dashboard.kpi.weight") || "Weight (Kg)",
      value: formatNumber(currWeight),
      sub: doCompare ? periodStr : "",
      delta: doCompare ? pctChange(currWeight, prevWeight) : null,
      trend: getTrend(currWeight, prevWeight),
      icon: ShoppingBag,
      tone: "emerald",
      spark: []
    },
    {
      key: "sales",
      label: tFunc("dashboard.kpi.sales") || "Amount",
      value: formatINRCompact(currSales),
      sub: doCompare ? periodStr : "",
      delta: doCompare ? pctChange(currSales, prevSales) : null,
      trend: getTrend(currSales, prevSales),
      icon: IndianRupee,
      tone: "violet",
      spark: []
    },
    {
      key: "pending",
      label: tFunc("dashboard.kpi.pending") || "Pending",
      value: formatINRCompact(currPending),
      sub: doCompare ? periodStr : "",
      delta: doCompare ? 0 : null,
      trend: "flat",
      icon: Hourglass,
      tone: "sky",
      spark: []
    },
    {
      key: "collections",
      label: tFunc("dashboard.kpi.today_collections") || "Collections",
      value: formatINRCompact(currCollections),
      sub: doCompare ? periodStr : "",
      delta: doCompare ? pctChange(currCollections, prevCollections) : null,
      trend: getTrend(currCollections, prevCollections),
      icon: Wallet,
      tone: "amber",
      spark: []
    },
    {
      key: "expenses",
      label: tFunc("dashboard.kpi.expenses") || "Expenses",
      value: formatINRCompact(currExpenses),
      sub: doCompare ? periodStr : "",
      delta: doCompare ? pctChange(currExpenses, prevExpenses) : null,
      trend: currExpenses <= prevExpenses ? "up" : "down",
      icon: ReceiptText,
      tone: "rose",
      spark: []
    }
  ];

  const hasAnyData =
    data.trips.length > 0 ||
    data.collections.length > 0 ||
    data.shopSales.length > 0 ||
    data.shops.length > 0 ||
    data.vehicles.length > 0;

  return {
    kpis,
    salesVsCollections,
    weeklyRevenue,
    deliveryVolume,
    vehicleActivity,
    todayTrips: todayTripViews,
    latestTrips: tripViews,
    pendingCollections: data.pendingCollections,
    fleet,
    activity,
    hasAnyData,
    totals: {
      pendingAmount: currPending,
      overdueCount,
      todaySales: currSales,
      todayCollections: currCollections,
      todayProfit: currSales - currExpenses,
      todayBirds: currBirds,
      todayWeight: currWeight,
    },
  };
}

export type { VehicleRow };
