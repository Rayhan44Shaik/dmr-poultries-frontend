// src/modules/operations/orders/components/OrdersCommon.tsx
// Small shared visual pieces for the Orders module (badges, loading /
// empty / error states, icon actions). Styling reuses the existing
// operations design system classes — no new visual language.
// Deliberately NO dashboard-style KPI cards: this is an operational
// table page, and summaries live in compact bars inside each workflow.

import React, { useEffect, useId, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
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
import TripPagination from "../../vehicle-trips/components/TripPagination";
import { addLocalDays } from "../ordersUtils";
import type { OrdersT } from "../i18n/ordersI18n";
import { ORDERS_DEFAULT_PAGE_SIZE, ORDERS_PAGE_SIZES } from "./ordersUiConstants";

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
  "Not Collected": "bg-slate-100 text-slate-500 border-slate-200",
  Collected: "bg-emerald-50 text-emerald-700 border-emerald-200",
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
  className = "",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  children: React.ReactNode;
  tone?: "slate" | "emerald" | "rose" | "sky";
  className?: string;
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
      className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border bg-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${className}`}
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
  daysBack = 6,
}: {
  day: string;
  today: string;
  onDaySelect: (day: string) => void;
  t: (key: string) => string;
  className?: string;
  /** How far back the calendar may go (Delivery Tracking looks further). */
  daysBack?: number;
}) {
  if (!day || !today) return null;
  const minDate = addLocalDays(today, -Math.max(0, daysBack));
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

// ─── WhatsApp brand icon (proper logo, not a generic chat bubble) ──────────

/** Official WhatsApp logo path (24×24, fill = currentColor). */
export function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      role="img"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

// ─── Compact table-level filter (single select) ─────────────────────────────

/**
 * REAL dropdown (popover listbox) — replaces native <select>:
 *  - trigger shows the CURRENT selection,
 *  - opens a visible option list,
 *  - selecting an option closes the list,
 *  - click outside / Escape closes it,
 *  - keyboard accessible (Arrow keys, Home/End, Enter/Space, Escape),
 *  - the parent applies the new value, so the table reorders visibly.
 */
export function OrdersDropdown({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
  widthClass = "w-44",
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
  className?: string;
  widthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();
  const selected = options.find((o) => o.value === value);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  // Keep the highlighted option scrolled into view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const openList = (focusList: boolean) => {
    setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
    if (focusList) {
      requestAnimationFrame(() => listRef.current?.focus());
    }
  };

  const select = (v: string) => {
    setOpen(false);
    if (v !== value) onChange(v);
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openList(true);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[activeIndex];
      if (opt) select(opt.value);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <span className="sr-only">{ariaLabel}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openList(false))}
        onKeyDown={onTriggerKeyDown}
        className={`h-9 ${widthClass} inline-flex items-center justify-between gap-2 rounded-lg border bg-white pl-3 pr-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 ${
          value ? "border-emerald-300 text-emerald-800 bg-emerald-50/50" : "border-slate-200 text-slate-600"
        }`}
      >
        <span className="truncate text-left">{selected?.label ?? "—"}</span>
        <ChevronDown
          size={13}
          className={`flex-shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className={`absolute right-0 z-30 mt-1 max-h-64 min-w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${widthClass}`}
        >
          {options.map((o, i) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => select(o.value)}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  i === activeIndex ? "bg-emerald-50 text-emerald-800" : "text-slate-600"
                } ${o.value === value ? "font-bold" : ""}`}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && <Check size={13} className="flex-shrink-0 text-emerald-600" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type { OrdersT };

// ─── Table-level pagination bar (10 rows default + rows-per-page) ──────────

/**
 * ONE pagination bar for every Orders table: total count, rows-per-page and
 * the shared Previous / page-numbers / Next control. The numbers come from
 * the SERVER-side page envelope (`total`, `page`, `totalPages`), so a page
 * change never re-slices a partially loaded dataset.
 */
export function OrdersPagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  t,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
          {t("orders.pagination_range", { from, to, total })}
        </span>
        <OrdersDropdown
          value={String(pageSize)}
          onChange={(v) => onPageSizeChange(Number(v) || ORDERS_DEFAULT_PAGE_SIZE)}
          options={ORDERS_PAGE_SIZES.map((size) => ({
            value: String(size),
            label: t("orders.rows_per_page", { size }),
          }))}
          ariaLabel={t("orders.rows_per_page_label")}
          widthClass="w-36"
        />
      </div>
      <TripPagination
        currentPage={page}
        totalPages={Math.max(1, totalPages)}
        onPageChange={onPageChange}
        hidePageInfo
      />
    </div>
  );
}

// ─── Quantity summary strip (real backend figures, never hard-coded) ───────

export type OrdersSummaryMetric = {
  key: string;
  label: string;
  value: number | string;
  tone?: "slate" | "emerald" | "amber" | "sky" | "rose";
};

/**
 * Compact metric strip above the table. Values come straight from the
 * server-side `summary` envelope (the FILTERED dataset, not the page), so
 * "how many boxes are required / loaded / pending / delivered" is always the
 * real persisted figure.
 */
export function OrdersSummaryStrip({ metrics }: { metrics: OrdersSummaryMetric[] }) {
  const tones: Record<string, string> = {
    slate: "text-slate-700",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    sky: "text-sky-700",
    rose: "text-rose-700",
  };
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-3 lg:grid-cols-6">
      {metrics.map((metric) => (
        <div key={metric.key} className="bg-white px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {metric.label}
          </div>
          <div className={`text-base font-extrabold tabular-nums ${tones[metric.tone ?? "slate"]}`}>
            {metric.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Professional tab header ───────────────────────────────────────────────

export type OrdersTabDef = {
  key: string;
  label: string;
  icon: React.ReactNode;
};

/**
 * ERP-style segmented tab header: one clearly active tab, quiet inactive
 * tabs, consistent 36px height, icons aligned with the label, and a single
 * rule under the whole strip so the table below reads as its content.
 * Horizontally scrollable (never wrapped) on narrow screens.
 */
export function OrdersTabHeader({
  tabs,
  activeKey,
  onSelect,
  ariaLabel,
}: {
  tabs: OrdersTabDef[];
  activeKey: string;
  onSelect: (key: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="border-b border-slate-200" role="tablist" aria-label={ariaLabel}>
      <div className="-mb-px flex items-stretch gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(tab.key)}
              className={`inline-flex h-10 flex-shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-[12px] font-bold tracking-tight transition-colors md:px-4 md:text-[13px] ${
                active
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              <span className={active ? "text-emerald-600" : "text-slate-400"}>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
