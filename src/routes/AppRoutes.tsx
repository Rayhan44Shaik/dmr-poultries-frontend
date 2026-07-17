import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout/DashboardLayout";

import LoginPage from "../modules/auth/LoginPage";
import DashboardPage from "../modules/dashboard/DashboardPage";
import MastersPage from "../modules/masters/pages/MastersPage";
import ShopsPage from "../modules/masters/shops/pages/ShopsPage";
import FarmsPage from "../modules/masters/farms/pages/FarmsPage";
import VehiclesPage from "../modules/masters/vehicles/pages/VehiclesPage";
import EmployeesPage from "../modules/masters/employees/pages/EmployeesPage";
import BanksPage from "../modules/masters/banks/pages/BanksPage";
import BirdTypesPage from "../modules/masters/bird-types/pages/BirdTypesPage";

import TripEntryPage from "../modules/operations/vehicle-trips/pages/TripEntryPage";
import TripListPage from "../modules/operations/vehicle-trips/pages/TripListPage";
import ShopSalesPage from "../modules/operations/shop-sales/pages/ShopSalesPage";
import RatesEntryPage from "../modules/operations/shop-sales/pages/RatesEntryPage";
import FuelExpensesPage from "../modules/operations/fuel-expenses/pages/FuelExpensesPage";
import OperationsDashboardPage from "../modules/operations/dashboard/pages/OperationsDashboardPage";

import CollectionEntryPage from "../modules/operations/collections/pages/CollectionEntryPage";
import PendingCollectionsPage from "../modules/operations/collections/pages/PendingCollectionsPage";
import CollectionReportPage from "../modules/operations/collections/pages/CollectionReportPage";

// Accounts Module Imports
import AccountsDashboardPage from "../modules/accounts/pages/AccountsDashboardPage";
import FarmerPaymentsPage from "../modules/accounts/pages/FarmerPaymentsPage";
import CashBookPage from "../modules/accounts/pages/CashBookPage";
import BankBookPage from "../modules/accounts/pages/BankBookPage";
import VehicleEMIPage from "../modules/accounts/pages/VehicleEMIPage";
import OutstandingSummaryPage from "../modules/accounts/pages/OutstandingSummaryPage";
import ProfitLossPage from "../modules/accounts/pages/ProfitLossPage";

// Fleet Module Imports
import FleetDashboardPage from "../modules/fleet-operations/pages/FleetDashboardPage";
import MaintenanceEntryPage from "../modules/fleet-operations/pages/MaintenanceEntryPage";
import MaintenanceHistoryPage from "../modules/fleet-operations/pages/MaintenanceHistoryPage";
import DocumentsExpiryPage from "../modules/fleet-operations/pages/DocumentsExpiryPage";
import FastagDashboardPage from "../modules/fleet-operations/pages/FastagDashboardPage";
import EmiLoansPage from "../modules/fleet-operations/pages/EmiLoansPage";
import VehicleAnalyticsPage from "../modules/fleet-operations/pages/VehicleAnalyticsPage";
import VehicleReportsPage from "../modules/fleet-operations/pages/VehicleReportsPage";
import VehicleExpenseReportPage from "../modules/fleet-operations/pages/VehicleExpenseReportPage";

import StaffPage from "../modules/staff/pages/StaffPage";
import ReportsDashboardPage from "../modules/reports/pages/ReportsDashboardPage";
import SettingsPage from "../modules/settings/pages/SettingsPage";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Masters Module */}
        <Route path="/masters" element={<MastersPage />} />
        <Route path="/masters/shops" element={<ShopsPage />} />
        <Route path="/masters/farms" element={<FarmsPage />} />
        <Route path="/masters/vehicles" element={<VehiclesPage />} />
        <Route path="/masters/employees" element={<EmployeesPage />} />
        <Route path="/masters/banks" element={<BanksPage />} />
        <Route path="/masters/bird-types" element={<BirdTypesPage />} />

        {/* Operations Module */}
        <Route path="/operations" element={<Navigate to="/operations/overview" replace />} />
        <Route path="/operations/overview" element={<DashboardLayout><OperationsDashboardPage /></DashboardLayout>} />

        <Route path="/operations/vehicle-trips/entry" element={<TripEntryPage />} />
        <Route path="/operations/vehicle-trips/list" element={<TripListPage />} />

        <Route
          path="/operations/shop-sales"
          element={
            <DashboardLayout>
              <ShopSalesPage />
            </DashboardLayout>
          }
        />
        <Route
          path="/operations/shop-sales/rate-entry"
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

        {/* Accounts Module - Main Routes */}
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

        {/* ═══════════════════════════════════════ */}
        {/* FLEET OPERATIONS MODULE - 9 PAGES */}
        {/* ═══════════════════════════════════════ */}
        
        <Route path="/fleet" element={<Navigate to="/fleet/dashboard" replace />} />
        
        <Route
          path="/fleet/dashboard"
          element={
            <DashboardLayout>
              <FleetDashboardPage />
            </DashboardLayout>
          }
        />
        
        <Route
          path="/fleet/maintenance/entry"
          element={
            <DashboardLayout>
              <MaintenanceEntryPage />
            </DashboardLayout>
          }
        />
        
        <Route
          path="/fleet/maintenance/history"
          element={
            <DashboardLayout>
              <MaintenanceHistoryPage />
            </DashboardLayout>
          }
        />
        
        <Route
          path="/fleet/documents"
          element={
            <DashboardLayout>
              <DocumentsExpiryPage />
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
          path="/fleet/expense-report"
          element={
            <DashboardLayout>
              <VehicleExpenseReportPage />
            </DashboardLayout>
          }
        />

        {/* ═══════════════════════════════════════ */}
        {/* OTHER MODULES */}
        {/* ═══════════════════════════════════════ */}
        <Route path="/vehicles" element={<Navigate to="/fleet/dashboard" replace />} />
        <Route path="/staff" element={<StaffPage />} />
        
        {/* ✅ Reports Dashboard – WITH SIDEBAR */}
        <Route
          path="/reports"
          element={
            <DashboardLayout>
              <ReportsDashboardPage />
            </DashboardLayout>
          }
        />
        
        <Route path="/settings" element={<SettingsPage />} />

        {/* 404 Not Found */}
        <Route path="*" element={<div className="p-8 text-center text-slate-500">Page not found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;