import { expect, test } from "@playwright/test";

const providerResponse = {
  base: "EUR",
  date: "2026-07-20",
  rates: {
    GBP: 0.8,
    JPY: 180,
    USD: 1.2,
  },
};

test("converts locally, swaps currencies, and falls back to cached rates", async ({ page }) => {
  await page.addInitScript((response) => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      if (String(input).startsWith("https://api.frankfurter.dev/v1/latest")) {
        if (window.localStorage.getItem("rate-provider-mode") === "failure") {
          return new Response("Unavailable", { status: 503 });
        }
        const requests = Number(window.sessionStorage.getItem("rate-provider-requests") ?? "0");
        window.sessionStorage.setItem("rate-provider-requests", String(requests + 1));
        return Response.json(response);
      }
      return originalFetch(input, init);
    };
  }, providerResponse);

  await page.goto("/exchange-rate");

  await expect(page.getByText("Rate date").locator("..").getByText("2026-07-20")).toBeVisible();
  await expect(page.getByText("1 USD = 0.83333333 EUR")).toBeVisible();
  await expect(
    page.getByLabel("Source currency").getByRole("option", {
      name: "CNY · Chinese Yuan (unavailable)",
    }),
  ).toHaveAttribute("disabled", "");
  await page.evaluate(() => {
    const select = document.querySelector<HTMLSelectElement>('[aria-label="Source currency"]');
    if (select) {
      select.value = "CNY";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await expect(page.getByText("CNY is unavailable in the current rate snapshot.")).toBeVisible();
  await page.getByLabel("Source currency").selectOption("USD");
  await page.getByLabel("Amount").fill("12");
  await expect(page.getByText("€10.00", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Swap currencies" }).click();
  await expect(page.getByText("1 EUR = 1.2 USD")).toBeVisible();
  await expect(page.getByText("$14.40", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/exchange-rate.png", fullPage: true });
  expect(await page.evaluate(() => window.sessionStorage.getItem("rate-provider-requests"))).toBe(
    "1",
  );

  await page.evaluate(() => {
    window.localStorage.setItem("rate-provider-mode", "failure");
    window.localStorage.setItem(
      "puretools:exchange-rates:v1",
      JSON.stringify({
        date: "2026-07-19",
        fetchedAt: "2026-07-19T08:00:00.000Z",
        rates: { EUR: 1, USD: 1.25 },
      }),
    );
  });
  await page.reload();

  await expect(page.getByText("Could not refresh rates")).toBeVisible();
  await expect(page.getByText(/HTTP 503.*Using the last saved snapshot/)).toBeVisible();
  await expect(page.getByText("1 USD = 0.8 EUR")).toBeVisible();
  await expect(page.getByText("€0.80", { exact: true })).toBeVisible();

  await page.evaluate(() => {
    window.localStorage.removeItem("rate-provider-mode");
  });
  await page.addInitScript(() => {
    const originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string): string | null {
      if (key === "puretools:exchange-rates:v1") {
        throw new DOMException("Storage access is blocked.", "SecurityError");
      }
      return originalGetItem.call(this, key);
    };
  });
  await page.reload();

  await expect(page.getByText("Rate date").locator("..").getByText("2026-07-20")).toBeVisible();
  await expect(page.getByText("1 USD = 0.83333333 EUR")).toBeVisible();
});
