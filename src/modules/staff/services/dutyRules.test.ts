import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildDutyReport, countDutyCells } from './dutyReport';
import { AutomaticDutySyncError, getAutomaticDuty, getAutomaticDutyWrites, getCoreDutyRole, hasApprovedDutyLeave, resolveDutyCell, syncAutomaticDuties } from './dutyRules';
import { dutyEnglish, dutyTelugu, dutyTranslator } from '../i18n/dutyPlannerCopy';
import type { Employee } from '../types/staffDashboard';
import { TEST_EMPLOYEES, testAssignment, testLeave, testWeek } from '../../../../tests/duty-planner/fixtures';

const office = TEST_EMPLOYEES[2];
const collector: Employee = { ...office, id: 5, employeeNo: 105, employeeName: 'Collection Test', role: 'Collector', department: 'Collection' };
const start = '2026-09-07';

describe('Duty Planner automatic duties and approved leave', () => {
  it('never auto-assigns Supervisor, Driver, Helper or Loader, including localized/case variants', () => {
    for (const role of ['Supervisor', ' DRIVER ', 'Helper', 'Loader', 'Senior Supervisor', 'Driver/Helper', 'సూపర్‌వైజర్', 'డ్రైవర్', 'సహాయకుడు', 'లోడర్']) {
      assert.ok(getCoreDutyRole(role), role);
      assert.equal(getAutomaticDuty({ ...office, role }, start), null, role);
      assert.equal(getAutomaticDuty({ ...office, role }, '2026-09-13'), null, role);
    }
  });
  it('uses Office Monday–Saturday and Weekly Off on Sunday for other staff', () => {
    for (const date of ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12']) assert.equal(getAutomaticDuty(office, date), 'Office');
    assert.equal(getAutomaticDuty(office, '2026-09-13'), 'WeeklyOff');
    assert.equal(getAutomaticDuty(office, '2026-09-06'), 'WeeklyOff');
  });
  it('uses Collection for collector roles/departments, including Telugu, but still gives Sunday off', () => {
    for (const employee of [collector, { ...office, department: 'Collections' }, { ...office, role: 'Collection Executive' }, { ...office, role: 'వసూలుదారు' }]) {
      assert.equal(getAutomaticDuty(employee, start), 'Collection');
      assert.equal(getAutomaticDuty(employee, '2026-09-13'), 'WeeklyOff');
    }
    assert.equal(getAutomaticDuty({ ...collector, role: 'Driver' }, start), null);
  });
  it('does not invent defaults for inactive/suspended staff, pre-joining days or orphan history', () => {
    assert.equal(getAutomaticDuty({ ...office, status: 'Inactive' }, start), null);
    assert.equal(getAutomaticDuty({ ...office, status: 'Suspended' }, start), null);
    assert.equal(getAutomaticDuty({ ...office, joiningDate: '2026-09-08' }, start), null);
    assert.equal(getAutomaticDuty({ id: 99, employeeName: 'Former employee', role: 'Accountant', department: 'Accounts' }, start), null);
  });
  it('approved leave overrides both saved duties and automatic Office/Collection/Sunday off', () => {
    assert.equal(resolveDutyCell(office, start, undefined, true).dutyType, 'Rest');
    assert.equal(resolveDutyCell(collector, start, undefined, true).dutyType, 'Rest');
    assert.equal(resolveDutyCell(collector, '2026-09-13', undefined, true).dutyType, 'Rest');
    const saved = testAssignment(1, start, 'Delivery');
    const cell = resolveDutyCell(TEST_EMPLOYEES[0], start, saved, true);
    assert.equal(cell.dutyType, 'Rest');
    assert.equal(cell.assignedDutyType, 'Delivery'); // original record is not deleted
    assert.equal(countDutyCells([cell], start).duty, 0);
    assert.equal(countDutyCells([cell], start).leave, 1);
  });
  it('ignores pending/rejected leave and restores the underlying duty when approval no longer applies', () => {
    for (const status of ['Pending', 'Rejected'] as const) {
      assert.equal(hasApprovedDutyLeave([testLeave(3, start, start, status)], office.id, start), false);
      assert.equal(resolveDutyCell(office, start, undefined, false).dutyType, 'Office');
    }
    assert.equal(hasApprovedDutyLeave([testLeave(3, `${start}T00:00:00Z`, `${start}T00:00:00Z`)], office.id, start), true);
  });
  it('never proposes invalid dates or days outside the requested week', () => {
    assert.equal(getAutomaticDuty(office, '2026-02-30'), null);
    const week = testWeek(start, { employees: [office], assignments: [], days: [{ date: '2026-09-06', weekday: 'Sun' }, { date: '2026-09-14', weekday: 'Mon' }] });
    assert.deepEqual(getAutomaticDutyWrites(week, [], '2026-09-30'), []);
  });
  it('keeps explicit exceptions instead of overwriting a saved duty with a default', () => {
    const explicit = testAssignment(3, start, 'Off');
    assert.equal(resolveDutyCell(office, start, explicit, false).dutyType, 'Off');
    assert.equal(resolveDutyCell(office, start, explicit, false).automatic, false);
  });
  it('uses each weekly roster for defaults instead of applying a later role to earlier dates', () => {
    const data = buildDutyReport({ fromDate: '2026-09-01', toDate: '2026-09-13' }, [
      testWeek('2026-08-31', { employees: [{ ...office, role: 'Driver' }], assignments: [] }),
      testWeek(start, { employees: [office], assignments: [] }),
    ]);
    assert.equal(data.byEmployee[office.id][0].dutyType, null);
    assert.equal(data.byEmployee[office.id][6].dutyType, 'Office');
    assert.equal(countDutyCells(data.byEmployee[office.id], '2026-09-13').duty, 6);
  });
  it('applies the same automatic calendar/counts to a cross-month report', () => {
    const range = { fromDate: '2026-08-31', toDate: '2026-09-07' };
    const data = buildDutyReport(range, [testWeek('2026-08-31', { employees: [office, collector], assignments: [] })]);
    assert.equal(data.byEmployee[office.id][6].dutyType, 'WeeklyOff');
    assert.equal(data.byEmployee[collector.id][0].dutyType, 'Collection');
    assert.equal(countDutyCells(data.byEmployee[office.id], '2026-09-07').duty, 7);
    assert.equal(countDutyCells(data.byEmployee[collector.id], '2026-09-05').future, 2);
  });
});

describe('Safe persistence of automatic defaults', () => {
  it('writes only missing, due, non-crew entries and skips approved leave', async () => {
    let week = testWeek(start, { employees: [TEST_EMPLOYEES[0], office, collector], assignments: [testAssignment(1, start, 'Delivery')] });
    const leaves = [testLeave(3, '2026-09-08')];
    const writes: string[] = [];
    const result = await syncAutomaticDuties(week, leaves, '2026-09-09', async (input) => {
      writes.push(`${input.employeeId}|${input.date}|${input.dutyType}`);
      const employee = week.employees.find((item) => item.id === input.employeeId)!;
      week = { ...week, assignments: [...week.assignments, { id: `${input.employeeId}-${input.date}`, employeeId: input.employeeId, employeeName: employee.employeeName, department: employee.department, role: employee.role, date: input.date, dutyType: input.dutyType }] };
      return week;
    });
    assert.deepEqual(writes, ['3|2026-09-07|Office', '3|2026-09-09|Office', '5|2026-09-07|Collection', '5|2026-09-08|Collection', '5|2026-09-09|Collection']);
    assert.equal(result.assignments.length, 6);
    assert.equal(getAutomaticDutyWrites(result, leaves, '2026-09-09').length, 0);
  });
  it('saves Sunday as WeeklyOff', async () => {
    const week = testWeek(start, { employees: [office], assignments: [], days: [{ date: '2026-09-13', weekday: 'Sun' }] });
    const result = await syncAutomaticDuties(week, [], '2026-09-13', async (input) => {
      assert.equal(input.dutyType, 'WeeklyOff');
      return { ...week, assignments: [testAssignment(3, input.date, input.dutyType)] };
    });
    assert.equal(result.assignments[0].dutyType, 'WeeklyOff');
  });
  it('does not overwrite an assignment that arrives in a newer API snapshot', async () => {
    const week = testWeek(start, { employees: [office], assignments: [] });
    let calls = 0;
    const result = await syncAutomaticDuties(week, [], '2026-09-08', async (input) => {
      calls += 1;
      return { ...week, assignments: [testAssignment(3, input.date, 'Office'), testAssignment(3, '2026-09-08', 'Off')] };
    });
    assert.equal(calls, 1);
    assert.equal(result.assignments[1].dutyType, 'Off');
  });
  it('stops at closed/locked/submitted weeks without making writes', async () => {
    for (const status of ['Closed', 'Locked', 'Submitted']) {
      let calls = 0;
      const week = testWeek(start, { employees: [office], assignments: [], status });
      await syncAutomaticDuties(week, [], start, async () => { calls += 1; return week; });
      assert.equal(calls, 0);
    }
  });
  it('preserves the latest saved snapshot on failure and does not claim an unsaved default succeeded', async () => {
    const week = testWeek(start, { employees: [office], assignments: [] });
    let calls = 0;
    await assert.rejects(syncAutomaticDuties(week, [], '2026-09-08', async (input) => {
      if (++calls === 2) throw new Error('API unavailable');
      return { ...week, assignments: [testAssignment(3, input.date, 'Office')] };
    }), (error: unknown) => error instanceof AutomaticDutySyncError && error.week.assignments.length === 1);
    await assert.rejects(syncAutomaticDuties(week, [], start, async () => week), AutomaticDutySyncError);
  });
  it('cancels remaining writes when the selected week changes', async () => {
    const controller = new AbortController();
    const week = testWeek(start, { employees: [office], assignments: [] });
    let calls = 0;
    await assert.rejects(syncAutomaticDuties(week, [], '2026-09-08', async (input) => {
      calls += 1;
      controller.abort();
      return { ...week, assignments: [testAssignment(3, input.date, 'Office')] };
    }, controller.signal), { name: 'AbortError' });
    assert.equal(calls, 1);
  });
  it('has complete Telugu copy with stable interpolation and untranslated backend values', () => {
    assert.deepEqual(Object.keys(dutyTelugu), Object.keys(dutyEnglish));
    assert.equal(dutyTranslator('te')('selectedCount', { count: 4 }), '4 ఎంపిక');
    for (const value of Object.values(dutyTelugu)) assert.ok(value.trim().length > 0);
  });
});
