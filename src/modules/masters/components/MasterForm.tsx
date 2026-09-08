import { useId, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { translateStatus, useI18n } from "../../../i18n";

interface MasterFormProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
  status: "Active" | "Inactive";
  onStatusChange: (status: "Active" | "Inactive") => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  submitLabel: string;
  children: ReactNode;
}

/** One frame for all six master forms; only the body scrolls on small screens. */
export default function MasterForm({
  title,
  subtitle,
  icon,
  status,
  onStatusChange,
  onSubmit,
  onCancel,
  isSaving = false,
  submitLabel,
  children,
}: MasterFormProps) {
  const { t } = useI18n();
  const titleId = useId();
  return (
    <form
      noValidate
      aria-labelledby={titleId}
      aria-busy={isSaving}
      onSubmit={(event) => {
        event.preventDefault();
        if (!isSaving) onSubmit();
      }}
      className="master-form flex max-h-[calc(100dvh-1.5rem)] flex-col rounded-2xl border border-slate-200 bg-white font-sans text-sm shadow-xl sm:max-h-[90dvh]"
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-slate-200/70 bg-gradient-to-r from-emerald-50/70 via-white to-white px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"
          >
            {icon}
          </div>
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-lg font-semibold tracking-tight text-slate-800 sm:text-xl"
            >
              {title}
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="text-xs font-medium text-slate-500">
            {t("common.status")}
          </span>
          <button
            type="button"
            role="switch"
            aria-label={t("common.status")}
            aria-checked={status === "Active"}
            disabled={isSaving}
            onClick={() =>
              onStatusChange(status === "Active" ? "Inactive" : "Active")
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${status === "Active" ? "bg-emerald-500" : "bg-slate-300"}`}
          >
            <span
              className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${status === "Active" ? "translate-x-6" : "translate-x-1"}`}
            />
          </button>
          <span
            className={`min-w-12 text-xs font-semibold ${status === "Active" ? "text-emerald-700" : "text-slate-500"}`}
          >
            {translateStatus(t, status)}
          </span>
        </div>
      </header>
      <div
        className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6"
        data-master-form-body
      >
        <fieldset
          disabled={isSaving}
          className="min-w-0 space-y-6 disabled:opacity-70"
        >
          {children}
        </fieldset>
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 rounded-b-2xl border-t border-slate-200/70 bg-slate-50/60 px-5 py-3.5 sm:px-6">
        <p className="mr-auto hidden text-xs text-slate-500 sm:block">
          <span className="text-red-500">*</span>{" "}
          {t("masters.ui.required_fields")}
        </p>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
        >
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
        >
          {isSaving && (
            <LoaderCircle
              size={16}
              aria-hidden="true"
              className="animate-spin"
            />
          )}
          {isSaving ? t("common.saving") : submitLabel}
        </button>
      </footer>
    </form>
  );
}

export function MasterSectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-3.5 w-1 rounded-full bg-emerald-500"
        aria-hidden="true"
      />
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {children}
      </h3>
      <div className="h-px flex-1 bg-slate-200/80" aria-hidden="true" />
    </div>
  );
}
