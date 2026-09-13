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
    testAssignment(1, '2025-12-30', 'Delivery'), testAssignment(1, '2025-12-31', 'Rest'),
    testAssignment(1, '2026-01-01', 'WeeklyOff'), testAssignment(1, '2026-01-02', 'Off'),
    testAssignment(1, '2026-01-03', customDuty), testAssignment(2, '2025-12-30', 'Repair'),
    testAssignment(2, '2025-12-31', 'OfficeDuty'), testAssignment(2, '2026-01-01', 'Office'),
    testAssignment(2, '2026-01-02', 'Collection'), testAssignment(2, '2026-01-03', 'Driver'),
  ];
  const data = buildDutyReport(range, [testWeek('2025-12-29', { assignments })], [testLeave(2, '2025-12-30')]);
  return { data, employees: data.employees, asOf, filterLabel: 'All roles', generatedAt: new Date('2026-01-02T10:00:00Z') };
}

describe('Duty Planner Excel workbook', () => {
  it('keeps employee identity left, date columns across and Duty Count last', () => {
    const sheet = buildDutyWorkbook(fixture()).getWorksheet('Duty Planner')!;
    assert.deepEqual((sheet.getRow(6).values as unknown[]).slice(1, 5), ['Employee No.', 'Employee', 'Role', 'Department']);
    assert.equal(sheet.columnCount, 14);
    assert.equal(sheet.getCell('N6').value, 'Duty Count');
    assert.deepEqual((sheet.getRow(6).values as unknown[]).slice(5, 10).map((date) => (date as Date).toISOString().slice(0, 10)), ['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03']);
    assert.deepEqual(['A7', 'B7', 'C7', 'D7'].map((address) => sheet.getCell(address).value), [101, 'Ravi Kumar', 'Driver', 'Fleet']);
    assert.match(String(sheet.getCell('A2').value), /30 Dec 2025 to 03 Jan 2026 \(inclusive\)/);
  });

  it('keeps numeric per-employee counts, but no grand-total row or explanatory legend', () => {
    const workbook = buildDutyWorkbook(fixture());
    const sheet = workbook.getWorksheet('Duty Planner')!;
    assert.deepEqual(['J7', 'K7', 'L7', 'M7', 'N7'].map((address) => sheet.getCell(address).value), [1, 1, 1, 0, 1]);
    assert.deepEqual(['J8', 'K8', 'L8', 'M8', 'N8'].map((address) => sheet.getCell(address).value), [1, 0, 0, 0, 3]);
    assert.equal(sheet.getCell('N9').value, 4); // automatic office duty
    assert.equal(sheet.getCell('N10').value, 0); // core Helper stays manual
    assert.equal(sheet.rowCount, 10);
    const text = JSON.stringify(workbook.worksheets.map((tab) => tab.getSheetValues()));
    assert.doesNotMatch(text, /GRAND TOTAL|TOTAL DUTY|Planned|Legend:|Duty Count includes/i);
  });

  it('exports future cells as empty with dotted borders without deleting stored assignments', () => {
    const input = fixture();
    const workbook = buildDutyWorkbook(input);
    const sheet = workbook.getWorksheet('Duty Planner')!;
    assert.equal(input.data.byEmployee[1][4].assignedDutyType, customDuty);
    assert.equal(sheet.getCell('I7').value, '');
    assert.equal(sheet.getCell('I7').border.bottom?.style, 'dotted');
    assert.equal(sheet.getCell('I7').note, undefined);
    const details = workbook.getWorksheet('Daily Details')!;
    for (const column of ['G', 'H', 'I', 'J', 'K']) assert.equal(details.getCell(`${column}11`).value, '');
    assert.equal(details.getCell('L11').value, 0);
    assert.equal(details.getCell('G11').border.bottom?.style, 'dotted');
  });

  it('makes approved leave override a saved duty and preserves source metadata in details', () => {
    const workbook = buildDutyWorkbook(fixture());
    const sheet = workbook.getWorksheet('Duty Planner')!;
    const details = workbook.getWorksheet('Daily Details')!;
    assert.equal(sheet.getCell('E8').value, 'Leave');
    assert.match(String(sheet.getCell('E8').note), /Approved leave takes precedence/);
    assert.equal(details.getCell('G12').value, 'Leave');
    assert.equal(details.getCell('H12').value, 'Repair');
    assert.equal(details.getCell('J12').value, 'Yes');
    assert.equal(details.getCell('L12').value, 0);
    assert.equal(details.getCell('I7').value, 'AP 16 AB 1234');
    assert.equal(details.getCell('K17').value, 'Automatic');
  });

  it('keeps main-grid counts equal to detail counts without adding a detail total', () => {
    const workbook = buildDutyWorkbook(fixture());
    const sheet = workbook.getWorksheet('Duty Planner')!;
    const details = workbook.getWorksheet('Daily Details')!;
    assert.equal(details.rowCount, 26); // heading + 4 employees × 5 dates
    const mainCount = [7, 8, 9, 10].reduce((sum, row) => sum + Number(sheet.getCell(row, 14).value), 0);
    const detailCount = Array.from({ length: 20 }, (_, i) => Number(details.getCell(i + 7, 12).value)).reduce((a, b) => a + b, 0);
    assert.equal(mainCount, 8);
    assert.equal(detailCount, mainCount);
  });

  it('round-trips a real styled XLSX through two readers with frozen panes and literal date serials', async () => {
    const bytes = await buildDutyWorkbook(fixture()).xlsx.writeBuffer();
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(bytes);
    const sheet = loaded.getWorksheet('Duty Planner')!;
    assert.equal(sheet.getColumn(2).width, 28);
    assert.equal(sheet.getColumn(5).width, 16);
    assert.equal(sheet.views[0].state, 'frozen');
    assert.equal((sheet.views[0] as ExcelJS.WorksheetViewFrozen).xSplit, 4);
    assert.equal((sheet.views[0] as ExcelJS.WorksheetViewFrozen).ySplit, 6);
    assert.equal(sheet.autoFilter, 'A6:N10');
    assert.equal(sheet.getCell('N6').font.bold, true);
    assert.equal(sheet.getCell('E7').alignment.wrapText, true);
    assert.equal(sheet.getCell('I7').border.bottom?.style, 'dotted');
    assert.equal((sheet.getCell('E7').fill as ExcelJS.FillPattern).fgColor?.argb, 'FFDCFCE7');
    assert.equal((sheet.getCell('G7').fill as ExcelJS.FillPattern).fgColor?.argb, 'FFF3E8FF');
    assert.equal((sheet.getCell('H7').fill as ExcelJS.FillPattern).fgColor?.argb, 'FFFFE4E6');
    assert.equal(sheet.getCell('E6').numFmt, 'dd mmm yyyy (ddd)');
    assert.equal(sheet.pageSetup.orientation, 'landscape');
    assert.equal((sheet.getCell('E6').value as Date).toISOString().slice(0, 10), range.fromDate);
    const crossCheck = XLSX.read(bytes, { type: 'buffer', cellDates: false });
    assert.equal(crossCheck.Sheets['Duty Planner'].N7.v, 1);
    assert.equal(crossCheck.Sheets['Duty Planner'].E6.v, 46021);
  });

  it('exports exactly the filtered employees and their individual counts', () => {
    const input = fixture();
    const sheet = buildDutyWorkbook({ ...input, employees: [input.employees[1]], filterLabel: 'Supervisor | Lakshmi' }).getWorksheet('Duty Planner')!;
    assert.equal(sheet.rowCount, 7);
    assert.equal(sheet.getCell('B7').value, 'Lakshmi Devi');
    assert.equal(sheet.getCell('N7').value, 3);
    assert.match(String(sheet.getCell('A4').value), /Supervisor \| Lakshmi/);
  });

  it('supports multi-month ranges past column Z without misaligning the last count', () => {
    const longRange = { fromDate: '2025-12-01', toDate: '2026-01-31' };
    const data = buildDutyReport(longRange, getDutyReportWeekStarts(longRange).map((monday) => testWeek(monday)));
    const sheet = buildDutyWorkbook({ data, employees: [data.employees[0]], asOf: '2026-02-01' }).getWorksheet('Duty Planner')!;
    assert.equal(sheet.columnCount, 4 + 62 + 5);
    assert.equal(sheet.getCell(6, sheet.columnCount).value, 'Duty Count');
    assert.equal((sheet.getCell(6, 66).value as Date).toISOString().slice(0, 10), longRange.toDate);
    assert.equal(sheet.getCell(7, sheet.columnCount).type, ExcelJS.ValueType.Number);
  });

  it('writes full custom duties and formula-like input as safe literal strings', async () => {
    const name = '=HYPERLINK("https://example.invalid", "literal employee")';
    const data = buildDutyReport({ fromDate: asOf, toDate: asOf }, [testWeek('2025-12-29', {
      employees: [{ ...TEST_EMPLOYEES[0], employeeName: name }],
      assignments: [{ ...testAssignment(1, asOf, customDuty), employeeName: name }],
    })]);
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await buildDutyWorkbook({ data, employees: data.employees, asOf }).xlsx.writeBuffer());
    const sheet = loaded.getWorksheet('Duty Planner')!;
    assert.equal(sheet.getCell('B7').value, name);
    assert.equal(sheet.getCell('B7').type, ExcelJS.ValueType.String);
    assert.equal(sheet.getCell('E7').value, customDuty);
    assert.equal(sheet.getCell('E7').type, ExcelJS.ValueType.String);
  });

  it('exports Telugu sheet names, headings, duties, roles and employee names', async () => {
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await buildDutyWorkbook({ ...fixture(), language: 'te' }).xlsx.writeBuffer());
    const sheet = loaded.getWorksheet('డ్యూటీ పట్టిక')!;
    assert.ok(loaded.getWorksheet('రోజువారీ వివరాలు'));
    assert.equal(sheet.getCell('B6').value, 'ఉద్యోగి');
    assert.equal(sheet.getCell('N6').value, 'డ్యూటీ రోజులు');
    // Names follow the page language: Telugu when a transliteration exists.
    assert.equal(sheet.getCell('B7').value, 'రవి కుమార్');
    assert.equal(sheet.getCell('C7').value, 'డ్రైవర్');
    assert.equal(sheet.getCell('F7').value, 'సెలవు');
    assert.equal(sheet.getCell('E9').value, 'ఆఫీస్');
    assert.match(String(sheet.getCell('E6').value), /[\u0c00-\u0c7f]/);
    assert.equal(sheet.getCell('B6').font.name, 'Nirmala UI');
  });

  it('labels sample workbooks and refuses empty or incomplete reports', () => {
    const input = fixture();
    const sheet = buildDutyWorkbook({ ...input, data: { ...input.data, usingSampleData: true } }).getWorksheet('Duty Planner')!;
    assert.match(String(sheet.getCell('A1').value), /^SAMPLE DATA/);
    assert.match(String(sheet.getCell('A3').value), /not live staff records/);
    assert.equal(getDutyExcelFilename(range, true), 'Duty-Planner-2025-12-30-to-2026-01-03-SAMPLE.xlsx');
    assert.throws(() => buildDutyWorkbook({ ...input, employees: [] }), /No employees/);
    assert.throws(() => buildDutyWorkbook({ ...input, data: { ...input.data, days: input.data.days.slice(1) } }), /incomplete/);
    assert.throws(() => buildDutyWorkbook({ ...input, data: { ...input.data, byEmployee: {} } }), /incomplete/);
  });
});
