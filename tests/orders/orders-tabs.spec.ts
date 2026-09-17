import { test, expect } from "@playwright/test";

/** The Orders module owns one route per page, all under Operations. */
const ORDERS = "/operations/orders";
const PAGES = [
  `${ORDERS}/collection`,
  `${ORDERS}/assignment`,
  `${ORDERS}/delivery-tracking`,
] as const;

/** The sidebar is the switcher — there is deliberately no in-page tab strip. */
async function openViaSidebar(
  page: import("@playwright/test").Page,
  href: string,
) {
  await page.locator(`a[href="${href}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`${href.replace(/\//g, "\\/")}$`));
}

test("each Orders page is its own URL, reachable by reload and by browser back", async ({
  page,
}) => {
  await page.goto(PAGES[0]);
  await expect(page.locator("#orders-panel-collection table")).toBeVisible();

  await openViaSidebar(page, PAGES[1]);
  await expect(page.locator("#orders-panel-assignment")).toBeVisible();

  await openViaSidebar(page, PAGES[2]);
  await expect(page.locator("#orders-panel-tracking")).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${ORDERS}/assignment$`));
  await expect(page.locator("#orders-panel-assignment")).toBeVisible();

  // A reload lands on the same page, not on the first one.
  await page.reload();
  await expect(page.locator("#orders-panel-assignment")).toBeVisible();
  await expect(
    page.locator(`a[href="${ORDERS}/assignment"]`).first(),
  ).toHaveClass(/font-semibold/);
});

test("no in-page switcher: three sibling routes, and only the sidebar moves between them", async ({
  page,
}) => {
  for (const href of PAGES) {
    await page.goto(href);
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(page.locator(".orders-tab-rail")).toHaveCount(0);
  }
  // Each URL mounts its own page and names it.
  await page.goto(`${ORDERS}/collection`);
  await expect(
    page
      .getByRole("heading", { name: "Order Collection", exact: true })
      .first(),
  ).toBeVisible();
  await page.goto(`${ORDERS}/assignment`);
  await expect(
    page
      .getByRole("heading", { name: "Order Assignment", exact: true })
      .first(),
  ).toBeVisible();
});

test("sidebar rows under Operations address the Orders pages directly", async ({
  page,
}) => {
  await page.goto("/dashboard");
  for (const href of PAGES) {
    await expect(page.locator(`a[href="${href}"]`).first()).toBeAttached();
  }
  await openViaSidebar(page, `${ORDERS}/assignment`);
  await expect(page.locator("#orders-panel-assignment")).toBeVisible();
});

test("collection search and pagination survive page switches; filtering precedes pagination", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/collection`);
  const panel = page.locator("#orders-panel-collection");
  await expect(panel.locator("table")).toBeVisible();
  const search = panel.getByRole("textbox", { name: /search/i });
  await search.fill("no-such-shop-xyz");
  await expect(panel.locator('tbody input[type="number"]')).toHaveCount(0);
  await openViaSidebar(page, `${ORDERS}/delivery-tracking`);
  await openViaSidebar(page, `${ORDERS}/collection`);
  await expect(search).toHaveValue("no-such-shop-xyz");
  await search.fill("");
  await expect(panel.locator("tbody tr")).toHaveCount(10);
});

test("state survives moving between the sidebar pages (one shared workspace instance)", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/collection`);
  const panel = page.locator("#orders-panel-collection");
  await expect(panel.locator("table")).toBeVisible();
  const search = panel.getByRole("textbox", { name: /search/i });
  await search.fill("shared-instance-probe");
  await openViaSidebar(page, `${ORDERS}/delivery-tracking`);
  await expect(page.locator("#orders-panel-tracking")).toBeVisible();
  await openViaSidebar(page, `${ORDERS}/collection`);
  // Same mounted page: the work in progress is still there, not a fresh load.
  await expect(search).toHaveValue("shared-instance-probe");
  await expect(panel.locator("table")).toBeVisible();
});

test("refresh is table-scoped and leaves filters and navigation mounted", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/collection`);
  const panel = page.locator("#orders-panel-collection");
  await expect(panel.locator("table")).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/trips?*", async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await panel.getByRole("button", { name: /Refresh/i }).click();
    await expect(panel.locator('tbody [aria-busy="true"]')).toBeVisible();
    await expect(
      page.locator(`a[href="${ORDERS}/assignment"]`).first(),
    ).toBeVisible();
    await expect(panel.getByRole("textbox", { name: /search/i })).toBeVisible();
    await expect(panel.locator("thead")).toBeVisible();
  } finally {
    release();
  }
  await expect(panel.locator('tbody [aria-busy="true"]')).toHaveCount(0);
});

