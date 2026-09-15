import { useEffect, useRef } from 'react';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import { useI18n } from '../../../i18n';
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
  const { t } = useI18n();
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

      const part = (key: string, count: number) =>
        t(`layout.approval_alert.part_${key}_${count === 1 ? 'one' : 'many'}`, { count });

      const parts: string[] = [];
      if (state.trips.count > 0) parts.push(part('trips', state.trips.count));
      if (state.maintenance.count > 0) parts.push(part('maintenance', state.maintenance.count));
      if (state.rateEntries.count > 0) parts.push(part('rates', state.rateEntries.count));
      if (state.payments.count > 0) parts.push(part('payments', state.payments.count));
      if (state.collections.count > 0) parts.push(part('collections', state.collections.count));

      showNotification(
        t(
          state.total === 1
            ? 'layout.approval_alert.summary_one'
            : 'layout.approval_alert.summary_many',
          { total: state.total, parts: parts.join(', ') }
        ),
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
  }, [showNotification, t]);

  return null;
}
