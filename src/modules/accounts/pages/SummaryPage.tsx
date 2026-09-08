// src/modules/accounts/pages/SummaryPage.tsx

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  Scale,
  Route,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { summaryService } from '../services/summaryService';
import { DatePicker } from '../../../components/common/DatePicker';
import { exportPDF, exportExcel } from '../components/Summary';
import SummaryTripViewer from '../components/Summary/SummaryTripViewer';
import { PaymentService } from '../services/PaymentService';
import { FarmPaymentService } from '../services/FarmPaymentService';
import type { Trip } from '../../operations/vehicle-trips/types/trip';
import type { WeeklyMetrics, ExpenseBreakdown } from '../types/summary.types';
import { useI18n } from '../../../i18n';

// ---- Helpers ----
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-IN').format(num);
};

const formatSignedCurrency = (amount: number): string => {
  if (amount === 0) return formatCurrency(0);
  return `${amount > 0 ? '+' : '-'}${formatCurrency(Math.abs(amount))}`;
};

const formatSignedPercent = (percent: number | null): string => {
  if (percent == null) return '—';
  return `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`;
};

const formatDateLabel = (date: Date): string => {
  return format(date, 'MMM d');
};

const getMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getSunday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(23, 59, 59, 999);
  return d;
};

const isSameMonth = (d1: Date, d2: Date): boolean => {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
};

const getQuarterLabel = (quarter: number): string => {
  const labels = ['Q1 (Jan–Mar)', 'Q2 (Apr–Jun)', 'Q3 (Jul–Sep)', 'Q4 (Oct–Dec)'];
  return labels[quarter - 1] || `Q${quarter}`;
};

