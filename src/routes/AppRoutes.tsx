import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Masters */}
        <Route path="/masters" element={<MastersPage />} />
        <Route path="/masters/shops" element={<ShopsPage />} />
        <Route path="/masters/farms" element={<FarmsPage />} />
        <Route path="/masters/vehicles" element={<VehiclesPage />} />
        <Route path="/masters/employees" element={<EmployeesPage />} />
        <Route path="/masters/banks" element={<BanksPage />} />
        <Route path="/masters/bird-types" element={<BirdTypesPage />} />

        {/* Operations */}
        <Route
          path="/operations"
          element={
            <DashboardLayout>
              <OperationsDashboardPage />
            </DashboardLayout>
          }
        >
          <Route index element={<Navigate to="/operations/overview" replace />} />
          <Route path="overview" element={null} />
          <Route path="vehicle-trips/entry" element={<TripEntryPage />} />
          <Route path="vehicle-trips/list" element={<TripListPage />} />
          <Route path="shop-sales" element={<ShopSalesPage />} />
          <Route path="shop-sales/rate-entry" element={<RatesEntryPage embedded={true} />} />
          <Route path="collections/entry" element={<CollectionEntryPage />} />
          <Route path="collections/pending" element={<PendingCollectionsPage />} />
          <Route path="collections/report" element={<CollectionReportPage />} />
          <Route path="fuel-expenses" element={<FuelExpensesPage />} />
          <Route path="*" element={<Navigate to="/operations/overview" replace />} />
        </Route>

        {/* Accounts */}
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

        {/* Fleet – with layout (sidebar is rendered via DashboardLayout) */}
        <Route
          path="/fleet"
          element={
            <DashboardLayout>
              <FleetLayout />
            </DashboardLayout>
          }
        >
          <Route index element={<Navigate to="/fleet/history" replace />} />
          <Route path="history" element={<MaintenanceHistoryPage />} />
          <Route path="entry" element={<MaintenanceEntryPage />} />
          <Route path="permits" element={<DocumentsExpiryPage />} />
          <Route path="emi" element={<EmiLoansPage />} />
          <Route path="analytics" element={<VehicleAnalyticsPage />} />
          <Route path="reports" element={<VehicleReportsPage />} />
          <Route path="fastag" element={<FastagDashboardPage />} />
          <Route path="expenses" element={<VehicleExpenseReportPage />} />
        </Route>

        {/* Staff */}
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

        {/* Reports */}
        <Route
          path="/reports"
          element={
            <DashboardLayout>
              <ReportsDashboardPage />
            </DashboardLayout>
          }
        />

        {/* Settings */}
        <Route path="/settings" element={<SettingsPage />} />

        {/* 404 */}
        <Route path="*" element={<div className="p-8 text-center text-slate-500">Page not found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;