import assert from "node:assert/strict";
import test from "node:test";
import {
  pdfCollectionParticulars,
  pdfStatementParticulars,
} from "./shopLedgerPdfParticulars";

const tx = (
  overrides: Parameters<typeof pdfStatementParticulars>[0],
): Parameters<typeof pdfStatementParticulars>[0] => overrides;

test("sale with a sub-shop prints only the sub-shop name", () => {
  assert.equal(
    pdfStatementParticulars(tx({ particulars: "GENERAL ACCOUNT", type: "sale", subShopName: "HARI" })),
    "HARI",
  );
  assert.equal(
    pdfStatementParticulars(tx({ particulars: "GENERAL ACCOUNT", type: "sale", subShopName: "HARI VANUKURU" })),
    "HARI VANUKURU",
  );
});

test("sale without a sub-shop prints Sale, never the shop name", () => {
  assert.equal(
    pdfStatementParticulars(tx({ particulars: "GENERAL ACCOUNT", type: "sale" })),
    "Sale",
  );
});

test("collection prints Cash or Bank only", () => {
  assert.equal(pdfCollectionParticulars("Cash"), "Cash");
  assert.equal(pdfCollectionParticulars("Union"), "Bank");
  assert.equal(pdfCollectionParticulars("SBI"), "Bank");
  assert.equal(pdfCollectionParticulars("UPI"), "Bank");
  assert.equal(
    pdfStatementParticulars(
      tx({ type: "collection", particulars: "GENERAL ACCOUNT", paymentMode: "Cash" }),
    ),
    "Cash",
  );
  assert.equal(
    pdfStatementParticulars(
      tx({
        type: "collection",
        particulars: "GENERAL ACCOUNT",
        paymentMode: "Union",
        subShopName: "HARI",
      }),
    ),
    "Bank",
  );
});

test("opening balance is unchanged", () => {
  assert.equal(
    pdfStatementParticulars(tx({ particulars: "Opening Balance", type: "sale" })),
    "Opening Balance",
  );
});
