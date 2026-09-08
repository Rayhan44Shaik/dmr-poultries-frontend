import { memo } from 'react';
import {
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Shield,
  Dumbbell,
  FileCheck,
  Car,
  type LucideIcon,
} from 'lucide-react';

interface StatusCounts {
  [type: string]: {
    expired: number;
    expiring: number;
    safe: number;
  };
}

interface DocumentSummaryTilesProps {
  counts: Record<string, number>;         // optional – kept for compatibility
  statusCounts: StatusCounts;
  docLabels: Record<string, string>;
}

/** Icon + soft accent per document type (mirrors DocumentEditModal). */
const DOC_VISUALS: Record<string, { icon: LucideIcon; chip: string }> = {
  rc: { icon: FileText, chip: 'bg-indigo-50 text-indigo-600' },
  insurance: { icon: Shield, chip: 'bg-blue-50 text-blue-600' },
  fitness: { icon: Dumbbell, chip: 'bg-emerald-50 text-emerald-600' },
  permit: { icon: FileCheck, chip: 'bg-amber-50 text-amber-600' },
  puc: { icon: Car, chip: 'bg-purple-50 text-purple-600' },
};

/**
 * One uniform card per document type: icon, label, total, then the three state
 * counts. Deliberately flat — no status tinting, accent rails, progress bars or
 * summary banner — so the row reads as a calm KPI strip.
 */
const DocumentSummaryTiles = ({ statusCounts, docLabels }: DocumentSummaryTilesProps) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
    {Object.entries(docLabels).map(([type, label]) => {
      const { expired, expiring, safe } = statusCounts[type] || { expired: 0, expiring: 0, safe: 0 };
      const total = expired + expiring + safe;
      const visual = DOC_VISUALS[type] ?? DOC_VISUALS.rc;
      const Icon = visual.icon;

      return (
        <div
          key={type}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-xs transition-shadow hover:shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${visual.chip}`}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="truncate text-xs font-bold uppercase tracking-wide text-slate-500">
                {label}
              </span>
            </span>
            <span className="text-xl font-bold tabular-nums leading-none text-slate-800">{total}</span>
          </div>

          <div className="mt-3 flex items-center gap-3 text-xs font-bold tabular-nums">
            <span className="inline-flex items-center gap-1 text-emerald-600" title="Safe">
              <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {safe}
            </span>
            <span className="inline-flex items-center gap-1 text-amber-600" title="Expiring soon">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {expiring}
            </span>
            <span className="inline-flex items-center gap-1 text-rose-600" title="Expired">
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {expired}
            </span>
          </div>
        </div>
      );
    })}
  </div>
);

export default memo(DocumentSummaryTiles);
