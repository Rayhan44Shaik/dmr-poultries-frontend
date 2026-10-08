// src/ui/Sidebar/Sidebar.tsx
// Navigation that adapts to how much room you want:
//
//   • lg and up — a persistent panel that steps expanded → icon rail → hidden
//     (button in the brand row), and the header menu button brings it back.
//     The width animates and the page content reflows with it.
//   • below lg — the small floating popup, opened from the header menu button
//     and closed by clicking outside, pressing Escape, or navigating.
//
// Every nav glyph animates on hover with a motion written for its own meaning
// (truck drives, rupee flips, wrench tightens, document turns a page…). See
// ui/Sidebar/navMotion.ts + the `--animate-nav-*` family in styles/tokens.css.

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { NAV_CHILD_GROUPS, NAV_TONE_CLASS, navSectionsForRole, type NavChild } from "../../routes/navigation";
import { useAuth } from "../../providers/authContext";
import { hasCapability, CAPABILITIES } from "../../modules/auth/permissions";
import { useI18n } from "../../i18n";
import BrandMark from "../BrandMark";
import { usePendingApprovals } from "../../modules/approvals/hooks/usePendingApprovals";
import { navMotionClass } from "./navMotion";
import { navRevealDelta, navRevealKey, shouldRevealNavRow } from "./navScroll";
import type { SidebarMode } from "./sidebarMode";

/** Pending-approval count surfaced as a badge on specific nav entries. */
function navApprovalBadge(path: string, approvals: ReturnType<typeof usePendingApprovals>): number {
  if (!approvals.loaded) return 0;
  switch (path) {
    case "/operations?tab=trip-entry":
      return approvals.trips.count;
    case "/fleet?tab=entry":
      return approvals.maintenance.count;
    case "/operations?tab=rate-entry":
      return approvals.rateEntries.count;
    case "/operations?tab=collection":
      return approvals.collections.count;
    case "/accounts?tab=paid-payments":
      return approvals.payments.count;
    case "/staff?tab=leaves":
      return approvals.leaves.count;
    default:
      return 0;
  }
}

interface SidebarProps {
  /** Small-screen popup visibility. */
  open: boolean;
  onClose: () => void;
  /** Desktop panel shape. */
  mode: SidebarMode;
  onModeChange: (mode: SidebarMode) => void;
}

/**
 * A nav row is active when it *is* the current location.
 * Query-less rows address real routes (e.g. /operations/orders/assignment):
 * those match on the path, so page-level query state (`?collectionDate=…`)
 * never breaks the highlight. Rows that address a tab (`?tab=orders`) still
 * match exactly, because the query IS the page.
 */
function isChildActive(child: NavChild, pathname: string, search: string): boolean {
  const [childPath, childQuery] = child.path.split("?");
  if (childQuery) return pathname + search === child.path;
  return pathname === childPath || pathname.startsWith(`${childPath}/`);
}

/** Small, square control in the brand row (collapse / expand / hide). */
function BrandControl({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      {children}
    </button>
  );
}

