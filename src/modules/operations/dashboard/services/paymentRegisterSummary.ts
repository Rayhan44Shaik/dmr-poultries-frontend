import { apiGet } from "../../../../api";

const PAYMENTS_PATH = "/accounts/payments";

interface PaymentRegisterApiRow {
  id?: number | string;
  paymentNo?: string;
  paymentDate?: string;
  paymentType?: string;
  paymentMode?: string;
  paidTo?: string;
  amount?: number | string;
  referenceNo?: string;
  category?: string;
  status?: string;
}

export interface PaymentRegisterPayeeSummary {
  paidTo: string;
  amount: number;
}

export interface PaymentRegisterTypeSummary {
  type: string;
  amount: number;
  count: number;
  percent: number;
  topPayee: string;
  topPayeeAmount: number;
  payees: PaymentRegisterPayeeSummary[];
}

export interface PaymentRegisterModeSummary {
  mode: string;
  amount: number;
  count: number;
  percent: number;
}

export interface PaymentRegisterSummary {
  fromDate: string;
  toDate: string;
  totalAmount: number;
  totalCount: number;
  typeRows: PaymentRegisterTypeSummary[];
  modeRows: PaymentRegisterModeSummary[];
}

const APPROVED_PAYMENT_STATUS = "approved";

function toAmount(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function text(value: unknown, fallback = "—"): string {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function normalisePaymentType(value: unknown): string {
  const raw = text(value, "Other");
  const key = raw.toLocaleLowerCase("en-IN");
  if (key.includes("farmer") || key.includes("farm payment")) return "Farm / Farmer Payment";
  if (key.includes("diesel") || key.includes("fuel")) return "Fuel / Diesel";
  if (key.includes("maintenance") || key.includes("vehicle")) return "Vehicle Maintenance";
  if (key.includes("salary") || key.includes("staff")) return "Salary";
  if (key.includes("toll") || key.includes("fastag")) return "Toll / FASTag";
  if (key.includes("office")) return "Office Expense";
  if (key.includes("emi") || key.includes("loan")) return "EMI";
  if (key.includes("tax")) return "Tax Payment";
  if (key.includes("other")) return "Other Expense";
  return raw;
}

function normalisePaymentMode(value: unknown): "Cash" | "Union Bank" | "HDFC Bank" {
  const raw = text(value, "Cash");
  const key = raw.toLocaleLowerCase("en-IN");
  if (key.includes("cash")) return "Cash";
  if (key.includes("union")) return "Union Bank";
  if (key.includes("hdfc")) return "HDFC Bank";
  // Payment Register can store instrument names such as UPI/NEFT/RTGS/Cheque.
  // The dashboard mode chips must match Collection Stream, so bank instruments
  // are rolled into the two bank buckets instead of showing cheque/UPI labels.
  if (key.includes("upi") || key.includes("neft") || key.includes("imps") || key.includes("bank")) {
    return "Union Bank";
  }
  return "HDFC Bank";
}

interface NormalisedPaymentRow {
  paymentType: string;
  paymentMode: string;
  paidTo: string;
  amount: number;
  status: string;
}

function normalisePayment(row: PaymentRegisterApiRow): NormalisedPaymentRow {
  return {
    paymentType: normalisePaymentType(row.paymentType ?? row.category),
    paymentMode: normalisePaymentMode(row.paymentMode),
    paidTo: text(row.paidTo, "Unknown payee"),
    amount: toAmount(row.amount),
    status: text(row.status, "").toLocaleLowerCase("en-IN"),
  };
}

function buildSummary(
  rows: PaymentRegisterApiRow[],
  fromDate: string,
  toDate: string,
): PaymentRegisterSummary {
  // Dashboard must show approved Payment Register rows only. Draft/pending,
  // cancelled, rejected and any non-approved payment rows are intentionally
  // excluded here, matching the user's request for approved-only payment data.
  const approved = rows
    .map(normalisePayment)
    .filter((row) => row.status === APPROVED_PAYMENT_STATUS);

  const totalAmount = approved.reduce((total, row) => total + row.amount, 0);
  const totalCount = approved.length;

  const byType = new Map<string, { amount: number; count: number; payees: Map<string, number> }>();
  const byMode = new Map<string, { amount: number; count: number }>();

  for (const row of approved) {
    const type = byType.get(row.paymentType) ?? { amount: 0, count: 0, payees: new Map<string, number>() };
    type.amount += row.amount;
    type.count += 1;
    type.payees.set(row.paidTo, (type.payees.get(row.paidTo) ?? 0) + row.amount);
    byType.set(row.paymentType, type);

    const mode = byMode.get(row.paymentMode) ?? { amount: 0, count: 0 };
    mode.amount += row.amount;
    mode.count += 1;
    byMode.set(row.paymentMode, mode);
  }

  const typeRows: PaymentRegisterTypeSummary[] = [...byType.entries()]
    .map(([type, summary]) => {
      const payees = [...summary.payees.entries()]
        .map(([paidTo, amount]) => ({ paidTo, amount }))
        .sort((a, b) => b.amount - a.amount || a.paidTo.localeCompare(b.paidTo, "en-IN"));
      return {
        type,
        amount: summary.amount,
        count: summary.count,
        percent: totalAmount > 0 ? (summary.amount / totalAmount) * 100 : 0,
        topPayee: payees[0]?.paidTo ?? "—",
        topPayeeAmount: payees[0]?.amount ?? 0,
        payees,
      };
    })
    .sort((a, b) => b.amount - a.amount || a.type.localeCompare(b.type, "en-IN"));

  const modeOrder = ["Cash", "Union Bank", "HDFC Bank"];
  const modeRows: PaymentRegisterModeSummary[] = [...byMode.entries()]
    .map(([mode, summary]) => ({
      mode,
      amount: summary.amount,
      count: summary.count,
      percent: totalAmount > 0 ? (summary.amount / totalAmount) * 100 : 0,
    }))
    .sort((a, b) => modeOrder.indexOf(a.mode) - modeOrder.indexOf(b.mode));

  return {
    fromDate,
    toDate,
    totalAmount,
    totalCount,
    typeRows,
    modeRows,
  };
}

export async function loadPaymentRegisterSummary(
  fromDate: string,
  toDate: string,
): Promise<PaymentRegisterSummary> {
  const { data } = await apiGet<PaymentRegisterApiRow[]>(PAYMENTS_PATH, {
    params: {
      fromDate,
      toDate,
    },
  });

  return buildSummary(Array.isArray(data) ? data : [], fromDate, toDate);
}
