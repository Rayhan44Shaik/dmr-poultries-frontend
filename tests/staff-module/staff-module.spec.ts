import { expect, test } from '@playwright/test';

const user = { id: 1, username: 'staff-owner', displayName: 'Staff Owner', role: 'OWNER', employeeId: null };
const salary = { id: '10000000-0000-4000-8000-000000000001', employeeId: 11, employeeName: 'Production Staff', department: 'Fleet', month: '2026-09', basicSalary: 20000, overtime: 500, incentives: 250, fuelAllowance: 0, nightAllowance: 0, totalGross: 20750, leaveDeduction: 0, advanceRecovery: 0, loanEMI: 0, latePenalty: 0, otherDeductions: 0, totalDeductions: 0, netSalary: 20750, status: 'Pending', createdAt: '2026-09-01T00:00:00Z' };
const recentTrip = { tripNo: 'TRIP-001', tripDate: '2026-09-15', vehicleNo: 'AP-01', totalShops: 3, totalBirdsDelivered: 900, totalDeliveredWeight: 1800, totalMortality: 9, weightLoss: 4.5, totalKm: 120 };

test.beforeEach(async ({ page }) => {
  await page.addInitScript((value) => { localStorage.setItem('dmr-auth-token', 'staff-e2e'); localStorage.setItem('dmr-auth-user', JSON.stringify(value)); }, user);
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/me') return route.fulfill({ json: { user } });
    if (url.pathname === '/api/masters/employees') return route.fulfill({ json: [{ id: 11, employeeNo: 11, employeeName: 'Production Staff', department: 'Fleet', role: 'Driver', phoneNumber: '9999999999', email: 'staff@example.test', salary: 20000, status: 'Active' }] });
    if (url.pathname === '/api/staff/salaries') return route.fulfill({ json: [salary] });
    if (url.pathname === '/api/staff/performance/drivers') return route.fulfill({ json: { fromDate: '2026-09-01', toDate: '2026-09-18', kpis: { drivers: 1, trips: 1, distance: 120, avgDistancePerTrip: 120, fuelLitres: 20, fuelCost: 1800, maintenanceCost: 250, tollCost: 50, otherCost: 0, totalCost: 2100, costPerKm: 17.5, mileage: 6 }, weekly: [{ week: '2026-09-14', trips: 1, distance: 120, fuelLitres: 20 }], rows: [{ driverId: 11, driverName: 'Production Staff', employeeStatus: 'Active', trips: 1, distance: 120, avgDistancePerTrip: 120, vehicles: 1, vehicleNos: ['AP-01'], fuelLitres: 20, fuelCost: 1800, maintenanceCost: 250, tollCost: 50, otherCost: 0, totalCost: 2100, costPerKm: 17.5, mileage: 6 }], detail: { avgDistancePerTrip: 120, vehicles: [], recentTrips: [recentTrip] } } });
    if (url.pathname === '/api/staff/performance/supervisors') return route.fulfill({ json: { fromDate: '2026-09-01', toDate: '2026-09-18', kpis: { supervisors: 1, trips: 1, shops: 3, birds: 900, weight: 1800, mortality: 9, mortalityRate: 1, weightLoss: 4.5 }, weekly: [{ week: '2026-09-14', trips: 1, birds: 900, weight: 1800, mortality: 9, weightLoss: 4.5 }], rows: [{ supervisorId: 12, supervisorName: 'Production Supervisor', employeeStatus: 'Active', trips: 1, shops: 3, birds: 900, weight: 1800, mortality: 9, mortalityRate: 1, weightLoss: 4.5 }], detail: { recentTrips: [recentTrip] } } });
    return route.fulfill({ json: [] });
  });
});

test('Salary Register renders only authoritative API rows', async ({ page }) => {
  await page.goto('/staff?tab=salary-sheet');
  await expect(page.getByText('Production Staff').first()).toBeVisible();
  await expect(page.getByText(/20,750/).first()).toBeVisible();
  await expect(page.getByText(/sample|demo/i)).toHaveCount(0);
});

test('Driver Performance renders backend KPIs and ranking row', async ({ page }) => {
  await page.goto('/staff?tab=driver-performance');
  await expect(page.getByText('Production Staff').first()).toBeVisible();
  await expect(page.getByText('AP-01').first()).toBeVisible();
});

test('Supervisor Performance renders backend delivery metrics', async ({ page }) => {
  await page.goto('/staff?tab=supervisor-performance');
  await expect(page.getByText('Production Supervisor').first()).toBeVisible();
  await expect(page.getByText('900').first()).toBeVisible();
});
