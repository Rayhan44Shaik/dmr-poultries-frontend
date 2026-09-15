// src/modules/staff/components/leave/LeaveRejectDialog.tsx

import { useEffect, useRef, useState } from 'react';
import { XCircle } from 'lucide-react';
import type { LeaveRequest } from '../../types/staffDashboard';

interface LeaveRejectDialogProps {
  /** The selected row. The page mounts this dialog only while rejecting, so the
   *  reason field always starts empty. */
  leave: LeaveRequest;
  onCancel: () => void;
  /** Called with the (non-empty) reason when the user confirms. */
  onConfirm: (reason: string) => void;
}

/**
 * Rejection-reason dialog for the selected row.
 *
 * This replaces the old `window.prompt`: a native prompt blocks the whole page
 * (and a sandboxed/embedded frame can suppress it outright, leaving the Reject
 * button apparently dead). An inline dialog keeps the page responsive, keeps
 * the row on screen while the reason is typed, and matches the rest of the
 * module's styling.
 *
 * Focus starts in the textarea, Escape cancels, and focus returns to whatever
 * opened it — normally the selected table row.
 */
function LeaveRejectDialog({ leave, onCancel, onConfirm }: LeaveRejectDialogProps) {
  const [reason, setReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    textareaRef.current?.focus();
    return () => openerRef.current?.focus?.();
  }, []);

  const trimmed = reason.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-reject-title"
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-rose-50/70 via-white to-rose-50/40 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-rose-50">
            <XCircle className="text-rose-500" size={17} />
          </div>
          <div className="min-w-0">
            <h3 id="leave-reject-title" className="text-sm font-bold text-slate-800">
              Reject leave request
            </h3>
            <p className="truncate text-xs text-slate-500">
              {leave.employeeName} · {leave.fromDate} → {leave.toDate} · {leave.days} day
              {leave.days === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="space-y-2 px-5 py-4">
          <label htmlFor="leave-reject-reason" className="block text-xs font-semibold text-slate-600">
            Rejection reason
          </label>
          <textarea
            id="leave-reject-reason"
            ref={textareaRef}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Why is this request being rejected?"
            className="w-full min-w-0 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-800 shadow-xs outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-rose-300 focus:ring-2 focus:ring-rose-200"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={trimmed.length === 0}
            onClick={() => onConfirm(trimmed)}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-rose-600 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-rose-700 active:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reject request
          </button>
        </div>
      </div>
    </div>
  );
}

export default LeaveRejectDialog;
