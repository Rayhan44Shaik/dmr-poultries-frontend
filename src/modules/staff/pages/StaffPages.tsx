// src/modules/staff/pages/StaffPages.tsx

import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { firstAllowedTab } from "../../auth/permissions";
import { useAuth } from "../../../providers/authContext";
import DutyPlannerPage from "./DutyPlannerPage";
import LeaveManagementPage from "./LeaveManagementPage";
import SalaryRegisterPage from "./SalaryRegisterPage";
import DriverPerformancePage from "./DriverPerformancePage";
import SupervisorPerformancePage from "./SupervisorPerformancePage";

// Map tab keys (resolved from ?tab= sidebar deep-links / path aliases)
// to their child page components.
const tabComponents: Record<string, React.ComponentType<{ embedded?: boolean }>> = {
  "duty-planner": DutyPlannerPage,
  "salary-sheet": SalaryRegisterPage,
  leaves: LeaveManagementPage,
  "driver-performance": DriverPerformancePage,
  "supervisor-performance": SupervisorPerformancePage,
};

function StaffPages() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  // Default tab is role-aware: the supervisor's only Staff page is Leaves,
  // so a bare /staff lands there instead of Duty Planner.
  const defaultTab = firstAllowedTab(user?.role, "staff") ?? "duty-planner";

  // Read active tab from ?tab= query string
  const activeTab = useMemo(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) return tabParam;

    const pathname = location.pathname;
    if (pathname.includes("duty-planner")) return "duty-planner";
    if (pathname.includes("employees")) return "employees";
    if (pathname.includes("salary-sheet")) return "salary-sheet";
    if (pathname.includes("leaves") || pathname.includes("leave")) return "leaves";

    return defaultTab;
  }, [location.pathname, searchParams, defaultTab]);

  // Redirect to the role's default tab when visiting /staff without parameters
  useEffect(() => {
    if (location.pathname === "/staff" && !searchParams.get("tab")) {
      navigate(`/staff?tab=${defaultTab}`, { replace: true });
    }
  }, [location.pathname, searchParams, navigate, defaultTab]);

  const ActiveComponent = useMemo(() => {
    return tabComponents[activeTab] ?? tabComponents[defaultTab] ?? DutyPlannerPage;
  }, [activeTab, defaultTab]);

  // Same page gutter and content width as the Trip List, so the staff filter
  // boxes line up identically with the operations ones.
  return (
    <div className="w-full px-4 pb-8 pt-6 sm:px-5 lg:px-6">
      <div className="mx-auto w-full max-w-[1600px]">
        <ActiveComponent embedded={true} />
      </div>
    </div>
  );
}

export default React.memo(StaffPages);
