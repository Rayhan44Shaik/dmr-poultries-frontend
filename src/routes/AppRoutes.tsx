// src/routes/AppRoutes.tsx

import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout/DashboardLayout";

// Auth
import LoginPage from "../modules/auth/LoginPage";

// Dashboard
import DashboardPage from "../modules/dashboard/DashboardPage";

// Masters Module
import MastersPage from "../modules/masters/pages/MastersPage";
import ShopsPage from "../modules/masters/shops/pages/ShopsPage";
import FarmsPage from "../modules/masters/farms/pages/FarmsPage";
import VehiclesPage from "../modules/masters/vehicles/pages/VehiclesPage";
import EmployeesPage from "../modules/masters/employees/pages/EmployeesPage";
import BanksPage from "../modules/masters/banks/pages/BanksPage";
import BirdTypesPage from "../modules/masters/bird-types/pages/BirdTypesPage";

// Operations Module
import OperationsDashboardPage from "../modules/operations/dashboard/pages/OperationsDashboardPage";
import TripEntryPage from "../modules/operations/vehicle-trips/pages/TripEntryPage";
import TripListPage from "../modules/operations/vehicle-trips/pages/TripListPage";
import ShopSalesPage from "../modules/operations/shop-sales/pages/ShopSalesPage";
import RatesEntryPage from "../modules/operations/shop-sales/pages/RatesEntryPage";
import CollectionEntryPage from "../modules/operations/collections/pages/CollectionEntryPage";
import PendingCollectionsPage from "../modules/operations/collections/pages/PendingCollectionsPage";
import CollectionReportPage from "../modules/operations/collections/pages/CollectionReportPage";
import FuelExpensesPage from "../modules/operations/fuel-expenses/pages/FuelExpensesPage";

// Accounts Module
import AccountsDashboardPage from "../modules/accounts/pages/AccountsDashboardPage";
import FarmerPaymentsPage from "../modules/accounts/pages/FarmerPaymentsPage";
import CashBookPage from "../modules/accounts/pages/CashBookPage";
import BankBookPage from "../modules/accounts/pages/BankBookPage";
import VehicleEMIPage from "../modules/accounts/pages/VehicleEMIPage";
import OutstandingSummaryPage from "../modules/accounts/pages/OutstandingSummaryPage";
import ProfitLossPage from "../modules/accounts/pages/ProfitLossPage";

// Fleet Module
import FleetLayout from "../modules/fleet-operations/pages/FleetLayout";
import MaintenanceEntryPage from "../modules/fleet-operations/pages/MaintenanceEntryPage";
import MaintenanceHistoryPage from "../modules/fleet-operations/pages/MaintenanceHistoryPage";
import DocumentsExpiryPage from "../modules/fleet-operations/pages/DocumentsExpiryPage";
import FastagDashboardPage from "../modules/fleet-operations/pages/FastagDashboardPage";
import EmiLoansPage from "../modules/fleet-operations/pages/EmiLoansPage";
import VehicleAnalyticsPage from "../modules/fleet-operations/pages/VehicleAnalyticsPage";
import VehicleReportsPage from "../modules/fleet-operations/pages/VehicleReportsPage";
import VehicleExpenseReportPage from "../modules/fleet-operations/pages/VehicleExpenseReportPage";

// Staff, Reports, Settings
import StaffMasterPage from "../modules/staff/pages/StaffMasterPage";
import ReportsDashboardPage from "../modules/reports/pages/ReportsDashboardPage";
import SettingsPage from "../modules/settings/pages/SettingsPage";

