/**
 * =============================================================================
 * useFocusTrap — dialog focus management, implemented once
 * =============================================================================
 * Every dialog, drawer, popover and the command palette share this hook, so
 * focus behaviour is identical everywhere:
 *
 *   OPEN   → focus moves to the initial control (or the panel itself when the
 *            panel has nothing focusable, so Escape/Tab still work)
 *   TAB    → cycles within the container; never leaks to the page behind
 *   S+TAB  → cycles backwards within the container
 *   ESCAPE → calls `onEscape` (unless something already handled the event)
 *   CLOSE  → focus returns to the element that opened the dialog
 *
 * STABILITY NOTES
 *   • The focusable list is recomputed at keydown time, not cached in an
 *     effect, so content that mounts later (async form fields, validation
 *     messages) is included without re-running the trap.
 *   • `preventScroll: true` on every programmatic focus call: opening a dialog
 *     must never scroll the page underneath.
 *   • On close, focus is restored ONLY if the original trigger is still in the
 *     document. If it was removed (e.g. the row the user just deleted), focus
 *     is left where the caller put it instead of being dumped on <body> — that
 *     is the "focus disappears" bug this guard prevents.
 *   • No body scroll-lock is applied. The app shell is `h-screen
 *     overflow-hidden` with its own scroll container, so locking `body` was a
 *     no-op that risked clobbering an inline style set elsewhere.
 * =============================================================================
 */

import { useEffect, type RefObject } from "react";
import { getFocusableElements } from "../utils/interaction";

export type InitialFocusTarget =
  /** First focusable element inside the container (default). */
  | "first"
  /** Last focusable element — useful when the primary action is the footer. */
  | "last"
  /** The container itself; it must be focusable (tabIndex={-1}). */
  | "container"
  /** Do not move focus on open. */
  | "none";

export interface UseFocusTrapOptions {
  /** Whether the trap is active (i.e. the dialog is open). */
  active: boolean;
  /** The dialog panel element. */
  containerRef: RefObject<HTMLElement | null>;
  /** Where to put focus when the trap activates. */
  initialFocus?: InitialFocusTarget;
  /** Invoked on Escape while active. Omit to make Escape do nothing. */
  onEscape?: () => void;
  /** Return focus to the opener on close. Default true. */
  restoreFocus?: boolean;
}

export function useFocusTrap({
  active,
  containerRef,
  initialFocus = "first",
  onEscape,
  restoreFocus = true,
}: UseFocusTrapOptions): void {
  /* ---- activate: remember the opener, then move focus in ---------------- */
  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    // Capture the opener BEFORE moving focus.
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const moveFocusIn = () => {
      if (initialFocus === "none") return;

      const focusable = getFocusableElements(container);

      if (initialFocus === "container" || focusable.length === 0) {
        // Ensure the panel can hold focus so Escape and Tab still work.
        if (!container.hasAttribute("tabindex")) container.setAttribute("tabindex", "-1");
        container.focus({ preventScroll: true });
        return;
      }

      const target =
        initialFocus === "last"
          ? focusable[focusable.length - 1]
          : focusable[0];
      target?.focus({ preventScroll: true });
    };

    // Defer one frame: children (portal content, async fields) may not have
    // committed yet, and focusing during commit can be swallowed.
    const frame = requestAnimationFrame(moveFocusIn);

    return () => {
      cancelAnimationFrame(frame);

      if (restoreFocus && previouslyFocused && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
    // `onEscape` is handled in a separate effect so a new inline callback does
    // not tear down and re-run focus restoration on every parent render.
  }, [active, containerRef, initialFocus, restoreFocus]);

  /* ---- Tab cycling + Escape -------------------------------------------- */
  useEffect(() => {
    if (!active) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const container = containerRef.current;
      if (!container) return;

      if (event.key === "Escape") {
        // Let a nested layer (a popover inside the dialog) handle it first.
        if (event.defaultPrevented) return;
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        // Nothing to cycle through: keep focus on the panel itself.
        event.preventDefault();
        if (!container.hasAttribute("tabindex")) container.setAttribute("tabindex", "-1");
        container.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      // Focus is outside the container (e.g. the user clicked the overlay):
      // pull it back in rather than letting it wander the page behind.
      if (!container.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
        return;
      }

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
        return;
      }

      if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, containerRef, onEscape]);
}
