import { Check, CircleAlert, CircleX, Loader2, Save, Send, X } from "lucide-react";
import { useI18n } from "../../../../i18n";
export { TripNoBadge } from "./TripNoBadge";

/**
 * Top-right Close (X) — shown ONLY while a submitted step is in Edit mode.
 * Animates in when Edit is clicked; returns to locked submitted/view mode.
 * Never shown on locked/submitted/view (no edit) headers.
 * Distinct from bottom Cancel, which leaves the wizard entirely.
 */
export function StepCloseButton({
  onClose,
  animated = true,
}: {
  onClose?: () => void;
  /** Fade/scale entrance when Edit opens (default true). */
  animated?: boolean;
}) {
  const { t } = useI18n();
  if (!onClose) return null;
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={t("common.close")}
      title={t("common.close")}
      className={`bg-white hover:bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 shadow-sm active:scale-95 origin-center transition-colors ${
        animated ? "animate-scale-in" : ""
      }`}
    >
      <X
        size={14}
        className={animated ? "transition-transform duration-200 ease-out hover:rotate-90" : undefined}
      />
    </button>
  );
}

export type WizardNoticeState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

export function WizardStepNotice({
  notice,
  dirty = false,
}: {
  notice?: WizardNoticeState;
  dirty?: boolean;
}) {
  const { t } = useI18n();
  const shown = notice ?? (dirty ? { type: "info" as const, message: t("ops.trip.unsaved_changes") } : null);
  const styles = shown?.type === "success"
    ? "border-emerald-100 bg-emerald-50/70 text-emerald-500"
    : shown?.type === "error"
      ? "border-red-100 bg-red-50/70 text-red-500"
      : "border-amber-100 bg-amber-50/70 text-amber-500";
  const Icon = shown?.type === "success" ? Check : shown?.type === "error" ? CircleX : CircleAlert;

  return (
    <div className="min-h-9" aria-live="polite">
      {shown && (
        <div className={`h-9 px-3 rounded-lg border flex items-center gap-2 text-xs font-medium ${styles}`}>
          <Icon size={14} className="shrink-0" />
          <span className="truncate">{shown.message}</span>
        </div>
      )}
    </div>
  );
}

type WizardActionBarProps = {
  onCancel: () => void;
  onSave?: () => void | Promise<void>;
  onSubmit: () => void | Promise<void>;
  saveDisabled?: boolean;
  submitDisabled?: boolean;
  busy?: boolean;
  saveLabel?: string;
  submitLabel: string;
};

export function WizardActionBar({
  onCancel,
  onSave,
  onSubmit,
  saveDisabled = false,
  submitDisabled = false,
  busy = false,
  saveLabel = "ops.trip.save_progress",
  submitLabel,
}: WizardActionBarProps) {
  const { t } = useI18n();
  const base =
    "group w-full sm:w-auto h-10 px-5 rounded-xl text-[13px] font-semibold transition-all duration-200 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center gap-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/30 focus-visible:ring-offset-1";
  return (
    <div
      className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-4 border-t border-slate-100"
      role="group"
      aria-label={t("ops.trip.step_actions")}
    >
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        aria-busy={busy || undefined}
        className={`${base} border border-slate-200 bg-white text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm`}
      >
        <X size={15} className="shrink-0 transition-transform duration-200 group-hover:rotate-90" aria-hidden /> {t("common.cancel")}
      </button>
      {onSave && (
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={busy || saveDisabled}
          aria-busy={busy || undefined}
          className={`${base} border border-blue-100 bg-blue-50/70 text-blue-500 hover:bg-blue-50/80 hover:border-blue-100 hover:shadow-sm`}
        >
          {busy ? (
            <Loader2 size={15} className="animate-spin shrink-0" aria-hidden />
          ) : (
            <Save size={15} className="shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5" aria-hidden />
          )}{" "}
          {t(saveLabel)}
        </button>
      )}
      <button
        type="button"
        onClick={() => void onSubmit()}
        disabled={busy || submitDisabled}
        aria-busy={busy || undefined}
        className={`${base} bg-blue-500 text-white shadow-sm shadow-blue-400/25 hover:bg-blue-600 hover:shadow-md hover:shadow-blue-400/30 hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:shadow-sm`}
      >
        {busy ? (
          <Loader2 size={15} className="animate-spin shrink-0" aria-hidden />
        ) : (
          <Send size={15} className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
        )}{" "}
        {t(submitLabel)}
      </button>
    </div>
  );
}
