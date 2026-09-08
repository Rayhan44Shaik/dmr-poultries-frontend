import type { ReactNode } from "react";
import { useI18n } from "../../../i18n";

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  children?: ReactNode;
}

/** Bounded page buttons keep large master directories and phone widths tidy. */
export default function MasterPagination({
  page,
  totalPages,
  onPageChange,
  disabled,
  children,
}: Props) {
  const { t } = useI18n();
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const mobileStart = Math.max(1, Math.min(page - 1, totalPages - 2));
  const pages = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => start + index,
  );
  const buttonClass =
    "flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 rounded-b-xl border-t border-slate-200 bg-white px-4 py-3">
      {children && <div className="mr-auto">{children}</div>}
      <nav
        aria-label={t("masters.ui.pagination")}
        className="flex items-center gap-1.5"
      >
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={disabled || page <= 1}
          className={buttonClass}
        >
          {t("common.previous")}
        </button>
        {pages.map((number) => (
          <button
            key={number}
            type="button"
            onClick={() => onPageChange(number)}
            disabled={disabled}
            aria-current={number === page ? "page" : undefined}
            aria-label={t("masters.ui.page", { page: number })}
            className={`h-9 min-w-9 items-center justify-center rounded-xl border px-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              number >= mobileStart && number < mobileStart + 3
                ? "inline-flex"
                : "hidden sm:inline-flex"
            } ${number === page ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            {number}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={disabled || page >= totalPages}
          className={buttonClass}
        >
          {t("common.next")}
        </button>
      </nav>
    </div>
  );
}
