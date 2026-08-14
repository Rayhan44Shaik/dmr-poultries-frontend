// src/modules/staff/hooks/useDutyPlannerBackend.ts
// PostgreSQL-backed Duty Planner hook (replaces localStorage path).

import { useCallback, useEffect, useState } from "react";
import { staffApi, type DutyWeekDto, type AutoPlanDto } from "../services/staffApi";
import type { DutyAssignment, DutyType, DutyWeekInfo, AutoAssignmentPreview } from "../types/staffDashboard";

type Notify = (msg: string, type: "success" | "error" | "info") => void;

function toDateStr(d: Date): string { return d.toISOString().slice(0, 10); }
function getCurrentWeekMonday(): string {
  const now = new Date(); const day = now.getDay(); const diff = day === 0 ? -6 : 1 - day;
  const d = new Date(now); d.setDate(d.getDate() + diff); return toDateStr(d);
}

export function useDutyPlannerBackend(notify?: Notify) {
  const [weekStart, setWeekStart] = useState<string>(getCurrentWeekMonday());
  const [week, setWeek] = useState<DutyWeekInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<AutoAssignmentPreview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = useCallback(async (start: string) => {
    try {
      const w: DutyWeekDto = await staffApi.getDutyWeek(start);
      setWeek({
        weekStart: w.weekStart, weekEnd: w.weekEnd, status: (w.status as DutyWeekInfo["status"]) || "Open",
        days: w.days, employees: w.employees,
        assignments: w.assignments.map((x) => ({ ...x, dutyType: x.dutyType as DutyType })) as DutyAssignment[], perEmployee: w.perEmployee,
        saturday: { required: w.saturday.required, assigned: w.saturday.assigned, shortage: w.saturday.shortage, status: w.saturday.status },
        validation: { ok: w.validation.ok, problems: w.validation.problems },
      });
    } catch (e) { notify?.((e as Error)?.message || "Failed to load duty week", "error"); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { let alive = true; Promise.resolve().then(() => { if (alive) return load(weekStart); }).catch(() => {}); return () => { alive = false; }; }, [weekStart, load]);

  const moveWeek = useCallback((dir: -1 | 1) => {
    setWeekStart((prev) => { const d = new Date(prev + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + dir * 7); return d.toISOString().slice(0, 10); });
  }, []);

  const getAssignment = useCallback((empId: number, date: string): DutyAssignment | undefined => {
    return week?.assignments.find((x) => x.employeeId === empId && x.date === date);
  }, [week]);

  const assign = useCallback(async (empId: number, date: string, dutyType: DutyType) => {
    if (!week) return false; if (week.status === "Locked" || week.status === "Submitted") { notify?.("This week cannot be edited.", "error"); return false; }
    const emp = week.employees.find((e) => e.id === empId);
    setBusy(true);
    try {
      await staffApi.assign({ employeeId: empId, employeeName: emp?.name, department: emp?.department, role: emp?.role, dutyType, date });
      await load(weekStart); notify?.("Duty assignment saved.", "success"); return true;
    } catch (e) { notify?.((e as Error)?.message || "Assignment rejected", "error"); return false; }
    finally { setBusy(false); }
  }, [week, weekStart, load, notify]);

  const validate = useCallback(async () => { if (!week) return; notify?.(week.validation.ok ? week.validation.problems.length + " problems" : (week.validation.problems.join(" | ")), week.validation.ok ? "info" : "error"); }, [week, notify]);

  const autoAssign = useCallback(async () => {
    if (!week) return; if (week.status === "Locked" || week.status === "Submitted") { notify?.("Locked/submitted week cannot be auto-assigned.", "error"); return; }
    setBusy(true);
    try { const p: AutoPlanDto = await staffApi.autoAssignPreview(weekStart); setPreview({ employeesAffected: p.employeesAffected, delivery: p.delivery, repair: p.repair, office: p.office, collection: p.collection, weeklyOff: p.weeklyOff, saturdayRequired: p.saturdayRequired, saturdayAssigned: p.saturdayAssigned, saturdayShortage: p.saturdayShortage, conflicts: p.conflicts, rows: p.rows.map((r) => ({ ...r, dutyType: r.dutyType as DutyType })) }); setPreviewOpen(true); }
    catch (e) { notify?.((e as Error)?.message || "Auto-assign preview failed", "error"); } finally { setBusy(false); }
  }, [week, weekStart, notify]);

  const applyPreview = useCallback(async () => {
    setBusy(true);
    try { await staffApi.autoAssignApply(weekStart, preview as unknown as AutoPlanDto); await load(weekStart); setPreviewOpen(false); notify?.("Assignment plan applied.", "success"); }
    catch (e) { notify?.((e as Error)?.message || "Apply failed", "error"); } finally { setBusy(false); }
  }, [weekStart, preview, load, notify]);

  const submit = useCallback(async () => {
    if (!week) return; setBusy(true);
    try { await staffApi.submitWeek(weekStart); await load(weekStart); notify?.("Week submitted.", "success"); }
    catch (e) { notify?.((e as Error)?.message || "Submit failed", "error"); } finally { setBusy(false); }
  }, [weekStart, week, load, notify]);

  return { week, loading, busy, weekStart, moveWeek, getAssignment, assign, validate, autoAssign, preview, previewOpen, setPreviewOpen, applyPreview, submit, reload: () => load(weekStart) };
}
