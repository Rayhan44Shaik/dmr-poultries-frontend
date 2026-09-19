import { AlertTriangle, Info } from "lucide-react";
import Modal from "../../../../ui/Modal";
import { useI18n } from "../../../../i18n";

export type TripStepConfirmTone = "warning" | "info";

type Props = {
  isOpen: boolean;
  title: string;
  message: string;
  /** Already-translated label, or i18n key (defaults to Yes, proceed). */
  confirmLabel?: string;
  /** Already-translated label, or i18n key (defaults to Cancel). */
  cancelLabel?: string;
  type?: TripStepConfirmTone;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Submit confirmation for trip wizard steps.
 * Uses the global Modal portal so it stays centred in the viewport even when
 * the form is scrolled to the bottom — Cancel returns focus/scroll to where
 * the user was (no jump).
 */
export default function TripStepConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  type = "warning",
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useI18n();
  const isWarning = type === "warning";
  const Icon = isWarning ? AlertTriangle : Info;
  const confirmText = confirmLabel
    ? confirmLabel.startsWith("ops.") || confirmLabel.startsWith("common.")
      ? t(confirmLabel)
      : confirmLabel
    : t("ops.trip.yes_proceed");
  const cancelText = cancelLabel
    ? cancelLabel.startsWith("ops.") || cancelLabel.startsWith("common.")
      ? t(cancelLabel)
      : cancelLabel
    : t("common.cancel");

  return (
    <Modal
      open={isOpen}
      onClose={onCancel}
      size="sm"
      showCloseButton={false}
      closeOnOverlay
      closeOnEscape
      overlayClassName="!z-[120] bg-sky-950/30 backdrop-blur-[2px]"
      className="overflow-hidden border-slate-200/80 shadow-xl"
      bodyClassName="!p-0"
      footer={
        <div className="flex w-full items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-9 rounded-lg px-4 text-sm font-bold text-white shadow-sm transition-all active:scale-[0.98] ${
              isWarning
                ? "bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500"
                : "bg-sky-600 hover:bg-sky-700"
            }`}
          >
            {confirmText}
          </button>
        </div>
      }
    >
      <div
        className={`flex items-start gap-3.5 px-5 py-5 ${
          isWarning
            ? "bg-gradient-to-br from-amber-50 via-orange-50/80 to-white"
            : "bg-gradient-to-br from-sky-50 via-blue-50/70 to-white"
        }`}
      >
        <div
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-white/90 ${
            isWarning ? "border-amber-100 text-amber-500" : "border-sky-100 text-sky-600"
          }`}
        >
          <Icon size={20} strokeWidth={2.25} aria-hidden />
        </div>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-[15px] font-bold leading-snug tracking-tight text-slate-900">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{message}</p>
        </div>
      </div>
    </Modal>
  );
}
