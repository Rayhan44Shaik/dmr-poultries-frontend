// src/modules/fleet-operations/pages/FleetPages.tsx

import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Sub-page component imports
import MaintenanceHistoryPage from "./MaintenanceHistoryPage";
import MaintenanceEntryPage from "./MaintenanceEntryPage";
import DocumentsExpiryPage from "./DocumentsExpiryPage";
import EmiLoansPage from "./EmiLoansPage";
import VehicleAnalyticsPage from "./VehicleAnalyticsPage";
import VehicleReportsPage from "./VehicleReportsPage";
import FastagDashboardPage from "./FastagDashboardPage";
import VehicleExpenseReportPage from "./VehicleExpenseReportPage";
import FleetDashboardPage from "./FleetDashboardPage";

// Map tab keys (resolved from ?tab= sidebar deep-links) to their
// child page components.
const tabComponents: Record<string, React.ComponentType<{ embedded?: boolean }>> = {
  dashboard: FleetDashboardPage,
  entry: MaintenanceEntryPage,
  history: MaintenanceHistoryPage,
  permits: DocumentsExpiryPage,
  emi: EmiLoansPage,
  analytics: VehicleAnalyticsPage,
  reports: VehicleReportsPage,
  fastag: FastagDashboardPage,
  expenses: VehicleExpenseReportPage,
};

function FleetPages() {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  // Read active tab from ?tab= query string
  const activeTab = useMemo(() => {
    return searchParams.get("tab") || "dashboard";
  }, [searchParams]);

  // Redirect to ?tab=dashboard when visiting /fleet or /fleet/ without parameters
  useEffect(() => {
    if (!searchParams.get("tab")) {
      navigate("/fleet?tab=dashboard", { replace: true });
    }
  }, [searchParams, navigate]);

  // Dynamic component selector
  const ActiveComponent = useMemo(() => {
    return tabComponents[activeTab] ?? FleetDashboardPage;
  }, [activeTab]);

  return (
    <div className="w-full px-4 pb-8 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1480px]">
        <ActiveComponent embedded={true} />
      </div>
    </div>
  );
}

export default React.memo(FleetPages);
