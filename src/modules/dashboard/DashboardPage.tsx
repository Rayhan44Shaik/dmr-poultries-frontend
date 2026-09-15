// src/modules/dashboard/DashboardPage.tsx
// Executive dashboard — KPIs, business overview, operations snapshot,
// pending collections, fleet status and recent activity.

import { Link } from "react-router-dom";
import {
  CreditCard,
  DatabaseZap,
  PackageOpen,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { useExecutiveDashboard } from "./hooks/useExecutiveDashboard";
import { useNotification } from "../../context/NotificationContext";
import { useI18n } from "../../i18n";
import { formatDateLong, greetingForHour } from "../../utils/format";
import { getCurrentUser } from "../../modules/settings/services";
import KpiCard from "./components/KpiCard";
import ChartCard from "./components/ChartCard";
import TodayTripsTable from "./components/TodayTripsTable";
import PendingCollectionsCard from "./components/PendingCollectionsCard";
import FleetStatusCard from "./components/FleetStatusCard";
import ActivityTimeline from "./components/ActivityTimeline";
import DashboardSkeleton from "./components/DashboardSkeleton";
import QuarterSnapshot from "./components/QuarterSnapshot";
import {
  DeliveryVolumeChart,
  SalesVsCollectionsChart,
  VehicleActivityDonut,
  WeeklyRevenueChart,
} from "./components/DashboardCharts";

function DashboardPage() {
  const { data, derived, loading, error, refetch, loadDemo, clearDemo, demoBusy } = useExecutiveDashboard();
  const { showNotification } = useNotification();
  const { t } = useI18n();

  const user = getCurrentUser();
  const greeting = `${greetingForHour()}, ${user?.name ?? "Owner"} 👋`;

  const handleLoadDemo = async () => {
    await loadDemo();
    showNotification(t("notification.saved_success"), "success");
  };

  const handleClearDemo = async () => {
    await clearDemo();
    showNotification(t("notification.data_loaded"), "info");
  };

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {/* ---------------------------------------------------------- */}
      {/* Greeting                                                     */}
      {/* ---------------------------------------------------------- */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between animate-fade-in-up">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-[22px] dark:text-white">{greeting}</h1>
            {data?.demoActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400">
                <Sparkles size={11} />
                {t("dashboard.sample_data")}
                <button
                  type="button"
                  onClick={() => void handleClearDemo()}
                  className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-amber-100 dark:hover:bg-amber-500/20"
                  aria-label={t("dashboard.remove_sample_data")}
                  title={t("dashboard.remove_sample_data")}
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {data?.sampleQuarter && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10.5px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300"
                title={`Sample data served by scripts/quarter-sample-data.mjs · ${data.sampleQuarter.fromDate} → ${data.sampleQuarter.toDate}`}
              >
                <DatabaseZap size={11} />
                {data.sampleQuarter.label}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t("dashboard.subtitle")}
          </p>
          {/* The sample dataset is generated in the ERP's business timezone, so
              when it is the source the page dates itself with the dataset's own
              business day — otherwise the header and every tile below it would
              disagree about which day "today" is. */}
          <p className="mt-0.5 text-xs font-medium text-slate-400 dark:text-slate-500">
            {formatDateLong(data?.sampleQuarter?.today ? new Date(`${data.sampleQuarter.today}T00:00:00`) : new Date())}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
{derived && !derived.hasAnyData && !data?.demoActive && (
            <button
              type="button"
              onClick={() => void handleLoadDemo()}
              disabled={demoBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {demoBusy ? <RefreshCw size={15} className="animate-spin" /> : <DatabaseZap size={15} className="text-amber-500" />}
              {demoBusy ? t("common.loading") : t("common.load")}
            </button>
          )}
          {error && (
            <button
              type="button"
              onClick={refetch}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <RefreshCw size={15} />
              {t("common.retry")}
            </button>
          )}
          <Link
            to="/operations?tab=collection"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <CreditCard size={15} />
            {t("common.record_collection")}
          </Link>
          <Link
            to="/operations?tab=trip-entry"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            <PackageOpen size={15} />
            {t("quick.new_trip")}
          </Link>
        </div>
      </div>

      {loading && !derived ? (
        <DashboardSkeleton />
      ) : derived ? (
        <>
          {/* ------------------------------------------------------ */}
          {/* Quarter to date                                         */}
          {/* ------------------------------------------------------ */}
          <QuarterSnapshot quarter={derived.quarter} />

          {/* ------------------------------------------------------ */}
          {/* KPI cards                                               */}
          {/* ------------------------------------------------------ */}
          {/* ALL EIGHT KPIs ON ONE LINE, no sideways dragging: a fixed 8-column
              grid gives every card 1/8 of the page width, so Shops · Farms ·
              Vehicles · Employees · Sales · Collections · Pending · Profit stay
              on a single row at any window size instead of wrapping onto a
              second one. The cards are taller and adapt (see KpiCard) so the
              label, value, delta chip and sparkline all still fit.
              `min-w-0` on the cells lets them shrink with the page instead of
              forcing overflow. */}
          <div className="grid min-w-0 grid-cols-8 gap-1.5 sm:gap-2">
            {derived.kpis.map((kpi, i) => (
              <div key={kpi.key} className="min-w-0">
                <KpiCard kpi={kpi} index={i} />
              </div>
            ))}
          </div>

          {/* ------------------------------------------------------ */}
          {/* Business overview                                       */}
          {/* ------------------------------------------------------ */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard
              title={t("dashboard.sales_vs_collections")}
              subtitle={t("dashboard.sales_vs_collections_sub")}
              action={{ label: t("quick.shop_sales"), path: "/operations?tab=shop-sales" }}
              className="xl:col-span-2"
            >
              <SalesVsCollectionsChart data={derived} />
            </ChartCard>
            <ChartCard title={t("dashboard.vehicle_activity")} subtitle={t("dashboard.vehicle_activity_sub")} action={{ label: t("fleet.fleet_status"), path: "/fleet?tab=analytics" }}>
              <VehicleActivityDonut data={derived} />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard title={t("dashboard.weekly_revenue")} subtitle={t("dashboard.weekly_revenue_sub")}>
              <WeeklyRevenueChart data={derived} />
            </ChartCard>
            <ChartCard title={t("dashboard.delivery_volume")} subtitle={t("dashboard.delivery_volume_sub")}>
              <DeliveryVolumeChart data={derived} />
            </ChartCard>
            <PendingCollectionsCard pending={derived.pendingCollections} totalAmount={derived.totals.pendingAmount} />
          </div>

          {/* ------------------------------------------------------ */}
          {/* Operations snapshot + recent activity                   */}
          {/* ------------------------------------------------------ */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <TodayTripsTable trips={derived.todayTrips.length > 0 ? derived.todayTrips : derived.latestTrips} isFallback={derived.todayTrips.length === 0} />
            </div>
            <ActivityTimeline items={derived.activity} />
          </div>

          {/* ------------------------------------------------------ */}
          {/* Fleet overview                                          */}
          {/* ------------------------------------------------------ */}
          <FleetStatusCard fleet={derived.fleet} />
        </>
) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-16 text-center dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("dashboard.something_wrong")}</p>
          <p className="text-xs text-slate-400">{t("common.try_again")}</p>
          <button
            type="button"
            onClick={refetch}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
          >
            <RefreshCw size={14} />
            {t("common.retry")}
          </button>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