export default function Sidebar({ open, onClose, mode, onModeChange }: SidebarProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const search = location.search;
  const { t } = useI18n();
  const { user } = useAuth();
  const pendingApprovals = usePendingApprovals();

  // Role-scoped navigation: a supervisor sees only the pages the role may open.
  const navSections = useMemo(() => navSectionsForRole(user?.role), [user?.role]);
  const canApproveAnything = hasCapability(user?.role, CAPABILITIES.COLLECTION_APPROVE);

  // Close the popup on route change.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  // Close the popup on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /* ------------------------------------------------------------------------
   * Keep the active row visible — without ever stealing the position you
   * scrolled to (see ui/Sidebar/navScroll.ts for the rules).
   *
   * `pathname` only: an in-page query change (a date, a filter, a page number)
   * is not navigation, and re-running this on every keystroke of the URL is
   * what made the list twitch while you worked.
   * --------------------------------------------------------------------- */
  const userNavigatedRef = useRef(false);
  const revealedKeyRef = useRef("");

  useEffect(() => {
    const navs = Array.from(document.querySelectorAll<HTMLElement>("nav[data-nav-scope]")).filter(
      // Only a list that is actually on screen — the popup and the persistent
      // panel share the rows, and the hidden one has no height to measure.
      (nav) => nav.clientHeight > 0 && nav.offsetParent !== null,
    );
    // A click inside the list already implies "the row is where I put it": the
    // flag is one-shot, so it can never leak into the next navigation.
    const userInitiated = userNavigatedRef.current;
    userNavigatedRef.current = false;
    if (userInitiated) return;
    for (const nav of navs) {
      const row = nav.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!row) continue;
      const delta = navRevealDelta(nav.getBoundingClientRect(), row.getBoundingClientRect());
      const key = navRevealKey(nav.dataset.navScope ?? "", mode, pathname);
      if (!shouldRevealNavRow({ delta, userInitiated, alreadyRevealed: revealedKeyRef.current === key })) continue;
      revealedKeyRef.current = key;
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      nav.scrollTo({ top: nav.scrollTop + delta, behavior: reduceMotion ? "auto" : "smooth" });
      if (!reduceMotion) {
        // A soft flash so a deep link still shows which row it landed on.
        row.animate?.(
          [
            { boxShadow: "0 0 0 0 rgba(16,185,129,0)" },
            { boxShadow: "0 0 0 4px rgba(16,185,129,0.18)" },
            { boxShadow: "0 0 0 0 rgba(16,185,129,0)" },
          ],
          { duration: 900, easing: "ease-out" },
        );
      }
    }
  }, [pathname, mode, open]);

  /*
   * Only an action that actually navigates counts: a click on a row (delegated,
   * so the whole row including its icon qualifies) or Enter/Space on the focused
   * row. Wandering the list with the arrow keys must not silence the reveal for
   * the next real navigation.
   */
  const markUserNavigation = (event: ReactMouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("a")) userNavigatedRef.current = true;
  };
  const markUserKeyNavigation = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") userNavigatedRef.current = true;
  };

  /**
   * One nav list, two shapes. `collapsed` = icon rail: labels are dropped in
   * favour of a native tooltip, badges shrink to a dot and rows centre.
   */
  function renderNav(collapsed: boolean, scope: "desktop" | "popup") {
    return (
      <nav
        data-nav-scope={scope}
        onClick={markUserNavigation}
        onKeyDown={markUserKeyNavigation}
        className={
          /*
           * The list IS the scroll area: `h-full` inside its bounded flex parent
           * (no max-h guesswork — the panel's chrome heights and the font-scale
           * control both change those), and `overscroll-contain` so the wheel
           * stops here instead of chaining into the page behind it. Applies to
           * the rail, the expanded panel and the small-screen popup alike, which
           * is what makes every section reachable on a short viewport.
           */
          `h-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain ${
            collapsed ? "px-2 py-4" : "px-3 py-4"
          } scrollbar-thin`
        }
      >
        {navSections.map((section) => {
          const SectionIcon = section.icon;
          return (
            <div key={section.id} className={collapsed ? "mb-5" : "mb-6"}>
              {/* Section label — in the rail it degrades to a divider. */}
              {collapsed ? (
                <div className="mx-auto mb-2 h-px w-8 bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
              ) : (
                <p className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-slate-400/90 dark:text-slate-500">
                  {section.labelKey ? t(section.labelKey) : section.label}
                </p>
              )}

              <ul className="space-y-0.5">
                {section.children.map((child, index) => {
                  const Icon = child.icon ?? SectionIcon;
                  const active = isChildActive(child, pathname, search);
                  // A grouped run of rows (e.g. the three Orders pages inside
                  // Operations) reads as one block: a single small heading and
                  // a hairline rail instead of a flat, ambiguous list.
                  const groupMeta = child.group ? NAV_CHILD_GROUPS[child.group] : undefined;
                  const groupStart = Boolean(groupMeta) && section.children[index - 1]?.group !== child.group;
                  const GroupIcon = groupMeta?.icon;
                  const groupLabel = groupMeta ? (groupMeta.labelKey ? t(groupMeta.labelKey) : groupMeta.label) : "";
                  const label = child.labelKey ? t(child.labelKey) : child.label;
                  const tone = NAV_TONE_CLASS[child.tone ?? "slate"];
                  // Approval-queue badges only make sense for roles that can
                  // actually approve — the supervisor sees clean rows.
                  const badgeCount = canApproveAnything ? navApprovalBadge(child.path, pendingApprovals) : 0;

                  // The glyph (and only the glyph) carries the motion: the row
                  // is the `group`, so hovering/focusing anywhere on it starts
                  // the animation.
                  const iconNode = (
                    <span
                      className={`inline-flex shrink-0 items-center justify-center ${navMotionClass(child.path)}`}
                    >
                      <Icon
                        size={collapsed ? 18 : 17}
                        strokeWidth={2}
                        className={active ? tone.iconActive : tone.icon}
                      />
                    </span>
                  );

                  if (child.soon) {
                    return (
                      <li key={child.label}>
                        <span
                          className={`group relative flex w-full cursor-default items-center rounded-lg py-2 text-[13.5px] text-slate-400 dark:text-slate-600 ${
                            collapsed ? "justify-center gap-0 px-0" : "gap-2.5 pl-3.5 pr-3"
                          }`}
                          title={child.soon ? `${label} — ${t("sidebar.comingSoon")}` : label}
                        >
                          {iconNode}
                          {collapsed ? null : (
                            <>
                              <span className="flex-1 truncate text-left">{label}</span>
                              <span className="rounded-full bg-slate-100 px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                                {t("sidebar.comingSoon")}
                              </span>
                            </>
                          )}
                        </span>
                      </li>
                    );
                  }

                  return (
                    <Fragment key={child.label}>
                      {groupStart && !collapsed && GroupIcon ? (
                        <li
                          aria-hidden="true"
                          className="flex items-center gap-1.5 px-3 pb-0.5 pt-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400/80 dark:text-slate-500"
                        >
                          <GroupIcon size={11} />
                          {groupLabel}
                        </li>
                      ) : null}
                      <li className={child.group && !collapsed ? "ml-[18px] border-l border-slate-200/80 pl-1 dark:border-slate-800" : undefined}>
                      <Link
                        to={child.path}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        title={collapsed ? label : undefined}
                        aria-label={collapsed ? label : undefined}
                        className={`group relative flex items-center rounded-lg py-2 text-[13.5px] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                          collapsed ? "justify-center gap-0 px-0" : "gap-2.5 pl-3.5 pr-3"
                        } ${
                          active
                            ? `${tone.row} font-semibold ${tone.text}`
                            : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-200"
                        }`}
                      >
                        {/* Active accent bar */}
                        {active && (
                          <span className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full ${tone.bar}`} />
                        )}

                        {iconNode}

                        {collapsed ? (
                          badgeCount > 0 && (
                            <span
                              title={t(
                                  badgeCount === 1
                                    ? "layout.pending_approval_one"
                                    : "layout.pending_approval_many",
                                  { count: badgeCount },
                                )}
                              className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900"
                            />
                          )
                        ) : (
                          <>
                            <span className="flex-1 truncate text-left">{label}</span>
                            {badgeCount > 0 && (
                              <span
                                title={t(
                                  badgeCount === 1
                                    ? "layout.pending_approval_one"
                                    : "layout.pending_approval_many",
                                  { count: badgeCount },
                                )}
                                className="ml-auto inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-amber-100 px-1 text-[10px] font-bold tabular-nums text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                              >
                                {badgeCount > 99 ? "99+" : badgeCount}
                              </span>
                            )}
                          </>
                        )}
                      </Link>
                      </li>
                    </Fragment>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    );
  }

  const desktopNav = mode === "rail" ? renderNav(true, "desktop") : renderNav(false, "desktop");

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Persistent desktop navigation — expanded / rail / hidden           */}
      {/* ------------------------------------------------------------------ */}
      <aside
        data-sidebar-mode={mode}
        aria-hidden={mode === "hidden" ? true : undefined}
        inert={mode === "hidden" ? true : undefined}
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col overflow-hidden border-r border-slate-200 bg-white shadow-sm transition-[width,opacity,transform] duration-300 ease-out dark:border-slate-800 dark:bg-slate-900 lg:flex ${
          mode === "expanded"
            ? "w-[16.25rem] opacity-100 translate-x-0"
            : mode === "rail"
              ? "w-[4.5rem] opacity-100 translate-x-0"
              : "pointer-events-none w-0 -translate-x-4 opacity-0"
        }`}
      >
        {/* Brand row — also hosts the collapse controls. */}
        <div
          className={`flex shrink-0 items-center border-b border-slate-200/80 dark:border-slate-800 ${
            mode === "rail" ? "h-16 flex-col justify-center gap-1 px-0" : "h-16 justify-between px-4"
          }`}
        >
          <div className={`flex min-w-0 items-center ${mode === "rail" ? "justify-center" : "gap-2.5"}`}>
            <BrandMark size="xs" variant="plain" />
            {mode !== "rail" && (
              <span className="truncate text-[13px] font-bold tracking-tight text-slate-900 dark:text-white">
                DMR Poultries
              </span>
            )}
          </div>

          {/* expanded → rail → hidden, and back round. */}
          <div className={`flex items-center ${mode === "rail" ? "gap-0.5" : "gap-0.5"}`}>
            {mode === "expanded" && (
              <BrandControl label={t("sidebar.collapseToIcons") ?? "Collapse to icons"} onClick={() => onModeChange("rail")}>
                <PanelLeftClose size={16} />
              </BrandControl>
            )}
            {mode === "rail" && (
              <>
                <BrandControl label={t("sidebar.expandSidebar") ?? "Expand sidebar"} onClick={() => onModeChange("expanded")}>
                  <PanelLeftOpen size={16} />
                </BrandControl>
                <BrandControl label={t("sidebar.hideSidebar") ?? "Hide sidebar"} onClick={() => onModeChange("hidden")}>
                  <X size={16} />
                </BrandControl>
              </>
            )}
            {mode === "hidden" && (
              <BrandControl label={t("sidebar.expandSidebar") ?? "Expand sidebar"} onClick={() => onModeChange("expanded")}>
                <PanelLeftOpen size={16} />
              </BrandControl>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">{desktopNav}</div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Hidden-panel handle — the visible way back.                        */}
      {/* When the panel is collapsed to zero the aside itself cannot be      */}
      {/* clicked (it is inert and pointer-events-none), so a small handle     */}
      {/* stays pinned under the header. The header menu button does the same */}
      {/* job; this one exists so recovery is obvious.                        */}
      {/* ------------------------------------------------------------------ */}
      {mode === "hidden" && (
        <button
          type="button"
          onClick={() => onModeChange("expanded")}
          title={`${t("sidebar.showSidebar")} (⌘/Ctrl + B)`}
          aria-label={t("sidebar.showSidebar")}
          className="fixed left-3 top-[4.75rem] z-40 hidden h-10 w-10 animate-fade-in items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-lg transition-colors hover:border-slate-300 hover:text-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-emerald-400 lg:flex"
        >
          <PanelLeftOpen size={18} />
        </button>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Small-screen navigation popup                                      */}
      {/* ------------------------------------------------------------------ */}
      {open && (
        <>
          {/* Mobile click-catcher: clicking outside closes the popup. */}
          <div className="fixed inset-0 z-40 lg:hidden" onClick={onClose} aria-hidden="true" />

          <div
            role="dialog"
            aria-modal="true"
            /* Definite height, NOT max-height: percentage-height children
               (nav `h-full`) only resolve inside a definite-height parent, and
               with max-h the nav computed its full content height and was
               clipped by overflow-hidden — the list could not scroll at all
               on small screens. h- caps it; the nav below then owns the
               scrolling. */
            className="fixed left-3 top-[4.5rem] z-50 flex h-[calc(100dvh-6rem)] w-[18.75rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop animate-slide-down dark:border-slate-800 dark:bg-slate-900 sm:left-4 lg:hidden"
          >
            {/* Compact brand row */}
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200/80 pl-4 pr-1.5 dark:border-slate-800">
              <div className="flex min-w-0 items-center gap-2.5">
                <BrandMark size="xs" variant="plain" />
                <span className="truncate text-[13px] font-bold tracking-tight text-slate-900 dark:text-white">
                  DMR Poultries
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label={t("header.closeMenu")}
              >
                <X size={16} />
              </button>
            </div>

            {/* The list scrolls inside the dialog — dvh keeps the last sections
                reachable when the mobile browser chrome takes room. */}
            <div className="min-h-0 flex-1 overflow-hidden">{renderNav(false, "popup")}</div>
          </div>
        </>
      )}
    </>
  );
}
