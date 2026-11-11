export function formatCollectionAmountInput(value: string): { display: string; amount: number } {
  let raw = value.replace(/,/g, "").replace(/[^0-9.]/g, "");
  const parts = raw.split(".");
  if (parts.length > 2) raw = parts[0] + "." + parts.slice(1).join("");
  const [integer = "", decimal] = raw.split(".");
  const normalizedInteger = integer.replace(/^0+(?=\d)/, "");
  const grouped = normalizedInteger
    ? Number(normalizedInteger).toLocaleString("en-IN", { maximumFractionDigits: 0 })
    : "";
  return {
    display: decimal !== undefined ? `${grouped}.${decimal.slice(0, 2)}` : grouped,
    amount: Number.isFinite(Number(raw)) ? Number(raw) : 0,
  };
}