function AppRoutes() {
  return (
    <Routes>
      {/* Auth - No Layout */}
      <Route path="/" element={<LoginPage />} />

      {/* ============ DASHBOARD - With Layout ============ */}
      <Route 
        path="/dashboard" 
        element={
          <DashboardLayout>
            <DashboardPage />
          </DashboardLayout>
        } 
      />

      {/* ============ MASTERS - With Layout ============ */}
      <Route 
        path="/masters" 
        element={
          <DashboardLayout>
            <MastersPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/masters/shops" 
        element={
          <DashboardLayout>
            <ShopsPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/masters/farms" 
        element={
          <DashboardLayout>
            <FarmsPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/masters/vehicles" 
        element={
          <DashboardLayout>
            <VehiclesPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/masters/employees" 
        element={
          <DashboardLayout>
            <EmployeesPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/masters/banks" 
        element={
          <DashboardLayout>
            <BanksPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/masters/bird-types" 
        element={
          <DashboardLayout>
            <BirdTypesPage />
          </DashboardLayout>
        } 
      />

      {/* ============ OPERATIONS - With Layout ============ */}
      <Route 
        path="/operations" 
        element={
          <DashboardLayout>
            <OperationsDashboardPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/operations/overview" 
        element={
          <DashboardLayout>
            <OperationsDashboardPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/operations/vehicle-trips/entry" 
        element={
          <DashboardLayout>
            <TripEntryPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/operations/vehicle-trips/list" 
        element={
          <DashboardLayout>
            <TripListPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/operations/shop/shop-sales" 
        element={
          <DashboardLayout>
            <ShopSalesPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/operations/shop/rate-entry" 
        element={
          <DashboardLayout>
            <RatesEntryPage embedded={true} />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/operations/collections/entry" 
        element={
          <DashboardLayout>
            <CollectionEntryPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/operations/collections/pending" 
        element={
          <DashboardLayout>
            <PendingCollectionsPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/operations/collections/report" 
        element={
          <DashboardLayout>
            <CollectionReportPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/operations/fuel-expenses" 
        element={
          <DashboardLayout>
            <FuelExpensesPage />
          </DashboardLayout>
        } 
      />

      {/* ============ ACCOUNTS - With Layout ============ */}
      <Route path="/accounts" element={<Navigate to="/accounts/dashboard" replace />} />
      <Route 
        path="/accounts/dashboard" 
        element={
          <DashboardLayout>
            <AccountsDashboardPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/accounts/farmer-payments" 
        element={
          <DashboardLayout>
            <FarmerPaymentsPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/accounts/cash-book" 
        element={
          <DashboardLayout>
            <CashBookPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/accounts/bank-book" 
        element={
          <DashboardLayout>
            <BankBookPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/accounts/vehicle-emi" 
        element={
          <DashboardLayout>
            <VehicleEMIPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/accounts/outstanding-summary" 
        element={
          <DashboardLayout>
            <OutstandingSummaryPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/accounts/profit-loss" 
        element={
          <DashboardLayout>
            <ProfitLossPage />
          </DashboardLayout>
        } 
      />

      {/* ============ FLEET - With Layout ============ */}
      <Route 
        path="/fleet" 
        element={
          <DashboardLayout>
            <FleetLayout />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/fleet/history" 
        element={
          <DashboardLayout>
            <MaintenanceHistoryPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/fleet/entry" 
        element={
          <DashboardLayout>
            <MaintenanceEntryPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/fleet/permits" 
        element={
          <DashboardLayout>
            <DocumentsExpiryPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/fleet/emi" 
        element={
          <DashboardLayout>
            <EmiLoansPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/fleet/analytics" 
        element={
          <DashboardLayout>
            <VehicleAnalyticsPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/fleet/reports" 
        element={
          <DashboardLayout>
            <VehicleReportsPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/fleet/fastag" 
        element={
          <DashboardLayout>
            <FastagDashboardPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/fleet/expenses" 
        element={
          <DashboardLayout>
            <VehicleExpenseReportPage />
          </DashboardLayout>
        } 
      />

      {/* ============ STAFF - With Layout ============ */}
      <Route 
        path="/staff" 
        element={
          <DashboardLayout>
            <StaffMasterPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/staff/*" 
        element={
          <DashboardLayout>
            <StaffMasterPage />
          </DashboardLayout>
        } 
      />

      {/* ============ REPORTS - With Layout ============ */}
      <Route 
        path="/reports" 
        element={
          <DashboardLayout>
            <ReportsDashboardPage />
          </DashboardLayout>
        } 
      />

      {/* ============ SETTINGS - With Layout ============ */}
      <Route 
        path="/settings" 
        element={
          <DashboardLayout>
            <SettingsPage />
          </DashboardLayout>
        } 
      />

      {/* ============ 404 - Not Found ============ */}
      <Route 
        path="*" 
        element={
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-slate-800">404</h1>
              <p className="text-lg text-slate-600 mt-2">Page not found</p>
              <a href="/dashboard" className="mt-4 inline-block text-blue-600 hover:underline">
                Go to Dashboard
              </a>
            </div>
          </div>
        } 
      />
    </Routes>
  );
}

export default AppRoutes;