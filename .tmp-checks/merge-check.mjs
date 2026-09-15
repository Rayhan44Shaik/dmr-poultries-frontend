import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const browser = await puppeteer.launch({
  args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage"],
  executablePath: await chromium.executablePath(),
  headless: true,
  defaultViewport: { width: 1600, height: 1150, deviceScaleFactor: 1 },
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};
const issues = [];
for (const tab of ["driver-performance", "supervisor-performance"]) {
  const page = await browser.newPage();
  const reqs = [];
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("/api/")) reqs.push(u.replace(/^https?:\/\/[^/]+/, ""));
  });
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) issues.push(`${tab} ${m.type()}: ${m.text().slice(0, 120)}`);
  });
  page.on("pageerror", (e) => issues.push(`${tab} pageerror: ${String(e).slice(0, 140)}`));

  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("dmr-language", "en"));
  const t0 = Date.now();
  await page.goto(`${BASE}/staff?tab=${tab}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll("main table tbody tr").length > 0, { timeout: 30000 });
  const rowsMs = Date.now() - t0;
  await wait(900);

  const box = await page.evaluate(() => {
    const tr = document.querySelectorAll("main table tbody tr")[1];
    const r = tr.getBoundingClientRect();
    return { x: Math.round(r.x + 90), y: Math.round(r.y + r.height / 2) };
  });
  await page.mouse.move(box.x, box.y);
  await wait(320);
  const tOpen = Date.now();
  await page.mouse.click(box.x, box.y);
  await page.waitForFunction(() => {
    const v = document.querySelector("[data-performance-view]");
    return !!v && v.querySelectorAll("table tbody tr").length > 0;
  }, { timeout: 15000 });
  const openMs = Date.now() - tOpen;

  const view = await page.evaluate(() => {
    const v = document.querySelector("[data-performance-view]");
    const ths = [...v.querySelectorAll("thead th")];
    const header = v.querySelector("thead tr");
    const dateCell = [...v.querySelectorAll("tbody tr td")].map((td) => td.textContent.trim());
    return {
      width: Math.round(v.getBoundingClientRect().width),
      ths: ths.length,
      withIcon: ths.filter((th) => th.querySelector("svg")).length,
      sortable: ths.filter((th) => th.querySelector("button[aria-sort]")).length,
      closes: [...v.querySelectorAll("button[aria-label='Close details']")].map((b) => Math.round(b.getBoundingClientRect().y)),
      tiles: v.querySelectorAll("div[class*='rounded-xl'][class*='bg-white']").length,
      underlines: [...v.querySelectorAll("span")].filter((s) => {
        const c = getComputedStyle(s);
        return c.position === "absolute" && c.backgroundColor !== "rgba(0, 0, 0, 0)";
      }).length,
      tripNos: [...v.querySelectorAll("tbody tr")].map((tr) => tr.textContent.trim().slice(0, 18)).slice(0, 3),
      headerSample: [...header.querySelectorAll("th")].map((th) => th.textContent.trim()).slice(0, 4),
    };
  });

  // vehicle-breakdown sort: click the Vehicle No header button twice
  const sortCheck = await page.evaluate(() => {
    const tables = [...document.querySelectorAll("[data-performance-view] table")];
    const table = tables.find((t) => [...t.querySelectorAll("thead th")].some((th) => /vehicle no/i.test(th.textContent ?? "")));
    if (!table) return { found: false };
    const before = [...table.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td")?.textContent.trim());
    const th = [...table.querySelectorAll("thead th")].find((t) => /vehicle no/i.test(t.textContent ?? ""));
    const btn = th.querySelector("button");
    btn.click();
    return { found: true, before, ariaAfter1: th.getAttribute("aria-sort"), after1: [...table.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td")?.textContent.trim()) };
  });

  // close with the footer X
  const closes = await page.$$("[data-performance-view] button[aria-label='Close details']");
  await closes[closes.length - 1].click();
  await wait(300);
  const closedFooter = !(await page.$("[data-performance-view]"));

  out[tab] = { rowsMs, openMs, view, sortCheck, closedFooter, apiCalls: reqs.length };
  await page.close();
}
// tab-switch speed
const page = await browser.newPage();
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.setItem("dmr-language", "en"));
await page.goto(`${BASE}/staff?tab=driver-performance`, { waitUntil: "networkidle2" });
await page.waitForFunction(() => document.querySelectorAll("main table tbody tr").length > 0, { timeout: 30000 });
await wait(800);
const listCallsBefore = 0;
const tSwitch = Date.now();
await page.evaluate(() => document.querySelector('a[href="/staff?tab=supervisor-performance"]').click());
await page.waitForFunction(() => document.querySelectorAll("main table tbody tr").length > 0, { timeout: 15000 });
out.switchMs = Date.now() - tSwitch;
out.consoleIssues = issues;
console.log(JSON.stringify(out, null, 1));
await browser.close();
