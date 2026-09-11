import React, { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { useI18n } from "../i18n";
import { lazyWithRetry } from "./lazyWithRetry";

// Auth — eager: the "/" route must paint as fast as possible.
import LoginPage from "../modules/auth/LoginPage";

/* ------------------------------------------------------------------ */
/* Route-level code splitting                                          */
/* Every page other than the login screen is a separate chunk, so the  */
/* first paint (login) loads a tiny module graph and heavy pages are   */
/* fetched only when they are actually navigated to. The dashboard     */
/* shell (sidebar/header) is also deferred: it is part of the lazy     */
/* route chunk, so the login page never pulls in the app shell or any  */
/* module-level API side effects.                                      */
/* ------------------------------------------------------------------ */
type PageModule = { default: React.ComponentType };

/**
 * Build a lazy loader that resolves both the shared dashboard shell and
 * the page it hosts, so neither is imported until the route matches.
 */
function lazyShell(page: () => Promise<PageModule>) {
  return () =>
    Promise.all([
      import("../layouts/DashboardLayout/DashboardLayout"),
      page(),
    ]).then(([{ default: Shell }, { default: Page }]) => ({
      default: function ShellPage() {
        return (
          <Shell>
            <Page />
          </Shell>
        );
      },
    }));
}

// Lazy components are created once at module level (stable identity).
const pages = {
  approvals: lazyWithRetry(lazyShell(() => import("../modules/approvals/pages/ApprovalsPage"))),
  dashboard: lazyWithRetry(lazyShell(() => import("../modules/operations/dashboard/pages/OperationsDashboardPage"))),
  masters: lazyWithRetry(lazyShell(() => import("../modules/masters/pages/MastersPage"))),
  mastersShops: lazyWithRetry(lazyShell(() => import("../modules/masters/shops/pages/ShopsPage"))),
  mastersFarms: lazyWithRetry(lazyShell(() => import("../modules/masters/farms/pages/FarmsPage"))),
  mastersVehicles: lazyWithRetry(lazyShell(() => import("../modules/masters/vehicles/pages/VehiclesPage"))),
  mastersEmployees: lazyWithRetry(lazyShell(() => import("../modules/masters/employees/pages/EmployeesPage"))),
  mastersBanks: lazyWithRetry(lazyShell(() => import("../modules/masters/banks/pages/BanksPage"))),
  mastersBirdTypes: lazyWithRetry(lazyShell(() => import("../modules/masters/bird-types/pages/BirdTypesPage"))),
  operations: lazyWithRetry(lazyShell(() => import("../modules/operations/pages/OperationsPages"))),
  accounts: lazyWithRetry(lazyShell(() => import("../modules/accounts/pages/AccountsPage"))),
  fleet: lazyWithRetry(lazyShell(() => import("../modules/fleet-operations/pages/FleetPages"))),
  staff: lazyWithRetry(lazyShell(() => import("../modules/staff/pages/StaffPages"))),
  reports: lazyWithRetry(lazyShell(() => import("../modules/reports/pages/ReportsDashboardPage"))),
  settings: lazyWithRetry(lazyShell(() => import("../modules/settings/pages/SettingsPage"))),
  supervisorMobile: lazyWithRetry(() => import("../modules/supervisor-mobile/pages/SupervisorMobilePage")),
};

function PageLoading() {
  const { t } = useI18n();
  return (
    <div className="flex h-dvh items-center justify-center bg-slate-100 text-sm font-semibold text-slate-500" aria-busy="true">
      {t("common.loading")}
    </div>
  );
}

function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold tracking-tight text-slate-800">404</h1>
        <p className="mt-2 text-lg text-slate-600">{t("error.page_not_found")}</p>
        <a
          href="/dashboard"
          className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          {t("error.go_dashboard")}
        </a>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth - No Layout */}
      <Route path="/" element={<LoginPage />} />

      {/* ============ SUPERVISOR MOBILE — Trip Entry Steps 1–5 only ============ */}
      <Route
        path="/mobile"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.supervisorMobile />
          </Suspense>
        }
      />
      <Route
        path="/mobile/trips"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.supervisorMobile />
          </Suspense>
        }
      />

      {/* ============ APPROVAL CENTER ============ */}
      <Route
        path="/approvals"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.approvals />
          </Suspense>
        }
      />

      {/* ============ DASHBOARD ============ */}
      <Route
        path="/dashboard"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.dashboard />
          </Suspense>
        }
      />

      {/* ============ MASTERS ============ */}
      <Route
        path="/masters"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.masters />
          </Suspense>
        }
      />
      <Route
        path="/masters/shops"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.mastersShops />
          </Suspense>
        }
      />
      <Route
        path="/masters/farms"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.mastersFarms />
          </Suspense>
        }
      />
      <Route
        path="/masters/vehicles"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.mastersVehicles />
          </Suspense>
        }
      />
      <Route
        path="/masters/employees"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.mastersEmployees />
          </Suspense>
        }
      />
      <Route
        path="/masters/banks"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.mastersBanks />
          </Suspense>
        }
      />
      <Route
        path="/masters/bird-types"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.mastersBirdTypes />
          </Suspense>
        }
      />

      {/* ============ OPERATIONS ============ */}
      <Route
        path="/operations"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.operations />
          </Suspense>
        }
      />
      <Route
        path="/operations/*"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.operations />
          </Suspense>
        }
      />

      {/* ============ ACCOUNTS ============ */}
      <Route
        path="/accounts"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.accounts />
          </Suspense>
        }
      />
      <Route
        path="/accounts/*"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.accounts />
          </Suspense>
        }
      />

      {/* ============ FLEET ============ */}
      <Route
        path="/fleet"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.fleet />
          </Suspense>
        }
      />
      <Route
        path="/fleet/*"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.fleet />
          </Suspense>
        }
      />

      {/* ============ STAFF ============ */}
      <Route
        path="/staff"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.staff />
          </Suspense>
        }
      />
      <Route
        path="/staff/*"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.staff />
          </Suspense>
        }
      />

      {/* ============ REPORTS ============ */}
      <Route
        path="/reports"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.reports />
          </Suspense>
        }
      />
      <Route
        path="/reports/*"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.reports />
          </Suspense>
        }
      />

      {/* ===============================================
          🚀 SETTINGS - SINGLE PAGE ROUTE
          =============================================== */}
      <Route
        path="/settings"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.settings />
          </Suspense>
        }
      />
      <Route
        path="/settings/*"
        element={
          <Suspense fallback={<PageLoading />}>
            <pages.settings />
          </Suspense>
        }
      />

      {/* ============ 404 - Not Found ============ */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default AppRoutes;
