// src/modules/operations/dashboard/pages/OperationsDashboardPage.tsx
import { useState, useRef, useEffect } from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import { useDashboardData } from "../hooks/useDashboardData";
import KPICards from "../components/KPICards";
import TrendChart from "../components/TrendChart";
import CollectionsPie from "../components/CollectionsPie";
import RecentTripsTable from "../components/RecentTripsTable";
import ActiveCounts from "../components/ActiveCounts";
import PendingCollectionsByShop from "../components/PendingCollectionsByShop";
import {
  Calendar, 
   List,
  ShoppingBag,
  DollarSign,
  CreditCard,
  Clock,
  FileText,
  Fuel,
  ClipboardList,
} from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";

// -------- Helper: get previous Monday–Sunday --------
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

// -------- RangeDatePicker Component (right-aligned) --------
interface RangeDatePickerProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onRangeChange: (start: Date | undefined, end: Date | undefined) => void;
  placement?: "top" | "bottom";
  className?: string;
}

function RangeDatePicker({
  startDate,
  endDate,
  onRangeChange,
  placement = "bottom",
  className = "",
}: RangeDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const formatDate = (date: Date | undefined) => {
    if (!date) return "";
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const handleStartChange = (dateStr: string) => {
    const newStart = dateStr ? new Date(dateStr + "T00:00:00") : undefined;
    onRangeChange(newStart, endDate);
  };

  const handleEndChange = (dateStr: string) => {
    const newEnd = dateStr ? new Date(dateStr + "T00:00:00") : undefined;
    onRangeChange(startDate, newEnd);
  };

  const startDateStr = startDate ? startDate.toISOString().split("T")[0] : "";
  const endDateStr = endDate ? endDate.toISOString().split("T")[0] : "";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleCalendar = () => setIsOpen(!isOpen);

  const dropdownPositionClass =
    placement === "top"
      ? "bottom-[calc(100%+6px)] mb-1"
      : "top-[calc(100%+6px)] mt-1";

  const slateCalendarIcon = <Calendar size={18} className="text-slate-400" />;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="flex items-center gap-2">
        <div className="cursor-pointer text-slate-400 hover:text-slate-600" onClick={toggleCalendar}>
          <Calendar size={20} />
        </div>
        <button
          onClick={toggleCalendar}
          className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-slate-50"
        >
          <span>
            {startDate && endDate
              ? `${formatDate(startDate)} – ${formatDate(endDate)}`
              : "Select range"}
          </span>
        </button>
      </div>

      {isOpen && (
        <div
          className={`absolute right-0 z-50 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl ${dropdownPositionClass}`}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Start Date</label>
              <DatePicker
                value={startDateStr}
                onChange={handleStartChange}
                placeholder="From"
                className="w-full"
                icon={slateCalendarIcon}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">End Date</label>
              <DatePicker
                value={endDateStr}
                onChange={handleEndChange}
                placeholder="To"
                className="w-full"
                icon={slateCalendarIcon}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  const weekAgo = new Date(today);
                  weekAgo.setDate(today.getDate() - 7);
                  onRangeChange(weekAgo, today);
                  setIsOpen(false);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition"
              >
                Last 7 days
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  const monthAgo = new Date(today);
                  monthAgo.setDate(today.getDate() - 30);
                  onRangeChange(monthAgo, today);
                  setIsOpen(false);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 transition"
              >
                Last 30 days
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -------- Tab configuration WITHOUT the Overview tab --------
const operationTabs = [
  { id: "trip-entry", label: "Trip Entry", icon: ClipboardList, path: "/operations/vehicle-trips/entry" },
  { id: "trip-list", label: "Trip List", icon: List, path: "/operations/vehicle-trips/list" },
  { id: "shop-sales", label: "Shop Sales", icon: ShoppingBag, path: "/operations/shop-sales" },
  { id: "rate-entry", label: "Rate Entry", icon: DollarSign, path: "/operations/shop-sales/rate-entry" },
  { id: "collection", label: "Collection", icon: CreditCard, path: "/operations/collections/entry" },
  { id: "pending-collections", label: "Pending Collections", icon: Clock, path: "/operations/collections/pending" },
  { id: "collection-report", label: "Collection Report", icon: FileText, path: "/operations/collections/report" },
  { id: "fuel-expenses", label: "Fuel Expenses", icon: Fuel, path: "/operations/fuel-expenses" },
];

// -------- Main Layout Component --------
function OperationsDashboardPage() {
  const location = useLocation();
  const currentPath = location.pathname;

  // Determine if we are on the overview route (exact match or root)
  const isOverviewRoute = currentPath === "/operations/overview" || currentPath === "/operations";

  const initialRange = getPreviousWeekRange();
  const [startDate, setStartDate] = useState<Date | undefined>(initialRange.startDate);
  const [endDate, setEndDate] = useState<Date | undefined>(initialRange.endDate);
  const [comparisonPeriod] = useState<"7d" | "15d" | "30d">("7d");

  const { data, previousData, isLoading } = useDashboardData(
    startDate ?? null,
    endDate ?? null,
    comparisonPeriod
  );

  const isRangeSelected = startDate !== undefined && endDate !== undefined;
  const rangeDays = isRangeSelected
    ? Math.ceil((endDate!.getTime() - startDate!.getTime()) / (1000 * 60 * 60 * 24)) + 1
    : undefined;

  const handleRangeChange = (s: Date | undefined, e: Date | undefined) => {
    setStartDate(s);
    setEndDate(e);
  };

  // ---- Render Overview Content ----
  const renderOverviewContent = () => {
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
      return <div className="p-8 text-center text-slate-500">Loading dashboard...</div>;
    }

    return (
      <>
        <KPICards current={data} previous={previousData} rangeDays={rangeDays} />
        <div className="grid grid-cols-1 lg:grid-cols-[6fr_4fr] gap-6">
          <div className="w-full min-w-0">
            <TrendChart data={data.trendData} />
          </div>
          <div className="w-full min-w-0">
            <PendingCollectionsByShop data={data.pendingCollectionsByShop} />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_9fr] gap-6">
          <div className="w-full min-w-0">
            <CollectionsPie data={data.collectionsByMode} />
          </div>
          <div className="w-full min-w-0 overflow-x-auto text-xs">
            <RecentTripsTable trips={data.recentTrips} />
          </div>
        </div>
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
      {/* Tab Navigation – without Overview */}
      <div className="bg-white border-b border-slate-200 rounded-t-xl -mt-6 -mx-6 px-6">
        <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-hide">
          {operationTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentPath === tab.path || currentPath.startsWith(tab.path + "/");
            return (
              <Link
                key={tab.id}
                to={tab.path}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200
                  ${isActive
                    ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }
                `}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-blue-700" : "text-slate-400"}`} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Filter row – only for Overview */}
      {isOverviewRoute && (
        <div className="flex justify-end">
          <RangeDatePicker
            startDate={startDate}
            endDate={endDate}
            onRangeChange={handleRangeChange}
            placement="bottom"
          />
        </div>
      )}

      {/* Content – if overview, render dashboard; otherwise use Outlet for child routes */}
      {isOverviewRoute ? renderOverviewContent() : <Outlet />}
    </div>
  );
}

export default OperationsDashboardPage;