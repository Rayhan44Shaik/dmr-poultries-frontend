// src/modules/operations/pages/OperationsPages.tsx

import React, { Suspense, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { retryableImport } from "../../../routes/lazyWithRetry";
import { useI18n } from "../../../i18n";

const OperationsDashboardPage = React.lazy(retryableImport(() => import("../dashboard/pages/OperationsDashboardPage")));
const TripEntryPage = React.lazy(retryableImport(() => import("../vehicle-trips/pages/TripEntryPage")));
const TripListPage = React.lazy(retryableImport(() => import("../vehicle-trips/pages/TripListPage")));
const ShopSalesPage = React.lazy(retryableImport(() => import("../shop-sales/pages/ShopSalesPage")));
const RatesEntryPage = React.lazy(retryableImport(() => import("../shop-sales/pages/RatesEntryPage")));
const CollectionEntryPage = React.lazy(retryableImport(() => import("../collections/pages/CollectionEntryPage")));
const PendingCollectionsPage = React.lazy(retryableImport(() => import("../collections/pages/PendingCollectionsPage")));
const CollectionReportPage = React.lazy(retryableImport(() => import("../collections/pages/CollectionReportPage")));
const FuelExpensesPage = React.lazy(retryableImport(() => import("../fuel-expenses/pages/FuelExpensesPage")));
const MortalityEntryPage = React.lazy(retryableImport(() => import("../mortality/pages/MortalityEntryPage")));
const OrdersPage = React.lazy(retryableImport(() => import("../orders/pages/OrdersPage")));

// Map tab keys (resolved from ?tab= sidebar deep-links / path aliases)
// to their child page components.
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
  orders: OrdersPage,
};

function OperationsPages() {
  const { t } = useI18n();
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
    if (pathname.includes("orders")) return "orders";

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

  return (
    <div className={activeTab === "orders" ? "w-full" : "w-full px-4 pb-8 pt-6 sm:px-5 lg:px-6"}>
      <div key={activeTab} className={activeTab === "orders" ? "w-full" : "mx-auto w-full max-w-[1600px] animate-page-pop"}>
        <Suspense fallback={
          <div role="status" aria-busy="true" className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            {t("common.loading")}
          </div>
        }>
          <ActiveComponent embedded={true} />
        </Suspense>
      </div>
    </div>
  );
}

export default React.memo(OperationsPages);
