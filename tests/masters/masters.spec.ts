import { test, expect, type Locator, type Page } from '@playwright/test';
import { DEPARTMENTS, fixtures, type TestRecord } from './fixtures';

interface Backend {
  records: Record<string, TestRecord[]>;
  writes: { method: string; path: string; payload: Record<string, unknown> }[];
  failReads: boolean;
  failSaves: boolean;
  holdWrite?: Promise<void>;
  releaseWrite?: () => void;
}
const backends = new WeakMap<Page, Backend>();
const errors = new WeakMap<Page, string[]>();
const tabs = [
  { tab: 'shops', name: 'Shop', path: 'shops' },
  { tab: 'farms', name: 'Farm', path: 'farms' },
  { tab: 'vehicles', name: 'Vehicle', path: 'vehicles' },
  { tab: 'employees', name: 'Employee', path: 'employees' },
  { tab: 'banks', name: 'Bank', path: 'banks' },
  { tab: 'birdTypes', name: 'Bird Type', path: 'bird-types' },
];
const dialog = (page: Page, name: string) =>
  page.getByRole('dialog', { name: `Add ${name}`, exact: true });
const rows = (page: Page) => page.locator('.master-table tbody tr');
const combo = (page: Page, name: string) =>
  page.getByRole('combobox', { name, exact: true });
const toolbar = (page: Page) => page.locator('[data-master-toolbar]');

async function openTab(page: Page, tab: string, name: string) {
  await page.goto(`/masters?tab=${tab}`);
  await expect(
    page.getByRole('button', { name: `Add ${name}`, exact: true }),
  ).toBeEnabled();
}
async function pick(page: Page, field: Locator, option: string) {
  await field.click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function chrome(field: Locator) {
  return field.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      height: style.height,
      radius: style.borderRadius,
      size: style.fontSize,
      weight: style.fontWeight,
      border: style.borderColor,
      background: style.backgroundColor,
      padding: style.paddingLeft,
    };
  });
}
async function withinViewport(page: Page, element: Locator) {
  const bounds = (await element.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
}
async function fillFarm(page: Page) {
  const form = dialog(page, 'Farm');
  await form
    .getByLabel('Farm Name', { exact: false })
    .fill('  New Sample Farm  ');
  await form
    .getByLabel('Owner Name', { exact: false })
    .fill('  Sample Farmer  ');
  await form
    .getByLabel('Supervisor Name', { exact: false })
    .fill('Sample Supervisor');
  await form.getByLabel('Mobile Number', { exact: false }).fill('9999999999');
  await form.getByLabel('Village', { exact: false }).fill('Sample Village');
  await form.getByLabel('Bird Capacity', { exact: false }).fill('3200');
  await form.getByLabel('Address', { exact: true }).fill('Sample address');
}

test.beforeEach(async ({ page }) => {
  errors.set(page, []);
  page.on('pageerror', (error) => errors.get(page)!.push(error.message));
  const backend: Backend = {
    records: structuredClone(fixtures),
    writes: [],
    failReads: false,
    failSaves: false,
  };
  backends.set(page, backend);
  await page.addInitScript(() => {
    localStorage.setItem(
      'dmr_auth_user',
      JSON.stringify({
        id: 'masters-test',
        name: 'Master Test',
        role: 'Admin',
      }),
    );
  });
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url());
      expect(url.origin).toBe(new URL(test.info().project.use.baseURL!).origin);
      const match = /^\/api\/masters\/([^/]+)(?:\/(\d+))?$/.exec(url.pathname);
      const method = route.request().method();
      if (match && backend.records[match[1]]) {
        const [, key, rawId] = match;
        if (method === 'GET') {
          await route.fulfill(
            backend.failReads
              ? { status: 503, json: { message: 'Sample API unavailable' } }
              : { json: backend.records[key] },
          );
        } else {
          const payload = route.request().postDataJSON() as Record<
            string,
            unknown
          >;
          backend.writes.push({ method, path: url.pathname, payload });
          if (backend.holdWrite) await backend.holdWrite;
          if (backend.failSaves) {
            await route.fulfill({
              status: 503,
              json: { message: 'Sample save failed' },
            });
            return;
          }
          const id = rawId
            ? Number(rawId)
            : Math.max(...backend.records[key].map((record) => record.id)) + 1;
          const serial = (
            {
              shops: 'shopNo',
              farms: 'farmNo',
              employees: 'employeeNo',
              banks: 'bankNo',
              vehicles: 'vehicleNo',
              'bird-types': 'birdTypeNo',
            } as Record<string, string>
          )[key];
          const record = {
            ...(backend.records[key].find((item) => item.id === id) ?? {}),
            ...payload,
            id,
            [serial]: payload[serial] ?? id,
          };
          if (rawId)
            backend.records[key] = backend.records[key].map((item) =>
              item.id === id ? record : item,
            );
          else backend.records[key].push(record);
          await route.fulfill({ json: record });
        }
      } else if (url.pathname === '/api/staff/salaries') {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { items: [], total: 0 } });
      }
    },
  );
});

