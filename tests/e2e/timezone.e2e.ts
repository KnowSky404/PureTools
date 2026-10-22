import { expect, type Page, test } from "@playwright/test";

test.use({ timezoneId: "America/New_York" });

const source = (page: Page) => page.getByLabel("Source time zone", { exact: true });
const target = (page: Page) => page.getByLabel("Target time zone", { exact: true });
const input = (page: Page) => page.getByLabel("Source date and time", { exact: true });
const output = (page: Page) => page.getByLabel("Converted date and time", { exact: true });

async function openTimezone(page: Page): Promise<void> {
  await page.goto("/timezone");
  await expect(page).toHaveTitle("Time Zone Converter & World Clock | PureTools");
  await expect(
    page.getByRole("heading", { name: "Time Zone Converter & World Clock", exact: true }),
  ).toBeVisible();
  await expect(source(page)).toBeVisible();
  await expect(output(page)).toBeVisible();
}

test("device-local initialization, six exact world clocks, refresh and no time/backend requests", async ({
  page,
}) => {
  const errors: string[] = [];
  const dataRequests: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (["fetch", "xhr", "beacon"].includes(request.resourceType()) || request.method() !== "GET") {
      dataRequests.push(request.url());
    }
    if (!["127.0.0.1", "fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname)) {
      external.push(request.url());
    }
  });
  await page.clock.setFixedTime(new Date("2026-10-22T21:06:00Z"));
  await openTimezone(page);
  await expect(source(page)).toHaveValue("America/New_York");
  await expect(input(page)).toHaveValue("2026-10-22T17:06");
  for (const [city, date, time, offset] of [
    ["Los Angeles", "2026-10-22", "14:06:00", "UTC−07:00"],
    ["New York", "2026-10-22", "17:06:00", "UTC−04:00"],
    ["London", "2026-10-22", "22:06:00", "UTC+01:00"],
    ["Beijing", "2026-10-23", "05:06:00", "UTC+08:00"],
    ["Tokyo", "2026-10-23", "06:06:00", "UTC+09:00"],
    ["Sydney", "2026-10-23", "08:06:00", "UTC+11:00"],
  ]) {
    const clock = page.getByRole("article", { name: `${city} clock`, exact: true });
    await expect(clock.locator("time")).toHaveText(time);
    await expect(clock).toContainText(date);
    await expect(clock).toContainText(offset);
    await expect(clock).toContainText(date.endsWith("23") ? "Next day" : "Same day");
  }
  await expect(page.getByRole("article")).toHaveCount(6);
  await page.reload();
  await expect(source(page)).toHaveValue("America/New_York");
  await expect(page.getByRole("article")).toHaveCount(6);
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(dataRequests).toEqual([]);
  expect(external).toEqual([]);
});

test("fixed PDT/PST, automatic regions, cross-day/year, search, Now and instant-preserving swaps", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-22T21:06:00Z"));
  await openTimezone(page);
  await source(page).selectOption("fixed:PDT");
  await input(page).fill("2026-10-22T14:06");
  await expect(output(page)).toHaveText("2026-10-23 05:06:00");
  await expect(page.getByTestId("source-offset")).toContainText("UTC−07:00");
  await expect(page.getByText("Next day (+1 day)", { exact: true }).first()).toBeVisible();
  await source(page).selectOption("fixed:PST");
  await expect(output(page)).toHaveText("2026-10-23 06:06:00");
  await page.getByRole("button", { name: "Swap source and target time zones" }).click();
  await expect(source(page)).toHaveValue("Asia/Shanghai");
  await expect(target(page)).toHaveValue("fixed:PST");
  await expect(input(page)).toHaveValue("2026-10-23T06:06");
  await expect(output(page)).toHaveText("2026-10-22 14:06:00");
  await expect(page.getByText("Previous day (−1 day)", { exact: true })).toBeVisible();
  await page.getByLabel("Target time zone search").fill("Kathmandu");
  await target(page).selectOption("Asia/Kathmandu");
  await expect(output(page)).toHaveText("2026-10-23 03:51:00");
  await expect(page.getByTestId("target-offset")).toContainText("UTC+05:45");
  await page.getByLabel("Target time zone search").fill("");
  await target(page).selectOption("UTC");
  await source(page).selectOption("fixed:UTC");
  await input(page).fill("2026-12-31T23:59:59.123");
  await target(page).selectOption("Asia/Tokyo");
  await expect(output(page)).toHaveText("2027-01-01 08:59:59");
  await page.getByRole("button", { name: "Swap source and target time zones" }).click();
  await expect(input(page)).toHaveValue("2027-01-01T08:59:59.123");
  await page.getByRole("button", { name: "Now", exact: true }).click();
  await expect(input(page)).toHaveValue("2026-10-23T06:06");
  await page.getByLabel("Source time zone search").fill("not-a-zone");
  await expect(page.getByText("No matching time zones. Try a city or region name.")).toBeVisible();
  await expect(source(page)).toHaveValue("Asia/Tokyo");
});

