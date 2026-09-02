import { Check, CircleAlert, CircleX, Save, Send, X } from "lucide-react";
import { useI18n } from "../../../../i18n";

/**
 * Header "Close" control for a submitted / locked step.
 *
 * CLOSES the Trip Entry editor and returns to the landing state. It does NOT
 * delete the trip, change submitted flags, change status, or clear any backend
 * data — reopening the trip reloads everything from the API. Deliberately
 * distinct from the bottom action-bar "Cancel", which only discards unsaved
 * edits to the step currently being edited.
 */
export function StepCloseButton({ onClose }: { onClose?: () => void }) {
  const { t } = useI18n();
  if (!onClose) return null;
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={t("common.close")}
      title={t("common.close")}
      className="bg-white hover:bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 transition-all active:scale-95"
    >
      <X size={14} />
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
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : shown?.type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
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
  const base = "w-full sm:w-auto h-10 px-5 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center gap-1.5";
  return (
    <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-100">
      <button type="button" onClick={onCancel} disabled={busy} className={`${base} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
        <X size={14} /> {t("common.cancel")}
      </button>
      {onSave && (
        <button type="button" onClick={() => void onSave()} disabled={busy || saveDisabled} className={`${base} border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}>
          <Save size={14} /> {busy ? t("ops.trip.please_wait") : t(saveLabel)}
        </button>
      )}
      <button type="button" onClick={() => void onSubmit()} disabled={busy || submitDisabled} className={`${base} bg-blue-600 text-white hover:bg-blue-700 shadow-sm`}>
        <Send size={14} /> {busy ? t("ops.trip.please_wait") : t(submitLabel)}
      </button>
    </div>
  );
}
