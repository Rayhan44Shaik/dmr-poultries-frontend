import { test, expect, type Locator } from '@playwright/test';

const transparentHen = /dmr-hen-transparent[^/]*\.png(?:\?.*)?$/;

async function expectNoBadge(logo: Locator) {
  await expect(logo).toBeVisible();
  const frame = logo.locator('..');
  await expect(frame).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(frame).toHaveCSS('background-image', 'none');
  await expect(frame).toHaveCSS('box-shadow', 'none');
  await expect(frame).toHaveCSS('border-width', '0px');
}

async function expectTransparentBird(logo: Locator) {
  await expect(logo).toHaveAttribute('src', transparentHen);
  const pixels = await logo.evaluate(async (element) => {
    const image = element as HTMLImageElement;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const alphaAt = (x: number, y: number) => data[(y * canvas.width + x) * 4 + 3];
    return {
      corners: [
        alphaAt(0, 0),
        alphaAt(canvas.width - 1, 0),
        alphaAt(0, canvas.height - 1),
        alphaAt(canvas.width - 1, canvas.height - 1),
      ],
      body: alphaAt(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2)),
    };
  });
  expect(pixels.corners).toEqual([0, 0, 0, 0]);
  expect(pixels.body).toBe(255);
}

for (const theme of ['light', 'dark']) {
  test(`Operations logo has no box on first load or reload in ${theme} mode`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.addInitScript((value) => localStorage.setItem('theme', value), theme);

    // Hold image responses until the first render is inspected. This catches
    // the old JPG -> canvas PNG swap, even with a warm cache or fast network.
    let releaseImage!: () => void;
    const imageReady = new Promise<void>((resolve) => { releaseImage = resolve; });
    const imageRequests: string[] = [];
    await page.route(/\/dmr-hen[^/]*\.(?:jpg|png)(?:\?.*)?$/, async (route) => {
      if (route.request().resourceType() === 'image') {
        imageRequests.push(route.request().url());
        await imageReady;
      }
      await route.continue();
    });

    try {
      await page.goto('/operations', { waitUntil: 'domcontentloaded' });
      const logo = page.locator('aside:visible img').first();
      await expectNoBadge(logo);
      await expect(logo).toHaveAttribute('src', transparentHen);
      const initialSource = await logo.getAttribute('src');
      const initialBounds = await logo.locator('..').boundingBox();

      releaseImage();
      await expectTransparentBird(logo);
      await expect(logo).toHaveAttribute('src', initialSource!);
      expect(await logo.locator('..').boundingBox()).toEqual(initialBounds);
      expect(imageRequests).toHaveLength(1);
      expect(imageRequests[0]).toMatch(transparentHen);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expectNoBadge(logo);
      await expectTransparentBird(logo);
      await expect(logo).toHaveAttribute('src', initialSource!);
    } finally {
      releaseImage();
    }
  });
}

for (const { language, openMenu } of [
  { language: 'en', openMenu: 'Open navigation menu' },
  { language: 'te', openMenu: 'నావిగేషన్ మెనూ తెరవండి' },
]) {
  test(`Mobile Operations branding shows only the bird and name in ${language}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((value) => localStorage.setItem('dmr-language', value), language);
    await page.goto('/operations');
    await page.getByRole('button', { name: openMenu, exact: true }).click();
    const drawer = page.getByRole('dialog');
    const logo = drawer.locator('aside img').first();
    await expectNoBadge(logo);
    await expectTransparentBird(logo);
    const brandName = drawer.getByRole('heading', { name: 'DMR Poultries', exact: true });
    await expect(brandName.locator('..')).toHaveText('DMR Poultries');
  });
}

for (const width of [1440, 390]) {
  test(`Sign-in branding shows only the bird and name at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/');
    const logo = page.locator('img:visible').first();
    await expectNoBadge(logo);
    await expectTransparentBird(logo);
    const brandName = page.locator('h1:visible');
    await expect(brandName.locator('..')).toHaveText('DMR Poultries');
    await expect(page).toHaveTitle('DMR Poultries');
  });
}
