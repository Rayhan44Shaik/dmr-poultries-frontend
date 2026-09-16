import { useMemo } from "react";
import { AlertCircle, ArrowUpRight, IndianRupee } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINR, formatINRCompact } from "../../../../utils/format";
import type {
  PaymentRegisterSummary,
  PaymentRegisterTypeSummary,
} from "../services/paymentRegisterSummary";

const TYPE_COLOURS = [
  "#60a5fa",
  "#34d399",
  "#a78bfa",
  "#fbbf24",
  "#fb7185",
  "#38bdf8",
  "#2dd4bf",
  "#c084fc",
  "#f97316",
] as const;

const PAYMENT_MODE_ORDER = ["Cash", "Union Bank", "HDFC Bank"] as const;

interface PaymentRegisterChartProps {
  summary: PaymentRegisterSummary | null;
  loading: boolean;
  error?: string | null;
  /** Bumped by the page-level refresh button so this chart replays its motion. */
  animationKey?: number;
}

interface PaymentTypeChartRow extends PaymentRegisterTypeSummary {
  colour: string;
  shortType: string;
}

const PAYMENT_REGISTER_ANIMATION_STYLES = `
@keyframes payment-register-value-pop {
  0% { opacity: 0; transform: scale(0.78); }
  70% { opacity: 1; transform: scale(1.05); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes payment-register-refresh-sheen {
  0% { transform: translateX(-130%); opacity: 0; }
  18% { opacity: 0.85; }
  100% { transform: translateX(130%); opacity: 0; }
}
@keyframes payment-register-stage-refresh {
  0% { opacity: 0.76; transform: translateY(4px) scale(0.992); filter: saturate(0.92); }
  52% { opacity: 1; transform: translateY(0) scale(1.006); filter: saturate(1.08); }
  100% { opacity: 1; transform: translateY(0) scale(1); filter: saturate(1); }
}
@keyframes payment-register-rupee-glow {
  0%, 100% { transform: scale(1); opacity: 0.32; }
  50% { transform: scale(1.28); opacity: 0.08; }
}
.payment-register-value {
  animation: payment-register-value-pop 720ms cubic-bezier(0.16, 1, 0.3, 1) 160ms both;
  transform-origin: center;
}
.payment-register-refresh-sheen {
  animation: payment-register-refresh-sheen 1.2s ease-in-out infinite;
}
.payment-register-stage-refreshing {
  animation: payment-register-stage-refresh 1.05s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.payment-register-rupee-glow {
  animation: payment-register-rupee-glow 1.35s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .payment-register-value,
  .payment-register-refresh-sheen,
  .payment-register-stage-refreshing,
  .payment-register-rupee-glow {
    animation: none !important;
  }
}
`;

function shortenType(type: string): string {
  return type
    .replace("Farm / Farmer Payment", "Farm/Farmer")
    .replace("Vehicle Maintenance", "Maintenance")
    .replace("Toll / FASTag", "Toll/FASTag")
    .replace("Fuel / Diesel", "Fuel/Diesel")
    .replace("Office Expense", "Office")
    .replace("Other Expense", "Other");
}

function formatPeriod(fromDate: string, toDate: string): string {
  const format = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "—";
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };
  const year = new Date(`${toDate}T00:00:00`).getFullYear();
  return `${format(fromDate)} – ${format(toDate)}${Number.isFinite(year) ? ` ${year}` : ""}`;
}

function lighten(hex: string, amt = 0.28): string {
  const n = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  const f = (value: number) => Math.round(value + (255 - value) * amt);
  return `rgb(${f(c[0])}, ${f(c[1])}, ${f(c[2])})`;
}

function paymentModeColor(name: string): string {
  const key = name.toLocaleLowerCase("en-IN");
  if (key.includes("union")) return "#3b82f6";
  if (key.includes("hdfc")) return "#10b981";
  if (key.includes("cash")) return "#f59e0b";
  return "#64748b";
}

