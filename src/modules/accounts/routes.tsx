import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

// Lazy load pages for code splitting
const AccountsDashboardPage = lazy(() => import('./pages/AccountsDashboardPage'));
const FarmerPaymentsPage = lazy(() => import('./pages/FarmerPaymentsPage'));
const CashBookPage = lazy(() => import('./pages/CashBookPage'));
const BankBookPage = lazy(() => import('./pages/BankBookPage'));
const VehicleEMIPage = lazy(() => import('./pages/VehicleEMIPage'));
const OutstandingSummaryPage = lazy(() => import('./pages/OutstandingSummaryPage'));
const ProfitLossPage = lazy(() => import('./pages/ProfitLossPage'));

export const accountsRoutes: RouteObject[] = [
  {
    path: 'accounts/dashboard',
    element: <AccountsDashboardPage />,
  },
  {
    path: 'accounts/farmer-payments',
    element: <FarmerPaymentsPage />,
  },
  {
    path: 'accounts/cash-book',
    element: <CashBookPage />,
  },
  {
    path: 'accounts/bank-book',
    element: <BankBookPage />,
  },
  {
    path: 'accounts/vehicle-emi',
    element: <VehicleEMIPage />,
  },
  {
    path: 'accounts/outstanding-summary',
    element: <OutstandingSummaryPage />,
  },
  {
    path: 'accounts/profit-loss',
    element: <ProfitLossPage />,
  },
];