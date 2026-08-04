import React, { useState, useEffect } from 'react';
import { Tag, ChevronLeft, ChevronRight, CheckCircle2, RefreshCw } from 'lucide-react';

export default function WeeklyMarketRates() {
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

  const [currentDateObj, setCurrentDateObj] = useState(new Date());
  const [fromDate, setFromDate] = useState(getCurrentWeekRange().from);
  const [toDate, setToDate] = useState(getCurrentWeekRange().to);
  const [matrixDays, setMatrixDays] = useState<Array<{ label: string; dateStr: string }>>([]);

  // Persistent storage structure
  const [tableOneData, setTableOneData] = useState<Record<string, Record<string, string>>>({});
  const [tableTwoData, setTableTwoData] = useState<Record<string, Record<string, string>>>({});
  const [summaryData, setSummaryData] = useState<Record<string, Record<string, string>>>({});

  // Handle Weekly Shift
  const handleShiftTime = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDateObj);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDateObj(newDate);
    const newRange = getCurrentWeekRange(newDate);
    setFromDate(newRange.from);
    setToDate(newRange.to);
  };

  useEffect(() => {
    const days = [];
    let current = new Date(fromDate);
    const end = new Date(toDate);

    while (current <= end) {
      const dayNum = current.getDate().toString();
      const dateStr = current.toISOString().split('T')[0];
      days.push({ label: dayNum, dateStr });
      current.setDate(current.getDate() + 1);
    }
    setMatrixDays(days);
  }, [fromDate, toDate]);

  // Load data on mount
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

  // Auto-save with debounce
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

  const handleDataChange = (
    setter: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>,
    dateStr: string,
    field: string,
    value: string
  ) => {
    setter(prev => ({
      ...prev,
      [dateStr]: {
        ...(prev[dateStr] || {}),
        [field]: value,
      }
    }));
  };

  const renderTableTimeHeader = () => (
    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-2xs">
      <button onClick={() => handleShiftTime('prev')} className="flex items-center gap-0.5 px-2 py-1 text-slate-600 hover:bg-white hover:text-slate-900 rounded font-medium text-xs transition-all border-r border-slate-200">
        <ChevronLeft size={13} /> <span>Prev Week</span>
      </button>
      <button onClick={() => handleShiftTime('next')} className="flex items-center gap-0.5 px-2 py-1 text-slate-600 hover:bg-white hover:text-slate-900 rounded font-medium text-xs transition-all">
        <span>Next Week</span> <ChevronRight size={13} />
      </button>
    </div>
  );

  return (
    <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-slate-800">Weekly Market Rates</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 font-medium">
            {autoSaveStatus === 'Saving...' ? (
              <RefreshCw size={13} className="text-amber-500 animate-spin" />
            ) : (
              <CheckCircle2 size={13} className="text-emerald-600" />
            )}
            <span>{autoSaveStatus}</span>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700">
            <span>{fromDate}</span> <span className="text-slate-400">to</span> <span>{toDate}</span>
          </div>
        </div>
      </div>

      {/* 1. Additional Metrics Entry */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-slate-500" />
            <h3 className="font-semibold text-slate-800 text-sm">Additional Metrics Entry (Vij, Gun, R.P)</h3>
          </div>
          {renderTableTimeHeader()}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-center border border-slate-200 text-xs">
            <thead className="bg-slate-100">
              <tr className="text-slate-700 font-bold border-b border-slate-200">
                <th className="px-4 py-2 border-r border-slate-200 text-left">Date</th>
                <th className="px-4 py-2 border-r border-slate-200">Vij</th>
                <th className="px-4 py-2 border-r border-slate-200">Gun</th>
                <th className="px-4 py-2">R.P</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {matrixDays.map((dayObj) => {
                const rowData = summaryData[dayObj.dateStr] || {};
                return (
                  <tr key={dayObj.dateStr} className="hover:bg-slate-50">
                    <td className="px-4 py-2 border-r border-slate-100 text-left font-bold text-slate-900 bg-slate-50/50">{dayObj.dateStr}</td>
                    <td className="px-4 py-2 border-r border-slate-100">
                      <input type="text" inputMode="numeric" placeholder="0" value={rowData['vij'] || ''} onChange={(e) => handleDataChange(setSummaryData, dayObj.dateStr, 'vij', e.target.value)} className="w-20 text-center px-2 py-1 border border-slate-200 rounded text-xs" />
                    </td>
                    <td className="px-4 py-2 border-r border-slate-100">
                      <input type="text" inputMode="numeric" placeholder="0" value={rowData['gun'] || ''} onChange={(e) => handleDataChange(setSummaryData, dayObj.dateStr, 'gun', e.target.value)} className="w-20 text-center px-2 py-1 border border-slate-200 rounded text-xs" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="text" inputMode="numeric" placeholder="0" value={rowData['rp'] || ''} onChange={(e) => handleDataChange(setSummaryData, dayObj.dateStr, 'rp', e.target.value)} className="w-20 text-center px-2 py-1 border border-slate-200 rounded text-xs text-blue-600 font-medium" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* 2. Company Rates Matrix Entry */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Tag size={16} className="text-slate-500" />
              <h3 className="font-semibold text-slate-800 text-sm">Company Rates Matrix Entry</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-xs">
              <thead className="bg-slate-100">
                <tr className="text-slate-700 font-bold border-b border-slate-200">
                  <th className="px-2 py-2 text-left border-r border-slate-200">Date</th>
                  <th className="px-1 py-2 border-r border-slate-200">Sneha</th>
                  <th className="px-1 py-2 border-r border-slate-200">VenCob Rate</th>
                  <th className="px-1 py-2 border-r border-slate-200">VenCob Vii</th>
                  <th className="px-1 py-2 border-r border-slate-200">VenCob Gun</th>
                  <th className="px-1 py-2">Assoc Vii</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {matrixDays.map((dayObj) => {
                  const rowData = tableOneData[dayObj.dateStr] || {};
                  return (
                    <tr key={dayObj.dateStr} className="hover:bg-slate-50">
                      <td className="px-2 py-2 border-r border-slate-100 text-left font-bold text-slate-900 bg-slate-50/50">{dayObj.dateStr}</td>
                      {['sneha', 'vencobRate', 'vencobVii', 'vencobGun', 'associationVii'].map((colKey) => (
                        <td key={colKey} className="px-1 py-1 border-r border-slate-100">
                          <input type="text" inputMode="numeric" placeholder="0" value={rowData[colKey] || ''} onChange={(e) => handleDataChange(setTableOneData, dayObj.dateStr, colKey, e.target.value)} className="w-12 text-center px-1 py-1 border border-slate-200 rounded text-xs" />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Size & Category Breakdown Entry */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Tag size={16} className="text-slate-500" />
              <h3 className="font-semibold text-slate-800 text-sm">Size & Category Breakdown Entry</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-xs">
              <thead className="bg-slate-100">
                <tr className="text-slate-700 font-bold border-b border-slate-200">
                  <th className="px-2 py-2 text-left border-r border-slate-200">Date</th>
                  <th className="px-1 py-2 border-r border-slate-200">17</th>
                  <th className="px-1 py-2 border-r border-slate-200">15</th>
                  <th className="px-1 py-2 border-r border-slate-200">13</th>
                  <th className="px-1 py-2 border-r border-slate-200">12</th>
                  <th className="px-1 py-2">10</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {matrixDays.map((dayObj) => {
                  const rowData = tableTwoData[dayObj.dateStr] || {};
                  return (
                    <tr key={dayObj.dateStr} className="hover:bg-slate-50">
                      <td className="px-2 py-2 border-r border-slate-100 text-left font-bold text-slate-900 bg-slate-50/50">{dayObj.dateStr}</td>
                      {['c17', 'c15', 'c13', 'c12', 'c10'].map((colKey) => (
                        <td key={colKey} className="px-1 py-1 border-r border-slate-100">
                          <input type="text" inputMode="numeric" placeholder="0" value={rowData[colKey] || ''} onChange={(e) => handleDataChange(setTableTwoData, dayObj.dateStr, colKey, e.target.value)} className="w-12 text-center px-1 py-1 border border-slate-200 rounded text-xs" />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}