// scripts/dev-mock-backend.mjs
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️  SAMPLE-DATA SERVER FOR PREVIEWS / DEMOS — NOT THE REAL ERP BACKEND ⚠️
//
// The real collection endpoints live in the separate DMR ERP backend (not in
// this repo). In hosted previews there is no backend to reach, so the
// Collection Report correctly shows its error state. Run this stub to explore
// the UI with deterministic sample data:
//
//   npm run mock:backend        # serves sample JSON on http://127.0.0.1:4000
//
// For REAL data, run the actual ERP backend on port 4000 instead — no config
// change needed (the Vite dev proxy targets 127.0.0.1:4000).
// ─────────────────────────────────────────────────────────────────────────────

import http from "node:http";

const PORT = Number(process.env.MOCK_BACKEND_PORT ?? 4000);

// ── Sample masters ───────────────────────────────────────────────────────────
const SHOPS = [
  { id: 1, shopNo: 1, shopNumber: "SHP-001", shopName: "Sri Balaji Poultry Traders", ownerName: "Ramesh K", city: "Hyderabad", status: "Active" },
  { id: 2, shopNo: 2, shopNumber: "SHP-002", shopName: "Venkatadri Egg Suppliers", ownerName: "Suresh M", city: "Hyderabad", status: "Active" },
  { id: 3, shopNo: 3, shopNumber: "SHP-003", shopName: "Annapurna Farms Outlet", ownerName: "Lakshmi D", city: "Secunderabad", status: "Active" },
  { id: 4, shopNo: 4, shopNumber: "SHP-004", shopName: "Kakatiya Poultry Point", ownerName: "Prasad R", city: "Warangal", status: "Active" },
];

const EMPLOYEES = [
  { id: 11, employeeNo: 11, employeeName: "Ravi Kumar", department: "Collection", role: "Collector", status: "Active" },
  { id: 12, employeeNo: 12, employeeName: "Srinivas G", department: "Collection", role: "Collector", status: "Active" },
  { id: 13, employeeNo: 13, employeeName: "Mohan Rao", department: "Collection", role: "Collector", status: "Active" },
  { id: 14, employeeNo: 14, employeeName: "Anil Chand", department: "Collection", role: "Collector", status: "Active" },
  { id: 21, employeeNo: 21, employeeName: "Imran S", department: "Driver", role: "Driver", status: "Active" },
  { id: 22, employeeNo: 22, employeeName: "Kiran P", department: "Driver", role: "Driver", status: "Active" },
].map((e) => ({ phoneNumber: "", email: "", address: "", joiningDate: "2024-04-01", salary: 0, ...e }));

const COLLECTORS = EMPLOYEES.filter((e) => e.department === "Collection").map((e) => e.employeeName);
const MODES = ["Cash", "Union Bank", "HDFC Bank"]; // matches KNOWN_MODES display order

