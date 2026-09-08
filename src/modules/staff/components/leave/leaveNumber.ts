// src/modules/staff/components/leave/leaveNumber.ts
// Generates unique, never-reused leave numbers in the format LEV-YYYYMM-NNN.
// Uses localStorage to persist the counter so numbers are not reused after
// deletion/rejection. The backend assigns its own authoritative id; this
// frontend-only number is a stable display identifier.

const STORAGE_KEY = 'dmr-leave-number-counter';

interface CounterRecord {
  [yearMonth: string]: number; // highest NNN issued for that YYYYMM
}

function loadCounters(): CounterRecord {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: CounterRecord = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function saveCounters(counters: CounterRecord): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(counters));
  } catch {
    /* storage unavailable */
  }
}

/**
 * Generate the next leave number for the given year-month.
 * Monotonically increasing — never reuses a number even after deletion.
 */
export function nextLeaveNumber(yearMonth: string): string {
  const counters = loadCounters();
  const current = counters[yearMonth] || 0;
  const next = current + 1;
  counters[yearMonth] = next;
  saveCounters(counters);
  return `LEV-${yearMonth}-${String(next).padStart(3, '0')}`;
}

/**
 * Ensure a leave record has a leave number. If the backend id is present,
 * we derive a deterministic year-month from the request's creation date
 * and assign the next number only for records that don't already have one
 * in our local cache.
 */
export function getOrAssignLeaveNumber(
  leaveId: string,
  createdAt: string,
  existingMap: Map<string, string>
): string {
  // If we already assigned a number to this leave id, reuse it.
  const existing = existingMap.get(leaveId);
  if (existing) return existing;

  // Derive year-month from createdAt (YYYY-MM-DD → YYYYMM)
  const ym = (createdAt || '').slice(0, 7).replace('-', '');
  const yearMonth = ym.length === 6 ? ym : new Date().toISOString().slice(0, 7).replace('-', '');
  return nextLeaveNumber(yearMonth);
}

/**
 * Build a stable id→leaveNumber map from localStorage.
 * Used to rehydrate assigned numbers so they persist across sessions.
 */
export function loadLeaveNumberMap(): Map<string, string> {
  try {
    const raw = window.localStorage.getItem('dmr-leave-number-map');
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return new Map();
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

export function saveLeaveNumberMap(map: Map<string, string>): void {
  try {
    const obj: Record<string, string> = {};
    map.forEach((v, k) => { obj[k] = v; });
    window.localStorage.setItem('dmr-leave-number-map', JSON.stringify(obj));
  } catch {
    /* storage unavailable */
  }
}
