// Loaded on demand by Duty Planner. ExcelJS is used here (not SheetJS CE) so
// colours, borders, wrapping, frozen panes and numeric totals survive in .xlsx.
import ExcelJS from 'exceljs';
import {
  DUTY_COUNT_COLUMNS, formatDutyDate, getDutyCountKey, getDutyLabel,
  getDutyReportDays, summarizeDutyReport, todayStr,
  type DutyReportCell, type DutyReportData, type DutyReportEmployee, type DutyReportRange,
} from './dutyReport';

export interface DutyExcelInput {
  data: DutyReportData;
  employees: DutyReportEmployee[];
  filterLabel?: string;
  asOf?: string;
  generatedAt?: Date;
}

const HEADER_ROW = 7;
const IDENTITY_HEADERS = ['Employee No.', 'Employee', 'Role', 'Department'];
const CORE_ROLES = new Set(['Supervisor', 'Driver', 'Helper', 'Loader']);
const BORDER = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
const fill = (rgb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${rgb}` } });

function dutyTint(cell: DutyReportCell, role: string, asOf: string): { bg: string; text: string } {
  if (cell.date > asOf) return { bg: 'F8FAFC', text: '94A3B8' };
  if (!cell.dutyType) return { bg: 'FFFFFF', text: '94A3B8' };
  if (cell.dutyType === 'WeeklyOff') return CORE_ROLES.has(role.trim())
    ? { bg: 'F3E8FF', text: '7E22CE' } : { bg: 'FFE4E6', text: 'BE123C' };
  if (cell.dutyType === 'Off') return CORE_ROLES.has(role.trim())
    ? { bg: 'FFE4E6', text: 'BE123C' } : { bg: 'F3E8FF', text: '7E22CE' };
  const colors: Record<string, { bg: string; text: string }> = {
    Delivery: { bg: 'DCFCE7', text: '15803D' }, Driver: { bg: 'DBEAFE', text: '1D4ED8' },
    Rest: { bg: 'F1F5F9', text: '475569' }, Repair: { bg: 'FEF3C7', text: 'B45309' },
    Office: { bg: 'E0E7FF', text: '4338CA' }, OfficeDuty: { bg: 'E0E7FF', text: '4338CA' },
    Collection: { bg: 'CCFBF1', text: '0F766E' },
  };
  return Object.prototype.hasOwnProperty.call(colors, cell.dutyType) ? colors[cell.dutyType] : { bg: 'F5F3FF', text: '6D28D9' };
}

function styleBodyRow(row: ExcelJS.Row, alternate: boolean) {
  row.height = 34;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF334155' } };
    cell.fill = fill(alternate ? 'F8FAFC' : 'FFFFFF');
    cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  row.getCell(2).font = { ...row.getCell(2).font, bold: true };
}

function styleHeader(row: ExcelJS.Row) {
  row.height = 38;
  row.eachCell((cell) => {
    cell.fill = fill('1E293B');
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
  });
}

function styleTotal(row: ExcelJS.Row) {
  styleBodyRow(row, false);
  row.height = 30;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = fill('DCFCE7');
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF14532D' } };
    cell.numFmt = '0';
    cell.border = { top: { style: 'double', color: { argb: 'FF15803D' } }, bottom: BORDER, left: BORDER, right: BORDER };
  });
}

function addReportHeading(sheet: ExcelJS.Worksheet, width: number, input: DutyExcelInput, asOf: string) {
  const { data, employees } = input;
  const lines = [
    `${data.usingSampleData ? 'SAMPLE DATA — ' : ''}DMR Poultries — Duty Planner`,
    `${formatDutyDate(data.fromDate)} to ${formatDutyDate(data.toDate)} (inclusive) | ${data.days.length} days | ${employees.length} employees`,
    `As of ${formatDutyDate(asOf)} | Generated ${(input.generatedAt ?? new Date()).toLocaleString('en-IN')}${data.usingSampleData ? ' | SAMPLE / DEMO — not live staff records' : ''}`,
    `Filters: ${input.filterLabel || 'All employees'}`,
    'Duty Count includes work duties through the as-of date only; leave, off, weekly off and future days are excluded. Assigned duties override approved leave. Date totals are daily duty counts.',
  ];
  lines.forEach((text, index) => {
    const rowNum = index + 1;
    sheet.mergeCells(rowNum, 1, rowNum, width);
    const cell = sheet.getCell(rowNum, 1);
    cell.value = text;
    cell.font = { name: 'Calibri', size: index === 0 ? 18 : 11, bold: index === 0, color: { argb: index === 0 ? 'FFFFFFFF' : 'FF475569' } };
    cell.fill = fill(index === 0 ? (data.usingSampleData ? '92400E' : '14532D') : 'F8FAFC');
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
    sheet.getRow(rowNum).height = index === 0 ? 36 : index === 4 ? 34 : 25;
  });
  sheet.getRow(6).height = 9;
  sheet.views = [{ state: 'frozen', xSplit: 4, ySplit: HEADER_ROW, topLeftCell: 'E8', showGridLines: false }];
  sheet.pageSetup = {
    orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    printTitlesRow: '1:7', printTitlesColumn: 'A:D',
    margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  };
  sheet.headerFooter.oddFooter = '&LDMR Poultries — Duty Planner&RPage &P of &N';
}

/** Build a real styled workbook. No download or other browser side effects. */
export function buildDutyWorkbook(input: DutyExcelInput): ExcelJS.Workbook {
  const { data, employees } = input;
  const asOf = input.asOf ?? todayStr();
  if (!employees.length) throw new Error('No employees match the selected filters.');
  const expectedDays = getDutyReportDays(data);
  if (expectedDays.length !== data.days.length || expectedDays.some((day, i) => day.date !== data.days[i].date) ||
      employees.some((employee) => {
        const cells = data.byEmployee[employee.id];
        return !cells || cells.length !== expectedDays.length || cells.some((cell, i) => cell.date !== expectedDays[i].date);
      })) {
    throw new Error('The duty report is incomplete. Reload the selected range before exporting.');
  }
  if (employees.length * data.days.length + HEADER_ROW + 1 > 1_048_576) {
    throw new Error('The daily details exceed the Excel row limit. Select fewer employees or a shorter date range.');
  }

  const summary = summarizeDutyReport(data, employees, asOf);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DMR Poultries';
  workbook.title = 'Duty Planner';
  workbook.subject = `${data.fromDate} to ${data.toDate}`;
  workbook.created = input.generatedAt ?? new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  const sheet = workbook.addWorksheet('Duty Planner');
  const firstCountColumn = IDENTITY_HEADERS.length + data.days.length + 1;
  const lastColumn = firstCountColumn + DUTY_COUNT_COLUMNS.length - 1;
  sheet.columns = [
    ...[14, 28, 18, 22].map((width) => ({ width })),
    ...data.days.map(() => ({ width: 16 })),
    ...DUTY_COUNT_COLUMNS.map(() => ({ width: 13 })),
  ];
  addReportHeading(sheet, lastColumn, input, asOf);
  const header = sheet.getRow(HEADER_ROW);
  header.values = [...IDENTITY_HEADERS, ...data.days.map(({ date }) => new Date(`${date}T00:00:00Z`)), ...DUTY_COUNT_COLUMNS.map(({ label }) => label)];
  styleHeader(header);
  data.days.forEach((_, index) => { header.getCell(5 + index).numFmt = 'dd mmm yyyy (ddd)'; });
  header.getCell(lastColumn).fill = fill('15803D');

  employees.forEach((employee, index) => {
    const cells = data.byEmployee[employee.id];
    const counts = summary.byEmployee[employee.id];
    const row = sheet.addRow([
      employee.employeeNo ?? '', employee.employeeName, employee.role, employee.department,
      ...cells.map((cell) => cell.date > asOf
        ? (cell.dutyType ? `${getDutyLabel(cell.dutyType)}\n(Planned)` : '')
        : getDutyLabel(cell.dutyType)),
      ...DUTY_COUNT_COLUMNS.map(({ key }) => counts[key]),
    ]);
    styleBodyRow(row, index % 2 === 1);
    cells.forEach((cell, dayIndex) => {
      const target = row.getCell(5 + dayIndex);
      const tint = dutyTint(cell, employee.role, asOf);
      target.fill = fill(tint.bg);
      target.font = { name: 'Calibri', size: 11, bold: !!cell.dutyType && cell.date <= asOf, color: { argb: `FF${tint.text}` } };
      const note = [
        cell.isLeave ? (cell.assignedDutyType ? 'Approved leave overlaps this date; the assigned duty takes precedence.' : 'Approved leave with no assigned duty.') : '',
        cell.vehicleNo ? `Vehicle: ${cell.vehicleNo}` : '',
        cell.date > asOf ? 'Future date: not included in any completed-day count.' : '',
      ].filter(Boolean).join('\n');
      if (note) target.note = note;
      // Retain custom duty labels in full, with enough vertical room to wrap.
      row.height = Math.min(409, Math.max(row.height ?? 34, Math.ceil(String(target.value ?? '').length / 14) * 15 + 10));
    });
    DUTY_COUNT_COLUMNS.forEach((_, i) => { row.getCell(firstCountColumn + i).numFmt = '0'; });
    const countCell = row.getCell(lastColumn);
    countCell.fill = fill('F0FDF4');
    countCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF15803D' } };
  });

  const lastEmployeeRow = sheet.rowCount;
  sheet.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: lastEmployeeRow, column: lastColumn } };
  const total = sheet.addRow([
    'GRAND TOTAL / DAILY DUTY', '', '', '',
    ...data.days.map(({ date }) => date <= asOf ? summary.dailyDuty[date] : ''),
    ...DUTY_COUNT_COLUMNS.map(({ key }) => summary.totals[key]),
  ]);
  styleTotal(total);
  sheet.mergeCells(total.number, 1, total.number, 4);
  DUTY_COUNT_COLUMNS.forEach(({ key }, index) => {
    const cell = total.getCell(firstCountColumn + index);
    const letter = sheet.getColumn(firstCountColumn + index).letter;
    cell.value = { formula: `SUM(${letter}${HEADER_ROW + 1}:${letter}${lastEmployeeRow})`, result: summary.totals[key] };
  });

  sheet.addRow([]);
  const noteRow = sheet.rowCount + 1;
  sheet.mergeCells(noteRow, 1, noteRow, Math.min(lastColumn, 12));
  sheet.getCell(noteRow, 1).value = 'Legend: Duty / Driver / Repair / Office / Office Duty / Collection / custom duties count as duty. Leave = Rest or approved leave without an assignment. Planned entries and blank future dates are not counted. No Entry is a past/today date without duty or approved leave. See Daily Details for full source types, vehicles and leave overlaps.';
  sheet.getCell(noteRow, 1).font = { name: 'Calibri', size: 11, color: { argb: 'FF64748B' } };
  sheet.getCell(noteRow, 1).alignment = { vertical: 'middle', wrapText: true };
  sheet.getRow(noteRow).height = 48;

  // A filterable detail sheet keeps long/free-text duties and source metadata
  // readable without squeezing or abbreviating the employee × date matrix.
  const details = workbook.addWorksheet('Daily Details');
  const detailHeaders = [...IDENTITY_HEADERS, 'Date', 'Day', 'Duty / Status', 'Original Duty Type', 'Vehicle', 'Approved Leave', 'Entry Status', 'Duty Count'];
  details.columns = [14, 28, 18, 22, 17, 12, 32, 28, 22, 28, 24, 14].map((width) => ({ width }));
  addReportHeading(details, detailHeaders.length, input, asOf);
  details.getRow(HEADER_ROW).values = detailHeaders;
  styleHeader(details.getRow(HEADER_ROW));
  employees.forEach((employee, employeeIndex) => {
    for (const [dayIndex, cell] of data.byEmployee[employee.id].entries()) {
      const future = cell.date > asOf;
      const dutyCount = getDutyCountKey(cell, asOf) === 'duty' ? 1 : 0;
      const row = details.addRow([
        employee.employeeNo ?? '', employee.employeeName, employee.role, employee.department,
        new Date(`${cell.date}T00:00:00Z`), data.days[dayIndex].weekday,
        future && !cell.dutyType ? 'Not yet completed' : getDutyLabel(cell.dutyType),
        cell.assignedDutyType ?? '', cell.vehicleNo,
        cell.isLeave ? (cell.assignedDutyType && cell.assignedDutyType !== 'Rest' ? 'Yes — duty overrides leave' : 'Yes') : 'No',
        future ? (cell.dutyType ? 'Planned' : 'Not yet completed') : (cell.dutyType ? 'Recorded' : 'No Entry'),
        dutyCount,
      ]);
      styleBodyRow(row, employeeIndex % 2 === 1);
      row.height = Math.min(409, Math.max(34, Math.ceil((cell.dutyType?.length ?? 0) / 26) * 15 + 10));
      row.getCell(5).numFmt = 'dd mmm yyyy';
      row.getCell(detailHeaders.length).numFmt = '0';
      const tint = dutyTint(cell, employee.role, asOf);
      row.getCell(7).fill = fill(tint.bg);
      row.getCell(7).font = { name: 'Calibri', size: 11, color: { argb: `FF${tint.text}` } };
    }
  });
  const lastDetailRow = details.rowCount;
  details.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: lastDetailRow, column: detailHeaders.length } };
  const detailTotal = details.addRow(['TOTAL DUTY', ...Array(detailHeaders.length - 2).fill(''), { formula: `SUM(L${HEADER_ROW + 1}:L${lastDetailRow})`, result: summary.totals.duty }]);
  styleTotal(detailTotal);
  details.mergeCells(detailTotal.number, 1, detailTotal.number, detailHeaders.length - 1);
  return workbook;
}

export function getDutyExcelFilename(range: DutyReportRange, usingSampleData = false): string {
  return `Duty-Planner-${range.fromDate}-to-${range.toDate}${usingSampleData ? '-SAMPLE' : ''}.xlsx`;
}

export async function downloadDutyExcel(input: DutyExcelInput): Promise<void> {
  const workbook = buildDutyWorkbook(input);
  const bytes = await workbook.xlsx.writeBuffer();
  const { saveAs } = await import('file-saver');
  saveAs(new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), getDutyExcelFilename(input.data, input.data.usingSampleData));
}
