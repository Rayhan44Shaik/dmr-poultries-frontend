import { useMemo } from "react";
import { AlertCircle, BadgeCheck, CreditCard, ReceiptText, WalletCards } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

const MODE_COLOURS = ["#0ea5e9", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#64748b"] as const;

interface PaymentRegisterChartProps {
  summary: PaymentRegisterSummary | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
}

interface PaymentTypeChartRow extends PaymentRegisterTypeSummary {
  colour: string;
  shortType: string;
}

function shortenType(type: string): string {
  return type
    .replace("Farm / Farmer Payment", "Farm/Farmer")
    .replace("Vehicle Maintenance", "Maintenance")
    .replace("Toll / FASTag", "Toll/FASTag")
    .replace("Fuel / Diesel", "Fuel/Diesel")
    .replace("Office Expense", "Office")
    .replace("Other Expense", "Other");
}

function modeColour(index: number): string {
  return MODE_COLOURS[index % MODE_COLOURS.length];
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
  const topPayee = typeof item.topPayee === "string" ? item.topPayee : "—";
  const topPayeeAmount = Number(item.topPayeeAmount) || 0;

  return (
    <div className="min-w-[220px] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl shadow-slate-900/10 backdrop-blur">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colour }} />
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{item.type}</p>
      </div>
      <p className="mt-2 text-base font-black tabular-nums text-slate-900">{formatINR(amount)}</p>
      <p className="mt-0.5 text-xs font-bold tabular-nums" style={{ color: colour }}>
        {percent.toFixed(1)}% · {count} approved entr{count === 1 ? "y" : "ies"}
      </p>
      <p className="mt-2 text-[11px] font-semibold text-slate-500">
        Top payee: <strong className="text-slate-700">{topPayee}</strong>
      </p>
      <p className="mt-0.5 text-[11px] font-black tabular-nums text-slate-700">
        {formatINRCompact(topPayeeAmount)}
      </p>
    </div>
  );
}

function PaymentSkeleton() {
  return (
    <div className="flex h-full min-h-[31rem] flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <span className="block h-4 w-32 animate-pulse rounded-full bg-slate-100" />
          <span className="block h-3 w-44 animate-pulse rounded-full bg-slate-100" />
        </div>
        <span className="h-8 w-28 animate-pulse rounded-full bg-slate-100" />
      </div>
      <div className="mt-4 flex-1 animate-pulse rounded-2xl bg-slate-100" />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[0, 1, 2, 3, 4].map((item) => <span key={item} className="h-14 animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
    </div>
  );
}

function EmptyState({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  return (
    <div className="flex h-full min-h-[31rem] flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Payment Register</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-slate-900">Approved payments</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Approved only
        </span>
      </div>
      <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
        <AlertCircle className="h-8 w-8 text-slate-300" aria-hidden="true" />
        <p className="mt-3 text-sm font-black text-slate-700">
          {error ? "Payment register is unavailable" : "No approved payments in this period"}
        </p>
        <p className="mx-auto mt-1 max-w-sm text-xs font-semibold text-slate-500">
          {error ?? "Draft, pending and cancelled payments are not counted here."}
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800"
          >
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function PaymentRegisterChart({ summary, loading, error, onRetry }: PaymentRegisterChartProps) {
  const chartRows = useMemo<PaymentTypeChartRow[]>(() => {
    return (summary?.typeRows ?? []).map((row, index) => ({
      ...row,
      colour: TYPE_COLOURS[index % TYPE_COLOURS.length],
      shortType: shortenType(row.type),
    }));
  }, [summary]);

  const modeRows = useMemo(
    () => (summary?.modeRows ?? []).filter((mode) => {
      const key = mode.mode.trim().toLocaleLowerCase("en-IN");
      return key !== "" && key !== "—" && key !== "other" && key !== "others";
    }),
    [summary?.modeRows],
  );

  const totalAmount = summary?.totalAmount ?? 0;
  const totalCount = summary?.totalCount ?? 0;
  const dataKey = `${summary?.fromDate ?? ""}:${summary?.toDate ?? ""}:${chartRows.map((row) => `${row.type}-${Math.round(row.amount)}`).join("|")}`;

  if (loading && !summary) return <PaymentSkeleton />;
  if (error || !summary || summary.totalCount === 0) return <EmptyState error={error} onRetry={onRetry} />;

  return (
    <section className="relative flex h-full min-h-[31rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/5 sm:p-5">
      <div className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-sky-100/60 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-40 w-40 rounded-full bg-emerald-100/60 blur-3xl" aria-hidden="true" />

      <header className="relative flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700 ring-1 ring-emerald-100">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Approved only
          </span>
          <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900">Payment Register</h3>
          <p className="mt-1 text-[10.5px] font-semibold text-slate-500">
            Payment made by type and mode for the selected period.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-black tabular-nums text-sky-700 ring-1 ring-sky-100">
            <WalletCards className="h-3.5 w-3.5" aria-hidden="true" /> {formatINRCompact(totalAmount)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500 ring-1 ring-slate-100">
            <ReceiptText className="h-3 w-3" aria-hidden="true" /> {totalCount} entries
          </span>
        </div>
      </header>

      <div className="relative mt-3 flex min-h-0 flex-1 flex-col gap-3">
        <div className="min-h-0 flex-1 rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-xs font-black text-slate-800">By payment type</p>
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-500 ring-1 ring-slate-100">
              {chartRows.length} types
            </span>
          </div>
          <div key={dataKey} className="mt-2 h-[15.25rem] animate-fade-in">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartRows}
                layout="vertical"
                margin={{ top: 8, right: 22, bottom: 8, left: 4 }}
                barGap={7}
              >
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 5" horizontal={false} />
                <XAxis type="number" hide domain={[0, "dataMax"]} />
                <YAxis
                  type="category"
                  dataKey="shortType"
                  width={86}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 10, fontWeight: 700 }}
                />
                <Tooltip content={<TypeTooltip />} cursor={{ fill: "rgba(226,232,240,0.35)" }} />
                <Bar
                  dataKey="amount"
                  radius={[0, 14, 14, 0]}
                  barSize={13}
                  animationBegin={120}
                  animationDuration={1050}
                  animationEasing="ease-out"
                >
                  {chartRows.map((row) => <Cell key={row.type} fill={row.colour} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white/85 p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-slate-800">Payment modes</p>
            <CreditCard className="h-4 w-4 text-slate-300" aria-hidden="true" />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {modeRows.map((mode, index) => {
              const colour = modeColour(index);
              return (
                <div key={mode.mode} className="rounded-xl bg-slate-50/80 px-2.5 py-2 ring-1 ring-slate-100">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-[10px] font-black uppercase tracking-wide text-slate-500">{mode.mode}</span>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colour }} />
                  </div>
                  <strong className="mt-0.5 block text-xs font-black tabular-nums text-slate-800">{formatINRCompact(mode.amount)}</strong>
                  <span className="text-[10px] font-bold tabular-nums text-slate-400">{mode.percent.toFixed(1)}% · {mode.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
