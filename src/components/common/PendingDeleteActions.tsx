type PendingDeleteActionsProps = {
  secondsLeft: number;
  onCancel: () => void;
  committing?: boolean;
};

export function PendingDeleteActions({
  secondsLeft,
  onCancel,
  committing = false,
}: PendingDeleteActionsProps) {
  return (
    <div className="flex items-center justify-center gap-2 whitespace-nowrap">
      <span className="text-xs font-semibold text-rose-700">
        Deleting in {Math.max(secondsLeft, 1)} seconds...
      </span>
      {committing ? null : (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onCancel();
          }}
          className="px-2.5 py-1 rounded-md border border-rose-200 bg-white text-xs font-semibold text-rose-700 hover:bg-rose-50"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
