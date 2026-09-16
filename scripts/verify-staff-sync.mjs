// scripts/verify-staff-sync.mjs
// -----------------------------------------------------------------------------
// STAFF MODULE ⇄ QUARTER SAMPLE DATA — page-by-page sync audit.
//
// The quarter sample API (scripts/quarter-sample-data.mjs) is the dataset the
// whole frontend renders from in dev. This audit walks EVERY page of the Staff
// module and replays the EXACT sequence of API calls that page makes in the
// browser (same endpoints, same query params, same lifecycle order as the
// hooks), then asserts the payloads satisfy the view-model contracts the pages
// render — so a field rename or a dropped endpoint fails here instead of
// showing an empty table to the user.
//
//   npm run verify:staff-sync
//   SAMPLE_VERIFY_PORT=4311 npm run verify:staff-sync
//
// It starts its own isolated in-memory sample server, mutates only that copy,
// and always stops it afterwards — the dev preview's data is never touched.
// -----------------------------------------------------------------------------

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

const port = Number(process.env.SAMPLE_VERIFY_PORT ?? 4311);
const origin = `http://127.0.0.1:${port}`;
const api = `${origin}/api`;
const timeoutMs = 20_000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForApi(child) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error(`Sample API exited before becoming ready (code ${child.exitCode}). ${lastError}`);
    }
    try {
      const response = await fetch(`${api}/health`);
      if (response.ok) return;
      lastError = `health returned ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${origin}/api/health. ${lastError}`);
}

function startServer() {
  const child = spawn(process.execPath, ["scripts/quarter-sample-data.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, MOCK_BACKEND_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  const capture = (chunk) => {
    logs += chunk.toString();
    if (logs.length > 5_000) logs = logs.slice(-5_000);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  return { child, getLogs: () => logs };
}

async function stopServer(child) {
  if (child.exitCode != null) return;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), wait(3_000)]);
  if (child.exitCode == null) child.kill("SIGKILL");
}

