// utils/maintenanceHelpers.ts

// ============================================================
// EDIT / DELETE ELIGIBILITY (10‑day rule)
// ============================================================
export const isEditable = (createdAt?: string): boolean => {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 10;
};

export const canEditItem = isEditable; // alias for consistency

// ============================================================
// SAFE DATE PARSING
// ============================================================
export const safeDate = (value?: string | number): Date => {
  if (!value) return new Date();
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
};

// ============================================================
// BILL NUMBERS — SERVER-ALLOCATED ONLY
// ============================================================
//
// Bill numbers (MNT-YYYYMMDD-NNNN) are allocated atomically by the backend.
// A retired per-device counter lived here; it is intentionally removed:
// device-local counters duplicate across tabs/devices and disagree with the
// server sequence, so the frontend must never mint bill numbers.