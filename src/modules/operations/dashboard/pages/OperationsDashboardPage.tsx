import { useState, useRef, useEffect } from "react";
import { useDashboardData } from "../hooks/useDashboardData";
import KPICards from "../components/KPICards";
import TrendChart from "../components/TrendChart";
import CollectionsPie from "../components/CollectionsPie";
import RecentTripsTable from "../components/RecentTripsTable";
import ActiveCounts from "../components/ActiveCounts";
import PendingCollectionsByShop from "../components/PendingCollectionsByShop";
import { DateRangePicker } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import { Calendar, Truck, List, ShoppingBag, DollarSign, CreditCard, Clock, FileText, Fuel } from "lucide-react";

// Import other page components
import TripEntryPage from "../../vehicle-trips/pages/TripEntryPage";
import TripListPage from "../../vehicle-trips/pages/TripListPage";
import ShopSalesPage from "../../shop-sales/pages/ShopSalesPage";
import RatesEntryPage from "../../shop-sales/pages/RatesEntryPage";
import CollectionEntryPage from "../../collections/pages/CollectionEntryPage";
import PendingCollectionsPage from "../../collections/pages/PendingCollectionsPage";
import CollectionReportPage from "../../collections/pages/CollectionReportPage";
import FuelExpensesPage from "../../fuel-expenses/pages/FuelExpensesPage";

// Helper to get previous Monday–Sunday
const getPreviousWeekRange = () => {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = (day === 0 ? 6 : day - 1) + 7;
  const prevMonday = new Date(today);
  prevMonday.setDate(today.getDate() - diffToMonday);
  const prevSunday = new Date(prevMonday);
  prevSunday.setDate(prevMonday.getDate() + 6);
  return { startDate: prevMonday, endDate: prevSunday };
};

// Tab configuration – "overview" removed from tabs
const tabs = [
  { id: "trip-entry", label: "Trip Entry", icon: <Truck className="w-4 h-4" /> },
  { id: "trip-list", label: "Trip List", icon: <List className="w-4 h-4" /> },
  { id: "shop-sales", label: "Shop Sales", icon: <ShoppingBag className="w-4 h-4" /> },
  { id: "rate-entry", label: "Rate Entry", icon: <DollarSign className="w-4 h-4" /> },
  { id: "collection", label: "Collection", icon: <CreditCard className="w-4 h-4" /> },
  { id: "pending-collections", label: "Pending Collections", icon: <Clock className="w-4 h-4" /> },
  { id: "collection-report", label: "Collection Report", icon: <FileText className="w-4 h-4" /> },
  { id: "fuel-expenses", label: "Fuel Expenses", icon: <Fuel className="w-4 h-4" /> },
];

function OperationsDashboardPage() {
  // Default active tab is "overview" – not in tabs, so it shows dashboard
  const [activeTab, setActiveTab] = useState("overview");

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

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return renderOverview();
      case "trip-entry":
        return <TripEntryPage />;
      case "trip-list":
        return <TripListPage />;
      case "shop-sales":
        return <ShopSalesPage />;
      case "rate-entry":
        return <RatesEntryPage embedded={true} />;
      case "collection":
        return <CollectionEntryPage />;
      case "pending-collections":
        return <PendingCollectionsPage />;
      case "collection-report":
        return <CollectionReportPage />;
      case "fuel-expenses":
        return <FuelExpensesPage />;
      default:
        return renderOverview();
    }
  };

  // Overview content (existing dashboard)
  const renderOverview = () => {
    if (!isRangeSelected) {
      return (
        <div className="flex items-center justify-center h-96 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-center">
            <div className="text-4xl mb-4">📅</div>
            <h3 className="text-lg font-semibold text-slate-700">Select a Date Range</h3>
            <p className="text-sm text-slate-500 mt-1">
              Click the calendar icon and pick a start and end date.
            </p>
          </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="p-8 text-center text-slate-500">Loading dashboard...</div>
      );
    }

    return (
      <>
        {/* ── KPI Cards ── */}
        <KPICards current={data} previous={previousData} rangeDays={rangeDays} />

        {/* ── 1st Row: Trend Chart (60%) + Collections Pie (40%) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[6fr_4fr] gap-6">
          <div className="w-full min-w-0">
            <TrendChart data={data.trendData} />
          </div>
          <div className="w-full min-w-0">
            <CollectionsPie data={data.collectionsByMode} />
          </div>
        </div>

        {/* ── 2nd Row: Pending Collections (40%) + Recent Trips (60%) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[4fr_6fr] gap-6">
          <div className="w-full min-w-0">
            <PendingCollectionsByShop data={data.pendingCollectionsByShop} />
          </div>
          <div className="w-full min-w-0">
            <RecentTripsTable trips={data.recentTrips} />
          </div>
        </div>

        {/* ── 3rd Row: Active Counts – Full width ── */}
        <div className="grid grid-cols-1 gap-6">
          <ActiveCounts
            vehicles={data.activeVehicles || 0}
            drivers={data.activeDrivers || 0}
            helpers={data.activeHelpers || 0}
            shops={data.totalShops || 0}
            farms={data.totalFarms || 0}
          />
        </div>
      </>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* ── Tab Navigation ── */}
      <div className="bg-white border-b border-slate-200 rounded-t-xl -mt-6 -mx-6 px-6">
        <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200
                ${activeTab === tab.id
                  ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter row (only for Overview tab) ── */}
      {activeTab === "overview" && (
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
      )}

      {/* ── Content ── */}
      {renderContent()}
    </div>
  );
}

export default OperationsDashboardPage;