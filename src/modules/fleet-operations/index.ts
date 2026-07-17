// Export all pages
export { default as FleetDashboardPage } from './pages/FleetDashboardPage';
export { default as MaintenanceEntryPage } from './pages/MaintenanceEntryPage';
export { default as MaintenanceHistoryPage } from './pages/MaintenanceHistoryPage';
export { default as DocumentsExpiryPage } from './pages/DocumentsExpiryPage';
export { default as FastagDashboardPage } from './pages/FastagDashboardPage';
export { default as EmiLoansPage } from './pages/EmiLoansPage';
export { default as VehicleAnalyticsPage } from './pages/VehicleAnalyticsPage';
export { default as VehicleReportsPage } from './pages/VehicleReportsPage';
export { default as VehicleExpenseReportPage } from './pages/VehicleExpenseReportPage';

// Export routes
export { fleetRoutes } from './routes';

// Export types
export * from './types';

// Export utils
export * from './utils/formatters';
export * from './utils/constants';
export * from './utils/helpers';
export * from './utils/fleetExport';