test("legacy ?tab=orders deep links canonicalise to the page path", async ({
  page,
}) => {
  await page.goto("/operations?tab=orders&orderTab=assignment");
  await expect(page).toHaveURL(new RegExp(`${ORDERS}/assignment$`));
  await expect(page.locator("#orders-panel-assignment")).toBeVisible();
});

test("invalid URLs fall back safely instead of mounting an unknown page", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/nope?collectionDate=2026-99-99`);
  await expect(page.locator("#orders-panel-collection table")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("collectionDate")).not.toBe(
    "2026-99-99",
  );
});

test("each page stands on its own on a phone-width viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const byRoute: Record<string, string> = {
    [`${ORDERS}/collection`]: "collection",
    [`${ORDERS}/assignment`]: "assignment",
    [`${ORDERS}/delivery-tracking`]: "tracking",
  };
  for (const [href, panel] of Object.entries(byRoute)) {
    await page.goto(href);
    await expect(
      page.locator(`#orders-panel-${panel}`).getByRole("table").first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("collection has a separate filter card and named table header", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/collection`);
  const panel = page.locator("#orders-panel-collection");
  await expect(
    panel.getByRole("region", {
      name: "Order Collection filters",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    panel.getByRole("heading", { name: "Order Collection", exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Reset", exact: true }),
  ).toBeVisible();
  await expect(panel.getByRole("button", { name: /Refresh/i })).toBeVisible();
});

test("collection keeps one action only — Save Progress — and the deadline speaks for itself", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/collection`);
  const panel = page.locator("#orders-panel-collection");
  await expect(panel.locator("table")).toBeVisible();

  // No Cancel, no manual Finish: a day is filed by its own window, not by a
  // button, so the only commit control on the screen is Save Progress.
  await expect(
    panel.getByRole("button", { name: /finish collection/i }),
  ).toHaveCount(0);
  await expect(panel.getByRole("button", { name: /^cancel$/i })).toHaveCount(0);
  await expect(
    panel.getByRole("button", { name: /save progress/i }),
  ).toBeVisible();
  // And the screen says when it will submit itself: "Auto-submits DD/MM 12:00 AM".
  await expect(
    panel.getByText(/auto-submits \d{2}\/\d{2}/).first(),
  ).toBeVisible();
});

test("collection columns are collection-only, and every header carries its icon", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/collection`);
  const head = page.locator("#orders-panel-collection thead th");
  await expect(head).toHaveCount(8);
  const labels = (await head.allInnerTexts()).map((text) =>
    text.replace(/\s+/g, " ").trim(),
  );
  expect(labels).toEqual([
    "S.No",
    "Shop Name",
    "City",
    "No. of Birds",
    "No. of Boxes *",
    "Weight",
    "Status",
    "Action",
  ]);
  // One glyph per column, each in its own colour — and never the same glyph
  // twice for one control (15px here, so it reads beside a 14px word).
  await expect(
    page.locator("#orders-panel-collection thead th svg"),
  ).toHaveCount(8);
});

test("two columns are measured, the six between them are equal, and the number boxes stay small", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/collection`);
  const cells = await page.locator("#orders-panel-collection thead th").all();
  expect(cells).toHaveLength(8);
  const boxes = await Promise.all(cells.map((cell) => cell.boundingBox()));
  const six = boxes.slice(1, 7).map((b) => b!.width);
  // The six share what is left exactly — that is the point of measuring only the
  // outer pair, so no heading can buy itself extra room from its neighbours.
  expect(Math.max(...six) - Math.min(...six)).toBeLessThanOrEqual(2);
  expect(Math.round(boxes[0]!.width)).toBe(96); // S.No
  expect(Math.round(boxes[7]!.width)).toBe(112); // Action (eraser + countdown)
  // A head that does not fit its share wraps inside its own cell.
  await expect(
    page.locator("#orders-panel-collection thead th").nth(4),
  ).toHaveClass(/break-words/);

  const row = page
    .locator("#orders-panel-collection tbody tr")
    .filter({ has: page.locator("input") })
    .first();
  const fields = await Promise.all(
    (await row.getByRole("spinbutton").all()).map((input) =>
      input.boundingBox(),
    ),
  );
  expect(fields).toHaveLength(3); // birds · boxes · weight
  for (const box of fields) {
    // Tall enough to hit comfortably, narrow enough to look like a number field.
    expect(Math.round(box!.height)).toBe(32);
    expect(box!.width).toBeLessThanOrEqual(106);
  }
});

test("every column starts its data under its own heading — one left edge, not two", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/collection`);
  const offsets = await page
    .locator("#orders-panel-collection table")
    .first()
    .evaluate((table) => {
      const ths = [...table.querySelectorAll("thead th")];
      const row = [...table.querySelectorAll("tbody tr")].find(
        (r) => r.querySelectorAll("input").length > 0,
      );
      if (!row) return [];
      const tds = [...row.children];
      const left = (el: Element) => el.getBoundingClientRect().left;
      return ths.map((th, index) => {
        const head = th.firstElementChild ?? th;
        const td = tds[index];
        // Plain-text cells (shop name, city) have no child element to measure, and
        // the status column is centred on purpose — it is measured separately below.
        if (index === 6) return null;
        const data = td?.querySelector("input, button, span");
        if (!td || !data) return null;
        return {
          head: Math.round(left(head) - left(th)),
          data: Math.round(left(data) - left(td)),
        };
      });
    });
  const measured = offsets.filter(
    (entry): entry is { head: number; data: number } => entry !== null,
  );
  // S.No · birds · boxes · weight · action
  expect(measured.length).toBeGreaterThanOrEqual(5);
  for (const { head, data } of measured) {
    // A right-aligned cell put its data tens of pixels away from its heading, which
    // is what made the columns look unevenly spaced even while their widths matched.
    expect(Math.abs(data - head)).toBeLessThanOrEqual(2);
  }
});

