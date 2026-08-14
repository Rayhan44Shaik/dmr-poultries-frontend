// src/modules/fleet-operations/pages/FleetPages.tsx

import React, { useEffect, useMemo, useRef } from "react";
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
} from "lucide-react";

// Sub-page component imports
import MaintenanceHistoryPage from "./MaintenanceHistoryPage";
import MaintenanceEntryPage from "./MaintenanceEntryPage";
import DocumentsExpiryPage from "./DocumentsExpiryPage";
import EmiLoansPage from "./EmiLoansPage";
import VehicleAnalyticsPage from "./VehicleAnalyticsPage";
import VehicleReportsPage from "./VehicleReportsPage";
import FastagDashboardPage from "./FastagDashboardPage";
import VehicleExpenseReportPage from "./VehicleExpenseReportPage";

const tabs = [
  { key: "history", label: "History", icon: History, color: "text-blue-500", component: MaintenanceHistoryPage },
  { key: "entry", label: "Entry", icon: Wrench, color: "text-amber-500", component: MaintenanceEntryPage },
  { key: "permits", label: "Permits", icon: FileSpreadsheet, color: "text-purple-500", component: DocumentsExpiryPage },
  { key: "emi", label: "EMI", icon: DollarSign, color: "text-emerald-500", component: EmiLoansPage },
  { key: "analytics", label: "Analytics", icon: BarChart3, color: "text-indigo-500", component: VehicleAnalyticsPage },
  { key: "reports", label: "Reports", icon: FileText, color: "text-rose-500", component: VehicleReportsPage },
  { key: "fastag", label: "FASTag", icon: CreditCard, color: "text-teal-500", component: FastagDashboardPage },
  { key: "expenses", label: "Expenses", icon: ClipboardList, color: "text-orange-500", component: VehicleExpenseReportPage },
];

function FleetPages() {
  const location = useLocation();
  const navigate = useNavigate();
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  // Read active tab from ?tab= query string
  const activeTab = useMemo(() => {
    return searchParams.get("tab") || "history";
  }, [searchParams]);

  // Redirect to ?tab=history when visiting /fleet or /fleet/ without parameters
  useEffect(() => {
    if (!searchParams.get("tab")) {
      navigate("/fleet?tab=history", { replace: true });
    }
  }, [searchParams, navigate]);

  // Automatically scroll active tab into view when it changes
  useEffect(() => {
    if (tabsContainerRef.current) {
      const activeElement = tabsContainerRef.current.querySelector(`[data-tab-key="${activeTab}"]`);
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: "smooth",
          inline: "nearest",
          block: "nearest",
        });
      }
    }
  }, [activeTab]);

  // Dynamic component selector
  const ActiveComponent = useMemo(() => {
    const found = tabs.find((tab) => tab.key === activeTab);
    return found ? found.component : MaintenanceHistoryPage;
  }, [activeTab]);

  const handleTabChange = (tabKey: string) => {
    navigate(`/fleet?tab=${tabKey}`);
  };

  return (
    <div className="w-full pt-3 pb-6 space-y-4">
      {/* Sticky Tab Navigation Bar */}
      <div className="sticky top-0 z-30 bg-slate-50/90 backdrop-blur-md pt-1 pb-2 w-full">
        <div className="bg-white border-y sm:border border-slate-200/90 sm:rounded-xl shadow-sm p-1.5 w-full">
          <div
            ref={tabsContainerRef}
            className="flex items-center gap-2 overflow-x-auto scrollbar-none [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden w-full scroll-smooth"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  data-tab-key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  className={`
                    flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 shrink-0
                    ${isActive
                      ? "bg-blue-50 text-blue-700 font-semibold shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }
                  `}
                >
                  <Icon
                    size={18}
                    className={isActive ? "text-blue-700" : tab.color}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Embedded Content View */}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <ActiveComponent embedded={true} />
      </div>
    </div>
  );
}

export default React.memo(FleetPages);