const getQuarterRange = (year: number, quarter: number): { start: Date; end: Date } => {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getPreviousRange = (start: Date, end: Date): { start: Date; end: Date } => {
  const diffMs = end.getTime() - start.getTime();
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  previousEnd.setHours(23, 59, 59, 999);
  const previousStart = new Date(previousEnd.getTime() - diffMs);
  previousStart.setHours(0, 0, 0, 0);
  return { start: previousStart, end: previousEnd };
};

const sumExpenseBreakdown = (expense: ExpenseBreakdown): number =>
  Object.values(expense).reduce((a, b) => a + b, 0);

const getTripDistanceKm = (trip: Trip): number => {
  const totalKm = Number(trip.totalKm || 0);
  if (totalKm > 0) return totalKm;

  const openingMeter = Number(trip.openingMeter || 0);
  const closingMeter = Number(trip.closingMeter || 0);
  if (openingMeter > 0 && closingMeter > openingMeter) {
    return closingMeter - openingMeter;
  }

  return 0;
};

type SummaryPageProps = { embedded?: boolean };

export default function SummaryPage({ embedded = false }: SummaryPageProps) {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'custom'>('week');
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  });
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [comparePrevious, setComparePrevious] = useState(false);
  const [tripViewerOpen, setTripViewerOpen] = useState(false);
  const [tripViewerTrips, setTripViewerTrips] = useState<Trip[]>([]);
  const [tripViewerLabel, setTripViewerLabel] = useState('');
  const { t } = useI18n();

  useEffect(() => {
    const handleStorage = () => setRefreshKey((prev) => prev + 1);
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const goToPrevMonth = () =>
    setSelectedMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goToNextMonth = () =>
    setSelectedMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setSelectedMonthDate((prev) => new Date(prev.getFullYear(), parseInt(e.target.value, 10), 1));
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setSelectedMonthDate((prev) => new Date(parseInt(e.target.value, 10), prev.getMonth(), 1));

  const getDateRange = useCallback(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    let start: Date, end: Date;

    switch (period) {
      case 'week': {
        const monday = getMonday(now);
        start = new Date(monday);
        end = new Date(monday);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      }
      case 'month': {
        const year = selectedMonthDate.getFullYear();
        const month = selectedMonthDate.getMonth();
        const first = new Date(year, month, 1);
        const firstMonday = getMonday(first);
        const last = new Date(year, month + 1, 0);
        let lastSunday = getSunday(last);
        if (!isSameMonth(lastSunday, first)) {
          lastSunday = new Date(lastSunday);
          lastSunday.setDate(lastSunday.getDate() - 7);
        }
        start = firstMonday;
        end = lastSunday;
        break;
      }
      case 'quarter': {
        start = new Date(currentYear, 0, 1);
        end = new Date(currentYear, 11, 31);
        end.setHours(23, 59, 59, 999);
        break;
      }
      case 'custom': {
        start = customStart ? new Date(customStart) : new Date();
        end = customEnd ? new Date(customEnd) : new Date();
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      }
      default:
        start = new Date();
        end = new Date();
    }

    return { start, end };
  }, [period, selectedMonthDate, customStart, customEnd]);

  const { start, end } = getDateRange();
  const previousRange = useMemo(() => getPreviousRange(start, end), [start, end]);

  const trips = useMemo(() => {
    void refreshKey;
    return summaryService.getCompletedTripsByDateRange(start, end);
  }, [start, end, refreshKey]);

  const collections = useMemo(() => {
    void refreshKey;
    return summaryService.getApprovedCollectionsByDateRange(start, end);
  }, [start, end, refreshKey]);

  const previousTrips = useMemo(() => {
    void refreshKey;
    return summaryService.getCompletedTripsByDateRange(previousRange.start, previousRange.end);
  }, [previousRange, refreshKey]);

  const previousCollections = useMemo(() => {
    void refreshKey;
    return summaryService.getApprovedCollectionsByDateRange(previousRange.start, previousRange.end);
  }, [previousRange, refreshKey]);

  // Two previous weeks range for week-period comparison (Prev W1: 17-23, Prev W2: 24-30 when Current 31-06)
  const previousTwoWeeksRange = useMemo(() => {
    if (period !== 'week') return null;
    const curMonday = getMonday(start);
    const pStart = new Date(curMonday);
    pStart.setDate(curMonday.getDate() - 14);
    pStart.setHours(0, 0, 0, 0);
    const pEnd = new Date(curMonday);
    pEnd.setDate(curMonday.getDate() - 1);
    pEnd.setHours(23, 59, 59, 999);
    return { start: pStart, end: pEnd };
  }, [period, start]);

  const previousTwoWeeksTrips = useMemo(() => {
    void refreshKey;
    if (!previousTwoWeeksRange) return [] as Trip[];
    return summaryService.getCompletedTripsByDateRange(previousTwoWeeksRange.start, previousTwoWeeksRange.end);
  }, [previousTwoWeeksRange, refreshKey]);

  const previousTwoWeeksCollections = useMemo(() => {
    void refreshKey;
    if (!previousTwoWeeksRange) return [];
    return summaryService.getApprovedCollectionsByDateRange(previousTwoWeeksRange.start, previousTwoWeeksRange.end);
  }, [previousTwoWeeksRange, refreshKey]);

  const allPayments = useMemo(() => {
    void refreshKey;
    return PaymentService.getPayments();
  }, [refreshKey]);

  const computeEffectiveExpenses = useCallback(
    (rangeTrips: Trip[], rangeStart: Date, rangeEnd: Date): ExpenseBreakdown => {
      // Farm payments from FarmPaymentService (actual farm settlements)
      const farmPaymentsFromService = (() => {
        try {
          const allFarm = FarmPaymentService.getAll();
          return allFarm.filter((p: any) => {
            const d = new Date(p.paidDate || p.createdAt || '');
            return !isNaN(d.getTime()) && d >= rangeStart && d <= rangeEnd;
          });
        } catch {
          return [];
        }
      })();
      const expenses = summaryService.computeCombinedExpenses(rangeTrips, rangeStart, rangeEnd, farmPaymentsFromService as any);

      // Farm payments from PaymentService ledger (category/paymentType farm) – add, don't override trip farm
      const farmPaymentsFromLedger = allPayments.filter((p: any) => {
        if (!p.paymentDate) return false;
        const paymentDate = new Date(p.paymentDate);
        const isFarm = (p.paymentType && p.paymentType.toLowerCase().includes('farm')) || (p.category && p.category.toLowerCase().includes('farm'));
        return isFarm && paymentDate >= rangeStart && paymentDate <= rangeEnd;
      });
      const farmLedgerSum = farmPaymentsFromLedger.reduce((sum, p: any) => sum + (Number(p.amount) || 0), 0);
      // Trip farm (from getExpensesFromTrip) + FarmPaymentService already in expenses.farm, add ledger farm
      expenses.farm += farmLedgerSum;
      return expenses;
    },
    [allPayments]
  );

  const weeklyGroups = useMemo(() => {
    if (period === 'quarter') {
      const year = new Date().getFullYear();
      const groups = [];
      for (let q = 1; q <= 4; q++) {
        const { start: qStart, end: qEnd } = getQuarterRange(year, q);
        const qTrips = trips.filter((trip) => {
          const d = new Date(trip.tripDate);
          return d >= qStart && d <= qEnd;
        });
        groups.push({ label: getQuarterLabel(q), startDate: qStart, endDate: qEnd, trips: qTrips });
      }
      return groups;
    }

    if (period === 'month') {
      const year = selectedMonthDate.getFullYear();
      const month = selectedMonthDate.getMonth();
      const first = new Date(year, month, 1);
      let current = getMonday(first);
      const groups: { label: string; startDate: Date; endDate: Date; trips: Trip[] }[] = [];
      let weekIndex = 1;
      while (true) {
        const weekStart = new Date(current);
        const weekEnd = getSunday(current);
        if (isSameMonth(weekEnd, new Date(year, month, 1))) {
          const weekTrips = trips.filter((trip) => {
            const d = new Date(trip.tripDate);
            return d >= weekStart && d <= weekEnd;
          });
          const label = `Week ${weekIndex} (${formatDateLabel(weekStart)} - ${formatDateLabel(weekEnd)})`;
          groups.push({ label, startDate: weekStart, endDate: weekEnd, trips: weekTrips });
          weekIndex++;
        } else {
          if (weekEnd > new Date(year, month + 1, 0)) break;
        }
        current = new Date(weekEnd);
        current.setDate(current.getDate() + 1);
        if (current > new Date(year, month + 1, 0)) break;
      }
      return groups;
    }

    const groups: { label: string; startDate: Date; endDate: Date; trips: Trip[] }[] = [];
    let current = new Date(start);
    const monday = getMonday(current);
    current = new Date(monday);
    let weekIndex = 1;
    while (current <= end) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > end) weekEnd.setTime(end.getTime());

      const weekTrips = trips.filter((trip) => {
        const d = new Date(trip.tripDate);
        return d >= weekStart && d <= weekEnd;
      });

      const label = `Week ${weekIndex} (${formatDateLabel(weekStart)} - ${formatDateLabel(weekEnd)})`;
      groups.push({ label, startDate: weekStart, endDate: weekEnd, trips: weekTrips });
      current = new Date(weekEnd);
      current.setDate(current.getDate() + 1);
      if (current > end) break;
      weekIndex++;
    }
    return groups;
  }, [trips, start, end, period, selectedMonthDate]);

  // ---- Previous week-by-week groups (for side-by-side comparison beside each Week) ----
  const previousWeeklyGroups = useMemo(() => {
    // Quarter: mirror current year quarters but for previous year (previousRange year)
    if (period === 'quarter') {
      const year = previousRange.start.getFullYear();
      const groups = [];
      for (let q = 1; q <= 4; q++) {
        const { start: qStart, end: qEnd } = getQuarterRange(year, q);
        const qTrips = previousTrips.filter((trip) => {
          const d = new Date(trip.tripDate);
          return d >= qStart && d <= qEnd;
        });
        groups.push({ label: getQuarterLabel(q), startDate: qStart, endDate: qEnd, trips: qTrips });
      }
      return groups;
    }
    if (period === 'month') {
      const prevMonthDate = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() - 1, 1);
      const year = prevMonthDate.getFullYear();
      const month = prevMonthDate.getMonth();
      const first = new Date(year, month, 1);
      let current = getMonday(first);
      const groups: { label: string; startDate: Date; endDate: Date; trips: Trip[] }[] = [];
      let weekIndex = 1;
      while (true) {
        const weekStart = new Date(current);
        const weekEnd = getSunday(current);
        if (isSameMonth(weekEnd, new Date(year, month, 1))) {
          const weekTrips = previousTrips.filter((trip) => {
            const d = new Date(trip.tripDate);
            return d >= weekStart && d <= weekEnd;
          });
          const label = `Week ${weekIndex} (${formatDateLabel(weekStart)} - ${formatDateLabel(weekEnd)})`;
          groups.push({ label, startDate: weekStart, endDate: weekEnd, trips: weekTrips });
          weekIndex++;
        } else {
          if (weekEnd > new Date(year, month + 1, 0)) break;
        }
        current = new Date(weekEnd);
        current.setDate(current.getDate() + 1);
        if (current > new Date(year, month + 1, 0)) break;
      }
      return groups;
    }
    if (period === 'week' && previousTwoWeeksRange) {
      // For weekly comparison show exactly two previous weeks beside current week
      // e.g. Current 31 Aug - 06 Sep, Prev W2 24-30 Aug, Prev W1 17-23 Aug
      const curMonday = getMonday(start);
      const groups: { label: string; startDate: Date; endDate: Date; trips: Trip[] }[] = [];
      for (let offsetWeeks = 2; offsetWeeks >= 1; offsetWeeks--) {
        const weekStart = new Date(curMonday);
        weekStart.setDate(curMonday.getDate() - offsetWeeks * 7);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        const weekTrips = previousTwoWeeksTrips.filter((trip) => {
          const d = new Date(trip.tripDate);
          return d >= weekStart && d <= weekEnd;
        });
        const prevIndex = 3 - offsetWeeks; // 1 for 14 days ago, 2 for 7 days ago
        const label = `Prev Week ${prevIndex} (${formatDateLabel(weekStart)} - ${formatDateLabel(weekEnd)})`;
        groups.push({ label, startDate: weekStart, endDate: weekEnd, trips: weekTrips });
      }
      return groups;
    }
    // custom -> split previousRange into Mon-Sun weeks
    const groups: { label: string; startDate: Date; endDate: Date; trips: Trip[] }[] = [];
    let current = new Date(previousRange.start);
    const monday = getMonday(current);
    current = new Date(monday);
    let weekIndex = 1;
    while (current <= previousRange.end) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > previousRange.end) weekEnd.setTime(previousRange.end.getTime());
      const weekTrips = previousTrips.filter((trip) => {
        const d = new Date(trip.tripDate);
        return d >= weekStart && d <= weekEnd;
      });
      const label = `Week ${weekIndex} (${formatDateLabel(weekStart)} - ${formatDateLabel(weekEnd)})`;
      groups.push({ label, startDate: weekStart, endDate: weekEnd, trips: weekTrips });
      current = new Date(weekEnd);
      current.setDate(current.getDate() + 1);
      if (current > previousRange.end) break;
      weekIndex++;
    }
    return groups;
  }, [period, selectedMonthDate, previousTrips, previousRange, previousTwoWeeksRange, previousTwoWeeksTrips, start]);

  const previousWeeklyMetrics: WeeklyMetrics[] = useMemo(() => {
    const sourceCollections = period === 'week' ? previousTwoWeeksCollections : previousCollections;
    return previousWeeklyGroups.map((group) => {
      const groupCollections = sourceCollections.filter((c) => {
        const d = new Date(c.collectionDate);
        return d >= group.startDate && d <= group.endDate;
      });
      return summaryService.computeMetrics(group.trips, groupCollections);
    });
  }, [previousWeeklyGroups, previousCollections, previousTwoWeeksCollections, period]);

  const previousWeeklyExpenses: ExpenseBreakdown[] = useMemo(() => {
    return previousWeeklyGroups.map((group) => computeEffectiveExpenses(group.trips, group.startDate, group.endDate));
  }, [previousWeeklyGroups, computeEffectiveExpenses]);

  // ---- Month / Quarter / Custom comparison: show only last two periods + current when Compare ON ----
  const monthComparisonData = useMemo(() => {
    if (period !== 'month' || !comparePrevious) return null;
    const result: { label: string; start: Date; end: Date; metrics: WeeklyMetrics; expenses: ExpenseBreakdown; distance: number; trips: Trip[] }[] = [];
    for (let offset = 2; offset >= 0; offset--) {
      const d = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() - offset, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const first = new Date(year, month, 1);
      const firstMonday = getMonday(first);
      const last = new Date(year, month + 1, 0);
      let lastSunday = getSunday(last);
      if (!isSameMonth(lastSunday, first)) {
        lastSunday = new Date(lastSunday);
        lastSunday.setDate(lastSunday.getDate() - 7);
      }
      const s = firstMonday;
      const e = lastSunday;
      const tripsM = summaryService.getCompletedTripsByDateRange(s, e);
      const collM = summaryService.getApprovedCollectionsByDateRange(s, e);
      const metricsM = summaryService.computeMetrics(tripsM, collM);
      const expensesM = computeEffectiveExpenses(tripsM, s, e);
      const distance = tripsM.reduce((sum, tr) => sum + getTripDistanceKm(tr), 0);
      result.push({ label: format(d, 'MMM yyyy'), start: s, end: e, metrics: metricsM, expenses: expensesM, distance, trips: tripsM });
    }
    return result;
  }, [period, comparePrevious, selectedMonthDate, refreshKey, computeEffectiveExpenses]);

  const quarterComparisonData = useMemo(() => {
    if (period !== 'quarter' || !comparePrevious) return null;
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    const currentYear = now.getFullYear();
    const result: { label: string; start: Date; end: Date; metrics: WeeklyMetrics; expenses: ExpenseBreakdown; distance: number; trips: Trip[] }[] = [];
    for (let offset = 2; offset >= 0; offset--) {
      let q = currentQuarter - offset;
      let y = currentYear;
      while (q <= 0) { q += 4; y -= 1; }
      while (q > 4) { q -= 4; y += 1; }
      const { start: s, end: e } = getQuarterRange(y, q);
      const tripsQ = summaryService.getCompletedTripsByDateRange(s, e);
      const collQ = summaryService.getApprovedCollectionsByDateRange(s, e);
      const metricsQ = summaryService.computeMetrics(tripsQ, collQ);
      const expensesQ = computeEffectiveExpenses(tripsQ, s, e);
      const distance = tripsQ.reduce((sum, tr) => sum + getTripDistanceKm(tr), 0);
      result.push({ label: `${getQuarterLabel(q)} ${y}`, start: s, end: e, metrics: metricsQ, expenses: expensesQ, distance, trips: tripsQ });
    }
    return result;
  }, [period, comparePrevious, refreshKey, computeEffectiveExpenses]);

  const customComparisonData = useMemo(() => {
    if (period !== 'custom' || !comparePrevious || !customStart || !customEnd) return null;
    const curStart = new Date(customStart); curStart.setHours(0,0,0,0);
    const curEnd = new Date(customEnd); curEnd.setHours(23,59,59,999);
    const days = Math.max(1, Math.floor((curEnd.getTime() - curStart.getTime()) / 86400000) + 1);
    const result: { label: string; start: Date; end: Date; metrics: WeeklyMetrics; expenses: ExpenseBreakdown; distance: number; trips: Trip[] }[] = [];
    for (let offset = 2; offset >= 0; offset--) {
      const s = new Date(curStart);
      s.setDate(curStart.getDate() - offset * days);
      s.setHours(0,0,0,0);
      const e = new Date(s);
      e.setDate(s.getDate() + days - 1);
      e.setHours(23,59,59,999);
      const tripsC = summaryService.getCompletedTripsByDateRange(s, e);
      const collC = summaryService.getApprovedCollectionsByDateRange(s, e);
      const metricsC = summaryService.computeMetrics(tripsC, collC);
      const expensesC = computeEffectiveExpenses(tripsC, s, e);
      const distance = tripsC.reduce((sum, tr) => sum + getTripDistanceKm(tr), 0);
      const simpleLabel = offset === 2 ? `Prev 2` : offset === 1 ? `Prev 1` : `Current`;
      const dateRange = `${format(s,'dd MMM')} - ${format(e,'dd MMM yyyy')}`;
      result.push({ label: `${simpleLabel} (${days}d: ${dateRange})`, start: s, end: e, metrics: metricsC, expenses: expensesC, distance, trips: tripsC });
    }
    return result;
  }, [period, comparePrevious, customStart, customEnd, refreshKey, computeEffectiveExpenses]);

  const weeklyMetrics: WeeklyMetrics[] = useMemo(() => {
    return weeklyGroups.map((group) => {
      const groupCollections = collections.filter((c) => {
        const d = new Date(c.collectionDate);
        return d >= group.startDate && d <= group.endDate;
      });
      return summaryService.computeMetrics(group.trips, groupCollections);
    });
  }, [weeklyGroups, collections]);

  const weeklyExpenses: ExpenseBreakdown[] = useMemo(() => {
    return weeklyGroups.map((group) => computeEffectiveExpenses(group.trips, group.startDate, group.endDate));
  }, [weeklyGroups, computeEffectiveExpenses]);

  const totalExpenses = useMemo<ExpenseBreakdown>(() => {
    return computeEffectiveExpenses(trips, start, end);
  }, [trips, start, end, computeEffectiveExpenses]);

  const totalMetrics = useMemo<WeeklyMetrics>(() => {
    const total = { trips: 0, birds: 0, weight: 0, mortality: 0, weightLoss: 0, sales: 0, collection: 0, pending: 0 };
    weeklyMetrics.forEach((m) => {
      total.trips += m.trips;
      total.birds += m.birds;
      total.weight += m.weight;
      total.mortality += m.mortality;
      total.weightLoss += (m as any).weightLoss || 0;
      total.sales += m.sales;
      total.collection += m.collection;
      total.pending += m.pending;
    });
    return total;
  }, [weeklyMetrics]);

  const previousMetrics = useMemo<WeeklyMetrics>(() => {
    return summaryService.computeMetrics(previousTrips, previousCollections);
  }, [previousTrips, previousCollections]);

  const previousExpenses = useMemo<ExpenseBreakdown>(() => {
    return computeEffectiveExpenses(previousTrips, previousRange.start, previousRange.end);
  }, [previousTrips, previousRange, computeEffectiveExpenses]);

  const totalExpenseValue = useMemo(() => sumExpenseBreakdown(totalExpenses), [totalExpenses]);
  const previousExpenseValue = useMemo(() => sumExpenseBreakdown(previousExpenses), [previousExpenses]);
  const totalDistanceKm = useMemo(() => trips.reduce((sum, trip) => sum + getTripDistanceKm(trip), 0), [trips]);
  const previousDistanceKm = useMemo(() => previousTrips.reduce((sum, trip) => sum + getTripDistanceKm(trip), 0), [previousTrips]);

  const costPerKg = totalMetrics.weight > 0 ? totalExpenseValue / totalMetrics.weight : 0;
  const previousCostPerKg = previousMetrics.weight > 0 ? previousExpenseValue / previousMetrics.weight : 0;
  const costPerKm = totalDistanceKm > 0 ? totalExpenseValue / totalDistanceKm : 0;
  const previousCostPerKm = previousDistanceKm > 0 ? previousExpenseValue / previousDistanceKm : 0;

  const getReportTitle = (): string => {
    const periodLabels: Record<string, string> = {
      week: t('accounts.summary.report_title.week'),
      month: t('accounts.summary.report_title.month', { month: format(selectedMonthDate, 'MMMM yyyy') }),
      quarter: t('accounts.summary.report_title.quarter'),
      custom: t('accounts.summary.report_title.custom'),
    };
    return periodLabels[period] || 'Business Summary';
  };

  const getDateRangeLabel = (): string => {
    return `${format(start, 'dd MMM yyyy')} - ${format(end, 'dd MMM yyyy')}`;
  };

  const openTripViewer = useCallback((viewerTrips: Trip[], label: string) => {
    // Deduplicate by id (defensive), stable order by tripDate then id
    const seen = new Set<number>();
    const deduped: Trip[] = [];
    for (const tr of viewerTrips) {
      if (tr && typeof tr.id === 'number' && !seen.has(tr.id)) {
        seen.add(tr.id);
        deduped.push(tr);
      }
    }
    deduped.sort((a, b) => String(a.tripDate).localeCompare(String(b.tripDate)) || a.id - b.id);
    setTripViewerTrips(deduped);
    setTripViewerLabel(label);
    setTripViewerOpen(true);
  }, []);

  const closeTripViewer = useCallback(() => {
    setTripViewerOpen(false);
  }, []);

  const handleExportPDF = () => {
    const title = getReportTitle();
    const dateRange = getDateRangeLabel();
    exportPDF(title, dateRange, weeklyGroups, weeklyMetrics, weeklyExpenses, totalMetrics, totalExpenses, { totalDistanceKm });
  };

  const handleExportExcel = () => {
    const title = getReportTitle();
    const dateRange = getDateRangeLabel();
    exportExcel(title, dateRange, weeklyGroups, weeklyMetrics, weeklyExpenses, totalMetrics, totalExpenses);
  };

  // Previous values are now shown inline inside the existing Particulars & Expense tables
  // when Compare Previous is ON — no separate comparison table.
  const previousLabel = useMemo(() => {
    if (period === 'week') return `Previous Week`;
    if (period === 'month') return `Previous Month`;
    if (period === 'quarter') return `Previous Quarter`;
    return `Previous`;
  }, [period]);
  const previousSubLabel = useMemo(
    () => `${format(previousRange.start, 'dd MMM')} - ${format(previousRange.end, 'dd MMM')}`,
    [previousRange]
  );

  return (
    <div className={`w-full space-y-4 animate-in fade-in duration-500 ${
      embedded ? '' : 'px-4 md:px-8 py-6 md:py-8 bg-slate-50 dark:bg-slate-950 min-h-screen'
    }`}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700 dark:border-slate-800">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPeriod('week')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${
                period === 'week' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {t('accounts.summary.period.this_week')}
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPeriod('month')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${
                  period === 'month' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >                {t('accounts.summary.period.month')}
              </button>
              {period === 'month' && (
                <div className="flex items-center gap-1 ml-1">
                  <button onClick={goToPrevMonth} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400" title="Previous month">
                    <ChevronLeft size={16} />
                  </button>
                  <select
                    value={selectedMonthDate.getMonth()}
                    onChange={handleMonthChange}
                    className="h-7 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-emerald-500"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i}>{format(new Date(2000, i, 1), 'MMM')}</option>
                    ))}
                  </select>
                  <select
                    value={selectedMonthDate.getFullYear()}
                    onChange={handleYearChange}
                    className="h-7 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-emerald-500"
                  >
                    {Array.from({ length: 11 }, (_, i) => {
                      const year = new Date().getFullYear() - 5 + i;
                      return <option key={year} value={year}>{year}</option>;
                    })}
                  </select>
                  <button onClick={goToNextMonth} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400" title="Next month">
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setPeriod('quarter')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${
                period === 'quarter' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >              {t('accounts.summary.period.quarter')}
              </button>
            <button
              onClick={() => setPeriod('custom')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${
                period === 'custom' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >              {t('accounts.summary.period.custom_range')}
              </button>
            {period === 'custom' && (
              <div className="flex items-center gap-2 ml-2">
                <DatePicker value={customStart} onChange={setCustomStart} placeholder="Start Date" className="w-40" placement="bottom" />
                <span className="text-xs text-slate-500 dark:text-slate-400">to</span>
                <DatePicker value={customEnd} onChange={setCustomEnd} placeholder="End Date" className="w-40" placement="bottom" />
                <button
                  onClick={() => {
                    setCustomStart('');
                    setCustomEnd('');
                    setPeriod('week');
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition"
                >
                  {t('accounts.summary.clear')}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setComparePrevious((prev) => !prev)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition border whitespace-nowrap ${
              comparePrevious
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {t('accounts.summary.compare_previous')}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              comparePrevious ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}>{comparePrevious ? 'ON' : 'OFF'}</span>
          </button>

          <span className="text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
            {t('accounts.summary.fy', { year: String(new Date().getFullYear()), nextYear: String(new Date().getFullYear() + 1) })}
          </span>

          <div className="relative">
            <button
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition whitespace-nowrap border border-emerald-200 dark:border-emerald-500/20"
            >
              <Download size={14} />
              {t('accounts.summary.export')}
              <ChevronDown size={14} className={exportDropdownOpen ? 'rotate-180' : ''} />
            </button>

            {exportDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setExportDropdownOpen(false)} />
                <div className="absolute right-0 mt-1 z-50 w-44 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg py-1 overflow-hidden">
                  <button
                    onClick={() => {
                      setExportDropdownOpen(false);
                      handleExportPDF();
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-700 transition"
                  >
                    <FileText size={14} className="text-red-500" /> {t('accounts.summary.export_pdf')}
                  </button>
                  <button
                    onClick={() => {
                      setExportDropdownOpen(false);
                      handleExportExcel();
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-700 transition border-t border-slate-100 dark:border-slate-700"
                  >
                    <FileSpreadsheet size={14} className="text-green-600" /> {t('accounts.summary.export_excel')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Cost / KG – soft light */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700">
                <Scale size={16} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-[0.14em] text-slate-700 dark:text-slate-200">{t('accounts.summary.cost_per_kg')}</p>
                <p className="text-[11px] leading-none text-slate-400 mt-0.5 truncate">{totalMetrics.weight.toFixed(2)} kg • {formatNumber(totalMetrics.birds)} birds</p>
              </div>
              <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-slate-600 border border-slate-200 dark:border-slate-700">₹/KG</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-[22px] font-bold tracking-tight text-slate-900 leading-none">{formatCurrency(costPerKg)}</p>
              {comparePrevious && previousCostPerKg > 0 && costPerKg > 0 && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${costPerKg <= previousCostPerKg ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                  {costPerKg <= previousCostPerKg ? <TrendingDown size={11} /> : <TrendingUp size={11} />} {Math.abs(((costPerKg - previousCostPerKg)/previousCostPerKg)*100).toFixed(1)}%
                </span>
              )}
            </div>
            {!comparePrevious ? (
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{t('accounts.summary.cost_per_kg_desc')}</p>
            ) : (
              <div className="mt-3 rounded-xl bg-slate-50/70 border border-slate-200 dark:border-slate-700 p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[9px] font-semibold tracking-widest text-slate-500 dark:text-slate-400">{t('accounts.summary.vs_previous')}</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500">{period === 'week' ? 'Prev W1 • Prev W2' : 'Prev 2 • Prev 1'}</span>
                </div>
                {period === 'week' ? (
                  <div className="grid grid-cols-2 gap-2">
                    {(() => {
                      const c1 = previousWeeklyMetrics[0] && previousWeeklyExpenses[0] ? (previousWeeklyMetrics[0].weight > 0 ? sumExpenseBreakdown(previousWeeklyExpenses[0]) / previousWeeklyMetrics[0].weight : 0) : 0;
                      const c2 = previousWeeklyMetrics[1] && previousWeeklyExpenses[1] ? (previousWeeklyMetrics[1].weight > 0 ? sumExpenseBreakdown(previousWeeklyExpenses[1]) / previousWeeklyMetrics[1].weight : 0) : 0;
                      return (
                        <>
                          <div className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                            <div className="text-[9px] font-semibold tracking-widest text-slate-500">PREV W1</div>
                            <div className="text-[10px] text-slate-400">{previousWeeklyGroups[0] ? `${format(previousWeeklyGroups[0].startDate,'dd MMM')} – ${format(previousWeeklyGroups[0].endDate,'dd MMM')}` : '—'}</div>
                            <div className="mt-1 text-[13px] font-bold text-slate-800">{formatCurrency(c1)}</div>
                          </div>
                          <div className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                            <div className="text-[9px] font-semibold tracking-widest text-slate-500">PREV W2</div>
                            <div className="text-[10px] text-slate-400">{previousWeeklyGroups[1] ? `${format(previousWeeklyGroups[1].startDate,'dd MMM')} – ${format(previousWeeklyGroups[1].endDate,'dd MMM')}` : '—'}</div>
                            <div className="mt-1 text-[13px] font-bold text-slate-800">{formatCurrency(c2)}</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : period === 'month' && monthComparisonData ? (
                  <div className="grid grid-cols-2 gap-2">
                    {monthComparisonData.slice(0, 2).map((m, idx) => {
                      const c = m.metrics.weight > 0 ? sumExpenseBreakdown(m.expenses) / m.metrics.weight : 0;
                      return (
                        <div key={idx} className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                          <div className="text-[9px] font-semibold tracking-widest text-slate-500">{idx === 0 ? 'PREV 2' : 'PREV 1'}</div>
                          <div className="text-[10px] text-slate-400 truncate">{m.label}</div>
                          <div className="mt-1 text-[13px] font-bold text-slate-800">{formatCurrency(c)}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : period === 'quarter' && quarterComparisonData ? (
                  <div className="grid grid-cols-2 gap-2">
                    {quarterComparisonData.slice(0, 2).map((q, idx) => {
                      const c = q.metrics.weight > 0 ? sumExpenseBreakdown(q.expenses) / q.metrics.weight : 0;
                      return (
                        <div key={idx} className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                          <div className="text-[9px] font-semibold tracking-widest text-slate-500">{idx === 0 ? 'PREV 2' : 'PREV 1'}</div>
                          <div className="text-[10px] text-slate-400 truncate">{q.label}</div>
                          <div className="mt-1 text-[13px] font-bold text-slate-800">{formatCurrency(c)}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : period === 'custom' && customComparisonData ? (
                  <div className="grid grid-cols-2 gap-2">
                    {customComparisonData.slice(0, 2).map((c, idx) => {
                      const cost = c.metrics.weight > 0 ? sumExpenseBreakdown(c.expenses) / c.metrics.weight : 0;
                      return (
                        <div key={idx} className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                          <div className="text-[9px] font-semibold tracking-widest text-slate-500">{idx === 0 ? 'PREV 2' : 'PREV 1'}</div>
                          <div className="text-[10px] text-slate-400 truncate">{c.label.split('(')[0].trim()}</div>
                          <div className="mt-1 text-[13px] font-bold text-slate-800">{formatCurrency(cost)}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Cost / KM – soft light */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700">
                <Route size={16} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-[0.14em] text-slate-700 dark:text-slate-200">{t('accounts.summary.cost_per_km')}</p>
                <p className="text-[11px] leading-none text-slate-400 mt-0.5 truncate">{totalDistanceKm.toFixed(1)} km • {totalMetrics.trips} trips</p>
              </div>
              <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-slate-600 border border-slate-200 dark:border-slate-700">₹/KM</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-[22px] font-bold tracking-tight text-slate-900 leading-none">{formatCurrency(costPerKm)}</p>
              {comparePrevious && previousCostPerKm > 0 && costPerKm > 0 && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${costPerKm <= previousCostPerKm ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                  {costPerKm <= previousCostPerKm ? <TrendingDown size={11} /> : <TrendingUp size={11} />} {Math.abs(((costPerKm - previousCostPerKm)/previousCostPerKm)*100).toFixed(1)}%
                </span>
              )}
            </div>
            {!comparePrevious ? (
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{t('accounts.summary.cost_per_km_desc')}</p>
            ) : (
              <div className="mt-3 rounded-xl bg-slate-50/70 border border-slate-200 dark:border-slate-700 p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[9px] font-semibold tracking-widest text-slate-500 dark:text-slate-400">{t('accounts.summary.vs_previous')}</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500">{period === 'week' ? 'Prev W1 • Prev W2' : 'Prev 2 • Prev 1'}</span>
                </div>
                {period === 'week' ? (
                  <div className="grid grid-cols-2 gap-2">
                    {(() => {
                      const d1 = previousWeeklyGroups[0]?.trips.reduce((s, tr) => s + getTripDistanceKm(tr), 0) || 0;
                      const d2 = previousWeeklyGroups[1]?.trips.reduce((s, tr) => s + getTripDistanceKm(tr), 0) || 0;
                      const c1 = d1 > 0 ? sumExpenseBreakdown(previousWeeklyExpenses[0] || {farm:0,fuel:0,trip:0,salary:0,maintenance:0,office:0}) / d1 : 0;
                      const c2 = d2 > 0 ? sumExpenseBreakdown(previousWeeklyExpenses[1] || {farm:0,fuel:0,trip:0,salary:0,maintenance:0,office:0}) / d2 : 0;
                      return (
                        <>
                          <div className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                            <div className="text-[9px] font-semibold tracking-widest text-slate-500">PREV W1</div>
                            <div className="text-[10px] text-slate-400">{previousWeeklyGroups[0] ? `${format(previousWeeklyGroups[0].startDate,'dd MMM')} – ${format(previousWeeklyGroups[0].endDate,'dd MMM')}` : '—'}</div>
                            <div className="mt-1 text-[13px] font-bold text-slate-800">{formatCurrency(c1)}</div>
                          </div>
                          <div className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                            <div className="text-[9px] font-semibold tracking-widest text-slate-500">PREV W2</div>
                            <div className="text-[10px] text-slate-400">{previousWeeklyGroups[1] ? `${format(previousWeeklyGroups[1].startDate,'dd MMM')} – ${format(previousWeeklyGroups[1].endDate,'dd MMM')}` : '—'}</div>
                            <div className="mt-1 text-[13px] font-bold text-slate-800">{formatCurrency(c2)}</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : period === 'month' && monthComparisonData ? (
                  <div className="grid grid-cols-2 gap-2">
                    {monthComparisonData.slice(0, 2).map((m, idx) => {
                      const dist = (m as any).distance || 0;
                      const c = dist > 0 ? sumExpenseBreakdown(m.expenses) / dist : 0;
                      return (
                        <div key={idx} className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                          <div className="text-[9px] font-semibold tracking-widest text-slate-500">{idx === 0 ? 'PREV 2' : 'PREV 1'}</div>
                          <div className="text-[10px] text-slate-400 truncate">{m.label}</div>
                          <div className="mt-1 text-[13px] font-bold text-slate-800">{formatCurrency(c)}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : period === 'quarter' && quarterComparisonData ? (
                  <div className="grid grid-cols-2 gap-2">
                    {quarterComparisonData.slice(0, 2).map((q, idx) => {
                      const dist = (q as any).distance || 0;
                      const c = dist > 0 ? sumExpenseBreakdown(q.expenses) / dist : 0;
                      return (
                        <div key={idx} className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                          <div className="text-[9px] font-semibold tracking-widest text-slate-500">{idx === 0 ? 'PREV 2' : 'PREV 1'}</div>
                          <div className="text-[10px] text-slate-400 truncate">{q.label}</div>
                          <div className="mt-1 text-[13px] font-bold text-slate-800">{formatCurrency(c)}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : period === 'custom' && customComparisonData ? (
                  <div className="grid grid-cols-2 gap-2">
                    {customComparisonData.slice(0, 2).map((c, idx) => {
                      const dist = (c as any).distance || 0;
                      const cost = dist > 0 ? sumExpenseBreakdown(c.expenses) / dist : 0;
                      return (
                        <div key={idx} className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                          <div className="text-[9px] font-semibold tracking-widest text-slate-500">{idx === 0 ? 'PREV 2' : 'PREV 1'}</div>
                          <div className="text-[10px] text-slate-400 truncate">{c.label.split('(')[0].trim()}</div>
                          <div className="mt-1 text-[13px] font-bold text-slate-800">{formatCurrency(cost)}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs table-fixed">
            <thead className="bg-slate-50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="w-32 px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">{t('accounts.summary.weekly_table.particulars')}</th>
                {comparePrevious && period === 'week' ? (
                  <>
                    {previousWeeklyGroups.map((pg, idx) => (
                      <th key={`prev-${idx}`} className="w-24 px-3 py-3 text-center font-semibold text-slate-600 bg-amber-50/60 border-l border-amber-200">
                        <span className="block text-[10px] leading-tight">{pg.label}</span>
                        <span className="block text-[9px] font-normal text-amber-700/70">Previous</span>
                      </th>
                    ))}
                    {weeklyGroups.map((g, idx) => (
                      <th key={`curr-${idx}`} className="w-24 px-3 py-3 text-center font-semibold text-emerald-700 bg-emerald-50/40 border-l border-emerald-100">
                        <span className="block text-[10px] leading-tight">{g.label}</span>
                        <span className="block text-[9px] font-normal text-emerald-700/70">Current</span>
                      </th>
                    ))}
                  </>
                ) : comparePrevious && period === 'month' && monthComparisonData ? (
                  <>
                    {monthComparisonData.map((m, idx) => {
                      const isCurrent = idx === monthComparisonData.length - 1;
                      return (
                        <th key={idx} className={`w-28 px-3 py-3 text-center font-semibold border-l ${isCurrent ? 'text-emerald-700 bg-emerald-50/40 border-emerald-100' : 'text-slate-600 bg-amber-50/60 border-amber-200'}`}>
                          <span className="block text-[10px] leading-tight">{m.label}</span>
                          <span className={`block text-[9px] font-normal ${isCurrent ? 'text-emerald-700/70' : 'text-amber-700/70'}`}>{isCurrent ? 'Current' : idx === 0 ? 'Prev 2' : 'Prev 1'}</span>
                        </th>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'quarter' && quarterComparisonData ? (
                  <>
                    {quarterComparisonData.map((q, idx) => {
                      const isCurrent = idx === quarterComparisonData.length - 1;
                      return (
                        <th key={idx} className={`w-28 px-3 py-3 text-center font-semibold border-l ${isCurrent ? 'text-emerald-700 bg-emerald-50/40 border-emerald-100' : 'text-slate-600 bg-amber-50/60 border-amber-200'}`}>
                          <span className="block text-[10px] leading-tight">{q.label}</span>
                          <span className={`block text-[9px] font-normal ${isCurrent ? 'text-emerald-700/70' : 'text-amber-700/70'}`}>{isCurrent ? 'Current' : idx === 0 ? 'Prev 2' : 'Prev 1'}</span>
                        </th>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'custom' && customComparisonData ? (
                  <>
                    {customComparisonData.map((c, idx) => {
                      const isCurrent = idx === customComparisonData.length - 1;
                      return (
                        <th key={idx} className={`w-28 px-3 py-3 text-center font-semibold border-l ${isCurrent ? 'text-emerald-700 bg-emerald-50/40 border-emerald-100' : 'text-slate-600 bg-amber-50/60 border-amber-200'}`}>
                          <span className="block text-[10px] leading-tight">{c.label}</span>
                          <span className={`block text-[9px] font-normal ${isCurrent ? 'text-emerald-700/70' : 'text-amber-700/70'}`}>{isCurrent ? 'Current' : idx === 0 ? 'Prev 2' : 'Prev 1'}</span>
                        </th>
                      );
                    })}
                  </>
                ) : (
                  weeklyGroups.map((g, i) => (
                    <th key={i} className="w-24 px-3 py-3 text-center font-semibold text-slate-600">{g.label}</th>
                  ))
                )}
                {period !== 'week' && !comparePrevious && (
                  <th className="w-20 px-3 py-3 text-center font-semibold text-slate-600 bg-slate-50 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700">Total</th>
                )}
              </tr>
            </thead>
                        <tbody>
              {[
                { key: 'trips', label: t('accounts.summary.weekly_rows.trips') },
                { key: 'birds', label: t('accounts.summary.weekly_rows.birds') },
                { key: 'weight', label: t('accounts.summary.weekly_rows.weight') },
                { key: 'mortality', label: t('accounts.summary.weekly_rows.mortality') },
                { key: 'weightLoss', label: t('accounts.summary.weekly_rows.weightLoss') },
                { key: 'sales', label: t('accounts.summary.weekly_rows.sales') },
                { key: 'collection', label: t('accounts.summary.weekly_rows.collections') },
                { key: 'pending', label: t('accounts.summary.weekly_rows.pending') },
              ].map((item) => (
                <tr key={item.key} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="w-32 px-4 py-2.5 font-medium text-slate-700 truncate">{item.label}</td>
                  {comparePrevious && period === 'week' ? (
                    <>
                      {previousWeeklyMetrics.map((prevM, idx) => {
                        const prevVal = (prevM?.[item.key as keyof WeeklyMetrics] as number) || 0;
                        const fmt = (v: number) => {
                          if (item.key === 'sales' || item.key === 'collection' || item.key === 'pending') return formatCurrency(v);
                          if (item.key === 'weight' || (item as any).key === 'weightLoss' || item.key === 'weightLoss') return v.toFixed(2);
                          return formatNumber(v);
                        };
                        const tripsForCell = previousWeeklyGroups[idx]?.trips || [];
                        const labelForCell = previousWeeklyGroups[idx]?.label || 'Previous';
                        return (
                          <td key={`prev-${idx}`} className="w-24 px-3 py-2.5 text-center bg-amber-50/30 border-l border-amber-100">
                            {item.key === 'trips' ? (
                              <button
                                onClick={() => openTripViewer(tripsForCell, labelForCell)}
                                className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition active:scale-95"
                                title="View trips"
                              >
                                {fmt(prevVal)}
                              </button>
                            ) : (
                              <span className="text-slate-500">{fmt(prevVal)}</span>
                            )}
                          </td>
                        );
                      })}
                      {weeklyMetrics.map((currM, idx) => {
                        const currVal = (currM?.[item.key as keyof WeeklyMetrics] as number) || 0;
                        const prevValForDiff = (previousWeeklyMetrics[previousWeeklyMetrics.length - 1]?.[item.key as keyof WeeklyMetrics] as number) || 0;
                        const fmt = (v: number) => {
                          if (item.key === 'sales' || item.key === 'collection' || item.key === 'pending') return formatCurrency(v);
                          if (item.key === 'weight' || (item as any).key === 'weightLoss' || item.key === 'weightLoss') return v.toFixed(2);
                          return formatNumber(v);
                        };
                        const diff = currVal - prevValForDiff;
                        const pct = prevValForDiff !== 0 ? (diff / Math.abs(prevValForDiff)) * 100 : null;
                        const isCurrency = item.key === 'sales' || item.key === 'collection' || item.key === 'pending';
                        const isWeight = item.key === 'weight' || item.key === 'weightLoss';
                        const diffText = isCurrency
                          ? formatSignedCurrency(diff)
                          : `${diff > 0 ? '+' : ''}${isWeight ? diff.toFixed(2) : formatNumber(diff)}`;
                        const pctText = pct == null ? '' : ` (${formatSignedPercent(pct)})`;
                        const tripsForCell = weeklyGroups[idx]?.trips || [];
                        const labelForCell = weeklyGroups[idx]?.label || 'Current';
                        return (
                          <td key={`curr-${idx}`} className="w-24 px-3 py-2.5 text-center font-medium bg-emerald-50/20 border-l border-emerald-100">
                            {item.key === 'trips' ? (
                              <button
                                onClick={() => openTripViewer(tripsForCell, labelForCell)}
                                className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-white border border-emerald-200 shadow-sm hover:bg-emerald-600 hover:text-white transition active:scale-95"
                                title="View trips"
                              >
                                {fmt(currVal)}
                              </button>
                            ) : (
                              <div className="text-slate-700 dark:text-slate-200">{fmt(currVal)}</div>
                            )}
                            {(prevValForDiff !== 0 || currVal !== 0) && item.key !== 'trips' && (
                              <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diffText}{pctText}</div>
                            )}
                            {item.key === 'trips' && (prevValForDiff !== 0 || currVal !== 0) && (
                              <div className={`text-[9px] font-semibold leading-none mt-1 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diff > 0 ? '+' : ''}{formatNumber(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                            )}
                          </td>
                        );
                      })}
                    </>
                  ) : comparePrevious && period === 'month' && monthComparisonData ? (
                    <>
                      {monthComparisonData.map((m, idx) => {
                        const isCurrent = idx === monthComparisonData.length - 1;
                        const val = (m.metrics[item.key as keyof WeeklyMetrics] as number) || 0;
                        const fmt = (v: number) => {
                          if (item.key === 'sales' || item.key === 'collection' || item.key === 'pending') return formatCurrency(v);
                          if (item.key === 'weight' || (item as any).key === 'weightLoss' || item.key === 'weightLoss') return v.toFixed(2);
                          return formatNumber(v);
                        };
                        if (!isCurrent) {
                          return (
                            <td key={idx} className="w-28 px-3 py-2.5 text-center bg-amber-50/30 border-l border-amber-100">
                              {item.key === 'trips' ? (
                                <button
                                  onClick={() => openTripViewer((m as any).trips || [], m.label)}
                                  className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition active:scale-95"
                                  title="View trips"
                                >
                                  {fmt(val)}
                                </button>
                              ) : (
                                <span className="text-slate-500">{fmt(val)}</span>
                              )}
                            </td>
                          );
                        }
                        const prevVal = (monthComparisonData[monthComparisonData.length - 2]?.metrics[item.key as keyof WeeklyMetrics] as number) || 0;
                        const diff = val - prevVal;
                        const pct = prevVal !== 0 ? (diff / Math.abs(prevVal)) * 100 : null;
                        const isCurrency = item.key === 'sales' || item.key === 'collection' || item.key === 'pending';
                        const diffText = isCurrency ? formatSignedCurrency(diff) : `${diff > 0 ? '+' : ''}${ (item.key === 'weight' || item.key === 'weightLoss') ? diff.toFixed(2) : formatNumber(diff)}`;
                        const pctText = pct == null ? '' : ` (${formatSignedPercent(pct)})`;
                        return (
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-medium bg-emerald-50/20 border-l border-emerald-100">
                            {item.key === 'trips' ? (
                              <button
                                onClick={() => openTripViewer((m as any).trips || [], m.label)}
                                className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-white border border-emerald-200 shadow-sm hover:bg-emerald-600 hover:text-white transition active:scale-95"
                                title="View trips"
                              >
                                {fmt(val)}
                              </button>
                            ) : (
                              <div className="text-slate-700 dark:text-slate-200">{fmt(val)}</div>
                            )}
                            {(prevVal !== 0 || val !== 0) && item.key !== 'trips' && (
                              <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diffText}{pctText}</div>
                            )}
                            {item.key === 'trips' && (prevVal !== 0 || val !== 0) && (
                              <div className={`text-[9px] font-semibold leading-none mt-1 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diff > 0 ? '+' : ''}{formatNumber(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                            )}
                          </td>
                        );
                      })}
                    </>
                  ) : comparePrevious && period === 'quarter' && quarterComparisonData ? (
                    <>
                      {quarterComparisonData.map((q, idx) => {
                        const isCurrent = idx === quarterComparisonData.length - 1;
                        const val = (q.metrics[item.key as keyof WeeklyMetrics] as number) || 0;
                        const fmt = (v: number) => {
                          if (item.key === 'sales' || item.key === 'collection' || item.key === 'pending') return formatCurrency(v);
                          if (item.key === 'weight' || (item as any).key === 'weightLoss' || item.key === 'weightLoss') return v.toFixed(2);
                          return formatNumber(v);
                        };
                        if (!isCurrent) {
                          return (
                            <td key={idx} className="w-28 px-3 py-2.5 text-center bg-amber-50/30 border-l border-amber-100">
                              {item.key === 'trips' ? (
                                <button
                                  onClick={() => openTripViewer((q as any).trips || [], q.label)}
                                  className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition active:scale-95"
                                  title="View trips"
                                >
                                  {fmt(val)}
                                </button>
                              ) : (
                                <span className="text-slate-500">{fmt(val)}</span>
                              )}
                            </td>
                          );
                        }
                        const prevVal = (quarterComparisonData[quarterComparisonData.length - 2]?.metrics[item.key as keyof WeeklyMetrics] as number) || 0;
                        const diff = val - prevVal;
                        const pct = prevVal !== 0 ? (diff / Math.abs(prevVal)) * 100 : null;
                        const isCurrency = item.key === 'sales' || item.key === 'collection' || item.key === 'pending';
                        const diffText = isCurrency ? formatSignedCurrency(diff) : `${diff > 0 ? '+' : ''}${ (item.key === 'weight' || item.key === 'weightLoss') ? diff.toFixed(2) : formatNumber(diff)}`;
                        const pctText = pct == null ? '' : ` (${formatSignedPercent(pct)})`;
                        return (
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-medium bg-emerald-50/20 border-l border-emerald-100">
                            {item.key === 'trips' ? (
                              <button
                                onClick={() => openTripViewer((q as any).trips || [], q.label)}
                                className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-white border border-emerald-200 shadow-sm hover:bg-emerald-600 hover:text-white transition active:scale-95"
                                title="View trips"
                              >
                                {fmt(val)}
                              </button>
                            ) : (
                              <div className="text-slate-700 dark:text-slate-200">{fmt(val)}</div>
                            )}
                            {(prevVal !== 0 || val !== 0) && item.key !== 'trips' && (
                              <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diffText}{pctText}</div>
                            )}
                            {item.key === 'trips' && (prevVal !== 0 || val !== 0) && (
                              <div className={`text-[9px] font-semibold leading-none mt-1 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diff > 0 ? '+' : ''}{formatNumber(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                            )}
                          </td>
                        );
                      })}
                    </>
                  ) : comparePrevious && period === 'custom' && customComparisonData ? (
                    <>
                      {customComparisonData.map((c, idx) => {
                        const isCurrent = idx === customComparisonData.length - 1;
                        const val = (c.metrics[item.key as keyof WeeklyMetrics] as number) || 0;
                        const fmt = (v: number) => {
                          if (item.key === 'sales' || item.key === 'collection' || item.key === 'pending') return formatCurrency(v);
                          if (item.key === 'weight' || (item as any).key === 'weightLoss' || item.key === 'weightLoss') return v.toFixed(2);
                          return formatNumber(v);
                        };
                        if (!isCurrent) {
                          return (
                            <td key={idx} className="w-28 px-3 py-2.5 text-center bg-amber-50/30 border-l border-amber-100">
                              {item.key === 'trips' ? (
                                <button
                                  onClick={() => openTripViewer((c as any).trips || [], c.label)}
                                  className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition active:scale-95"
                                  title="View trips"
                                >
                                  {fmt(val)}
                                </button>
                              ) : (
                                <span className="text-slate-500">{fmt(val)}</span>
                              )}
                            </td>
                          );
                        }
                        const prevVal = (customComparisonData[customComparisonData.length - 2]?.metrics[item.key as keyof WeeklyMetrics] as number) || 0;
                        const diff = val - prevVal;
                        const pct = prevVal !== 0 ? (diff / Math.abs(prevVal)) * 100 : null;
                        const isCurrency = item.key === 'sales' || item.key === 'collection' || item.key === 'pending';
                        const diffText = isCurrency ? formatSignedCurrency(diff) : `${diff > 0 ? '+' : ''}${ (item.key === 'weight' || item.key === 'weightLoss') ? diff.toFixed(2) : formatNumber(diff)}`;
                        const pctText = pct == null ? '' : ` (${formatSignedPercent(pct)})`;
                        return (
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-medium bg-emerald-50/20 border-l border-emerald-100">
                            {item.key === 'trips' ? (
                              <button
                                onClick={() => openTripViewer((c as any).trips || [], c.label)}
                                className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-white border border-emerald-200 shadow-sm hover:bg-emerald-600 hover:text-white transition active:scale-95"
                                title="View trips"
                              >
                                {fmt(val)}
                              </button>
                            ) : (
                              <div className="text-slate-700 dark:text-slate-200">{fmt(val)}</div>
                            )}
                            {(prevVal !== 0 || val !== 0) && item.key !== 'trips' && (
                              <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diffText}{pctText}</div>
                            )}
                            {item.key === 'trips' && (prevVal !== 0 || val !== 0) && (
                              <div className={`text-[9px] font-semibold leading-none mt-1 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diff > 0 ? '+' : ''}{formatNumber(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                            )}
                          </td>
                        );
                      })}
                    </>
                  ) : (
                    weeklyGroups.map((_, idx) => {
                      const currM = weeklyMetrics[idx] as WeeklyMetrics | undefined;
                      const currVal = (currM?.[item.key as keyof WeeklyMetrics] as number) || 0;
                      const fmt = (v: number) => {
                        if (item.key === 'sales' || item.key === 'collection' || item.key === 'pending') return formatCurrency(v);
                        if (item.key === 'weight' || item.key === 'weightLoss') return v.toFixed(2);
                        return formatNumber(v);
                      };
                      const tripsForCell = weeklyGroups[idx]?.trips || [];
                      const labelForCell = weeklyGroups[idx]?.label || `Week ${idx+1}`;
                      return (
                        <td key={idx} className="w-24 px-3 py-2.5 text-center">
                          {item.key === 'trips' ? (
                            <button
                              onClick={() => openTripViewer(tripsForCell, labelForCell)}
                              className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-slate-800 bg-white border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition active:scale-95"
                              title="View trips"
                            >
                              {fmt(currVal)}
                            </button>
                          ) : (
                            <span className="text-slate-600">{fmt(currVal)}</span>
                          )}
                        </td>
                      );
                    })
                  )}
                  {period !== 'week' && !comparePrevious && (
                    <td className="w-20 px-3 py-2.5 text-center font-bold bg-slate-50 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700">
                      {item.key === 'trips' ? (
                        <button
                          onClick={() => openTripViewer(trips, `Total – ${getDateRangeLabel()}`)}
                          className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-slate-800 bg-white border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition active:scale-95"
                          title="View all trips"
                        >
                          {formatNumber((totalMetrics[item.key as keyof WeeklyMetrics] as number) || 0)}
                        </button>
                      ) : item.key === 'sales' || item.key === 'collection' || item.key === 'pending'
                        ? formatCurrency((totalMetrics[item.key as keyof WeeklyMetrics] as number) || 0)
                        : item.key === 'weight' || item.key === 'weightLoss'
                          ? ((totalMetrics[item.key as keyof WeeklyMetrics] as number) || 0).toFixed(2)
                          : formatNumber((totalMetrics[item.key as keyof WeeklyMetrics] as number) || 0)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs table-fixed">
            <thead className="bg-slate-50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="w-32 px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">{t('accounts.summary.expense_table.expense')}</th>
                {comparePrevious && period === 'week' ? (
                  <>
                    {previousWeeklyGroups.map((pg, idx) => (
                      <th key={`prev-${idx}`} className="w-24 px-3 py-3 text-center font-semibold text-slate-600 bg-amber-50/60 border-l border-amber-200">
                        <span className="block text-[10px] leading-tight">{pg.label}</span>
                        <span className="block text-[9px] font-normal text-amber-700/70">Previous</span>
                      </th>
                    ))}
                    {weeklyGroups.map((g, idx) => (
                      <th key={`curr-${idx}`} className="w-24 px-3 py-3 text-center font-semibold text-emerald-700 bg-emerald-50/40 border-l border-emerald-100">
                        <span className="block text-[10px] leading-tight">{g.label}</span>
                        <span className="block text-[9px] font-normal text-emerald-700/70">Current</span>
                      </th>
                    ))}
                  </>
                ) : comparePrevious && period === 'month' && monthComparisonData ? (
                  <>
                    {monthComparisonData.map((m, idx) => {
                      const isCurrent = idx === monthComparisonData.length - 1;
                      return (
                        <th key={idx} className={`w-28 px-3 py-3 text-center font-semibold border-l ${isCurrent ? 'text-emerald-700 bg-emerald-50/40 border-emerald-100' : 'text-slate-600 bg-amber-50/60 border-amber-200'}`}>
                          <span className="block text-[10px] leading-tight">{m.label}</span>
                          <span className={`block text-[9px] font-normal ${isCurrent ? 'text-emerald-700/70' : 'text-amber-700/70'}`}>{isCurrent ? 'Current' : idx === 0 ? 'Prev 2' : 'Prev 1'}</span>
                        </th>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'quarter' && quarterComparisonData ? (
                  <>
                    {quarterComparisonData.map((q, idx) => {
                      const isCurrent = idx === quarterComparisonData.length - 1;
                      return (
                        <th key={idx} className={`w-28 px-3 py-3 text-center font-semibold border-l ${isCurrent ? 'text-emerald-700 bg-emerald-50/40 border-emerald-100' : 'text-slate-600 bg-amber-50/60 border-amber-200'}`}>
                          <span className="block text-[10px] leading-tight">{q.label}</span>
                          <span className={`block text-[9px] font-normal ${isCurrent ? 'text-emerald-700/70' : 'text-amber-700/70'}`}>{isCurrent ? 'Current' : idx === 0 ? 'Prev 2' : 'Prev 1'}</span>
                        </th>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'custom' && customComparisonData ? (
                  <>
                    {customComparisonData.map((c, idx) => {
                      const isCurrent = idx === customComparisonData.length - 1;
                      return (
                        <th key={idx} className={`w-28 px-3 py-3 text-center font-semibold border-l ${isCurrent ? 'text-emerald-700 bg-emerald-50/40 border-emerald-100' : 'text-slate-600 bg-amber-50/60 border-amber-200'}`}>
                          <span className="block text-[10px] leading-tight">{c.label}</span>
                          <span className={`block text-[9px] font-normal ${isCurrent ? 'text-emerald-700/70' : 'text-amber-700/70'}`}>{isCurrent ? 'Current' : idx === 0 ? 'Prev 2' : 'Prev 1'}</span>
                        </th>
                      );
                    })}
                  </>
                ) : (
                  weeklyGroups.map((g, i) => (
                    <th key={i} className="w-24 px-3 py-3 text-center font-semibold text-slate-600">{g.label}</th>
                  ))
                )}
                {period !== 'week' && !comparePrevious && (
                  <th className="w-20 px-3 py-3 text-center font-semibold text-slate-600 bg-slate-50 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700">Total</th>
                )}
              </tr>
            </thead>
            <tbody>
              {[
                { key: 'farm', label: t('accounts.summary.expense_rows.farm') },
                { key: 'fuel', label: t('accounts.summary.expense_rows.fuel') },
                { key: 'trip', label: t('accounts.summary.expense_rows.trip') },
                { key: 'salary', label: t('accounts.summary.expense_rows.salary') },
                { key: 'maintenance', label: t('accounts.summary.expense_rows.maintenance') },
                { key: 'office', label: t('accounts.summary.expense_rows.office') },
              ].map((item) => {
                const total = weeklyExpenses.reduce((a, b) => a + ((b[item.key as keyof ExpenseBreakdown] as number) || 0), 0);
                return (
                  <tr key={item.key} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="w-32 px-4 py-2.5 font-medium text-slate-700 truncate">{item.label}</td>
                    {comparePrevious && period === 'week' ? (
                      <>
                        {previousWeeklyExpenses.map((prevW, idx) => {
                          const prevVal = (prevW?.[item.key as keyof ExpenseBreakdown] as number) || 0;
                          return (
                            <td key={`prev-${idx}`} className="w-24 px-3 py-2.5 text-center text-slate-500 bg-amber-50/30 border-l border-amber-100">{formatCurrency(prevVal)}</td>
                          );
                        })}
                        {weeklyExpenses.map((currW, idx) => {
                          const currVal = (currW?.[item.key as keyof ExpenseBreakdown] as number) || 0;
                          const prevValForDiff = (previousWeeklyExpenses[previousWeeklyExpenses.length - 1]?.[item.key as keyof ExpenseBreakdown] as number) || 0;
                          const expDiff = currVal - prevValForDiff;
                          const expPct = prevValForDiff !== 0 ? (expDiff / Math.abs(prevValForDiff)) * 100 : null;
                          return (
                            <td key={`curr-${idx}`} className="w-24 px-3 py-2.5 text-center font-medium bg-emerald-50/20 border-l border-emerald-100">
                              <div className="text-slate-700 dark:text-slate-200">{formatCurrency(currVal)}</div>
                              {(prevValForDiff !== 0 || currVal !== 0) ? (
                                <div className={`text-[9px] font-semibold leading-none mt-0.5 ${expDiff <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatSignedCurrency(expDiff)}{expPct == null ? '' : ` (${formatSignedPercent(expPct)})`}</div>
                              ) : null}
                            </td>
                          );
                        })}
                      </>
                    ) : comparePrevious && period === 'month' && monthComparisonData ? (
                      <>
                        {monthComparisonData.map((m, idx) => {
                          const isCurrent = idx === monthComparisonData.length - 1;
                          const val = (m.expenses[item.key as keyof ExpenseBreakdown] as number) || 0;
                          if (!isCurrent) {
                            return (
                              <td key={idx} className="w-28 px-3 py-2.5 text-center text-slate-500 bg-amber-50/30 border-l border-amber-100">{formatCurrency(val)}</td>
                            );
                          }
                          const prevVal = (monthComparisonData[monthComparisonData.length - 2]?.expenses[item.key as keyof ExpenseBreakdown] as number) || 0;
                          const expDiff = val - prevVal;
                          const expPct = prevVal !== 0 ? (expDiff / Math.abs(prevVal)) * 100 : null;
                          return (
                            <td key={idx} className="w-28 px-3 py-2.5 text-center font-medium bg-emerald-50/20 border-l border-emerald-100">
                              <div className="text-slate-700 dark:text-slate-200">{formatCurrency(val)}</div>
                              {(prevVal !== 0 || val !== 0) ? (
                                <div className={`text-[9px] font-semibold leading-none mt-0.5 ${expDiff <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatSignedCurrency(expDiff)}{expPct == null ? '' : ` (${formatSignedPercent(expPct)})`}</div>
                              ) : null}
                            </td>
                          );
                        })}
                      </>
                    ) : comparePrevious && period === 'quarter' && quarterComparisonData ? (
                      <>
                        {quarterComparisonData.map((q, idx) => {
                          const isCurrent = idx === quarterComparisonData.length - 1;
                          const val = (q.expenses[item.key as keyof ExpenseBreakdown] as number) || 0;
                          if (!isCurrent) {
                            return (
                              <td key={idx} className="w-28 px-3 py-2.5 text-center text-slate-500 bg-amber-50/30 border-l border-amber-100">{formatCurrency(val)}</td>
                            );
                          }
                          const prevVal = (quarterComparisonData[quarterComparisonData.length - 2]?.expenses[item.key as keyof ExpenseBreakdown] as number) || 0;
                          const expDiff = val - prevVal;
                          const expPct = prevVal !== 0 ? (expDiff / Math.abs(prevVal)) * 100 : null;
                          return (
                            <td key={idx} className="w-28 px-3 py-2.5 text-center font-medium bg-emerald-50/20 border-l border-emerald-100">
                              <div className="text-slate-700 dark:text-slate-200">{formatCurrency(val)}</div>
                              {(prevVal !== 0 || val !== 0) ? (
                                <div className={`text-[9px] font-semibold leading-none mt-0.5 ${expDiff <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatSignedCurrency(expDiff)}{expPct == null ? '' : ` (${formatSignedPercent(expPct)})`}</div>
                              ) : null}
                            </td>
                          );
                        })}
                      </>
                    ) : comparePrevious && period === 'custom' && customComparisonData ? (
                      <>
                        {customComparisonData.map((c, idx) => {
                          const isCurrent = idx === customComparisonData.length - 1;
                          const val = (c.expenses[item.key as keyof ExpenseBreakdown] as number) || 0;
                          if (!isCurrent) {
                            return (
                              <td key={idx} className="w-28 px-3 py-2.5 text-center text-slate-500 bg-amber-50/30 border-l border-amber-100">{formatCurrency(val)}</td>
                            );
                          }
                          const prevVal = (customComparisonData[customComparisonData.length - 2]?.expenses[item.key as keyof ExpenseBreakdown] as number) || 0;
                          const expDiff = val - prevVal;
                          const expPct = prevVal !== 0 ? (expDiff / Math.abs(prevVal)) * 100 : null;
                          return (
                            <td key={idx} className="w-28 px-3 py-2.5 text-center font-medium bg-emerald-50/20 border-l border-emerald-100">
                              <div className="text-slate-700 dark:text-slate-200">{formatCurrency(val)}</div>
                              {(prevVal !== 0 || val !== 0) ? (
                                <div className={`text-[9px] font-semibold leading-none mt-0.5 ${expDiff <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatSignedCurrency(expDiff)}{expPct == null ? '' : ` (${formatSignedPercent(expPct)})`}</div>
                              ) : null}
                            </td>
                          );
                        })}
                      </>
                    ) : (
                      weeklyGroups.map((_, idx) => {
                        const currVal = (weeklyExpenses[idx]?.[item.key as keyof ExpenseBreakdown] as number) || 0;
                        return (
                          <td key={idx} className="w-24 px-3 py-2.5 text-center text-slate-600">{formatCurrency(currVal)}</td>
                        );
                      })
                    )}
                    {period !== 'week' && !comparePrevious && (
                      <td className="w-20 px-3 py-2.5 text-center font-bold text-slate-800 bg-slate-50 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700">
                        {formatCurrency(total)}
                      </td>
                    )}
                  </tr>
                );
              })}
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50">
                <td className="w-32 px-4 py-2.5 font-bold text-slate-700 dark:text-slate-200">{t('accounts.summary.expense_rows.total')}</td>
                {comparePrevious && period === 'week' ? (
                  <>
                    {previousWeeklyExpenses.map((prevW, idx) => {
                      const prevSum = Object.values(prevW || {}).reduce((a, b) => a + (b as number), 0);
                      return (
                        <td key={`prev-${idx}`} className="w-24 px-3 py-2.5 text-center font-bold text-slate-500 bg-amber-50/40 border-l border-amber-100">{formatCurrency(prevSum)}</td>
                      );
                    })}
                    {weeklyExpenses.map((currW, idx) => {
                      const currSum = Object.values(currW || {}).reduce((a, b) => a + (b as number), 0);
                      const prevSumForDiff = Object.values(previousWeeklyExpenses[previousWeeklyExpenses.length - 1] || {}).reduce((a, b) => a + (b as number), 0);
                      const totalDiff = currSum - prevSumForDiff;
                      const totalPct = prevSumForDiff !== 0 ? (totalDiff / Math.abs(prevSumForDiff)) * 100 : null;
                      return (
                        <td key={`curr-${idx}`} className="w-24 px-3 py-2.5 text-center font-bold bg-emerald-50/30 border-l border-emerald-100">
                          <div className="text-slate-700 dark:text-slate-200">{formatCurrency(currSum)}</div>
                          {(prevSumForDiff !== 0 || currSum !== 0) && (
                            <div className={`text-[9px] font-semibold leading-none mt-0.5 ${totalDiff <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatSignedCurrency(totalDiff)}{totalPct == null ? '' : ` (${formatSignedPercent(totalPct)})`}</div>
                          )}
                        </td>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'month' && monthComparisonData ? (
                  <>
                    {monthComparisonData.map((m, idx) => {
                      const isCurrent = idx === monthComparisonData.length - 1;
                      const sum = sumExpenseBreakdown(m.expenses);
                      if (!isCurrent) {
                        return (
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold text-slate-500 bg-amber-50/40 border-l border-amber-100">{formatCurrency(sum)}</td>
                        );
                      }
                      const prevSum = sumExpenseBreakdown(monthComparisonData[monthComparisonData.length - 2].expenses);
                      const diff = sum - prevSum;
                      const pct = prevSum !== 0 ? (diff / Math.abs(prevSum)) * 100 : null;
                      return (
                        <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold bg-emerald-50/30 border-l border-emerald-100">
                          <div className="text-slate-700 dark:text-slate-200">{formatCurrency(sum)}</div>
                          {(prevSum !== 0 || sum !== 0) && (
                            <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatSignedCurrency(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                          )}
                        </td>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'quarter' && quarterComparisonData ? (
                  <>
                    {quarterComparisonData.map((q, idx) => {
                      const isCurrent = idx === quarterComparisonData.length - 1;
                      const sum = sumExpenseBreakdown(q.expenses);
                      if (!isCurrent) {
                        return (
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold text-slate-500 bg-amber-50/40 border-l border-amber-100">{formatCurrency(sum)}</td>
                        );
                      }
                      const prevSum = sumExpenseBreakdown(quarterComparisonData[quarterComparisonData.length - 2].expenses);
                      const diff = sum - prevSum;
                      const pct = prevSum !== 0 ? (diff / Math.abs(prevSum)) * 100 : null;
                      return (
                        <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold bg-emerald-50/30 border-l border-emerald-100">
                          <div className="text-slate-700 dark:text-slate-200">{formatCurrency(sum)}</div>
                          {(prevSum !== 0 || sum !== 0) && (
                            <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatSignedCurrency(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                          )}
                        </td>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'custom' && customComparisonData ? (
                  <>
                    {customComparisonData.map((c, idx) => {
                      const isCurrent = idx === customComparisonData.length - 1;
                      const sum = sumExpenseBreakdown(c.expenses);
                      if (!isCurrent) {
                        return (
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold text-slate-500 bg-amber-50/40 border-l border-amber-100">{formatCurrency(sum)}</td>
                        );
                      }
                      const prevSum = sumExpenseBreakdown(customComparisonData[customComparisonData.length - 2].expenses);
                      const diff = sum - prevSum;
                      const pct = prevSum !== 0 ? (diff / Math.abs(prevSum)) * 100 : null;
                      return (
                        <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold bg-emerald-50/30 border-l border-emerald-100">
                          <div className="text-slate-700 dark:text-slate-200">{formatCurrency(sum)}</div>
                          {(prevSum !== 0 || sum !== 0) && (
                            <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatSignedCurrency(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                          )}
                        </td>
                      );
                    })}
                  </>
                ) : (
                  weeklyGroups.map((_, idx) => {
                    const currSum = Object.values(weeklyExpenses[idx] || {}).reduce((a, b) => a + (b as number), 0);
                    return (
                      <td key={idx} className="w-24 px-3 py-2.5 text-center font-bold text-slate-700 dark:text-slate-200">{formatCurrency(currSum)}</td>
                    );
                  })
                )}
                {period !== 'week' && !comparePrevious && (
                  <td className="w-20 px-3 py-2.5 text-center font-bold text-slate-800 bg-slate-100 border-l border-slate-200 dark:border-slate-700">
                    {formatCurrency(totalExpenseValue)}
                  </td>
                )}
              </tr>
              <tr className="bg-emerald-50/30">
                <td className="w-32 px-4 py-2.5 font-bold text-emerald-700 dark:text-emerald-400">{t('accounts.summary.expense_rows.net_profit')}</td>
                {comparePrevious && period === 'week' ? (
                  <>
                    {previousWeeklyExpenses.map((_, idx) => {
                      const prevExp = Object.values(previousWeeklyExpenses[idx] || {}).reduce((a, b) => a + (b as number), 0);
                      const prevProfit = (previousWeeklyMetrics[idx]?.sales || 0) - prevExp;
                      return (
                        <td key={`prev-${idx}`} className="w-24 px-3 py-2.5 text-center font-bold text-amber-700 bg-amber-50/40 border-l border-amber-100">{formatCurrency(prevProfit)}</td>
                      );
                    })}
                    {weeklyMetrics.map((_, idx) => {
                      const currExp = Object.values(weeklyExpenses[idx] || {}).reduce((a, b) => a + (b as number), 0);
                      const prevExp = Object.values(previousWeeklyExpenses[previousWeeklyExpenses.length - 1] || {}).reduce((a, b) => a + (b as number), 0);
                      const currProfit = (weeklyMetrics[idx]?.sales || 0) - currExp;
                      const prevProfit = (previousWeeklyMetrics[previousWeeklyMetrics.length - 1]?.sales || 0) - prevExp;
                      const profitDiff = currProfit - prevProfit;
                      const profitPct = prevProfit !== 0 ? (profitDiff / Math.abs(prevProfit)) * 100 : null;
                      return (
                        <td key={`curr-${idx}`} className="w-24 px-3 py-2.5 text-center font-bold bg-emerald-100/40 border-l border-emerald-100">
                          <div className="text-emerald-700">{formatCurrency(currProfit)}</div>
                          {(prevProfit !== 0 || currProfit !== 0) && (
                            <div className={`text-[9px] font-semibold leading-none mt-0.5 ${profitDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatSignedCurrency(profitDiff)}{profitPct == null ? '' : ` (${formatSignedPercent(profitPct)})`}</div>
                          )}
                        </td>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'month' && monthComparisonData ? (
                  <>
                    {monthComparisonData.map((m, idx) => {
                      const isCurrent = idx === monthComparisonData.length - 1;
                      const profit = m.metrics.sales - sumExpenseBreakdown(m.expenses);
                      if (!isCurrent) {
                        return (
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold text-amber-700 bg-amber-50/40 border-l border-amber-100">{formatCurrency(profit)}</td>
                        );
                      }
                      const prevProfit = monthComparisonData[monthComparisonData.length - 2].metrics.sales - sumExpenseBreakdown(monthComparisonData[monthComparisonData.length - 2].expenses);
                      const diff = profit - prevProfit;
                      const pct = prevProfit !== 0 ? (diff / Math.abs(prevProfit)) * 100 : null;
                      return (
                        <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold bg-emerald-100/40 border-l border-emerald-100">
                          <div className="text-emerald-700">{formatCurrency(profit)}</div>
                          {(prevProfit !== 0 || profit !== 0) && (
                            <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatSignedCurrency(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                          )}
                        </td>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'quarter' && quarterComparisonData ? (
                  <>
                    {quarterComparisonData.map((q, idx) => {
                      const isCurrent = idx === quarterComparisonData.length - 1;
                      const profit = q.metrics.sales - sumExpenseBreakdown(q.expenses);
                      if (!isCurrent) {
                        return (
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold text-amber-700 bg-amber-50/40 border-l border-amber-100">{formatCurrency(profit)}</td>
                        );
                      }
                      const prevProfit = quarterComparisonData[quarterComparisonData.length - 2].metrics.sales - sumExpenseBreakdown(quarterComparisonData[quarterComparisonData.length - 2].expenses);
                      const diff = profit - prevProfit;
                      const pct = prevProfit !== 0 ? (diff / Math.abs(prevProfit)) * 100 : null;
                      return (
                        <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold bg-emerald-100/40 border-l border-emerald-100">
                          <div className="text-emerald-700">{formatCurrency(profit)}</div>
                          {(prevProfit !== 0 || profit !== 0) && (
                            <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatSignedCurrency(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                          )}
                        </td>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'custom' && customComparisonData ? (
                  <>
                    {customComparisonData.map((c, idx) => {
                      const isCurrent = idx === customComparisonData.length - 1;
                      const profit = c.metrics.sales - sumExpenseBreakdown(c.expenses);
                      if (!isCurrent) {
                        return (
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold text-amber-700 bg-amber-50/40 border-l border-amber-100">{formatCurrency(profit)}</td>
                        );
                      }
                      const prevProfit = customComparisonData[customComparisonData.length - 2].metrics.sales - sumExpenseBreakdown(customComparisonData[customComparisonData.length - 2].expenses);
                      const diff = profit - prevProfit;
                      const pct = prevProfit !== 0 ? (diff / Math.abs(prevProfit)) * 100 : null;
                      return (
                        <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold bg-emerald-100/40 border-l border-emerald-100">
                          <div className="text-emerald-700">{formatCurrency(profit)}</div>
                          {(prevProfit !== 0 || profit !== 0) && (
                            <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatSignedCurrency(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                          )}
                        </td>
                      );
                    })}
                  </>
                ) : (
                  weeklyGroups.map((_, idx) => {
                    const currExp = Object.values(weeklyExpenses[idx] || {}).reduce((a, b) => a + (b as number), 0);
                    const currProfit = (weeklyMetrics[idx]?.sales || 0) - currExp;
                    return (
                      <td key={idx} className="w-24 px-3 py-2.5 text-center font-bold text-emerald-700">{formatCurrency(currProfit)}</td>
                    );
                  })
                )}
                {period !== 'week' && !comparePrevious && (
                  <td className="w-20 px-3 py-2.5 text-center font-bold text-emerald-700 bg-slate-100 border-l border-slate-200 dark:border-slate-700">
                    {formatCurrency(totalMetrics.sales - totalExpenseValue)}
                  </td>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <SummaryTripViewer open={tripViewerOpen} trips={tripViewerTrips} groupLabel={tripViewerLabel} onClose={closeTripViewer} />

      <div className="text-xs text-slate-400 text-center border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
        {t('accounts.summary.disclaimer')}
      </div>
    </div>
  );
}