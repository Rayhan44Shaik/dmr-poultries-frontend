import { lazy, Suspense } from 'react';
import { retryableImport } from '../../routes/lazyWithRetry';
import type { RouteObject } from 'react-router-dom';
import LoadingSkeleton from './components/common/LoadingSkeleton';

// Production Fleet routes + FASTAG static placeholder (no data fetch in that page).
const MaintenanceEntryPage = lazy(retryableImport(() => import('./pages/MaintenanceEntryPage')));
const MaintenanceHistoryPage = lazy(retryableImport(() => import('./pages/MaintenanceHistoryPage')));
const DocumentsExpiryPage = lazy(retryableImport(() => import('./pages/DocumentsExpiryPage')));
const FastagDashboardPage = lazy(retryableImport(() => import('./pages/FastagDashboardPage')));
const EmiLoansPage = lazy(retryableImport(() => import('./pages/EmiLoansPage')));
const VehicleAnalyticsPage = lazy(retryableImport(() => import('./pages/VehicleAnalyticsPage')));

// DEFERRED / FUTURE WORK — page files preserved; not registered in active routes:
// const FleetDashboardPage = lazy(retryableImport(() => import('./pages/FleetDashboardPage')));
// const VehicleReportsPage = lazy(retryableImport(() => import('./pages/VehicleReportsPage')));
// const VehicleExpenseReportPage = lazy(retryableImport(() => import('./pages/VehicleExpenseReportPage')));

// Wrap with Suspense – now accepts any component type
const withSuspense = (Component: React.ComponentType<any>) => (
  <Suspense fallback={<LoadingSkeleton count={3} />}>
    <Component />
  </Suspense>
);

export const fleetRoutes: RouteObject[] = [
  // DEFERRED: { path: 'fleet/dashboard', element: withSuspense(FleetDashboardPage) },
  {
    path: 'fleet/maintenance/entry',
    element: withSuspense(MaintenanceEntryPage),
  },
  {
    path: 'fleet/maintenance/history',
    element: withSuspense(MaintenanceHistoryPage),
  },
  {
    path: 'fleet/documents',
    element: withSuspense(DocumentsExpiryPage),
  },
  {
    path: 'fleet/fastag',
    element: withSuspense(FastagDashboardPage),
  },
  {
    path: 'fleet/emi',
    element: withSuspense(EmiLoansPage),
  },
  {
    path: 'fleet/analytics',
    element: withSuspense(VehicleAnalyticsPage),
  },
  // DEFERRED: { path: 'fleet/reports', element: withSuspense(VehicleReportsPage) },
  // DEFERRED: { path: 'fleet/expense-report', element: withSuspense(VehicleExpenseReportPage) },
];