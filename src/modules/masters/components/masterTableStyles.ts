/** Shared class tokens for the master directory tables (Trip List anatomy). */
/** Trip List table anatomy — 12px bold uppercase heads with a glyph,
 *  13px cells, py-5 rhythm. Heads may wrap at 150% / Telugu. */
export const masterThClass =
  "px-4 py-4 text-[12px] font-bold uppercase tracking-wider leading-tight align-middle";
export const masterTdClass =
  "px-4 py-5 align-middle text-[13px] text-slate-600";
/** Primary name column — readable, NOT bold. */
export const masterNameTdClass = `${masterTdClass} font-medium text-slate-800`;

/** Shared head-glyph palette so every master reads the same way. */
export const masterHeadTint = {
  number: "text-slate-400",
  name: "text-emerald-500",
  person: "text-sky-500",
  phone: "text-teal-500",
  place: "text-rose-500",
  tag: "text-indigo-500",
  rate: "text-amber-500",
  money: "text-emerald-600",
  balance: "text-violet-500",
  status: "text-amber-500",
  action: "text-slate-500",
  vehicle: "text-blue-500",
  capacity: "text-orange-500",
  bank: "text-cyan-600",
  code: "text-fuchsia-500",
} as const;

export function masterRowClass(index: number, loading: boolean): string {
  return `transition-colors duration-150 hover:bg-slate-50/60 motion-safe:animate-[var(--animate-fade-in-up)] ${
    index % 2 === 0 ? "bg-white" : "bg-slate-50/20"
  } ${loading ? "opacity-60" : ""}`;
}

export function masterRowStyle(index: number) {
  return { animationDelay: `${Math.min(index, 12) * 24}ms` };
}
