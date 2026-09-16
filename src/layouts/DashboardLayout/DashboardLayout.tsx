// src/layouts/DashboardLayout/DashboardLayout.tsx
// Application shell.
//
// Navigation is deliberately FLEXIBLE on desktop: the persistent panel steps
// expanded (260px) → icon rail (72px) → hidden (0), the choice is remembered
// per browser, and the header menu button always brings it back. The content
// column animates its offset so nothing jumps.
// Below `lg` the same entries live in the floating popup.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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

/**
 * "Am I already inside the app shell?" — read by the wrapper below.
 *
 * The shell is applied at two layers on purpose: `AppRoutes` loads it via
 * `lazyShell` (so the chrome streams in parallel with the page chunk) and the
 * master / operations page modules also render `<DashboardLayout>` when they
 * are mounted directly (a deep link such as `/masters/shops`, where the page is
 * the route element and no parent supplies the shell).
 *
 * When BOTH apply, the page used to be framed twice: two headers, two
 * sidebars, two `id="app-scroll"` scroll containers, two notification pollers
 * and double the DOM — a measurable jank source, plus duplicated landmarks for
 * screen readers. The flag below makes the shell idempotent: the outermost
 * instance draws the chrome, every nested one renders its children only.
 */
const ShellContext = createContext(false);

function DashboardLayout({ children }: DashboardLayoutProps) {
  const insideShell = useContext(ShellContext);
  // Hook-free guard: the frame (and its hooks) lives in <ShellFrame>, so this
  // early return can never change the number of hooks a mounted instance runs.
  if (insideShell) return <>{children}</>;
  return <ShellFrame>{children}</ShellFrame>;
}

function ShellFrame({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Desktop panel shape, remembered per browser.
  const [storedMode, setStoredMode] = useLocalStorage<string>(SIDEBAR_STORAGE_KEY, "expanded");
  const sidebarMode: SidebarMode = isValidSidebarMode(storedMode) ? storedMode : "expanded";
  const setSidebarMode = useCallback(
    (mode: SidebarMode) => {
      setStoredMode(mode);
      // Notify AppShellModal instantly — same-tab localStorage doesn't fire storage event
      try {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("dmr-sidebar-mode-change", { detail: mode }));
        }
      } catch {
        // ignore
      }
    },
    [setStoredMode]
  );

  const [navOpen, setNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname, location.search]);

  const handleMenuClick = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia(LG_QUERY).matches) {
      setSidebarMode(sidebarMode === "expanded" ? "rail" : "expanded");
      return;
    }
    setNavOpen(true);
  }, [sidebarMode, setSidebarMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "b") return;
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
    <ShellContext.Provider value={true}>
    <div
      className={`h-screen overflow-hidden bg-slate-100/80 transition-[padding] duration-300 ease-out dark:bg-slate-950 ${SIDEBAR_CONTENT_CLASS[sidebarMode]}`}
    >
      <div className="flex h-full min-w-0 flex-col">
        <Header onMenuClick={handleMenuClick} menuOpen={navOpen} onOpenCommand={() => setCommandOpen(true)} />

        <main ref={mainRef} className="flex-1 overflow-y-auto" id="app-scroll">
          {children}
        </main>
      </div>

      <CommandPalette open={commandOpen} onOpen={() => setCommandOpen(true)} onClose={() => setCommandOpen(false)} />

      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} mode={sidebarMode} onModeChange={setSidebarMode} />

      <ApprovalAlertToaster />
    </div>
    </ShellContext.Provider>
  );
}

export default DashboardLayout;
