import { Check, CircleAlert, CircleX, Loader2, Save, Send, X } from "lucide-react";
import { useI18n } from "../../../../i18n";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";
export { TripNoBadge } from "./TripNoBadge";

/**
 * Top-right Close (X).
 * - Locked / submitted view → closes the open trip and returns to Create New Trip
 *   (same animated X as Trip List view).
 * - Edit mode on a submitted step → exits edit back to the locked view.
 * Distinct from bottom Cancel only when used in edit mode; on locked view both
 * close the wizard.
 */
export function StepCloseButton({
  onClose,
  animated = true,
}: {
  onClose?: () => void;
  /** Fade/scale entrance (default true). */
  animated?: boolean;
}) {
  const { t } = useI18n();
  if (!onClose) return null;
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={t("common.close")}
      className={`group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-100 hover:bg-red-50 hover:text-red-500 active:scale-95 ${
        animated ? "animate-scale-in" : ""
      }`}
    >
      <span className={`inline-flex ${animated ? uiActionIconMotionClass.close : ""}`}>
        <X size={16} />
      </span>
    </button>
  );
}

export type WizardNoticeState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

function resolveWizardNotice(
  notice: WizardNoticeState | undefined,
  dirty: boolean,
  unsavedLabel: string
): NonNullable<WizardNoticeState> | null {
  return notice ?? (dirty ? { type: "info", message: unsavedLabel } : null);
}

function WizardNoticeBanner({ shown }: { shown: NonNullable<WizardNoticeState> }) {
  const styles =
    shown.type === "success"
      ? "border-emerald-100 bg-emerald-50/70 text-emerald-600"
      : shown.type === "error"
        ? "border-red-100 bg-red-50/70 text-red-500"
        : "border-amber-100 bg-amber-50/70 text-amber-600";
  const Icon = shown.type === "success" ? Check : shown.type === "error" ? CircleX : CircleAlert;

  return (
    <div
      className={`min-h-10 max-w-full sm:max-w-md px-3 py-2 rounded-lg border flex items-center gap-2 text-xs font-medium ${styles}`}
      aria-live="polite"
    >
      <Icon size={14} className="shrink-0" />
      <span className="truncate">{shown.message}</span>
    </div>
  );
}

/** Standalone notice (e.g. Trip Entry landing). Prefer WizardActionBar notice props in step footers. */
export function WizardStepNotice({
  notice,
  dirty = false,
}: {
  notice?: WizardNoticeState;
  dirty?: boolean;
}) {
  const { t } = useI18n();
  const shown = resolveWizardNotice(notice, dirty, t("ops.trip.unsaved_changes"));
  return (
    <div className="min-h-10" aria-live="polite">
      {shown ? <WizardNoticeBanner shown={shown} /> : null}
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
  /** Inline left-side status (errors / unsaved / success) — same row as buttons. */
  notice?: WizardNoticeState;
  dirty?: boolean;
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
  notice,
  dirty = false,
}: WizardActionBarProps) {
  const { t } = useI18n();
  const shown = resolveWizardNotice(notice, dirty, t("ops.trip.unsaved_changes"));
  const base =
    "group w-full sm:w-auto h-10 px-5 rounded-xl text-[13px] font-semibold transition-all duration-200 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center gap-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/30 focus-visible:ring-offset-1";
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 pt-4 border-t border-slate-100"
      role="group"
      aria-label={t("ops.trip.step_actions")}
    >
      <div className="min-w-0 flex-1 order-2 sm:order-1">
        {shown ? <WizardNoticeBanner shown={shown} /> : null}
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 shrink-0 order-1 sm:order-2 w-full sm:w-auto">
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
            {busy ? t("ops.trip.saving_progress") : t(saveLabel)}
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
    </div>
  );
}
