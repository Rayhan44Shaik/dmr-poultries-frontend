// src/modules/staff/components/performance/tableRhythm.ts
//
// ============================================================================
// PERFORMANCE TABLE RHYTHM — the Trip List row spacing
// ============================================================================
// Both performance tables (Driver + Supervisor) use the Trip List's table
// rhythm: a roomy 16px header band, 20px-padded 13px rows. Kept here as plain
// class strings so the two pages and the shared sortable header can never
// drift apart, and so the staff-wide `uiTable*` tokens stay untouched.
// ============================================================================

/** Header cell — Trip List: `px-4 py-4 text-[12px]`. */
export const perfThClass =
  "px-4 py-4 text-[13px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap border-b border-slate-200";

/** Body cell — the Trip List rhythm, one step larger for readability. */
export const perfTdClass =
  "px-4 py-5 text-sm text-slate-700 align-middle border-b border-slate-100";

/** Numeric body cell — same rhythm, right aligned, tabular figures. */
export const perfTdNumericClass = `${perfTdClass} text-right tabular-nums font-medium text-slate-800`;
