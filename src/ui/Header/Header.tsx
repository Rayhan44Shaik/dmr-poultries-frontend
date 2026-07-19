// src/components/Header.tsx
import { useLocation } from "react-router-dom";
import { Database, LayoutDashboard, Truck } from "lucide-react";

function Header() {
  const location = useLocation();
  const currentPath = location.pathname;

  // ---- Masters Page ----
  const isMastersPage = currentPath === "/masters" || currentPath.startsWith("/masters/");

  // ---- Operations Pages ----
  const isOperationsPage = currentPath.startsWith("/operations");

  // ---- Helper to get page title ----
  const getPageTitle = () => {
    if (isMastersPage) return "Masters";
    if (isOperationsPage) return "Operations";
    if (currentPath === "/dashboard") return "Dashboard";
    if (currentPath.startsWith("/accounts")) return "Accounts";
    if (currentPath.startsWith("/fleet")) return "Fleet";
    if (currentPath.startsWith("/staff")) return "Staff";
    if (currentPath.startsWith("/reports")) return "Reports";
    if (currentPath.startsWith("/settings")) return "Settings";
    return "";
  };

  const title = getPageTitle();

  const userProfile = (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-green-700 text-white flex items-center justify-center font-bold">
        R
      </div>
      <div>
        <p className="font-semibold text-slate-800">Ruhulla</p>
        <p className="text-xs text-slate-500">Administrator</p>
      </div>
    </div>
  );

  // ---- Masters Header (plain white, no gradient) ----
  if (isMastersPage) {
    return (
      <header className="h-16 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Database size={24} className="text-blue-600" />
          <h1 className="text-xl font-bold text-slate-800">Masters</h1>
        </div>
        <div className="flex items-center gap-6">
          <button className="text-slate-600 hover:text-green-700 text-xl">🔔</button>
          {userProfile}
        </div>
      </header>
    );
  }

  // ---- Operations Header (simple, same style as Masters) ----
  if (isOperationsPage) {
    return (
      <header className="h-16 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Truck size={24} className="text-blue-600" />
          <h1 className="text-xl font-bold text-slate-800">Operations</h1>
        </div>
        <div className="flex items-center gap-6">
          <button className="text-slate-600 hover:text-green-700 text-xl">🔔</button>
          {userProfile}
        </div>
      </header>
    );
  }

  // ---- Fallback for other pages ----
  return (
    <header className="h-16 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        {title && (
          <>
            <LayoutDashboard size={24} className="text-indigo-600" />
            <h1 className="text-xl font-bold text-slate-800">{title}</h1>
          </>
        )}
      </div>
      <div className="flex items-center gap-6">
        <button className="text-slate-600 hover:text-green-700 text-xl">🔔</button>
        {userProfile}
      </div>
    </header>
  );
}

export default Header;