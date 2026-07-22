// src/modules/operations/pages/OperationsPages.tsx

import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sparkles,
  ClipboardList,
  List,
  ShoppingBag,
  DollarSign,
  CreditCard,
  Clock,
  FileText,
  Fuel,
} from "lucide-react";

import OperationsDashboardPage from "../dashboard/pages/OperationsDashboardPage";
import TripEntryPage from "../vehicle-trips/pages/TripEntryPage";
import TripListPage from "../vehicle-trips/pages/TripListPage";
import ShopSalesPage from "../shop-sales/pages/ShopSalesPage";
import RatesEntryPage from "../shop-sales/pages/RatesEntryPage";
import CollectionEntryPage from "../collections/pages/CollectionEntryPage";
import PendingCollectionsPage from "../collections/pages/PendingCollectionsPage";
import CollectionReportPage from "../collections/pages/CollectionReportPage";
import FuelExpensesPage from "../fuel-expenses/pages/FuelExpensesPage";

// Tabs configuration with Overview back as default
const tabs = [
  { key: "overview", label: "Overview", icon: Sparkles, color: "text-amber-500", component: OperationsDashboardPage },
  { key: "trip-entry", label: "Trip Entry", icon: ClipboardList, color: "text-blue-500", component: TripEntryPage },
  { key: "trip-list", label: "Trip List", icon: List, color: "text-emerald-500", component: TripListPage },
  { key: "rate-entry", label: "Rate Entry", icon: DollarSign, color: "text-purple-500", component: RatesEntryPage },
  { key: "shop-sales", label: "Shop Sales", icon: ShoppingBag, color: "text-amber-500", component: ShopSalesPage },
  { key: "collection", label: "Collection", icon: CreditCard, color: "text-teal-500", component: CollectionEntryPage },
  { key: "pending-collections", label: "Pending Collections", icon: Clock, color: "text-rose-500", component: PendingCollectionsPage },
  { key: "collection-report", label: "Collection Report", icon: FileText, color: "text-indigo-500", component: CollectionReportPage },
  { key: "fuel-expenses", label: "Fuel Expenses", icon: Fuel, color: "text-orange-500", component: FuelExpensesPage },
];

function OperationsPages() {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  // Read active tab from ?tab= query string
  const activeTab = useMemo(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) return tabParam;

    const pathname = location.pathname;
    if (pathname.includes("trip-entry")) return "trip-entry";
    if (pathname.includes("trip-list")) return "trip-list";
    if (pathname.includes("rate-entry")) return "rate-entry";
    if (pathname.includes("shop-sales")) return "shop-sales";
    if (pathname.includes("collections/entry")) return "collection";
    if (pathname.includes("collections/pending")) return "pending-collections";
    if (pathname.includes("collections/report")) return "collection-report";
    if (pathname.includes("fuel-expenses")) return "fuel-expenses";

    return "overview"; // Default tab
  }, [location.pathname, searchParams]);

  // Redirect to ?tab=overview when visiting /operations without parameters
  useEffect(() => {
    if (location.pathname === "/operations" && !searchParams.get("tab")) {
      navigate("/operations?tab=overview", { replace: true });
    }
  }, [location.pathname, searchParams, navigate]);

  const ActiveComponent = useMemo(() => {
    const found = tabs.find((tab) => tab.key === activeTab);
    return found ? found.component : OperationsDashboardPage;
  }, [activeTab]);

  const handleTabChange = (tabKey: string) => {
    navigate(`/operations?tab=${tabKey}`);
  };

  return (
    <div className="w-full pt-3 pb-6 space-y-4">
      {/* Tab Navigation Container (Scrollbar hidden via cross-browser Tailwind utility) */}
      <div className="bg-white border-y sm:border border-slate-200/90 sm:rounded-xl shadow-sm px-3 py-1.5 w-full">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`
                  flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 shrink-0
                  ${isActive
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }
                `}
              >
                <Icon
                  size={18}
                  className={isActive ? "text-blue-700" : tab.color}
                />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Embedded Sub-Component */}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <ActiveComponent embedded={true} />
      </div>
    </div>
  );
}

export default React.memo(OperationsPages);