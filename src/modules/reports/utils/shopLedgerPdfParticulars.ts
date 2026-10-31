export type PdfParticularsRow = {
  particulars: string;
  type: "sale" | "collection" | "correction";
  subShopName?: string;
  paymentMode?: string;
};

const pdfSubShopNames = (value?: string): string[] =>
  String(value ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

/** Collections print as Cash or Bank only — never the shop name. */
export const pdfCollectionParticulars = (paymentMode?: string): string => {
  const raw = String(paymentMode ?? "").trim();
  if (!raw) return "Collection";
  if (/cash/i.test(raw)) return "Cash";
  return "Bank";
};

/**
 * Statement Particulars: shop is already in the header, so rows stay short.
 * Sale with a sub-shop → sub-shop name (HARI). Sale without → Sale.
 * Collection → Cash or Bank.
 */
export const pdfStatementParticulars = (transaction: PdfParticularsRow): string => {
  if (transaction.particulars === "Opening Balance") return "Opening Balance";
  if (transaction.type === "collection") {
    return pdfCollectionParticulars(transaction.paymentMode);
  }
  const subShops = pdfSubShopNames(transaction.subShopName);
  if (subShops.length) return subShops.join(" / ");
  return "Sale";
};