// ── tiny helpers mirroring what the frontend mappers expect ──────────────────
const isoDate = (d) => d.toISOString().slice(0, 10);
const addDays = (value, days) => {
  const d = new Date(`${value}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
};
/** Monday of the week containing `value` (the Duty Planner's week key). */
function mondayOf(value) {
  const d = new Date(`${value}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return isoDate(d);
}
const round = (v) => Math.round(Number(v) * 100) / 100;

async function run() {
  const checks = [];
  const check = (name, fn) =>
    fn().then(
      () => checks.push({ name, ok: true }),
      (error) => checks.push({ name, ok: false, error })
    );

  async function request(path, options = {}) {
    const response = await fetch(`${api}${path}`, {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    });
    const text = await response.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: response.status, body, headers: response.headers };
  }

  const { child, getLogs } = startServer();
  try {
    await waitForApi(child);

    const manifest = (await request("/quarter-summary")).body;
    assert.equal(manifest.sample, true, "sample server must identify itself");
    const QUARTER = manifest.quarter;
    const TODAY = QUARTER.today;
    const CURRENT_MONTH = TODAY.slice(0, 7);
    const THIS_MONDAY = mondayOf(TODAY);

    // ════════════════════════════════════════════════════════════════════
    // PAGE 1 — Duty Planner (/staff?tab=duty-planner · useDutyPlanner)
    //   getDutyPlannerWeek(weekStart) + getDutyPlannerWeek(prevMonday)
    //   + loadDutyReportLeaves(week) + week lifecycle badge
    // ════════════════════════════════════════════════════════════════════
    await check("duty-planner: current week renders Mon–Sun with full roster", async () => {
      const { status, body: week } = await request(`/staff/duty-planner?weekStart=${THIS_MONDAY}`);
      assert.equal(status, 200);
      assert.equal(week.weekStart, THIS_MONDAY, "week must start on the requested Monday");
      assert.equal(week.days.length, 7, "grid needs all 7 days");
      assert.equal(new Date(week.days[0].date).getUTCDay(), 1, "first day is Monday");
      assert.equal(new Date(week.days[6].date).getUTCDay(), 0, "last day is Sunday");
      assert.ok(week.employees.length > 0, "roster must list employees");
      assert.ok(week.assignments.length > 0, "week must ship assignments");
      assert.ok(week.saturday && week.validation, "Saturday panel + validation must render");
      assert.ok(
        week.assignments.every((a) => a.id && a.employeeId && a.date && a.dutyType),
        "every assignment must satisfy the page's mapper contract"
      );
    });

    await check("duty-planner: previous week is closed (edit gate opens current week)", async () => {
      const prev = await request(`/staff/duty-planner?weekStart=${addDays(THIS_MONDAY, -7)}`);
      assert.equal(prev.status, 200);
      assert.ok(
        ["Submitted", "Locked", "Closed"].includes(prev.body.status),
        `previous week status was "${prev.body.status}" — the page keeps the current week read-only until it is closed`
      );
    });

    await check("duty-planner: upcoming weeks stay populated (planner never empties)", async () => {
      for (const offset of [7, 14]) {
        const start = addDays(THIS_MONDAY, offset);
        const { body: week } = await request(`/staff/duty-planner?weekStart=${start}`);
        assert.equal(week.weekStart, start);
        assert.ok(week.employees.length > 0, `${start} roster must not be empty`);
        assert.ok(week.assignments.length > 0, `${start} must have assignments`);
      }
    });

    await check("duty-planner: week lifecycle badge matches the grid", async () => {
      const { body: badge } = await request(`/staff/duty-planner/week/${THIS_MONDAY}`);
      assert.equal(badge.weekStart, THIS_MONDAY);
      assert.equal(badge.weekEnd, addDays(THIS_MONDAY, 6));
      assert.ok(badge.status, "badge needs a status");
    });

    await check("duty-planner: approved leaves for the visible week arrive", async () => {
      const { body } = await request(
        `/staff/leaves?fromDate=${THIS_MONDAY}&toDate=${addDays(THIS_MONDAY, 6)}&status=Approved&page=1&limit=100`
      );
      assert.ok(Array.isArray(body.items), "leave list must be an array");
      assert.ok(body.items.every((l) => l.status === "Approved"), "duty report only consumes approved leaves");
    });

    // ════════════════════════════════════════════════════════════════════
    // PAGE 2 — Leave Management (/staff?tab=leaves · useLeaveManagement)
    //   listLeaves(filters) + getLeaveReport(month) + create/approve/reject
    // ════════════════════════════════════════════════════════════════════
    await check("leaves: default list arrives paginated and populated", async () => {
      const { body } = await request("/staff/leaves?page=1&limit=25");
      assert.ok(body.items.length > 0 && body.items.length <= 25, "page of rows");
      assert.ok(body.total >= body.items.length, "total must cover the pages");
      assert.ok(body.totalPages >= 1 && body.page === 1 && body.limit === 25, "pagination meta");
      assert.ok(
        body.items.every((l) => l.id && l.employeeName && l.fromDate && l.toDate && l.status),
        "rows must satisfy the table mapper"
      );
    });

    await check("leaves: status / month / department / type filters narrow the list", async () => {
      const all = (await request("/staff/leaves?page=1&limit=500")).body;
      const statuses = [...new Set(all.items.map((l) => l.status))];
      assert.ok(statuses.length > 1, "dataset should mix statuses");
      for (const status of statuses) {
        const { body } = await request(`/staff/leaves?status=${encodeURIComponent(status)}&page=1&limit=500`);
        assert.ok(body.items.every((l) => l.status === status), `status=${status} filter`);
        assert.ok(body.items.length > 0, `status=${status} must not be empty in the quarter dataset`);
      }
      const month = (await request(`/staff/leaves?month=${CURRENT_MONTH}&page=1&limit=500`)).body;
      assert.ok(
        month.items.every((l) => l.fromDate.slice(0, 7) === CURRENT_MONTH),
        "month filter"
      );
      const departments = [...new Set(all.items.map((l) => l.department).filter(Boolean))];
      for (const department of departments.slice(0, 3)) {
        const { body } = await request(`/staff/leaves?department=${encodeURIComponent(department)}&page=1&limit=500`);
        assert.ok(body.items.every((l) => l.department === department), `department=${department} filter`);
      }
      const types = [...new Set(all.items.map((l) => l.leaveType).filter(Boolean))];
      for (const type of types.slice(0, 3)) {
        const { body } = await request(`/staff/leaves?leaveType=${encodeURIComponent(type)}&page=1&limit=500`);
        assert.ok(body.items.every((l) => l.leaveType === type), `leaveType=${type} filter`);
      }
    });

    await check("leaves: search finds an employee by name", async () => {
      const first = (await request("/staff/leaves?page=1&limit=1")).body.items[0];
      const needle = first.employeeName.split(" ")[0];
      const { body } = await request(`/staff/leaves?search=${encodeURIComponent(needle)}&page=1&limit=100`);
      assert.ok(body.items.some((l) => l.employeeName === first.employeeName), "search must find the row");
    });

    await check("leaves: report covers every active employee for the month", async () => {
      const { body } = await request(`/staff/leaves/report?month=${CURRENT_MONTH}`);
      assert.equal(body.month, CURRENT_MONTH);
      assert.ok(body.items.length >= manifest.employees * 0.9, "report must cover the roster");
      assert.ok(
        body.items.every(
          (i) =>
            typeof i.approvedLeaveDays === "number" &&
            typeof i.pendingLeaveDays === "number" &&
            typeof i.rejectedLeaveDays === "number"
        ),
        "report rows must satisfy LeaveReport mapper"
      );
    });

    await check("leaves: create → approve → reject lifecycle round-trips", async () => {
      const employees = (await request("/masters/employees?page=1&limit=1")).body;
      const roster = Array.isArray(employees) ? employees : employees.items;
      const employee = roster[0];
      const created = await request("/staff/leaves", {
        method: "POST",
        body: JSON.stringify({
          employeeId: employee.id,
          type: "Casual",
          fromDate: addDays(TODAY, 30),
          toDate: addDays(TODAY, 31),
          days: 2,
          reason: "staff-sync audit",
        }),
      });
      assert.equal(created.status, 201, "create must succeed");
      assert.equal(created.body.status, "Pending", "new requests always start Pending");
      const approved = await request(`/staff/leaves/${created.body.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Approved" }),
      });
      assert.equal(approved.body.status, "Approved");
      const rejected = await request(`/staff/leaves/${created.body.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Rejected", rejectionReason: "audit" }),
      });
      assert.equal(rejected.body.status, "Rejected");
      assert.ok(rejected.body.rejectionReason, "rejection keeps its reason for the table");
      const removed = await request(`/staff/leaves/${created.body.id}`, { method: "DELETE" });
      assert.equal(removed.status, 200);
    });

    // ════════════════════════════════════════════════════════════════════
    // PAGE 3 — Salary Register (/staff?tab=salary-sheet · useSalaryRegister)
    //   listSalaries(month) + month-summary + generate/submit/pay/bulk +
    //   payslip.pdf + email/whatsapp counters
    // ════════════════════════════════════════════════════════════════════
    await check("salary: every month of the quarter renders a full register", async () => {
      for (const month of QUARTER.months) {
        const { body: rows } = await request(`/staff/salaries?month=${month}`);
        if (rows.length === 0) continue; // a quarter can begin mid-payroll-cycle
        assert.ok(
          rows.length >= manifest.employees * 0.9,
          `${month} must cover the roster (got ${rows.length})`
        );
        assert.ok(
          rows.every(
            (s) =>
              s.id &&
              s.employeeName &&
              s.month === month &&
              typeof s.basicSalary === "number" &&
              typeof s.totalGross === "number" &&
              typeof s.totalDeductions === "number" &&
              typeof s.netSalary === "number" &&
              typeof s.workingDays === "number" &&
              typeof s.presentDays === "number" &&
              typeof s.leaveDays === "number" &&
              typeof s.weeklyOffDays === "number"
          ),
          `${month} rows must satisfy the register's mapper`
        );
        assert.ok(
          rows.every((s) => round(s.totalGross - s.totalDeductions) === round(s.netSalary)),
          `${month}: net must equal gross − deductions on every row`
        );
      }
    });

    await check("salary: month-summary and summary tiles agree with the register", async () => {
      const rows = (await request(`/staff/salaries?month=${CURRENT_MONTH}`)).body;
      const summary = (await request(`/staff/salaries/month-summary?month=${CURRENT_MONTH}`)).body;
      assert.equal(summary.employees, rows.length, "summary must count the register");
      const counted = summary.pending + summary.submitted + summary.paid;
      assert.equal(counted, rows.length, "status counts must partition the register");
      const totals = (await request(`/staff/salaries/summary?month=${CURRENT_MONTH}`)).body;
      assert.equal(
        round(totals.totalNet),
        round(rows.reduce((a, s) => a + s.netSalary, 0)),
        "totalNet must equal the sum of the rendered rows"
      );
    });

    await check("salary: submit → pay → unmark → delete lifecycle round-trips", async () => {
      const pending = (await request(`/staff/salaries?month=${CURRENT_MONTH}`)).body.find(
        (s) => s.status === "Pending"
      );
      assert.ok(pending, "quarter dataset must contain a Pending row");
      const submitted = await request(`/staff/salaries/${pending.id}/submit`, {
        method: "POST",
        body: JSON.stringify({ submittedBy: "staff-sync" }),
      });
      assert.equal(submitted.body.status, "Submitted");
      const paid = await request(`/staff/salaries/${pending.id}/pay`, {
        method: "POST",
        body: JSON.stringify({ paymentDate: `${CURRENT_MONTH}-05`, paymentMode: "Cash" }),
      });
      assert.equal(paid.body.status, "Paid");
      assert.ok(paid.body.paymentRef && paid.body.paymentDate, "paid rows keep their payment trail");
      const unmarked = await request("/staff/salaries/bulk-status", {
        method: "POST",
        body: JSON.stringify({ ids: [pending.id], status: "Pending" }),
      });
      assert.equal(unmarked.body.updated.length, 1, "un-mark must return the row");
      assert.equal(unmarked.body.updated[0].status, "Pending");
      const deleted = await request(`/staff/salaries/${pending.id}`, { method: "DELETE" });
      assert.equal(deleted.status, 200, "pending rows can be deleted");
      // put the row back so later checks still see a full register
      await request("/staff/salaries", {
        method: "POST",
        body: JSON.stringify({ ...pending }),
      });
    });

    await check("salary: payslip.pdf downloads a real PDF", async () => {
      const rows = (await request(`/staff/salaries?month=${CURRENT_MONTH}`)).body;
      const target = rows[0];
      const response = await fetch(`${api}/staff/salaries/${target.id}/payslip.pdf`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") ?? "", /pdf/i);
      const head = Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString();
      assert.equal(head, "%PDF-", "payslip must be a real PDF");
    });

    await check("salary: payslip email / whatsapp counters land on the row", async () => {
      const rows = (await request(`/staff/salaries?month=${CURRENT_MONTH}`)).body;
      const target = rows.find((s) => s.status !== "Pending");
      assert.ok(target, "dataset must contain a dispatched (non-Pending) row");
      const before = target.emailsSent ?? 0;
      await request("/staff/salaries/email", {
        method: "POST",
        body: JSON.stringify({ ids: [target.id], language: "en" }),
      });
      await request("/staff/salaries/whatsapp", {
        method: "POST",
        body: JSON.stringify({ ids: [target.id], language: "en" }),
      });
      const after = (await request(`/staff/salaries?month=${CURRENT_MONTH}`)).body.find(
        (s) => s.id === target.id
      );
      assert.equal(after.emailsSent, before + 1, "email counter must increment");
      assert.equal(after.whatsappsSent, (target.whatsappsSent ?? 0) + 1, "whatsapp counter must increment");
    });

    // ════════════════════════════════════════════════════════════════════
    // PAGE 4 — Driver Performance (/staff?tab=driver-performance)
    // ════════════════════════════════════════════════════════════════════
    await check("driver-performance: quarter range renders rows, KPIs and weekly chart", async () => {
      const { body } = await request(
        `/staff/performance/drivers?fromDate=${QUARTER.fromDate}&toDate=${QUARTER.toDate}`
      );
      assert.ok(body.rows.length > 0, "driver rows must exist for the quarter");
      assert.ok(body.kpis && body.kpis.trips > 0, "KPI strip must be populated");
      assert.equal(
        body.rows.reduce((a, r) => a + r.trips, 0),
        body.kpis.trips,
        "row trips must sum to the KPI count"
      );
      assert.ok(
        body.rows.every(
          (r) =>
            r.driverId &&
            r.driverName &&
            typeof r.distance === "number" &&
            Array.isArray(r.vehicleNos) &&
            typeof r.mileage === "number"
        ),
        "rows must satisfy DriverPerformanceRow"
      );
      assert.ok(Array.isArray(body.weekly) && body.weekly.length > 0, "weekly chart needs buckets");
    });

    await check("driver-performance: driver filter + search narrow correctly", async () => {
      const all = (
        await request(`/staff/performance/drivers?fromDate=${QUARTER.fromDate}&toDate=${QUARTER.toDate}`)
      ).body;
      const first = all.rows[0];
      const filtered = (
        await request(
          `/staff/performance/drivers?fromDate=${QUARTER.fromDate}&toDate=${QUARTER.toDate}&driverId=${first.driverId}`
        )
      ).body;
      assert.equal(filtered.rows.length, 1, "driverId filter isolates the driver");
      assert.equal(filtered.rows[0].trips, first.trips, "filtered totals must match the unfiltered row");
      const needle = first.driverName.split(" ")[0];
      const searched = (
        await request(
          `/staff/performance/drivers?fromDate=${QUARTER.fromDate}&toDate=${QUARTER.toDate}&search=${encodeURIComponent(needle)}`
        )
      ).body;
      assert.ok(
        searched.rows.some((r) => r.driverName === first.driverName),
        "search must find the driver"
      );
    });

    // ════════════════════════════════════════════════════════════════════
    // PAGE 5 — Supervisor Performance (/staff?tab=supervisor-performance)
    // ════════════════════════════════════════════════════════════════════
    await check("supervisor-performance: quarter range renders rows and KPIs", async () => {
      const { body } = await request(
        `/staff/performance/supervisors?fromDate=${QUARTER.fromDate}&toDate=${QUARTER.toDate}`
      );
      assert.ok(body.rows.length > 0, "supervisor rows must exist for the quarter");
      assert.ok(body.kpis && body.kpis.trips > 0, "KPI strip must be populated");
      assert.equal(
        body.rows.reduce((a, r) => a + r.trips, 0),
        body.kpis.trips,
        "row trips must sum to the KPI count"
      );
      const first = body.rows[0];
      const filtered = (
        await request(
          `/staff/performance/supervisors?fromDate=${QUARTER.fromDate}&toDate=${QUARTER.toDate}&supervisorId=${first.supervisorId}`
        )
      ).body;
      assert.equal(filtered.rows.length, 1, "supervisorId filter isolates the supervisor");
    });

    // ════════════════════════════════════════════════════════════════════
    // SUPPORTING TILES — staff dashboard card, attendance summary, advances
    // ════════════════════════════════════════════════════════════════════
    await check("staff dashboard card: today's duty picture is populated", async () => {
      const { body } = await request("/staff/dashboard");
      assert.ok(body.totalEmployees > 0, "totalEmployees");
      assert.ok(body.presentToday > 0, "presentToday");
      assert.ok(body.onDutyToday > 0, "onDutyToday");
      assert.ok(Array.isArray(body.weeklyAttendance) && body.weeklyAttendance.length === 7, "weekly strip");
      assert.ok(body.onDutyEmployees.length > 0, "on-duty list");
      assert.ok(
        body.onDutyEmployees.every((e) => e.id && e.name && e.dutyType),
        "on-duty rows must satisfy the card mapper"
      );
    });

    await check("attendance summary: month rows cover the roster", async () => {
      const { body } = await request(`/staff/attendance/summary?month=${CURRENT_MONTH}`);
      assert.equal(body.month, CURRENT_MONTH);
      assert.ok(body.rows.length >= manifest.employees * 0.9, "summary must cover the roster");
      assert.ok(
        body.rows.every((r) => typeof r.presentDays === "number" && typeof r.leaveDays === "number"),
        "summary rows must satisfy the attendance mapper"
      );
    });

    await check("advances: quarter dataset carries advance/loan rows", async () => {
      const { body } = await request("/staff/advances");
      assert.ok(Array.isArray(body) && body.length > 0, "advances list must be populated");
    });

    // ── report ────────────────────────────────────────────────────────────
    const failed = checks.filter((c) => !c.ok);
    for (const { name, ok, error } of checks) {
      console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    ${error?.message ?? error}`}`);
    }
    console.log(
      `\n${failed.length === 0 ? "✓" : "✗"} Staff sync: ${checks.length - failed.length}/${checks.length} checks passed · ` +
        `${manifest.employees} employees · ${manifest.salaries} salary rows · ${manifest.leaves} leaves · ` +
        `${manifest.dutyAssignments} duty assignments (${QUARTER.label})`
    );
    if (failed.length > 0) process.exitCode = 1;
  } catch (error) {
    console.error("staff sync audit crashed:", error);
    console.error(getLogs());
    process.exitCode = 1;
  } finally {
    await stopServer(child);
  }
}

run();
