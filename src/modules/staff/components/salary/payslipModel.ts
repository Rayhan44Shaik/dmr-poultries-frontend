// src/modules/staff/components/salary/payslipModel.ts
//
// Single source of truth for the earnings/deduction field model used by every
// payslip surface (ClassicPayslipSheet, the Salary Review modal and the PDF
// generation). Kept outside the component file so the sheet component can be
// fast-refreshed in isolation and every surface always agrees on one truth.

import type { SalaryRecord } from "../../types/staffDashboard";

export type AmountFieldKey =
  | "basicSalary"
  | "overtime"
  | "incentives"
  | "fuelAllowance"
  | "nightAllowance"
  | "leaveDeduction"
  | "advanceRecovery"
  | "loanEMI"
  | "latePenalty"
  | "otherDeductions";

export type AmountValues = Record<AmountFieldKey, number>;

export const EARNING_FIELDS: { key: AmountFieldKey; label: string }[] = [
  { key: "basicSalary", label: "Basic Salary" },
  { key: "overtime", label: "Overtime" },
  { key: "incentives", label: "Incentives" },
  { key: "fuelAllowance", label: "Fuel Allowance" },
  { key: "nightAllowance", label: "Night Allowance" },
];

export const DEDUCTION_FIELDS: { key: AmountFieldKey; label: string }[] = [
  { key: "leaveDeduction", label: "Leave Deduction" },
  { key: "advanceRecovery", label: "Advance Recovery" },
  { key: "loanEMI", label: "Loan EMI" },
  { key: "latePenalty", label: "Late Penalty" },
  { key: "otherDeductions", label: "Other Deductions" },
];

export function toAmountValues(record: SalaryRecord): AmountValues {
  return {
    basicSalary: record.basicSalary || 0,
    overtime: record.overtime || 0,
    incentives: record.incentives || 0,
    fuelAllowance: record.fuelAllowance || 0,
    nightAllowance: record.nightAllowance || 0,
    leaveDeduction: record.leaveDeduction || 0,
    advanceRecovery: record.advanceRecovery || 0,
    loanEMI: record.loanEMI || 0,
    latePenalty: record.latePenalty || 0,
    otherDeductions: record.otherDeductions || 0,
  };
}

export function computePayslipTotals(values: AmountValues): {
  gross: number;
  deductions: number;
  net: number;
} {
  const gross =
    values.basicSalary +
    values.overtime +
    values.incentives +
    values.fuelAllowance +
    values.nightAllowance;
  const deductions =
    values.leaveDeduction +
    values.advanceRecovery +
    values.loanEMI +
    values.latePenalty +
    values.otherDeductions;
  return { gross, deductions, net: gross - deductions };
}
