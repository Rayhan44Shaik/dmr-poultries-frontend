import { lazy } from 'react';
import { retryableImport } from '../../routes/lazyWithRetry';

// Component-only lazy page bindings for the Fleet routes.
// Route metadata (paths, order, Suspense fallback, DEFERRED notes) lives in
// `./fleetRouteConfig`, which imports these bindings. Isolating the lazy
// components here keeps both modules free of
// react-refresh/only-export-components findings without changing behaviour.

// Production Fleet pages + FASTAG static placeholder (no data fetch in that page).
export const MaintenanceEntryPage = lazy(retryableImport(() => import('./pages/MaintenanceEntryPage')));
export const MaintenanceHistoryPage = lazy(retryableImport(() => import('./pages/MaintenanceHistoryPage')));
export const DocumentsExpiryPage = lazy(retryableImport(() => import('./pages/DocumentsExpiryPage')));
export const FastagDashboardPage = lazy(retryableImport(() => import('./pages/FastagDashboardPage')));
export const EmiLoansPage = lazy(retryableImport(() => import('./pages/EmiLoansPage')));
export const VehicleAnalyticsPage = lazy(retryableImport(() => import('./pages/VehicleAnalyticsPage')));
