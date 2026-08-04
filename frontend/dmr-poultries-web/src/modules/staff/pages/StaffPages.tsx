// src/modules/staff/pages/StaffPages.tsx

import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Calendar, Clock, CreditCard, LayoutGrid, Users, FileText } from "lucide-react";

import DutyPlannerPage from "./DutyPlannerPage";
import LeaveManagementPage from "./LeaveManagementPage";
import SalaryRegisterPage from "./SalaryRegisterPage";

// Placeholder sub-components for other staff tabs if needed
const StaffOverview = () => <div className="p-6 text-slate-600 text-sm font-medium">Staff Overview Content</div>;
const EmployeeList = () => <div className="p-6 text-slate-600 text-sm font-medium">Employee Master Directory</div>;

const tabs = [
  { key: "duty-planner", label: "Duty Planner", icon: Calendar, color: "text-blue-500", component: DutyPlannerPage },
  { key: "leaves", label: "Leave", icon: Clock, color: "text-amber-500", component: LeaveManagementPage },
  { key: "salary-sheet", label: "Salary Sheet", icon: CreditCard, color: "text-purple-500", component: SalaryRegisterPage },
];

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
    const found = tabs.find((tab) => tab.key === activeTab);
    return found ? found.component : DutyPlannerPage;
  }, [activeTab]);

  const handleTabChange = (tabKey: string) => {
    navigate(`/staff?tab=${tabKey}`);
  };

  return (
    <div className="w-full pt-3 pb-6 space-y-4">
      {/* Tab Navigation Container (Scrollbar hidden via cross-browser Tailwind utility) */}
      <div className="bg-white border-y sm:border border-slate-200/90 sm:rounded-xl shadow-sm px-3 py-1.5 w-full">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`
                  flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 shrink-0 cursor-pointer
                  ${isActive
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }
                `}
              >
                <Icon
                  size={18}
                  className={isActive ? "text-blue-700" : tab.color}
                />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Embedded Sub-Component */}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <ActiveComponent embedded={true} />
      </div>
    </div>
  );
}

export default React.memo(StaffPages);