test("DST gaps fail explicitly; overlaps require a choice and retain the selected instant when swapped", async ({
  page,
}) => {
  await openTimezone(page);
  await source(page).selectOption("America/Los_Angeles");
  await target(page).selectOption("fixed:UTC");
  await input(page).fill("2026-03-08T02:30");
  await expect(page.getByRole("alert")).toContainText("does not exist");
  await expect(output(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy Result" })).toBeDisabled();
  await input(page).fill("2026-11-01T01:30");
  const earlier = page.getByRole("radio", { name: /Earlier · UTC−07:00/ });
  const later = page.getByRole("radio", { name: /Later · UTC−08:00/ });
  await expect(earlier).not.toBeChecked();
  await expect(later).not.toBeChecked();
  await expect(output(page)).toHaveCount(0);
  await earlier.check();
  await expect(output(page)).toHaveText("2026-11-01 08:30:00");
  await later.check();
  await expect(output(page)).toHaveText("2026-11-01 09:30:00");
  await page.getByRole("button", { name: "Swap source and target time zones" }).click();
  await expect(input(page)).toHaveValue("2026-11-01T09:30");
  await expect(output(page)).toHaveText("2026-11-01 01:30:00");
  await page.getByRole("button", { name: "Swap source and target time zones" }).click();
  await expect(later).toBeChecked();
  await expect(output(page)).toHaveText("2026-11-01 09:30:00");
  await input(page).fill("2026-11-01T01:31");
  await expect(later).not.toBeChecked();
  await expect(output(page)).toHaveCount(0);
});

test("clock cities and 12/24-hour preferences persist, with duplicate and removal handling", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-22T21:06:00Z"));
  await openTimezone(page);
  await page.getByRole("button", { name: "Remove London", exact: true }).click();
  await page.getByLabel("Add a city search").fill("Kathmandu");
  await page.getByLabel("Add a city", { exact: true }).selectOption("Asia/Kathmandu");
  await page.getByRole("button", { name: "Add City", exact: true }).click();
  await expect(page.getByRole("article", { name: "Kathmandu clock", exact: true })).toContainText(
    "UTC+05:45",
  );
  await page.getByRole("button", { name: "Add City", exact: true }).click();
  await expect(page.getByText("That city is already in your world clock.")).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(6);
  await page.getByRole("checkbox", { name: "12-hour clock" }).check();
  await expect(
    page.getByRole("article", { name: "Los Angeles clock", exact: true }).locator("time"),
  ).toHaveText("2:06:00 PM");
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("puretools.world-clock.v1") ?? "null"),
  );
  expect(stored.hour12).toBe(true);
  expect(stored.zones).toContain("Asia/Kathmandu");
  expect(stored.zones).not.toContain("Europe/London");
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "12-hour clock" })).toBeChecked();
  await expect(page.getByRole("article", { name: "London clock", exact: true })).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Kathmandu clock", exact: true })).toBeVisible();
  for (const name of ["Los Angeles", "New York", "Beijing", "Tokyo", "Sydney", "Kathmandu"]) {
    await page.getByRole("button", { name: `Remove ${name}`, exact: true }).click();
  }
  await expect(page.getByText("No cities yet. Add a city below.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add City", exact: true })).toBeEnabled();
});

