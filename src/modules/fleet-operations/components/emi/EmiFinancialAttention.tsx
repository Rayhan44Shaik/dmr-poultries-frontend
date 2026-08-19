import { memo } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { EmiAttentionItem } from '../../hooks/useEmiData';

interface EmiFinancialAttentionProps {
  items: EmiAttentionItem[];
  loading: boolean;
}

const EmiFinancialAttention = ({ items, loading }: EmiFinancialAttentionProps) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
        Financial Attention
      </h3>
      <p className="mb-3 mt-0.5 text-sm font-bold text-slate-800">Where attention is needed</p>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-bold text-emerald-800">All clear</p>
            <p className="text-xs font-medium text-emerald-700">
              No overdue or near-due EMI obligations.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 6).map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${item.tone}`}
            >
              <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/70">
                <AlertTriangle className="h-3.5 w-3.5 text-slate-600" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800">{item.title}</p>
                <p className="mt-0.5 truncate text-[11px] font-medium text-slate-600" title={item.detail}>
                  {item.detail}
                </p>
              </div>
              <span className="flex-shrink-0 text-[11px] font-black tabular-nums text-slate-700">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(EmiFinancialAttention);