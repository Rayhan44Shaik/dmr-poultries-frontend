import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDutyReport, countDutyCells, dutyDisplayName, filterDutyEmployees, formatDutyDate, getDutyLabel,
  getDutyRangeError, getDutyReportDays, getDutyReportWeekStarts, loadDutyReportLeaves,
  loadDutyReportRange, summarizeDutyReport,
} from './dutyReport';
import { TEST_EMPLOYEES, testAssignment, testLeave, testWeek } from '../../../../tests/duty-planner/fixtures';

const range = { fromDate: '2026-09-01', toDate: '2026-09-09' };
const asOf = '2026-09-07';

function countFixture() {
  const types = ['Delivery', 'Rest', 'Off', 'WeeklyOff', 'Repair', 'OfficeDuty', 'Farm visit — విజయవాడ', 'Delivery', 'Rest'];
  const assignments = [
    ...getDutyReportDays(range).map(({ date }, i) => testAssignment(1, date, types[i])),
    testAssignment(2, '2026-09-02', 'Delivery'),
    testAssignment(1, '2026-08-31', 'Delivery'), // outside the range
    testAssignment(1, '2026-09-10', 'Delivery'), // outside the range
  ];
  const leaves = [
    testLeave(2, '2026-08-31', '2026-09-02'), // overlaps the start boundary
    testLeave(2, '2026-09-01', '2026-09-02'), // overlap must not double count
    testLeave(2, '2026-09-03', '2026-09-03', 'Pending'),
    testLeave(2, '2026-09-04', '2026-09-04', 'Rejected'),
  ];
  return buildDutyReport(range, [testWeek('2026-08-31', { assignments })], leaves);
}

