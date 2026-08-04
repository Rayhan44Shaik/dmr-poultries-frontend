// src/components/Sidebar.tsx

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import {
  LayoutDashboard,
  Database,
  Truck,
  Car,
  Users,
  ReceiptIndianRupee,
  FileText,
  Settings,
  Building2,
} from "lucide-react";

export default function Sidebar() {
  const location = useLocation();

  // Accounts children removed – now a single link

  // Better matching logic for parent items
  const isActiveParent = (path: string) => {
    if (location.pathname === path) return true;
    return location.pathname.startsWith(path + "/") || location.pathname.startsWith(path);
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
        {/* 1. Dashboard */}
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

        {/* 2. Masters */}
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

        {/* 3. Operations */}
        <Link
          to="/operations"
          className={`mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
            isActiveParent("/operations")
              ? "bg-blue-600 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <Truck size={18} />
          Operations
        </Link>

        {/* 4. Vehicles */}
        <Link
          to="/fleet"
          className={`mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
            isActiveParent("/fleet")
              ? "bg-blue-600 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <Car size={18} />
          Vehicles
        </Link>

        {/* 5. Staff */}
        <Link
          to="/staff"
          className={`mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
            isActiveParent("/staff")
              ? "bg-blue-600 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <Users size={18} />
          Staff
        </Link>

        {/* 6. Accounts – now a single link (no dropdown) */}
        <Link
          to="/accounts"
          className={`mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
            isActiveParent("/accounts")
              ? "bg-blue-600 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <ReceiptIndianRupee size={18} />
          Accounts
        </Link>

        {/* 7. Reports */}
        <Link
          to="/reports"
          className={`mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
            isActiveParent("/reports")
              ? "bg-blue-600 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <FileText size={18} />
          Reports
        </Link>

        {/* 8. Settings */}
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
      </nav>
    </aside>
  );
}