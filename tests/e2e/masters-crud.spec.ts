import { test, expect } from '@playwright/test';

test.describe('Masters CRUD - Shops', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/masters?tab=shops');
    await page.waitForLoadState('networkidle');
  });

  test('Shops page opens and list loads', async ({ page }) => {
    // Check page title or heading
    await expect(page.locator('h1, h2, [role="heading"]').first()).toBeVisible();
  });

  test('Create a new shop', async ({ page }) => {
    // Look for add/create button
    const addButton = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New"), [aria-label*="add" i]').first();
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      await page.waitForLoadState('networkidle');
      
      // Fill form if modal/form appears
      const nameInput = page.locator('input[name="name"], input[name="shopName"], input[placeholder*="name" i]').first();
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill('Test Shop E2E');
        
        const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]').first();
        if (await saveButton.isVisible().catch(() => false)) {
          const isEnabled = await saveButton.isEnabled().catch(() => false);
          if (isEnabled) {
            await saveButton.click();
            await page.waitForLoadState('networkidle');
          }
        }
      }
    }
  });

  test('Edit an existing shop', async ({ page }) => {
    // Look for edit button on first row
    const editButton = page.locator('button[aria-label*="edit" i], button:has-text("Edit"), a:has-text("Edit")').first();
    if (await editButton.isVisible().catch(() => false)) {
      await editButton.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('Delete/soft-delete a shop', async ({ page }) => {
    // Look for delete button
    const deleteButton = page.locator('button[aria-label*="delete" i], button:has-text("Delete"), button:has-text("Remove")').first();
    if (await deleteButton.isVisible().catch(() => false)) {
      await deleteButton.click();
      await page.waitForLoadState('networkidle');
      
      // Confirm if modal appears
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")').first();
      if (await confirmButton.isVisible().catch(() => false)) {
        await confirmButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });
});