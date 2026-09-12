// src/layouts/DashboardLayout/DashboardLayout.tsx
// Application shell.
//
// Navigation is deliberately FLEXIBLE on desktop: the persistent panel steps
// expanded (260px) → icon rail (72px) → hidden (0), the choice is remembered
// per browser, and the header menu button always brings it back. The content
// column animates its offset so nothing jumps.
// Below `lg` the same entries live in the floating popup.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../../ui/Sidebar/Sidebar";
import Header from "../../ui/Header/Header";
import CommandPalette from "../../ui/CommandPalette/CommandPalette";
import { ApprovalAlertToaster } from "../../modules/approvals/components/ApprovalAlertToaster";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import {
  isValidSidebarMode,
  nextSidebarMode,
  SIDEBAR_CONTENT_CLASS,
  SIDEBAR_STORAGE_KEY,
  type SidebarMode,
} from "../../ui/Sidebar/sidebarMode";

type DashboardLayoutProps = {
  children: ReactNode;
};

/** Tailwind's `lg` breakpoint — the sidebar is only persistent above it. */
const LG_QUERY = "(min-width: 1024px)";

function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Desktop panel shape, remembered per browser.
  const [storedMode, setStoredMode] = useLocalStorage<string>(SIDEBAR_STORAGE_KEY, "expanded");
  const sidebarMode: SidebarMode = isValidSidebarMode(storedMode) ? storedMode : "expanded";
  const setSidebarMode = useCallback(
    (mode: SidebarMode) => setStoredMode(mode),
    [setStoredMode]
  );

  // The small-screen popup is closed by default; the header menu button opens
  // it. Clicking outside the popup (or pressing Escape) closes it.
  const [navOpen, setNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  // Scroll the content area back to the top on navigation.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname, location.search]);

  /**
   * Header menu button:
   *   • desktop — steps the persistent panel (hidden/rail → expanded, expanded
   *     → rail) instead of opening the popup;
   *   • below lg — opens the floating popup, as before.
   */
  const handleMenuClick = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia(LG_QUERY).matches) {
      setSidebarMode(sidebarMode === "expanded" ? "rail" : "expanded");
      return;
    }
    setNavOpen(true);
  }, [sidebarMode, setSidebarMode]);

  // ⌘/Ctrl + B — the familiar "toggle navigation" shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "b") return;
      // Never steal the shortcut while the user is typing.
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))) return;
      e.preventDefault();
      if (!window.matchMedia(LG_QUERY).matches) {
        setNavOpen((prev) => !prev);
        return;
      }
      setSidebarMode(nextSidebarMode(sidebarMode));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarMode, setSidebarMode]);

  return (
    <div
      className={`h-screen overflow-hidden bg-slate-100/80 transition-[padding] duration-300 ease-out dark:bg-slate-950 ${SIDEBAR_CONTENT_CLASS[sidebarMode]}`}
    >
      <div className="flex h-full min-w-0 flex-col">
        <Header
          onMenuClick={handleMenuClick}
          menuOpen={navOpen}
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

      <Sidebar
        open={navOpen}
        onClose={() => setNavOpen(false)}
        mode={sidebarMode}
        onModeChange={setSidebarMode}
      />

      {/* One-time sign-in alert when work is waiting for approval. */}
      <ApprovalAlertToaster />
    </div>
  );
}

export default DashboardLayout;
