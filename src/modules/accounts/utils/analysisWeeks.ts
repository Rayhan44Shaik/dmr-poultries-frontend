import { getMonday, getSunday, type PeriodRange } from './periodRanges';

/** Complete local calendar weeks, clipped to the selected range. */
export function analysisWeeks(start: Date, end: Date): PeriodRange[] {
  const ranges: PeriodRange[] = [];
  let cursor = getMonday(start);
  while (cursor <= end) {
    const weekEnd = getSunday(cursor);
    ranges.push({
      start: new Date(Math.max(cursor.getTime(), start.getTime())),
      end: new Date(Math.min(weekEnd.getTime(), end.getTime())),
    });
    cursor = new Date(weekEnd);
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }
  return ranges;
}
