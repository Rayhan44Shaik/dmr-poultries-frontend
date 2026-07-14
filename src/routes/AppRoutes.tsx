import { BrowserRouter, Routes, Route } from "react-router-dom";
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

import OperationsDashboard from "../modules/operations/pages/OperationsDashboard";
import TripEntryPage from "../modules/operations/vehicle-trips/pages/TripEntryPage";
import TripListPage from "../modules/operations/vehicle-trips/pages/TripListPage";
import ShopSalesPage from "../modules/operations/shop-sales/pages/ShopSalesPage";
import RatesEntryPage from "../modules/operations/shop-sales/pages/RatesEntryPage";

import CollectionEntryPage from "../modules/operations/collections/pages/CollectionEntryPage";
import PendingCollectionsPage from "../modules/operations/collections/pages/PendingCollectionsPage";
import CollectionReportPage from "../modules/operations/collections/pages/CollectionReportPage";

import FuelExpensesPage from "../modules/operations/fuel-expenses/pages/FuelExpensesPage";

import AccountsPage from "../modules/accounts/pages/AccountsPage";
import VehicleManagementPage from "../modules/vehicles/pages/VehicleManagementPage";
import StaffPage from "../modules/staff/pages/StaffPage";
import ReportsPage from "../modules/reports/pages/ReportsPage";
import SettingsPage from "../modules/settings/pages/SettingsPage";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/masters" element={<MastersPage />} />
        <Route path="/masters/shops" element={<ShopsPage />} />
        <Route path="/masters/farms" element={<FarmsPage />} />
        <Route path="/masters/vehicles" element={<VehiclesPage />} />
        <Route path="/masters/employees" element={<EmployeesPage />} />
        <Route path="/masters/banks" element={<BanksPage />} />
        <Route path="/masters/bird-types" element={<BirdTypesPage />} />

        <Route path="/operations" element={<OperationsDashboard />} />
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

        {/* ✅ Collection pages – now wrapped with DashboardLayout */}
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

        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/vehicles" element={<VehicleManagementPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        <Route path="*" element={<div className="p-8 text-center text-slate-500">Page not found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;