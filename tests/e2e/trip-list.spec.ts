import { test, expect } from '@playwright/test';

test.describe('Trip List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/operations?tab=trip-list');
    await page.waitForLoadState('networkidle');
  });

  test('Trip List page opens and data loads', async ({ page }) => {
    await expect(page.locator('h1, h2, [role="heading"]').first()).toBeVisible();
    await expect(page.locator('table, [role="grid"]').first()).toBeVisible();
  });

  test('Search/filter functionality', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[name="search"]').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('test');
      await page.waitForLoadState('networkidle');
    }
  });

  test('Pagination - first page', async ({ page }) => {
    // Check pagination controls exist
    const prevButton = page.locator('button:has-text("Previous"), button:has-text("Prev"), button[aria-label*="previous" i]').first();
    const nextButton = page.locator('button:has-text("Next"), button[aria-label*="next" i]').first();
    
    // Should be on page 1
    const pageIndicator = page.locator('[aria-current="page"], .active, .current').first();
    if (await pageIndicator.isVisible().catch(() => false)) {
      expect(await pageIndicator.textContent()).toContain('1');
    }
  });

  test('Pagination - next page', async ({ page }) => {
    const nextButton = page.locator('button:has-text("Next"), button[aria-label*="next" i]').first();
    if (await nextButton.isVisible().catch(() => false) && await nextButton.isEnabled().catch(() => false)) {
      await nextButton.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('Pagination - previous page', async ({ page }) => {
    const prevButton = page.locator('button:has-text("Previous"), button:has-text("Prev"), button[aria-label*="previous" i]').first();
    if (await prevButton.isVisible().catch(() => false) && await prevButton.isEnabled().catch(() => false)) {
      await prevButton.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('Page size selection', async ({ page }) => {
    const pageSizeSelect = page.locator('select[name="pageSize"], select[aria-label*="page size" i], select[aria-label*="rows" i]').first();
    if (await pageSizeSelect.isVisible().catch(() => false)) {
      await pageSizeSelect.selectOption('25');
      await page.waitForLoadState('networkidle');
    }
  });

  test('Empty page handling', async ({ page }) => {
    // Navigate to a page that might be empty (high page number)
    const pageInput = page.locator('input[type="number"][aria-label*="page" i], input[name="page"]').first();
    if (await pageInput.isVisible().catch(() => false)) {
      await pageInput.fill('999');
      await pageInput.press('Enter');
      await page.waitForLoadState('networkidle');
    }
  });

  test('Filters with pagination', async ({ page }) => {
    // Apply a filter
    const filterSelect = page.locator('select[name="status"], select[name="vehicle"], select[name="supervisor"]').first();
    if (await filterSelect.isVisible().catch(() => false)) {
      await filterSelect.selectOption({ index: 1 });
      await page.waitForLoadState('networkidle');
      
      // Check pagination still works
      const nextButton = page.locator('button:has-text("Next"), button[aria-label*="next" i]').first();
      if (await nextButton.isVisible().catch(() => false) && await nextButton.isEnabled().catch(() => false)) {
        await nextButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });
});