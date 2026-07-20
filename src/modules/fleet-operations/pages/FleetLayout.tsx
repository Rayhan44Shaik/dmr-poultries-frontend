import { useLocation, Link } from "react-router-dom";
import { Outlet } from "react-router-dom";
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

const fleetTabs = [
  { id: "history", label: "History", icon: History, path: "/fleet/history" },
  { id: "entry", label: "Entry", icon: Wrench, path: "/fleet/entry" },
  { id: "permits", label: "Permits", icon: FileSpreadsheet, path: "/fleet/permits" },
  { id: "emi", label: "EMI", icon: DollarSign, path: "/fleet/emi" },
  { id: "analytics", label: "Analytics", icon: BarChart3, path: "/fleet/analytics" },
  { id: "reports", label: "Reports", icon: FileText, path: "/fleet/reports" },
  { id: "fastag", label: "FASTag", icon: CreditCard, path: "/fleet/fastag" },
  { id: "expenses", label: "Expenses", icon: ClipboardList, path: "/fleet/expenses" },
];

function FleetLayout() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div className="p-4 md:p-6 bg-slate-50/50 min-h-screen">
      {/* Navigation Deck Container - Matches the Operations tab layout style */}
      <div className="bg-white border border-slate-200/60 rounded-t-2xl rounded-b-none p-1.5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3 relative z-20">
        <div className="flex items-center gap-1 overflow-x-auto py-0.5 px-0.5 scrollbar-none w-full">
          {fleetTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentPath === tab.path || currentPath.startsWith(tab.path + "/");
            return (
              <Link
                key={tab.id}
                to={tab.path}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all duration-200
                  ${isActive
                    ? "bg-blue-50 text-blue-700 shadow-inner border border-blue-100/50"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-transparent"
                  }
                `}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Viewmount Frame Slot - Connected seamlessly below with zero gaps */}
      <div className="relative z-10 -mt-px">
        <Outlet />
      </div>
    </div>
  );
}

export default FleetLayout;