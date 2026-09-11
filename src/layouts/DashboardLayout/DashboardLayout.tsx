// src/layouts/DashboardLayout/DashboardLayout.tsx
// Application shell: floating navigation popup (open via the menu button,
// close by clicking outside or Escape) + header + command palette.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../../ui/Sidebar/Sidebar";
import Header from "../../ui/Header/Header";
import CommandPalette from "../../ui/CommandPalette/CommandPalette";

type DashboardLayoutProps = {
  children: ReactNode;
};

function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // The navigation popup is closed by default; the header menu button
  // opens it. Clicking outside the popup (or pressing Escape) closes it.
  const [navOpen, setNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  // Scroll the content area back to the top on navigation.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname, location.search]);

  return (
    <div className="h-screen overflow-hidden bg-slate-100/80 dark:bg-slate-950 lg:pl-[260px]">
      <div className="flex h-full min-w-0 flex-col">
        <Header
          onMenuClick={() => setNavOpen(true)}
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

      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
    </div>
  );
}

export default DashboardLayout;
