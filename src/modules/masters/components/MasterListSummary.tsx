import { LoaderCircle } from "lucide-react";
import { useI18n } from "../../../i18n";

interface Props {
  title: string;
  total: number;
  shown: number;
  page: number;
  totalPages: number;
  loading?: boolean;
  saving?: boolean;
  deleting?: boolean;
}

export default function MasterListSummary({
  title,
  total,
  shown,
  page,
  totalPages,
  loading,
  saving,
  deleting,
}: Props) {
  const { t } = useI18n();
  const busy = loading || saving || deleting;
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200/70 bg-slate-50/60 px-4 py-3"
      data-master-summary
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <span className="rounded-full border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-xs font-medium tabular-nums text-emerald-700">
          {t("masters.ui.records", { count: total })}
        </span>
        {busy && (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500"
          >
            <LoaderCircle
              size={13}
              aria-hidden="true"
              className="animate-spin text-emerald-600"
            />
            {loading
              ? t("common.loading")
              : deleting
                ? t("masters.ui.deleting")
                : t("common.saving")}
          </span>
        )}
      </div>
      <p className="text-xs tabular-nums text-slate-500">
        {t("masters.ui.showing", { shown, total, page, pages: totalPages })}
      </p>
    </div>
  );
}
