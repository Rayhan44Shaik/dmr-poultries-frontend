import { useEffect, useSyncExternalStore } from 'react';
import {
  ensureApprovalSnapshotLoaded,
  getApprovalSnapshot,
  subscribeApprovalSnapshot,
} from '../services/approvalSnapshot';

/**
 * Live pending-approval counts for the app shell (header bell, sidebar badges).
 * Subscribe-only: the single poller lifecycle is started once by the Header,
 * which stays mounted for the whole authenticated app lifetime.
 */
export function usePendingApprovals() {
  useEffect(() => {
    void ensureApprovalSnapshotLoaded();
  }, []);

  return useSyncExternalStore(
    subscribeApprovalSnapshot,
    getApprovalSnapshot,
    getApprovalSnapshot
  );
}