// ── Date helpers (local time, YYYY-MM-DD) ────────────────────────────────────
const iso = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// ── Deterministic pseudo-random (stable output across requests/restarts) ─────
function seeded(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ── Sample collection rows for the last 45 days ──────────────────────────────
function buildRows() {
  const today = new Date();
  const rows = [];
  for (let back = 44; back >= 0; back--) {
    const date = iso(addDays(today, -back));
    const daySeed = Number(date.replaceAll("-", ""));
    SHOPS.forEach((shop, shopIdx) => {
      const rnd = seeded(daySeed * 31 + shopIdx * 7 + 5);
      const count = Math.floor(rnd() * 3); // 0–2 collections per shop/day
      for (let i = 0; i < count; i++) {
        rows.push({
          date,
          collectionNo: `COL-${date.replaceAll("-", "")}-${shop.id}${i + 1}`,
          shopId: shop.id,
          shopName: shop.shopName,
          collector: COLLECTORS[Math.floor(rnd() * COLLECTORS.length)],
          paymentMode: MODES[Math.floor(rnd() * MODES.length)],
          amount: Math.round((800 + rnd() * 5200) / 50) * 50,
        });
      }
    });
  }
  return rows;
}
const ROWS = buildRows();

// ── Report aggregation (mirrors the backend contract consumed by the UI) ─────
function buildReport(query) {
  const today = new Date();
  const day = (today.getDay() + 6) % 7; // Monday-start week
  const fromDate = query.get("fromDate") || iso(addDays(today, -day));
  const toDate = query.get("toDate") || iso(addDays(today, 6 - day));
  const shopId = query.get("shopId") ? Number(query.get("shopId")) : undefined;
  const collector = query.get("collector") || undefined;
  const paymentMode = query.get("paymentMode") || undefined;

  const filtered = ROWS.filter(
    (r) =>
      r.date >= fromDate &&
      r.date <= toDate &&
      (shopId === undefined || r.shopId === shopId) &&
      (collector === undefined || collector === "All Collectors" || r.collector === collector) &&
      (paymentMode === undefined || paymentMode === "All" || r.paymentMode === paymentMode)
  );

  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0);
  const byMode = new Map();
  const byCollector = new Map();
  for (const r of filtered) {
    const m = byMode.get(r.paymentMode) ?? { count: 0, amount: 0, collectors: new Set() };
    m.count += 1;
    m.amount += r.amount;
    m.collectors.add(r.collector);
    byMode.set(r.paymentMode, m);

    const c = byCollector.get(r.collector) ?? { amounts: {}, total: 0 };
    c.amounts[r.paymentMode] = (c.amounts[r.paymentMode] ?? 0) + r.amount;
    c.total += r.amount;
    byCollector.set(r.collector, c);
  }

  const pct = (amount) => (totalAmount > 0 ? Number(((amount / totalAmount) * 100).toFixed(2)) : 0);

  return {
    fromDate,
    toDate,
    totalAmount,
    totalCount: filtered.length,
    totalCollectors: byCollector.size,
    paymentModeSummary: MODES.filter((m) => byMode.has(m)).map((m) => ({
      paymentMode: m,
      count: byMode.get(m).count,
      amount: byMode.get(m).amount,
      percentage: pct(byMode.get(m).amount),
    })),
    collectorsByPaymentMode: MODES.filter((m) => byMode.has(m)).map((m) => ({
      paymentMode: m,
      collectorCount: byMode.get(m).collectors.size,
    })),
    collectorSummary: [...byCollector.entries()].map(([name, c]) => ({
      collector: name,
      amounts: c.amounts,
      total: c.total,
    })),
    _mock: true,
  };
}

// ── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const send = (code, body) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (req.method !== "GET" || !url.pathname.startsWith("/api/")) {
    return send(404, { error: "not_found", mock: true });
  }

  switch (url.pathname) {
    case "/api/health":
      return send(200, { status: "ok", mock: true });
    case "/api/masters/shops":
      return send(200, SHOPS.map((s) => ({ phoneNumber: "", email: "", address: "", paperRate: 0, associationType: "", openingBalance: 0, currentBalance: 0, secondaryPhoneNumber: "", latitude: null, longitude: null, ...s, _mock: true })));
    case "/api/masters/employees":
      return send(200, EMPLOYEES.map((e) => ({ ...e, _mock: true })));
    case "/api/operations/collection-entry/week-bounds": {
      const today = new Date();
      const day = (today.getDay() + 6) % 7;
      return send(200, {
        asOfDate: iso(today),
        weekStart: iso(addDays(today, -day)),
        weekEnd: iso(addDays(today, 6 - day)),
        isCurrentWeek: true,
        _mock: true,
      });
    }
    case "/api/operations/collection-entry/report":
      return send(200, buildReport(url.searchParams));
    case "/api/operations/collection-entry/recent": {
      const shopId = Number(url.searchParams.get("shopId"));
      const limit = Math.min(Number(url.searchParams.get("limit")) || 10, 500);
      if (!Number.isFinite(shopId) || shopId <= 0) return send(200, []);
      const rows = ROWS.filter((r) => r.shopId === shopId)
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) || b.collectionNo.localeCompare(a.collectionNo)
        )
        .slice(0, limit)
        .map((r, idx) => ({
          id: shopId * 10000 + idx,
          collectionNo: r.collectionNo,
          collectionDate: r.date,
          shopId: r.shopId,
          shopName: r.shopName,
          amount: r.amount,
          collector: r.collector,
          paymentMode: r.paymentMode,
          status: "Approved",
          canDelete: true,
          _mock: true,
        }));
      return send(200, rows);
    }
    default:
      return send(404, { error: "not_found", path: url.pathname, mock: true });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-backend] ⚠️  SAMPLE DATA ONLY — listening on http://127.0.0.1:${PORT}`);
  console.log(`[mock-backend] ${ROWS.length} sample collection rows over the last 45 days`);
});
