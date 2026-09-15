/**
 * =============================================================================
 * GLOBAL MODAL / DIALOG — one dialog system for the whole application
 * =============================================================================
 * Consistent dimensions, padding, header, body, footer, overlay, scrolling,
 * focus and keyboard behaviour everywhere.
 *
 * ---------------------------------------------------------------------------
 * PORTAL
 *   Rendered through `createPortal` into `document.body`. A dialog mounted
 *   inside a page subtree inherits that subtree's `overflow: hidden`,
 *   `transform` and `z-index` stacking context, which is what caused clipped
 *   dialogs and DatePickers cut off at a card boundary. Portalling removes the
 *   whole class of problem.
 *
 * ---------------------------------------------------------------------------
 * FOCUS (via the shared `useFocusTrap`)
 *   open  → focus moves to the first focusable control (or the panel)
 *   Tab   → cycles inside the dialog; never leaks to the page behind
 *   S+Tab → cycles backwards inside the dialog
 *   Esc   → closes when `closeOnEscape` (default true)
 *   close → focus returns to the element that opened the dialog, and only if
 *           that element still exists (so deleting a row cannot dump focus on
 *           <body> and make it "disappear")
 *
 * ---------------------------------------------------------------------------
 * SCROLLING & LAYOUT STABILITY
 *   The panel is a flex column with a capped height, so the HEADER and FOOTER
 *   stay pinned and only the BODY scrolls. `overscroll-contain` stops the page
 *   behind from scrolling once the body reaches its end.
 *   No body scroll-lock is applied: the app shell is already
 *   `h-screen overflow-hidden` with its own scroll container, and toggling
 *   `document.body.style.overflow` risked clobbering a value set elsewhere.
 *   `html { scrollbar-gutter: stable }` (tokens) already prevents any shift.
 *
 * ---------------------------------------------------------------------------
 * COMPATIBILITY
 *   Accepts both `isOpen` (this file's historic prop) and `open` (the prop used
 *   by the older `components/common/Modal`), plus a legacy `width` string, so
 *   every existing call site keeps working.
 * =============================================================================
 */

import type { ReactNode } from "react";
import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../utils/cn";
import { useFocusTrap, type InitialFocusTarget } from "../hooks/useFocusTrap";
import {
  uiDialogBodyClass,
  uiDialogCloseClass,
  uiDialogDescriptionClass,
  uiDialogFooterClass,
  uiDialogHeaderClass,
  uiDialogPanelClass,
  uiDialogTitleClass,
  uiOverlayClass,
} from "../shared/ui/uiTokens";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[min(96rem,calc(100vw-1.5rem))]",
};

export interface ModalProps {
  /** Canonical open flag. */
  isOpen?: boolean;
  /** Alias accepted for compatibility with the legacy common/Modal API. */
  open?: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Secondary line under the title; wired to `aria-describedby`. */
  description?: ReactNode;
  children: ReactNode;
  /** Sticky action row. Buttons should be right-aligned; primary last. */
  footer?: ReactNode;
  size?: ModalSize;
  /** Legacy escape hatch: a raw max-width class, e.g. `"max-w-3xl"`. */
  width?: string;
  /** Close when the overlay is clicked. Default true. */
  closeOnOverlay?: boolean;
  /** Close on Escape. Default true. */
  closeOnEscape?: boolean;
  /** Render the × in the header. Default true. */
  showCloseButton?: boolean;
  /** Where focus goes on open. Default `"first"`. */
  initialFocus?: InitialFocusTarget;
  className?: string;
  bodyClassName?: string;
  footerClassName?: string;
  /** Accessible label used when there is no visible title. */
  "aria-label"?: string;
  /**
   * Extra classes on the overlay only — the scrim behind the panel. Used to
   * flatten the default 1px backdrop blur where a form must keep the page
   * behind it readable. The panel itself is never affected.
   */
  overlayClassName?: string;
}

export function Modal({
  isOpen,
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  width,
  closeOnOverlay = true,
  closeOnEscape = true,
  showCloseButton = true,
  initialFocus = "first",
  className,
  bodyClassName,
  footerClassName,
  overlayClassName,
  "aria-label": ariaLabel,
}: ModalProps) {
  const isOpened = Boolean(isOpen ?? open);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useFocusTrap({
    active: isOpened,
    containerRef: panelRef,
    initialFocus,
    onEscape: closeOnEscape ? onClose : undefined,
  });

  // Focus restoration on close/unmount is owned entirely by `useFocusTrap`,
  // including the case where the dialog is unmounted by a parent route change.

  if (!isOpened) return null;

  const dialog = (
    <div
      className={cn(uiOverlayClass, "z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4", overlayClassName)}
      onMouseDown={(event) => {
        // Only a press that STARTS on the overlay closes the dialog, so a user
        // who selects text inside the panel and releases over the overlay does
        // not lose their work.
        if (!closeOnOverlay) return;
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        aria-label={title ? undefined : ariaLabel}
        className={cn(
          uiDialogPanelClass,
          // On phones the sheet sits at the bottom (thumb-reachable); from `sm`
          // up it is centred. Height is capped so the footer is never pushed
          // off-screen and the body scrolls instead.
          "max-h-[100dvh] w-full sm:max-h-[calc(100dvh-2rem)]",
          "rounded-b-none sm:rounded-b-2xl",
          width ?? SIZE_CLASS[size],
          className,
        )}
      >
        {(title || description || showCloseButton) && (
          <div className={uiDialogHeaderClass}>
            <div className="min-w-0 flex-1">
              {title ? (
                <h2 className={uiDialogTitleClass} id={titleId}>
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className={uiDialogDescriptionClass} id={descriptionId}>
                  {description}
                </p>
              ) : null}
            </div>

            {showCloseButton ? (
              <button
                type="button"
                onClick={onClose}
                className={`group ${uiDialogCloseClass}`}
                aria-label="Close dialog"
                title="Close dialog"
              >
                {/* The X plays the shared dismiss twist on hover — the same
                    action-glyph language as the toolbar Reset / PDF buttons. */}
                <span className="inline-flex group-hover:animate-[var(--animate-action-close)]">
                  <X aria-hidden="true" />
                </span>
              </button>
            ) : null}
          </div>
        )}

        <div className={cn(uiDialogBodyClass, bodyClassName)}>{children}</div>

        {footer ? (
          <div className={cn(uiDialogFooterClass, footerClassName)}>{footer}</div>
        ) : null}
      </div>
    </div>
  );

  // Portal to <body>; fall back to inline rendering when there is no document
  // (server rendering / component tests).
  if (typeof document === "undefined") return dialog;
  return createPortal(dialog, document.body);
}

export default Modal;
