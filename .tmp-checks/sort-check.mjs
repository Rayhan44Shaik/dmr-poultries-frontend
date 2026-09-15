import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({
  args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage"],
  executablePath: await chromium.executablePath(),
  headless: true,
  defaultViewport: { width: 1600, height: 1150, deviceScaleFactor: 1 },
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};
for (const tab of ["driver-performance", "supervisor-performance"]) {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("dmr-language", "en"));
  await page.goto(`http://127.0.0.1:5173/staff?tab=${tab}`, { waitUntil: "networkidle2" });
  await page.waitForFunction(() => document.querySelectorAll("main table tbody tr").length > 0, { timeout: 30000 });
  await wait(900);
  const box = await page.evaluate(() => {
    const tr = document.querySelectorAll("main table tbody tr")[1];
    const r = tr.getBoundingClientRect();
    return { x: Math.round(r.x + 90), y: Math.round(r.y + r.height / 2) };
  });
  await page.mouse.move(box.x, box.y);
  await wait(300);
  await page.mouse.click(box.x, box.y);
  await page.waitForFunction(() => {
    const v = document.querySelector("[data-performance-view]");
    return !!v && v.querySelectorAll("table tbody tr").length > 0;
  }, { timeout: 15000 });
  await wait(700);

  const read = () =>
    page.evaluate(() => {
      const tables = [...document.querySelectorAll("[data-performance-view] table")];
      const table = tables.find((t) =>
        [...t.querySelectorAll("thead th")].some((th) => /vehicle no/i.test(th.textContent ?? "")),
      );
      if (!table) return { found: false, tables: tables.length };
      const th = [...table.querySelectorAll("thead th")].find((t) => /vehicle no/i.test(t.textContent ?? ""));
      return {
        found: true,
        aria: th.getAttribute("aria-sort"),
        vehicles: [...table.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td")?.textContent.trim()),
      };
    });
  const clickHeader = (label) =>
    page.evaluate((re) => {
      const tables = [...document.querySelectorAll("[data-performance-view] table")];
      const table = tables.find((t) =>
        [...t.querySelectorAll("thead th")].some((th) => new RegExp(re, "i").test(th.textContent ?? "")),
      );
      const th = [...table.querySelectorAll("thead th")].find((t) => new RegExp(re, "i").test(t.textContent ?? ""));
      th.querySelector("button").click();
    }, label);

  const before = await read();
  if (!before.found) {
    out[tab] = { found: false, note: "no vehicle breakdown table" };
    await page.close();
    continue;
  }
  await clickHeader("vehicle no");
  await wait(300);
  const asc = await read();
  await clickHeader("vehicle no");
  await wait(300);
  const desc = await read();
  await clickHeader("vehicle no");
  await wait(300);
  const cleared = await read();
  out[tab] = {
    found: true,
    before: before.vehicles.slice(0, 4),
    asc: { order: asc.vehicles.slice(0, 4), aria: asc.aria },
    desc: { order: desc.vehicles.slice(0, 4), aria: desc.aria },
    cleared: { order: cleared.vehicles.slice(0, 4), aria: cleared.aria, sameAsBefore: JSON.stringify(cleared.vehicles) === JSON.stringify(before.vehicles) },
    ariaOnVehicleHeader: before.aria,
  };
  await page.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
