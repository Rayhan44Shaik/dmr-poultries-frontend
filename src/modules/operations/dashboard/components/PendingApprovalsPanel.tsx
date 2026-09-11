// -----------------------------------------------------------------------------
// PENDING APPROVALS PANEL — premium, at-a-glance sign-off summary for the
// dashboard. Live API-driven (same snapshot store as the header bell + sidebar
// badges), NOT localStorage like the old inline strip it replaces.
// -----------------------------------------------------------------------------

import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  ReceiptText,
  Truck,
  Wallet,
  Wrench,
} from "lucide-react";
import { usePendingApprovals } from "../../../approvals/hooks/usePendingApprovals";
import { inr } from "../../../approvals/approvalsUtils";

interface Tile {
  key: string;
  label: string;
  hint: string;
  href: string;
  icon: LucideIcon;
  count: number;
  sub: string;
  iconChip: string;
  accentBar: string;
  iconColor: string;
  tileHover: string;
  numberColor: string;
}

function SkeletonTile() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between">
        <div className="h-9 w-9 rounded-lg bg-slate-200/80" />
        <div className="h-7 w-10 rounded-md bg-slate-200/80" />
      </div>
      <div className="mt-3 h-3.5 w-28 rounded bg-slate-200/80" />
      <div className="mt-2 h-3 w-20 rounded bg-slate-100" />
    </div>
  );
}

