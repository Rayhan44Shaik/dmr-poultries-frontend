/**
 * =============================================================================
 * INTERACTION HELPERS — shared keyboard/mouse primitives
 * =============================================================================
 * These exist so keyboard support is implemented ONCE, correctly, and inherited
 * by every component instead of being re-derived (and re-broken) per page.
 *
 * THE CENTRAL RULE enforced by `isEditableTarget`:
 *   Arrow keys, Home and End must keep their normal meaning inside text-entry
 *   fields (cursor movement, text selection, number spinners). Global keyboard
 *   navigation only takes over when the user is NOT typing.
 * =============================================================================
 */

import type { KeyboardEvent as ReactKeyboardEvent } from "react";

/**
 * True when the event target is a place where the user is entering text.
 *
 * Used to bail out of arrow-key / Home / End navigation so we never hijack
 * cursor movement, selection or native number-input behaviour.
 */
export function isEditableTarget(target: EventTarget | null | undefined): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName;
  if (tag === "TEXTAREA") return true;
  if (target.isContentEditable) return true;

  if (tag === "INPUT") {
    // Only text-like inputs own the arrow keys. Checkboxes, radios, ranges,
    // buttons and file inputs do not, so navigation may proceed on those.
    const input = target as HTMLInputElement;
    const type = (input.type || "text").toLowerCase();
    const TEXT_TYPES = new Set([
      "text",
      "search",
      "url",
      "tel",
      "email",
      "password",
      "number",
      "date",
      "datetime-local",
      "month",
      "week",
      "time",
    ]);
    return TEXT_TYPES.has(type);
  }

  // A role="combobox"/"textbox" element behaves like an input even if it is a div.
  const role = target.getAttribute("role");
  return role === "textbox" || role === "combobox" || role === "searchbox";
}

/** Selector matching elements that can receive focus via Tab. */
export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "summary",
  "details",
  "[contenteditable]:not([contenteditable='false'])",
].join(",");

/** Is this element actually reachable and visible to a keyboard user? */
export function isFocusableElement(element: HTMLElement): boolean {
  if (element.hasAttribute("disabled")) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  if (element.tabIndex < 0) return false;
  // Zero-size or display:none elements are not real tab stops.
  if (element.offsetWidth === 0 && element.offsetHeight === 0) {
    // An element can be visually hidden yet still focusable (sr-only links);
    // only exclude it when it is genuinely not rendered.
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  return true;
}

/** All real tab stops inside a container, in DOM order. */
export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(isFocusableElement);
}

/**
 * Move focus within a list of elements, wrapping at the ends.
 * Returns the element that received focus, or null when there was nothing to
 * focus. Shared by menus, tab lists, selectable table rows and the calendar so
 * all of them wrap identically.
 */
export function focusAtIndex(
  elements: HTMLElement[],
  index: number,
  options: { preventScroll?: boolean } = {},
): HTMLElement | null {
  if (elements.length === 0) return null;
  const normalised = ((index % elements.length) + elements.length) % elements.length;
  const next = elements[normalised];
  if (!next) return null;
  next.focus({ preventScroll: options.preventScroll ?? false });
  return next;
}

/**
 * Handle the arrow/Home/End keys for a one-dimensional list.
 *
 * Returns true when the event was consumed (so the caller can `preventDefault`)
 * and false when it should fall through to normal browser behaviour — which is
 * what keeps arrow keys working inside text fields.
 */
export function handleListNavigationKey(
  event: ReactKeyboardEvent | KeyboardEvent,
  options: {
    /** Number of focusable items. */
    count: number;
    /** Currently focused/active index, or -1 when nothing is active. */
    activeIndex: number;
    /** "horizontal" = Left/Right, "vertical" = Up/Down, "both" = either. */
    orientation?: "horizontal" | "vertical" | "both";
    /** Called with the next index when navigation occurs. */
    onNavigate: (nextIndex: number) => void;
    /** Bail out entirely when the user is typing. Default true. */
    respectEditable?: boolean;
  },
): boolean {
  const {
    count,
    activeIndex,
    orientation = "vertical",
    onNavigate,
    respectEditable = true,
  } = options;

  if (count <= 0) return false;
  if (respectEditable && isEditableTarget(event.target)) return false;
  // Never intercept a shortcut the user combined with a modifier key.
  if (event.metaKey || event.ctrlKey || event.altKey) return false;

  const vertical = orientation === "vertical" || orientation === "both";
  const horizontal = orientation === "horizontal" || orientation === "both";

  const current = activeIndex < 0 ? 0 : Math.min(activeIndex, count - 1);

  switch (event.key) {
    case "ArrowDown":
      if (!vertical) return false;
      onNavigate(Math.min(current + 1, count - 1));
      return true;
    case "ArrowUp":
      if (!vertical) return false;
      onNavigate(Math.max(current - 1, 0));
      return true;
    case "ArrowRight":
      if (!horizontal) return false;
      onNavigate(Math.min(current + 1, count - 1));
      return true;
    case "ArrowLeft":
      if (!horizontal) return false;
      onNavigate(Math.max(current - 1, 0));
      return true;
    case "Home":
      onNavigate(0);
      return true;
    case "End":
      onNavigate(count - 1);
      return true;
    default:
      return false;
  }
}

/**
 * Wrap-around variant used by tab lists and menus, where leaving the last item
 * should return to the first (WAI-ARIA APG roving-tabindex behaviour).
 */
export function wrapIndex(index: number, count: number, delta: number): number {
  if (count <= 0) return 0;
  return ((index + delta) % count + count) % count;
}
