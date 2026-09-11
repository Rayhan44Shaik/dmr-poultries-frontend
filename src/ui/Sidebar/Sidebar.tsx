// src/ui/Sidebar/Sidebar.tsx
// Fast hide/show navigation drawer: hidden by default on every viewport,
// opened by the header menu button, and closed by the X button, outside click,
// Escape, or navigation.

import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { NAV_SECTIONS, NAV_TONE_CLASS, type NavChild } from "../../routes/navigation";
import { useI18n } from "../../i18n";
import BrandMark from "../BrandMark";
import { usePendingApprovals } from "../../modules/approvals/hooks/usePendingApprovals";

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
    case "/accounts?tab=paid-payments":
      return approvals.payments.count;
    default:
      return 0;
  }
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function isChildActive(child: NavChild, pathname: string, search: string): boolean {
  const childUrl = child.path;
  const current = pathname + search;
  return current === childUrl;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const search = location.search;
  const { t } = useI18n();
  const pendingApprovals = usePendingApprovals();
  const [rendered, setRendered] = useState(open);
  const [shown, setShown] = useState(false);

  // Keep the drawer mounted briefly after close so the slide-out stays visible.
  useEffect(() => {
    let frame = 0;
    let nextFrame = 0;
    let timer = 0;

    if (open) {
      frame = requestAnimationFrame(() => {
        setRendered(true);
        nextFrame = requestAnimationFrame(() => setShown(true));
      });
    } else {
      frame = requestAnimationFrame(() => setShown(false));
      timer = window.setTimeout(() => setRendered(false), 150);
    }

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(nextFrame);
      window.clearTimeout(timer);
    };
  }, [open]);

  // Close the drawer on route change.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  // Close the drawer on Escape.
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
    // Multiple attempts to cover paint + drawer animation + fonts
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

  const navContent = (
    <nav className="h-full overflow-y-auto px-3 py-4 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
      {NAV_SECTIONS.map((section) => {
        const SectionIcon = section.icon;
        return (
          <div key={section.id} className="mb-6">
            {/* Section label */}
            <p className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-slate-400/90 dark:text-slate-500">
              {section.labelKey ? t(section.labelKey) : section.label}
            </p>

            <ul className="space-y-0.5">
              {section.children.map((child) => {
                const Icon = child.icon ?? SectionIcon;
                const active = isChildActive(child, pathname, search);
                const label = child.labelKey ? t(child.labelKey) : child.label;
                const tone = NAV_TONE_CLASS[child.tone ?? "slate"];
                const badgeCount = navApprovalBadge(child.path, pendingApprovals);

                return child.soon ? (
                  <li key={child.label}>
                    <span
                      className="group relative flex w-full cursor-default items-center gap-2.5 rounded-lg py-2 pl-3.5 pr-3 text-[13.5px] text-slate-400 dark:text-slate-600"
                      title={child.soon ? `${label} — ${t("sidebar.comingSoon")}` : label}
                    >
                      <Icon size={17} strokeWidth={2} className={`shrink-0 ${tone.icon}`} />
                      <span className="flex-1 truncate text-left">{label}</span>
                      <span className="rounded-full bg-slate-100 px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                        {t("sidebar.comingSoon")}
                      </span>
                    </span>
                  </li>
                ) : (
                  <li key={child.label}>
                    <Link
                      to={child.path}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex items-center gap-2.5 rounded-lg py-2 pl-3.5 pr-3 text-[13.5px] transition-colors duration-150 ${
                        active
                          ? `${tone.row} font-semibold ${tone.text}`
                          : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-200"
                      }`}
                    >
                      {/* Active accent bar */}
                      {active && (
                        <span className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full ${tone.bar}`} />
                      )}
                      <Icon
                        size={17}
                        strokeWidth={2}
                        className={`shrink-0 ${active ? tone.iconActive : tone.icon}`} />
                      <span className="flex-1 truncate text-left">{label}</span>
                      {badgeCount > 0 && (
                        <span
                          title={`${badgeCount} pending approval${badgeCount === 1 ? "" : "s"}`}
                          className="ml-auto inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-amber-100 px-1 text-[10px] font-bold tabular-nums text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                        >
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
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

  return rendered ? (
    <>
      {/* Click-catcher for fast close on every screen size. */}
      <div
        className={`fixed inset-0 z-40 bg-slate-950/10 backdrop-blur-[1px] transition-opacity duration-150 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Flexible navigation drawer: hidden initially, quick slide in/out. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("header.openMenu")}
        className={`fixed inset-y-0 left-0 z-50 flex w-[300px] max-w-[calc(100vw-24px)] flex-col overflow-hidden border-r border-slate-200 bg-white shadow-pop transition-transform duration-150 ease-out dark:border-slate-800 dark:bg-slate-900 sm:w-[320px] lg:w-[280px] ${
          shown ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 pl-4 pr-2 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark size="xs" variant="plain" />
            <span className="truncate text-[13px] font-bold tracking-tight text-slate-900 dark:text-white">
              DMR Poultries
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label={t("header.closeMenu")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{navContent}</div>
      </aside>
    </>
  ) : null;
}
