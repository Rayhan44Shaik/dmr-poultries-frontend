// src/components/Sidebar.tsx
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import {
  LayoutDashboard,
  Database,
  Truck,
  ReceiptIndianRupee,
  Car,
  Users,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  Building2,
  Wrench,
  History,
  FileSpreadsheet,
  CreditCard,
  DollarSign,
  BarChart3,
  ClipboardList,
  PiggyBank,
  Wallet,
  Banknote,
  Landmark,
  Receipt,
  TrendingUp,
  Clock,
  ShoppingCart,
  HandCoins,
  Fuel,
  File,
  Gauge,
} from "lucide-react";

export default function Sidebar() {
  const location = useLocation();

  const [openOperations, setOpenOperations] = useState(
    location.pathname.startsWith("/operations")
  );
  const [openFleet, setOpenFleet] = useState(
    location.pathname.startsWith("/fleet")
  );
  const [openAccounts, setOpenAccounts] = useState(
    location.pathname.startsWith("/accounts")
  );

  const operationsChildren = [
    { title: "Overview", path: "/operations/overview", icon: <Gauge size={14} /> },
    { title: "Trip Entry", path: "/operations/vehicle-trips/entry", icon: <Truck size={14} /> },
    { title: "Trip List", path: "/operations/vehicle-trips/list", icon: <FileText size={14} /> },
    // Shop routes under /operations/shop/
    { title: "Shop Sales", path: "/operations/shop/shop-sales", icon: <ShoppingCart size={14} /> },
    { title: "Rate Entry", path: "/operations/shop/rate-entry", icon: <File size={14} /> },
    { title: "Collection", path: "/operations/collections/entry", icon: <HandCoins size={14} /> },
    { title: "Pending Collections", path: "/operations/collections/pending", icon: <Clock size={14} /> },
    { title: "Collection Report", path: "/operations/collections/report", icon: <FileSpreadsheet size={14} /> },
    { title: "Fuel Expenses", path: "/operations/fuel-expenses", icon: <Fuel size={14} /> },
  ];

  const accountsChildren = [
    { title: "Dashboard", path: "/accounts/dashboard", icon: <LayoutDashboard size={14} /> },
    { title: "Farmer Payments", path: "/accounts/farmer-payments", icon: <PiggyBank size={14} /> },
    { title: "Cash Book", path: "/accounts/cash-book", icon: <Wallet size={14} /> },
    { title: "Bank Book", path: "/accounts/bank-book", icon: <Landmark size={14} /> },
    { title: "Vehicle EMI", path: "/accounts/vehicle-emi", icon: <Banknote size={14} /> },
    { title: "Outstanding Summary", path: "/accounts/outstanding-summary", icon: <Receipt size={14} /> },
    { title: "Profit & Loss", path: "/accounts/profit-loss", icon: <TrendingUp size={14} /> },
  ];

  // Better matching logic for parent items
  const isActiveParent = (path: string) => {
    if (location.pathname === path) return true;
    return location.pathname.startsWith(path + "/");
  };

  const isActiveExact = (path: string) => location.pathname === path;

  return (
    <aside className="flex h-screen w-72 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Building2 size={22} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800">DMR Poultries</h1>
          <p className="text-xs text-slate-500">ERP System</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Dashboard */}
        <Link
          to="/dashboard"
          className={`mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
            isActiveExact("/dashboard")
              ? "bg-blue-600 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <LayoutDashboard size={18} />
          Dashboard
        </Link>

        {/* Masters */}
        <Link
          to="/masters"
          className={`mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
            isActiveParent("/masters")
              ? "bg-blue-600 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <Database size={18} />
          Masters
        </Link>

        {/* Operations – Dropdown */}
        <button
          type="button"
          onClick={() => setOpenOperations(!openOperations)}
          className="mb-1 mt-3 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          <div className="flex items-center gap-3">
            <Truck size={18} />
            Operations
          </div>
          {openOperations ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {openOperations && (
          <div className="ml-5 border-l border-slate-200 pl-3">
            {operationsChildren.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`mb-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                  location.pathname === item.path
                    ? "bg-blue-50 font-semibold text-blue-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.icon}
                {item.title}
              </Link>
            ))}
          </div>
        )}

        {/* Fleet – Dropdown */}
        <button
          type="button"
          onClick={() => setOpenFleet(!openFleet)}
          className="mb-1 mt-3 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          <div className="flex items-center gap-3">
            <Car size={18} />
            Fleet
          </div>
          {openFleet ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {openFleet && (
          <div className="ml-5 border-l border-slate-200 pl-3">
            {[
              { title: "History", path: "/fleet/history", icon: <History size={14} /> },
              { title: "Entry", path: "/fleet/entry", icon: <Wrench size={14} /> },
              { title: "Permits", path: "/fleet/permits", icon: <FileSpreadsheet size={14} /> },
              { title: "EMI", path: "/fleet/emi", icon: <DollarSign size={14} /> },
              { title: "Analytics", path: "/fleet/analytics", icon: <BarChart3 size={14} /> },
              { title: "Reports", path: "/fleet/reports", icon: <FileText size={14} /> },
              { title: "FASTag", path: "/fleet/fastag", icon: <CreditCard size={14} /> },
              { title: "Expenses", path: "/fleet/expenses", icon: <ClipboardList size={14} /> },
            ].map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`mb-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                  location.pathname === item.path
                    ? "bg-blue-50 font-semibold text-blue-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.icon}
                {item.title}
              </Link>
            ))}
          </div>
        )}

        {/* Accounts – Dropdown */}
        <button
          type="button"
          onClick={() => setOpenAccounts(!openAccounts)}
          className="mb-1 mt-3 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          <div className="flex items-center gap-3">
            <ReceiptIndianRupee size={18} />
            Accounts
          </div>
          {openAccounts ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {openAccounts && (
          <div className="ml-5 border-l border-slate-200 pl-3">
            {accountsChildren.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`mb-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                  location.pathname === item.path
                    ? "bg-blue-50 font-semibold text-blue-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.icon}
                {item.title}
              </Link>
            ))}
          </div>
        )}

        {/* Staff, Reports, Settings */}
        <div className="mt-4 space-y-1">
          <Link
            to="/staff"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              isActiveParent("/staff")
                ? "bg-blue-600 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Users size={18} />
            Staff
          </Link>
          <Link
            to="/reports"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              isActiveParent("/reports")
                ? "bg-blue-600 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <FileText size={18} />
            Reports
          </Link>
          <Link
            to="/settings"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              isActiveParent("/settings")
                ? "bg-blue-600 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Settings size={18} />
            Settings
          </Link>
        </div>
      </nav>
    </aside>
  );
}