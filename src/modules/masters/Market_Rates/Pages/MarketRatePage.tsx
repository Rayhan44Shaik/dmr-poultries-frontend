// src/modules/accounts/pages/MarketRatePage.tsx

import React, { useState, useEffect } from 'react';
import { Save, Tag, ChevronLeft, ChevronRight, CheckCircle2, X, RefreshCw, CalendarDays, TrendingUp, Layers, Building2 } from 'lucide-react';
import { DatePicker } from '../../../../components/common/DatePicker';
import { useSafeNotification } from '../../../../hooks/useSafeNotification';

interface MarketRatePageProps {
  embedded?: boolean;
}

export const MarketRatePage: React.FC<MarketRatePageProps> = ({ embedded = false }) => {
  const { showNotification } = useSafeNotification();

  // Filter tab state ("This Week" selected by default)
  const [activeTab, setActiveTab] = useState<'This Week' | 'Month' | 'Quarter' | 'Custom Range'>('This Week');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'Saved' | 'Saving...'>('Saved');

  // Helper to get current Monday to Sunday dates
  const getCurrentWeekRange = (dateObj: Date = new Date()) => {
    const curr = new Date(dateObj);
    const day = curr.getDay();
    const diffToMonday = curr.getDate() - day + (day === 0 ? -6 : 1);
    
    const monday = new Date(curr.setDate(diffToMonday));
    const sunday = new Date(curr.setDate(monday.getDate() + 6));

    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    return { from: formatDate(monday), to: formatDate(sunday) };
  };

  const weekRange = getCurrentWeekRange();
  const [fromDate, setFromDate] = useState(weekRange.from);
  const [toDate, setToDate] = useState(weekRange.to);

  // Function to navigate weeks or months back or forward using the table headers
  const handleShiftTime = (direction: 'prev' | 'next') => {
    if (activeTab === 'Month') {
      const currentFrom = new Date(fromDate);
      currentFrom.setMonth(currentFrom.getMonth() + (direction === 'next' ? 1 : -1));
      const firstDay = new Date(currentFrom.getFullYear(), currentFrom.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(currentFrom.getFullYear(), currentFrom.getMonth() + 1, 0).toISOString().split('T')[0];
      setFromDate(firstDay);
      setToDate(lastDay);
    } else {
      const currentMonday = new Date(fromDate);
      currentMonday.setDate(currentMonday.getDate() + (direction === 'next' ? 7 : -7));
      const newRange = getCurrentWeekRange(currentMonday);
      setFromDate(newRange.from);
      setToDate(newRange.to);
    }
  };

  // Generate date labels dynamically based on date range (Week or Month)
  const [matrixDays, setMatrixDays] = useState<Array<{ label: string; dateStr: string }>>([]);

  useEffect(() => {
    if (!fromDate || !toDate) {
      setMatrixDays([]);
      return;
    }
    const days = [];
    let currentDate = new Date(fromDate);
    const endDate = new Date(toDate);

    while (currentDate <= endDate) {
      const dayNum = currentDate.getDate().toString();
      const dateStr = currentDate.toISOString().split('T')[0];
      days.push({ label: dayNum, dateStr });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    setMatrixDays(days);
  }, [fromDate, toDate]);

  // Persistent storage structure for yearly data date-wise (typed records)
  const [tableOneData, setTableOneData] = useState<Record<string, Record<string, string>>>({});
  const [tableTwoData, setTableTwoData] = useState<Record<string, Record<string, string>>>({});
  const [summaryData, setSummaryData] = useState<Record<string, Record<string, string>>>({});

  // Load yearly data from localStorage on mount
  useEffect(() => {
    const savedYearlyRates = localStorage.getItem('yearly_market_rates_store');
    if (savedYearlyRates) {
      try {
        const parsed = JSON.parse(savedYearlyRates);
        setTableOneData(parsed.tableOne || {});
        setTableTwoData(parsed.tableTwo || {});
        setSummaryData(parsed.summary || {});
      } catch (e) {
        console.error('Error loading stored rates', e);
      }
    }
  }, []);

  // Auto-save yearly store with debounce mechanism whenever inputs change
  useEffect(() => {
    setAutoSaveStatus('Saving...');
    const yearlyPayload = {
      tableOne: tableOneData,
      tableTwo: tableTwoData,
      summary: summaryData,
    };

    const timer = setTimeout(() => {
      localStorage.setItem('yearly_market_rates_store', JSON.stringify(yearlyPayload));
      setAutoSaveStatus('Saved');
    }, 400);

    return () => clearTimeout(timer);
  }, [tableOneData, tableTwoData, summaryData]);

  // Handlers for updating specific date values dynamically
  const handleTableOneChange = (dateStr: string, field: string, value: string) => {
    setTableOneData(prev => ({
      ...prev,
      [dateStr]: {
        ...(prev[dateStr] || {}),
        [field]: value,
      }
    }));
  };

  const handleTableTwoChange = (dateStr: string, field: string, value: string) => {
    setTableTwoData(prev => ({
      ...prev,
      [dateStr]: {
        ...(prev[dateStr] || {}),
        [field]: value,
      }
    }));
  };

  const handleSummaryChange = (dateStr: string, field: string, value: string) => {
    setSummaryData(prev => ({
      ...prev,
      [dateStr]: {
        ...(prev[dateStr] || {}),
        [field]: value,
      }
    }));
  };

  // Manual explicit save action button with soft notification support
  const handleManualSave = () => {
    const yearlyPayload = {
      tableOne: tableOneData,
      tableTwo: tableTwoData,
      summary: summaryData,
    };
    localStorage.setItem('yearly_market_rates_store', JSON.stringify(yearlyPayload));
    setAutoSaveStatus('Saved');
    showNotification('All progress and yearly rate matrices successfully saved!', 'success');
  };

  // Handle Tab Switching behavior
  const handleTabClick = (tab: 'This Week' | 'Month' | 'Quarter' | 'Custom Range') => {
    setActiveTab(tab);
    if (tab === 'This Week') {
      const range = getCurrentWeekRange();
      setFromDate(range.from);
      setToDate(range.to);
    } else if (tab === 'Month') {
      const date = new Date();
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
      setFromDate(firstDay);
      setToDate(lastDay);
    }
  };

  // Clear custom range filter
  const handleClearCustomRange = () => {
    setFromDate('');
    setToDate('');
  };

  // Reusable compact navigation header component for tables
  const renderTableTimeHeader = () => (
    <div className="flex items-center bg-slate-100/80 border border-slate-200/60 rounded-lg p-0.5 shadow-sm">
      <button
        onClick={() => handleShiftTime('prev')}
        className="flex items-center gap-1 px-2.5 py-1.5 text-slate-500 hover:bg-white hover:text-indigo-600 rounded-md font-medium text-xs transition-all border-r border-slate-200/50"
        title={activeTab === 'Month' ? 'Previous Month' : 'Previous Week'}
      >
        <ChevronLeft size={14} />
        <span>{activeTab === 'Month' ? 'Prev Month' : 'Prev'}</span>
      </button>
      <button
        onClick={() => handleShiftTime('next')}
        className="flex items-center gap-1 px-2.5 py-1.5 text-slate-500 hover:bg-white hover:text-indigo-600 rounded-md font-medium text-xs transition-all"
        title={activeTab === 'Month' ? 'Next Month' : 'Next Week'}
      >
        <span>{activeTab === 'Month' ? 'Next Month' : 'Next'}</span>
        <ChevronRight size={14} />
      </button>
    </div>
  );

  // Reusable unified input style for the matrix
  const inputClassNames = "w-full min-w-[60px] max-w-[90px] mx-auto text-center px-2 py-1.5 bg-slate-50 border border-slate-200/70 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 hover:border-slate-300 transition-all text-xs font-semibold text-slate-800 placeholder:text-slate-300 shadow-sm";

  return (
    <div className={`w-full space-y-6 animate-in fade-in duration-500 ${
      embedded ? '' : 'px-4 md:px-8 py-6 md:py-8 bg-slate-50/50 min-h-screen'
    }`}>
      {/* Sticky Header with Filter Tabs, Navigation, and Integrated Auto-Save Status */}
      <div className="sticky top-0 z-30 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-xl overflow-x-auto scrollbar-none border border-slate-200/50">
          {(['This Week', 'Month', 'Quarter', 'Custom Range'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabClick(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Integrated auto-save status indicator */}
          <div className="flex items-center gap-2 text-xs bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/60 font-semibold shadow-sm">
            {autoSaveStatus === 'Saving...' ? (
              <RefreshCw size={14} className="text-amber-500 animate-spin" />
            ) : (
              <CheckCircle2 size={14} className="text-emerald-500" />
            )}
            <span className={autoSaveStatus === 'Saving...' ? 'text-slate-600' : 'text-slate-700'}>
              {autoSaveStatus === 'Saving...' ? 'Saving...' : 'Auto-saved'}
            </span>
          </div>

          {activeTab !== 'Custom Range' ? (
            <div className="flex items-center gap-2 bg-indigo-50/50 border border-indigo-100 px-4 py-2 rounded-xl text-xs font-bold text-indigo-700 shadow-sm">
              <CalendarDays size={14} className="opacity-70" />
              <span>{fromDate}</span>
              <span className="text-indigo-300 font-medium px-1">to</span>
              <span>{toDate}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <DatePicker
                value={fromDate}
                onChange={(d) => setFromDate(d)}
                placeholder="From date"
              />
              <DatePicker
                value={toDate}
                onChange={(d) => setToDate(d)}
                placeholder="To date"
              />
              {(fromDate || toDate) && (
                <button
                  onClick={handleClearCustomRange}
                  className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold px-3 py-2 rounded-xl text-xs transition-colors border border-red-100"
                  title="Clear Range"
                >
                  <X size={14} /> Clear
                </button>
              )}
            </div>
          )}

          <button
            onClick={handleManualSave}
            // 🔹 Changed button colors from indigo to emerald/green for "Save Progress"
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm shadow-emerald-200 hover:shadow-md hover:shadow-emerald-200"
          >
            <Save size={15} />
            Save Progress
          </button>
        </div>
      </div>

      {/* 1. Additional Metrics Entry (Vij, Gun, R.P) */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden flex flex-col group">
        <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
              <TrendingUp size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Additional Metrics</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Enter daily metrics for Vij, Gun, and R.P</p>
            </div>
          </div>
          {renderTableTimeHeader()}
        </div>
        
        <div className="overflow-x-auto max-h-[400px] bg-slate-50/30">
          <table className="w-full text-center border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100/90 backdrop-blur-sm border-b border-slate-200/80">
                <th className="px-5 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[10px]">Date</th>
                <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Vij</th>
                <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Gun</th>
                <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">R.P</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matrixDays.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-slate-400 text-center font-medium bg-white">
                    No dates selected in the current range.
                  </td>
                </tr>
              ) : (
                matrixDays.map((dayObj) => {
                  const rowData = summaryData[dayObj.dateStr] || {};
                  return (
                    <tr key={dayObj.dateStr} className="hover:bg-indigo-50/40 transition-colors bg-white">
                      <td className="px-5 py-2 text-left font-bold text-slate-700 whitespace-nowrap">
                        {dayObj.dateStr}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={rowData['vij'] || ''}
                          onChange={(e) => handleSummaryChange(dayObj.dateStr, 'vij', e.target.value)}
                          className={inputClassNames}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={rowData['gun'] || ''}
                          onChange={(e) => handleSummaryChange(dayObj.dateStr, 'gun', e.target.value)}
                          className={inputClassNames}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={rowData['rp'] || ''}
                          onChange={(e) => handleSummaryChange(dayObj.dateStr, 'rp', e.target.value)}
                          className={`${inputClassNames} !text-indigo-600 !border-indigo-100 !bg-indigo-50/30 focus:!bg-white focus:!border-indigo-500`}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid Container for Company Rates & Category Breakdown Matrices */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* 2. Company Rates Matrix Entry */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden flex flex-col group">
          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 bg-white">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Building2 size={18} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Company Rates</h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">Track competitor & association pricing</p>
              </div>
            </div>
            {renderTableTimeHeader()}
          </div>

          <div className="overflow-x-auto max-h-[500px] flex-1 bg-slate-50/30">
            <table className="w-full text-center border-collapse text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-100/90 backdrop-blur-sm border-b border-slate-200/80">
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[10px]">Date</th>
                  <th className="px-2 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Sneha</th>
                  <th className="px-2 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">VenCob R.</th>
                  <th className="px-2 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">VenCob V.</th>
                  <th className="px-2 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">VenCob G.</th>
                  <th className="px-2 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Assoc V.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrixDays.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-slate-400 text-center font-medium bg-white">
                      No dates selected in the current range.
                    </td>
                  </tr>
                ) : (
                  matrixDays.map((dayObj) => {
                    const rowData = tableOneData[dayObj.dateStr] || {};
                    return (
                      <tr key={dayObj.dateStr} className="hover:bg-blue-50/40 transition-colors bg-white">
                        <td className="px-4 py-2.5 text-left font-bold text-slate-700 whitespace-nowrap">
                          {dayObj.dateStr}
                        </td>
                        {(['sneha', 'vencobRate', 'vencobVii', 'vencobGun', 'associationVii']).map((colKey) => (
                          <td key={colKey} className="px-2 py-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={rowData[colKey] || ''}
                              onChange={(e) => handleTableOneChange(dayObj.dateStr, colKey, e.target.value)}
                              className={inputClassNames}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Size & Category Breakdown Entry */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden flex flex-col group">
          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 bg-white">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <Layers size={18} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Size Categories</h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">Rates based on bird weight metrics</p>
              </div>
            </div>
            {renderTableTimeHeader()}
          </div>

          <div className="overflow-x-auto max-h-[500px] flex-1 bg-slate-50/30">
            <table className="w-full text-center border-collapse text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-100/90 backdrop-blur-sm border-b border-slate-200/80">
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[10px]">Date</th>
                  <th className="px-2 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">17</th>
                  <th className="px-2 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">15</th>
                  <th className="px-2 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">13</th>
                  <th className="px-2 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">12</th>
                  <th className="px-2 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">10</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrixDays.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-slate-400 text-center font-medium bg-white">
                      No dates selected in the current range.
                    </td>
                  </tr>
                ) : (
                  matrixDays.map((dayObj) => {
                    const rowData = tableTwoData[dayObj.dateStr] || {};
                    return (
                      <tr key={dayObj.dateStr} className="hover:bg-emerald-50/40 transition-colors bg-white">
                        <td className="px-4 py-2.5 text-left font-bold text-slate-700 whitespace-nowrap">
                          {dayObj.dateStr}
                        </td>
                        {(['c17', 'c15', 'c13', 'c12', 'c10']).map((colKey) => (
                          <td key={colKey} className="px-2 py-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={rowData[colKey] || ''}
                              onChange={(e) => handleTableTwoChange(dayObj.dateStr, colKey, e.target.value)}
                              className={inputClassNames}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MarketRatePage;