test("the status column sits in the middle of its share, as a chip should", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/collection`);
  const row = page
    .locator("#orders-panel-collection tbody tr")
    .filter({ has: page.locator("input") })
    .first();
  const statusCell = row.locator("td").nth(6);
  const [cell, pill] = await Promise.all([
    statusCell.boundingBox(),
    statusCell.locator("span").first().boundingBox(),
  ]);
  const cellMid = cell!.x + cell!.width / 2;
  const pillMid = pill!.x + pill!.width / 2;
  expect(Math.abs(cellMid - pillMid)).toBeLessThanOrEqual(3);
  // The heading follows the data, so the column reads as one centred block.
  await expect(
    page.locator("#orders-panel-collection thead th").nth(6),
  ).toHaveClass(/text-center/);
  // And the pill grew to match the 32px boxes beside it.
  expect(Math.round(pill!.height)).toBeGreaterThanOrEqual(30);
});

test("the day total is a cumulative line below the table, not a header KPI", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/collection`);
  const panel = page.locator("#orders-panel-collection");
  const cumulative = panel.getByText(/^Orders taken in \d+ shops$/);
  await expect(cumulative).toBeVisible();
  const total = await cumulative.boundingBox();
  const table = await panel.locator("table").first().boundingBox();
  expect(total && table && total.y > table.y + table.height - 8).toBe(true);
  // The old header summary ("N shops · N boxes · N birds") is gone from here —
  // that wording now belongs to the Assignment page only.
  await expect(panel.getByText(/\d+ shops · \d+ boxes/)).toHaveCount(0);
});

