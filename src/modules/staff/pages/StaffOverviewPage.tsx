// src/modules/staff/pages/StaffOverviewPage.tsx
// Staff Overview — the quarter-synced landing page for the Staff module.
//
// Every figure is read from the SAME deterministic quarter dataset that powers
// Duty Planner, Leaves, Salary Register and Performance, via the shared quarter
// sample API (scripts/quarter-sample-data.mjs, started by `npm run dev`).
// When the sample server identifies itself the page badges itself
// "Sample quarter (from → to)" exactly like the executive dashboard, so the
// user can tell sample numbers apart from production numbers at a glance.
//
// Layout mirrors the executive dashboard but staff-scoped:
//   • Greeting + quarter badge + today
//   • 4 KPI cards on one row (Total Employees · Present Today · On Leave · Salary Pending)
//   • Quarter dimensions strip (shops×trips×sales concept adapted to staff)
//   • Duty allocation donut + Weekly attendance bars + Department roster
//   • On-duty employees table
//   • Leaves + Salary + Performance snapshot strips with deep-links
//
// No localStorage math, no synthetic rows — the backend is authoritative.

import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  UserCheck,
  CalendarDays,
  Wallet,
  Clock3,
  Briefcase,
  TrendingUp,
  RefreshCw,
  DatabaseZap,
  Sparkles,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Gauge,
  Award,
} from "lucide-react";
import { useStaffOverview } from "../hooks/useStaffOverview";
import { useI18n } from "../../../i18n";
import { formatDateLong } from "../../../utils/format";
import { getCurrentUser } from "../../settings/services";

