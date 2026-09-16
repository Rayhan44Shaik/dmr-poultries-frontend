// src/modules/accounts/components/Summary/exportHelpers.ts

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { WeeklyMetrics, ExpenseBreakdown } from '../../types/summary.types';

// ---- Helpers ----
const formatCurrencyPlain = (amount: number): string => {
  return `Rs. ${new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-IN').format(num);
};

const getTextWidth = (doc: jsPDF, text: string, fontSize: number): number => {
  doc.setFontSize(fontSize);
  const unitWidth = doc.getStringUnitWidth(text);
  return unitWidth * fontSize / 1.5;
};

// ---- PDF Export – A4 Portrait, Light Green, Neat & Professional ----
export const exportPDF = async (
  title: string,
  dateRange: string,
  weeklyGroups: { label: string }[],
  weeklyMetrics: WeeklyMetrics[],
  weeklyExpenses: ExpenseBreakdown[],
  totalMetrics: WeeklyMetrics,
  totalExpenses: ExpenseBreakdown,
  extra?: { totalDistanceKm?: number }
): Promise<void> => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 12;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const fy = `Financial Year: ${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

  // Colors – soft light green theme
  const greenHeaderBg: [number, number, number] = [222, 247, 231]; // emerald-50 light
  const greenHeaderText: [number, number, number] = [22, 101, 52]; // green-800
  const greenAccent: [number, number, number] = [16, 185, 129]; // emerald-500
  const borderGrey: [number, number, number] = [226, 232, 240]; // slate-200
  const slate700: [number, number, number] = [51, 65, 85];

  // ─── Header banner ───────────────────────────────────────────────
  // Light green top bar
  doc.setFillColor(greenHeaderBg[0], greenHeaderBg[1], greenHeaderBg[2]);
  doc.roundedRect(margin, 10, pageWidth - margin * 2, 18, 2, 2, 'F');
  // Accent left border
  doc.setFillColor(greenAccent[0], greenAccent[1], greenAccent[2]);
  doc.roundedRect(margin, 10, 3, 18, 1, 1, 'F');

  doc.setFontSize(13);
  doc.setTextColor(greenHeaderText[0], greenHeaderText[1], greenHeaderText[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin + 6, 18);

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${dateRange}    •    ${fy}`, margin + 6, 24);

  // Generated small on right
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  const genText = `Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`;
  doc.text(genText, pageWidth - margin - 2 - 40, 18);

  // ─── KPI cards below header (light, simple) ─────────────────────
  const totalExpenseVal = Object.values(totalExpenses).reduce((a, b) => a + b, 0);
  const totalWeight = (totalMetrics as any).weight || 0;
  const totalDistance = extra?.totalDistanceKm ?? 0;
  const costPerKg = totalWeight > 0 ? totalExpenseVal / totalWeight : 0;
  const costPerKm = totalDistance > 0 ? totalExpenseVal / totalDistance : 0;

  const kpiY = 32;
  const kpiGap = 4;
  const kpiW = (pageWidth - margin * 2 - kpiGap) / 2;
  const kpiH = 18;

  const drawKpi = (x: number, label: string, value: string, sub: string) => {
    // card
    doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, kpiY, kpiW, kpiH, 2, 2, 'FD');
    // subtle emerald top accent
    doc.setFillColor(greenAccent[0], greenAccent[1], greenAccent[2]);
    doc.roundedRect(x, kpiY, kpiW, 1.2, 1, 1, 'F');
    // icon circle (light green)
    const iconX = x + 4;
    const iconY = kpiY + 5.5;
    doc.setFillColor(220, 252, 231);
    doc.setDrawColor(187, 247, 208);
    doc.circle(iconX + 3, iconY, 3, 'FD');
    doc.setFontSize(6);
    doc.setTextColor(greenHeaderText[0], greenHeaderText[1], greenHeaderText[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(label === 'COST / KG' ? 'Kg' : 'Km', iconX + 1.6, iconY + 1, { align: 'center' } as any);
    // label
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.text(label, x + 11, kpiY + 6);
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(sub, x + 11, kpiY + 9.5);
    // value
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(value, x + 11, kpiY + 15);
    // unit badge
    const badge = label === 'COST / KG' ? '₹/KG' : '₹/KM';
    doc.setFontSize(5.5);
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(226, 232, 240);
    const badgeW = 12;
    const badgeX = x + kpiW - badgeW - 3;
    doc.roundedRect(badgeX, kpiY + 3.5, badgeW, 4.5, 1, 1, 'FD');
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.text(badge, badgeX + badgeW / 2, kpiY + 6.5, { align: 'center' } as any);
  };

  drawKpi(margin, 'COST / KG', formatCurrencyPlain(costPerKg), `${totalWeight.toFixed(2)} kg  •  ${formatNumber((totalMetrics as any).birds || 0)} birds`);
  drawKpi(margin + kpiW + kpiGap, 'COST / KM', formatCurrencyPlain(costPerKm), `${totalDistance.toFixed(1)} km  •  ${(totalMetrics as any).trips || 0} trips`);

  // ─── Determine column widths for A4 portrait ─────────────────────
  const numDataCols = weeklyGroups.length;
  const headerFontSize = 6.5;
  const bodyFontSize = 6.5;

  let maxLabelWidth = 0;
  weeklyGroups.forEach(g => {
    const w = getTextWidth(doc, g.label, headerFontSize);
    if (w > maxLabelWidth) maxLabelWidth = w;
  });
  const dataColWidth = Math.min(Math.max(maxLabelWidth + 6, 22), 36);
  const firstColWidth = 38;
  const totalColWidth = 22;
  const available = pageWidth - margin * 2 - firstColWidth - totalColWidth;
  let finalDataColWidth = dataColWidth;
  if (numDataCols > 0) {
    const needed = numDataCols * dataColWidth;
    if (needed > available) {
      finalDataColWidth = Math.max(16, available / numDataCols);
    }
  }

  const colWidths = [firstColWidth];
  for (let i = 0; i < numDataCols; i++) colWidths.push(finalDataColWidth);
  colWidths.push(totalColWidth);

  const columnStyles = colWidths.reduce((acc, w, idx) => {
    acc[idx] = { cellWidth: w };
    return acc;
  }, {} as any);

  // ─── Summary Table ──────────────────────────────────────────────
  const summaryHeaders = ['Particulars', ...weeklyGroups.map(g => g.label), 'Total'];

  const summaryRows: any[][] = [
    { key: 'trips', label: 'No. of Trips' },
    { key: 'birds', label: 'No. of Birds' },
    { key: 'weight', label: 'Birds in KG' },
    { key: 'mortality', label: 'Mortality (Birds)' },
    { key: 'weightLoss', label: 'Weight Loss (KG)' },
    { key: 'sales', label: 'Sales Amount (Rs.)' },
    { key: 'collection', label: 'Collection Amount (Rs.)' },
    { key: 'pending', label: 'Pending Collection (Rs.)' },
  ].map(item => {
    const row: any[] = [item.label];
    weeklyMetrics.forEach(m => {
      const val = (m[item.key as keyof WeeklyMetrics] as number) || 0;
      if (item.key === 'sales' || item.key === 'collection' || item.key === 'pending') {
        row.push(formatCurrencyPlain(val));
      } else if (item.key === 'weight' || item.key === 'weightLoss') {
        row.push(val.toFixed(2));
      } else {
        row.push(formatNumber(val));
      }
    });
    const totalVal = (totalMetrics[item.key as keyof WeeklyMetrics] as number) || 0;
    if (item.key === 'sales' || item.key === 'collection' || item.key === 'pending') {
      row.push(formatCurrencyPlain(totalVal));
    } else if (item.key === 'weight' || item.key === 'weightLoss') {
      row.push(totalVal.toFixed(2));
    } else {
      row.push(formatNumber(totalVal));
    }
    return row;
  });

  autoTable(doc, {
    head: [summaryHeaders],
    body: summaryRows,
    startY: kpiY + kpiH + 6,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: {
      fontSize: bodyFontSize,
      cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 },
      textColor: slate700 as any,
      lineColor: borderGrey as any,
      lineWidth: 0.12,
      valign: 'middle',
    },
    headStyles: {
      fillColor: greenHeaderBg as any,
      textColor: greenHeaderText as any,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      fontSize: headerFontSize,
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
    },
    columnStyles: columnStyles,
    alternateRowStyles: { fillColor: [248, 250, 252] as any },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index === 0) {
        data.cell.styles.halign = 'left';
      }
      if (data.section === 'body' && data.column.index === 0) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [248, 250, 252] as any;
        data.cell.styles.textColor = [51, 65, 85] as any;
      }
      if (data.section === 'body' && data.column.index > 0) {
        data.cell.styles.halign = 'right';
      }
      // Total column emphasis
      if (data.column.index === colWidths.length - 1) {
        data.cell.styles.fillColor = [240, 253, 244] as any;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [22, 101, 52] as any;
      }
    },
    didDrawPage: (data) => {
      // footer line
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      const str = `Page ${data.pageNumber}  •  DMR Poultries – Business Summary`;
      doc.text(str, pageWidth / 2, pageHeight - 6, { align: 'center' } as any);
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;

  // ─── Expenses Table ─────────────────────────────────────────────
  // Section title
  doc.setFontSize(8);
  doc.setTextColor(greenHeaderText[0], greenHeaderText[1], greenHeaderText[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('EXPENSES BREAKDOWN', margin, finalY);
  doc.setDrawColor(greenAccent[0], greenAccent[1], greenAccent[2]);
  doc.setLineWidth(0.4);
  doc.line(margin, finalY + 1.2, margin + 36, finalY + 1.2);

  const expenseHeaders = ['Expense', ...weeklyGroups.map(g => g.label), 'Total'];

  const expenseRows: any[][] = [
    { key: 'farm', label: 'Farm Payment (Rs.)' },
    { key: 'fuel', label: 'Fuel Payment (Rs.)' },
    { key: 'trip', label: 'Trip Expenses (Rs.)' },
    { key: 'salary', label: 'Salaries (Rs.)' },
    { key: 'maintenance', label: 'Vehicle Maintenance (Rs.)' },
    { key: 'office', label: 'Office & Other Expenses (Rs.)' },
  ].map(item => {
    const row: any[] = [item.label];
    weeklyExpenses.forEach(w => {
      const val = (w[item.key as keyof ExpenseBreakdown] as number) || 0;
      row.push(formatCurrencyPlain(val));
    });
    const totalVal = (totalExpenses[item.key as keyof ExpenseBreakdown] as number) || 0;
    row.push(formatCurrencyPlain(totalVal));
    return row;
  });

  const totalExpRow: any[] = ['Total Expenses (Rs.)'];
  weeklyExpenses.forEach(w => {
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    totalExpRow.push(formatCurrencyPlain(sum));
  });
  totalExpRow.push(formatCurrencyPlain(Object.values(totalExpenses).reduce((a, b) => a + b, 0)));

  expenseRows.push(totalExpRow);

  autoTable(doc, {
    head: [expenseHeaders],
    body: expenseRows,
    startY: finalY + 4,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: {
      fontSize: bodyFontSize,
      cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 },
      textColor: slate700 as any,
      lineColor: borderGrey as any,
      lineWidth: 0.12,
      valign: 'middle',
    },
    headStyles: {
      fillColor: greenHeaderBg as any,
      textColor: greenHeaderText as any,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      fontSize: headerFontSize,
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
    },
    columnStyles: columnStyles,
    alternateRowStyles: { fillColor: [248, 250, 252] as any },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [248, 250, 252] as any;
      }
      if (data.section === 'body' && data.column.index > 0) {
        data.cell.styles.halign = 'right';
      }
      if (data.column.index === colWidths.length - 1) {
        data.cell.styles.fillColor = [240, 253, 244] as any;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [22, 101, 52] as any;
      }
      if (data.section === 'body' && data.row.index === expenseRows.length - 1) {
        data.cell.styles.fillColor = [240, 253, 244];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // ─── Footer note below tables ───────────────────────────────────
  const finalY2 = (doc as any).lastAutoTable.finalY + 7;
  // Light note box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, finalY2, pageWidth - margin * 2, 8, 1.5, 1.5, 'FD');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'italic');
  doc.text('All amounts are calculated based on the selected date range.  •  Cost/KG = Total Expense ÷ Total Weight  •  Cost/KM = Total Expense ÷ Total Distance', margin + 3, finalY2 + 5);

  doc.save(`${title.replace(/\s/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

// ---- Excel Export – Unchanged + includes Weight Loss ----
export const exportExcel = (
  title: string,
  dateRange: string,
  weeklyGroups: { label: string }[],
  weeklyMetrics: WeeklyMetrics[],
  weeklyExpenses: ExpenseBreakdown[],
  totalMetrics: WeeklyMetrics,
  totalExpenses: ExpenseBreakdown
): void => {
  const wb = XLSX.utils.book_new();
  const wsData: any[][] = [];

  // Header
  wsData.push([title]);
  wsData.push([`Period: ${dateRange}  |  Financial Year: ${new Date().getFullYear()}-${new Date().getFullYear() + 1}`]);
  wsData.push([]);

  // Summary Table
  wsData.push(['BUSINESS SUMMARY']);
  const summaryHeaders = ['Particulars', ...weeklyGroups.map(g => g.label), 'Total'];
  wsData.push(summaryHeaders);

  const summaryRows = [
    { key: 'trips', label: 'No. of Trips' },
    { key: 'birds', label: 'No. of Birds' },
    { key: 'weight', label: 'Birds in KG' },
    { key: 'mortality', label: 'Mortality (Birds)' },
    { key: 'weightLoss', label: 'Weight Loss (KG)' },
    { key: 'sales', label: 'Sales Amount (₹)' },
    { key: 'collection', label: 'Collection Amount (₹)' },
    { key: 'pending', label: 'Pending Collection (₹)' },
  ].map(item => {
    const row: any[] = [item.label];
    weeklyMetrics.forEach(m => {
      const val = (m[item.key as keyof WeeklyMetrics] as number) || 0;
      if (item.key === 'sales' || item.key === 'collection' || item.key === 'pending') {
        row.push(Number(val.toFixed(2)));
      } else if (item.key === 'weight' || item.key === 'weightLoss') {
        row.push(Number(val.toFixed(2)));
      } else {
        row.push(val);
      }
    });
    const totalVal = (totalMetrics[item.key as keyof WeeklyMetrics] as number) || 0;
    if (item.key === 'sales' || item.key === 'collection' || item.key === 'pending') {
      row.push(Number(totalVal.toFixed(2)));
    } else if (item.key === 'weight' || item.key === 'weightLoss') {
      row.push(Number(totalVal.toFixed(2)));
    } else {
      row.push(totalVal);
    }
    return row;
  });
  summaryRows.forEach(row => wsData.push(row));

  wsData.push([]);

  // Expenses Table
  wsData.push(['EXPENSES']);
  const expenseHeaders = ['Expense', ...weeklyGroups.map(g => g.label), 'Total'];
  wsData.push(expenseHeaders);

  const expenseRows = [
    { key: 'farm', label: 'Farm Payment (₹)' },
    { key: 'fuel', label: 'Fuel Payment (₹)' },
    { key: 'trip', label: 'Trip Expenses (₹)' },
    { key: 'salary', label: 'Salaries (₹)' },
    { key: 'maintenance', label: 'Vehicle Maintenance (₹)' },
    { key: 'office', label: 'Office & Other Expenses (₹)' },
  ].map(item => {
    const row: any[] = [item.label];
    weeklyExpenses.forEach(w => {
      const val = (w[item.key as keyof ExpenseBreakdown] as number) || 0;
      row.push(Number(val.toFixed(2)));
    });
    const totalVal = (totalExpenses[item.key as keyof ExpenseBreakdown] as number) || 0;
    row.push(Number(totalVal.toFixed(2)));
    return row;
  });

  // Total Expenses row
  const totalExpRow: any[] = ['Total Expenses (₹)'];
  weeklyExpenses.forEach(w => {
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    totalExpRow.push(Number(sum.toFixed(2)));
  });
  totalExpRow.push(Number(Object.values(totalExpenses).reduce((a, b) => a + b, 0).toFixed(2)));
  expenseRows.push(totalExpRow);

  expenseRows.forEach(row => wsData.push(row));

  // KPI below
  wsData.push([]);
  const totalExpenseVal = Object.values(totalExpenses).reduce((a, b) => a + b, 0);
  const costPerKg = (totalMetrics as any).weight ? totalExpenseVal / (totalMetrics as any).weight : 0;
  wsData.push(['KPI']);
  wsData.push(['Cost / KG (Rs.)', Number(costPerKg.toFixed(2))]);
  // distance KPI needs distance – leave blank if not available via this export path; callee can extend

  wsData.push([]);
  wsData.push([`Generated on: ${new Date().toLocaleString()}`]);
  wsData.push(['All amounts are calculated based on the selected date range.']);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [{ wch: 30 }, ...weeklyGroups.map(() => ({ wch: 18 })), { wch: 15 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Business Summary');
  XLSX.writeFile(wb, `${title.replace(/\s/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};
