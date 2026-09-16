import { useMemo, useRef, useState, type CSSProperties } from "react";
import { AlertCircle, ArrowUpRight, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandRefreshButton } from "../../../../ui";
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
  onRetry?: () => void;
}

interface PaymentTypeChartRow extends PaymentRegisterTypeSummary {
  colour: string;
  shortType: string;
  barPercent: number;
}

interface PaymentTypeTooltipState {
  row: PaymentTypeChartRow;
  left: number;
  top: number;
  placement: "top" | "bottom";
}

const PAYMENT_REGISTER_ANIMATION_STYLES = `
@keyframes payment-register-card-in {
  0% { opacity: 0; transform: translateY(12px) scale(0.965); }
  55% { opacity: 1; transform: translateY(2px) scale(1.01); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes payment-register-bar-fill {
  from { width: 0%; }
  to { width: var(--payment-register-bar-width); }
}
@keyframes payment-register-value-pop {
  0% { opacity: 0; transform: scale(0.78); }
  70% { opacity: 1; transform: scale(1.05); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes payment-register-tooltip-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes payment-register-refresh-sheen {
  0% { transform: translateX(-130%); opacity: 0; }
  18% { opacity: 0.9; }
  100% { transform: translateX(130%); opacity: 0; }
}
.payment-register-type-card {
  animation: payment-register-card-in 760ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.payment-register-bar-fill {
  animation: payment-register-bar-fill 1120ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.payment-register-value {
  animation: payment-register-value-pop 720ms cubic-bezier(0.16, 1, 0.3, 1) 160ms both;
  transform-origin: center;
}
.payment-register-tooltip {
  animation: payment-register-tooltip-in 160ms ease-out both;
}
.payment-register-refresh-sheen {
  animation: payment-register-refresh-sheen 1.2s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .payment-register-type-card,
  .payment-register-bar-fill,
  .payment-register-value,
  .payment-register-tooltip,
  .payment-register-refresh-sheen {
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
          <div className="space-y-1.5">
            {[0, 1, 2, 3, 4, 5, 6].map((item) => (
              <span key={item} className="block h-10 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
          <div className="mt-auto grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 sm:grid-cols-3">
            {[0, 1, 2].map((item) => <span key={item} className="h-[3.25rem] animate-pulse rounded-xl bg-slate-100" />)}
          </div>
        </div>
      </div>
    </>
  );
}

function EmptyState({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  return (
    <>
      <style>{PAYMENT_REGISTER_ANIMATION_STYLES}</style>
      <div className="flex h-full min-h-[31rem] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <header className="border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-white to-sky-50/30 px-4 py-2.5">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <Link to="/accounts?tab=paid-payments" className="group/title inline-flex min-w-0 items-center gap-1.5">
                <h2 className="truncate text-base font-black tracking-tight text-slate-900 transition-colors group-hover/title:text-sky-700">
                  Payment Register
                </h2>
                <ArrowUpRight size={13} className="shrink-0 text-slate-300 group-hover/title:text-sky-600" aria-hidden="true" />
              </Link>
              <span aria-hidden="true" className="mt-1.5 block h-0.5 w-10 rounded-full bg-sky-400" />
            </div>
            {onRetry ? (
              <BrandRefreshButton
                loading={false}
                onClick={onRetry}
                ariaLabel="Refresh payment register"
                className="!h-8 shrink-0 !gap-1 !pl-2 !pr-2 text-[9.5px] font-black"
              >
                Refresh
              </BrandRefreshButton>
            ) : null}
          </div>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center p-4 text-center text-slate-400">
          <AlertCircle className="h-8 w-8 text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-black text-slate-700">
            {error ? "Payment register is unavailable" : "No payment data in this period"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs font-semibold text-slate-500">
            {error ?? "Refresh after changing payment records to sync this dashboard chart."}
          </p>
        </div>
      </div>
    </>
  );
}

export default function PaymentRegisterChart({ summary, loading, error, onRetry }: PaymentRegisterChartProps) {
  const chartRef = useRef<HTMLElement | null>(null);
  const [typeTooltip, setTypeTooltip] = useState<PaymentTypeTooltipState | null>(null);

  const chartRows = useMemo<PaymentTypeChartRow[]>(() => {
    const rows = summary?.typeRows ?? [];
    const maxAmount = rows.reduce((max, row) => Math.max(max, row.amount), 0);
    return rows.map((row, index) => ({
      ...row,
      colour: TYPE_COLOURS[index % TYPE_COLOURS.length],
      shortType: shortenType(row.type),
      barPercent: maxAmount > 0 ? Math.max(7, (row.amount / maxAmount) * 100) : 0,
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
  const dataKey = `${summary?.fromDate ?? ""}:${summary?.toDate ?? ""}:${chartRows.map((row) => `${row.type}-${Math.round(row.amount)}`).join("|")}`;

  const showTypeTooltip = (row: PaymentTypeChartRow, target: HTMLElement) => {
    const chart = chartRef.current;
    if (!chart) return;
    const rect = target.getBoundingClientRect();
    const chartRect = chart.getBoundingClientRect();
    const tooltipWidth = 256;
    const tooltipHeight = 176;
    const inset = 10;
    const targetTop = rect.top - chartRect.top;
    const targetBottom = rect.bottom - chartRect.top;
    const centeredLeft = rect.left - chartRect.left + rect.width / 2;
    const left = Math.min(
      Math.max(centeredLeft, tooltipWidth / 2 + inset),
      chartRect.width - tooltipWidth / 2 - inset,
    );
    const bottomTop = targetBottom + 8;
    const topTop = targetTop - tooltipHeight - 8;
    const bottomFits = bottomTop + tooltipHeight <= chartRect.height - inset;
    const topFits = topTop >= inset;
    const placement: PaymentTypeTooltipState["placement"] = bottomFits || !topFits ? "bottom" : "top";
    const preferredTop = placement === "bottom" ? bottomTop : topTop;
    const top = Math.min(
      Math.max(preferredTop, inset),
      Math.max(inset, chartRect.height - tooltipHeight - inset),
    );

    setTypeTooltip({ row, left, top, placement });
  };

  if (loading && !summary) return <PaymentSkeleton />;
  if (error || !summary || summary.totalCount === 0) return <EmptyState error={error} onRetry={onRetry} />;

  return (
    <>
      <style>{PAYMENT_REGISTER_ANIMATION_STYLES}</style>
      <section ref={chartRef} className="relative flex h-full min-h-[31rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/5">
        <header className="border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-white to-sky-50/30 px-4 py-2.5">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <Link to="/accounts?tab=paid-payments" className="group/title inline-flex min-w-0 items-center gap-1.5">
                <h2 className="truncate text-base font-black tracking-tight text-slate-900 transition-colors group-hover/title:text-sky-700">
                  Payment Register
                </h2>
                <ArrowUpRight size={13} className="shrink-0 text-slate-300 group-hover/title:text-sky-600" aria-hidden="true" />
              </Link>
              <span aria-hidden="true" className="mt-1.5 block h-0.5 w-10 rounded-full bg-sky-400" />
              <p className="mt-1.5 truncate text-[10.5px] font-semibold tabular-nums text-slate-400">
                {formatPeriod(summary.fromDate, summary.toDate)}
              </p>
            </div>

            <div className="flex w-full min-w-0 flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:items-center sm:justify-end">
              <div className="flex shrink-0 items-center gap-1 rounded-lg border border-sky-100 bg-sky-50/65 px-1.5 py-1">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-sky-600 shadow-sm ring-1 ring-inset ring-sky-100">
                  <WalletCards className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="leading-tight">
                  <span className="block text-[8px] font-black uppercase tracking-wide text-sky-700">Payments</span>
                  <strong className="payment-register-value block text-[12.5px] font-black tabular-nums text-slate-800">
                    {formatINRCompact(totalAmount)}
                  </strong>
                  <span className="block text-[8.5px] font-bold tabular-nums text-slate-400">{totalCount} entries</span>
                </p>
              </div>
              {onRetry ? (
                <BrandRefreshButton
                  loading={loading}
                  onClick={onRetry}
                  ariaLabel="Refresh payment register"
                  className="!h-8 shrink-0 !gap-1 !pl-2 !pr-2 text-[9.5px] font-black"
                >
                  Refresh
                </BrandRefreshButton>
              ) : null}
            </div>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col p-2.5">
          {loading ? (
            <span className="payment-register-refresh-sheen pointer-events-none absolute left-3 right-3 top-2 z-10 h-px rounded-full bg-gradient-to-r from-transparent via-sky-300 to-transparent" aria-hidden="true" />
          ) : null}

          <div
            key={`${dataKey}-${loading ? "loading" : "ready"}`}
            className="grid gap-1.5"
            aria-label="Payments by payment type"
          >
            {chartRows.map((row, index) => {
              const barStyle = {
                width: `${row.barPercent}%`,
                backgroundColor: row.colour,
                "--payment-register-bar-width": `${row.barPercent}%`,
              } as CSSProperties;
              return (
                <article
                  key={row.type}
                  tabIndex={0}
                  aria-label={`${row.type}: ${formatINR(row.amount)}, ${row.percent.toFixed(1)} percent, paid to ${row.topPayee}`}
                  className="payment-register-type-card group relative min-w-0 rounded-xl border border-slate-100 bg-gradient-to-r from-white to-slate-50/60 px-2.5 py-1.5 shadow-xs transition-colors duration-150 hover:from-sky-50/40 hover:to-white focus:bg-sky-50/35"
                  style={{ animationDelay: `${index * 80}ms` }}
                  onFocus={(event) => showTypeTooltip(row, event.currentTarget)}
                  onBlur={() => setTypeTooltip(null)}
                  onMouseEnter={(event) => showTypeTooltip(row, event.currentTarget)}
                  onMouseLeave={() => setTypeTooltip(null)}
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-white text-[9.5px] font-black tabular-nums shadow-sm ring-1 ring-inset ring-slate-100" style={{ color: row.colour }}>
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium leading-tight text-slate-700 transition-colors group-hover:text-slate-900">
                          {row.shortType}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">
                          {row.count} entries · to {row.topPayee}
                        </p>
                      </div>
                    </div>
                    <strong className="shrink-0 rounded-full bg-white px-1.5 py-1 text-[10.5px] font-black tabular-nums text-slate-800 ring-1 ring-inset ring-slate-100">
                      {formatINRCompact(row.amount)}
                    </strong>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span className="payment-register-bar-fill block h-full rounded-full" style={barStyle} />
                    </span>
                    <span className="w-10 text-right text-[10px] font-black tabular-nums" style={{ color: row.colour }}>
                      {row.percent.toFixed(1)}%
                    </span>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-auto grid w-full shrink-0 grid-cols-2 gap-2 border-t border-slate-100 pt-2 sm:grid-cols-3">
            {modeRows.map((mode) => (
              <PaymentModeStat key={mode.mode} mode={mode.mode} amount={mode.amount} percent={mode.percent} />
            ))}
          </div>
        </div>

        {typeTooltip ? (
          <div
            role="tooltip"
            className="payment-register-tooltip pointer-events-none absolute z-50 max-h-[11rem] w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 text-[10px] text-slate-500 shadow-xl shadow-slate-900/12"
            style={{
              left: typeTooltip.left,
              top: typeTooltip.top,
              transform: "translateX(-50%)",
            }}
          >
            <span
              className={`absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-slate-200 bg-white ${
                typeTooltip.placement === "top"
                  ? "-bottom-1.5 border-b border-r"
                  : "-top-1.5 border-l border-t"
              }`}
              aria-hidden="true"
            />
            <div className="relative">
              <div className="flex min-w-0 items-start justify-between gap-2 border-b border-slate-100 pb-2">
                <p className="min-w-0 break-words text-[12px] font-bold leading-snug text-slate-800">
                  {typeTooltip.row.type}
                </p>
                <span className="shrink-0 rounded-full px-2 py-1 text-[11px] font-black tabular-nums ring-1 ring-inset ring-slate-100" style={{ color: typeTooltip.row.colour, backgroundColor: `${typeTooltip.row.colour}12` }}>
                  {typeTooltip.row.percent.toFixed(1)}%
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-1.5">
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <dt className="font-black uppercase tracking-wide text-slate-400">Amount</dt>
                  <dd className="mt-0.5 font-bold tabular-nums text-slate-800">{formatINR(typeTooltip.row.amount)}</dd>
                </div>
                <div className="rounded-lg bg-sky-50 px-2 py-1.5">
                  <dt className="font-black uppercase tracking-wide text-sky-500">Entries</dt>
                  <dd className="mt-0.5 font-bold tabular-nums text-sky-700">{typeTooltip.row.count}</dd>
                </div>
              </dl>
              <div className="mt-1.5 rounded-lg bg-slate-50 px-2 py-1.5 ring-1 ring-inset ring-slate-100">
                <p className="font-black uppercase tracking-wide text-slate-400">Paid to</p>
                <div className="mt-1 space-y-1">
                  {typeTooltip.row.payees.slice(0, 3).map((payee) => (
                    <div key={payee.paidTo} className="flex min-w-0 items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-semibold text-slate-600">{payee.paidTo}</span>
                      <strong className="shrink-0 tabular-nums text-slate-800">{formatINRCompact(payee.amount)}</strong>
                    </div>
                  ))}
                  {typeTooltip.row.payees.length > 3 ? (
                    <p className="text-[9.5px] font-semibold text-slate-400">
                      +{typeTooltip.row.payees.length - 3} more payee{typeTooltip.row.payees.length - 3 === 1 ? "" : "s"}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
