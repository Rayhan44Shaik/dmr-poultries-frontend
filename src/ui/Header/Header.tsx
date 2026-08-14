// src/components/Header.tsx
import { useLocation } from "react-router-dom";
import { Database, LayoutDashboard, Truck } from "lucide-react";
import { useLanguage } from "../../providers/languageContext";

function Header() {
  const location = useLocation();
  const { t } = useLanguage();
  const currentPath = location.pathname;

  const isMastersPage = currentPath === "/masters" || currentPath.startsWith("/masters/");
  const isOperationsPage = currentPath.startsWith("/operations");

  const headerClass = "h-16 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between px-6 dark:bg-slate-900 dark:border-slate-700";
  const titleClass = "text-xl font-bold text-slate-800 dark:text-slate-100";

  const userProfile = (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-green-700 text-white flex items-center justify-center font-bold">
        R
      </div>
      <div>
        <p className="font-semibold text-slate-800 dark:text-slate-100">Ruhulla</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Administrator</p>
      </div>
    </div>
  );

  const bell = (<button className="text-slate-600 dark:text-slate-300 hover:text-green-700 text-xl">🔔</button>);

  if (isMastersPage) {
    return (
      <header className={headerClass}>
        <div className="flex items-center gap-3">
          <Database size={24} className="text-blue-600" />
          <h1 className={titleClass}>{t("nav.masters")}</h1>
        </div>
        <div className="flex items-center gap-6">{bell}{userProfile}</div>
      </header>
    );
  }

  if (isOperationsPage) {
    return (
      <header className={headerClass}>
        <div className="flex items-center gap-3">
          <Truck size={24} className="text-blue-600" />
          <h1 className={titleClass}>{t("nav.operations")}</h1>
        </div>
        <div className="flex items-center gap-6">{bell}{userProfile}</div>
      </header>
    );
  }

  const getPageTitle = () => {
    if (currentPath === "/dashboard") return t("nav.dashboard");
    if (currentPath.startsWith("/accounts")) return t("nav.accounts");
    if (currentPath.startsWith("/fleet")) return t("nav.vehicles");
    if (currentPath.startsWith("/staff")) return t("nav.staff");
    if (currentPath.startsWith("/reports")) return t("nav.reports");
    if (currentPath.startsWith("/settings")) return t("nav.settings");
    return "";
  };

  const title = getPageTitle();

  return (
    <header className={headerClass}>
      <div className="flex items-center gap-3">
        {title && (
          <>
            <LayoutDashboard size={24} className="text-indigo-600" />
            <h1 className={titleClass}>{title}</h1>
          </>
        )}
      </div>
      <div className="flex items-center gap-6">{bell}{userProfile}</div>
    </header>
  );
}

export default Header;
