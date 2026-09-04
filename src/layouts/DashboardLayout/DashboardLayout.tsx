// src/layouts/DashboardLayout/DashboardLayout.tsx
// Application shell: collapsible sidebar + header + command palette.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { PanelLeft } from "lucide-react";
import Sidebar from "../../ui/Sidebar/Sidebar";
import Header from "../../ui/Header/Header";
import CommandPalette from "../../ui/CommandPalette/CommandPalette";

type DashboardLayoutProps = {
  children: ReactNode;
};

const COLLAPSED_KEY = "dmr_sidebar_collapsed";

/**
 * Dev preview only: the sidebar floats (overlay) and starts CLOSED, so page
 * layouts — the wide Orders tables in particular — can be checked at the full
 * window width. Production builds keep the docked sidebar and never render the
 * toggle pill.
 */
const FLOATING_SIDEBAR = import.meta.env.DEV;

function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  // Floating (dev preview) panel — closed by default for full-width checks.
  const [floatingOpen, setFloatingOpen] = useState(false);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, prev ? "0" : "1");
      } catch {
        /* ignore storage errors */
      }
      return !prev;
    });
  };

  // Scroll the content area back to the top on navigation.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname, location.search]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100/80 dark:bg-slate-950">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        floating={FLOATING_SIDEBAR}
        floatingOpen={floatingOpen}
        onCloseFloating={() => setFloatingOpen(false)}
      />

      {/* Dev preview only: reopen the floating sidebar (docked one is gone). */}
      {FLOATING_SIDEBAR && !floatingOpen && (
        <button
          type="button"
          onClick={() => setFloatingOpen(true)}
          title="Open floating sidebar (dev preview)"
          aria-label="Open floating sidebar (dev preview)"
          className="fixed left-3 top-[4.75rem] z-40 inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/95 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-pop backdrop-blur transition-colors hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300 dark:hover:text-white"
        >
          <PanelLeft size={13} />
          Menu
        </button>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onMenuClick={() => (FLOATING_SIDEBAR ? setFloatingOpen(true) : setMobileOpen(true))}
          onOpenCommand={() => setCommandOpen(true)}
        />

        <main ref={mainRef} className="flex-1 overflow-y-auto" id="app-scroll">
          {children}
        </main>
      </div>

      <CommandPalette
        open={commandOpen}
        onOpen={() => setCommandOpen(true)}
        onClose={() => setCommandOpen(false)}
      />
    </div>
  );
}

export default DashboardLayout;
