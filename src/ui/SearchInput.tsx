/**
 * =============================================================================
 * GLOBAL SEARCH INPUT
 * =============================================================================
 * One search control for the whole app: same height (40px), radius, border,
 * leading icon and icon size, placeholder treatment, focus ring, clear button
 * and responsive behaviour.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE ARE TWO CALLBACKS
 * ---------------------------------------------------------------------------
 * `onChange(value)` fires on EVERY keystroke and is what the input's `value`
 * is bound to, so typing is always instant and input is never lost or lagged.
 *
 * `onSearch(value)` fires when a search should actually be *performed*:
 *   • after `debounce` ms of inactivity (for remote/API search), or
 *   • immediately on Enter, or
 *   • immediately when the query is cleared.
 *
 * That split is what prevents duplicate requests. A naive implementation that
 * calls the API from `onChange` fires one request per character; one that
 * debounces the *value* itself makes the field feel broken. Here the field is
 * instant and the request is coalesced.
 *
 * Enter flushes the pending debounce instead of adding to it, so pressing Enter
 * can never produce two requests for one query.
 *
 * ---------------------------------------------------------------------------
 * KEYBOARD
 * ---------------------------------------------------------------------------
 *   • Tab / Shift+Tab — normal focus order (it is a native input)
 *   • Enter — perform the search now (single request)
 *   • Escape — blurs the field WITHOUT clearing it. Escape is deliberately not
 *     used to wipe the query: that would destroy user input, and inside a
 *     dialog Escape must still reach the dialog's own close handler (we never
 *     call preventDefault, so it does).
 *   • Arrow keys — untouched. This is a text field; the cursor and selection
 *     keep their normal behaviour.
 * =============================================================================
 */

import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "../utils/cn";
import { Field } from "./Field";
import {
  uiFocusRing,
  uiInputClass,
  uiSearchClearClass,
  uiSearchIconClass,
  uiSearchWrapClass,
} from "../shared/ui/uiTokens";

export interface SearchInputProps {
  /** Current query. Controlled, so the caller owns the state. */
  value: string;
  /** Fires on every keystroke with the raw value. */
  onChange: (value: string) => void;
  /**
   * Fires when a search should be performed: after `debounce` ms of inactivity,
   * on Enter, or on clear. Omit for purely client-side filtering, where
   * `onChange` alone is enough.
   */
  onSearch?: (value: string) => void;
  /** Debounce for `onSearch`, in ms. Default 300; 0 fires synchronously. */
  debounce?: number;
  placeholder?: string;
  label?: string;
  helper?: string;
  id?: string;
  disabled?: boolean;
  /** Shows a spinner in the icon slot while a remote search is in flight. */
  loading?: boolean;
  autoFocus?: boolean;
  className?: string;
  /** Extra class on the wrapper (usually a width, e.g. `sm:w-72`). */
  wrapperClassName?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

export function SearchInput({
  value,
  onChange,
  onSearch,
  debounce = 300,
  placeholder = "Search…",
  label,
  helper,
  id,
  disabled,
  loading = false,
  autoFocus,
  className,
  wrapperClassName,
  "aria-label": ariaLabel,
  "data-testid": dataTestId,
}: SearchInputProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * The last query we actually searched for. Seeded with the INITIAL value, so
   * mounting never issues a search: the caller's own first load already
   * fetched that query and re-running it would be a duplicate request.
   */
  const lastSearchedRef = useRef<string>(value);
  /**
   * `onSearch` is read through a ref so the debounce effect depends only on the
   * query and the delay. A caller that passes an inline arrow function gets a
   * new identity every render; depending on it directly would restart the timer
   * on every render and the debounce would never settle.
   */
  const onSearchRef = useRef(onSearch);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  // Cancel any in-flight timer when the component unmounts.
  useEffect(() => clearTimer, [clearTimer]);

  /** Run a search now, cancelling any pending debounce. Idempotent per value. */
  const runSearch = useCallback(
    (next: string) => {
      clearTimer();
      const handler = onSearchRef.current;
      if (!handler) return;
      // Coalesce: the same query is never searched twice in a row.
      if (lastSearchedRef.current === next) return;
      lastSearchedRef.current = next;
      handler(next);
    },
    [clearTimer],
  );

  // Debounced search as the user types.
  useEffect(() => {
    clearTimer();
    if (debounce <= 0) {
      runSearch(value);
      return;
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      runSearch(value);
    }, debounce);

    return clearTimer;
  }, [value, debounce, runSearch, clearTimer]);

  const handleChange = (next: string) => {
    onChange(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      // Flush: one request for this query, not Enter + debounce.
      event.preventDefault();
      runSearch(value);
      return;
    }
    if (event.key === "Escape") {
      // Non-destructive: keep the query, release focus. Never preventDefault,
      // so a surrounding dialog still receives Escape.
      event.currentTarget.blur();
    }
  };

  const handleClear = () => {
    if (disabled) return;
    onChange("");
    // Clearing is an explicit user action: search immediately, no debounce.
    runSearch("");
  };

  const hasValue = value.length > 0;

  const control = (ids: { id: string; describedBy?: string; invalid: boolean }) => (
    <div className={cn(uiSearchWrapClass, wrapperClassName)}>
      {/* Leading icon — or a spinner while a remote search is in flight. The
          slot is fixed-size so swapping between them cannot shift the text. */}
      <span className={uiSearchIconClass} aria-hidden="true">
        {loading ? <Loader2 className="animate-spin" /> : <Search />}
      </span>

      <input
        id={ids.id || undefined}
        type="search"
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={label ? undefined : (ariaLabel ?? placeholder)}
        aria-describedby={ids.describedBy}
        aria-busy={loading || undefined}
        autoComplete="off"
        spellCheck={false}
        data-testid={dataTestId}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(
          uiInputClass,
          hasValue ? "pl-9 pr-9" : "pl-9 pr-3",
          // `type="search"` draws a native clear button in WebKit; we render
          // our own so the control looks identical on every platform.
          "[&::-webkit-search-cancel-button]:appearance-none",
          "[&::-webkit-search-decoration]:appearance-none",
          className,
        )}
      />

      {hasValue && !disabled ? (
        <button
          type="button"
          onClick={handleClear}
          className={cn(uiSearchClearClass, uiFocusRing)}
          aria-label="Clear search"
          title="Clear search"
          tabIndex={0}
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );

  if (!label && !helper) {
    return control({ id: id ?? "", describedBy: undefined, invalid: false });
  }

  return (
    <Field label={label} htmlFor={id} helper={helper}>
      {control}
    </Field>
  );
}

export default SearchInput;