function formatCount(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n ?? 0);
}
function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n ?? 0);
}
function greetingForHour(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function SkeletonCard() {
  return <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" /><div className="mt-3 h-7 w-16 rounded bg-slate-200 dark:bg-slate-700" /><div className="mt-2 h-3 w-32 rounded bg-slate-100 dark:bg-slate-800" /></div>;
}

export default function StaffOverviewPage({ embedded = true }: { embedded?: boolean }) {
  const { data, loading, error, refetch, refreshing } = useStaffOverview();
  const { t } = useI18n();
  const user = getCurrentUser();
  const greeting = `${greetingForHour()}, ${user?.name ?? "Owner"} 👋`;

  const todayStr = useMemo(() => formatDateLong(new Date()), []);
  const deptEntries = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.counts.departments).sort((a, b) => b[1] - a[1]);
  }, [data]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-20 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 animate-pulse" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="h-64 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
          <div className="h-64 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
          <div className="h-64 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }

  const quarter = data?.sampleQuarter ?? null;
  const dash = data?.dashboard;
  const counts = data?.counts;

  // KPI cards — one row, no wrapping (mirrors executive dashboard's 8-col grid but staff-focused 4-col)
  const kpis = dash ? [
    {
      key: "totalEmployees",
      label: t("staff.overview.kpi.total_employees" as never) ?? "Total Employees",
      value: formatCount(dash.totalEmployees),
      sub: `${formatCount(Object.keys(counts?.departments ?? {}).length)} departments · ${formatCount(counts?.employees ?? dash.totalEmployees)} in master`,
      icon: Users,
      tone: "bg-violet-600",
      trend: null as number | null,
    },
    {
      key: "presentToday",
      label: t("staff.overview.kpi.present_today" as never) ?? "Present Today",
      value: formatCount(dash.presentToday),
      sub: `${formatCount(dash.onDutyToday)} on duty · ${quarter ? quarter.today : todayStr}`,
      icon: UserCheck,
      tone: "bg-emerald-600",
      trend: null,
    },
    {
      key: "onLeave",
      label: t("staff.overview.kpi.on_leave" as never) ?? "On Leave Today",
      value: formatCount(dash.onLeave),
      sub: `${formatCount(counts?.leaves.pending ?? 0)} pending · ${formatCount(counts?.leaves.total ?? 0)} total requests`,
      icon: CalendarDays,
      tone: "bg-amber-600",
      trend: null,
    },
    {
      key: "salaryPending",
      label: t("staff.overview.kpi.salary_pending" as never) ?? "Salary Pending",
      value: formatCount(dash.salaryPending),
      sub: `${formatCount(counts?.salaries.paid ?? 0)} paid · ${formatCount(counts?.salaries.total ?? 0)} in register`,
      icon: Wallet,
      tone: "bg-sky-600",
      trend: null,
    },
  ] : [];

  return (
    <div className={embedded ? "space-y-5" : "mx-auto w-full max-w-[1480px] space-y-5 px-4 py-6 sm:px-6 lg:px-8"}>
      {/* Greeting + quarter badge */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-[22px] dark:text-white">{greeting}</h1>
            {quarter && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300"
                title={`Sample quarter served by scripts/quarter-sample-data.mjs · ${quarter.fromDate} → ${quarter.toDate} · today in dataset: ${quarter.today}`}
              >
                <DatabaseZap size={12} />
                {quarter.label}
              </span>
            )}
            {data?.usingSample && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300">
                <Sparkles size={11} />
                {t("dashboard.sample_data" as never) ?? "Sample data"}
              </span>
            )}
            {quarter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <Clock3 size={11} />
                {quarter.fromDate} → {quarter.toDate} · Today {quarter.today}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Staff overview — every number below is the live quarter dataset ({quarter ? `${quarter.fromDate} → ${quarter.toDate}` : "backend"}) the Staff module's pages render from.
          </p>
          <p className="mt-0.5 text-xs font-medium text-slate-400 dark:text-slate-500">{todayStr}</p>
          {error && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              <span>Could not refresh staff overview — showing last available data.</span>
              <button onClick={() => void refetch()} className="font-semibold underline">Retry</button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <Link
            to="/staff?tab=duty-planner"
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-violet-700"
          >
            <CalendarClock size={15} />
            Open Duty Planner
          </Link>
        </div>
      </div>

      {/* KPI row — 4 on one line */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.key} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{kpi.label}</p>
                  <p className="mt-1 truncate text-[22px] font-bold tracking-tight text-slate-900 dark:text-white">{kpi.value}</p>
                  <p className="mt-1 text-xs leading-4 text-slate-500 dark:text-slate-400">{kpi.sub}</p>
                </div>
                <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm ${kpi.tone}`}>
                  <Icon size={16} />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quarter dimensions strip — every master count present */}
      {counts && quarter && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white inline-flex items-center gap-2">
              <Building2 size={14} className="text-slate-400" />
              Quarter dataset dimensions
              <span className="text-xs font-normal text-slate-500">— {quarter.label} · 92 days · every module reads the same rows</span>
            </h3>
            <Link to="/masters?tab=employees" className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400">
              View Employees
              <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-8">
            {[
              { label: "Employees", value: formatCount(counts.employees), sub: `${Object.keys(counts.departments).length} depts` },
              { label: "Duty cells", value: formatCount(counts.dutyAssignments), sub: "92 days + 14 future" },
              { label: "Leaves", value: formatCount(counts.leaves.total), sub: `${counts.leaves.pending} pending` },
              { label: "Salaries", value: formatCount(counts.salaries.total), sub: `${counts.salaries.paid} paid` },
              { label: "Drivers", value: formatCount(counts.performance.drivers), sub: "with trips" },
              { label: "Supervisors", value: formatCount(counts.performance.supervisors), sub: "with deliveries" },
              { label: "Today present", value: formatCount(dash?.presentToday ?? 0), sub: "on duty now" },
              { label: "Today on leave", value: formatCount(dash?.onLeave ?? 0), sub: "approved" },
            ].map((cell) => (
              <div key={cell.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{cell.label}</p>
                <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{cell.value}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{cell.sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Duty allocation + Weekly attendance + Department roster */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Duty allocation */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Briefcase size={14} className="text-violet-500" />
            Duty allocation today
            <Link to="/staff?tab=duty-planner" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400">
              Planner <ArrowUpRight size={12} />
            </Link>
          </h3>
          {dash?.dutyAllocation?.length ? (
            <div className="mt-4 space-y-3">
              {dash.dutyAllocation.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.value}%</span>
                </div>
              ))}
              <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                {dash.dutyAllocation.map((item) => (
                  <span key={item.label} style={{ width: `${item.value}%`, background: item.color }} />
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Distribution of all employees on duty today ({quarter?.today ?? "today"}). · Source: <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] dark:bg-slate-800">GET /api/staff/dashboard</code>
              </p>
            </div>
          ) : (
            <p className="mt-6 text-sm text-slate-500">No duty data for today.</p>
          )}
        </div>

        {/* Weekly attendance */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <TrendingUp size={14} className="text-emerald-500" />
            Weekly attendance
            <span className="ml-auto text-xs font-normal text-slate-500">{quarter ? `week of ${quarter.today}` : "last 7 days"}</span>
          </h3>
          {dash?.weeklyAttendance?.length ? (
            <div className="mt-4">
              <div className="flex h-36 items-end gap-1.5">
                {dash.weeklyAttendance.map((d) => {
                  const max = Math.max(...dash!.weeklyAttendance.map((x) => x.present + x.leave), 1);
                  const hPresent = (d.present / max) * 100;
                  const hLeave = (d.leave / max) * 100;
                  return (
                    <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex w-full flex-col items-stretch gap-0.5" style={{ height: "96px" }}>
                        <div className="flex flex-1 flex-col justify-end gap-0.5">
                          <div className="rounded-t bg-emerald-500 dark:bg-emerald-400" style={{ height: `${hPresent}%`, minHeight: d.present ? "4px" : 0 }} title={`${d.present} present`} />
                          <div className="rounded-t bg-amber-400 dark:bg-amber-300" style={{ height: `${hLeave}%`, minHeight: d.leave ? "3px" : 0 }} title={`${d.leave} on leave`} />
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{d.day}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-emerald-500" /> Present</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-amber-400" /> Leave</span>
                <Link to="/staff?tab=leaves" className="ml-auto font-semibold text-violet-600 hover:underline dark:text-violet-400">Leaves →</Link>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-slate-500">No attendance in this window.</p>
          )}
        </div>

        {/* Department roster */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Building2 size={14} className="text-sky-500" />
            Employees by department
            <Link to="/masters?tab=employees" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400">
              Directory <ArrowUpRight size={12} />
            </Link>
          </h3>
          <div className="mt-4 space-y-2.5">
            {deptEntries.length ? deptEntries.map(([dept, count]) => {
              const max = Math.max(...deptEntries.map(([, c]) => c), 1);
              const pct = Math.round((count / max) * 100);
              return (
                <div key={dept} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 truncate text-sm font-medium text-slate-700 dark:text-slate-300">{dept}</span>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-2 rounded-full bg-violet-500 dark:bg-violet-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="w-8 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{count}</span>
                </div>
              );
            }) : <p className="text-sm text-slate-500">No employees.</p>}
          </div>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            {data?.employees.length ?? 0} employees in master · GET /api/masters/employees
          </p>
        </div>
      </div>

      {/* On-duty employees + Leaves & Salary snapshots */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* On-duty table */}
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <UserCheck size={14} className="text-emerald-500" />
              On duty today
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">{dash?.onDutyEmployees.length ?? 0}</span>
            </h3>
            <Link to="/staff?tab=duty-planner" className="text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400">Open planner →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Employee</th>
                  <th className="px-3 py-2.5 font-semibold">Role</th>
                  <th className="px-3 py-2.5 font-semibold">Duty</th>
                  <th className="px-3 py-2.5 font-semibold">Vehicle</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(dash?.onDutyEmployees ?? []).slice(0, 8).map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-900 dark:text-white">{emp.name}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">{emp.role}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-600/10 dark:bg-violet-500/10 dark:text-violet-300">{emp.dutyType}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-400">{emp.vehicle ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${emp.status === "Active" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-amber-50 text-amber-700 ring-amber-600/10 dark:bg-amber-500/10 dark:text-amber-300"}`}>
                        {emp.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {(dash?.onDutyEmployees?.length ?? 0) === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No on-duty employees for today.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {(dash?.onDutyEmployees?.length ?? 0) > 8 && (
            <div className="border-t border-slate-100 px-4 py-2 text-center dark:border-slate-800">
              <Link to="/staff?tab=duty-planner" className="text-xs font-semibold text-slate-600 hover:text-violet-600 dark:text-slate-400">View all {dash?.onDutyEmployees.length} in Duty Planner →</Link>
            </div>
          )}
        </div>

        {/* Right stack: leaves + salary */}
        <div className="space-y-4">
          {/* Leaves snapshot */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <CalendarDays size={14} className="text-amber-500" />
              Leaves snapshot
              <Link to="/staff?tab=leaves" className="ml-auto text-xs font-semibold text-amber-600 hover:underline dark:text-amber-400">Manage →</Link>
            </h3>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-500/10">
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{formatCount(counts?.leaves.pending ?? 0)}</p>
                <p className="text-xs font-medium text-amber-700/80 dark:text-amber-300/80">Pending</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-500/10">
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatCount(counts?.leaves.approved ?? 0)}</p>
                <p className="text-xs font-medium text-emerald-700/80 dark:text-emerald-300/80">Approved</p>
              </div>
              <div className="rounded-lg bg-rose-50 p-3 dark:bg-rose-500/10">
                <p className="text-lg font-bold text-rose-700 dark:text-rose-300">{formatCount(counts?.leaves.rejected ?? 0)}</p>
                <p className="text-xs font-medium text-rose-700/80 dark:text-rose-300/80">Rejected</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              {formatCount(counts?.leaves.total ?? 0)} total leave requests in quarter · {quarter ? `${quarter.fromDate} → ${quarter.toDate}` : ""} · source: GET /api/staff/leaves
            </p>
          </div>

          {/* Salary snapshot */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Wallet size={14} className="text-sky-500" />
              Salary register — {quarter ? quarter.today.slice(0, 7) : "current month"}
              <Link to="/staff?tab=salary-sheet" className="ml-auto text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400">Register →</Link>
            </h3>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-500/10">
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{formatCount(counts?.salaries.pending ?? 0)}</p>
                <p className="text-xs font-medium">Pending</p>
              </div>
              <div className="rounded-lg bg-sky-50 p-3 dark:bg-sky-500/10">
                <p className="text-lg font-bold text-sky-700 dark:text-sky-300">{formatCount(counts?.salaries.submitted ?? 0)}</p>
                <p className="text-xs font-medium">Submitted</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-500/10">
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatCount(counts?.salaries.paid ?? 0)}</p>
                <p className="text-xs font-medium">Paid</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">{formatCount(counts?.salaries.total ?? 0)} salary rows · {quarter ? `${quarter.fromDate.slice(0,7)} → ${quarter.toDate.slice(0,7)}` : ""}</span>
              {counts?.salaries.netPayroll ? <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{formatINR(counts.salaries.netPayroll)} net</span> : null}
            </div>
          </div>
        </div>
      </div>

      {/* Performance snapshot */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Gauge size={14} className="text-indigo-500" />
            Driver performance — top 3
            <Link to="/staff?tab=driver-performance" className="ml-auto text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">View all →</Link>
          </h3>
          <div className="mt-3 space-y-2.5">
            {(counts?.performance.topDrivers ?? []).length ? counts!.performance.topDrivers.map((d, i) => (
              <div key={d.name} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : "bg-orange-400"}`}>{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-white">{d.name}</span>
                <span className="text-xs text-slate-500">{d.trips} trips · {formatCount(d.distance)} km</span>
              </div>
            )) : <p className="text-sm text-slate-500">No driver data in this window.</p>}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{formatCount(counts?.performance.drivers ?? 0)} active drivers · GET /api/staff/performance/drivers</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Award size={14} className="text-teal-500" />
            Supervisor performance — top 3
            <Link to="/staff?tab=supervisor-performance" className="ml-auto text-xs font-semibold text-teal-600 hover:underline dark:text-teal-400">View all →</Link>
          </h3>
          <div className="mt-3 space-y-2.5">
            {(counts?.performance.topSupervisors ?? []).length ? counts!.performance.topSupervisors.map((d, i) => (
              <div key={d.name} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : "bg-orange-400"}`}>{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-white">{d.name}</span>
                <span className="text-xs text-slate-500">{d.trips} trips · {formatCount(d.shops)} shops</span>
              </div>
            )) : <p className="text-sm text-slate-500">No supervisor data in this window.</p>}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{formatCount(counts?.performance.supervisors ?? 0)} active supervisors · GET /api/staff/performance/supervisors</p>
        </div>
      </div>

      {/* Quick links strip */}
      <div className="flex flex-wrap gap-2">
        <Link to="/staff?tab=duty-planner" className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300"><CalendarClock size={12} /> Duty Planner</Link>
        <Link to="/staff?tab=leaves" className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"><CalendarDays size={12} /> Leaves ({formatCount(counts?.leaves.total ?? 0)})</Link>
        <Link to="/staff?tab=salary-sheet" className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300"><Wallet size={12} /> Salary Register ({formatCount(counts?.salaries.total ?? 0)})</Link>
        <Link to="/staff?tab=driver-performance" className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300"><Gauge size={12} /> Driver Performance</Link>
        <Link to="/staff?tab=supervisor-performance" className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-300"><Award size={12} /> Supervisor Performance</Link>
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><TrendingUp size={12} /> Executive Dashboard</Link>
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-slate-400 dark:text-slate-500">
        Staff module is 100% quarter-synced — duty, leaves, salaries and performance all render from the same 92-day dataset (<code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">{quarter ? `${quarter.fromDate} → ${quarter.toDate}` : "live backend"}</code>).
      </p>
    </div>
  );
}
