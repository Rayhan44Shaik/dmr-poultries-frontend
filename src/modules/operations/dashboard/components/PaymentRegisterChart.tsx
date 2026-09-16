import { useMemo } from "react";
import { AlertCircle, BadgeCheck, CreditCard, ReceiptText, UsersRound, WalletCards, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
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
import { formatDateShort, formatINR, formatINRCompact } from "../../../../utils/format";
import type {
  PaymentRegisterLatestRow,
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
    <div className="min-w-[235px] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl shadow-slate-900/10 backdrop-blur">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colour }} />
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{item.type}</p>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
        <span className="rounded-xl bg-slate-50 px-2.5 py-2">
          <span className="block font-semibold text-slate-400">Approved amount</span>
          <strong className="mt-0.5 block text-sm font-black tabular-nums text-slate-800">{formatINRCompact(amount)}</strong>
        </span>
        <span className="rounded-xl bg-slate-50 px-2.5 py-2">
          <span className="block font-semibold text-slate-400">Share</span>
          <strong className="mt-0.5 block text-sm font-black tabular-nums" style={{ color: colour }}>{percent.toFixed(1)}%</strong>
        </span>
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-500">
        {count} approved entr{count === 1 ? "y" : "ies"} · top payee {topPayee}
      </p>
      <p className="mt-1 text-xs font-black tabular-nums text-slate-700">
        Top payee value {formatINRCompact(topPayeeAmount)}
      </p>
    </div>
  );
}

function SummaryPill({ icon: Icon, label, value, tone }: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-2.5 shadow-sm ring-1 ring-slate-100/80">
      <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${tone}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        {label}
      </span>
      <strong className="mt-1 block text-[18px] font-black leading-none tracking-tight text-slate-800 tabular-nums">
        {value}
      </strong>
    </div>
  );
}

function PaymentSkeleton() {
  return (
    <div className="rounded-[2rem] border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <span className="block h-4 w-36 animate-pulse rounded-full bg-slate-100" />
          <span className="block h-3 w-48 animate-pulse rounded-full bg-slate-100" />
        </div>
        <span className="h-9 w-24 animate-pulse rounded-full bg-slate-100" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => <span key={item} className="h-[4.1rem] animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
      <div className="mt-4 h-64 animate-pulse rounded-3xl bg-slate-100" />
    </div>
  );
}

