import { expect, type Locator, type Page, test } from "@playwright/test";

const groups = ["Text & Data", "Generate & Encode", "Dev & Security", "Time & Convert"];
const viewports = [320, 375, 768, 1024, 1280, 1440];

async function ready(page: Page): Promise<void> {
  await expect
    .poll(() => page.locator("html").evaluate((element) => element.style.colorScheme))
    .toMatch(/^(light|dark)$/);
}

async function contained(locator: Locator, width: number): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
  }
}

for (const width of viewports) {
  for (const theme of ["light", "dark"] as const) {
    test(`${width}px ${theme}: header fits, every tool has a navigation path, menus and search work`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((mode) => localStorage.setItem("theme", mode), theme);
      await page.goto("/");
      await ready(page);
      // Classic scrollbars can reduce WebKit's media viewport below the
      // requested window width. Assert the same xl breakpoint as the CSS.
      const wide = await page.evaluate(() => matchMedia("(min-width: 80rem)").matches);
      await expect(page.locator("html")).toHaveCSS("color-scheme", theme);
      const allTools = await page
        .locator('main a[href^="/"]')
        .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
      expect(allTools.length).toBeGreaterThan(18);
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
        )
        .toBe(0);
      const controls = page.locator("header button:visible, header a:visible");
      const boxes = await controls.evaluateAll((elements) =>
        elements.map((element) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x, y, width, height };
        }),
      );
      for (let i = 0; i < boxes.length; i += 1) {
        expect(boxes[i].x).toBeGreaterThanOrEqual(0);
        expect(boxes[i].x + boxes[i].width).toBeLessThanOrEqual(width);
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          expect(
            a.x < b.x + b.width &&
              b.x < a.x + a.width &&
              a.y < b.y + b.height &&
              b.y < a.y + a.height,
          ).toBe(false);
        }
      }
      const paths: (string | null)[] = [];
      for (const name of wide ? groups : ["Tools"]) {
        const trigger = page.getByRole("button", { name, exact: true });
        await trigger.click();
        await expect(trigger).toHaveAttribute("aria-expanded", "true");
        const panel = page.locator("#tools-panel");
        await contained(panel, width);
        await expect
          .poll(() => panel.evaluate((element) => element.scrollWidth - element.clientWidth))
          .toBe(0);
        paths.push(
          ...(await panel
            .locator('a[href^="/"]:not([href="/"])')
            .evaluateAll((links) => links.map((link) => link.getAttribute("href")))),
        );
        await trigger.click();
        await expect(panel).toHaveCount(0);
      }
      expect(paths.sort()).toEqual(allTools.sort());
      const search = page.getByRole("button", { name: "Search", exact: true });
      await search.click();
      await contained(page.locator("#tools-panel"), width);
      await page.getByPlaceholder("Search tools...").fill("world clock");
      const result = page
        .getByRole("region", { name: "Tool search" })
        .locator('a[href="/timezone"]');
      await expect(result).toBeVisible();
      await result.click();
      await expect(page).toHaveURL(/\/timezone$/);
      await expect(page.locator("#tools-panel")).toHaveCount(0);
      await expect(page.getByLabel("Source time zone", { exact: true })).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
        )
        .toBe(0);
      const currentTrigger = page.getByRole("button", {
        name: wide ? "Time & Convert" : "Tools",
        exact: true,
      });
      await currentTrigger.click();
      await expect(page.locator('#tools-panel a[href="/timezone"]')).toHaveAttribute(
        "aria-current",
        "page",
      );
      await page.keyboard.press("Escape");
      await expect(currentTrigger).toBeFocused();
      await expect(page.locator("#tools-panel")).toHaveCount(0);
    });
  }
}

test("keyboard disclosure, focus return, outside click, tab-out and route changes close menus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await ready(page);
  const trigger = page.getByRole("button", { name: "Time & Convert", exact: true });
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#tools-panel a").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#tools-panel")).toBeVisible();
  await page.getByRole("button", { name: "Close tools menu" }).click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.locator("footer").click();
  await expect(page.locator("#tools-panel")).toHaveCount(0);
  await trigger.click();
  await page.locator("#tools-panel a").last().focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#tools-panel")).toHaveCount(0);
  await trigger.click();
  await page.locator('#tools-panel a[href="/timezone"]').click();
  await expect(page).toHaveURL(/\/timezone$/);
  await expect(page.locator("#tools-panel")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#tools-panel")).toHaveCount(0);
  await trigger.click();
  await page.setViewportSize({ width: 375, height: 700 });
  await expect(page.locator("#tools-panel")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Tools", exact: true })).toBeVisible();
});

test("global slash search retains name, description, category and keyword matching without hijacking input", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  await page.locator("body").click({ position: { x: 2, y: 70 } });
  await page.keyboard.press("/");
  const searchInput = page.getByPlaceholder("Search tools...");
  await expect(searchInput).toBeFocused();
  for (const word of [
    "timezone",
    "time zone",
    "world clock",
    "PST",
    "PDT",
    "UTC",
    "GMT",
    "DST",
    "daylight saving",
    "convert",
  ]) {
    await searchInput.fill(word);
    await expect(page.locator('#tools-panel a[href="/timezone"]')).toBeVisible();
  }
  await searchInput.fill("Finance");
  await expect(page.locator('#tools-panel a[href="/exchange-rate"]')).toBeVisible();
  await searchInput.fill("validate JSON data");
  await expect(page.locator('#tools-panel a[href="/json"]')).toBeVisible();
  await searchInput.fill("no-such-tool");
  await expect(page.getByRole("status")).toContainText("No tools match");
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(searchInput).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Search", exact: true })).toBeFocused();
  await page.goto("/json");
  await ready(page);
  const textarea = page.locator("textarea").first();
  await textarea.focus();
  await page.keyboard.press("/");
  await expect(textarea).toHaveValue("/");
  await expect(page.locator("#tools-panel")).toHaveCount(0);
});

test("compact tools menu scrolls vertically to the last tool without leaving viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await ready(page);
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  const panel = page.locator("#tools-panel");
  const height = await panel.evaluate((element) => ({
    content: element.scrollHeight,
    view: element.clientHeight,
    bottom: element.getBoundingClientRect().bottom,
  }));
  expect(height.content).toBeGreaterThan(height.view);
  expect(height.bottom).toBeLessThanOrEqual(568);
  const last = panel.locator('a[href="/exchange-rate"]');
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  await contained(panel, 320);
});
