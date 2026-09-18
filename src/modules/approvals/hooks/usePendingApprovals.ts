import { useEffect, useSyncExternalStore } from 'react';
import {
  ensureApprovalSnapshotLoaded,
  getApprovalSnapshot,
  subscribeApprovalSnapshot,
} from '../services/approvalSnapshot';
import { useAuth } from '../../../providers/authContext';
import { hasCapability, CAPABILITIES } from '../../auth/permissions';

/**
 * Live pending-approval counts for the app shell (header bell, sidebar badges).
 * Subscribe-only: the single poller lifecycle is started once by the Header,
 * which stays mounted for the whole authenticated app lifetime.
 *
 * ROLE-SCOPED: approval queues summarise owner business (payment requests,
 * rate entries, collection values). A role without approve rights never
 * triggers the snapshot load, so nothing owner-scoped is fetched for it —
 * the store just stays empty and every badge reads zero.
 */
export function usePendingApprovals() {
  const { user } = useAuth();
  const canApprove = hasCapability(user?.role, CAPABILITIES.COLLECTION_APPROVE);

  useEffect(() => {
    if (!canApprove) return undefined;
    void ensureApprovalSnapshotLoaded();
    return undefined;
  }, [canApprove]);

  return useSyncExternalStore(
    subscribeApprovalSnapshot,
    getApprovalSnapshot,
    getApprovalSnapshot
  );
}
