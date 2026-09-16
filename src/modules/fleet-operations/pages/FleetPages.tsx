// src/modules/fleet-operations/pages/FleetPages.tsx

import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { retryableImport } from "../../../routes/lazyWithRetry";
import { useLocation, useNavigate } from "react-router-dom";

import {
  DEFAULT_FLEET_TAB,
  isVisibleFleetTab,
  type VisibleFleetTab,
} from "../activeFleetScope";
import FleetTabSkeleton from "../components/common/FleetTabSkeleton";
import {
  cancelIdle,
  onIdle,
  preloadFleetTab,
  tabLoaders,
  type FleetTabComponent,
} from "./fleetTabs";

/*
 * Tabs are lazy so opening /fleet?tab=entry does not evaluate Analytics (Recharts),
 * EMI, History, or Permits before the first paint.
 *
 * DEFERRED / FUTURE — not imported:
 *   dashboard  → ./FleetDashboardPage
 *   reports    → ./VehicleReportsPage
 *   expenses   → ./VehicleExpenseReportPage
 */

const tabComponents: Record<
  VisibleFleetTab,
  React.LazyExoticComponent<FleetTabComponent>
> = Object.fromEntries(
  Object.entries(tabLoaders).map(([tab, loader]) => [
    tab,
    lazy(retryableImport(loader)),
  ])
) as Record<VisibleFleetTab, React.LazyExoticComponent<FleetTabComponent>>;

/** Mounts only after the lazy chunk has resolved (it sits inside Suspense). */
function LoadSignaller({ onLoaded }: { onLoaded: () => void }) {
  useEffect(() => {
    onLoaded();
  }, [onLoaded]);
  return null;
}

/**
 * One tab pane. The entrance pop is applied only once the real page chunk has
 * loaded, so navigating to a heavy tab (Maintenance) pops the page itself
 * instead of animating the skeleton while the chunk is still downloading.
 */
function FleetTabPane({ tab, active }: { tab: VisibleFleetTab; active: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const handleLoaded = React.useCallback(() => setLoaded(true), []);
  const Component = tabComponents[tab];
  const ref = useRef<HTMLDivElement>(null);

  // Re-add the pop class each time the pane becomes active (re-adding
  // restarts the CSS animation); class only exists once content is loaded.
  useEffect(() => {
    if (active && loaded) {
      const el = ref.current;
      if (!el) return;
      el.classList.remove("animate-page-pop");
      void el.offsetWidth;
      el.classList.add("animate-page-pop");
    }
  }, [active, loaded]);

  return (
    <div
      ref={ref}
      hidden={!active}
      aria-hidden={!active}
      className={active && loaded ? "animate-page-pop" : undefined}
    >
      <Suspense fallback={<FleetTabSkeleton />}>
        <LoadSignaller onLoaded={handleLoaded} />
        <Component embedded={true} active={active} />
      </Suspense>
    </div>
  );
}

function FleetPages() {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = React.useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );
  const requestedTab = searchParams.get("tab");
  const activeTab: VisibleFleetTab = isVisibleFleetTab(requestedTab)
    ? requestedTab
    : DEFAULT_FLEET_TAB;

  useEffect(() => {
    if (isVisibleFleetTab(requestedTab)) return;
    navigate(`/fleet?tab=${DEFAULT_FLEET_TAB}`, { replace: true });
  }, [requestedTab, navigate]);

  const [visitedTabs, setVisitedTabs] = useState<Set<VisibleFleetTab>>(
    () => new Set([activeTab])
  );

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  // Warm the active tab immediately (covers deep links such as
  // /fleet?tab=entry) and the remaining tabs on idle, so later switches and
  // dashboard-tile clicks are instant.
  useEffect(() => {
    preloadFleetTab(activeTab);
    const others = (Object.keys(tabLoaders) as VisibleFleetTab[]).filter(
      (t) => t !== activeTab
    );
    const handles = others.map((t) => onIdle(() => preloadFleetTab(t)));
    return () => handles.forEach(cancelIdle);
  }, [activeTab]);

  return (
    <div className="w-full px-4 pb-8 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1480px]">
        {(Object.keys(tabComponents) as VisibleFleetTab[]).map((tab) => {
          if (!visitedTabs.has(tab) && tab !== activeTab) return null;
          return <FleetTabPane key={tab} tab={tab} active={tab === activeTab} />;
        })}
      </div>
    </div>
  );
}

export default React.memo(FleetPages);
