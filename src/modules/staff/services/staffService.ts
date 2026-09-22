// src/modules/staff/services/staffService.ts
//
// Staff shared UI helpers — pure shift/picker configuration only.
// All business data is PostgreSQL/API backed (duty planner, leave, salary,
// performance and employee master APIs). This module performs no browser
// storage reads or writes and holds no business records.

import type { ShiftConfig } from '../types/staffDashboard';

export function getShiftConfigs(): ShiftConfig[] {
  return [
    { type: 'Driver', label: 'Driver', bgColor: 'bg-blue-100', textColor: 'text-blue-700', borderColor: 'border-blue-300' },
    { type: 'Delivery', label: 'Duty', bgColor: 'bg-green-100', textColor: 'text-green-700', borderColor: 'border-green-300' },
    { type: 'Rest', label: 'Leave', bgColor: 'bg-slate-100', textColor: 'text-slate-600', borderColor: 'border-slate-300' },
    { type: 'Repair', label: 'Repair', bgColor: 'bg-amber-100', textColor: 'text-amber-700', borderColor: 'border-amber-300' },
    { type: 'Office', label: 'Office', bgColor: 'bg-indigo-100', textColor: 'text-indigo-700', borderColor: 'border-indigo-300' },
    { type: 'OfficeDuty', label: 'Office Duty', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600', borderColor: 'border-indigo-200' },
    { type: 'Collection', label: 'Collection', bgColor: 'bg-teal-100', textColor: 'text-teal-700', borderColor: 'border-teal-300' },
    { type: 'WeeklyOff', label: 'Weekly Off', bgColor: 'bg-rose-100', textColor: 'text-rose-700', borderColor: 'border-rose-300' },
    { type: 'Off', label: 'Off', bgColor: 'bg-purple-100', textColor: 'text-purple-700', borderColor: 'border-purple-300' },
  ];
}

/**
 * Which shift types are offered in the picker, per employee role.
 * - Supervisor: Duty, Office, Leave, Weekly Off, Off
 * - Driver / Helper / Loader: Duty, Repair, Office, Leave, Weekly Off, Off
 *   (a delivery trip that runs into the next day is simply Duty on each
 *    day the driver is out — 1 or 2 days; no separate trip states)
 *   "Off" is a one-off day off — separate from the regular Weekly Off.
 * - Any other/unknown role: Weekly Off only.
 * ("Other" — free text — is added by the picker itself, for every role.)
 */
const ROLE_SHIFT_TYPES: Record<string, ShiftConfig['type'][]> = {
  Supervisor: ['Delivery', 'Office', 'Rest', 'WeeklyOff', 'Off'],
  Driver: ['Delivery', 'Repair', 'Office', 'Rest', 'WeeklyOff', 'Off'],
  Helper: ['Delivery', 'Repair', 'Office', 'Rest', 'WeeklyOff', 'Off'],
  Loader: ['Delivery', 'Repair', 'Office', 'Rest', 'WeeklyOff', 'Off'],
};

export function getShiftConfigsForRole(role?: string): ShiftConfig[] {
  const all = getShiftConfigs();
  if (!role) return all;
  const key = role.trim();
  const wanted = ROLE_SHIFT_TYPES[key];
  if (!wanted) return all.filter((s) => s.type === 'WeeklyOff');
  // Order the picker exactly as the role list declares it.
  const picked = wanted
    .map((t) => all.find((s) => s.type === t))
    .filter((s): s is ShiftConfig => Boolean(s));
  // Colour swap for the core crew roles: Weekly Off ↔ Off exchange colours
  // (Weekly Off → soft purple, Off → rose). Every other role keeps Weekly
  // Off in its original rose colour.
  return picked.map((s) => {
    if (s.type === 'WeeklyOff')
      return { ...s, bgColor: 'bg-purple-100', textColor: 'text-purple-700', borderColor: 'border-purple-300' };
    if (s.type === 'Off')
      return { ...s, bgColor: 'bg-rose-100', textColor: 'text-rose-700', borderColor: 'border-rose-300' };
    return s;
  });
}
