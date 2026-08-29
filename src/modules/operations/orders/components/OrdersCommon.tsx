// src/modules/operations/orders/components/OrdersCommon.tsx
// Small shared visual pieces for the Orders module (badges, loading /
// empty / error states, icon actions). Styling reuses the existing
// operations design system classes — no new visual language.
// Deliberately NO dashboard-style KPI cards: this is an operational
// table page, and summaries live in compact bars inside each workflow.

import React from "react";
import {
  AlertTriangle,
  ChevronDown,
  CloudOff,
  Inbox,
  Lock,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  opsEmptyStateClass,
  opsPrimaryButtonClass,
} from "../../../../shared/ui/operationsStyles";
import { DatePicker } from "../../../../components/common/DatePicker";
import { addLocalDays } from "../ordersUtils";
import type { OrdersT } from "../i18n/ordersI18n";

// ─── Status badge ────────────────────────────────────────────────────────────

const STATUS_TONES: Record<string, string> = {
  Assigned: "bg-slate-100 text-slate-600 border-slate-200",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Entered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Draft: "bg-slate-100 text-slate-600 border-slate-200",
  "Awaiting assignment": "bg-sky-50 text-sky-700 border-sky-200",
  "Partial assignment": "bg-amber-50 text-amber-700 border-amber-200",
  "Delivered with Difference": "bg-amber-50 text-amber-700 border-amber-300",
  "Not Assigned": "bg-slate-100 text-slate-500 border-slate-200",
  Complete: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Closed: "bg-slate-200 text-slate-600 border-slate-300",
  Locked: "bg-slate-200 text-slate-600 border-slate-300",
};

export function OrdersStatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  const tone = STATUS_TONES[status] ?? "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${tone}`}
    >
      {label}
    </span>
  );
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

export function OrdersTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-2.5" aria-busy="true" aria-label="loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

export function OrdersEmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className={opsEmptyStateClass}>
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="h-14 w-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
          <Inbox className="h-6 w-6" />
        </div>
        <p className="font-medium text-slate-600">{title}</p>
        {hint && <p className="text-xs text-slate-400 max-w-md">{hint}</p>}
      </div>
    </div>
  );
}

// ─── Error state with retry ──────────────────────────────────────────────────

export function OrdersErrorState({
  title,
  message,
  onRetry,
  retryLabel,
}: {
  title: string;
  message: string;
  onRetry: () => void;
  retryLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-10 text-center">
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="h-14 w-14 rounded-full bg-rose-100 flex items-center justify-center text-rose-500">
          <CloudOff className="h-6 w-6" />
        </div>
        <p className="font-semibold text-rose-800 flex items-center gap-1.5">
          <AlertTriangle size={15} /> {title}
        </p>
        <p className="text-xs text-rose-600 max-w-md">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className={`${opsPrimaryButtonClass} mt-2`}
          aria-label={retryLabel}
        >
          <RefreshCw size={14} />
          {retryLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Icon-only action button (tooltip + aria) ────────────────────────────────

export function OrdersIconButton({
  label,
  onClick,
  disabled,
  busy,
  children,
  tone = "slate",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  children: React.ReactNode;
  tone?: "slate" | "emerald" | "rose" | "sky";
}) {
  const tones: Record<string, string> = {
    slate: "border-slate-200/80 text-slate-500 hover:bg-slate-50 hover:text-slate-800",
    emerald: "border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",
    rose: "border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-600",
    sky: "border-sky-200 text-sky-600 hover:bg-sky-50 hover:text-sky-700",
  };
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled || busy}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
    >
      {busy ? <RefreshCw size={14} className="animate-spin" /> : children}
    </button>
  );
}

// ─── Table-level search input (compact, one per table) ─────────────────────

export function OrdersSearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <label className={`relative block ${className}`}>
      <Search
        size={14}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
          aria-label="Clear search"
          tabIndex={-1}
        >
          <X size={13} />
        </button>
      )}
    </label>
  );
}

// ─── Global operational-date selector (reuses the shared DatePicker) ────────

/**
 * ONE global date selector for the Orders module — the project's shared
 * DatePicker bound to the selected operational day: default TODAY, previous
 * operational days allowed, FUTURE DATES DISABLED (maxDate = today). No
 * Previous/Next day buttons, no date-card scroller.
 */
export function OrdersDateControl({
  day,
  today,
  onDaySelect,
  t,
  className = "",
}: {
  day: string;
  today: string;
  onDaySelect: (day: string) => void;
  t: (key: string) => string;
  className?: string;
}) {
  if (!day || !today) return null;
  const minDate = addLocalDays(today, -6);
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <DatePicker
        value={day}
        onChange={(v) => {
          if (v && v <= today && v >= minDate) onDaySelect(v);
        }}
        minDate={minDate}
        maxDate={today}
        placeholder="DD/MM/YYYY"
        hideThisWeek
        hideClear
        hideToday
        // Full "DD/MM/YYYY" (10 chars) + calendar icon must be visible —
        // the input reserves pr-16 for the icon, so the field needs
        // ~110px of text room. w-44 guarantees no clipping/overflow.
        className="w-44"
        data-testid="orders-date-picker"
      />
      {day === today ? (
        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold tracking-wide text-emerald-700 whitespace-nowrap">
          {t("orders.today_chip")}
        </span>
      ) : day < today ? (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-300 px-2 py-0.5 text-[10px] font-bold text-slate-500 whitespace-nowrap"
          title={t("orders.read_only_note")}
        >
          <Lock size={10} />
          {t("orders.closed_day")}
        </span>
      ) : null}
    </div>
  );
}

// ─── Compact table-level filter (single select) ─────────────────────────────

export function OrdersFilterSelect({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <label className={`relative inline-block ${className}`}>
      <span className="sr-only">{ariaLabel}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className={`h-9 appearance-none rounded-lg border bg-white pl-3 pr-8 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 ${
          value
            ? "border-emerald-300 text-emerald-800 bg-emerald-50/50"
            : "border-slate-200 text-slate-600"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
    </label>
  );
}

export type { OrdersT };