test.afterEach(async ({ page }) => {
  backends.get(page)?.releaseWrite?.();
  expect(errors.get(page)).toEqual([]);
});

for (const { tab, name } of tabs) {
  test(`${name}: consistent directory, keyboard export menu and readable form on desktop and mobile`, async ({
    page,
  }) => {
    await openTab(page, tab, name);
    await expect(rows(page)).toHaveCount(10);
    await expect(toolbar(page).getByRole('searchbox')).toBeVisible();
    await expect(page.locator('.master-page select')).toHaveCount(0);
    const exportButton = toolbar(page).getByRole('button', {
      name: 'Export',
      exact: true,
    });
    await exportButton.focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('menu', { name: 'Export', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: 'PDF', exact: true }),
    ).toHaveCSS('height', '36px');
    await withinViewport(page, page.locator('[data-master-dropdown-panel]'));
    const download = page.waitForEvent('download');
    await page.keyboard.press('Enter');
    expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
    await expect(page.getByRole('menu', { name: 'Export' })).toHaveCount(0);
    await expect(exportButton).toBeFocused();

    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page
        .getByRole('button', { name: `Add ${name}`, exact: true })
        .click();
      const form = dialog(page, name);
      await expect(form).toBeVisible();
      await expect(form.locator('form')).toHaveCount(1);
      await expect(form.locator('select')).toHaveCount(0);
      await expect(form.getByRole('switch', { name: 'Status' })).toBeChecked();
      await withinViewport(page, form);
      await withinViewport(page, form.locator('footer'));
      const overflow = await form.evaluate(
        (element) => element.scrollWidth > element.clientWidth + 1,
      );
      expect(overflow).toBe(false);
      await expect(form.locator('input').first()).toHaveCSS('height', '36px');
      await form.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(form).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: `Add ${name}`, exact: true }),
      ).toBeFocused();
      expect(
        await page
          .locator('.master-page')
          .evaluate((element) => element.scrollWidth > element.clientWidth + 1),
      ).toBe(false);
    }
    expect(backends.get(page)!.writes).toHaveLength(0);
  });
}

test('Department and searchable menus match the actual Salary Register reference', async ({
  page,
}) => {
  await page.goto('/staff?tab=salary-sheet');
  const reference = page.getByRole('button', {
    name: 'All Departments',
    exact: true,
  });
  await expect(reference).toBeVisible();
  const referenceChrome = await chrome(reference);
  await reference.click();
  const referenceRow = page.getByRole('button', {
    name: 'Accountant',
    exact: true,
  });
  await expect(referenceRow).toBeVisible();
  const rowChrome = await chrome(referenceRow);
  const referencePanel = reference.locator('..').locator('ul').locator('..');
  const radius = await referencePanel.evaluate(
    (element) => getComputedStyle(element).borderRadius,
  );
  await page
    .getByRole('button', { name: 'All Employees', exact: true })
    .click();
  const searchChrome = await chrome(
    page
      .getByRole('button', { name: 'All Employees', exact: true })
      .locator('..')
      .getByPlaceholder('Search...')
      .locator('..'),
  );

  await openTab(page, 'employees', 'Employee');
  const department = combo(page, 'Department');
  expect(await chrome(department)).toEqual(referenceChrome);
  await department.click();
  expect(
    await chrome(page.getByRole('option', { name: 'Accountant', exact: true })),
  ).toEqual(rowChrome);
  await expect(page.locator('[data-master-dropdown-panel]')).toHaveCSS(
    'border-radius',
    radius,
  );
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Add Employee', exact: true }).click();
  expect(
    await chrome(
      dialog(page, 'Employee').getByRole('combobox', { name: 'Department' }),
    ),
  ).toEqual(referenceChrome);
  await dialog(page, 'Employee')
    .getByRole('button', { name: 'Cancel' })
    .click();

  await openTab(page, 'shops', 'Shop');
  await combo(page, 'City').click();
  expect(
    await chrome(
      page.getByRole('searchbox', { name: 'Search City' }).locator('..'),
    ),
  ).toEqual(searchChrome);
});

