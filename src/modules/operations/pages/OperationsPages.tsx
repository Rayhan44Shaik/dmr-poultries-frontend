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
  Bird,
} from "lucide-react";

import ModuleTabs, { type ModuleTab } from "../../../ui/ModuleTabs";
import OperationsDashboardPage from "../dashboard/pages/OperationsDashboardPage";
import TripEntryPage from "../vehicle-trips/pages/TripEntryPage";
import TripListPage from "../vehicle-trips/pages/TripListPage";
import ShopSalesPage from "../shop-sales/pages/ShopSalesPage";
import RatesEntryPage from "../shop-sales/pages/RatesEntryPage";
import CollectionEntryPage from "../collections/pages/CollectionEntryPage";
import PendingCollectionsPage from "../collections/pages/PendingCollectionsPage";
import CollectionReportPage from "../collections/pages/CollectionReportPage";
import FuelExpensesPage from "../fuel-expenses/pages/FuelExpensesPage";
import MortalityEntryPage from "../mortality/pages/MortalityEntryPage";

// Tabs configuration with Overview back as default
const tabs: ModuleTab[] = [
  { key: "overview", label: "Daily Report", icon: Sparkles, color: "text-amber-500" },
  { key: "trip-entry", label: "Trip Entry", icon: ClipboardList, color: "text-emerald-500" },
  { key: "trip-list", label: "Trip List", icon: List, color: "text-sky-500" },
  { key: "rate-entry", label: "Rate Entry", icon: DollarSign, color: "text-violet-500" },
  { key: "shop-sales", label: "Shop Sales", icon: ShoppingBag, color: "text-amber-500" },
  { key: "collection", label: "Collection Entry", icon: CreditCard, color: "text-teal-500" },
  { key: "pending-collections", label: "Pending Collections", icon: Clock, color: "text-rose-500" },
  { key: "collection-report", label: "Collection Report", icon: FileText, color: "text-indigo-500" },
  { key: "mortality", label: "Mortality Entry", icon: Bird, color: "text-rose-500" },
  { key: "fuel-expenses", label: "Fuel Expenses", icon: Fuel, color: "text-orange-500" },
];

// Map tab keys to their components
const tabComponents: Record<string, React.ComponentType<{ embedded?: boolean }>> = {
  overview: OperationsDashboardPage,
  "trip-entry": TripEntryPage,
  "trip-list": TripListPage,
  "rate-entry": RatesEntryPage,
  "shop-sales": ShopSalesPage,
  collection: CollectionEntryPage,
  "pending-collections": PendingCollectionsPage,
  "collection-report": CollectionReportPage,
  mortality: MortalityEntryPage,
  "fuel-expenses": FuelExpensesPage,
};

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
    if (pathname.includes("mortality")) return "mortality";
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
    return tabComponents[activeTab] ?? OperationsDashboardPage;
  }, [activeTab]);

  const handleTabChange = (tabKey: string) => {
    navigate(`/operations?tab=${tabKey}`);
  };

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-4 pb-6">
      <ModuleTabs tabs={tabs} activeKey={activeTab} onChange={handleTabChange} className="px-4 pt-3 sm:px-6 lg:px-8" />

      {/* Embedded Sub-Component */}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <ActiveComponent embedded={true} />
      </div>
    </div>
  );
}

export default React.memo(OperationsPages);