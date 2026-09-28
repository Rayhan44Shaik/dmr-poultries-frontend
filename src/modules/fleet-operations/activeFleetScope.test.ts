import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ACTIVE_FLEET_TABS,
  DEFAULT_FLEET_TAB,
  DEFERRED_FLEET_TABS,
  PLACEHOLDER_FLEET_TABS,
  VISIBLE_FLEET_TABS,
  isActiveFleetTab,
  isDeferredFleetTab,
  isPlaceholderFleetTab,
} from './activeFleetScope.ts';
import { NAV_SECTIONS } from '../../routes/navigation.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

function read(rel: string) {
  return fs.readFileSync(path.join(here, rel), 'utf8');
}

describe('Fleet Operations active scope', () => {
  it('exposes five production tabs plus a FASTAG placeholder', () => {
    assert.deepEqual([...ACTIVE_FLEET_TABS], [
      'entry',
      'history',
      'permits',
      'emi',
      'analytics',
    ]);
    assert.deepEqual([...PLACEHOLDER_FLEET_TABS], ['fastag']);
    assert.deepEqual([...VISIBLE_FLEET_TABS], [
      'entry',
      'history',
      'permits',
      'emi',
      'analytics',
      'fastag',
    ]);
    assert.equal(DEFAULT_FLEET_TAB, 'entry');
    assert.deepEqual([...DEFERRED_FLEET_TABS], ['dashboard', 'reports', 'expenses']);
    assert.equal(isActiveFleetTab('fastag'), false);
    assert.equal(isPlaceholderFleetTab('fastag'), true);
    assert.equal(isActiveFleetTab('dashboard'), false);
    assert.equal(isDeferredFleetTab('dashboard'), true);
  });

  it('does not expose Dashboard, Reports, or Expenses in sidebar navigation', () => {
    const vehicles = NAV_SECTIONS.find((section) => section.id === 'vehicles');
    assert.ok(vehicles);
    const labels = (vehicles?.children ?? []).map((child) => child.label.toLowerCase());
    const paths = (vehicles?.children ?? []).map((child) => child.path);
    assert.equal(labels.some((label) => label.includes('dashboard') || label.includes('overview')), false);
    assert.equal(labels.some((label) => label === 'reports' || label.includes('expense')), false);
    assert.equal(paths.some((pathValue) => pathValue.includes('tab=dashboard')), false);
    assert.equal(paths.some((pathValue) => pathValue.includes('tab=reports')), false);
    assert.equal(paths.some((pathValue) => pathValue.includes('tab=expenses')), false);
    // Reachability is sidebar-wide, not vehicles-section-only: Vehicle Analytics
    // deliberately lives under Reports (nav.vehicleAnalytics →
    // /fleet?tab=analytics), so the loop below accepts any section. The
    // deferred-exclusion assertions above stay scoped to Vehicles.
    const allPaths = NAV_SECTIONS.flatMap((section) =>
      (section.children ?? []).map((child) => child.path)
    );
    for (const tab of VISIBLE_FLEET_TABS) {
      assert.ok(
        allPaths.some((pathValue) => pathValue.includes(`tab=${tab}`)),
        tab
      );
    }
    assert.ok(labels.some((label) => label.includes('fastag')));
  });

  it('preserves deferred page, hook, and component files', () => {
    const files = [
      'pages/FleetDashboardPage.tsx',
      'pages/VehicleReportsPage.tsx',
      'pages/VehicleExpenseReportPage.tsx',
      'hooks/useFleetDashboardData.ts',
      'hooks/useFastagData.ts',
      'components/fastag/FastagSummaryTiles.tsx',
      'components/dashboard/DailyStatTiles.tsx',
      'components/reports/ReportFilters.tsx',
    ];
    for (const file of files) {
      assert.equal(fs.existsSync(path.join(here, file)), true, file);
    }
  });

  it('does not mount or import deferred modules from the active Fleet page', () => {
    const source = read('pages/FleetPages.tsx');
    assert.match(source, /lazy\(/);
    assert.match(source, /FleetTabSkeleton/);
    // Tabs resolve through the tab-loader map, never through direct page imports.
    assert.match(source, /tabLoaders/);
    const loaders = read('pages/fleetTabs.ts');
    for (const tab of ACTIVE_FLEET_TABS) {
      assert.match(loaders, new RegExp(`${tab}: \\(\\) => import\\(`), tab);
    }
    assert.match(loaders, /fastag: \(\) => import\(/);
    assert.match(source, /DEFERRED/);
    assert.doesNotMatch(source, /from ["']\.\/FleetDashboardPage["']/);
    assert.doesNotMatch(source, /from ["']\.\/VehicleReportsPage["']/);
    assert.doesNotMatch(source, /from ["']\.\/VehicleExpenseReportPage["']/);
    assert.doesNotMatch(source, /useFleetDashboardData/);
    assert.doesNotMatch(source, /useExpenseReportData/);
    assert.doesNotMatch(source, /useTrips/);
  });

  it('does not register deferred dashboard/reports/expenses routes as active', () => {
    const routesSource = read('routes.tsx');
    assert.match(routesSource, /DEFERRED/);
    assert.equal(/^\s*path:\s*'fleet\/dashboard'/m.test(routesSource), false);
    assert.equal(/^\s*path:\s*'fleet\/reports'/m.test(routesSource), false);
    assert.equal(/^\s*path:\s*'fleet\/expense-report'/m.test(routesSource), false);
    assert.equal(/^\s*element: withSuspense\(FleetDashboardPage\)/m.test(routesSource), false);
  });

  it('does not initialize deferred APIs from active Fleet fetch/cache/refresh paths', () => {
    const files = [
      'hooks/useAnalyticsData.ts',
      'hooks/useEmiData.ts',
      'hooks/useMaintenanceData.ts',
      'hooks/useDocumentsData.ts',
      'services/fleetSessionCache.ts',
    ];
    const joined = files.map((file) => read(file)).join('\n');
    assert.equal(joined.includes('fleet/dashboard'), false);
    assert.equal(joined.includes('/fleet/reports'), false);
    assert.equal(joined.includes('expense-report'), false);
    assert.equal(joined.includes("fleetCacheInvalidate('dash:"), false);
    assert.equal(joined.includes('useFleetDashboardData'), false);
    assert.equal(joined.includes('useExpenseReportData'), false);
  });

  it('Analytics fetches only via filter-key cache, refresh nonce, and shared GET — no polling', () => {
    const source = read('hooks/useAnalyticsData.ts');
    assert.match(source, /fleetSharedGet/);
    assert.match(source, /filterKey/);
    assert.match(source, /refreshNonce/);
    assert.doesNotMatch(source, /setInterval/);
    assert.doesNotMatch(source, /setTimeout\(\s*\(\)\s*=>\s*\{?\s*refresh/);
  });

  it('EMI Retry is a single controlled list GET with in-flight protection', () => {
    const hook = read('hooks/useEmiData.ts');
    const service = read('services/emiService.ts');
    assert.match(hook, /listInFlight/);
    assert.match(hook, /listInFlight\.current\) return/);
    assert.match(service, /emiApi\.list\(/);
    assert.doesNotMatch(hook, /setInterval/);
  });

  it('EMI data hook is read-only — no schedule or payment path', () => {
    const source = read('hooks/useEmiData.ts');
    assert.doesNotMatch(source, /savingRef/);
    assert.doesNotMatch(source, /resolvePayKey/);
    assert.doesNotMatch(source, /fleet:emi-pay:/);
    assert.doesNotMatch(source, /idempotencyKey/);
    assert.doesNotMatch(source, /\.pay\(/);
    assert.doesNotMatch(source, /listSchedule/);
  });

  it('Maintenance Entry does not load History list or meter-summary', () => {
    const source = read('hooks/useMaintenanceData.ts');
    assert.match(source, /if \(scope === 'history'\)/);
    assert.match(source, /if \(scope === 'entry'\)/);
    assert.match(source, /if \(scope !== 'history'\) return/);
    assert.match(source, /meter-summary/);
    const entryPage = read('pages/MaintenanceEntryPage.tsx');
    assert.match(entryPage, /useMaintenanceData\('entry'\)/);
    const historyPage = read('pages/MaintenanceHistoryPage.tsx');
    assert.match(historyPage, /useMaintenanceData\('history'\)/);
  });

  it('Permit fetches are a single controlled list with session-cache sharing', () => {
    const source = read('hooks/useDocumentsData.ts');
    assert.match(source, /fleetSharedGet\('permits:list'/);
    assert.match(source, /permitApi\.list/);
    assert.doesNotMatch(source, /setInterval/);
    assert.doesNotMatch(source, /permitApi\.summary/);
  });

  it('FASTAG is a static Under Construction screen with no data path', () => {
    const source = read('pages/FastagDashboardPage.tsx');
    const live = source.split('export default memo(FastagDashboardPage);')[1] || source.slice(source.lastIndexOf('UNDER CONSTRUCTION'));
    assert.match(source, /Under Construction/);
    assert.match(live, /fleet\.fastag\.coming_soon_desc/);
    assert.match(live, /fleet\.fastag\.management_title/);
    assert.match(live, /coming_soon/);
    assert.doesNotMatch(live, /useFastagData\(/);
    assert.doesNotMatch(live, /useVehicles\(/);
    assert.doesNotMatch(live, /getFastags/);
    assert.doesNotMatch(live, /localStorage/);
    assert.doesNotMatch(live, /sessionStorage/);
    assert.doesNotMatch(live, /fleetCache/);
    assert.doesNotMatch(live, /apiClient/);
    assert.doesNotMatch(live, /fetch\(/);
    assert.doesNotMatch(live, /setInterval/);
    assert.doesNotMatch(live, /setTimeout/);
    assert.doesNotMatch(live, /useEffect/);
    const tabLoadersSource = read('pages/fleetTabs.ts');
    assert.match(tabLoadersSource, /fastag: \(\) => import\("\.\/FastagDashboardPage"\)/);
    const routesSource = read('routes.tsx');
    assert.match(routesSource, /fleet\/fastag/);
    assert.equal(fs.existsSync(path.join(here, 'hooks/useFastagData.ts')), true);
    assert.equal(fs.existsSync(path.join(here, 'services/storage.ts')), true);
  });

  it('FASTAG does not participate in Fleet cache or refresh of other tabs', () => {
    const cache = read('services/fleetSessionCache.ts');
    assert.match(cache, /FASTAG/);
    assert.doesNotMatch(cache, /fastag:/);
    const emi = read('hooks/useEmiData.ts');
    const maintenance = read('hooks/useMaintenanceData.ts');
    const permits = read('hooks/useDocumentsData.ts');
    const analytics = read('hooks/useAnalyticsData.ts');
    for (const source of [emi, maintenance, permits, analytics]) {
      assert.equal(source.includes('fastag'), false);
      assert.equal(source.includes('useFastagData'), false);
    }
  });

  it('does not create cache keys for deferred modules in the session cache helper', () => {
    const source = read('services/fleetSessionCache.ts');
    assert.match(source, /Do not add Dashboard/);
    assert.doesNotMatch(source, /dash:/);
    assert.doesNotMatch(source, /reports:/);
    assert.doesNotMatch(source, /expenses:/);
  });

  it('resolves the default tab without a second navigate when ?tab= is already valid', () => {
    const source = read('pages/FleetPages.tsx');
    assert.match(source, /if \(isVisibleFleetTab\(requestedTab\)\) return/);
    assert.match(source, /DEFAULT_FLEET_TAB/);
    assert.doesNotMatch(source, /tab=\$\{activeTab\}/);
  });

  it('uses the same content width and page gutters as Operations', () => {
    const fleet = read('pages/FleetPages.tsx');
    assert.match(fleet, /px-4 pb-8 pt-6 sm:px-5 lg:px-6/);
    assert.match(fleet, /max-w-\[1600px\]/);
    assert.doesNotMatch(fleet, /max-w-\[1480px\]/);
  });

  it('Maintenance Entry does not load Operations fuel-expenses until a vehicle is selected', () => {
    const entry = read('pages/MaintenanceEntryPage.tsx');
    const form = read('components/maintenance/MaintenanceForm.tsx');
    const guard = read('hooks/useFleetFuelKmGuard.ts');
    assert.match(entry, /useFleetFuelKmGuard/);
    assert.doesNotMatch(entry, /useFuelKMValidator/);
    assert.doesNotMatch(entry, /useFuelExpenses/);
    assert.doesNotMatch(form, /useFuelKMValidator/);
    assert.doesNotMatch(form, /useFuelExpenses/);
    assert.match(guard, /if \(!vehicle \|\| !vehicleId\)/);
    assert.match(guard, /fuelExpenseService/);
    assert.match(guard, /latestVehicleMeter/);
  });

  it('AppRoutes lazy-loads FleetPages so other modules do not evaluate Fleet tabs', () => {
    const appRoutes = fs.readFileSync(
      path.join(here, '../../routes/AppRoutes.tsx'),
      'utf8'
    );
    assert.match(appRoutes, /lazyShell\(\(\) => import\("\.\.\/modules\/fleet-operations\/pages\/FleetPages"\)\)/);
    assert.match(appRoutes, /<Suspense fallback=\{<PageLoading \/>\}>/);
  });

  it('active Fleet data paths never touch sample infrastructure or browser storage', () => {
    // Gate 0: a production Fleet page must not depend on the dev-only
    // quarter-sample server and must never read business data from
    // localStorage/sessionStorage. Preserved deferred/prototype files
    // (useFastagData, storage.ts, FleetDashboardPage, reports pages) are
    // intentionally excluded — they are not mounted by any live route.
    const liveDataFiles = [
      'hooks/useAnalyticsData.ts',
      'hooks/useEmiData.ts',
      'hooks/useMaintenanceData.ts',
      'hooks/useDocumentsData.ts',
      'hooks/useFleetVehicles.ts',
      'services/maintenanceApi.ts',
      'services/permitApi.ts',
      'services/emiApi.ts',
      'services/emiService.ts',
      'services/analyticsApi.ts',
      'services/fleetSessionCache.ts',
      'pages/MaintenanceEntryPage.tsx',
      'pages/MaintenanceHistoryPage.tsx',
      'pages/DocumentsExpiryPage.tsx',
      'pages/EmiLoansPage.tsx',
      'pages/VehicleAnalyticsPage.tsx',
      'pages/fleetTabs.ts',
      'utils/maintenanceHelpers.ts',
    ];
    for (const file of liveDataFiles) {
      const source = read(file);
      assert.equal(source.includes('quarterSample'), false, file);
      assert.equal(source.includes('localStorage'), false, file);
      assert.equal(source.includes('sessionStorage'), false, file);
    }
    // The FASTag placeholder keeps its prototype reference only inside the
    // commented block; the live export below it stays storage-free.
    const fastag = read('pages/FastagDashboardPage.tsx');
    const live = fastag.split('export default memo(FastagDashboardPage);')[1] || '';
    assert.equal(live.includes('quarterSample'), false);
    assert.equal(live.includes('localStorage'), false);
    assert.equal(live.includes('sessionStorage'), false);
  });
});
