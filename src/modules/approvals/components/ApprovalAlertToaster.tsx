import { useEffect, useRef } from 'react';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import {
  ensureApprovalSnapshotLoaded,
  getApprovalSnapshot,
  subscribeApprovalSnapshot,
} from '../services/approvalSnapshot';

const ALERT_KEY = 'dmr:approval-alert:v1';

/**
 * Mounted once inside the authenticated app shell. When the shell first loads
 * the pending queues, it raises ONE notification summarising everything that is
 * waiting for sign-off (at most once per browser session) — the owner does not
 * have to remember to open the Approval Center.
 */
export function ApprovalAlertToaster() {
  const { showNotification } = useSafeNotification();
  const firedRef = useRef(false);

  useEffect(() => {
    let done = false;

    const consider = () => {
      const state = getApprovalSnapshot();
      if (done || firedRef.current || !state.loaded) return;

      if (state.total === 0) {
        // No need to re-check this session once we know the queues are empty.
        done = true;
        firedRef.current = true;
        try {
          sessionStorage.setItem(ALERT_KEY, 'empty');
        } catch {
          /* private mode — session flag is best-effort */
        }
        return;
      }

      done = true;
      firedRef.current = true;
      try {
        sessionStorage.setItem(ALERT_KEY, String(state.total));
      } catch {
        /* ignore */
      }

      const parts: string[] = [];
      if (state.trips.count > 0) parts.push(`${state.trips.count} trip${state.trips.count === 1 ? '' : 's'}`);
      if (state.maintenance.count > 0)
        parts.push(`${state.maintenance.count} maintenance bill${state.maintenance.count === 1 ? '' : 's'}`);
      if (state.rateEntries.count > 0)
        parts.push(`${state.rateEntries.count} rate entr${state.rateEntries.count === 1 ? 'y' : 'ies'}`);
      if (state.payments.count > 0)
        parts.push(`${state.payments.count} payment${state.payments.count === 1 ? '' : 's'}`);

      showNotification(
        `🔔 ${state.total} item${state.total === 1 ? '' : 's'} pending approval: ${parts.join(', ')}. See the dashboard KPI strip or open the bell for details.`,
        state.total > 10 ? 'error' : 'warning',
        9000
      );
    };

    // Don't re-alert within the same browser session.
    try {
      if (sessionStorage.getItem(ALERT_KEY)) {
        firedRef.current = true;
        done = true;
        return undefined;
      }
    } catch {
      /* ignore */
    }

    void ensureApprovalSnapshotLoaded().then(consider);
    const unsubscribe = subscribeApprovalSnapshot(consider);
    return () => {
      done = true;
      unsubscribe();
    };
  }, [showNotification]);

  return null;
}
