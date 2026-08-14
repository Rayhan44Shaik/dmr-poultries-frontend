
// src/modules/staff/pages/DutyPlannerPage.tsx — PostgreSQL-backed Duty Planner
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Wand2, ShieldCheck, Send, Users, CheckCircle2, AlertTriangle, Lock, Loader2 } from "lucide-react";
import { useSafeNotification } from "../../../hooks/useSafeNotification";
import { useDutyPlannerBackend } from "../hooks/useDutyPlannerBackend";
import type { DutyType } from "../types/staffDashboard";

const DUTY_STYLES: Record<string, { short: string; cls: string }> = {
  Delivery: { short: "DEL", cls: "bg-green-100 text-green-700" },
  Repair: { short: "REP", cls: "bg-amber-100 text-amber-700" },
  OfficeDuty: { short: "OFF", cls: "bg-indigo-100 text-indigo-700" },
  Office: { short: "OFF", cls: "bg-indigo-100 text-indigo-700" },
  Collection: { short: "COL", cls: "bg-teal-100 text-teal-700" },
  WeeklyOff: { short: "WO", cls: "bg-rose-100 text-rose-600" },
  Driver: { short: "DRV", cls: "bg-blue-100 text-blue-700" },
  Rest: { short: "RST", cls: "bg-slate-100 text-slate-500" },
};
const DUTY_OPTIONS: DutyType[] = ["Delivery", "Repair", "OfficeDuty", "Collection", "WeeklyOff"];

function Badge({ type }: { type: string }) {
  const s = DUTY_STYLES[type] || { short: type.slice(0, 3).toUpperCase(), cls: "bg-slate-100 text-slate-600" };
  return <span className={"inline-flex min-w-[2.4rem] items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold " + s.cls}>{s.short}</span>;
}