describe('Duty Planner report date ranges', () => {
  it('includes both boundaries across months and years, with full dates', () => {
    const days = getDutyReportDays({ fromDate: '2025-12-30', toDate: '2026-01-03' });
    assert.deepEqual(days.map((d) => d.date), ['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03']);
    assert.deepEqual(days.map((d) => d.weekday), ['Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    assert.equal(formatDutyDate('2026-01-01'), '01 Jan 2026');
  });

  it('includes leap day and supports a single-day range', () => {
    assert.deepEqual(getDutyReportDays({ fromDate: '2024-02-28', toDate: '2024-03-01' }).map((d) => d.date), ['2024-02-28', '2024-02-29', '2024-03-01']);
    assert.equal(getDutyReportDays({ fromDate: asOf, toDate: asOf }).length, 1);
  });

  it('does not shift or skip calendar dates over DST boundaries', () => {
    assert.deepEqual(getDutyReportDays({ fromDate: '2026-03-07', toDate: '2026-03-10' }).map((d) => d.date), ['2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10']);
    assert.deepEqual(getDutyReportDays({ fromDate: '2026-10-31', toDate: '2026-11-02' }).map((d) => d.date), ['2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('allows ranges longer than a year instead of silently truncating them', () => {
    assert.equal(getDutyReportDays({ fromDate: '2024-01-01', toDate: '2025-12-31' }).length, 731);
  });

  it('rejects missing, invalid, reversed and Excel-oversized ranges', () => {
    assert.match(getDutyRangeError({ fromDate: '', toDate: asOf })!, /both/);
    for (const bad of ['2026-02-29', '2026-13-01', '2026-04-31', '01/09/2026', 'not a date']) {
      assert.match(getDutyRangeError({ fromDate: bad, toDate: asOf })!, /valid/);
    }
    assert.match(getDutyRangeError({ fromDate: '2026-09-08', toDate: asOf })!, /on or after/);
    assert.match(getDutyRangeError({ fromDate: '1900-01-01', toDate: '2026-09-07' })!, /Excel column limit/);
    assert.throws(() => getDutyReportDays({ fromDate: asOf, toDate: '2026-09-06' }));
  });

  it('requests unique Monday-anchored weeks, including Sunday and boundary days', () => {
    assert.deepEqual(getDutyReportWeekStarts({ fromDate: '2026-09-06', toDate: '2026-09-06' }), ['2026-08-31']);
    assert.deepEqual(getDutyReportWeekStarts({ fromDate: '2026-08-31', toDate: '2026-09-14' }), ['2026-08-31', '2026-09-07', '2026-09-14']);
    assert.deepEqual(getDutyReportWeekStarts({ fromDate: '2025-12-30', toDate: '2026-01-05' }), ['2025-12-29', '2026-01-05']);
  });
});

describe('Duty Planner cells, filters and totals', () => {
  it('counts each completed date once, with duty count separate from leave/off/weekly off', () => {
    const data = countFixture();
    assert.deepEqual(countDutyCells(data.byEmployee[1], asOf), { duty: 4, leave: 1, off: 1, weeklyOff: 1, noEntry: 0, future: 2 });
    assert.equal(data.byEmployee[1].length, 9);
    assert.equal(data.byEmployee[1][0].date, range.fromDate);
    assert.equal(data.byEmployee[1][data.byEmployee[1].length - 1].date, range.toDate);
  });

  it('uses only approved leave, deduplicates overlapping leave and lets approved leave override an assignment', () => {
    const data = countFixture();
    assert.equal(data.byEmployee[2][0].dutyType, 'Rest');
    assert.equal(data.byEmployee[2][0].assignedDutyType, null);
    assert.equal(data.byEmployee[2][1].dutyType, 'Rest');
    assert.equal(data.byEmployee[2][1].assignedDutyType, 'Delivery');
    assert.equal(data.byEmployee[2][1].isLeave, true);
    assert.equal(data.byEmployee[2][2].dutyType, null); // pending
    assert.equal(data.byEmployee[2][3].dutyType, null); // rejected
    assert.deepEqual(countDutyCells(data.byEmployee[2], asOf), { duty: 0, leave: 2, off: 0, weeklyOff: 0, noEntry: 5, future: 2 });
  });

  it('retains full custom labels, future plans and source vehicle information', () => {
    const data = countFixture();
    assert.equal(getDutyLabel(data.byEmployee[1][6].dutyType), 'Farm visit — విజయవాడ');
    assert.equal(data.byEmployee[1][7].dutyType, 'Delivery');
    assert.equal(data.byEmployee[1][0].vehicleNo, 'AP 16 AB 1234');
    assert.equal(getDutyLabel('__proto__'), '__proto__');
    assert.equal(getDutyLabel('constructor'), 'constructor');
  });

  it('keeps employees with no entries, with zero duties rather than dropping their rows', () => {
    const data = countFixture();
    assert.deepEqual(countDutyCells(data.byEmployee[4], asOf), { duty: 0, leave: 0, off: 0, weeklyOff: 0, noEntry: 7, future: 2 });
    assert.equal(data.employees.length, 4);
  });

  it('sums per-employee, daily and grand totals consistently', () => {
    const data = countFixture();
    const summary = summarizeDutyReport(data, data.employees, asOf);
    assert.deepEqual(summary.totals, { duty: 10, leave: 3, off: 1, weeklyOff: 2, noEntry: 12, future: 8 });
    assert.equal(Object.values(summary.dailyDuty).reduce((a, b) => a + b, 0), summary.totals.duty);
    assert.equal(summary.dailyDuty['2026-09-08'], 0);
    assert.equal(summary.dailyDuty['2026-09-02'], 1);
  });

  it('reconciles totals with selected roles and a trimmed, case-insensitive name search', () => {
    const data = countFixture();
    const selected = filterDutyEmployees(data.employees, ['Driver'], '  RAVI  ');
    assert.deepEqual(selected.map((e) => e.id), [1]);
    assert.equal(summarizeDutyReport(data, selected, asOf).totals.duty, 4);
    assert.equal(filterDutyEmployees(data.employees, [], '').length, 4);
    assert.equal(filterDutyEmployees(data.employees, ['Helper'], 'Ravi').length, 0);
  });

  it('matches English search even though the page displays the Telugu name, and vice versa', () => {
    const data = countFixture();
    // English query still finds employees while names render in Telugu.
    assert.deepEqual(filterDutyEmployees(data.employees, [], 'ravi ku').map((e) => e.id), [1]);
    assert.deepEqual(filterDutyEmployees(data.employees, [], 'MOHAN').map((e) => e.id), [4]);
    // Telugu query matches the Telugu name.
    assert.deepEqual(filterDutyEmployees(data.employees, [], 'రవి').map((e) => e.id), [1]);
    assert.deepEqual(filterDutyEmployees(data.employees, [], 'కుమార్').map((e) => e.id), [1]);
    // Queries that match nothing in either language return an empty list.
    assert.equal(filterDutyEmployees(data.employees, [], 'zzz').length, 0);
    assert.equal(filterDutyEmployees(data.employees, [], 'లేనిపేరు').length, 0);
    // Display: Telugu name when the language is Telugu and one exists,
    // English otherwise (English language or missing Telugu name).
    assert.equal(dutyDisplayName(data.employees[0], 'en'), 'Ravi Kumar');
    assert.equal(dutyDisplayName(data.employees[0], 'te'), 'రవి కుమార్');
    assert.equal(dutyDisplayName({ employeeName: 'Legacy Name' }, 'te'), 'Legacy Name');
  });

  it('keeps historical employees absent from the current roster and avoids duplicate IDs', () => {
    const historical = { ...testAssignment(1, '2026-09-01', 'Delivery'), employeeId: 99, employeeName: 'Former Driver' };
    const data = buildDutyReport(range, [
      testWeek('2026-08-31', { employees: TEST_EMPLOYEES.slice(0, 1), assignments: [historical] }),
      testWeek('2026-09-07', { employees: TEST_EMPLOYEES, assignments: [] }),
    ]);
    assert.equal(data.employees.length, 5);
    assert.equal(data.employees.filter((e) => e.id === 1).length, 1);
    assert.equal(data.employees.find((e) => e.id === 99)?.employeeNo, undefined);
    assert.equal(countDutyCells(data.byEmployee[99], asOf).duty, 1);
  });

  it('counts no future days, even when every day has a planned assignment', () => {
    const data = countFixture();
    assert.deepEqual(countDutyCells(data.byEmployee[1], '2026-08-31'), { duty: 0, leave: 0, off: 0, weeklyOff: 0, noEntry: 0, future: 9 });
  });
});

describe('Duty Planner range loading', () => {
  it('loads each week once with a bounded request count and marks sample reports explicitly', async () => {
    const selected = { fromDate: '2025-12-30', toDate: '2026-03-02' };
    const calls: string[] = [];
    let concurrent = 0;
    let peak = 0;
    const data = await loadDutyReportRange(selected, {
      usingSampleData: true,
      loadLeaves: async () => [],
      loadWeek: async (monday) => {
        calls.push(monday);
        concurrent += 1;
        peak = Math.max(peak, concurrent);
        await Promise.resolve();
        concurrent -= 1;
        return testWeek(monday);
      },
    });
    assert.deepEqual(calls, getDutyReportWeekStarts(selected));
    assert.ok(peak <= 4);
    assert.equal(data.usingSampleData, true);
    assert.equal(data.days[0].date, selected.fromDate);
    assert.equal(data.days[data.days.length - 1].date, selected.toDate);
  });

  it('fails the whole report on a failed or mismatched week, rather than exporting partial/sample data', async () => {
    await assert.rejects(loadDutyReportRange(range, {
      usingSampleData: false, loadLeaves: async () => [],
      loadWeek: async (monday) => {
        if (monday === '2026-09-07') throw new Error('API unavailable');
        return testWeek(monday);
      },
    }), /API unavailable/);
    await assert.rejects(loadDutyReportRange(range, {
      usingSampleData: false, loadLeaves: async () => [],
      loadWeek: async () => testWeek('2026-09-14'),
    }), /Could not load duties/);
  });

  it('stops further week batches when a user changes the selected range', async () => {
    const controller = new AbortController();
    let requests = 0;
    await assert.rejects(loadDutyReportRange({ fromDate: '2026-01-01', toDate: '2026-09-30' }, {
      usingSampleData: false, loadLeaves: async () => [],
      loadWeek: async (monday) => {
        requests += 1;
        controller.abort();
        return testWeek(monday);
      },
    }, controller.signal), { name: 'AbortError' });
    assert.equal(requests, 4);
  });

  it('includes every page of approved leaves for the selected inclusive range', async () => {
    const calls: number[] = [];
    const leaves = await loadDutyReportLeaves(range, async (filters) => {
      assert.equal(filters.status, 'Approved');
      assert.equal(filters.fromDate, range.fromDate);
      assert.equal(filters.toDate, range.toDate);
      calls.push(filters.page!);
      return { items: [testLeave(filters.page!, '2026-09-01')], total: 3, page: filters.page!, limit: 1, totalPages: 3 };
    });
    assert.deepEqual(calls, [1, 2, 3]);
    assert.equal(leaves.length, 3);
  });

  it('does not hide failures in leave loading', async () => {
    await assert.rejects(loadDutyReportRange(range, {
      usingSampleData: false, loadWeek: async (monday) => testWeek(monday),
      loadLeaves: async () => { throw new Error('Leave API failed'); },
    }), /Leave API failed/);
  });
});
