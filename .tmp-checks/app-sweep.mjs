import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
const ALL = [
  "/dashboard",
  "/masters?tab=vehicles",
  "/operations?tab=trip-list",
  "/operations?tab=rate-entry",
  "/operations?tab=shop-sales",
  "/operations?tab=collection",
  "/operations?tab=pending-collections",
  "/operations?tab=mortality",
  "/operations?tab=fuel-expenses",
  "/fleet?tab=analytics",
  "/staff?tab=duty-planner",
  "/staff?tab=salary-sheet",
  "/staff?tab=leaves",
  "/staff?tab=driver-performance",
  "/staff?tab=supervisor-performance",
  "/accounts?tab=summary",
  "/accounts?tab=farm-payment",
  "/reports?tab=shopLedger",
  "/settings?tab=appearance",
];
const FROM = Number(process.env.FROM ?? 0);
const TO = Number(process.env.TO ?? ALL.length);
const ROUTES = ALL.slice(FROM, TO);
const _UNUSED = [];
const browser = await puppeteer.launch({
  args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage"],
  executablePath: await chromium.executablePath(),
  headless: true,
  defaultViewport: { width: 1600, height: 1150, deviceScaleFactor: 1 },
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
const issues = [];
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) issues.push(`${page.url().split("?")[1] ?? ""} ${m.type()}: ${m.text().slice(0, 110)}`);
});
page.on("pageerror", (e) => issues.push(`${page.url()} pageerror: ${String(e).slice(0, 120)}`));
await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.setItem("dmr-language", "en"));
const rows = {};
for (const route of ROUTES) {
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:5173${route}`, { waitUntil: "domcontentloaded" });
  const ready = await page
    .waitForFunction(() => document.body.innerText.trim().length > 200, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  await wait(700);
  rows[route] = await page.evaluate(() => ({
    tables: document.querySelectorAll("main table").length,
    trs: document.querySelectorAll("main table tbody tr").length,
    empty: (document.body.innerText.match(/No .* found|No data|Nothing here/gi) ?? []).slice(0, 2),
    kpis: document.querySelectorAll("main [class*='shadow-card'], main [class*='rounded-xl']").length,
    text: document.body.innerText.length,
  }));
  rows[route].ready = ready;
  rows[route].ms = Date.now() - t0;
}
console.log(JSON.stringify({ rows, issues }, null, 1));
await browser.close();
