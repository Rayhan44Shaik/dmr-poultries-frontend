import React, { Suspense } from "react";
import { Navigate, Routes, Route } from "react-router-dom";
import { useI18n } from "../i18n";
import { lazyWithRetry } from "./lazyWithRetry";
import RequireAccess from "./RequireAccess";
import { useAuth } from "../providers/authContext";
import { landingPathForRole } from "../modules/auth/permissions";

/* ------------------------------------------------------------------ */
/* Route-level code splitting                                         */
/* Each application page is a separate chunk, so heavy pages are       */
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
  dashboard: lazyWithRetry(
    lazyShell(() => import("../modules/dashboard/pages/DashboardPage")),
  ),
  masters: lazyWithRetry(
    lazyShell(() => import("../modules/masters/pages/MastersPage")),
  ),
  mastersShops: lazyWithRetry(
    lazyShell(() => import("../modules/masters/shops/pages/ShopsPage")),
  ),
  mastersFarms: lazyWithRetry(
    lazyShell(() => import("../modules/masters/farms/pages/FarmsPage")),
  ),
  mastersVehicles: lazyWithRetry(
    lazyShell(() => import("../modules/masters/vehicles/pages/VehiclesPage")),
  ),
  mastersEmployees: lazyWithRetry(
    lazyShell(() => import("../modules/masters/employees/pages/EmployeesPage")),
  ),
  mastersBanks: lazyWithRetry(
    lazyShell(() => import("../modules/masters/banks/pages/BanksPage")),
  ),
  mastersBirdTypes: lazyWithRetry(
    lazyShell(
      () => import("../modules/masters/bird-types/pages/BirdTypesPage"),
    ),
  ),
  operations: lazyWithRetry(
    lazyShell(() => import("../modules/operations/pages/OperationsPages")),
  ),
  accounts: lazyWithRetry(
    lazyShell(() => import("../modules/accounts/pages/AccountsPage")),
  ),
  fleet: lazyWithRetry(
    lazyShell(() => import("../modules/fleet-operations/pages/FleetPages")),
  ),
  staff: lazyWithRetry(
    lazyShell(() => import("../modules/staff/pages/StaffPages")),
  ),
  reports: lazyWithRetry(
    lazyShell(() => import("../modules/reports/pages/ReportsDashboardPage")),
  ),
  settings: lazyWithRetry(
    lazyShell(() => import("../modules/settings/pages/SettingsPage")),
  ),
  supervisorMobile: lazyWithRetry(
    () => import("../modules/supervisor-mobile/pages/SupervisorMobilePage"),
  ),
};

function PageLoading() {
  const { t } = useI18n();
  return (
    <div
      className="flex h-dvh items-center justify-center bg-slate-100 text-sm font-semibold text-slate-500"
      aria-busy="true"
    >
      {t("common.loading")}
    </div>
  );
}

function NotFoundPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold tracking-tight text-slate-800">
          404
        </h1>
        <p className="mt-2 text-lg text-slate-600">
          {t("error.page_not_found")}
        </p>
        <a
          href={landingPathForRole(user?.role)}
          className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          {t("error.go_dashboard")}
        </a>
      </div>
    </div>
  );
}

