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
import OperationsPages from "../modules/operations/pages/OperationsPages";

// Accounts Module – Payment Book & Farmer Payment
import { PaymentBookPage } from "../modules/accounts/pages/PaymentBookPage";
import { FarmerPaymentPage } from "../modules/accounts/pages/FarmPaymentPage"; // ✅ file is FarmPaymentPage.tsx, export is FarmerPaymentPage

// Fleet Module
import FleetPages from "../modules/fleet-operations/pages/FleetPages";

// Staff, Reports, Settings
import StaffPages from "../modules/staff/pages/StaffPages";
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
            <OperationsPages />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/operations/*" 
        element={
          <DashboardLayout>
            <OperationsPages />
          </DashboardLayout>
        } 
      />

      {/* ============ ACCOUNTS - Payment Book & Farmer Payment ============ */}
      <Route path="/accounts" element={<Navigate to="/accounts/payment-book" replace />} />
      <Route 
        path="/accounts/payment-book" 
        element={
          <DashboardLayout>
            <PaymentBookPage />
          </DashboardLayout>
        } 
      />
      {/* Farmer Payment route */}
      <Route 
        path="/accounts/farm-payment" 
        element={
          <DashboardLayout>
            <FarmerPaymentPage />
          </DashboardLayout>
        } 
      />

      {/* ============ FLEET - With Layout ============ */}
      <Route 
        path="/fleet" 
        element={
          <DashboardLayout>
            <FleetPages />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/fleet/*" 
        element={
          <DashboardLayout>
            <FleetPages />
          </DashboardLayout>
        } 
      />

      {/* ============ STAFF - With Layout ============ */}
      <Route 
        path="/staff" 
        element={
          <DashboardLayout>
            <StaffPages />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/staff/*" 
        element={
          <DashboardLayout>
            <StaffPages />
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