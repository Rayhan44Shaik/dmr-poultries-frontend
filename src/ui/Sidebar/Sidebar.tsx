// src/ui/Sidebar/Sidebar.tsx
// Premium application sidebar: permanently expanded, active states,
// mobile drawer, planned-module pills.

import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { NAV_SECTIONS, NAV_TONE_CLASS, type NavChild } from "../../routes/navigation";
import { useI18n } from "../../i18n";
import BrandMark from "../BrandMark";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function isChildActive(child: NavChild, pathname: string, search: string): boolean {
  const childUrl = child.path;
  const current = pathname + search;
  return current === childUrl;
}

export default function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const search = location.search;
  const { t } = useI18n();

  // Close the mobile drawer on route change.
  useEffect(() => {
    onCloseMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  // Close the mobile drawer on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseMobile();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCloseMobile]);

  // Auto-scroll active nav item into view (e.g., Reports → Shop Ledger)
  // so opening Shop Ledger directly shows its nav entry without manual scroll.
  useEffect(() => {
    const doScroll = () => {
      const activeLinks = document.querySelectorAll('nav a[aria-current="page"]');
      if (activeLinks.length === 0) return;
      activeLinks.forEach((el) => {
        const nav = el.closest("nav") as HTMLElement | null;
        if (!nav) return;
        // Skip hidden navs (desktop hidden on mobile, drawer hidden on desktop)
        if (nav.clientHeight === 0 || (nav as HTMLElement).offsetParent === null) {
          // For hidden via display:none, clientHeight is 0; for lg:hidden etc, check computed
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
          // Subtle flash to draw eye to the active Shop Ledger row
          (el as HTMLElement).animate?.(
            [{ boxShadow: "0 0 0 0 rgba(16,185,129,0)" }, { boxShadow: "0 0 0 4px rgba(16,185,129,0.18)" }, { boxShadow: "0 0 0 0 rgba(16,185,129,0)" }],
            { duration: 900, easing: "ease-out" }
          );
        } catch {
          // Fallback
          try { (el as HTMLElement).scrollIntoView({ block: "center", behavior: "smooth" }); } catch {}
        }
      });
    };
    // Multiple attempts to cover paint + drawer animation + fonts
    const raf = requestAnimationFrame(() => {
      doScroll();
      const t1 = window.setTimeout(doScroll, 120);
      const t2 = window.setTimeout(doScroll, 350);
      const t3 = window.setTimeout(doScroll, 700);
      (doScroll as any)._t1 = t1; (doScroll as any)._t2 = t2; (doScroll as any)._t3 = t3;
    });
    return () => {
      cancelAnimationFrame(raf);
      try { window.clearTimeout((doScroll as any)._t1); window.clearTimeout((doScroll as any)._t2); window.clearTimeout((doScroll as any)._t3); } catch {}
    };
  }, [pathname, search, mobileOpen]);

  const navContent = (
    <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-none">
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
                        className={`shrink-0 ${active ? tone.iconActive : tone.icon}`}
                      />
                      <span className="flex-1 truncate text-left">{label}</span>
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

  const brandHeader = (
    <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/80 px-5 dark:border-slate-800">
      <BrandMark size="lg" variant="plain" />
      <h1 className="min-w-0 truncate text-[16px] font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">
        DMR Poultries
      </h1>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — permanently docked on the left, always visible */}
      <aside className="relative z-30 hidden h-screen w-[264px] shrink-0 flex-col border-r border-slate-200/80 bg-white lg:flex dark:border-slate-800 dark:bg-slate-900">
        {brandHeader}
        {navContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] animate-fade-in"
            onClick={onCloseMobile}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-slate-200 bg-white shadow-pop animate-scale-in dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 px-5 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <BrandMark size="lg" variant="plain" />
                <h1 className="truncate text-[15px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
                  DMR Poultries
                </h1>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label={t("header.closeMenu")}
              >
                <X size={18} />
              </button>
            </div>
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}