function PaymentModeStat({ mode, amount, percent }: { mode: string; amount: number; percent: number }) {
  const color = paymentModeColor(mode);
  return (
    <div
      className="group min-w-0 cursor-default rounded-xl px-2.5 py-2 ring-1 ring-inset ring-slate-100 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ backgroundColor: `${color}0f` }}
    >
      <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-150"
          style={{ backgroundColor: color }}
        />
        <span className="truncate">{mode}</span>
      </span>
      <span className="mt-0.5 flex items-baseline justify-between gap-1">
        <span className="block truncate text-[15px] font-black tabular-nums text-slate-800">
          {formatINRCompact(amount)}
        </span>
        <span
          className="shrink-0 rounded-md bg-white/90 px-1.5 py-0.5 text-[12px] font-black tabular-nums shadow-sm ring-1 ring-inset ring-white"
          style={{ color }}
        >
          {`${percent.toFixed(1)}%`}
        </span>
      </span>
    </div>
  );
}

function TypeTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: unknown }>;
}) {
  if (!active) return null;
  const item = payload?.[0]?.payload as Partial<PaymentTypeChartRow> | undefined;
  if (!item || typeof item.type !== "string") return null;

  const amount = Number(item.amount) || 0;
  const percent = Number(item.percent) || 0;
  const count = Number(item.count) || 0;
  const colour = typeof item.colour === "string" ? item.colour : "#64748b";
  const payees = Array.isArray(item.payees) ? item.payees : [];

  return (
    <div className="max-h-[13.5rem] w-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 text-[10px] text-slate-500 shadow-xl shadow-slate-900/12">
      <div className="flex min-w-0 items-start justify-between gap-2 border-b border-slate-100 pb-2">
        <p className="min-w-0 break-words text-[12px] font-bold leading-snug text-slate-800">
          {item.type}
        </p>
        <span className="shrink-0 rounded-full px-2 py-1 text-[11px] font-black tabular-nums ring-1 ring-inset ring-slate-100" style={{ color: colour, backgroundColor: `${colour}12` }}>
          {percent.toFixed(1)}%
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-1.5">
        <div className="rounded-lg bg-slate-50 px-2 py-1.5">
          <dt className="font-black uppercase tracking-wide text-slate-400">Amount</dt>
          <dd className="mt-0.5 font-bold tabular-nums text-slate-800">{formatINR(amount)}</dd>
        </div>
        <div className="rounded-lg bg-sky-50 px-2 py-1.5">
          <dt className="font-black uppercase tracking-wide text-sky-500">Entries</dt>
          <dd className="mt-0.5 font-bold tabular-nums text-sky-700">{count}</dd>
        </div>
      </dl>
      <div className="mt-1.5 rounded-lg bg-slate-50 px-2 py-1.5 ring-1 ring-inset ring-slate-100">
        <p className="font-black uppercase tracking-wide text-slate-400">Paid to</p>
        <div className="mt-1 space-y-1">
          {payees.slice(0, 4).map((payee) => (
            <div key={payee.paidTo} className="flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 truncate font-semibold text-slate-600">{payee.paidTo}</span>
              <strong className="shrink-0 tabular-nums text-slate-800">{formatINRCompact(payee.amount)}</strong>
            </div>
          ))}
          {payees.length > 4 ? (
            <p className="text-[9.5px] font-semibold text-slate-400">
              +{payees.length - 4} more payee{payees.length - 4 === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PaymentSkeleton() {
  return (
    <>
      <style>{PAYMENT_REGISTER_ANIMATION_STYLES}</style>
      <div className="flex h-full min-h-[31rem] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-white to-sky-50/30 px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <span className="block h-4 w-36 animate-pulse rounded-full bg-slate-100" />
              <span className="block h-3 w-32 animate-pulse rounded-full bg-slate-100" />
            </div>
            <span className="h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
          </div>
        </div>
        <div className="flex flex-1 flex-col p-2.5">
          <div className="mt-3 flex-1 animate-pulse rounded-2xl bg-slate-100" />
          <div className="mt-auto grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 sm:grid-cols-3">
            {[0, 1, 2].map((item) => <span key={item} className="h-[3.25rem] animate-pulse rounded-xl bg-slate-100" />)}
          </div>
        </div>
      </div>
    </>
  );
}

function EmptyState({ error }: { error?: string | null }) {
  return (
    <>
      <style>{PAYMENT_REGISTER_ANIMATION_STYLES}</style>
      <div className="flex h-full min-h-[31rem] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <header className="border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-white to-sky-50/30 px-4 py-2.5">
          <div className="min-w-0">
            <Link to="/accounts?tab=paid-payments" className="group/title inline-flex min-w-0 items-center gap-1.5">
              <h2 className="truncate text-base font-black tracking-tight text-slate-900 transition-colors group-hover/title:text-sky-700">
                Payments
              </h2>
              <ArrowUpRight size={13} className="shrink-0 text-slate-300 group-hover/title:text-sky-600" aria-hidden="true" />
            </Link>
            <span aria-hidden="true" className="mt-1.5 block h-0.5 w-10 rounded-full bg-sky-400" />
          </div>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center p-4 text-center text-slate-400">
          <AlertCircle className="h-8 w-8 text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-black text-slate-700">
            {error ? "Payment register is unavailable" : "No payment data in this period"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs font-semibold text-slate-500">
            {error ?? "Change the dashboard date range or refresh the dashboard to sync payment totals."}
          </p>
        </div>
      </div>
    </>
  );
}

export default function PaymentRegisterChart({ summary, loading, error, animationKey = 0 }: PaymentRegisterChartProps) {
  const chartRows = useMemo<PaymentTypeChartRow[]>(() => {
    return (summary?.typeRows ?? []).map((row, index) => ({
      ...row,
      colour: TYPE_COLOURS[index % TYPE_COLOURS.length],
      shortType: shortenType(row.type),
    }));
  }, [summary]);

  const modeRows = useMemo(
    () => {
      const allowed = new Set<string>(PAYMENT_MODE_ORDER);
      return (summary?.modeRows ?? [])
        .filter((mode) => allowed.has(mode.mode))
        .sort((a, b) => PAYMENT_MODE_ORDER.indexOf(a.mode as (typeof PAYMENT_MODE_ORDER)[number]) - PAYMENT_MODE_ORDER.indexOf(b.mode as (typeof PAYMENT_MODE_ORDER)[number]));
    },
    [summary?.modeRows],
  );

  const totalAmount = summary?.totalAmount ?? 0;
  const totalCount = summary?.totalCount ?? 0;
  const dataKey = `${animationKey}:${summary?.fromDate ?? ""}:${summary?.toDate ?? ""}:${chartRows.map((row) => `${row.type}-${Math.round(row.amount)}`).join("|")}`;

  if (loading && !summary) return <PaymentSkeleton />;
  if (error || !summary || summary.totalCount === 0) return <EmptyState error={error} />;

  return (
    <>
      <style>{PAYMENT_REGISTER_ANIMATION_STYLES}</style>
      <section className="relative z-0 flex h-full min-h-[31rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/5">
        <header className="border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-white to-sky-50/30 px-4 py-2.5">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <Link to="/accounts?tab=paid-payments" className="group/title inline-flex min-w-0 items-center gap-1.5">
                <h2 className="truncate text-base font-black tracking-tight text-slate-900 transition-colors group-hover/title:text-sky-700">
                  Payments
                </h2>
                <ArrowUpRight size={13} className="shrink-0 text-slate-300 group-hover/title:text-sky-600" aria-hidden="true" />
              </Link>
              <span aria-hidden="true" className="mt-1.5 block h-0.5 w-10 rounded-full bg-sky-400" />
              <p className="mt-1.5 truncate text-[10.5px] font-semibold tabular-nums text-slate-400">
                {formatPeriod(summary.fromDate, summary.toDate)}
              </p>
            </div>

            <div key={`payment-total-${dataKey}`} className="group flex shrink-0 items-center gap-1.5 rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white px-1.5 py-1 shadow-xs">
              <span
                className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-sky-600 shadow-sm transition-transform duration-300 group-hover:scale-105"
                style={{ background: "conic-gradient(from 140deg, #bae6fd, #10b981, #fde68a, #bae6fd)" }}
              >
                <span
                  className={`absolute inset-0 rounded-full bg-sky-300/25 ${loading ? "payment-register-rupee-glow" : "opacity-0 transition-opacity duration-300 group-hover:opacity-100"}`}
                  aria-hidden="true"
                />
                <span className="absolute inset-[3px] rounded-full bg-white shadow-inner" aria-hidden="true" />
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400 ring-2 ring-white" aria-hidden="true" />
                <span className="absolute bottom-1 left-1 h-1 w-1 rounded-full bg-amber-400 ring-2 ring-white" aria-hidden="true" />
                <IndianRupee className="relative h-4 w-4" strokeWidth={2.8} aria-hidden="true" />
              </span>
              <p className="leading-tight">
                <span className="block text-[8px] font-black uppercase tracking-wide text-sky-700">Payments</span>
                <strong className="payment-register-value block text-[12.5px] font-black tabular-nums text-slate-800">
                  {formatINR(totalAmount)}
                </strong>
                <span className="block text-[8.5px] font-bold tabular-nums text-slate-400">{totalCount} entries</span>
              </p>
            </div>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col p-2.5">
          {loading ? (
            <span className="payment-register-refresh-sheen pointer-events-none absolute left-3 right-3 top-2 z-10 h-px rounded-full bg-gradient-to-r from-transparent via-sky-300 to-transparent" aria-hidden="true" />
          ) : null}

          <div
            key={`${dataKey}-${loading ? "refreshing" : "ready"}`}
            className={`min-h-0 flex-1 animate-fade-in rounded-2xl border border-slate-100 bg-slate-50/60 p-2 ${loading ? "payment-register-stage-refreshing" : ""}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartRows}
                layout="vertical"
                margin={{ top: 8, right: 20, bottom: 8, left: 2 }}
                barGap={7}
              >
                <defs>
                  {chartRows.map((row, index) => (
                    <linearGradient key={row.type} id={`pr-type-${index}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={lighten(row.colour, 0.52)} />
                      <stop offset="100%" stopColor={row.colour} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid stroke="#edf2f7" strokeDasharray="3 6" horizontal={false} />
                <XAxis type="number" hide domain={[0, "dataMax"]} />
                <YAxis
                  type="category"
                  dataKey="shortType"
                  width={86}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 10, fontWeight: 700 }}
                />
                <Tooltip
                  content={<TypeTooltip />}
                  cursor={{ fill: "rgba(226,232,240,0.35)" }}
                  allowEscapeViewBox={{ x: false, y: false }}
                  wrapperStyle={{ zIndex: 40, pointerEvents: "none", outline: "none" }}
                />
                <Bar
                  dataKey="amount"
                  radius={[0, 12, 12, 0]}
                  barSize={11}
                  background={{ fill: "#f1f5f9", radius: 12 }}
                  animationBegin={120}
                  animationDuration={1120}
                  animationEasing="ease-out"
                >
                  {chartRows.map((row, index) => <Cell key={row.type} fill={`url(#pr-type-${index})`} />)}
                  <LabelList
                    dataKey="amount"
                    position="right"
                    formatter={(value: unknown) => formatINRCompact(Number(value) || 0)}
                    className="fill-slate-500 text-[10px] font-black tabular-nums"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 grid w-full shrink-0 grid-cols-2 gap-2 border-t border-slate-100 pt-2 sm:grid-cols-3">
            {modeRows.map((mode) => (
              <PaymentModeStat key={mode.mode} mode={mode.mode} amount={mode.amount} percent={mode.percent} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
