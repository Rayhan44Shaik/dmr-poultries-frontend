// src/modules/staff/pages/StaffPages.tsx

import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import StaffOverviewPage from "./StaffOverviewPage";
import DutyPlannerPage from "./DutyPlannerPage";
import LeaveManagementPage from "./LeaveManagementPage";
import SalaryRegisterPage from "./SalaryRegisterPage";
import DriverPerformancePage from "./DriverPerformancePage";
import SupervisorPerformancePage from "./SupervisorPerformancePage";
import { useStaffOverview } from "../hooks/useStaffOverview";

// Map tab keys (resolved from ?tab= sidebar deep-links / path aliases)
// to their child page components.
const tabComponents: Record<string, React.ComponentType<{ embedded?: boolean }>> = {
  overview: StaffOverviewPage,
  "duty-planner": DutyPlannerPage,
  "salary-sheet": SalaryRegisterPage,
  leaves: LeaveManagementPage,
  "driver-performance": DriverPerformancePage,
  "supervisor-performance": SupervisorPerformancePage,
};

function StaffQuarterStrip() {
  const { data } = useStaffOverview();
  const quarter = data?.sampleQuarter;
  if (!quarter) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs dark:border-sky-500/20 dark:bg-sky-500/10">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 font-semibold text-sky-700 ring-1 ring-inset ring-sky-600/20 dark:bg-sky-900/40 dark:text-sky-300">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
        Quarter {quarter.label}
      </span>
      <span className="text-sky-800/80 dark:text-sky-200/80 font-medium">
        {quarter.fromDate} → {quarter.toDate}
      </span>
      <span className="text-sky-700/60 dark:text-sky-300/60">·</span>
      <span className="text-sky-700 dark:text-sky-300">Today in dataset: {quarter.today}</span>
      <span className="ml-auto hidden text-[11px] text-sky-700/70 dark:text-sky-300/70 sm:inline">
        {data?.counts.employees ?? 0} employees · {data?.counts.leaves.total ?? 0} leaves · {data?.counts.salaries.total ?? 0} salary rows · synced
      </span>
    </div>
  );
}

function StaffPages() {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  // Read active tab from ?tab= query string
  const activeTab = useMemo(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) return tabParam;

    const pathname = location.pathname;
    if (pathname.includes("duty-planner")) return "duty-planner";
    if (pathname.includes("employees")) return "employees";
    if (pathname.includes("salary-sheet")) return "salary-sheet";
    if (pathname.includes("leaves") || pathname.includes("leave")) return "leaves";
    if (pathname.includes("driver-performance")) return "driver-performance";
    if (pathname.includes("supervisor-performance")) return "supervisor-performance";

    return "overview"; // Default tab — quarter-synced staff overview
  }, [location.pathname, searchParams]);

  // Redirect to ?tab=overview when visiting /staff without parameters
  useEffect(() => {
    if (location.pathname === "/staff" && !searchParams.get("tab")) {
      navigate("/staff?tab=overview", { replace: true });
    }
    if (location.pathname === "/staff/overview") {
      navigate("/staff?tab=overview", { replace: true });
    }
  }, [location.pathname, searchParams, navigate]);

  const ActiveComponent = useMemo(() => {
    return tabComponents[activeTab] ?? StaffOverviewPage;
  }, [activeTab]);

  const showStrip = activeTab !== "overview";

  // Same page gutter and content width as the Trip List, so the staff filter
  // boxes line up identically with the operations ones.
  return (
    <div className="w-full px-4 pb-8 pt-6 sm:px-5 lg:px-6">
      <div className="mx-auto w-full max-w-[1600px]">
        {showStrip && <StaffQuarterStrip />}
        <ActiveComponent embedded={true} />
      </div>
    </div>
  );
}

export default React.memo(StaffPages);