test("filters fill one grid: day · city · shop · sort on the line, search + actions under it", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/collection`);
  const card = page.getByRole("region", { name: "Order Collection filters" });
  const label = (name: string) => card.getByText(name, { exact: true }).first();
  const box = async (name: string) => await label(name).boundingBox();
  const [date, city, shop, sort, search] = await Promise.all([
    box("Date"),
    box("City"),
    box("Shop"),
    box("Sort"),
    box("Search"),
  ]);
  expect(date && city && shop && sort && search).toBeTruthy();
  // Four fields share one row, left to right: day, area, shop, order of rows.
  for (const other of [city!, shop!, sort!]) {
    expect(Math.abs(date!.y - other.y) <= 2).toBe(true);
  }
  expect(date!.x < city!.x).toBe(true);
  expect(city!.x < shop!.x).toBe(true);
  expect(shop!.x < sort!.x).toBe(true);
  // Equal weight: nothing on the line is allowed to be twice the width of its
  // neighbour, which is what made the first pass read as controls floating in a
  // wide card.
  const widths = [date!, city!, shop!, sort!].map((b) => b.width);
  expect(Math.max(...widths) / Math.min(...widths)).toBeLessThan(2);
  // The search runs the width of the card and takes the row under the fields,
  // with Reset + Refresh closing it on the right.
  const cardBox = await card.boundingBox();
  expect(search!.y > date!.y).toBe(true);
  expect(search!.width).toBeGreaterThan((cardBox?.width ?? 0) * 0.5);
  const reset = await card
    .getByRole("button", { name: "Reset", exact: true })
    .boundingBox();
  const refresh = await card
    .getByRole("button", { name: /Refresh/i })
    .boundingBox();
  expect(reset && refresh).toBeTruthy();
  expect(Math.abs(refresh!.y - reset!.y) <= 2).toBe(true);
  expect(refresh!.x > reset!.x).toBe(true);
  // Bottom-aligned: the search field and the two buttons share a baseline.
  const searchField = await card
    .getByRole("textbox", { name: /search/i })
    .boundingBox();
  expect(
    Math.abs(
      searchField!.y + searchField!.height - (reset!.y + reset!.height),
    ) <= 6,
  ).toBe(true);
});

test("every filter control is the same height as the trip list inputs", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/collection`);
  const card = page.getByRole("region", { name: "Order Collection filters" });
  const heights = await Promise.all([
    card.getByTestId("orders-date-picker").locator("input").boundingBox(),
    card.getByRole("button", { name: "City", exact: true }).boundingBox(),
    card.getByRole("button", { name: "Shop", exact: true }).boundingBox(),
    card.getByRole("button", { name: "Sort", exact: true }).boundingBox(),
    card.getByRole("textbox", { name: /search/i }).boundingBox(),
  ]);
  for (const box of heights) {
    expect(box, "control renders").toBeTruthy();
    // 40px (h-10) — the shared input height, so one grid line runs through every
    // field on the card.
    expect(
      Math.abs(box!.height - 40) <= 1,
      `control height ${box!.height}`,
    ).toBe(true);
  }
});

test("no tooltip is left on the collection screen", async ({ page }) => {
  await page.goto(`${ORDERS}/collection`);
  // Nothing on this page hides information behind a hover: the row state is the
  // badge, the deadline is the chip. (The sidebar keeps its own native titles —
  // that is app chrome, not this screen.)
  await expect(
    page.locator("#orders-panel-collection").getByTitle(/./),
  ).toHaveCount(0);
});

