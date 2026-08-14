// src/modules/staff/pages/StaffPages.tsx

import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Calendar, Clock, CreditCard } from "lucide-react";

import ModuleTabs, { type ModuleTab } from "../../../ui/ModuleTabs";
import DutyPlannerPage from "./DutyPlannerPage";
import LeaveManagementPage from "./LeaveManagementPage";
import SalaryRegisterPage from "./SalaryRegisterPage";

const tabs: ModuleTab[] = [
  { key: "duty-planner", label: "Duty Planner", icon: Calendar, color: "text-sky-500" },
  { key: "salary-sheet", label: "Salary Register", icon: CreditCard, color: "text-violet-500" },
  { key: "leaves", label: "Leave Management", icon: Clock, color: "text-amber-500" },
];

const tabComponents: Record<string, React.ComponentType<{ embedded?: boolean }>> = {
  "duty-planner": DutyPlannerPage,
  "salary-sheet": SalaryRegisterPage,
  leaves: LeaveManagementPage,
};

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

    return "duty-planner"; // Default tab
  }, [location.pathname, searchParams]);

  // Redirect to ?tab=duty-planner when visiting /staff without parameters
  useEffect(() => {
    if (location.pathname === "/staff" && !searchParams.get("tab")) {
      navigate("/staff?tab=duty-planner", { replace: true });
    }
  }, [location.pathname, searchParams, navigate]);

  const ActiveComponent = useMemo(() => {
    return tabComponents[activeTab] ?? DutyPlannerPage;
  }, [activeTab]);

  const handleTabChange = (tabKey: string) => {
    navigate(`/staff?tab=${tabKey}`);
  };

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-4 pb-6">
      <ModuleTabs tabs={tabs} activeKey={activeTab} onChange={handleTabChange} className="px-4 pt-3 sm:px-6 lg:px-8" />

      {/* Embedded Sub-Component */}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <ActiveComponent embedded={true} />
      </div>
    </div>
  );
}

export default React.memo(StaffPages);