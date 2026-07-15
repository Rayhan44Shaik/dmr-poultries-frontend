import { useState, useRef, useEffect } from "react";
import { useDashboardData } from "../hooks/useDashboardData";
import KPICards from "../components/KPICards";
import TrendChart from "../components/TrendChart";
import TopShopsChart from "../components/TopShopsChart";
import CollectionsPie from "../components/CollectionsPie";
import ExpensesPie from "../components/ExpensesPie";
import MortalityChart from "../components/MortalityChart";
import RecentTripsTable from "../components/RecentTripsTable";
import ActiveCounts from "../components/ActiveCounts";
import { DateRangePicker } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import { Calendar } from "lucide-react";

// Helper to get previous Monday–Sunday
const getPreviousWeekRange = () => {
  const today = new Date();
  const day = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // Days to subtract to reach previous Monday
  const diffToMonday = (day === 0 ? 6 : day - 1) + 7;
  const prevMonday = new Date(today);
  prevMonday.setDate(today.getDate() - diffToMonday);
  const prevSunday = new Date(prevMonday);
  prevSunday.setDate(prevMonday.getDate() + 6);
  return { startDate: prevMonday, endDate: prevSunday };
};

function OperationsDashboardPage() {
  // ─── Default range set to previous Monday–Sunday ───
  const initialRange = getPreviousWeekRange();
  const [selectionRange, setSelectionRange] = useState<{
    startDate: Date | undefined;
    endDate: Date | undefined;
    key: string;
  }>({
    startDate: initialRange.startDate,
    endDate: initialRange.endDate,
    key: "selection",
  });

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  const [comparisonPeriod, setComparisonPeriod] = useState<"7d" | "15d" | "30d">("7d");

  const { data, previousData, isLoading } = useDashboardData(
    selectionRange.startDate ?? null,
    selectionRange.endDate ?? null,
    comparisonPeriod
  );

  const isRangeSelected = selectionRange.startDate !== undefined && selectionRange.endDate !== undefined;

  const rangeDays = isRangeSelected
    ? Math.ceil(
        (selectionRange.endDate!.getTime() - selectionRange.startDate!.getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1
    : undefined;

  const handleRangeChange = (item: any) => {
    setSelectionRange(item.selection);
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return "";
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const toggleCalendar = () => setIsCalendarOpen(!isCalendarOpen);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Filter row – right aligned */}
      <div className="flex justify-end">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 relative" ref={calendarRef}>
            <div
              className="cursor-pointer text-slate-400 hover:text-slate-600"
              onClick={toggleCalendar}
            >
              <Calendar size={20} />
            </div>
            <button
              onClick={toggleCalendar}
              className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-slate-50"
            >
              <span>
                {isRangeSelected
                  ? `${formatDate(selectionRange.startDate)} – ${formatDate(selectionRange.endDate)}`
                  : "Select range"}
              </span>
            </button>
            {isCalendarOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg shadow-lg border border-slate-200" style={{ width: "280px" }}>
                <DateRangePicker
                  ranges={[selectionRange]}
                  onChange={handleRangeChange}
                  moveRangeOnFirstSelection={false}
                  months={1}
                  direction="horizontal"
                  staticRanges={[]}
                  inputRanges={[]}
                  rangeColors={["#3b82f6"]}
                  className="rdrDateRangePickerWrapper"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Compare</span>
            <select
              value={comparisonPeriod}
              onChange={(e) => setComparisonPeriod(e.target.value as "7d" | "15d" | "30d")}
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
            >
              <option value="7d">Last 7 days</option>
              <option value="15d">Last 15 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>
        </div>
      </div>

      {!isRangeSelected ? (
        <div className="flex items-center justify-center h-96 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-center">
            <div className="text-4xl mb-4">📅</div>
            <h3 className="text-lg font-semibold text-slate-700">Select a Date Range</h3>
            <p className="text-sm text-slate-500 mt-1">
              Click the calendar icon and pick a start and end date.
            </p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="p-8 text-center text-slate-500">Loading dashboard...</div>
      ) : (
        <>
          <KPICards current={data} previous={previousData} rangeDays={rangeDays} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TrendChart data={data.trendData} />
            <TopShopsChart data={data.topShops} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CollectionsPie data={data.collectionsByMode} />
            <ExpensesPie data={data.expensesByCategory} />
            <MortalityChart data={data.mortalityData} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <RecentTripsTable trips={data.recentTrips} />
            </div>
            <div>
              <ActiveCounts
                vehicles={data.activeVehicles}
                drivers={data.activeDrivers}
                helpers={data.activeHelpers}
                shops={data.totalShops}
                farms={data.totalFarms}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default OperationsDashboardPage;