/** `/` sends each role to the first page it is allowed to open. */
function RoleLanding() {
  const { user } = useAuth();
  return <Navigate to={landingPathForRole(user?.role)} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RoleLanding />} />

      {/* ============ SUPERVISOR MOBILE — Trip Entry Steps 1–5 only ============ */}
      <Route
        path="/mobile"
        element={
          <Suspense fallback={<PageLoading />}>
            <Navigate to="/operations" replace />
          </Suspense>
        }
      />
      <Route
        path="/mobile/trips"
        element={
          <Suspense fallback={<PageLoading />}>
            <Navigate to="/operations" replace />
          </Suspense>
        }
      />

      {/* ============ DASHBOARD ============ */}
      <Route
        path="/dashboard"
        element={
          <RequireAccess>
            <Suspense fallback={<PageLoading />}>
              <pages.dashboard />
            </Suspense>
          </RequireAccess>
        }
      />

      {/* ============ MASTERS ============ */}
      <Route
        path="/masters"
        element={
          <RequireAccess>
            <Suspense fallback={<PageLoading />}>
              <pages.masters />
            </Suspense>
          </RequireAccess>
        }
      />
      <Route
        path="/masters/shops"
        element={
          <RequireAccess>
            <Suspense fallback={<PageLoading />}>
              <pages.mastersShops />
            </Suspense>
          </RequireAccess>
        }
      />
      <Route
        path="/masters/farms"
        element={
          <RequireAccess>
            <Suspense fallback={<PageLoading />}>
              <pages.mastersFarms />
            </Suspense>
          </RequireAccess>
        }
      />
      <Route
        path="/masters/vehicles"
        element={
          <RequireAccess>
            <Suspense fallback={<PageLoading />}>
              <pages.mastersVehicles />
            </Suspense>
          </RequireAccess>
        }
      />
      <Route
        path="/masters/employees"
        element={
          <RequireAccess>
            <Suspense fallback={<PageLoading />}>
              <pages.mastersEmployees />
            </Suspense>
          </RequireAccess>
        }
      />
      <Route
        path="/masters/banks"
        element={
          <RequireAccess>
            <Suspense fallback={<PageLoading />}>
              <pages.mastersBanks />
            </Suspense>
          </RequireAccess>
        }
      />
      <Route
        path="/masters/bird-types"
        element={
          <RequireAccess>
            <Suspense fallback={<PageLoading />}>
              <pages.mastersBirdTypes />
            </Suspense>
          </RequireAccess>
        }
      />

      {/* ============ OPERATIONS ============
          One splat route serves the whole section: /operations (overview and the
          ?tab= deep links), its legacy path aliases, and the nested routes that
          modules own — e.g. Orders at /operations/orders/{collection,assignment,
          delivery-tracking} (see src/modules/orders/routes/ordersRoutes.ts).
          A single match means the section is never remounted while you move
          between its pages, so each module keeps its loaded data and filters. */}
      <Route
        path="/operations/*"
        element={
          <RequireAccess>
            <Suspense fallback={<PageLoading />}>
              <pages.operations />
            </Suspense>
          </RequireAccess>
        }
      />

      {/* ============ ACCOUNTS ============ */}
      <Route
        path="/accounts"
        element={
          <RequireAccess>
            <Suspense fallback={<PageLoading />}>
              <pages.accounts />
            </Suspense>
          </RequireAccess>
        }
      />
      <Route
        path="/accounts/*"
        element={
          <RequireAccess>
            <Suspense fallback={<PageLoading />}>
              <pages.accounts />
            </Suspense>
          </RequireAccess>
        }
      />

      {/* ============ FLEET ============ */}
      <Route
        path="/fleet"
        element={
          <RequireAccess>
            <Suspense fallback={<PageLoading />}>
              <pages.fleet />
            </Suspense>
          </RequireAccess>
        }
      />
      <Route
        path="/fleet/*"
        element={
          <RequireAccess>
            <Suspense fallback={<PageLoading />}>
              <pages.fleet />
            </Suspense>
          </RequireAccess>
        }
      />

      {/* ============ STAFF ============ */}
      <Route
        path="/staff"
        element={
          <RequireAccess>
            <Suspense fallback={<PageLoading />}>
              <pages.staff />
            </Suspense>
          </RequireAccess>
        }
      />
      <Route
        path="/staff/*"
        element={
          <RequireAccess>
            <Suspense fallback={<PageLoading />}>
              <pages.staff />
            </Suspense>
          </RequireAccess>
        }
      />

      {/* ============ REPORTS ============ */}
      <Route
        path="/reports"
        element={
          <RequireAccess>
            <Suspense fallback={<PageLoading />}>
              <pages.reports />
            </Suspense>
          </RequireAccess>
        }
      />
      <Route
        path="/reports/*"
        element={
          <RequireAccess>
            <Suspense fallback={<PageLoading />}>
              <pages.reports />
            </Suspense>
          </RequireAccess>
        }
      />

      {/* ===============================================
          🚀 SETTINGS - SINGLE PAGE ROUTE
          =============================================== */}
      <Route
        path="/settings"
        element={
          <RequireAccess>
            <Suspense fallback={<PageLoading />}>
              <pages.settings />
            </Suspense>
          </RequireAccess>
        }
      />
      <Route
        path="/settings/*"
        element={
          <RequireAccess>
            <Suspense fallback={<PageLoading />}>
              <pages.settings />
            </Suspense>
          </RequireAccess>
        }
      />

      {/* ============ 404 - Not Found ============ */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default AppRoutes;
