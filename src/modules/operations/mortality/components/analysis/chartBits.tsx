// src/modules/operations/mortality/components/analysis/chartBits.tsx
// Shared tooltip shell for the Trip Analysis charts — every chart uses the
// same card, so a hover anywhere on the page reads the same way.

import type { ReactNode } from "react";

export function TooltipShell({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-[190px] rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
      {title ? (
        <p className="mb-1.5 border-b border-slate-100 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {title}
        </p>
      ) : null}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function TooltipRow({
  color,
  label,
  value,
  hint,
}: {
  color?: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12px]">
      <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
        {color ? (
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        ) : null}
        {label}
      </span>
      <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {value}
        {hint ? <span className="ml-1 font-medium text-slate-400">{hint}</span> : null}
      </span>
    </div>
  );
}
