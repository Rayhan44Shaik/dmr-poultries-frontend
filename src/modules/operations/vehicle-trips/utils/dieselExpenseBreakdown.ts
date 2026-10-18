export interface DieselExpenseRow {
  litres?: unknown;
  rate?: unknown;
  amount?: unknown;
  bunkName?: unknown;
  bunkSource?: unknown;
}

export interface DieselExpenseBreakdown {
  totalAmount: number;
  totalLitres: number;
  otherAmount: number;
  tooltip: string;
}

export interface TripExpenseTotals {
  expenseTotal: number;
  grandTotal: number;
}

/**
 * Other-diesel is displayed as an expense-table line, while also remaining
 * part of the consolidated diesel bill. Include it in the expense subtotal,
 * then remove that overlap once from the all-in total.
 */
export function calculateTripExpenseTotals(
  expenseTotalWithoutOtherDiesel: number,
  totalDieselAmount: number,
  otherDieselAmount: number,
): TripExpenseTotals {
  const expenseTotal = expenseTotalWithoutOtherDiesel + otherDieselAmount;
  return {
    expenseTotal,
    grandTotal: expenseTotal + totalDieselAmount - otherDieselAmount,
  };
}

const money = (value: number) => `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function dieselExpenseBreakdown(rows: DieselExpenseRow[]): DieselExpenseBreakdown {
  let totalAmount = 0;
  let totalLitres = 0;
  let otherAmount = 0;
  const byBunk = new Map<string, number>();
  for (const row of rows) {
    const litres = Number(row.litres || 0);
    const rate = Number(row.rate || 0);
    const savedAmount = Number(row.amount);
    const amount = Number.isFinite(savedAmount) && savedAmount > 0 ? savedAmount : litres * rate;
    totalAmount += Number.isFinite(amount) ? amount : 0;
    totalLitres += Number.isFinite(litres) ? litres : 0;
    const isOther = String(row.bunkSource || "").toUpperCase() === "OTHER";
    if (isOther) otherAmount += Number.isFinite(amount) ? amount : 0;
    const name = isOther ? "Other" : String(row.bunkName || "Master bunk").trim() || "Master bunk";
    byBunk.set(name, (byBunk.get(name) || 0) + (Number.isFinite(amount) ? amount : 0));
  }
  const parts = Array.from(byBunk.entries()).map(([name, amount]) => `${name}: ${money(amount)}`);
  return {
    totalAmount,
    totalLitres,
    otherAmount,
    tooltip: parts.length ? parts.join(" · ") : "No submitted diesel bills",
  };
}
