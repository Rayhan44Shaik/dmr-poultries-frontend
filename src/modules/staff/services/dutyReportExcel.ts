// Loaded only when Download Excel is clicked. The workbook mirrors the table:
// employee rows, date columns, individual counts last; no grand totals/legend.
import ExcelJS from 'exceljs';
import { DUTY_COUNT_COLUMNS, formatDutyDate, formatDutyWeekday, getDutyCountKey, getDutyCountLabel, getDutyLabel, getDutyReportDays, summarizeDutyReport, todayStr, type DutyReportCell, type DutyReportData, type DutyReportEmployee, type DutyReportRange } from './dutyReport';
import { isManualDutyRole } from './dutyRules';
import { dutyDisplayValue, dutyLocale, dutyTranslator, type DutyLanguage } from '../i18n/dutyPlannerCopy';

export interface DutyExcelInput {
  data: DutyReportData;
  employees: DutyReportEmployee[];
  filterLabel?: string;
  asOf?: string;
  generatedAt?: Date;
  language?: DutyLanguage;
}
const HEADER_ROW = 6;
const IDENTITY_KEYS = ['employeeNo', 'employee', 'role', 'department'] as const;
const BORDER = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
const DOT = { style: 'dotted' as const, color: { argb: 'FFCBD5E1' } };
const fill = (rgb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${rgb}` } });

function dutyTint(cell: DutyReportCell, role: string, asOf: string) {
  if (cell.date > asOf || !cell.dutyType) return { bg: 'F8FAFC', text: '94A3B8' };
  if (cell.dutyType === 'WeeklyOff') return isManualDutyRole(role) ? { bg: 'F3E8FF', text: '7E22CE' } : { bg: 'FFE4E6', text: 'BE123C' };
  if (cell.dutyType === 'Off') return isManualDutyRole(role) ? { bg: 'FFE4E6', text: 'BE123C' } : { bg: 'F3E8FF', text: '7E22CE' };
  const colors: Record<string, { bg: string; text: string }> = {
    Delivery: { bg: 'DCFCE7', text: '15803D' }, Driver: { bg: 'DBEAFE', text: '1D4ED8' },
    Rest: { bg: 'F1F5F9', text: '475569' }, Repair: { bg: 'FEF3C7', text: 'B45309' },
    Office: { bg: 'E0E7FF', text: '4338CA' }, OfficeDuty: { bg: 'E0E7FF', text: '4338CA' }, Collection: { bg: 'CCFBF1', text: '0F766E' },
  };
  return Object.prototype.hasOwnProperty.call(colors, cell.dutyType) ? colors[cell.dutyType] : { bg: 'F5F3FF', text: '6D28D9' };
}
function styleBodyRow(row: ExcelJS.Row, alternate: boolean, font: string) {
  row.height = font === 'Calibri' ? 34 : 40;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { name: font, size: 11, color: { argb: 'FF334155' } };
    cell.fill = fill(alternate ? 'F8FAFC' : 'FFFFFF');
    cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  row.getCell(2).font = { ...row.getCell(2).font, bold: true };
}
function styleHeader(row: ExcelJS.Row, font: string) {
  row.height = font === 'Calibri' ? 38 : 48;
  row.eachCell((cell) => {
    cell.fill = fill('1E293B');
    cell.font = { name: font, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
  });
}
function addHeading(sheet: ExcelJS.Worksheet, width: number, input: DutyExcelInput, asOf: string, font: string) {
  const { data, employees, language = 'en' } = input;
  const t = dutyTranslator(language);
  const lines = [
    `${data.usingSampleData ? `${t('sampleTitle')} — ` : ''}DMR Poultries — ${t('planner')}`,
    t('rangeHeading', { from: formatDutyDate(data.fromDate, language), to: formatDutyDate(data.toDate, language), days: data.days.length, employees: employees.length }),
    `${t('asOf', { date: formatDutyDate(asOf, language) })} | ${t('generated', { date: (input.generatedAt ?? new Date()).toLocaleString(dutyLocale(language)) })}${data.usingSampleData ? ` | ${t('sampleWarning')}` : ''}`,
    t('filterHeading', { filters: input.filterLabel || t('allEmployees') }),
  ];
  lines.forEach((text, index) => {
    sheet.mergeCells(index + 1, 1, index + 1, width);
    const cell = sheet.getCell(index + 1, 1);
    cell.value = text;
    cell.font = { name: font, size: index ? 11 : 18, bold: index === 0, color: { argb: index ? 'FF475569' : 'FFFFFFFF' } };
    cell.fill = fill(index ? 'F8FAFC' : data.usingSampleData ? '92400E' : '14532D');
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
    sheet.getRow(index + 1).height = index ? 28 : 38;
  });
  sheet.getRow(5).height = 8;
  sheet.views = [{ state: 'frozen', xSplit: 4, ySplit: HEADER_ROW, topLeftCell: 'E7', showGridLines: false }];
  sheet.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:6', printTitlesColumn: 'A:D', margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };
  sheet.headerFooter.oddFooter = `&LDMR Poultries — ${t('planner')}&R&P / &N`;
}

export function buildDutyWorkbook(input: DutyExcelInput): ExcelJS.Workbook {
  const { data, employees, language = 'en' } = input;
  const t = dutyTranslator(language);
  const asOf = input.asOf ?? todayStr();
  const font = language === 'te' ? 'Nirmala UI' : 'Calibri';
  if (!employees.length) throw new Error(t('noEmployees'));
  const expected = getDutyReportDays(data);
  if (expected.length !== data.days.length || expected.some((day, index) => day.date !== data.days[index].date) || employees.some((employee) => {
    const cells = data.byEmployee[employee.id];
    return !cells || cells.length !== expected.length || cells.some((cell, index) => cell.date !== expected[index].date);
  })) throw new Error(t('incomplete'));
  if (employees.length * data.days.length + HEADER_ROW > 1_048_576) throw new Error(t('detailsTooLong'));

  const summary = summarizeDutyReport(data, employees, asOf);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DMR Poultries';
  workbook.title = t('planner');
  workbook.subject = `${data.fromDate} to ${data.toDate}`;
  workbook.created = input.generatedAt ?? new Date();
  const sheet = workbook.addWorksheet(t('planner'));
  const firstCountColumn = 5 + data.days.length;
  const lastColumn = firstCountColumn + DUTY_COUNT_COLUMNS.length - 1;
  sheet.columns = [...[14, 28, 18, 22].map((width) => ({ width })), ...data.days.map(() => ({ width: language === 'te' ? 19 : 16 })), ...DUTY_COUNT_COLUMNS.map(() => ({ width: language === 'te' ? 16 : 13 }))];
  addHeading(sheet, lastColumn, input, asOf, font);
  sheet.getRow(HEADER_ROW).values = [
    ...IDENTITY_KEYS.map((key) => t(key)),
    ...data.days.map(({ date }) => language === 'te' ? `${formatDutyDate(date, language)}\n${formatDutyWeekday(date, language)}` : new Date(`${date}T00:00:00Z`)),
    ...DUTY_COUNT_COLUMNS.map(({ key }) => getDutyCountLabel(key, language)),
  ];
  styleHeader(sheet.getRow(HEADER_ROW), font);
  if (language === 'en') data.days.forEach((_, index) => { sheet.getCell(HEADER_ROW, 5 + index).numFmt = 'dd mmm yyyy (ddd)'; });
  sheet.getCell(HEADER_ROW, lastColumn).fill = fill('15803D');
  employees.forEach((employee, index) => {
    const cells = data.byEmployee[employee.id];
    const counts = summary.byEmployee[employee.id];
    const row = sheet.addRow([
      employee.employeeNo ?? '', employee.employeeName, dutyDisplayValue(employee.role, language), dutyDisplayValue(employee.department, language),
      ...cells.map((cell) => cell.date > asOf || !cell.dutyType ? '' : getDutyLabel(cell.dutyType, language)),
      ...DUTY_COUNT_COLUMNS.map(({ key }) => counts[key]),
    ]);
    styleBodyRow(row, index % 2 === 1, font);
    cells.forEach((cell, dayIndex) => {
      const target = row.getCell(5 + dayIndex);
      const future = cell.date > asOf;
      const tint = dutyTint(cell, employee.role, asOf);
      target.fill = fill(tint.bg);
      target.font = { name: font, size: 11, bold: !!cell.dutyType && !future, color: { argb: `FF${tint.text}` } };
      if (future || !cell.dutyType) target.border = { top: DOT, bottom: DOT, left: DOT, right: DOT };
      if (!future) {
        const notes = [cell.isLeave ? t('approvedOverrides') : cell.automatic ? t('automaticHint') : '', cell.vehicleNo ? `${t('vehicle')}: ${cell.vehicleNo}` : ''].filter(Boolean).join('\n');
        if (notes) target.note = notes;
      }
      row.height = Math.min(409, Math.max(row.height ?? 34, Math.ceil(String(target.value ?? '').length / 14) * 15 + 10));
    });
    DUTY_COUNT_COLUMNS.forEach((_, index) => { row.getCell(firstCountColumn + index).numFmt = '0'; });
    row.getCell(lastColumn).fill = fill('F0FDF4');
    row.getCell(lastColumn).font = { name: font, size: 12, bold: true, color: { argb: 'FF15803D' } };
  });
  sheet.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: sheet.rowCount, column: lastColumn } };

  const details = workbook.addWorksheet(t('details'));
  const detailKeys = [...IDENTITY_KEYS, 'date', 'day', 'dutyStatus', 'originalDuty', 'vehicle', 'approvedLeave', 'entrySource', 'dutyCount'] as const;
  details.columns = [14, 28, 18, 22, 20, 15, 32, 28, 22, 24, 22, 16].map((width) => ({ width }));
  addHeading(details, detailKeys.length, input, asOf, font);
  details.getRow(HEADER_ROW).values = detailKeys.map((key) => t(key));
  styleHeader(details.getRow(HEADER_ROW), font);
  employees.forEach((employee, employeeIndex) => {
    for (const cell of data.byEmployee[employee.id]) {
      const future = cell.date > asOf;
      const row = details.addRow([
        employee.employeeNo ?? '', employee.employeeName, dutyDisplayValue(employee.role, language), dutyDisplayValue(employee.department, language),
        language === 'te' ? formatDutyDate(cell.date, language) : new Date(`${cell.date}T00:00:00Z`), formatDutyWeekday(cell.date, language),
        future || !cell.dutyType ? '' : getDutyLabel(cell.dutyType, language),
        future ? '' : cell.assignedDutyType ?? '', future ? '' : cell.vehicleNo,
        future ? '' : t(cell.isLeave ? 'yes' : 'no'),
        future ? '' : cell.isLeave ? t('approvedLeave') : cell.automatic ? t('automatic') : cell.dutyType ? t('recorded') : t('noEntry'),
        getDutyCountKey(cell, asOf) === 'duty' ? 1 : 0,
      ]);
      styleBodyRow(row, employeeIndex % 2 === 1, font);
      row.height = Math.min(409, Math.max(row.height ?? 34, Math.ceil((future ? 0 : cell.dutyType?.length ?? 0) / 26) * 15 + 10));
      if (language === 'en') row.getCell(5).numFmt = 'dd mmm yyyy';
      row.getCell(12).numFmt = '0';
      const tint = dutyTint(cell, employee.role, asOf);
      row.getCell(7).fill = fill(tint.bg);
      row.getCell(7).font = { name: font, size: 11, color: { argb: `FF${tint.text}` } };
      if (future) for (let column = 7; column <= 11; column += 1) row.getCell(column).border = { top: DOT, bottom: DOT, left: DOT, right: DOT };
    }
  });
  details.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: details.rowCount, column: detailKeys.length } };
  return workbook;
}

export function getDutyExcelFilename(range: DutyReportRange, usingSampleData = false): string {
  return `Duty-Planner-${range.fromDate}-to-${range.toDate}${usingSampleData ? '-SAMPLE' : ''}.xlsx`;
}
export async function downloadDutyExcel(input: DutyExcelInput): Promise<void> {
  const bytes = await buildDutyWorkbook(input).xlsx.writeBuffer();
  const { saveAs } = await import('file-saver');
  saveAs(new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), getDutyExcelFilename(input.data, input.data.usingSampleData));
}
