import { useState, useEffect, useRef } from "react";
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
  Gauge,
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
} from "lucide-react";

interface MenuItem {
  title: string;
  icon: React.ReactNode;
  children?: {
    title: string;
    path: string;
  }[];
  path?: string;
}

export default function Sidebar() {
  const location = useLocation();
  const prevPathname = useRef(location.pathname);

  const [openFleet, setOpenFleet] = useState(
    location.pathname.startsWith("/fleet")
  );

  const [openAccounts, setOpenAccounts] = useState(
    location.pathname.startsWith("/accounts")
  );

  // Auto‑close Fleet/Accounts when navigating away
  useEffect(() => {
    const current = location.pathname;
    const prev = prevPathname.current;

    const wasInFleet = prev.startsWith("/fleet");
    const isInFleet = current.startsWith("/fleet");
    const wasInAccounts = prev.startsWith("/accounts");
    const isInAccounts = current.startsWith("/accounts");

    if (wasInFleet && !isInFleet) setOpenFleet(false);
    if (!wasInFleet && isInFleet) setOpenFleet(true);
    if (wasInAccounts && !isInAccounts) setOpenAccounts(false);
    if (!wasInAccounts && isInAccounts) setOpenAccounts(true);

    prevPathname.current = current;
  }, [location.pathname]);

  const menu: MenuItem[] = [
    {
      title: "Dashboard",
      icon: <LayoutDashboard size={18} />,
      path: "/dashboard",
    },
    {
      title: "Masters",
      icon: <Database size={18} />,
      path: "/masters",
    },
    {
      title: "Operations",
      icon: <Truck size={18} />,
      // ✅ No children – direct link to overview
      path: "/operations/overview",
    },
    {
      title: "Fleet",
      icon: <Car size={18} />,
      children: [
        { title: "Dashboard", path: "/fleet/dashboard" },
        { title: "Maintenance Entry", path: "/fleet/maintenance/entry" },
        { title: "Maintenance History", path: "/fleet/maintenance/history" },
        { title: "Documents & Expiry", path: "/fleet/documents" },
        { title: "FASTag Dashboard", path: "/fleet/fastag" },
        { title: "EMI & Loans", path: "/fleet/emi" },
        { title: "Vehicle Analytics", path: "/fleet/analytics" },
        { title: "Vehicle Reports", path: "/fleet/reports" },
        { title: "Expense Report", path: "/fleet/expense-report" },
      ],
    },
    {
      title: "Staff",
      icon: <Users size={18} />,
      path: "/staff",
    },
    {
      title: "Reports",
      icon: <FileText size={18} />,
      path: "/reports",
    },
    {
      title: "Settings",
      icon: <Settings size={18} />,
      path: "/settings",
    },
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
            location.pathname === "/dashboard"
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
            location.pathname === "/masters"
              ? "bg-blue-600 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <Database size={18} />
          Masters
        </Link>

        {/* ✅ Operations – now a simple link, no children */}
        <Link
          to="/operations/overview"
          className={`mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
            location.pathname === "/operations/overview"
              ? "bg-blue-600 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <Truck size={18} />
          Operations
        </Link>

        {/* Fleet – toggle button */}
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
            {menu[3].children?.map((item) => {
              let icon = null;
              if (item.title === "Dashboard") icon = <Gauge size={14} />;
              else if (item.title === "Maintenance Entry") icon = <Wrench size={14} />;
              else if (item.title === "Maintenance History") icon = <History size={14} />;
              else if (item.title === "Documents & Expiry") icon = <FileSpreadsheet size={14} />;
              else if (item.title === "FASTag Dashboard") icon = <CreditCard size={14} />;
              else if (item.title === "EMI & Loans") icon = <DollarSign size={14} />;
              else if (item.title === "Vehicle Analytics") icon = <BarChart3 size={14} />;
              else if (item.title === "Vehicle Reports") icon = <FileText size={14} />;
              else if (item.title === "Expense Report") icon = <ClipboardList size={14} />;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`mb-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                    location.pathname === item.path
                      ? "bg-blue-50 font-semibold text-blue-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {icon}
                  {item.title}
                </Link>
              );
            })}
          </div>
        )}

        {/* Accounts – toggle button */}
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
              location.pathname === "/staff"
                ? "bg-blue-600 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Users size={18} />
            <span>Staff</span>
          </Link>

          <Link
            to="/reports"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              location.pathname === "/reports"
                ? "bg-blue-600 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <FileText size={18} />
            <span>Reports</span>
          </Link>

          <Link
            to="/settings"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              location.pathname === "/settings"
                ? "bg-blue-600 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Settings size={18} />
            <span>Settings</span>
          </Link>
        </div>
      </nav>
    </aside>
  );
}