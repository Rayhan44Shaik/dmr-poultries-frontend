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
 const ledgerOnly = createAnalysisService({ trips: [], collections: [], payments: snapshot.payments }).computeEffectiveExpenses([], start, end);
 for (const category of Object.keys(ledgerOnly)) {
   const expected = snapshot.payments.filter(p => p.status === 'Approved' && paymentExpenseSector(p.paymentType, p.category) === category && p.paymentDate >= fromDate && p.paymentDate <= toDate).reduce((sum,p)=>sum+Number(p.amount),0);
   assert(Math.abs(expected-ledgerOnly[category]) < .01, `${category}: ledger mapped once`);
 }
 assert.deepEqual(expenses, ledgerOnly, 'No direct farm/trip expenses added to Payment Register');
 console.log('PASS every approved ledger category is counted exactly once');
 const { loadPaymentRegisterSummary } = await server.ssrLoadModule('/src/modules/operations/dashboard/services/paymentRegisterSummary.ts');
 const dashboardPayments = await loadPaymentRegisterSummary(fromDate, toDate);
 const settledLedgerTotal = Object.values(ledgerOnly).reduce((sum, value) => sum + value, 0);
 assert(Math.abs(dashboardPayments.totalAmount - settledLedgerTotal) < .01, 'Dashboard payments match Analysis ledger');
 console.log('PASS dashboard payments match expense ledger', dashboardPayments.totalAmount, dashboardPayments.totalCount);

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
   console.log('PASS reconciliation', name, toBusinessDate(range.start), toBusinessDate(range.end), JSON.stringify({metrics,expenses,...(name === 'This week' ? {trips:analysis.map(t=>({id:t.id,tripNo:t.tripNo,date:t.tripDate,status:t.status}))} : {})}));
 }

} finally { await server.close(); }
