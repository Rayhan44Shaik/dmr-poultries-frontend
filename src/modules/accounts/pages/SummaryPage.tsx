// src/modules/accounts/pages/SummaryPage.tsx

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Clock,
  Users,
  Scale,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Download,
  PieChart,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileSpreadsheet,
  ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { summaryService } from '../services/summaryService';
import { DatePicker } from '../../../components/common/DatePicker';
import { exportPDF, exportExcel } from '../components/Summary';
import type { Trip } from '../../operations/vehicle-trips/types/trip';
import type { WeeklyMetrics, ExpenseBreakdown } from '../types/summary.types';

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

const formatDateLabel = (date: Date): string => {
  return format(date, 'MMM d');
};

/** Monday of the week containing `date` */
const getMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Sunday of the week containing `date` */
const getSunday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? 0 : 7 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(23, 59, 59, 999);
  return d;
};

/** Check if two dates are in the same month/year */
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

// ---- Component ----
export default function SummaryPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'custom'>('week');
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  });
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  useEffect(() => {
    const handleStorage = () => setRefreshKey(prev => prev + 1);
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // ---- Month navigation ----
  const goToPrevMonth = () => {
    setSelectedMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const goToNextMonth = () => {
    setSelectedMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value, 10);
    setSelectedMonthDate(prev => new Date(prev.getFullYear(), newMonth, 1));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value, 10);
    setSelectedMonthDate(prev => new Date(newYear, prev.getMonth(), 1));
  };

  // ---- Date range ----
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
        break;
      }
      case 'custom': {
        start = customStart ? new Date(customStart) : new Date();
        end = customEnd ? new Date(customEnd) : new Date();
        break;
      }
      default:
        start = new Date();
        end = new Date();
    }
    return { start, end };
  }, [period, selectedMonthDate, customStart, customEnd]);

  const { start, end } = getDateRange();

  // ---- Fetch data ----
  const trips = useMemo(() => {
    return summaryService.getCompletedTripsByDateRange(start, end);
  }, [start, end, refreshKey]);

  const collections = useMemo(() => {
    return summaryService.getApprovedCollectionsByDateRange(start, end);
  }, [start, end, refreshKey]);

  const farmPayments = useMemo(() => {
    return summaryService.getFarmPaymentsByDateRange(start, end);
  }, [start, end, refreshKey]);

  // ---- Group trips into weeks or quarters ----
  const weeklyGroups = useMemo(() => {
    if (period === 'quarter') {
      const year = new Date().getFullYear();
      const groups = [];
      for (let q = 1; q <= 4; q++) {
        const { start: qStart, end: qEnd } = getQuarterRange(year, q);
        const qTrips = trips.filter(trip => {
          const d = new Date(trip.tripDate);
          return d >= qStart && d <= qEnd;
        });
        groups.push({
          label: getQuarterLabel(q),
          startDate: qStart,
          endDate: qEnd,
          trips: qTrips,
        });
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
          const weekTrips = trips.filter(trip => {
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

    // Week & Custom
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

      const weekTrips = trips.filter(trip => {
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

  // ---- Metrics & Expenses ----
  const weeklyMetrics: WeeklyMetrics[] = useMemo(() => {
    return weeklyGroups.map(group => {
      const groupCollections = collections.filter(c => {
        const d = new Date(c.collectionDate);
        return d >= group.startDate && d <= group.endDate;
      });
      return summaryService.computeMetrics(group.trips, groupCollections);
    });
  }, [weeklyGroups, collections]);

  const weeklyExpenses: ExpenseBreakdown[] = useMemo(() => {
    return weeklyGroups.map(group =>
      summaryService.computeExpenses(group.startDate, group.endDate, farmPayments)
    );
  }, [weeklyGroups, farmPayments]);

  const totalMetrics = useMemo<WeeklyMetrics>(() => {
    const total = { trips: 0, birds: 0, weight: 0, mortality: 0, sales: 0, collection: 0, pending: 0 };
    weeklyMetrics.forEach(m => {
      total.trips += m.trips;
      total.birds += m.birds;
      total.weight += m.weight;
      total.mortality += m.mortality;
      total.sales += m.sales;
      total.collection += m.collection;
      total.pending += m.pending;
    });
    return total;
  }, [weeklyMetrics]);

  const totalExpenses = useMemo<ExpenseBreakdown>(() => {
    const total = { farm: 0, fuel: 0, trip: 0, salary: 0, maintenance: 0, office: 0 };
    weeklyExpenses.forEach(w => {
      total.farm += w.farm;
      total.fuel += w.fuel;
      total.trip += w.trip;
      total.salary += w.salary;
      total.maintenance += w.maintenance;
      total.office += w.office;
    });
    return total;
  }, [weeklyExpenses]);

  // ---- Export handlers ----
  const getReportTitle = (): string => {
    const periodLabels: Record<string, string> = {
      week: 'Weekly Business Summary',
      month: `Monthly Business Summary - ${format(selectedMonthDate, 'MMMM yyyy')}`,
      quarter: 'Quarterly Business Summary',
      custom: 'Custom Range Business Summary',
    };
    return periodLabels[period] || 'Business Summary';
  };

  const getDateRangeLabel = (): string => {
    return `${format(start, 'dd MMM yyyy')} - ${format(end, 'dd MMM yyyy')}`;
  };

  const handleExportPDF = () => {
    const title = getReportTitle();
    const dateRange = getDateRangeLabel();
    exportPDF(
      title,
      dateRange,
      weeklyGroups,
      weeklyMetrics,
      weeklyExpenses,
      totalMetrics,
      totalExpenses
    );
  };

  const handleExportExcel = () => {
    const title = getReportTitle();
    const dateRange = getDateRangeLabel();
    exportExcel(
      title,
      dateRange,
      weeklyGroups,
      weeklyMetrics,
      weeklyExpenses,
      totalMetrics,
      totalExpenses
    );
  };

  // ---- Render ----
  return (
    <div className="w-full space-y-4">
      {/* ─── Period Tabs with Export ─── */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPeriod('week')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${
                period === 'week'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              This Week
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPeriod('month')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${
                  period === 'month'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Month
              </button>
              {period === 'month' && (
                <div className="flex items-center gap-1 ml-1">
                  <button
                    onClick={goToPrevMonth}
                    className="p-1 rounded hover:bg-slate-100 text-slate-500"
                    title="Previous month"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <select
                    value={selectedMonthDate.getMonth()}
                    onChange={handleMonthChange}
                    className="h-7 rounded border border-slate-200 bg-white px-1.5 text-xs font-medium text-slate-700 outline-none focus:border-emerald-500"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i}>
                        {format(new Date(2000, i, 1), 'MMM')}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedMonthDate.getFullYear()}
                    onChange={handleYearChange}
                    className="h-7 rounded border border-slate-200 bg-white px-1.5 text-xs font-medium text-slate-700 outline-none focus:border-emerald-500"
                  >
                    {Array.from({ length: 11 }, (_, i) => {
                      const year = new Date().getFullYear() - 5 + i;
                      return (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      );
                    })}
                  </select>
                  <button
                    onClick={goToNextMonth}
                    className="p-1 rounded hover:bg-slate-100 text-slate-500"
                    title="Next month"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setPeriod('quarter')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${
                period === 'quarter'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Quarter
            </button>
            <button
              onClick={() => setPeriod('custom')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${
                period === 'custom'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Custom Range
            </button>
            {period === 'custom' && (
              <div className="flex items-center gap-2 ml-2">
                <DatePicker
                  value={customStart}
                  onChange={setCustomStart}
                  placeholder="Start Date"
                  className="w-40"
                  placement="bottom"
                />
                <span className="text-xs text-slate-500">to</span>
                <DatePicker
                  value={customEnd}
                  onChange={setCustomEnd}
                  placeholder="End Date"
                  className="w-40"
                  placement="bottom"
                />
                <button
                  onClick={() => {
                    setCustomStart('');
                    setCustomEnd('');
                    setPeriod('week');
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right side: FY + Export Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs bg-slate-100 px-3 py-1 rounded-full text-slate-600 font-medium whitespace-nowrap">
            FY {new Date().getFullYear()}-{new Date().getFullYear()+1}
          </span>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg hover:bg-emerald-100 transition whitespace-nowrap border border-emerald-200"
            >
              <Download size={14} />
              Export
              <ChevronDown size={14} className={exportDropdownOpen ? 'rotate-180' : ''} />
            </button>

            {exportDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setExportDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-1 z-50 w-44 bg-white rounded-lg border border-slate-200 shadow-lg py-1 overflow-hidden">
                  <button
                    onClick={() => {
                      setExportDropdownOpen(false);
                      handleExportPDF();
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-xs text-slate-700 hover:bg-emerald-50 transition"
                  >
                    <FileText size={14} className="text-red-500" />
                    Export as PDF
                  </button>
                  <button
                    onClick={() => {
                      setExportDropdownOpen(false);
                      handleExportExcel();
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-xs text-slate-700 hover:bg-emerald-50 transition border-t border-slate-100"
                  >
                    <FileSpreadsheet size={14} className="text-green-600" />
                    Export as Excel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── Summary Table ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs table-fixed">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="w-32 px-4 py-3 text-left font-semibold text-slate-600">Particulars</th>
                {weeklyGroups.map((g, i) => (
                  <th key={i} className="w-24 px-4 py-3 text-center font-semibold text-slate-600">
                    {g.label}
                  </th>
                ))}
                <th className="w-20 px-4 py-3 text-center font-semibold text-slate-600 bg-emerald-50">Total</th>
              </tr>
            </thead>
            <tbody>
              {[
                { key: 'trips', label: 'No. of Trips' },
                { key: 'birds', label: 'No. of Birds' },
                { key: 'weight', label: 'Birds in KG' },
                { key: 'mortality', label: 'Mortality (Birds)' },
                { key: 'sales', label: 'Sales Amount (₹)' },
                { key: 'collection', label: 'Collection Amount (₹)' },
                { key: 'pending', label: 'Pending Collection (₹)' },
              ].map((item) => (
                <tr key={item.key} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="w-32 px-4 py-2.5 font-medium text-slate-700 truncate">{item.label}</td>
                  {weeklyMetrics.map((m, idx) => {
                    const value = (m[item.key as keyof WeeklyMetrics] as number) || 0;
                    let display: string;
                    if (item.key === 'sales' || item.key === 'collection' || item.key === 'pending') {
                      display = formatCurrency(value);
                    } else if (item.key === 'weight') {
                      display = value.toFixed(2);
                    } else {
                      display = formatNumber(value);
                    }
                    return (
                      <td key={idx} className="w-24 px-4 py-2.5 text-center text-slate-600">
                        {display}
                      </td>
                    );
                  })}
                  <td className="w-20 px-4 py-2.5 text-center font-bold text-slate-800 bg-emerald-50/50">
                    {item.key === 'sales' || item.key === 'collection' || item.key === 'pending'
                      ? formatCurrency((totalMetrics[item.key as keyof WeeklyMetrics] as number) || 0)
                      : item.key === 'weight'
                      ? ((totalMetrics[item.key as keyof WeeklyMetrics] as number) || 0).toFixed(2)
                      : formatNumber((totalMetrics[item.key as keyof WeeklyMetrics] as number) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Expenses Table ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs table-fixed">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="w-32 px-4 py-3 text-left font-semibold text-slate-600">Expense</th>
                {weeklyGroups.map((g, i) => (
                  <th key={i} className="w-24 px-4 py-3 text-center font-semibold text-slate-600">
                    {g.label}
                  </th>
                ))}
                <th className="w-20 px-4 py-3 text-center font-semibold text-slate-600 bg-emerald-50">Total</th>
              </tr>
            </thead>
            <tbody>
              {[
                { key: 'farm', label: 'Farm Payment (₹)' },
                { key: 'fuel', label: 'Fuel Payment (₹)' },
                { key: 'trip', label: 'Trip Expenses (₹)' },
                { key: 'salary', label: 'Salaries (₹)' },
                { key: 'maintenance', label: 'Vehicle Maintenance (₹)' },
                { key: 'office', label: 'Office & Other Expenses (₹)' },
              ].map((item) => {
                const values = weeklyExpenses.map((w) => (w[item.key as keyof ExpenseBreakdown] as number) || 0);
                const total = values.reduce((a, b) => a + b, 0);
                return (
                  <tr key={item.key} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="w-32 px-4 py-2.5 font-medium text-slate-700 truncate">{item.label}</td>
                    {values.map((val, idx) => (
                      <td key={idx} className="w-24 px-4 py-2.5 text-center text-slate-600">
                        {formatCurrency(val)}
                      </td>
                    ))}
                    <td className="w-20 px-4 py-2.5 text-center font-bold text-slate-800 bg-emerald-50/50">
                      {formatCurrency(total)}
                    </td>
                  </tr>
                );
              })}
              {/* Total Expenses */}
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <td className="w-32 px-4 py-2.5 font-bold text-slate-700">Total Expenses (₹)</td>
                {weeklyExpenses.map((w, idx) => {
                  const sum = Object.values(w).reduce((a, b) => a + b, 0);
                  return (
                    <td key={idx} className="w-24 px-4 py-2.5 text-center font-bold text-slate-700">
                      {formatCurrency(sum)}
                    </td>
                  );
                })}
                <td className="w-20 px-4 py-2.5 text-center font-bold text-slate-800 bg-emerald-50/50">
                  {formatCurrency(Object.values(totalExpenses).reduce((a, b) => a + b, 0))}
                </td>
              </tr>
              {/* Net Profit */}
              <tr className="bg-emerald-50/30">
                <td className="w-32 px-4 py-2.5 font-bold text-emerald-700">Net Profit (₹)</td>
                {weeklyMetrics.map((m, idx) => {
                  const totalExp = Object.values(weeklyExpenses[idx] || {}).reduce((a, b) => a + b, 0);
                  const profit = m.sales - totalExp;
                  return (
                    <td key={idx} className="w-24 px-4 py-2.5 text-center font-bold text-emerald-700">
                      {formatCurrency(profit)}
                    </td>
                  );
                })}
                <td className="w-20 px-4 py-2.5 text-center font-bold text-emerald-700 bg-emerald-100/50">
                  {formatCurrency(totalMetrics.sales - Object.values(totalExpenses).reduce((a, b) => a + b, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="text-xs text-slate-400 text-center border-t border-slate-200 pt-4 mt-2">
        All amounts are calculated based on the selected date range.
      </div>
    </div>
  );
}   