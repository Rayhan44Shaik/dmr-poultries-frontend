// src/components/Sidebar.tsx

import { Link, useLocation } from "react-router-dom";

import {
  Database,
  Truck,
  Car,
  Users,
  ReceiptIndianRupee,
  FileText,
  Settings,
  Building2,
} from "lucide-react";
import { useLanguage } from "../../providers/languageContext";

export default function Sidebar() {
  const location = useLocation();
  const { t } = useLanguage();

  const isActiveParent = (path: string) => {
    if (location.pathname === path) return true;
    return location.pathname.startsWith(path + "/") || location.pathname.startsWith(path);
  };

  const linkClass = (active: boolean) =>
    ("mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all " +
      (active
        ? "bg-blue-600 text-white"
        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"));

  const nav = [
    { to: "/masters", icon: Database, key: "nav.masters" },
    { to: "/operations", icon: Truck, key: "nav.operations" },
    { to: "/fleet", icon: Car, key: "nav.vehicles" },
    { to: "/staff", icon: Users, key: "nav.staff" },
    { to: "/accounts", icon: ReceiptIndianRupee, key: "nav.accounts" },
    { to: "/reports", icon: FileText, key: "nav.reports" },
    { to: "/settings", icon: Settings, key: "nav.settings" },
  ];

  return (
    <aside className="flex h-screen w-72 flex-col border-r border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700">
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5 dark:border-slate-700">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Building2 size={22} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t("appName")}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t("appSubtitle")}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className={linkClass(isActiveParent(item.to))}>
              <Icon size={18} />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