test("the shop-name filter narrows the sheet to the shops picked", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/collection`);
  const card = page.getByRole("region", { name: "Order Collection filters" });
  const panel = page.locator("#orders-panel-collection");
  const firstName = (
    await panel.locator("tbody tr td:nth-child(2)").first().innerText()
  ).trim();

  await card.getByRole("button", { name: "Shop", exact: true }).click();
  const listbox = card.getByRole("listbox");
  await listbox.getByRole("button", { name: firstName, exact: true }).click();
  await page.keyboard.press("Escape");

  // Only that shop is left on the sheet, and the picker says so with a count.
  await expect(panel.locator("tbody tr")).toHaveCount(1);
  await expect(panel.locator("tbody tr").first()).toContainText(firstName);
  await expect(
    card.getByRole("button", { name: "Shop", exact: true }),
  ).not.toHaveText("All shops");
});

test("only the table loads: the filter card stays mounted while data is in flight", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Every source request is held, so this is the first paint of the page — the
  // moment the whole screen used to be swapped for a skeleton.
  await page.route("**/api/**", async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto(`${ORDERS}/collection`, { waitUntil: "commit" });
    const card = page.getByRole("region", { name: "Order Collection filters" });
    await expect(card).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Sort", exact: true }),
    ).toBeVisible();
    // …and the load is reported where it belongs: on the table, not the filters.
    await expect(
      page.locator('#orders-panel-collection [aria-busy="true"]'),
    ).toBeVisible();
    // The table arrives as the real frame — eight heads on their columns — with a
    // spinner row in the body, exactly the Trip List's shape. Nothing about the
    // page changes when the data lands, except the rows.
    await expect(page.locator("#orders-panel-collection thead th")).toHaveCount(
      8,
    );
    await expect(page.getByText("Loading…").first()).toBeVisible();
  } finally {
    release();
  }
  await expect(page.locator("#orders-panel-collection table")).toBeVisible();
  await expect(
    page.locator('#orders-panel-collection [aria-busy="true"]'),
  ).toHaveCount(0);
});

test("weight is a box on the sheet: empty until you type it, and it wins over the derived figure", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/collection`);
  const panel = page.locator("#orders-panel-collection");
  const row = panel
    .locator("tbody tr")
    .filter({ has: page.locator("input") })
    .first();
  const weight = row.getByRole("spinbutton", { name: /^Weight/ });

  // No default value is written into the box — the derived kg is only a hint.
  await expect(weight).toHaveValue("");
  await row.getByRole("spinbutton", { name: /No. of Birds/ }).fill("10");
  await weight.fill("123.45");

  // A typed weight takes the row over, and the day's cumulative line follows it
  // instead of the average.
  await expect(weight).toHaveValue("123.45");
  await expect(panel.getByText("123.45 KG").first()).toBeVisible();
});

test("the deadline chip says when, animates, and adds no countdown", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/collection`);
  const panel = page.locator("#orders-panel-collection");
  const chip = panel.getByText(/Auto-submits/).first();
  await expect(chip).toBeVisible();
  // The window itself is the animation — a ticking dot and a bar filling under
  // the deadline — and the countdown text was dropped from it.
  await expect(chip).toContainText("12:00 AM");
  await expect(chip).not.toContainText(/·/);
  await expect(panel.getByText(/\bin \d+[dhm]\b/)).toHaveCount(0);
  await expect(panel.locator('[class*="animate-ping"]').first()).toBeVisible();
});

test("the shop picker searches its own list and counts the picks on the trigger", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/collection`);
  const card = page.getByRole("region", { name: "Order Collection filters" });
  await card.getByRole("button", { name: "Shop", exact: true }).click();

  // A long shop list is not scrolled through: the picker opens with the caret in
  // its own filter box and the list narrows as you type.
  const pick = card.getByRole("textbox", { name: "Refine shops" });
  await expect(pick).toBeVisible();
  const first = await card
    .getByRole("listbox")
    .getByRole("option")
    .first()
    .innerText();
  const word = first.trim().split(/\s+/)[0];
  await pick.fill(word);
  await expect(card.getByRole("listbox").getByRole("option")).not.toHaveCount(
    0,
  );

  await card
    .getByRole("listbox")
    .getByRole("button", { name: word, exact: false })
    .first()
    .click();
  await expect(
    card.getByRole("button", { name: "Shop", exact: true }),
  ).toContainText("1 shop");
  await pick.fill("");
  await card.getByRole("listbox").getByRole("button").nth(1).click();
  await expect(
    card.getByRole("button", { name: "Shop", exact: true }),
  ).toContainText("2 shops");
});

