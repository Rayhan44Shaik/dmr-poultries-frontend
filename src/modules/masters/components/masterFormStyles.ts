/** Master-local field tokens. Dropdown chrome follows Salary Register. */
export const masterInputClass = (hasError = false) =>
  `h-9 w-full rounded-xl border bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${
    hasError
      ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
      : "border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
  } appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`;

export const masterTextareaClass =
  "w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 resize-y";
export const masterIconClass =
  "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400";
export const masterLabelClass =
  "mb-1.5 block text-xs font-semibold text-slate-600";
