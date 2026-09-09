import { chromium } from 'playwright';

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:5173/staff?tab=salary-sheet', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

// Find the "Review and Submit" button (text match).
const btn = page.getByRole('button', { name: /Review and Submit/i });
const hasBtn = await btn.count();
console.log('Review&Submit button found:', hasBtn);

if (hasBtn) {
  await btn.first().click();
  await page.waitForTimeout(800);
  const payslipText = await page.getByText('Salary Payslip').count();
  const dnr = await page.getByText('DMR POULTRIES').count();
  console.log('Payslip "Salary Payslip" present:', payslipText);
  console.log('"DMR POULTRIES" present:', dnr);

  // Click Edit
  const edit = page.getByRole('button', { name: /Edit/i });
  if (await edit.count()) {
    await edit.first().click();
    await page.waitForTimeout(400);
    const inputs = await page.locator('input[type="text"]').count();
    console.log('Editable inputs after Edit click:', inputs);
  } else {
    console.log('Edit button NOT found');
  }
}

console.log('--- ERRORS (' + errors.length + ') ---');
errors.slice(0, 20).forEach((e) => console.log(e));
await browser.close();
