/**
 * =============================================================================
 * CONFIRM HOST — renders the single global confirmation dialog
 * =============================================================================
 * Mounted once in App.tsx, next to <NotificationHost />. Reads the promise-based
 * store in `./confirmStore`, so ANY module — component, hook or plain service —
 * can ask for a confirmation without threading a dialog through props:
 *
 *     if (!(await confirmDialog({ title: "Delete collection", record: "COL-42" }))) return;
 *
 * Only one dialog is ever on screen; further requests are queued and resolved in
 * order, so a double-click on Delete cannot produce two dialogs (and therefore
 * cannot produce two deletes).
 * =============================================================================
 */

import { useSyncExternalStore } from "react";
import { useI18n } from "../../i18n";
import { ConfirmDialog } from "../ConfirmDialog";
import {
  getConfirmSnapshot,
  respondConfirm,
  subscribeConfirm,
} from "./confirmStore";

export default function ConfirmHost() {
  const { t } = useI18n();
  const state = useSyncExternalStore(
    subscribeConfirm,
    getConfirmSnapshot,
    getConfirmSnapshot,
  );

  const active = state.active;
  // Rendered only while a request is active: unmounting runs the focus-trap
  // cleanup, which returns focus to the control that triggered the confirm.
  if (!active) return null;

  const { options } = active;

  return (
    <ConfirmDialog
      isOpen
      title={options.title}
      message={options.message}
      record={options.record}
      tone={options.tone ?? "danger"}
      initialFocus={options.initialFocus ?? "cancel"}
      confirmLabel={options.confirmLabel ?? t("common.confirm")}
      cancelLabel={options.cancelLabel ?? t("common.cancel")}
      onConfirm={() => respondConfirm(true)}
      onCancel={() => respondConfirm(false)}
    />
  );
}
