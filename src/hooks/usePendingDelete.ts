import { useEffect, useMemo, useRef, useState } from "react";
import {
  createPendingDeleteController,
  type PendingDeleteSnapshot,
} from "../shared/ui/pendingDelete";

export type PendingDeleteControls<TId extends string | number> = {
  requestDelete: (id: TId) => void;
  cancel: (id: TId) => void;
  isPending: (id: TId) => boolean;
  secondsLeft: (id: TId) => number;
  isCommitting: (id: TId) => boolean;
};

/**
 * Shared delayed-delete UX. Cancel never calls onDelete.
 * Countdown completion calls the existing delete function once.
 */
export function usePendingDelete<TId extends string | number>(
  onDelete: (id: TId) => void | Promise<void>,
): PendingDeleteControls<TId> {
  const [snapshots, setSnapshots] = useState<PendingDeleteSnapshot<TId>[]>([]);
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  const controllerRef = useRef<ReturnType<typeof createPendingDeleteController<TId>> | null>(null);
  if (controllerRef.current == null) {
    controllerRef.current = createPendingDeleteController<TId>({
      onExpire: (id) => onDeleteRef.current(id),
      onChange: setSnapshots,
    });
  }

  useEffect(() => () => controllerRef.current?.dispose(), []);

  const byId = useMemo(() => {
    const map = new Map<TId, PendingDeleteSnapshot<TId>>();
    for (const snapshot of snapshots) map.set(snapshot.id, snapshot);
    return map;
  }, [snapshots]);

  return {
    requestDelete: controllerRef.current.requestDelete,
    cancel: controllerRef.current.cancel,
    isPending: (id: TId) => byId.has(id),
    secondsLeft: (id: TId) => byId.get(id)?.secondsLeft ?? 0,
    isCommitting: (id: TId) => byId.get(id)?.committing === true,
  };
}
