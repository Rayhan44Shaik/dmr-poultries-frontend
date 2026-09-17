// src/modules/operations/pages/OperationsPages.tsx

import React, { Suspense, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { retryableImport } from "../../../routes/lazyWithRetry";
import { useI18n } from "../../../i18n";
import { History, IndianRupee } from "lucide-react";
import { ORDERS_ROUTE_BASE } from "../../orders/routes/ordersRoutes";

const TripEntryPage = React.lazy(
  retryableImport(() => import("../vehicle-trips/pages/TripEntryPage")),
);
const TripListPage = React.lazy(
  retryableImport(() => import("../vehicle-trips/pages/TripListPage")),
);
const ShopSalesPage = React.lazy(
  retryableImport(() => import("../shop-sales/pages/ShopSalesPage")),
);
const RatesEntryPage = React.lazy(
  retryableImport(() => import("../shop-sales/pages/RatesEntryPage")),
);
const CollectionEntryPage = React.lazy(
  retryableImport(() => import("../collections/pages/CollectionEntryPage")),
);
const PendingCollectionsPage = React.lazy(
  retryableImport(() => import("../collections/pages/PendingCollectionsPage")),
);
const CollectionReportPage = React.lazy(
  retryableImport(() => import("../collections/pages/CollectionReportPage")),
);
const FuelExpensesPage = React.lazy(
  retryableImport(() => import("../fuel-expenses/pages/FuelExpensesPage")),
);
const MortalityEntryPage = React.lazy(
  retryableImport(() => import("../mortality/pages/MortalityEntryPage")),
);
const OrdersPage = React.lazy(
  retryableImport(() => import("../../orders/pages/OrdersPage")),
);

// Map tab keys (resolved from ?tab= sidebar deep-links / path aliases)
// to their child page components.
const tabComponents: Record<
  string,
  React.ComponentType<{ embedded?: boolean }>
> = {
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

/**
 * Chunk-load shell for the filter + table pages. While the lazy page code is
 * still downloading, the filter card and the titled table are already on
 * screen and only the record surface says it is loading — so a tab switch
 * behaves exactly like the page's own data load (no full-page placeholder,
 * no layout jump when the real page mounts).
 */
function FilterTableShell({
  title,
  loadingLabel,
  icon,
  tone,
  filterColumns,
}: {
  title: string;
  loadingLabel: string;
  icon: React.ReactNode;
  tone: "blue" | "emerald";
  filterColumns: number;
}) {
  const tile =
    tone === "blue"
      ? "bg-blue-50/70 border-blue-100 text-blue-500"
      : "bg-emerald-50 border-emerald-100 text-emerald-600";
  const bar =
    tone === "blue"
      ? "from-blue-50/60 via-white to-blue-50/40"
      : "from-emerald-50/60 via-white to-emerald-50/40";
  return (
    <div className="w-full space-y-5" role="status" aria-busy="true">
      <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: filterColumns }).map((_, i) => (
            <div key={i}>
              <div className="mb-1.5 h-3 w-20 rounded bg-slate-100" />
              <div className="h-10 rounded-lg border border-slate-200 bg-slate-50" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3.5 pt-1 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <div className="mb-1.5 h-3 w-14 rounded bg-slate-100" />
            <div className="h-10 rounded-lg border border-slate-200 bg-slate-50" />
          </div>
          <div className="lg:col-span-5">
            <div className="mb-1.5 h-3 w-16 rounded bg-slate-100" />
            <div className="h-10 rounded-lg border border-slate-200 bg-slate-50" />
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div
          className={`flex items-center border-b border-slate-100 bg-gradient-to-r px-6 py-3 ${bar}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl border shadow-inner ${tile}`}
            >
              {icon}
            </div>
            <h3 className="text-base font-bold tracking-tight text-slate-800">
              {title}
            </h3>
          </div>
        </div>
        <div className="py-16 text-center text-sm font-medium text-slate-400">
          <span className="inline-flex items-center gap-2">
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"
              aria-hidden="true"
            />
            {loadingLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

function OperationsPages() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

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
    // Orders is its own module with its own routes under /operations/orders/*.
    // All three pages resolve to this one entry on purpose: the module keeps
    // every page it has opened mounted (shared day data, pending work, filters),
    // so moving between its sidebar rows is instant and never refetches.
    if (pathname.startsWith(ORDERS_ROUTE_BASE)) return "orders";

    return "trip-entry"; // Default tab (the dashboard lives at /dashboard)
  }, [location.pathname, searchParams]);

  // /operations without a tab → Trip Entry; the old ?tab=overview deep link
  // (Operation Dashboard) now lives on the Overview dashboard at /dashboard.
  useEffect(() => {
    if (location.pathname === "/operations" && !searchParams.get("tab")) {
      navigate("/operations?tab=trip-entry", { replace: true });
    } else if (searchParams.get("tab") === "overview") {
      navigate("/dashboard", { replace: true });
    }
  }, [location.pathname, searchParams, navigate]);

  const ActiveComponent = useMemo(() => {
    return tabComponents[activeTab] ?? TripEntryPage;
  }, [activeTab]);

  return (
    <div
      className={
        activeTab === "orders"
          ? "w-full"
          : "w-full px-4 pb-8 pt-6 sm:px-5 lg:px-6"
      }
    >
      <div
        key={activeTab}
        className={
          activeTab === "orders"
            ? "w-full"
            : "mx-auto w-full max-w-[1600px] animate-page-pop"
        }
      >
        <Suspense
          fallback={
            activeTab === "trip-list" ? (
              <FilterTableShell
                title={t("ops.trip.trip_list")}
                loadingLabel={t("ops.trip.loading_trip_list")}
                icon={<History className="h-5 w-5" />}
                tone="blue"
                filterColumns={5}
              />
            ) : activeTab === "rate-entry" ? (
              <FilterTableShell
                title={t("ops.rate.title")}
                loadingLabel={t("ops.rate.loading_table")}
                icon={<IndianRupee className="h-5 w-5" />}
                tone="emerald"
                filterColumns={5}
              />
            ) : (
              <div
                role="status"
                aria-busy="true"
                className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500"
              >
                {t("common.loading")}
              </div>
            )
          }
        >
          <ActiveComponent embedded={true} />
        </Suspense>
      </div>
    </div>
  );
}

export default React.memo(OperationsPages);
