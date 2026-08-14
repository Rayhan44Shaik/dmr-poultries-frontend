// src/modules/fleet-operations/pages/FleetPages.tsx

import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  History,
  Wrench,
  FileSpreadsheet,
  DollarSign,
  BarChart3,
  FileText,
  CreditCard,
  ClipboardList,
  Gauge,
} from "lucide-react";

import ModuleTabs, { type ModuleTab } from "../../../ui/ModuleTabs";

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

const tabs: ModuleTab[] = [
  { key: "dashboard", label: "Fleet Dashboard", icon: Gauge, color: "text-emerald-500" },
  { key: "entry", label: "Maintenance Entry", icon: Wrench, color: "text-amber-500" },
  { key: "history", label: "History", icon: History, color: "text-sky-500" },
  { key: "permits", label: "Permits", icon: FileSpreadsheet, color: "text-violet-500" },
  { key: "emi", label: "EMI", icon: DollarSign, color: "text-emerald-500" },
  { key: "analytics", label: "Analytics", icon: BarChart3, color: "text-indigo-500" },
  { key: "reports", label: "Reports", icon: FileText, color: "text-rose-500" },
  { key: "fastag", label: "FASTag", icon: CreditCard, color: "text-teal-500" },
  { key: "expenses", label: "Expenses", icon: ClipboardList, color: "text-orange-500" },
];

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

  const handleTabChange = (tabKey: string) => {
    navigate(`/fleet?tab=${tabKey}`);
  };

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-4 pb-6">
      <ModuleTabs tabs={tabs} activeKey={activeTab} onChange={handleTabChange} className="px-4 pt-3 sm:px-6 lg:px-8" />

      {/* Embedded Content View */}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <ActiveComponent embedded={true} />
      </div>
    </div>
  );
}

export default React.memo(FleetPages);