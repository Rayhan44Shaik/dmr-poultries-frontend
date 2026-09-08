import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface MasterDialogProps {
  label: string;
  children: ReactNode;
  onClose: () => void;
  isSaving?: boolean;
  width?: "standard" | "wide";
}

/** No second padded card around the form. Portalled menus stay in this modal. */
export default function MasterDialog({
  label,
  children,
  onClose,
  isSaving = false,
  width = "standard",
}: MasterDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const savingRef = useRef(isSaving);
  useEffect(() => {
    closeRef.current = onClose;
    savingRef.current = isSaving;
  }, [onClose, isSaving]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Start at the first data field, rather than the status switch.
    const fields = Array.from(
      ref.current?.querySelectorAll<HTMLElement>(
        "input:not(:disabled), textarea:not(:disabled), [role=combobox]:not(:disabled)",
      ) ?? [],
    );
    const firstField = fields.find(
      (element) =>
        element.getClientRects().length > 0 && !element.matches(":disabled"),
    );
    (firstField ?? ref.current)?.focus({ preventScroll: true });
    const handleKey = (event: KeyboardEvent) => {
      const dialog = ref.current;
      if (!dialog) return;
      if (event.key === "Escape") {
        // Nested pickers consume the first Escape; do not discard the form.
        if (
          dialog.querySelector(
            "[data-master-dropdown-panel], [data-master-calendar] [role=dialog]",
          )
        )
          return;
        event.preventDefault();
        if (!savingRef.current) closeRef.current();
      }
      if (event.key === "Tab") {
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex='0'], a[href]",
          ),
        ).filter(
          (element) =>
            element.tabIndex >= 0 &&
            element.getClientRects().length > 0 &&
            !element.matches(":disabled"),
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first) {
          event.preventDefault();
          dialog.focus();
          return;
        }
        if (!dialog.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 sm:p-6">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-busy={isSaving}
        tabIndex={-1}
        data-master-dialog
        className={`w-full min-w-0 outline-none ${width === "wide" ? "max-w-5xl" : "max-w-4xl"}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
