/**
 * =============================================================================
 * GLOBAL TABS — correct tablist semantics and keyboard behaviour
 * =============================================================================
 * The previous implementation rendered plain buttons with no ARIA roles, so a
 * screen reader announced "button" instead of "tab 2 of 5, selected", and there
 * was no arrow-key navigation.
 *
 * Implements the WAI-ARIA Tabs pattern with AUTOMATIC ACTIVATION:
 *   role="tablist" / role="tab" / role="tabpanel"
 *   aria-selected, aria-controls, aria-labelledby, role-appropriate tabindex
 *
 * KEYBOARD
 *   ← / →        move between tabs (horizontal) and activate
 *   ↑ / ↓        move between tabs (vertical orientation)
 *   Home / End   first / last tab
 *   Tab          enters the tablist on the SELECTED tab only, then moves to the
 *                panel — a roving tabindex, so 12 tabs are one Tab stop, not 12
 *   Enter/Space  native button activation (redundant here, but harmless)
 *
 *   Arrow keys are ignored while the user is typing in a field inside the panel
 *   (`isEditableTarget`), so this never hijacks cursor movement.
 *
 * STABILITY
 *   Disabled tabs are skipped by arrow navigation and are never activated.
 *   Panels are keyed by tab id and only the selected panel is mounted, so
 *   switching tabs does not remount unrelated panels and a parent re-render
 *   does not remount the active one.
 * =============================================================================
 */

import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useCallback, useId, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { isEditableTarget, wrapIndex } from "../utils/interaction";
import { uiTabClass, uiTabIndicatorClass, uiTabListClass } from "../shared/ui/uiTokens";

export interface TabItem {
  id: string;
  label: ReactNode;
  content?: ReactNode;
  icon?: ReactNode;
  /** Optional count pill (e.g. number of pending rows). */
  count?: number | string;
  disabled?: boolean;
  /** Accessible name when `label` is an icon only. */
  "aria-label"?: string;
}

export interface TabsProps {
  tabs: TabItem[];
  /** Controlled selected id. Omit for uncontrolled behaviour. */
  activeTab?: string;
  /** Initial selected id (uncontrolled). Defaults to the first enabled tab. */
  defaultTab?: string;
  onChange?: (id: string) => void;
  /** "horizontal" (default) draws an underline; "vertical" stacks. */
  orientation?: "horizontal" | "vertical";
  ariaLabel?: string;
  className?: string;
  /** Class applied to the panel wrapper. */
  panelClassName?: string;
  /**
   * Render your own panel instead of `tab.content` — useful when the panel must
   * stay mounted or is driven by external state.
   */
  children?: (activeId: string) => ReactNode;
}

export function Tabs({
  tabs,
  activeTab,
  defaultTab,
  onChange,
  orientation = "horizontal",
  ariaLabel,
  className,
  panelClassName,
  children,
}: TabsProps) {
  const firstEnabled = tabs.find((tab) => !tab.disabled)?.id ?? tabs[0]?.id;
  const isControlled = activeTab !== undefined;

  const [internalId, setInternalId] = useState<string | undefined>(
    defaultTab ?? firstEnabled,
  );
  const activeId = (isControlled ? activeTab : internalId) ?? firstEnabled;

  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const baseId = useId();

  const select = useCallback(
    (id: string) => {
      if (id === activeId) return;
      if (!isControlled) setInternalId(id);
      onChange?.(id);
    },
    [activeId, isControlled, onChange],
  );

  /** Move selection by `delta`, skipping disabled tabs and wrapping. */
  const moveBy = useCallback(
    (delta: number) => {
      if (tabs.length === 0) return;
      const currentIndex = Math.max(
        0,
        tabs.findIndex((tab) => tab.id === activeId),
      );

      for (let step = 1; step <= tabs.length; step += 1) {
        const nextIndex = wrapIndex(currentIndex, tabs.length, delta * step);
        const candidate = tabs[nextIndex];
        if (!candidate || candidate.disabled) continue;
        select(candidate.id);
        // Focus follows selection (automatic activation).
        requestAnimationFrame(() => {
          tabRefs.current.get(candidate.id)?.focus();
        });
        return;
      }
    },
    [activeId, select, tabs],
  );

  const moveTo = useCallback(
    (index: number) => {
      const target = tabs[index];
      if (!target || target.disabled) return;
      select(target.id);
      requestAnimationFrame(() => {
        tabRefs.current.get(target.id)?.focus();
      });
    },
    [select, tabs],
  );

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // Never hijack arrow keys while the user is typing inside the panel.
    if (isEditableTarget(event.target)) return;
    // Never hijack a browser/OS shortcut.
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    // The cross axis is deliberately left alone: on a horizontal tablist Arrow
    // Up/Down keeps its normal page-scroll behaviour.
    const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
    const prevKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";

    switch (event.key) {
      case nextKey:
        event.preventDefault();
        moveBy(1);
        return;
      case prevKey:
        event.preventDefault();
        moveBy(-1);
        return;
      case "Home":
        event.preventDefault();
        moveTo(0);
        return;
      case "End":
        event.preventDefault();
        moveTo(tabs.length - 1);
        return;
      default:
        return;
    }
  };

  const activeTabItem = tabs.find((tab) => tab.id === activeId);
  const isVertical = orientation === "vertical";

  return (
    <div className={cn(isVertical ? "flex gap-4" : "w-full", className)}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation={orientation}
        onKeyDown={handleKeyDown}
        className={cn(
          uiTabListClass,
          isVertical &&
            "flex-col items-stretch gap-1 overflow-visible border-b-0 border-r border-slate-200 pr-1",
        )}
      >
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) tabRefs.current.set(tab.id, node);
                else tabRefs.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              aria-label={tab["aria-label"]}
              // Roving tabindex: the tablist is a single stop in the page's
              // Tab order, landing on the selected tab.
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => select(tab.id)}
              className={cn(
                uiTabClass(selected),
                isVertical && "rounded-lg justify-start",
                tab.disabled && "cursor-not-allowed opacity-45",
              )}
            >
              {tab.icon ? (
                <span className="[&_svg]:size-4 [&_svg]:shrink-0" aria-hidden="true">
                  {tab.icon}
                </span>
              ) : null}
              <span className="truncate">{tab.label}</span>
              {tab.count !== undefined && tab.count !== null ? (
                <span
                  className={cn(
                    "ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
                    selected
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-500",
                  )}
                >
                  {tab.count}
                </span>
              ) : null}
              {selected && !isVertical ? (
                <span className={uiTabIndicatorClass} aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Only the selected panel is mounted: switching tabs cannot remount an
          unrelated panel, and unselected panels never run their own effects. */}
      <div
        role="tabpanel"
        id={`${baseId}-panel-${activeId}`}
        aria-labelledby={`${baseId}-tab-${activeId}`}
        tabIndex={0}
        // A panel with no focusable content of its own must still be reachable
        // so a keyboard user can scroll it.
        className={cn(
          "min-w-0 flex-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600",
          isVertical ? "" : "pt-4",
          panelClassName,
        )}
        hidden={!activeTabItem && !children}
      >
        {children ? children(activeId) : activeTabItem?.content}
      </div>
    </div>
  );
}

export default Tabs;
