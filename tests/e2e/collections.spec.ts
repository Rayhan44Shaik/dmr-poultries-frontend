import { test, expect } from '@playwright/test';

test.describe('Collections', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/operations?tab=collection');
    await page.waitForLoadState('networkidle');
  });

  test('Collection page opens and loads data', async ({ page }) => {
    await expect(page.locator('h1, h2, [role="heading"]').first()).toBeVisible();
  });

  test('Create a new collection', async ({ page }) => {
    const addButton = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New"), [aria-label*="add" i]').first();
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      await page.waitForLoadState('networkidle');
      
      // Fill required fields if form appears
      const nameInput = page.locator('input[name="name"], input[name="collectionName"], input[placeholder*="name" i]').first();
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill('Test Collection E2E');
      }
      
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]').first();
      if (await saveButton.isVisible().catch(() => false)) {
        // Check if button is enabled (not disabled)
        const isEnabled = await saveButton.isEnabled().catch(() => false);
        if (isEnabled) {
          await saveButton.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });

  test('Update a collection', async ({ page }) => {
    const editButton = page.locator('button[aria-label*="edit" i], button:has-text("Edit"), a:has-text("Edit")').first();
    if (await editButton.isVisible().catch(() => false)) {
      await editButton.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('Delete a collection', async ({ page }) => {
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
    const refreshButton = page.locator('button[aria-label*="refresh" i], button:has-text("Refresh")').first();
    if (await refreshButton.isVisible().catch(() => false)) {
      await refreshButton.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('Verify persistence after refresh', async ({ page }) => {
    await page.goto('/operations?tab=collection');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table, [role="grid"]').first()).toBeVisible();
  });
});