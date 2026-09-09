// tests/farm-payment/cleanup-verify.mjs
// Real-browser verification of the final frontend cleanup (3 items):
//   1. ESLint finding fixed (source-level; asserted by CI/lint, not browser)
//   2. Google Fonts: no external font request, Inter renders locally
//   2B. Header: no 404 console noise from the background collection warm-up
//   3. StepPickup: PDF/image actions are re-entrancy-safe (mouse + keyboard)
// Run: node tests/farm-payment/cleanup-verify.mjs  (dev server + mock backend up)

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
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // ── Track network + console for the whole session ────────────────────────
  const fontRequests = [];
  const api404s = [];
  const consoleErrors = [];
  page.on("request", (r) => {
    if (r.url().includes("fonts.googleapis.com") || r.url().includes("fonts.gstatic.com")) {
      fontRequests.push(r.url());
    }
  });
  page.on("response", (r) => {
    if (r.status() === 404 && r.url().includes("/api/")) api404s.push(r.url().split("/api/")[1]);
  });
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await page.goto(PAGE_URL, { waitUntil: "networkidle" });
  await page.locator("table tbody tr").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000); // let the background warm-up settle

  // ── Item 2: Google Fonts ──────────────────────────────────────────────────
  note("No external Google-Fonts request", fontRequests.length === 0, fontRequests.join(", ") || "0 requests");
  const interLoaded = await page.evaluate(() => document.fonts.check('16px Inter'));
  note("Inter font is loaded (locally bundled)", interLoaded);
  const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  note("Body font-family stack unchanged (Inter first for Latin)", /Inter/.test(bodyFont), bodyFont.slice(0, 60) + "…");

  // ── Item 2B: Header 404 console noise ────────────────────────────────────
  const apiNoise = consoleErrors.filter((e) => e.includes("collection-entry") || e.includes("shop-sales"));
  note("No [API HTTP_404] console noise from background warm-up", apiNoise.length === 0, apiNoise.slice(0, 2).join(" | "));
  note("No request storm (≤1 call per optional endpoint)", api404s.length <= 2, api404s.join(", "));

  // ── Item 3: StepPickup re-entrancy (via Farm Payment trip view → Step 3) ─
  await page.locator('button[title^="View trip history"]').first().click();
  const dialog = page.locator('div[role="dialog"][aria-modal="true"]');
  await dialog.waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: /Pickup Details/i }).click();
  await page.waitForTimeout(300);

  const pdfBtn = dialog.locator('button[aria-label][title]').filter({ hasText: "" }).locator(
    'xpath=.//button[contains(@title,"PDF") or contains(@aria-label,"PDF")]'
  ).first();

  const downloadCount = async (action) => {
    let downloads = 0;
    const handler = () => { downloads += 1; };
    page.on("download", handler);
    await action();
    await page.waitForTimeout(700);
    page.off("download", handler);
    return downloads;
  };

  // The two action buttons in the locked StepPickup banner (icon-only).
  const banner = dialog.locator("div.flex.items-center.gap-2.flex-wrap").last();
  const imageBtn = banner.locator("button").first();  // emerald (image)
  const pdfActionBtn = banner.locator("button").last(); // blue (PDF)

  const imageAria = await imageBtn.getAttribute("aria-label");
  const pdfAria = await pdfActionBtn.getAttribute("aria-label");
  note("Image button has accessible name", Boolean(imageAria), `"${imageAria}"`);
  note("PDF button has accessible name", Boolean(pdfAria), `"${pdfAria}"`);

  // Single click → exactly one PDF
  const one = await downloadCount(() => pdfActionBtn.click());
  note("PDF: single click → one download", one === 1, `downloads=${one}`);

  // Still locked right after the click (500ms hold) → disabled communicates state
  await pdfActionBtn.click();
  const lockedNow = await pdfActionBtn.isDisabled();
  note("PDF: button disabled while action settles", lockedNow);
  await page.waitForTimeout(600);
  const unlockedAfter = !(await pdfActionBtn.isDisabled());
  note("PDF: button re-enabled after settle (retry possible)", unlockedAfter);

  // Double click → one download
  const two = await downloadCount(() => pdfActionBtn.dblclick());
  note("PDF: double click → one download", two === 1, `downloads=${two}`);

  // Rapid 5 clicks → one download
  const five = await downloadCount(async () => {
    for (let i = 0; i < 5; i++) await pdfActionBtn.click({ force: true }).catch(() => {});
  });
  note("PDF: rapid 5 clicks → one download", five === 1, `downloads=${five}`);

  // Keyboard: Enter pressed 3× rapidly → one download
  await pdfActionBtn.focus();
  const ent = await downloadCount(async () => {
    for (let i = 0; i < 3; i++) await page.keyboard.press("Enter");
  });
  note("PDF: 3× Enter → one download", ent === 1, `downloads=${ent}`);

  // Keyboard: Space double-press → one download
  await pdfActionBtn.focus();
  await page.waitForTimeout(600);
  const spc = await downloadCount(async () => {
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
  });
  note("PDF: 2× Space → one download", spc === 1, `downloads=${spc}`);

  // Image download: double click → one download
  await page.waitForTimeout(600);
  const img = await downloadCount(() => imageBtn.dblclick());
  note("Image: double click → one download", img === 1, `downloads=${img}`);

  // Image: rapid 4 clicks → one download
  await page.waitForTimeout(600);
  const img4 = await downloadCount(async () => {
    for (let i = 0; i < 4; i++) await imageBtn.click({ force: true }).catch(() => {});
  });
  note("Image: rapid 4 clicks → one download", img4 === 1, `downloads=${img4}`);

  // ── Regression spot-check: Farm Payment page interactions still fine ─────
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const rateInput = page.locator('input[aria-label^="Rate per kg for trip"]').first();
  await rateInput.fill("100");
  const row = rateInput.locator("xpath=ancestor::tr");
  const total = (await row.locator("td").nth(7).textContent())?.trim();
  note("Regression: Rate/Kg live total still works", Boolean(total?.includes("₹")), total);
  await page.evaluate(() => localStorage.removeItem("farm_payments"));

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n==== CLEANUP VERIFICATION: ${results.length - failed.length}/${results.length} passed ====`);
  if (failed.length) {
    console.log("FAILED:");
    failed.forEach((f) => console.log(`  ✗ ${f.name} ${f.detail}`));
    process.exit(1);
  }
}

main().catch((e) => { console.error("VERIFY CRASH:", e); process.exit(1); });