export default function PendingApprovalsPanel() {
  const q = usePendingApprovals();
  const loading = !q.loaded;

  const tiles: Tile[] = [
    {
      key: "trips",
      label: "Trips to approve",
      hint: "Completed trips awaiting sign-off",
      href: "/operations?tab=trip-entry&status=Pending",
      icon: Truck,
      count: q.trips.count,
      sub: `${q.trips.birds.toLocaleString("en-IN")} birds · ${q.trips.shops} shop stops`,
      iconChip: "bg-sky-50 text-sky-600 ring-sky-100",
      accentBar: "bg-sky-500",
      iconColor: "text-sky-600",
      tileHover: "hover:border-sky-200 hover:bg-sky-50/40 hover:shadow-sky-100/60",
      numberColor: "text-sky-700",
    },
    {
      key: "rates",
      label: "Rate entries",
      hint: "Trips waiting for shop-wise rates",
      href: "/operations?tab=rate-entry",
      icon: ReceiptText,
      count: q.rateEntries.count,
      sub: q.rateEntries.count === 1 ? "1 completed trip" : `${q.rateEntries.count} completed trips`,
      iconChip: "bg-cyan-50 text-cyan-600 ring-cyan-100",
      accentBar: "bg-cyan-500",
      iconColor: "text-cyan-600",
      tileHover: "hover:border-cyan-200 hover:bg-cyan-50/40 hover:shadow-cyan-100/60",
      numberColor: "text-cyan-700",
    },
    {
      key: "maintenance",
      label: "Maintenance bills",
      hint: "Bill & spare-part rates to verify",
      href: "/fleet?tab=entry",
      icon: Wrench,
      count: q.maintenance.count,
      sub: inr.format(q.maintenance.value) + " in bills",
      iconChip: "bg-violet-50 text-violet-600 ring-violet-100",
      accentBar: "bg-violet-500",
      iconColor: "text-violet-600",
      tileHover: "hover:border-violet-200 hover:bg-violet-50/40 hover:shadow-violet-100/60",
      numberColor: "text-violet-700",
    },
    {
      key: "payments",
      label: "Payments to approve",
      hint: "Draft payments awaiting sign-off",
      href: "/accounts?tab=paid-payments",
      icon: Banknote,
      count: q.payments.count,
      sub: inr.format(q.payments.value) + " requested",
      iconChip: "bg-emerald-50 text-emerald-600 ring-emerald-100",
      accentBar: "bg-emerald-500",
      iconColor: "text-emerald-600",
      tileHover: "hover:border-emerald-200 hover:bg-emerald-50/40 hover:shadow-emerald-100/60",
      numberColor: "text-emerald-700",
    },
  ];

  const cashAwaiting = q.maintenance.value + q.payments.value;

  return (
    <section
      aria-label="Pending approvals"
      className="overflow-hidden rounded-2xl border border-amber-200/70 bg-white shadow-sm shadow-amber-100/40"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="relative flex flex-wrap items-center gap-3 border-b border-amber-100 bg-gradient-to-r from-amber-50 via-orange-50/70 to-amber-50/30 px-4 py-3.5 sm:px-5">
        <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-amber-200/30 blur-2xl" aria-hidden="true" />
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-200">
          <ClipboardCheck size={22} strokeWidth={2.2} />
        </span>
        <div className="relative min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-extrabold tracking-tight text-slate-900">
            Pending Approvals
            {!loading && q.total > 0 && (
              <span className="inline-flex h-6 min-w-[26px] items-center justify-center rounded-full bg-amber-500 px-2 text-xs font-extrabold tabular-nums text-white shadow-sm">
                {q.total}
                <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white/90" aria-hidden="true" />
              </span>
            )}
          </h2>
          <p className="text-xs font-medium text-slate-500">
            {loading
              ? "Checking what is waiting for your sign-off…"
              : q.total > 0
                ? "These items are waiting for your review and sign-off"
                : "Everything is reviewed — nothing is waiting for you"}
          </p>
        </div>
        <Link
          to="/approvals"
          className="group relative ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
        >
          Open Approval Center
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* ── Tiles ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <>
            <SkeletonTile />
            <SkeletonTile />
            <SkeletonTile />
            <SkeletonTile />
          </>
        ) : q.total === 0 ? (
          <div className="sm:col-span-2 xl:col-span-4">
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50/70 to-white px-6 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-4 ring-emerald-50">
                <CheckCircle2 size={26} />
              </span>
              <p className="text-sm font-extrabold tracking-tight text-emerald-800">
                All caught up — nothing pending approval
              </p>
              <p className="max-w-md text-xs font-medium text-slate-500">
                New trips, rate entries, maintenance bills and payment requests will appear here the moment they
                are submitted for your sign-off.
              </p>
            </div>
          </div>
        ) : (
          tiles.map((tile) => {
            const Icon = tile.icon;
            const isEmpty = tile.count === 0;
            return (
              <Link
                key={tile.key}
                to={tile.href}
                className={`group relative overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${tile.tileHover} ${
                  isEmpty ? "border-slate-100 opacity-75 hover:opacity-100" : "border-slate-200/80"
                }`}
              >
                <span className={`absolute inset-x-0 top-0 h-[3px] ${tile.accentBar} ${isEmpty ? "opacity-20" : ""}`} aria-hidden="true" />
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${tile.iconChip} ${
                      isEmpty ? "grayscale" : ""
                    }`}
                  >
                    <Icon size={19} strokeWidth={2.1} />
                  </span>
                  {isEmpty ? (
                    <CheckCircle2 size={18} className="mt-1 text-emerald-400" aria-label="Nothing pending" />
                  ) : (
                    <span
                      className={`text-[28px] font-black leading-none tabular-nums tracking-tight ${tile.numberColor}`}
                    >
                      {tile.count}
                    </span>
                  )}
                </div>
                <p className="mt-3 flex items-center gap-1 text-[13px] font-bold text-slate-800">
                  {tile.label}
                  <ArrowRight
                    size={13}
                    className={`-translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 ${tile.iconColor}`}
                  />
                </p>
                <p className="mt-0.5 truncate text-xs font-medium text-slate-400" title={tile.sub}>
                  {isEmpty ? "Nothing pending" : tile.sub}
                </p>
              </Link>
            );
          })
        )}
      </div>

      {/* ── Footer: cash exposure ──────────────────────────────────────── */}
      {!loading && q.total > 0 && cashAwaiting > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-amber-100 bg-amber-50/50 px-4 py-2.5 sm:px-5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <Wallet size={13} />
          </span>
          <p className="text-xs font-semibold text-amber-900">
            <span className="font-black tabular-nums">{inr.format(cashAwaiting)}</span> in maintenance bills &amp;
            payments is awaiting approval
          </p>
          <Link
            to="/approvals"
            className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-amber-800 underline-offset-2 hover:underline"
          >
            Review now
            <ArrowRight size={12} />
          </Link>
        </div>
      )}
    </section>
  );
}