test('Employee Department filters, clears, resets pagination and supports keyboard typeahead', async ({
  page,
}) => {
  await openTab(page, 'employees', 'Employee');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(rows(page).first()).toContainText('Sample Employee 11');
  const department = combo(page, 'Department');
  await department.focus();
  await page.keyboard.press('d');
  await page.keyboard.press('Enter');
  await expect(department).toHaveText('Driver');
  await expect(rows(page)).toHaveCount(2);
  await expect(page.locator('[data-master-summary]')).toContainText(
    'Page 1 of 1',
  );
  await pick(page, department, 'All Departments');
  await expect(rows(page)).toHaveCount(10);
  await department.click();
  await toolbar(page).getByRole('searchbox').click();
  await expect(department).toHaveAttribute('aria-expanded', 'false');
  await toolbar(page).getByRole('searchbox').fill('Employee 20');
  await expect(rows(page)).toHaveCount(1);
  await toolbar(page).getByRole('button', { name: 'Clear search' }).click();
  await expect(rows(page)).toHaveCount(10);
});

test('Farm validation, disabled save state, failed-save recovery and original payload are preserved', async ({
  page,
}) => {
  const backend = backends.get(page)!;
  await openTab(page, 'farms', 'Farm');
  await page.getByRole('button', { name: 'Add Farm', exact: true }).click();
  const form = dialog(page, 'Farm');
  await form.getByRole('button', { name: 'Save Farm' }).click();
  await expect(form.getByRole('alert')).toHaveCount(6);
  expect(backend.writes).toHaveLength(0);
  await fillFarm(page);
  await form.getByRole('switch', { name: 'Status' }).click();
  backend.failSaves = true;
  backend.holdWrite = new Promise<void>((resolve) => {
    backend.releaseWrite = resolve;
  });
  await form.getByRole('button', { name: 'Save Farm' }).click();
  await expect.poll(() => backend.writes.length).toBe(1);
  await expect(form.getByLabel('Farm Name', { exact: false })).toBeDisabled();
  await expect(form.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(form).toBeVisible();
  backend.releaseWrite!();
  await expect(form.getByRole('button', { name: 'Save Farm' })).toBeEnabled();
  await expect(form.getByLabel('Farm Name', { exact: false })).toHaveValue(
    '  New Sample Farm  ',
  );
  backend.failSaves = false;
  await form.getByRole('button', { name: 'Save Farm' }).click();
  await expect(form).toHaveCount(0);
  expect(backend.writes).toHaveLength(2);
  expect(backend.writes[1]).toEqual({
    method: 'POST',
    path: '/api/masters/farms',
    payload: {
      farmName: 'New Sample Farm',
      ownerName: 'Sample Farmer',
      supervisorName: 'Sample Supervisor',
      phoneNumber: '9999999999',
      village: 'Sample Village',
      address: 'Sample address',
      capacity: 3200,
      status: 'Inactive',
    },
  });
});

test('Farm edit pre-fills fields, updates the same record and fresh Add resets the form', async ({
  page,
}) => {
  await openTab(page, 'farms', 'Farm');
  await page
    .getByRole('button', { name: 'Edit farm Sample Farm 1', exact: true })
    .click();
  const form = page.getByRole('dialog', { name: 'Edit Farm' });
  await expect(form.getByLabel('Owner Name', { exact: false })).toHaveValue(
    'Sample Farmer 1',
  );
  await form.getByLabel('Bird Capacity', { exact: false }).fill('2800');
  await form.getByRole('button', { name: 'Update Farm' }).click();
  await expect(form).toHaveCount(0);
  expect(backends.get(page)!.writes[0]).toMatchObject({
    method: 'PUT',
    path: '/api/masters/farms/1',
    payload: { capacity: 2800, farmNo: 1 },
  });
  await page.getByRole('button', { name: 'Add Farm', exact: true }).click();
  await expect(
    dialog(page, 'Farm').getByLabel('Farm Name', { exact: false }),
  ).toHaveValue('');
  await expect(
    dialog(page, 'Farm').getByRole('switch', { name: 'Status' }),
  ).toBeChecked();
});

test('Employee form Department is alphabetical, keeps license validation and saves the selected value', async ({
  page,
}) => {
  await openTab(page, 'employees', 'Employee');
  await page.getByRole('button', { name: 'Add Employee', exact: true }).click();
  const form = dialog(page, 'Employee');
  const department = form.getByRole('combobox', { name: 'Department' });
  await department.click();
  await expect(page.getByRole('option')).toHaveText(DEPARTMENTS);
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(department).toHaveText('Supervisor');
  await pick(page, department, 'Collection');
  await form.getByLabel('Employee Name').fill('New Sample Employee');
  await form.getByLabel('Phone Number').fill('9999999999');
  await form.getByLabel('Salary', { exact: false }).fill('24000');
  await form.getByRole('button', { name: 'Save Employee' }).click();
  await expect(
    page.getByText(
      'License Number is required for Driver and Collection departments.',
      { exact: true },
    ),
  ).toBeVisible();
  expect(backends.get(page)!.writes).toHaveLength(0);
  await pick(page, department, 'Office Staff');
  await form.getByRole('button', { name: 'Save Employee' }).click();
  await expect(form).toHaveCount(0);
  expect(backends.get(page)!.writes[0].payload).toMatchObject({
    employeeName: 'New Sample Employee',
    department: 'Office Staff',
    salary: 24000,
  });
});

test('Shop city search and rows-per-page selectors retain filtering and pagination behaviour', async ({
  page,
}) => {
  await openTab(page, 'shops', 'Shop');
  await page.getByRole('button', { name: 'Page 3', exact: true }).click();
  await expect(rows(page).first()).toContainText('Sample Shop 21');
  await pick(page, combo(page, 'Per Page'), '25');
  await expect(rows(page)).toHaveCount(25);
  await expect(rows(page).first()).toContainText('Sample Shop 01');
  await combo(page, 'City').click();
  await page.getByRole('searchbox', { name: 'Search City' }).fill('war');
  await page.keyboard.press('Enter');
  await expect(combo(page, 'City')).toHaveText('Warangal');
  await expect(rows(page)).toHaveCount(11);
  await expect(page.locator('[data-master-summary]')).toContainText(
    'Page 1 of 1',
  );
  await combo(page, 'City').click();
  await page.getByRole('searchbox', { name: 'Search City' }).fill('not-a-city');
  await expect(
    page.getByRole('status').filter({ hasText: 'No matches' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(combo(page, 'City')).toBeFocused();
  await expect(combo(page, 'City')).toHaveText('Warangal');
  await toolbar(page)
    .getByRole('button', { name: 'Reset', exact: true })
    .click();
  await expect(rows(page)).toHaveCount(25);
});

test('Shop Association Type and searchable Paper Rate save the original validated values', async ({
  page,
}) => {
  await openTab(page, 'shops', 'Shop');
  await page.getByRole('button', { name: 'Add Shop', exact: true }).click();
  const form = dialog(page, 'Shop');
  await form.getByLabel('Shop Number', { exact: false }).fill('NEW-TEST');
  await form.getByLabel('Shop Name', { exact: false }).fill('New Sample Shop');
  await form.getByLabel('Owner Name', { exact: false }).fill('Sample Owner');
  await form
    .getByLabel('Mobile Number', { exact: false })
    .first()
    .fill('9999999999');
  await form.getByLabel('City', { exact: false }).fill('Guntur');
  await pick(
    page,
    form.getByRole('combobox', { name: 'Association Type' }),
    'Ass Gun',
  );
  await form.getByRole('combobox', { name: 'Paper Rate' }).click();
  await page.getByRole('searchbox', { name: 'Search Paper Rate' }).fill('30');
  await page.keyboard.press('Enter');
  await expect(form.getByRole('combobox', { name: 'Paper Rate' })).toHaveText(
    '30',
  );
  expect(backends.get(page)!.writes).toHaveLength(0);
  await form.getByRole('button', { name: 'Save Shop', exact: true }).click();
  await expect(form).toHaveCount(0);
  expect(backends.get(page)!.writes[0].payload).toMatchObject({
    associationType: 'Ass Gun',
    paperRate: 30,
    openingBalance: 0,
    status: 'Active',
  });
});

test('Calendar month/year menus use master styling, stay usable and Escape does not discard the form', async ({
  page,
}) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await openTab(page, 'employees', 'Employee');
    await page
      .getByRole('button', { name: 'Add Employee', exact: true })
      .click();
    const form = dialog(page, 'Employee');
    await form.getByLabel('Employee Name').fill('Keep this name');
    await form
      .getByRole('button', { name: 'Open calendar', exact: true })
      .click();
    const calendar = form.getByRole('dialog', { name: 'Choose date' });
    await expect(calendar).toBeVisible();
    await withinViewport(page, calendar);
    await calendar
      .getByRole('combobox', { name: 'Month', exact: true })
      .click();
    await expect(
      page.getByRole('option', { name: 'January', exact: true }),
    ).toBeVisible();
    await expect(calendar.getByRole('combobox', { name: 'Month' })).toHaveCSS(
      'border-radius',
      '12px',
    );
    await page.keyboard.press('Escape');
    await expect(calendar).toBeVisible();
    await pick(
      page,
      calendar.getByRole('combobox', { name: 'Month', exact: true }),
      'April',
    );
    await calendar.getByRole('combobox', { name: 'Year', exact: true }).click();
    await page
      .getByRole('searchbox', { name: 'Search Year', exact: true })
      .fill('2025');
    await page.keyboard.press('Enter');
    await calendar
      .getByRole('button', { name: /Tuesday, April 1st, 2025/ })
      .click();
    await expect(form.getByLabel('Joining Date', { exact: true })).toHaveValue(
      '01/04/2025',
    );
    await expect(form.getByLabel('Employee Name')).toHaveValue(
      'Keep this name',
    );
    await form.getByRole('button', { name: 'Cancel' }).click();
  }
});

test('Portalled menus follow form scrolling, remain inside the phone viewport and keep Tab in the form', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await openTab(page, 'shops', 'Shop');
  await page.getByRole('button', { name: 'Add Shop', exact: true }).click();
  const form = dialog(page, 'Shop');
  const rate = form.getByRole('combobox', { name: 'Paper Rate' });
  await rate.click();
  const menu = page.locator('[data-master-dropdown-panel]');
  await withinViewport(page, menu);
  expect(
    await menu.evaluate((element) => !!element.closest('[data-master-dialog]')),
  ).toBe(true);
  await form.locator('[data-master-form-body]').evaluate((element) => {
    element.scrollTop -= 25;
  });
  await withinViewport(page, menu);
  await page.keyboard.press('Tab');
  await expect(menu).toHaveCount(0);
  expect(
    await form.evaluate((element) => element.contains(document.activeElement)),
  ).toBe(true);
  await form.getByRole('button', { name: 'Cancel' }).click();
});

test('Load errors remain explicit and Retry restores real API rows rather than fake data', async ({
  page,
}) => {
  const backend = backends.get(page)!;
  backend.failReads = true;
  await openTab(page, 'farms', 'Farm');
  await expect(
    page.getByRole('button', { name: 'Retry', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.master-page')).not.toContainText('Sample Farm 1');
  backend.failReads = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Retry', exact: true }),
  ).toHaveCount(0);
  await expect(rows(page)).toHaveCount(10);
});
