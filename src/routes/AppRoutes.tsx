import React from "react";
import { Routes, Route } from "react-router-dom";
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
import RoutesPage from "../modules/masters/routes/pages/RoutesPage";

// Operations Module
import OperationsPages from "../modules/operations/pages/OperationsPages";

// Accounts Module
import AccountsPage from "../modules/accounts/pages/AccountsPage";

// Fleet Module
import FleetPages from "../modules/fleet-operations/pages/FleetPages";

// Staff, Reports
import StaffPages from "../modules/staff/pages/StaffPages";
import ReportsDashboardPage from "../modules/reports/pages/ReportsDashboardPage";

// Settings Module (Standalone page without separate layout)
import SettingsPage from "../modules/settings/pages/SettingsPage";

function AppRoutes() {
  return (
    <Routes>
      {/* Auth - No Layout */}
      <Route path="/" element={<LoginPage />} />

      {/* ============ DASHBOARD ============ */}
      <Route path="/dashboard" element={<DashboardLayout><DashboardPage /></DashboardLayout>} />

      {/* ============ MASTERS ============ */}
      <Route path="/masters" element={<DashboardLayout><MastersPage /></DashboardLayout>} />
      <Route path="/masters/shops" element={<DashboardLayout><ShopsPage /></DashboardLayout>} />
      <Route path="/masters/farms" element={<DashboardLayout><FarmsPage /></DashboardLayout>} />
      <Route path="/masters/vehicles" element={<DashboardLayout><VehiclesPage /></DashboardLayout>} />
      <Route path="/masters/employees" element={<DashboardLayout><EmployeesPage /></DashboardLayout>} />
      <Route path="/masters/banks" element={<DashboardLayout><BanksPage /></DashboardLayout>} />
      <Route path="/masters/bird-types" element={<DashboardLayout><BirdTypesPage /></DashboardLayout>} />
      <Route path="/masters/routes" element={<DashboardLayout><RoutesPage /></DashboardLayout>} />

      {/* ============ OPERATIONS ============ */}
      <Route path="/operations" element={<DashboardLayout><OperationsPages /></DashboardLayout>} />
      <Route path="/operations/*" element={<DashboardLayout><OperationsPages /></DashboardLayout>} />

      {/* ============ ACCOUNTS ============ */}
      <Route path="/accounts" element={<DashboardLayout><AccountsPage /></DashboardLayout>} />
      <Route path="/accounts/*" element={<DashboardLayout><AccountsPage /></DashboardLayout>} />

      {/* ============ FLEET ============ */}
      <Route path="/fleet" element={<DashboardLayout><FleetPages /></DashboardLayout>} />
      <Route path="/fleet/*" element={<DashboardLayout><FleetPages /></DashboardLayout>} />

      {/* ============ STAFF ============ */}
      <Route path="/staff" element={<DashboardLayout><StaffPages /></DashboardLayout>} />
      <Route path="/staff/*" element={<DashboardLayout><StaffPages /></DashboardLayout>} />

      {/* ============ REPORTS ============ */}
      <Route path="/reports" element={<DashboardLayout><ReportsDashboardPage /></DashboardLayout>} />

      {/* ===============================================
          🚀 SETTINGS - SINGLE PAGE ROUTE
          =============================================== */}
      <Route 
        path="/settings" 
        element={
          <DashboardLayout>
            <SettingsPage />
          </DashboardLayout>
        } 
      />
      <Route 
        path="/settings/*" 
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
          <div className="flex h-screen items-center justify-center bg-slate-50">
            <div className="text-center">
              <h1 className="text-6xl font-bold tracking-tight text-slate-800">404</h1>
              <p className="mt-2 text-lg text-slate-600">Page not found</p>
              <a
                href="/dashboard"
                className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
              >
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