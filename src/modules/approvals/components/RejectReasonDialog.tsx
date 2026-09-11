import { useEffect, useRef, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { Modal } from '../../../ui/Modal';
import { Button } from '../../../ui/Button';

interface RejectReasonDialogProps {
  open: boolean;
  /** What kind of record is being sent back. */
  title: string;
  /** Record identity chip, e.g. a bill / payment number. */
  record: string;
  /** Verb on the confirm button, e.g. "Send back to Draft". */
  confirmLabel: string;
  /** Helper copy above the textarea. */
  helper: string;
  loading?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/**
 * Return / reject decisions always carry a reason — the record moves back to
 * its originator (trip draft, deleted bill, cancelled payment) and the reason
 * is persisted against it.
 */
export function RejectReasonDialog({
  open,
  title,
  record,
  confirmLabel,
  helper,
  loading,
  onConfirm,
  onCancel,
}: RejectReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // The parent remounts this dialog per target (via `key`), so initial state
  // is always fresh — focus is the only effect needed here.
  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  const trimmed = reason.trim();
  const tooShort = trimmed.length < 4;
  const error = touched && tooShort ? 'Please give a reason (at least 4 characters).' : '';

  return (
    <Modal
      isOpen={open}
      onClose={loading ? () => undefined : onCancel}
      title={title}
      description={helper}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            icon={<Undo2 size={15} />}
            loading={loading}
            disabled={tooShort}
            onClick={() => {
              setTouched(true);
              if (!tooShort) onConfirm(trimmed);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
          {record}
        </span>
        <textarea
          ref={inputRef}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          onBlur={() => setTouched(true)}
          rows={4}
          maxLength={500}
          placeholder="Explain what needs to change before it can be approved…"
          className="w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20"
        />
        <div className="flex items-center justify-between text-xs">
          {error ? (
            <span role="alert" className="font-medium text-rose-600">
              {error}
            </span>
          ) : (
            <span className="text-slate-400">The reason is shown to whoever submitted it.</span>
          )}
          <span className="tabular-nums text-slate-400">{reason.length}/500</span>
        </div>
      </div>
    </Modal>
  );
}
