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
  Sparkles,
  ArrowRightLeft
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

// -------- RangeDatePicker Component --------
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
      ? "bottom-[calc(100%+8px)] mb-1"
      : "top-[calc(100%+8px)] mt-1";

  const slateCalendarIcon = <Calendar size={14} className="text-slate-400" />;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="flex items-center gap-3">
        <button
          onClick={toggleCalendar}
          className="h-9 px-3.5 rounded-xl border border-slate-200/80 bg-white shadow-sm flex items-center gap-2 text-xs font-bold text-slate-700 hover:border-blue-500/50 hover:bg-slate-50/80 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all active:scale-[0.98]"
        >
          <Calendar size={14} className="text-blue-600" />
          <span>
            {startDate && endDate
              ? `${formatDate(startDate)} – ${formatDate(endDate)}`
              : "Select Range Window"}
          </span>
        </button>
      </div>

      {isOpen && (
        <div
          className={`absolute right-0 z-50 w-80 rounded-2xl border border-slate-200/70 bg-white/95 backdrop-blur-xl p-4 shadow-xl shadow-slate-900/5 border-t-blue-500 border-t-2 ${dropdownPositionClass}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Start Date</label>
                <DatePicker
                  value={startDateStr}
                  onChange={handleStartChange}
                  placeholder="From"
                  className="w-full text-xs"
                  icon={slateCalendarIcon}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">End Date</label>
                <DatePicker
                  value={endDateStr}
                  onChange={handleEndChange}
                  placeholder="To"
                  className="w-full text-xs"
                  icon={slateCalendarIcon}
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  const weekAgo = new Date(today);
                  weekAgo.setDate(today.getDate() - 7);
                  onRangeChange(weekAgo, today);
                  setIsOpen(false);
                }}
                className="px-3 py-2 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
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
                className="px-3 py-2 text-xs font-bold rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
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

// -------- Tab configuration with distinct colors for each icon --------
const operationTabs = [
  { 
    id: "trip-entry", 
    label: "Trip Entry", 
    icon: ClipboardList, 
    path: "/operations/vehicle-trips/entry",
    color: "text-blue-500" 
  },
  { 
    id: "trip-list", 
    label: "Trip List", 
    icon: List, 
    path: "/operations/vehicle-trips/list",
    color: "text-emerald-500" 
  },
  { 
    id: "shop-sales", 
    label: "Shop Sales", 
    icon: ShoppingBag, 
    path: "/operations/shop-sales",
    color: "text-amber-500" 
  },
  { 
    id: "rate-entry", 
    label: "Rate Entry", 
    icon: DollarSign, 
    path: "/operations/shop-sales/rate-entry",
    color: "text-purple-500" 
  },
  { 
    id: "collection", 
    label: "Collection", 
    icon: CreditCard, 
    path: "/operations/collections/entry",
    color: "text-teal-500" 
  },
  { 
    id: "pending-collections", 
    label: "Pending Collections", 
    icon: Clock, 
    path: "/operations/collections/pending",
    color: "text-rose-500" 
  },
  { 
    id: "collection-report", 
    label: "Collection Report", 
    icon: FileText, 
    path: "/operations/collections/report",
    color: "text-indigo-500" 
  },
  { 
    id: "fuel-expenses", 
    label: "Fuel Expenses", 
    icon: Fuel, 
    path: "/operations/fuel-expenses",
    color: "text-orange-500" 
  },
];

// -------- Main Layout Component --------
function OperationsDashboardPage() {
  const location = useLocation();
  const currentPath = location.pathname;

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
        <div className="flex items-center justify-center h-96 bg-white rounded-b-3xl border border-t-0 border-slate-200/80 shadow-xl shadow-slate-100/40 p-8">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 border border-blue-100 shadow-sm animate-bounce">
              📅
            </div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">Select Temporal Pipeline</h3>
            <p className="text-xs font-semibold text-slate-400 mt-2 leading-relaxed">
              Click the date range window located in the control row above to load real-time analytics indicators.
            </p>
          </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="w-full flex flex-col items-center justify-center py-24 space-y-4 bg-white rounded-b-2xl border border-t-0 border-slate-200/65">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
            <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin" />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">Synchronizing Analytics Engine...</p>
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-in fade-in duration-500 mt-6">
        <div className="relative z-10">
          <KPICards current={data} previous={previousData} rangeDays={rangeDays} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-start gap-4 w-full min-w-0">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Time-Series Performance</span>
              <h3 className="text-sm font-black text-slate-800 mt-0.5">Operational Output Trends</h3>
            </div>
            <div className="w-full">
              <TrendChart data={data.trendData} />
            </div>
          </div>
          
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-start gap-4 w-full min-w-0">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Credit Allocations</span>
              <h3 className="text-sm font-black text-slate-800 mt-0.5">Outstanding Shop Balances</h3>
            </div>
            <div className="w-full">
              <PendingCollectionsByShop data={data.pendingCollectionsByShop} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-start gap-4 w-full min-w-0">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Breakdown</span>
              <h3 className="text-sm font-black text-slate-800 mt-0.5">Collection Streams</h3>
            </div>
            <div className="w-full flex justify-center items-center py-2">
              <CollectionsPie data={data.collectionsByMode} />
            </div>
          </div>
          
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-start gap-4 w-full min-w-0">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Infrastructure Matrix</span>
                <h3 className="text-sm font-black text-slate-800 mt-0.5">Recent Transit Manifests</h3>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-500 flex items-center gap-1.5">
                <ArrowRightLeft size={10} className="text-slate-400" /> Auto-updates
              </div>
            </div>
            <div className="w-full overflow-x-auto text-xs rounded-xl border border-slate-100">
              <RecentTripsTable trips={data.recentTrips} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm w-full min-w-0">
          <div className="mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Supply Ecosystem Nodes</span>
            <h3 className="text-sm font-black text-slate-800 mt-0.5">Active Fleet & Asset Infrastructure</h3>
          </div>
          <ActiveCounts
            vehicles={data.activeVehicles || 0}
            drivers={data.activeDrivers || 0}
            helpers={data.activeHelpers || 0}
            shops={data.totalShops || 0}
            farms={data.totalFarms || 0}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="px-4 md:px-5 py-6 md:py-8 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      
      {/* Navigation Deck with Colored Icons */}
      <div className="bg-white border border-slate-200/60 rounded-t-2xl rounded-b-none p-1.5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3 relative z-20">
        <div className="flex items-center gap-1 overflow-x-auto py-0.5 px-0.5 scrollbar-none">
          <Link
            to="/operations"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
              isOverviewRoute 
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" 
                : "text-slate-400 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <Sparkles size={13} className={isOverviewRoute ? "text-amber-400" : "text-amber-400"} />
            Overview
          </Link>

          <div className="h-4 w-px bg-slate-200 mx-1 shrink-0" />

          {operationTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = !isOverviewRoute && (currentPath === tab.path || currentPath.startsWith(tab.path + "/"));
            return (
              <Link
                key={tab.id}
                to={tab.path}
                className={`
                  flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200
                  ${isActive
                    ? "bg-blue-50 text-blue-700 shadow-inner border border-blue-100/50"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }
                `}
              >
                <Icon 
                  className={`w-3.5 h-3.5 ${isActive ? "text-blue-600" : tab.color}`} 
                />
                {tab.label}
              </Link>
            );
          })}
        </div>

        {isOverviewRoute && (
          <div className="px-1 py-0.5 shrink-0 self-end md:self-auto">
            <RangeDatePicker
              startDate={startDate}
              endDate={endDate}
              onRangeChange={handleRangeChange}
              placement="bottom"
            />
          </div>
        )}
      </div>

      <div className="relative z-10 -mt-px">
        {isOverviewRoute ? renderOverviewContent() : <Outlet />}
      </div>
    </div>
  );
}

export default OperationsDashboardPage;