import { Search } from "lucide-react";
import { useLanguage } from "../../../providers/languageContext";

type SearchMastersProps = {
  search: string;
  onSearchChange: (value: string) => void;
};

function SearchMasters({ search, onSearchChange }: SearchMastersProps) {
  const { t } = useLanguage();

  return (
    <div className="bg-white rounded-2xl shadow border p-6 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
      <h2 className="text-xl font-bold mb-5 dark:text-slate-100">{t("masters.title")} - {t("common.search")}</h2>
      <div className="relative">
        <Search size={20} className="absolute left-4 top-3.5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("masters.searchPlaceholder")}
          className="w-full border rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-700 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-100"
        />
      </div>
    </div>
  );
}

export default SearchMasters;
