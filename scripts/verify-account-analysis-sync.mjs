// Read-only Account Analysis audit. Requires the running quarter sample API.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const server = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true } });
try {
 const { apiClient } = await server.ssrLoadModule('/src/api/client.ts');
 apiClient.defaults.baseURL = process.env.API ?? 'http://127.0.0.1:4000/api';
 const { data: manifest } = await apiClient.get('/quarter-summary');
 assert.equal(manifest.sample, true, 'Quarter sample API required');
 const { fromDate, toDate } = manifest.quarter;
 const { loadAnalysisSnapshot, createAnalysisService } = await server.ssrLoadModule('/src/modules/accounts/services/analysisService.ts');
 const snapshotRequests = [];
 const requestInterceptor = apiClient.interceptors.request.use(config => { snapshotRequests.push(config.url); return config; });
 const snapshotStarted = performance.now();
 const [snapshot, joinedSnapshot] = await Promise.all([loadAnalysisSnapshot(), loadAnalysisSnapshot()]);
 apiClient.interceptors.request.eject(requestInterceptor);
 assert.strictEqual(snapshot, joinedSnapshot, 'Concurrent loads share one snapshot');
 assert.equal(snapshotRequests.filter(path => path === '/trips').length, 1, 'Trips loaded once');
 assert(!snapshotRequests.some(path => path.includes('shop-sales') || path.includes('/masters/shops')), 'Analysis does not download unrelated sale/shop registers');
 console.log('PASS snapshot traffic', JSON.stringify({requests: snapshotRequests.length, elapsedMs: Math.round(performance.now() - snapshotStarted), sharedConcurrentLoad: true}));
 const service = createAnalysisService(snapshot);
 const start = new Date(`${fromDate}T00:00:00`); const end = new Date(`${toDate}T23:59:59.999`);
 const trips = service.getCompletedTripsByDateRange(start, end);
 const metrics = service.computeMetrics(trips, service.getApprovedCollectionsByDateRange(start, end));
 const expenses = service.computeEffectiveExpenses(trips, start, end);
 assert(trips.length > 0); assert(metrics.sales > 0); assert(metrics.collection > 0);
 for (const category of ['farm','fuel','trip','salary','maintenance','office']) assert(expenses[category] > 0, category);
 console.log('PASS live Account Analysis: ', JSON.stringify({ trips: trips.length, metrics, expenses }));
 const { paymentExpenseSector } = await server.ssrLoadModule('/src/modules/accounts/utils/paymentRegister.ts');
 // Register-only view: no trips, so no trip-linked farm cost — every category
 // here is purely the Approved Payment Register.
 const ledgerOnly = createAnalysisService({ trips: [], collections: [], payments: snapshot.payments, farmPayments: [] }).computeEffectiveExpenses([], start, end);
 for (const category of Object.keys(ledgerOnly)) {
   // Farm is no longer register-sourced: with no trips its value is 0 by
   // construction, so the "mapped once from the register" rule cannot apply.
   if (category === 'farm') continue;
   const expected = snapshot.payments.filter(p => p.status === 'Approved' && paymentExpenseSector(p.paymentType, p.category) === category && p.paymentDate >= fromDate && p.paymentDate <= toDate).reduce((sum,p)=>sum+Number(p.amount),0);
   assert(Math.abs(expected-ledgerOnly[category]) < .01, `${category}: ledger mapped once`);
 }
 assert.equal(ledgerOnly.farm, 0, 'with no trips there is no trip-linked farm cost');
 // Every category except farm must still be exactly the Payment Register.
 for (const category of Object.keys(ledgerOnly)) {
   if (category === 'farm') continue;
   assert(Math.abs(expenses[category] - ledgerOnly[category]) < .01, `${category}: register is the sole source`);
 }
 // Farm Payment is the one category that is NOT the register: it is the
 // trip-linked farm cost (dcWeight × rate) of exactly the trips being analysed,
 // because that is what each trip actually cost and it can be attributed to it.
 const farmTripLinked = snapshot.farmPayments
   .filter(row => trips.some(trip => String(trip.id) === String(row.tripId)))
   .reduce((sum, row) => sum + Number(row.amount), 0);
 assert(Math.abs(expenses.farm - farmTripLinked) < .01, 'farm expense = trip-linked farm cost of the analysed trips');
 for (const trip of trips) {
   assert(snapshot.farmPayments.some(row => String(row.tripId) === String(trip.id)), `${trip.tripNo}: carries its farm payment`);
 }
 // The register's "Farmer Payment" rows are the cash settlement of that same
 // cost. They must NOT be added on top, or every farmer rupee counts twice.
 const registerFarmer = snapshot.payments.filter(p => p.status === 'Approved' && paymentExpenseSector(p.paymentType, p.category) === 'farm' && p.paymentDate >= fromDate && p.paymentDate <= toDate).reduce((sum,p)=>sum+Number(p.amount),0);
 assert(registerFarmer > 0, 'the register holds farmer settlements for this audit to exclude');
 assert(Math.abs(expenses.farm - (farmTripLinked + registerFarmer)) > .01, 'register farmer settlements must not be double-counted');
 const netProfit = metrics.sales - Object.values(expenses).reduce((sum, value) => sum + value, 0);
 console.log('PASS every approved ledger category is counted exactly once; farm is trip-linked', JSON.stringify({ farmTripLinked, registerFarmerSettlementsExcluded: registerFarmer, sales: metrics.sales, totalExpenses: Object.values(expenses).reduce((sum, value) => sum + value, 0), netProfit }));
 const { loadPaymentRegisterSummary } = await server.ssrLoadModule('/src/modules/operations/dashboard/services/paymentRegisterSummary.ts');
 const dashboardPayments = await loadPaymentRegisterSummary(fromDate, toDate);
 // The dashboard counts EVERY approved register payment — farmer settlements
 // included. The Analysis expense breakdown deliberately leaves those out of
 // the farm sector (the trip-linked cost already carries them), so the two
 // figures differ by exactly the farmer settlements and nothing else.
 const settledLedgerTotal = Object.values(ledgerOnly).reduce((sum, value) => sum + value, 0) + registerFarmer;
 assert(Math.abs(dashboardPayments.totalAmount - settledLedgerTotal) < .01, 'Dashboard payments match the full Approved Payment Register');
 console.log('PASS dashboard payments match expense ledger', dashboardPayments.totalAmount, dashboardPayments.totalCount, '· farmer settlements held outside the farm sector:', registerFarmer);

 const { listCompletedTrips } = await server.ssrLoadModule('/src/modules/operations/vehicle-trips/services/tripHeaderApiService.ts');
 const { filterTripListTrips } = await server.ssrLoadModule('/src/modules/operations/vehicle-trips/utils/filterTripList.ts');
 const { weekRange, monthRange } = await server.ssrLoadModule('/src/modules/accounts/utils/periodRanges.ts');
 const { analysisWeeks } = await server.ssrLoadModule('/src/modules/accounts/utils/analysisWeeks.ts');
 const { toBusinessDate, parseBusinessDate } = await server.ssrLoadModule('/src/utils/businessDate.ts');
 const listRows = [];
 let page = 1, totalPages = 1;
 do {
   const result = await listCompletedTrips({page, limit: 250});
   listRows.push(...result.data); totalPages = result.meta.totalPages; page++;
 } while (page <= totalPages);
 for (const [name, range] of [['This week', weekRange(new Date(`${toDate}T12:00:00`))], ['Month view', monthRange(new Date(`${toDate}T12:00:00`))], ['Full sample', {start, end}]]) {
   const list = filterTripListTrips(listRows, {fromDate: toBusinessDate(range.start), toDate: toBusinessDate(range.end)});
   const analysis = service.getCompletedTripsByDateRange(range.start, range.end);
   assert.deepEqual([...new Set(list.map(t => t.id))].sort(), analysis.map(t => t.id).sort(), `${name}: Trip List and Analysis IDs match`);
   const metrics = service.computeMetrics(analysis, service.getApprovedCollectionsByDateRange(range.start, range.end));
   for (const [metric, field] of [['birds','totalBirds'], ['weight','totalWeight'], ['mortality','totalMortality']]) {
     assert(Math.abs(metrics[metric] - list.reduce((sum, row) => sum + Number(row[field] || 0), 0)) < .01, `${name}: ${metric}`);
   }
   const groups = analysisWeeks(range.start, range.end);
   for (const trip of analysis) {
     const date = parseBusinessDate(trip.tripDate.slice(0,10));
     assert.equal(groups.filter(g => date >= g.start && date <= g.end).length, 1, `${trip.tripNo}: grouped exactly once`);
   }
    const expenses = service.computeEffectiveExpenses(analysis, range.start, range.end);

    /* ── Farm Payment — per trip ─────────────────────────────────────────────
       These are the very rows the Analysis page renders in its own table: one
       per trip in the span, with that trip's pickup (DC) weight and farm rate,
       what has been paid and what is still owed. Audited here so the table can
       never show a weight/rate/amount that does not reconcile with the Farm
       Payment expense row above it. */
    const farmRows = analysis
      .map(trip => ({trip, farm: service.getFarmPaymentForTrip(trip.id)}))
      .filter(row => row.farm)
      .sort((a,b) => String(b.trip.tripDate).localeCompare(String(a.trip.tripDate)) || b.trip.id - a.trip.id);
    const farmWeightKg = farmRows.reduce((sum,row) => sum + (row.farm.dcWeight ?? row.trip.dcWeight ?? 0), 0);
    const farmTotals = service.farmTotalsForTrips(analysis);
    assert.equal(new Set(farmRows.map(r => r.trip.id)).size, farmRows.length, `${name}: one farm row per trip`);
    assert.equal(farmRows.length, analysis.filter(trip => service.getFarmPaymentForTrip(trip.id)).length, `${name}: every analysed trip with a farm payment gets a row`);
    for (const {trip, farm} of farmRows) {
      const weight = farm.dcWeight ?? trip.dcWeight ?? 0;
      assert(Math.abs(weight * Number(farm.rate) - Number(farm.amount)) < .01, `${trip.tripNo}: pickup weight × rate = farm payment`);
      assert(Math.abs(Number(farm.paidAmount) + Number(farm.balance) - Number(farm.amount)) < .01, `${trip.tripNo}: paid + balance = farm payment`);
    }
    assert.deepEqual(farmRows.map(r => r.trip.tripDate), [...farmRows.map(r => r.trip.tripDate)].sort().reverse(), `${name}: newest trip first`);
    const rowPayable = farmRows.reduce((sum,row) => sum + Number(row.farm.amount), 0);
    assert(Math.abs(rowPayable - farmTotals.payable) < .01, `${name}: rows total = farm totals payable`);
    assert(Math.abs(rowPayable - expenses.farm) < .01, `${name}: rows total = Farm Payment expense row`);
    assert(Math.abs(farmTotals.paid + farmTotals.balance - farmTotals.payable) < .01, `${name}: farm paid + balance = payable`);
    assert(Math.abs(farmWeightKg - metrics.weight) < .01, `${name}: table pickup weight = Birds in KG of the same trips`);
    // The expense table prints one Farm Payment figure per week plus a Total.
    // Each week's figure is that week's trips' farm payment, so the columns must
    // add up to the span's farm expense — the same number the farm payment view
    // calls its cumulative.
    const weeklyFarm = groups.reduce((sum, g) => {
      const weekTrips = service.getCompletedTripsByDateRange(g.start, g.end);
      const weekFarm = service.computeEffectiveExpenses(weekTrips, g.start, g.end).farm;
      // Pressing that column's amount opens exactly these trips, so their own
      // farm bills must add up to the figure printed in the cell.
      assert(Math.abs(service.farmTotalsForTrips(weekTrips).payable - weekFarm) < .01, `${name} ${g.label}: the column's trips total the amount it prints`);
      return sum + weekFarm;
    }, 0);
    assert(Math.abs(weeklyFarm - expenses.farm) < .01, `${name}: weekly Farm Payment columns add up to the span's farm expense`);
    assert(Math.abs(weeklyFarm - rowPayable) < .01, `${name}: Farm Payment row = cumulative of the per-trip farm rows`);
    const registerFarmInSpan = snapshot.payments.filter(p => p.status === 'Approved' && paymentExpenseSector(p.paymentType, p.category) === 'farm').reduce((sum, p) => sum + Number(p.amount), 0);
    assert(registerFarmInSpan === 0 || Math.abs(weeklyFarm - registerFarmInSpan) > .01, `${name}: Farm Payment row is not the Payment Register's farmer settlements (${registerFarmInSpan})`);
    const spanNetProfit = metrics.sales - Object.values(expenses).reduce((sum, value) => sum + value, 0);
    console.log('PASS farm payment per trip', name, JSON.stringify({rows:farmRows.length, pickupWeightKg:Math.round(farmWeightKg*100)/100, payable:farmTotals.payable, paid:farmTotals.paid, balance:farmTotals.balance, netProfit:Math.round(spanNetProfit*100)/100, firstRow:{tripNo:farmRows[0]?.trip.tripNo, weight:farmRows[0]?.farm.dcWeight, rate:farmRows[0]?.farm.rate, amount:farmRows[0]?.farm.amount}}));
    console.log('PASS reconciliation', name, toBusinessDate(range.start), toBusinessDate(range.end), JSON.stringify({metrics,expenses,...(name === 'This week' ? {trips:analysis.map(t=>({id:t.id,tripNo:t.tripNo,date:t.tripDate,status:t.status}))} : {})}));
 }

} finally { await server.close(); }