function DutyPlannerPage() {
  const { showNotification } = useSafeNotification();
  const notify = (m: string, t: "success" | "error" | "info") => showNotification(m, t);
  const hp = useDutyPlannerBackend(notify);
  const week = hp.week;
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ empId: number; date: string } | null>(null);

  const activeCount = week ? week.employees.filter((e) => e.active).length : 0;
  const filtered = useMemo(() => {
    if (!week) return [];
    const q = search.trim().toLowerCase();
    const pool = week.employees.filter((e) => e.active);
    return q ? pool.filter((e) => e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q)) : pool;
  }, [week, search]);

  if (!week) {
    return <div className="flex items-center justify-center py-20 text-slate-500"><Loader2 className="animate-spin mr-2" size={18} /> Loading duty week…</div>;
  }

  const locked = week.status === "Locked" || week.status === "Submitted";
  const satDiv = week.saturday.shortage > 0
    ? <span className="text-amber-800">⚠ Staff Shortage ({week.saturday.shortage})</span>
    : <span className="text-emerald-800">✓ Fully Assigned</span>;

  const kpis = [
    { label: "Employees", value: activeCount, icon: Users, color: "text-blue-600" },
    { label: "Assigned", value: week.assignments.filter((x) => x.dutyType !== "WeeklyOff").length, icon: CheckCircle2, color: "text-green-600" },
    { label: "Leave", value: Object.values(week.perEmployee).reduce((s, e) => s + e.leave, 0), icon: AlertTriangle, color: "text-amber-600" },
    { label: "Weekly Off", value: week.assignments.filter((x) => x.dutyType === "WeeklyOff").length, icon: Lock, color: "text-rose-500" },
    { label: "Conflicts", value: week.validation.problems.length, icon: AlertTriangle, color: week.validation.problems.length ? "text-red-600" : "text-emerald-600" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className={"rounded-full px-3 py-1 text-xs font-bold " + (locked ? "bg-slate-100 text-slate-600" : week.status === "Submitted" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700")}>{week.status}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => hp.moveWeek(-1)} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50" aria-label="Previous week"><ChevronLeft size={16} /></button>
            <span className="whitespace-nowrap text-sm font-semibold text-slate-700">{week.days[0].date} → {week.days[6].date}</span>
            <button onClick={() => hp.moveWeek(1)} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50" aria-label="Next week"><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => hp.autoAssign()} disabled={locked || hp.busy} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"><Wand2 size={15} /> Auto Assign</button>
          <button onClick={() => hp.validate()} disabled={locked} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><ShieldCheck size={15} /> Validation</button>
          <button onClick={() => hp.submit()} disabled={locked || hp.busy} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Send size={15} /> Submit Week</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {kpis.map((k) => { const Icon = k.icon; return (<div key={k.label} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Icon size={14} className={k.color} /> {k.label}</div><div className="mt-1 text-2xl font-bold text-slate-800">{k.value}</div></div>); })}
      </div>

      <div className={"rounded-xl border px-4 py-3 text-sm " + (week.saturday.shortage > 0 ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>
        <span className="font-bold">Saturday Duty Plan</span> · Required {week.saturday.required} · Assigned {week.saturday.assigned} · {satDiv}
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee…" className="w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2 text-sm" />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50"><tr>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">Employee</th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">Role</th>
            {week.days.map((d) => (<th key={d.date} className={"px-2 py-2 text-center text-xs font-medium uppercase " + (d.weekday === "Sat" ? "text-amber-700" : "text-slate-500")}>{d.weekday}</th>))}
            <th className="px-3 py-2 text-center text-xs font-medium uppercase text-slate-500">Worked</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((e) => {
              const stat = week.perEmployee[e.id] || { worked: 0, delivery: 0, repair: 0, office: 0, collection: 0, weeklyOff: 0, leave: 0, weekOffDay: null };
              return (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-sm font-medium text-slate-700">{e.name}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{e.role}</td>
                  {week.days.map((d) => {
                    const a = hp.getAssignment(e.id, d.date);
                    const onLeave = e.onApprovedLeave.includes(d.date);
                    return (
                      <td key={d.date} className="px-2 py-2 text-center">
                        <button onClick={() => { if (!locked && e.active) setEditing({ empId: e.id, date: d.date }); }} disabled={locked || !e.active || onLeave} className="hover:opacity-80 disabled:opacity-40" title={"Assign " + e.name + " on " + d.date}>
                          {onLeave ? <span className="text-[10px] font-bold text-rose-500">L</span> : a ? <Badge type={a.dutyType} /> : <span className="text-slate-300">·</span>}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center text-sm font-semibold text-slate-600">{stat.worked}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {week.validation.problems.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="mb-1 font-bold">{week.validation.problems.length} problem(s) found</div>
          <ul className="list-disc pl-5 space-y-0.5">{week.validation.problems.map((p, i) => (<li key={i}>{p}</li>))}</ul>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 size={16} /> No validation problems.</div>
      )}

      {hp.previewOpen && hp.preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">Auto Assignment Preview</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-slate-50 p-2"><span className="text-slate-500">Employees:</span> <b>{hp.preview.employeesAffected}</b></div>
              <div className="rounded-lg bg-slate-50 p-2"><span className="text-slate-500">Delivery:</span> <b>{hp.preview.delivery}</b></div>
              <div className="rounded-lg bg-slate-50 p-2"><span className="text-slate-500">Repair:</span> <b>{hp.preview.repair}</b></div>
              <div className="rounded-lg bg-slate-50 p-2"><span className="text-slate-500">Office:</span> <b>{hp.preview.office}</b></div>
              <div className="rounded-lg bg-slate-50 p-2"><span className="text-slate-500">Collection:</span> <b>{hp.preview.collection}</b></div>
              <div className="rounded-lg bg-slate-50 p-2"><span className="text-slate-500">Weekly Off:</span> <b>{hp.preview.weeklyOff}</b></div>
            </div>
            {hp.preview.conflicts.length > 0 ? (<div className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{hp.preview.conflicts.join(" · ")}</div>) : (<div className="mt-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">No conflicts.</div>)}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => hp.setPreviewOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">Cancel</button>
              <button onClick={() => hp.applyPreview()} disabled={hp.busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">{hp.busy ? "Applying…" : "Apply Assignment"}</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-3 text-sm font-bold text-slate-800">Assign duty for {editing.date}</h3>
            <div className="grid grid-cols-2 gap-2">
              {DUTY_OPTIONS.map((t) => (<button key={t} onClick={async () => { const ok2 = await hp.assign(editing.empId, editing.date, t); if (ok2) setEditing(null); }} className={"rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 " + (DUTY_STYLES[t]?.cls || "")}>{t}</button>))}
            </div>
            <div className="mt-4 flex justify-end"><button onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DutyPlannerPage;
