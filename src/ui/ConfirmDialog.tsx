/**
 * =============================================================================
 * CONFIRM DIALOG — the one confirmation UI for irreversible actions
 * =============================================================================
 * Consistent title, description, record identity, destructive colour, button
 * order, loading state, focus and keyboard behaviour everywhere.
 *
 * SAFETY DEFAULTS
 *   • Focus lands on CANCEL, not Confirm — an accidental Enter after triggering
 *     a delete cannot silently confirm it. Pass `initialFocus="confirm"` only
 *     for non-destructive prompts.
 *   • There is deliberately NO × close button. A confirmation has exactly two
 *     outcomes and both are explicit; a third ambiguous dismissal path invites
 *     "did I cancel or did nothing happen?". Escape and overlay-click both map
 *     to Cancel, which is unambiguous.
 *   • Button order is Cancel → Confirm (primary last, nearest the reading end),
 *     matching every other dialog footer in the app.
 *   • While `loading`, Confirm is blocked and stays mounted so focus is not
 *     dropped mid-action.
 *
 * KEYBOARD
 *   Tab / Shift+Tab cycle between the two buttons (trapped by Modal), Enter and
 *   Space activate the focused one through the SAME handler a click uses, and
 *   Escape cancels.
 * =============================================================================
 */

import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "../utils/cn";
import { Modal } from "./Modal";
import { Button } from "./Button";
import type { ConfirmTone } from "./confirm/confirmStore";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  /** Concise explanation of the consequence. Avoid raw API/database errors. */
  message?: ReactNode;
  /** Identity of the affected record, shown as a distinct chip. */
  record?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  /** Which button is focused on open. Default `"cancel"` (the safe one). */
  initialFocus?: "confirm" | "cancel";
  /** Blocks Confirm and shows progress; used by declarative callers. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const TONE_ICON_CLASS: Record<ConfirmTone, string> = {
  danger: "bg-rose-50 text-rose-600 border-rose-200",
  warning: "bg-amber-50 text-amber-600 border-amber-200",
  primary: "bg-emerald-50 text-emerald-600 border-emerald-200",
};

export function ConfirmDialog({
  isOpen,
  title,
  message,
  record,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  initialFocus = "cancel",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const Icon = tone === "primary" ? Info : AlertTriangle;
  const destructive = tone === "danger";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      size="sm"
      closeOnEscape
      closeOnOverlay={!loading}
      showCloseButton={false}
      initialFocus={initialFocus === "confirm" ? "last" : "first"}
      title={
        <span className="flex items-start gap-2.5">
          <span
            className={cn(
              "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border",
              TONE_ICON_CLASS[tone],
            )}
            aria-hidden="true"
          >
            <Icon size={16} strokeWidth={2.25} />
          </span>
          <span className="min-w-0 pt-1">{title}</span>
        </span>
      }
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            size="md"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {message ? (
          <p className="text-[13px] leading-relaxed text-slate-600">{message}</p>
        ) : null}

        {record ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
            {record}
          </p>
        ) : null}

        {destructive ? (
          <p className="text-[11px] leading-relaxed text-slate-400">
            This action cannot be undone.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
