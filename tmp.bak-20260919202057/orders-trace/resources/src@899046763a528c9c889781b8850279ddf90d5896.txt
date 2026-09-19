import { test, expect } from "@playwright/test";

const COLLECTION = "/operations/orders/collection";
const ASSIGNMENT = "/operations/orders/assignment";

test("real collection persists with a positive container id and no trip-zero request", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(`${request.method()} ${request.url()}`));

  await page.goto("/");
  await page.locator("#login-username").fill("test-owner-4100");
  await page.locator("#login-password").fill("Test-only-password-123!");
  await page.getByRole("checkbox", { name: /remember me/i }).check();
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/);

  await page.locator(`a[href="${COLLECTION}"]`).first().click();
  await expect(page.locator("#orders-panel-collection")).toBeVisible({ timeout: 20_000 });
  const row = page.locator("tbody tr", { hasText: "Orders E2E Shop 1" });
  await expect(row).toBeVisible();
  await row.getByRole("spinbutton", { name: /No\. of Birds/i }).fill("200");
  await row.getByRole("spinbutton", { name: /No\. of Boxes/i }).fill("20");
  await row.getByRole("spinbutton", { name: /^Weight/i }).fill("400");

  const saveResponse = page.waitForResponse(
    (response) => response.request().method() === "POST" && /\/api\/trips\/\d+\/steps\/deliveries$/.test(response.url()),
  );
  await page.getByRole("button", { name: /save progress/i }).click();
  const saved = await saveResponse;
  expect(saved.status()).toBe(200);
  const savedBody = await saved.json();
  expect(savedBody.id).toBeGreaterThan(0);
  expect(savedBody.tripNo).toBeTruthy();
  expect(new URL(saved.url()).pathname).toBe(`/api/trips/${savedBody.id}/steps/deliveries`);
  expect(requests.some((request) => /\/trips\/0\//.test(request))).toBe(false);

  await page.reload();
  await expect(page.locator("#orders-panel-collection")).toBeVisible({ timeout: 20_000 });
  const refreshed = page.locator("tbody tr", { hasText: "Orders E2E Shop 1" });
  await expect(refreshed.getByRole("spinbutton", { name: /No\. of Birds/i })).toHaveValue("200");
  await expect(refreshed.getByRole("spinbutton", { name: /No\. of Boxes/i })).toHaveValue("20");
  await expect(refreshed.getByRole("spinbutton", { name: /^Weight/i })).toHaveValue("400");

  await page.goto(ASSIGNMENT);
  await expect(page.getByText("Orders E2E Shop 1", { exact: true }).first()).toBeVisible();
});
