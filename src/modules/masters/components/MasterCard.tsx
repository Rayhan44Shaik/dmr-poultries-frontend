import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../providers/languageContext";

type MasterCardProps = {
  title: string;
  total: number;
  active: number;
  inactive: number;
  icon: React.ReactNode;
  color: string;
  path: string;
};

function MasterCard({ title, total, active, inactive, icon, color, path }: MasterCardProps) {
  const { t } = useLanguage();

  return (
    <Link to={path} className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition overflow-hidden border dark:bg-slate-800 dark:border-slate-700 dark:hover:shadow-slate-900">
      <div className="p-5">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-slate-700 font-semibold text-lg dark:text-slate-100">{title}</h3>
            <h1 className="text-4xl font-bold mt-2 text-slate-900 dark:text-slate-50">{total}</h1>
          </div>
          <div className={`h-16 w-16 rounded-full flex items-center justify-center ${color}`}>{icon}</div>
        </div>
        <div className="flex gap-6 mt-6 text-sm">
          <span className="text-green-700 dark:text-green-400">{t("status.active")} : {active}</span>
          <span className="text-red-600 dark:text-red-400">{t("status.inactive")} : {inactive}</span>
        </div>
      </div>
      <div className="border-t p-3 flex justify-center items-center gap-2 text-blue-600 font-medium dark:border-slate-700 dark:text-blue-400">
        {t("common.viewDetails")}
        <ChevronRight size={18} />
      </div>
    </Link>
  );
}

export default MasterCard;
