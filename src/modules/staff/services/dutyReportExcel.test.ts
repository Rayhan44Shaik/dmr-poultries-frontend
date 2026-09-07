import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { buildDutyWorkbook, getDutyExcelFilename } from './dutyReportExcel';
import { buildDutyReport, getDutyReportWeekStarts } from './dutyReport';
import { TEST_EMPLOYEES, testAssignment, testLeave, testWeek } from '../../../../tests/duty-planner/fixtures';

const range = { fromDate: '2025-12-30', toDate: '2026-01-03' };
const asOf = '2026-01-02';
const customDuty = 'Farm visit — విజయవాడ — complete loading and delivery inspection';

function fixture() {
  const assignments = [
    testAssignment(1, '2025-12-30', 'Delivery'),
    testAssignment(1, '2025-12-31', 'Rest'),
    testAssignment(1, '2026-01-01', 'WeeklyOff'),
    testAssignment(1, '2026-01-02', 'Off'),
    testAssignment(1, '2026-01-03', customDuty),
    testAssignment(2, '2025-12-30', 'Repair'),
    testAssignment(2, '2025-12-31', 'OfficeDuty'),
    testAssignment(2, '2026-01-01', 'Office'),
    testAssignment(2, '2026-01-02', 'Collection'),
    testAssignment(2, '2026-01-03', 'Driver'),
  ];
  const data = buildDutyReport(range, [testWeek('2025-12-29', { assignments })], [testLeave(2, '2025-12-30')]);
  return { data, employees: data.employees, asOf, filterLabel: 'All roles', generatedAt: new Date('2026-01-02T10:00:00Z') };
}