function EmptyState({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  return (
    <div className="rounded-[2rem] border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Payment Register</p>
          <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">Approved payment view</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Approved only
        </span>
      </div>
      <div className="mt-5 rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
        <p className="mt-3 text-sm font-black text-slate-700">
          {error ? "Payment register is unavailable" : "No approved payments in this period"}
        </p>
        <p className="mx-auto mt-1 max-w-sm text-xs font-semibold text-slate-500">
          {error ?? "Draft, pending and cancelled payment rows are excluded from this dashboard chart."}
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

function LatestPaymentRow({ row }: { row: PaymentRegisterLatestRow }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-2xl bg-white/75 px-3 py-2.5 ring-1 ring-slate-100">
      <div className="min-w-0">
        <p className="truncate text-xs font-black text-slate-800">{row.paidTo}</p>
        <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">
          {row.paymentType} · {row.paymentMode} · {formatDateShort(row.paymentDate)}
        </p>
      </div>
      <strong className="text-xs font-black tabular-nums text-slate-800">{formatINRCompact(row.amount)}</strong>
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

  const totalAmount = summary?.totalAmount ?? 0;
  const totalCount = summary?.totalCount ?? 0;
  const modeRows = summary?.modeRows ?? [];
  const latestRows = summary?.latestRows ?? [];
  const dataKey = `${summary?.fromDate ?? ""}:${summary?.toDate ?? ""}:${chartRows.map((row) => `${row.type}-${Math.round(row.amount)}`).join("|")}`;

  if (loading && !summary) return <PaymentSkeleton />;
  if (error || !summary || summary.totalCount === 0) return <EmptyState error={error} onRetry={onRetry} />;

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/5 sm:p-5">
      <div className="pointer-events-none absolute -right-14 -top-20 h-40 w-40 rounded-full bg-sky-100/60 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-40 w-40 rounded-full bg-emerald-100/60 blur-3xl" aria-hidden="true" />

      <header className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 ring-1 ring-emerald-100">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Approved only
          </span>
          <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">Payment Register</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Payment made by type, payee and mode for the selected dashboard period.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={loading}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-900 disabled:translate-y-0 disabled:opacity-60"
            >
              {loading ? "Refreshing" : "Refresh"}
            </button>
          ) : null}
          <Link
            to="/accounts?tab=paid-payments"
            className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800"
          >
            Open register
          </Link>
        </div>
      </header>

      <div className="relative mt-4 grid gap-3 sm:grid-cols-3">
        <SummaryPill
          icon={WalletCards}
          label="Approved value"
          value={formatINRCompact(totalAmount)}
          tone="bg-sky-50 text-sky-600"
        />
        <SummaryPill
          icon={ReceiptText}
          label="Entries"
          value={String(totalCount)}
          tone="bg-emerald-50 text-emerald-600"
        />
        <SummaryPill
          icon={CreditCard}
          label="Payment modes"
          value={String(modeRows.length)}
          tone="bg-violet-50 text-violet-600"
        />
      </div>

      <div className="relative mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(17rem,0.85fr)]">
        <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/55 p-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <div>
              <p className="text-xs font-black text-slate-800">By payment type</p>
              <p className="text-[10px] font-semibold text-slate-400">Farm/Farmer, Fuel/Diesel, EMI, Salary and more</p>
            </div>
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-500 ring-1 ring-slate-100">
              {chartRows.length} types
            </span>
          </div>
          <div key={dataKey} className="mt-3 h-[17rem] animate-fade-in">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartRows}
                layout="vertical"
                margin={{ top: 8, right: 22, bottom: 8, left: 4 }}
                barGap={8}
              >
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 5" horizontal={false} />
                <XAxis type="number" hide domain={[0, "dataMax"]} />
                <YAxis
                  type="category"
                  dataKey="shortType"
                  width={92}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 10, fontWeight: 700 }}
                />
                <Tooltip content={<TypeTooltip />} cursor={{ fill: "rgba(226,232,240,0.35)" }} />
                <Bar
                  dataKey="amount"
                  radius={[0, 14, 14, 0]}
                  barSize={13}
                  animationBegin={100}
                  animationDuration={1050}
                  animationEasing="ease-out"
                >
                  {chartRows.map((row) => <Cell key={row.type} fill={row.colour} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-[1.5rem] border border-slate-100 bg-white/80 p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black text-slate-800">Type details</p>
              <UsersRound className="h-4 w-4 text-slate-300" aria-hidden="true" />
            </div>
            <div className="mt-2 max-h-[13.7rem] space-y-2 overflow-y-auto pr-1">
              {chartRows.map((row) => (
                <div key={row.type} className="rounded-2xl bg-slate-50/80 px-3 py-2 ring-1 ring-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs font-bold text-slate-700">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: row.colour }} />
                      {row.type}
                    </span>
                    <strong className="shrink-0 text-xs font-black tabular-nums text-slate-900">{formatINRCompact(row.amount)}</strong>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-400">
                    <span>{row.count} entries · {row.percent.toFixed(1)}%</span>
                    <span className="truncate">Top: {row.topPayee}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-xs font-black text-slate-800">Payment modes</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {modeRows.map((mode, index) => {
                const colour = modeColour(index);
                return (
                  <div key={mode.mode} className="rounded-2xl bg-white px-2.5 py-2 ring-1 ring-slate-100">
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
      </div>

      {latestRows.length > 0 ? (
        <div className="relative mt-4 rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-slate-800">Latest approved payments</p>
            <span className="text-[10px] font-bold tabular-nums text-slate-400">Total {formatINR(totalAmount)}</span>
          </div>
          <div className="mt-2 grid gap-2 2xl:grid-cols-2">
            {latestRows.map((row) => <LatestPaymentRow key={row.id} row={row} />)}
          </div>
        </div>
      ) : null}
    </section>
  );
}
