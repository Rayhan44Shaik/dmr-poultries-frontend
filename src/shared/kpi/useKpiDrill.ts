// src/shared/kpi/useKpiDrill.ts
import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  readKpiDrill,
  withKpiWindow,
  withoutKpiDrill,
  type KpiDrill,
  type KpiWindow,
} from "./kpiRange";

export interface UseKpiDrillResult {
  /** null unless this page was opened from a dashboard KPI tile. */
  drill: KpiDrill | null;
  /** Dates the page should filter by right now ("" when there is no drill). */
  activeFrom: string;
  activeTo: string;
  /** Flip between the window and the one before it (kept in the URL). */
  setWindow: (win: KpiWindow) => void;
  /** Drop the KPI deep link, leaving the page on its own default filters. */
  clear: () => void;
}

/**
 * Reads the KPI deep link (`?kpi=…&from=…&to=…&win=…`) that a dashboard tile
 * produced. Pages apply `activeFrom`/`activeTo` to their own date filters; the
 * range bar uses `setWindow`/`clear` to move between the two windows.
 *
 * Window changes are `replace`d, so Back still leaves the page in one step
 * instead of replaying every toggle.
 */
export function useKpiDrill(): UseKpiDrillResult {
  const location = useLocation();
  const navigate = useNavigate();

  const drill = useMemo(() => readKpiDrill(location.search), [location.search]);

  const setWindow = useCallback(
    (win: KpiWindow) => {
      navigate(`${location.pathname}${withKpiWindow(location.search, win)}`, { replace: true });
    },
    [location.pathname, location.search, navigate]
  );

  const clear = useCallback(() => {
    navigate(`${location.pathname}${withoutKpiDrill(location.search)}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  return {
    drill,
    activeFrom: drill?.activeFrom ?? "",
    activeTo: drill?.activeTo ?? "",
    setWindow,
    clear,
  };
}
