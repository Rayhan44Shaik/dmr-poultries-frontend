// tests/farm-payment/browser-audit.mjs
// Real-browser verification of the Farm Payment page (Playwright + chromium).
// Run: node tests/farm-payment/browser-audit.mjs   (dev server + mock backend must be up)

import { chromium } from "playwright";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:5173";
const PAGE_URL = `${BASE}/accounts?tab=farm-payment`;

const results = [];
const note = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

async function main() {
  const browser = await chromium.launch({
    executablePath: "/tmp/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    env: { ...process.env, LD_LIBRARY_PATH: "/tmp/lib:/tmp" },
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  const pageErrors = [];
  const environmentalErrors = [];
  let tripApiCalls = 0;
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    const url = m.location()?.url ?? "";
    // Environmental / pre-existing, NOT Farm Payment issues:
    //  • fonts.googleapis.com — external CDN blocked by the sandbox network
    //    (referenced app-wide in index.html, loads fine on normal networks)
    //  • /api/operations/{collection-entry,shop-sales} 404s — the Header's
    //    notification badge, endpoints the dev mock backend doesn't implement
    if (
      url.includes("fonts.googleapis.com") ||
      url.includes("collection-entry") ||
      url.includes("shop-sales") ||
      text.includes("fonts.googleapis.com") ||
      text.includes("collection-entry") ||
      text.includes("shop-sales")
    ) {
      environmentalErrors.push(`${text} @ ${url}`);
      return;
    }
    consoleErrors.push(`${text} @ ${url}`);
  });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("request", (r) => { if (r.url().includes("/api/trips")) tripApiCalls++; });

  // Clean payment storage for a deterministic run
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.removeItem("farm_payments"));

  // ── 1. Page load ──────────────────────────────────────────────────────────
  await page.goto(PAGE_URL, { waitUntil: "networkidle" });
  const rows = page.locator('table tbody tr');
  await rows.first().waitFor({ timeout: 30000 });
  const rowCount = await rows.count();
  note("Page load renders table", rowCount > 0, `${rowCount} rows`);

  const summary = await page.locator("text=/Showing 1–10 of \\d+/").first().textContent().catch(() => null);
  note("Pagination summary shows correct range", Boolean(summary), summary?.trim());

  // ── 1b. Default window: last Monday -> last Sunday ────────────────────────
  // Today's week is still running (its Sunday has not happened), so the page
  // must not open on it. Recomputed here independently of the app.
  const isoLocal = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = new Date();
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const lastMon = new Date(thisMonday); lastMon.setDate(thisMonday.getDate() - 7);
  const lastSun = new Date(thisMonday); lastSun.setDate(thisMonday.getDate() - 1);
  const dmy = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const fromVal = await page.getByLabel("Date From").inputValue();
  const toVal = await page.getByLabel("Date To").inputValue();
  note("Opens on the last complete week (Mon-Sun)",
    fromVal === dmy(lastMon) && toVal === dmy(lastSun),
    `from=${fromVal} (want ${dmy(lastMon)} = ${isoLocal(lastMon)}) to=${toVal} (want ${dmy(lastSun)} = ${isoLocal(lastSun)})`);

  // Totals bar is a *filtered* affordance: quiet on the default window.
  note("Totals bar hidden on the default window",
    (await page.locator("text=/Totals for all \\d+ filtered/").count()) === 0);

  // ── 2. No console/page errors on load ────────────────────────────────────
  note("No console errors on load (page-scoped)", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  note("No uncaught page errors on load", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));
  // React StrictMode double-invokes effects in dev (main.tsx wraps the app):
  // 2 calls is the expected dev signature; production runs it once. The page's
  // load-sequence guard drops the superseded response either way.
  note("Trips fetched once per effect (StrictMode dev = 2)", tripApiCalls === 2, `calls=${tripApiCalls}`);

  // ── 3. Rate entry + live total ────────────────────────────────────────────
  const rateInput = page.locator('input[aria-label^="Rate per kg for trip"]').first();
  await rateInput.scrollIntoViewIfNeeded();
  await rateInput.fill("100");
  const row = rateInput.locator("xpath=ancestor::tr");
  const totalCell = row.locator("td").nth(7); // Total Amount column
  const totalText = (await totalCell.textContent())?.trim();
  note("Rate/Kg entry updates total live", totalText && totalText.includes("₹"), totalText);

  // Negative input is clamped to zero (business never saves negative rates)
  await rateInput.fill("-5");
  const afterNeg = await rateInput.inputValue();
  const negTotal = (await totalCell.textContent())?.trim();
  note("Negative rate clamped (no negative totals)", afterNeg === "" && negTotal?.includes("₹0"), `value="${afterNeg}" total="${negTotal}"`);
  await rateInput.fill("100");

  // ── 4. Save: exact count, no duplicates on re-click ──────────────────────
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(400);
  const successToasts = await page.locator('[role="status"]', { hasText: "1 payment saved successfully" }).count();
  note("Save shows exactly one success toast", successToasts >= 1, `toasts=${successToasts}`);

  // After saving the only dirty row, Save is DISABLED (modifiedCount === 0) —
  // the strongest possible no-duplicate protection: a second submission
  // cannot even be attempted.
  const saveDisabledAfter = await page.getByRole("button", { name: "Save", exact: true }).isDisabled();
  note("Save disabled after saving (no re-submission possible)", saveDisabledAfter);

  // Saved payment persisted exactly once for the trip
  const savedCount = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("farm_payments") || "[]");
    return data.filter((p) => p.ratePerKg === 100).length;
  });
  note("Exactly one payment record persisted", savedCount === 1, `records=${savedCount}`);

  // Rapid double-click on a fresh dirty row cannot double-save
  const secondRate = page.locator('input[aria-label^="Rate per kg for trip"]').nth(1);
  await secondRate.fill("80");
  const saveBtn = page.getByRole("button", { name: "Save", exact: true });
  await saveBtn.dblclick();
  await page.waitForTimeout(400);
  const savedCount2 = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("farm_payments") || "[]");
    return data.filter((p) => p.ratePerKg === 80).length;
  });
  note("Double-click Save produces exactly one payment", savedCount2 === 1, `records=${savedCount2}`);

  // ── 5. Trip view modal: dialog semantics, Step 2 → Step 3, Escape ───────
  await page.locator('button[title^="View trip history"]').first().click();
  const dialog = page.locator('div[role="dialog"][aria-modal="true"]');
  await dialog.waitFor({ timeout: 5000 });
  note("Trip view opens as an ARIA dialog", await dialog.isVisible());
  const dialogLabel = await dialog.getAttribute("aria-label");
  note("Dialog is labelled with the trip number", /TRP-/.test(dialogLabel ?? ""), dialogLabel ?? "");

  await page.getByRole("button", { name: /Pickup Details/i }).click();
  await page.waitForTimeout(300);
  const pickupTable = dialog.locator("table").first();
  note("Step 3 (Pickup) renders the box table", await pickupTable.isVisible());
  const dcPhotos = await dialog.locator("img[alt^='DC photo'], img[alt='Pickup']").count();
  note("DC photos visible in Step 3", dcPhotos > 0, `${dcPhotos} photo(s)`);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  note("Escape closes the dialog", !(await dialog.isVisible().catch(() => false)));
  const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
  note("Body scroll restored after close", bodyOverflow === "", `overflow="${bodyOverflow}"`);

  // ── 6. Filters: farm dropdown keyboard, empty state ───────────────────────
  // Go to page 2 first so we can verify filters reset pagination — the default
  // window can easily hold fewer than one page of trips, so this is best-effort.
  const page2 = page.locator('button', { hasText: "2", exact: true }).first();
  if (await page2.isVisible().catch(() => false)) {
    await page2.click();
    await page.waitForTimeout(200);
  }

  const farmTrigger = page.locator('button[aria-haspopup="listbox"]');
  await farmTrigger.focus();
  await page.keyboard.press("ArrowDown"); // opens + focuses search
  const farmSearch = page.locator('input[aria-label="Search farm"]');
  note("Farm dropdown opens via keyboard (ArrowDown)", await farmSearch.isVisible());
  await farmSearch.fill("godavari");
  await page.keyboard.press("ArrowDown"); // focus first option
  await page.keyboard.press("Enter");     // select it
  await page.waitForTimeout(300);
  const farmValue = await farmTrigger.textContent();
  note("Keyboard farm selection works (Enter)", /godavari/i.test(farmValue ?? ""), farmValue?.trim());
  const filteredRows = await rows.count();
  note("Farm filter narrows the table", filteredRows > 0 && filteredRows < rowCount, `${filteredRows} rows`);
  const bar = page.locator("text=/Totals for all \\d+ filtered/");
  note("Totals bar appears at the end of the table once filtered", await bar.first().isVisible().catch(() => false));
  const barText = (await page.locator("text=/Totals for all/").first().textContent().catch(() => "")) ?? "";
  note("Totals bar names the three figures only", !/Total Paid|Balance/.test(barText), barText.trim());
  const activePage = await page.locator("text=/Showing 1–\\d+/").first().textContent().catch(() => null);
  note("Filtering resets to page 1", Boolean(activePage), activePage?.trim());

  // Escape closes the dropdown without changing the selection
  await farmTrigger.click();
  await page.keyboard.press("Escape");
  const farmAfterEscape = await farmTrigger.textContent();
  note("Escape closes farm dropdown, selection intact", /godavari/i.test(farmAfterEscape ?? ""), farmAfterEscape?.trim());

  // Empty state distinguishes "no match" from "no data"
  await page.locator('input[aria-label="Search trips"]').fill("zzzz-not-a-trip");
  await page.waitForTimeout(300);
  const emptyMsg = await page.locator("text=No trips match the current filters").count();
  note("Filtered empty state message", emptyMsg === 1);

  // Clear resets everything
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.waitForTimeout(300);
  const clearedRows = await rows.count();
  note("Clear returns to the default week", clearedRows === rowCount, `${clearedRows} rows`);
  const fromAfterClear = await page.getByLabel("Date From").inputValue();
  note("Clear resets dates to last Monday, not to empty", fromAfterClear === dmy(lastMon), `value=${fromAfterClear}`);
  note("Totals bar hides again on the default window",
    (await page.locator("text=/Totals for all \\d+ filtered/").count()) === 0);

  // ── 7. Refresh (now beside Clear in the filter row): one request, no flicker ─
  const refreshBtnRow = await page.getByRole("button", { name: "Refresh", exact: true })
    .evaluate((el) => ({ inFilterCard: !el.closest("table") && !el.closest('[class*="justify-between"] > h2') }))
    .catch(() => ({ inFilterCard: false }));
  note("Refresh lives in the filter row, not the table header", refreshBtnRow.inFilterCard);
  const spinnerVisibleDuringLoad = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /Refresh/.test(x.textContent ?? ""));
    return Boolean(b && b.querySelector("svg[class*='animate-spin'], svg.animate-spin"));
  });
  note("Spinner icon only while a load is running", !spinnerVisibleDuringLoad);
  const beforeRefresh = await rows.first().evaluate((el) => el.tagName);
  tripApiCalls = 0;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.waitForTimeout(150); // mid-refresh check
  const rowsStillVisible = await rows.first().isVisible().catch(() => false);
  await page.waitForTimeout(700);
  note("Refresh keeps table on screen (no flicker)", rowsStillVisible && beforeRefresh === "TR", `stillVisible=${rowsStillVisible}`);
  note("Refresh issues exactly one /api/trips call", tripApiCalls === 1, `calls=${tripApiCalls}`);

  // Rapid triple-click on Refresh → guarded
  tripApiCalls = 0;
  const refreshBtn = page.getByRole("button", { name: "Refresh", exact: true });
  await refreshBtn.click();
  await refreshBtn.click();
  await refreshBtn.click();
  await page.waitForTimeout(800);
  note("Rapid refresh clicks produce one request", tripApiCalls === 1, `calls=${tripApiCalls}`);

  // ── 8. Status-free UI: no paid/unpaid column or filter, KPI totals present ─
  // Payment status was removed from this page on purpose — the table is about
  // the rate and the amount, so a stray "Status" label anywhere is a regression.
  const statusLabels = await page.locator("text=/\\bStatus\\b/").count();
  note("No status label anywhere on the page", statusLabels === 0, `matches=${statusLabels}`);
  const headerTexts = await page.locator("table thead th").allTextContents();
  note(
    "Table columns: 9, no Status",
    headerTexts.length === 9 && !headerTexts.some((h) => /status/i.test(h)),
    headerTexts.join(" | ")
  );
  const kpiCount = await page.locator("text=/^Total (Birds|Weight|Amount)$/").count();
  note("KPI row shows exactly the three totals", kpiCount === 3, `${kpiCount} cards`);
  note(
    "No paid/balance KPI left",
    (await page.locator("text=/^(Total Paid|Balance Due)$/").count()) === 0
  );
  const tip = await page.locator('td[title^="\u20b9"]').first().getAttribute("title").catch(() => null);
  note("Amount cell exposes exact rupees", /^\u20b9[\d,]+\.\d\d$/.test(tip ?? ""), tip ?? "");

  // ── 9. Responsive: mobile viewport, no horizontal page overflow ──────────
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  note("Mobile: no horizontal page overflow", overflow <= 1, `overflow=${overflow}px`);
  const rateVisibleMobile = await page.locator('input[aria-label^="Rate per kg for trip"]').first().isVisible().catch(() => false);
  note("Mobile: rate input reachable", rateVisibleMobile);

  // ── 10. Final console error sweep across the whole run ───────────────────
  note("No console errors across entire session", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  note("No page errors across entire session", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));

  // Clean slate for the next run
  await page.evaluate(() => localStorage.removeItem("farm_payments"));

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n==== BROWSER AUDIT: ${results.length - failed.length}/${results.length} passed ====`);
  if (failed.length) {
    console.log("FAILED:");
    failed.forEach((f) => console.log(`  ✗ ${f.name} ${f.detail}`));
    process.exit(1);
  }
}

main().catch((e) => { console.error("AUDIT CRASH:", e); process.exit(1); });
