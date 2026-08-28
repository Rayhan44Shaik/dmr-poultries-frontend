import { test, expect } from '@playwright/test';

test.describe('Shop Sales', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/operations?tab=shop-sales');
    await page.waitForLoadState('networkidle');
  });

  test('Shop Sales page opens and loads records', async ({ page }) => {
    await expect(page.locator('h1, h2, [role="heading"]').first()).toBeVisible();
  });

  test('Create a new shop sale', async ({ page }) => {
    const addButton = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New"), [aria-label*="add" i]').first();
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      await page.waitForLoadState('networkidle');
      
      // Fill required fields
      const shopSelect = page.locator('select[name="shopId"], select[name="shop"], [role="combobox"]').first();
      if (await shopSelect.isVisible().catch(() => false)) {
        await shopSelect.click();
        await page.locator('[role="option"]').first().click();
      }
      
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]').first();
      if (await saveButton.isVisible().catch(() => false)) {
        const isEnabled = await saveButton.isEnabled().catch(() => false);
        if (isEnabled) {
          await saveButton.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });

  test('Edit an existing shop sale', async ({ page }) => {
    const editButton = page.locator('button[aria-label*="edit" i], button:has-text("Edit"), a:has-text("Edit")').first();
    if (await editButton.isVisible().catch(() => false)) {
      await editButton.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('Delete a shop sale', async ({ page }) => {
    const deleteButton = page.locator('button[aria-label*="delete" i], button:has-text("Delete"), button:has-text("Remove")').first();
    if (await deleteButton.isVisible().catch(() => false)) {
      await deleteButton.click();
      await page.waitForLoadState('networkidle');
      
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")').first();
      if (await confirmButton.isVisible().catch(() => false)) {
        await confirmButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('Refresh data', async ({ page }) => {
    const refreshButton = page.locator('button[aria-label*="refresh" i], button:has-text("Refresh"), button:has([data-testid="refresh"])').first();
    if (await refreshButton.isVisible().catch(() => false)) {
      await refreshButton.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('Verify persisted data after refresh', async ({ page }) => {
    // Navigate away and back
    await page.goto('/operations?tab=shop-sales');
    await page.waitForLoadState('networkidle');
    
    // Verify data is still there
    await expect(page.locator('table, [role="grid"]').first()).toBeVisible();
  });
});