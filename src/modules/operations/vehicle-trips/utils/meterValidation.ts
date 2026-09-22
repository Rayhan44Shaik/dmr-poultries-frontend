/** English default — UI prefers i18n keys via `t()`. */
export function meterMustBeGreaterThan(min: number): string {
  return `Meter reading must be greater than ${min}.`;
}

/** Every chronological reading must move forward; equal readings are invalid. */
export function isMeterInvalid(value: unknown, previous: number): boolean {
  if (value === "" || value == null) return false;
  const n = Number(value);
  if (!Number.isFinite(n) || previous <= 0) return false;
  return n <= previous;
}

export type DieselMeterSlot = {
  /** 1-based table row index (matches dieselMeterN / S.No slot). */
  row: number;
  /** Display S.No (01, 02…) — usually same order as visible rows. */
  sno: string;
  meter: number;
};

/**
 * Build ordered diesel meter slots from sheet/draft data.
 * Only includes rows with a positive finite meter.
 */
export function collectDieselMeterSlots(
  rowIndices: number[],
  getMeter: (row: number) => unknown,
  displayIndexOf?: (row: number) => number
): DieselMeterSlot[] {
  const sorted = [...rowIndices].sort((a, b) => a - b);
  const out: DieselMeterSlot[] = [];
  sorted.forEach((row, idx) => {
    const raw = getMeter(row);
    if (raw === "" || raw == null) return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    const displayIdx = displayIndexOf ? displayIndexOf(row) : idx;
    out.push({
      row,
      sno: String(displayIdx + 1).padStart(2, "0"),
      meter: n,
    });
  });
  return out;
}

export type MeterChainIssue = {
  /** Row that is too low (or the row being submitted that conflicts with a later bill). */
  row: number;
  sno: string;
  meter: number;
  /** The higher previous reading that blocks this row. */
  prevRow: number;
  prevSno: string;
  prevMeter: number;
  /** true when a later bill is lower than the row being saved. */
  laterThanSubmitted?: boolean;
};

/**
 * Scan the diesel meter chain. Each reading must be greater than the previous
 * (latest destination / earlier bill).
 */
export function findMeterChainIssues(
  slots: DieselMeterSlot[],
  farmDest = 0
): MeterChainIssue[] {
  const issues: MeterChainIssue[] = [];
  let prevMeter = farmDest > 0 ? farmDest : 0;
  let prevRow = 0;
  let prevSno = "Farm";
  for (const slot of slots) {
    if (prevMeter > 0 && slot.meter <= prevMeter) {
      issues.push({
        row: slot.row,
        sno: slot.sno,
        meter: slot.meter,
        prevRow,
        prevSno,
        prevMeter,
      });
    }
    if (slot.meter > prevMeter) {
      prevMeter = slot.meter;
      prevRow = slot.row;
      prevSno = slot.sno;
    }
  }
  return issues;
}

/**
 * When submitting / saving row `submitRow` with `submitMeter`, find later bills
 * whose meter is not greater than this value (they would break a strict chain).
 */
export function findLaterBillsBelow(
  slots: DieselMeterSlot[],
  submitRow: number,
  submitMeter: number
): MeterChainIssue[] {
  if (!Number.isFinite(submitMeter) || submitMeter <= 0) return [];
  const issues: MeterChainIssue[] = [];
  const submit = slots.find((s) => s.row === submitRow);
  const submitSno = submit?.sno || String(submitRow).padStart(2, "0");
  for (const slot of slots) {
    if (slot.row <= submitRow) continue;
    if (slot.meter <= submitMeter) {
      issues.push({
        row: slot.row,
        sno: slot.sno,
        meter: slot.meter,
        prevRow: submitRow,
        prevSno: submitSno,
        prevMeter: submitMeter,
        laterThanSubmitted: true,
      });
    }
  }
  return issues;
}