test("blocked storage keeps converter, clocks, theme and navigation functional", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    for (const method of ["getItem", "setItem", "removeItem"]) {
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value: () => {
          throw new DOMException("Blocked", "SecurityError");
        },
      });
    }
  });
  await openTimezone(page);
  await expect(page.getByText("Local storage is unavailable.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Remove Tokyo", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(5);
  await page.getByRole("checkbox", { name: "12-hour clock" }).check();
  await page.getByRole("button", { name: /^Theme:/ }).click();
  await page.getByRole("button", { name: /^Theme:/ }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByPlaceholder("Search tools...").fill("world clock");
  await expect(
    page.getByRole("region", { name: "Tool search" }).locator('a[href="/timezone"]'),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("missing enumeration falls back to common IANA cities; corrupt preferences are safe", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Intl, "supportedValuesOf", { configurable: true, value: undefined });
    localStorage.setItem("puretools.world-clock.v1", "{broken");
  });
  await openTimezone(page);
  await expect(page.getByRole("article")).toHaveCount(6);
  await source(page).selectOption("Australia/Sydney");
  await target(page).selectOption("Asia/Kathmandu");
  await input(page).fill("2026-01-15T12:00");
  await expect(output(page)).toHaveText("2026-01-15 06:45:00");
});

test("missing Intl support provides explicit feedback without a page crash", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "Intl", { configurable: true, value: undefined });
  });
  await page.goto("/timezone");
  await expect(page.getByRole("alert")).toContainText("does not support Intl time zones");
  await expect(page.getByRole("button", { name: "Search", exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});

test("input, invalid zone and clipboard success/failure feedback", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as unknown as { copiedResult: string }).copiedResult = value;
        },
      },
    });
  });
  await openTimezone(page);
  await source(page).selectOption("fixed:PDT");
  await input(page).fill("2026-10-22T14:06");
  await page.getByRole("button", { name: "Copy Result" }).click();
  await expect(page.getByText("Copied!", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as { copiedResult: string }).copiedResult),
  ).toContain("2026-10-23 05:06:00 UTC+08:00");
  expect(
    await page.evaluate(() => (window as unknown as { copiedResult: string }).copiedResult),
  ).toContain("2026-10-22T21:06:00.000Z");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Clipboard denied");
        },
      },
    });
  });
  await page.getByRole("button", { name: "Copy Result" }).click();
  await expect(page.getByRole("alert")).toContainText("Could not copy");
  await input(page).fill("");
  await expect(page.getByRole("alert")).toHaveText(
    "Enter a valid source date and time, including the date.",
  );
  await expect(page.getByRole("button", { name: "Copy Result" })).toBeDisabled();
  await input(page).fill("2026-10-22T14:06");
  await source(page).evaluate((select) => {
    select.appendChild(new Option("Invalid zone", "Invalid/Zone"));
  });
  await source(page).selectOption("Invalid/Zone");
  await expect(page.getByRole("alert")).toContainText("invalid or unsupported");
  await expect(output(page)).toHaveCount(0);
});

test("live updates pause while hidden, resync immediately on visibility, and clean up on navigation", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-22T21:06:00Z") });
  await page.addInitScript(() => {
    const originalSet = window.setInterval.bind(window);
    const originalClear = window.clearInterval.bind(window);
    const active = new Set<number>();
    Object.defineProperty(window, "activeClockTimers", { value: active });
    window.setInterval = ((callback: TimerHandler, delay?: number, ...args: unknown[]) => {
      const id = originalSet(callback, delay, ...args);
      if (delay === 1000) {
        active.add(id);
      }
      return id;
    }) as typeof window.setInterval;
    window.clearInterval = ((id?: number) => {
      if (id !== undefined) {
        active.delete(id);
      }
      originalClear(id);
    }) as typeof window.clearInterval;
  });
  await openTimezone(page);
  await page.clock.pauseAt(new Date("2026-10-22T21:07:00Z"));
  const clock = page
    .getByRole("article", { name: "Los Angeles clock", exact: true })
    .locator("time");
  const timers = () =>
    page.evaluate(
      () => (window as unknown as { activeClockTimers: Set<number> }).activeClockTimers.size,
    );
  await expect.poll(timers).toBe(1);
  await page.clock.runFor(2000);
  await expect(clock).toHaveText("14:07:02");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(timers).toBe(0);
  await page.clock.runFor(5000);
  await expect(clock).toHaveText("14:07:02");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(clock).toHaveText("14:07:07");
  await expect.poll(timers).toBe(1);
  // SvelteKit navigation uses timers too; resume the mocked clock before routing.
  await page.clock.resume();
  await page.getByRole("link", { name: "Unix Timestamp Tool" }).click();
  await expect(page).toHaveURL(/\/timestamp$/);
  await expect.poll(timers).toBe(0);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(timers).toBe(0);
  await page.getByRole("link", { name: /Time Zone Converter & World Clock/ }).click();
  await expect(source(page)).toBeVisible();
  await expect.poll(timers).toBe(1);
});