describe('Duty Planner Excel workbook', () => {
  it('places employee identity first, every selected date sideways and Duty Count last', () => {
    const workbook = buildDutyWorkbook(fixture());
    const sheet = workbook.getWorksheet('Duty Planner')!;
    assert.deepEqual((sheet.getRow(7).values as unknown[]).slice(1, 5), ['Employee No.', 'Employee', 'Role', 'Department']);
    assert.equal(sheet.columnCount, 14);
    assert.equal(sheet.getCell('N7').value, 'Duty Count');
    assert.deepEqual((sheet.getRow(7).values as unknown[]).slice(5, 10).map((date) => (date as Date).toISOString().slice(0, 10)), ['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03']);
    assert.equal(sheet.getCell('A8').value, 101);
    assert.equal(sheet.getCell('B8').value, 'Ravi Kumar');
    assert.equal(sheet.getCell('C8').value, 'Driver');
    assert.equal(sheet.getCell('D8').value, 'Fleet');
    assert.match(String(sheet.getCell('A2').value), /30 Dec 2025 to 03 Jan 2026 \(inclusive\)/);
  });

  it('writes numeric per-employee counts and a cached grand total at the bottom/right', () => {
    const sheet = buildDutyWorkbook(fixture()).getWorksheet('Duty Planner')!;
    assert.deepEqual(['J8', 'K8', 'L8', 'M8', 'N8'].map((address) => sheet.getCell(address).value), [1, 1, 1, 0, 1]);
    assert.deepEqual(['J9', 'K9', 'L9', 'M9', 'N9'].map((address) => sheet.getCell(address).value), [0, 0, 0, 0, 4]);
    assert.equal(sheet.getCell('N10').value, 0); // no duties still included
    assert.equal(sheet.getCell('M10').value, 4);
    assert.equal(sheet.getCell('A12').value, 'GRAND TOTAL / DAILY DUTY');
    assert.deepEqual(['E12', 'F12', 'G12', 'H12', 'I12'].map((address) => sheet.getCell(address).value), [2, 1, 1, 1, '']);
    assert.deepEqual(sheet.getCell('N12').value, { formula: 'SUM(N8:N11)', result: 5 });
    assert.equal(sheet.getCell('N8').numFmt, '0');
  });

  it('retains all duty text, planned entries, vehicles and approved-leave overrides', () => {
    const workbook = buildDutyWorkbook(fixture());
    const sheet = workbook.getWorksheet('Duty Planner')!;
    const details = workbook.getWorksheet('Daily Details')!;
    assert.equal(sheet.getCell('I8').value, `${customDuty}\n(Planned)`);
    assert.equal(sheet.getCell('F9').value, 'Office Duty');
    assert.match(String(sheet.getCell('E9').note), /assigned duty takes precedence/);
    assert.equal(details.getCell('H8').value, 'Delivery');
    assert.equal(details.getCell('I8').value, 'AP 16 AB 1234');
    assert.equal(details.getCell('G12').value, customDuty);
    assert.equal(details.getCell('K12').value, 'Planned');
    assert.equal(details.getCell('L12').value, 0);
    assert.equal(details.getCell('J13').value, 'Yes — duty overrides leave');
  });

  it('keeps main-grid totals equal to the daily-detail sum, including no-entry and future rows', () => {
    const workbook = buildDutyWorkbook(fixture());
    const details = workbook.getWorksheet('Daily Details')!;
    assert.equal(details.rowCount, 28); // 7 header rows + 4 employees × 5 dates + total
    const sum = Array.from({ length: 20 }, (_, i) => Number(details.getCell(i + 8, 12).value)).reduce((a, b) => a + b, 0);
    assert.equal(sum, 5);
    assert.deepEqual(details.getCell('L28').value, { formula: 'SUM(L8:L27)', result: sum });
    assert.equal(details.getCell('E8').type, ExcelJS.ValueType.Date);
    assert.equal(details.getCell('E8').numFmt, 'dd mmm yyyy');
  });

  it('persists formatting, readable widths, frozen employee columns, filters and totals in an actual XLSX file', async () => {
    const workbook = buildDutyWorkbook(fixture());
    const bytes = await workbook.xlsx.writeBuffer();
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(bytes);
    assert.deepEqual(loaded.worksheets.map((sheet) => sheet.name), ['Duty Planner', 'Daily Details']);
    const sheet = loaded.getWorksheet('Duty Planner')!;
    assert.equal(sheet.getColumn(2).width, 28);
    assert.equal(sheet.getColumn(5).width, 16);
    assert.equal(sheet.views[0].state, 'frozen');
    assert.equal((sheet.views[0] as ExcelJS.WorksheetViewFrozen).xSplit, 4);
    assert.equal((sheet.views[0] as ExcelJS.WorksheetViewFrozen).ySplit, 7);
    assert.equal(sheet.autoFilter, 'A7:N11');
    assert.equal(sheet.getCell('N7').font.bold, true);
    assert.equal(sheet.getCell('N12').font.bold, true);
    assert.equal(sheet.getCell('E8').alignment.wrapText, true);
    assert.equal((sheet.getCell('E8').fill as ExcelJS.FillPattern).fgColor?.argb, 'FFDCFCE7');
    assert.equal((sheet.getCell('G8').fill as ExcelJS.FillPattern).fgColor?.argb, 'FFF3E8FF');
    assert.equal((sheet.getCell('H8').fill as ExcelJS.FillPattern).fgColor?.argb, 'FFFFE4E6');
    assert.equal(sheet.getCell('I8').font.color?.argb, 'FF94A3B8');
    assert.equal(sheet.getCell('E7').numFmt, 'dd mmm yyyy (ddd)');
    assert.equal(sheet.pageSetup.orientation, 'landscape');
    // Read with an independent XLSX reader as well; this isn't a renamed PDF/CSV.
    assert.equal((sheet.getCell('E7').value as Date).toISOString().slice(0, 10), range.fromDate);
    const crossCheck = XLSX.read(bytes, { type: 'buffer', cellDates: false });
    assert.equal(crossCheck.Sheets['Duty Planner'].N12.v, 5);
    // Spreadsheet dates are timezone-free serials; SheetJS cellDates instead
    // creates a local-midnight Date, whose UTC ISO string can be the day before.
    assert.equal(crossCheck.Sheets['Duty Planner'].E7.v, 46021); // Excel serial for 30 Dec 2025
  });

  it('exports exactly the filtered employees and recomputes their totals', () => {
    const input = fixture();
    const sheet = buildDutyWorkbook({ ...input, employees: [input.employees[1]], filterLabel: 'Supervisor | Lakshmi' }).getWorksheet('Duty Planner')!;
    assert.equal(sheet.getCell('B8').value, 'Lakshmi Devi');
    assert.equal(sheet.getCell('A9').value, 'GRAND TOTAL / DAILY DUTY');
    assert.deepEqual(sheet.getCell('N9').value, { formula: 'SUM(N8:N8)', result: 4 });
    assert.match(String(sheet.getCell('A4').value), /Supervisor \| Lakshmi/);
  });

  it('supports multi-month ranges past column Z without misaligning the count column', () => {
    const longRange = { fromDate: '2025-12-01', toDate: '2026-01-31' };
    const data = buildDutyReport(longRange, getDutyReportWeekStarts(longRange).map((monday) => testWeek(monday)));
    const sheet = buildDutyWorkbook({ data, employees: [data.employees[0]], asOf: '2026-02-01' }).getWorksheet('Duty Planner')!;
    assert.equal(sheet.columnCount, 4 + 62 + 5);
    assert.equal(sheet.getCell(7, sheet.columnCount).value, 'Duty Count');
    assert.equal((sheet.getCell(7, 66).value as Date).toISOString().slice(0, 10), longRange.toDate);
    assert.equal(sheet.getCell(8, sheet.columnCount).type, ExcelJS.ValueType.Number);
  });

  it('writes names and free-text duties as literal strings, not executable formulas', async () => {
    const name = '=HYPERLINK("https://example.invalid", "literal employee")';
    const duty = '=1+1';
    const data = buildDutyReport({ fromDate: asOf, toDate: asOf }, [testWeek('2025-12-29', {
      employees: [{ ...TEST_EMPLOYEES[0], employeeName: name }],
      assignments: [{ ...testAssignment(1, asOf, duty), employeeName: name }],
    })]);
    const workbook = buildDutyWorkbook({ data, employees: data.employees, asOf });
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = loaded.getWorksheet('Duty Planner')!;
    assert.equal(sheet.getCell('B8').value, name);
    assert.equal(sheet.getCell('B8').type, ExcelJS.ValueType.String);
    assert.equal(sheet.getCell('E8').value, duty);
    assert.equal(sheet.getCell('E8').type, ExcelJS.ValueType.String);
  });

  it('clearly distinguishes sample workbooks from live data in both title and filename', () => {
    const input = fixture();
    const sheet = buildDutyWorkbook({ ...input, data: { ...input.data, usingSampleData: true } }).getWorksheet('Duty Planner')!;
    assert.match(String(sheet.getCell('A1').value), /^SAMPLE DATA/);
    assert.match(String(sheet.getCell('A3').value), /not live staff records/);
    assert.equal(getDutyExcelFilename(range), 'Duty-Planner-2025-12-30-to-2026-01-03.xlsx');
    assert.equal(getDutyExcelFilename(range, true), 'Duty-Planner-2025-12-30-to-2026-01-03-SAMPLE.xlsx');
  });

  it('refuses empty or incomplete reports rather than silently dropping employees or dates', () => {
    const input = fixture();
    assert.throws(() => buildDutyWorkbook({ ...input, employees: [] }), /No employees/);
    assert.throws(() => buildDutyWorkbook({ ...input, data: { ...input.data, days: input.data.days.slice(1) } }), /incomplete/);
    assert.throws(() => buildDutyWorkbook({ ...input, data: { ...input.data, byEmployee: {} } }), /incomplete/);
  });
});
