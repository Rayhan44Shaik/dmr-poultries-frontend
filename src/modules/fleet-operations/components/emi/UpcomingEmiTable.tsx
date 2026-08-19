import { memo } from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';
import type { UpcomingEmiRow } from '../../hooks/useEmiData';

const money = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;
const shortDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

interface UpcomingEmiTableProps {
  rows: UpcomingEmiRow[];
  loading: boolean;
  onPay?: (row: UpcomingEmiRow) => void;
  payingId?: number | null;
}

const UpcomingEmiTable = ({ rows, loading, onPay, payingId }: UpcomingEmiTableProps) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Upcoming EMI</h3>
      <p className="mb-3 mt-0.5 text-sm font-bold text-slate-800">Next scheduled payments</p>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-sm font-medium text-slate-400">
          No upcoming EMI payments.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/80">
              <tr>
                {['Vehicle', 'Due Date', 'Amount', 'Days', 'Status', ...(onPay ? ['Action'] : [])].map((heading) => (
                  <th
                    key={heading}
                    className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-500"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs font-bold text-slate-800">
                    {row.vehicleNo}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-slate-600">
                    {shortDate(row.dueDate)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tabular-nums text-slate-700">
                    {money(row.amount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-slate-600">
                    {row.status === 'due-soon' ? (
                      <span className="font-bold text-amber-600">in {row.daysRemaining} day{row.daysRemaining === 1 ? '' : 's'}</span>
                    ) : (
                      `${row.daysRemaining} day${row.daysRemaining === 1 ? '' : 's'}`
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {row.status === 'due-soon' ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                        Due Soon
                      </span>
                    ) : (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                        Upcoming
                      </span>
                    )}
                  </td>
                  {onPay && (
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {row.emiRecordId != null && (
                        <button
                          type="button"
                          onClick={() => onPay(row)}
                          disabled={payingId != null}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                        >
                          {payingId === row.emiRecordId ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" /> Paying…
                            </>
                          ) : (
                            'Pay'
                          )}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && rows.length > 0 && (
        <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-slate-400">
          <CalendarDays size={11} /> Sorted by nearest due date.
        </p>
      )}
    </div>
  );
};

export default memo(UpcomingEmiTable);