test("the pending clear keeps running the delete motion, and the undo dialog pops in", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/collection`);
  const panel = page.locator("#orders-panel-collection");
  const row = panel
    .locator("tbody tr")
    .filter({ has: page.locator("input") })
    .first();
  await row.getByRole("spinbutton", { name: /No. of Birds/ }).fill("9");
  await row.locator("td").last().getByRole("button").click();

  // The eraser itself keeps wiggling for the whole window — the same token the
  // trip delete uses — instead of swapping to a different icon, and the dialog
  // pops in the way the app's confirmations do.
  await expect(
    row.locator("td").last().locator('[class*="--animate-action-delete"]'),
  ).toBeVisible();
  await expect(
    page.locator('[class*="--animate-pop-in"]').first(),
  ).toBeVisible();

  await row.locator("td").last().getByRole("button").click();
  await expect(
    row.getByRole("spinbutton", { name: /No. of Birds/ }),
  ).toHaveValue("9");
});

test("Save Progress answers the click the way the other action buttons do", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/collection`);
  const save = page
    .locator("#orders-panel-collection")
    .getByRole("button", { name: /save progress/i });
  await expect(save).toBeVisible();
  // Hover motion from the shared token (the app's own action animation), a lift on
  // the button, and the icon wrapped so the animation lands on the glyph.
  await expect(save.locator('[class*="--animate-action-approve"]')).toHaveCount(
    1,
  );
  await expect(save).toHaveClass(/group/);
  await expect(save).toHaveClass(/hover:-translate-y-px/);
});

test("the action zeroes the shop instead of deleting it, with a 10-second undo", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/collection`);
  const row = page
    .locator("#orders-panel-collection tbody tr")
    .filter({ has: page.locator("input") })
    .first();
  const birds = row.locator("input").first();
  await birds.fill("12");

  await row.locator("td").last().getByRole("button").click();

  // Nothing is committed while the window runs: the typed numbers are still there
  // and the row keeps its place on the sheet.
  await expect(birds).toHaveValue("12");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("0 birds and 0 boxes");
  // The shared undo dialog is delete-flavoured for the Recent table; here it must
  // not promise a deletion, because the order line survives at zero.
  await expect(dialog).not.toContainText("deleted automatically");
  await expect(dialog).not.toContainText("Deleting in");
  await expect(dialog).toContainText("Clearing in");

  // Undoing from the row puts the numbers back.
  await row.locator("td").last().getByRole("button").click();
  await expect(dialog).toHaveCount(0);
  await expect(birds).toHaveValue("12");
});

test("the header breadcrumb names the module and the page", async ({
  page,
}) => {
  await page.goto(`${ORDERS}/collection`);
  // Operations › Orders › Collection — the group is its own crumb, so a short
  // row name ("Collection") is never ambiguous.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Collection",
  );
  const crumbs = page.locator("header").first().getByRole("link");
  await expect(crumbs.filter({ hasText: "Operations" }).first()).toBeVisible();
  await expect(crumbs.filter({ hasText: /^Orders$/ }).first()).toHaveAttribute(
    "href",
    new RegExp(`${ORDERS}/collection$`),
  );
});

test("the sidebar names the rows Collection / Assignment / Delivery", async ({
  page,
}) => {
  await page.goto("/dashboard");
  const names = await page
    .locator(`a[href^="${ORDERS}/"]`)
    .evaluateAll((links) => [
      ...new Set(links.map((link) => link.textContent!.trim())),
    ]);
  expect(names).toEqual(["Collection", "Assignment", "Delivery"]);
});
