import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../providers/authContext';
import { VEHICLES_CHANGED_EVENT } from '../../masters/vehicles/services/vehicleService';
import { hasPendingEmiRead, invalidateEmiRead, loadEmiSnapshot, type EmiSnapshot } from '../services/emiService';
import { computeKpis, getEmiToday, msUntilNextEmiDay } from '../services/emiModel';
import type { EmiOverview } from '../types';

const EMPTY_ROWS: EmiOverview[] = [];
const FOCUS_REVALIDATE_MS = 30_000;
interface State {
  scope: unknown;
  snapshot: EmiSnapshot | null;
  phase: 'loading' | 'refreshing' | 'ready' | 'error';
  error: 'load' | 'refresh' | 'access' | null;
  notice: 'idle' | 'success' | 'error';
  noticeId: number;
}

/**
 * Read-only, single-flight EMI loading. One atomic snapshot updates the rows,
 * counts and timestamps together. Departed/hidden consumers cannot publish.
 * There is no mutation, storage fallback, interval polling or automatic retry.
 */
export function useEmiData(active = true) {
  const { user } = useAuth();
  const scope = user ?? null;
  const [state, setState] = useState<State>({ scope, snapshot: null, phase: 'loading', error: null, notice: 'idle', noticeId: 0 });
  const mounted = useRef(false);
  const loadGen = useRef(0);
  const listInFlight = useRef(false);
  const wasInactive = useRef(false);
  const lastAttemptAt = useRef(0);

  const load = useCallback(function read(manual = false) {
    if (!mounted.current || listInFlight.current) return;
    // Acquire the guard synchronously, before React renders the disabled button.
    listInFlight.current = true;
    lastAttemptAt.current = Date.now();
    const gen = ++loadGen.current;
    setState((previous) => {
      const snapshot = previous.scope === scope ? previous.snapshot : null;
      return { scope, snapshot, phase: snapshot ? 'refreshing' : 'loading', error: null, notice: 'idle', noticeId: gen };
    });

    const isCurrent = () => mounted.current && gen === loadGen.current;

    void loadEmiSnapshot(scope).then(
      (snapshot) => {
        if (!isCurrent()) return;
        listInFlight.current = false;
        setState({ scope, snapshot, phase: 'ready', error: null, notice: manual ? 'success' : 'idle', noticeId: gen });
      },
      (cause: unknown) => {
        if (!isCurrent()) return;
        listInFlight.current = false;
        const status = cause && typeof cause === 'object' && 'status' in cause ? cause.status : undefined;
        const denied = status === 401 || status === 403;
        setState((previous) => {
          // Network failures retain labeled last-known data. Access denials do
          // not: remove sensitive rows and wait for an authorized read.
          const snapshot = !denied && previous.scope === scope ? previous.snapshot : null;
          return { scope, snapshot, phase: 'error', error: denied ? 'access' : snapshot ? 'refresh' : 'load', notice: manual ? 'error' : 'idle', noticeId: gen };
        });
      },
    );
  }, [scope]);

  const refresh = useCallback(() => load(true), [load]);
  const clearRefreshStatus = useCallback(() => setState((previous) => ({ ...previous, notice: 'idle' })), []);

  useEffect(() => {
    if (!active) { wasInactive.current = true; return; }
    mounted.current = true;
    if (wasInactive.current && hasPendingEmiRead(scope)) invalidateEmiRead(scope);
    wasInactive.current = false;
    load();

    const onVehicleChange = () => {
      invalidateEmiRead(scope);
      load();
    };
    const onReturn = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastAttemptAt.current >= FOCUS_REVALIDATE_MS) {
        lastAttemptAt.current = Date.now();
        onVehicleChange();
      }
    };
    let dayTimer: number;
    const scheduleDayChange = () => {
      dayTimer = window.setTimeout(() => {
        if (document.visibilityState === 'visible') onVehicleChange();
        scheduleDayChange();
      }, msUntilNextEmiDay());
    };
    scheduleDayChange();
    window.addEventListener(VEHICLES_CHANGED_EVENT, onVehicleChange);
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);

    return () => {
      mounted.current = false;
      // This is a request generation counter, not a DOM ref. Invalidate the
      // latest generation, including refreshes started after effect setup.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++loadGen.current;
      listInFlight.current = false;
      window.clearTimeout(dayTimer);
      window.removeEventListener(VEHICLES_CHANGED_EVENT, onVehicleChange);
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [active, load, scope]);

  // Hide an earlier session's snapshot immediately, even before effects run.
  const snapshot = state.scope === scope ? state.snapshot : null;
  const phase = state.scope === scope ? state.phase : 'loading';
  const allRecords = snapshot?.rows ?? EMPTY_ROWS;
  const kpis = useMemo(() => computeKpis(allRecords), [allRecords]);
  return {
    allRecords,
    kpis,
    todayKey: snapshot?.asOfDate ?? getEmiToday(),
    loading: phase === 'loading',
    refreshing: phase === 'refreshing',
    error: state.scope === scope ? state.error : null,
    hasSnapshot: snapshot !== null,
    refresh,
    refreshStatus: state.scope === scope ? state.notice : 'idle',
    refreshEventId: state.scope === scope ? state.noticeId : 0,
    clearRefreshStatus,
    lastRefreshed: snapshot?.fetchedAt ?? null,
  };
}
