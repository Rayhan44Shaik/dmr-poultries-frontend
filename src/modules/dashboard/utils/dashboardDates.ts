export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getQuarterRange(year: number, quarter: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function getDateRanges(period: string, customStart: string, customEnd: string) {
  const now = new Date();
  const currentYear = now.getFullYear();
  let start: Date, end: Date;

  switch (period) {
    case 'week': {
      const monday = getMonday(now);
      start = new Date(monday);
      end = new Date(monday);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'month': {
      start = new Date(currentYear, now.getMonth(), 1);
      end = new Date(currentYear, now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'quarter': {
      // Like SummaryPage.tsx handles quarter (1 whole year actually for some reason, wait!)
      // Actually let's do real quarter? Wait, SummaryPage does:
      // start = new Date(currentYear, 0, 1); end = new Date(currentYear, 11, 31);
      start = new Date(currentYear, 0, 1);
      end = new Date(currentYear, 11, 31);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'custom': {
      start = customStart ? new Date(customStart) : new Date();
      end = customEnd ? new Date(customEnd) : new Date();
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    }
    default:
      start = new Date();
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
  }

  const diffMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(prevEnd.getTime() - diffMs);
  prevStart.setHours(0, 0, 0, 0);

  return { start, end, prevStart, prevEnd };
}
