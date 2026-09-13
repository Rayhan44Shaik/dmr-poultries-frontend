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

import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { NAV_SECTIONS, NAV_TONE_CLASS, type NavChild } from "../../routes/navigation";
import { useI18n } from "../../i18n";
import BrandMark from "../BrandMark";
import { usePendingApprovals } from "../../modules/approvals/hooks/usePendingApprovals";
import { navMotionClass } from "./navMotion";
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

function isChildActive(child: NavChild, pathname: string, search: string): boolean {
  const childUrl = child.path;
  const current = pathname + search;
  return current === childUrl;
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
  const pendingApprovals = usePendingApprovals();

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

  // Auto-scroll active nav item into view (e.g., Reports → Shop Ledger)
  // so opening Shop Ledger directly shows its nav entry without manual scroll.
  useEffect(() => {
    if (!open) return;
    const doScroll = () => {
      const activeLinks = document.querySelectorAll('nav a[aria-current="page"]');
      if (activeLinks.length === 0) return;
      activeLinks.forEach((el) => {
        const nav = el.closest("nav") as HTMLElement | null;
        if (!nav) return;
        // Skip hidden navs
        if (nav.clientHeight === 0 || (nav as HTMLElement).offsetParent === null) {
          const style = window.getComputedStyle(nav);
          if (style.display === "none" || style.visibility === "hidden") return;
        }
        try {
          const navRect = nav.getBoundingClientRect();
          const elRect = (el as HTMLElement).getBoundingClientRect();
          const navHeight = nav.clientHeight;
          const isVisible = elRect.top >= navRect.top && elRect.bottom <= navRect.bottom;
          const elCenterDelta = elRect.top - navRect.top - navHeight / 2 + elRect.height / 2;
          if (!isVisible || Math.abs(elCenterDelta) > 80) {
            nav.scrollTo({ top: nav.scrollTop + elCenterDelta, behavior: "smooth" });
          }
          // Subtle flash to draw eye to the active row
          (el as HTMLElement).animate?.(
            [{ boxShadow: "0 0 0 0 rgba(16,185,129,0)" }, { boxShadow: "0 0 0 4px rgba(16,185,129,0.18)" }, { boxShadow: "0 0 0 0 rgba(16,185,129,0)" }],
            { duration: 900, easing: "ease-out" }
          );
        } catch {
          try { (el as HTMLElement).scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* non-fatal */ }
        }
      });
    };
    // Multiple attempts to cover paint + popup animation + fonts
    const raf = requestAnimationFrame(() => {
      doScroll();
      const t1 = window.setTimeout(doScroll, 120);
      const t2 = window.setTimeout(doScroll, 350);
      const t3 = window.setTimeout(doScroll, 700);
      (doScroll as { _t1?: number; _t2?: number; _t3?: number })._t1 = t1;
      (doScroll as { _t1?: number; _t2?: number; _t3?: number })._t2 = t2;
      (doScroll as { _t1?: number; _t2?: number; _t3?: number })._t3 = t3;
    });
    return () => {
      cancelAnimationFrame(raf);
      try {
        const refs = doScroll as { _t1?: number; _t2?: number; _t3?: number };
        window.clearTimeout(refs._t1);
        window.clearTimeout(refs._t2);
        window.clearTimeout(refs._t3);
      } catch { /* non-fatal */ }
    };
  }, [open, pathname, search]);

  /**
   * One nav list, two shapes. `collapsed` = icon rail: labels are dropped in
   * favour of a native tooltip, badges shrink to a dot and rows centre.
   */
  function renderNav(collapsed: boolean, scope: "desktop" | "popup") {
    return (
      <nav
        data-nav-scope={scope}
        className={
          collapsed
            ? "max-h-[calc(100vh-8.5rem)] overflow-y-auto overflow-x-hidden px-2 py-4 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent"
            : "max-h-[calc(100vh-5rem)] overflow-y-auto px-3 py-4 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent lg:max-h-none"
        }
      >
        {NAV_SECTIONS.map((section) => {
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
                {section.children.map((child) => {
                  const Icon = child.icon ?? SectionIcon;
                  const active = isChildActive(child, pathname, search);
                  const label = child.labelKey ? t(child.labelKey) : child.label;
                  const tone = NAV_TONE_CLASS[child.tone ?? "slate"];
                  const badgeCount = navApprovalBadge(child.path, pendingApprovals);

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
                    <li key={child.label}>
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
                              title={`${badgeCount} pending approval${badgeCount === 1 ? "" : "s"}`}
                              className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900"
                            />
                          )
                        ) : (
                          <>
                            <span className="flex-1 truncate text-left">{label}</span>
                            {badgeCount > 0 && (
                              <span
                                title={`${badgeCount} pending approval${badgeCount === 1 ? "" : "s"}`}
                                className="ml-auto inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-amber-100 px-1 text-[10px] font-bold tabular-nums text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                              >
                                {badgeCount > 99 ? "99+" : badgeCount}
                              </span>
                            )}
                          </>
                        )}
                      </Link>
                    </li>
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
            ? "w-[260px] opacity-100 translate-x-0"
            : mode === "rail"
              ? "w-[72px] opacity-100 translate-x-0"
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
          className="fixed left-3 top-[76px] z-40 hidden h-10 w-10 animate-fade-in items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-lg transition-colors hover:border-slate-300 hover:text-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-emerald-400 lg:flex"
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
            className="fixed left-3 top-[72px] z-50 w-[300px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop animate-slide-down dark:border-slate-800 dark:bg-slate-900 sm:left-4 lg:hidden"
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

            {/* Scrollable nav (capped height keeps the popup small) */}
            {renderNav(false, "popup")}
          </div>
        </>
      )}
    </>
  );
}
