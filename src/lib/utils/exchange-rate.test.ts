import { describe, expect, test } from "bun:test";
import {
  convertCurrency,
  EXCHANGE_RATE_API_URL,
  fetchExchangeRates,
  isCurrencyAvailable,
  parseCachedSnapshot,
  parseExchangeRateResponse,
} from "./exchange-rate";

describe("convertCurrency", () => {
  const rates = { GBP: 0.8, USD: 1.2 };

  test("converts through the EUR base rate", () => {
    expect(convertCurrency(10, "USD", "GBP", rates)).toBe((10 / 1.2) * 0.8);
    expect(convertCurrency(10, "EUR", "USD", rates)).toBe(12);
  });

  test("rejects unavailable currencies", () => {
    expect(() => convertCurrency(10, "USD", "JPY", rates)).toThrow("unavailable");
  });
});

describe("parseExchangeRateResponse", () => {
  test("validates and normalizes a provider response", () => {
    const snapshot = parseExchangeRateResponse(
      { base: "EUR", date: "2026-07-17", rates: { USD: 1.16, GBP: 0.87, UNKNOWN: 2 } },
      new Date("2026-07-20T08:00:00.000Z"),
    );

    expect(snapshot.date).toBe("2026-07-17");
    expect(snapshot.fetchedAt).toBe("2026-07-20T08:00:00.000Z");
    expect(snapshot.rates.UNKNOWN).toBe(undefined);
  });

  test("rejects a response without a required currency", () => {
    expect(() =>
      parseExchangeRateResponse({ base: "EUR", date: "2026-07-17", rates: { GBP: 0.87 } }),
    ).toThrow("missing required currencies");
  });
});

describe("parseCachedSnapshot", () => {
  test("returns null for malformed or incomplete cache data", () => {
    expect(parseCachedSnapshot("not-json")).toBe(null);
    expect(parseCachedSnapshot('{"date":"2026-07-17","rates":{}}')).toBe(null);
  });

  test("filters invalid and unsupported cached rates", () => {
    const snapshot = parseCachedSnapshot(
      JSON.stringify({
        date: "2026-07-17",
        fetchedAt: "2026-07-17T08:00:00.000Z",
        rates: { GBP: -1, JPY: "invalid", UNKNOWN: 2, USD: 1.17 },
      }),
    );

    expect(snapshot?.rates.USD).toBe(1.17);
    expect(snapshot?.rates.GBP).toBe(undefined);
    expect(snapshot?.rates.JPY).toBe(undefined);
    expect(snapshot?.rates.UNKNOWN).toBe(undefined);
  });

  test("rejects calendar dates that do not exist", () => {
    expect(
      parseCachedSnapshot(
        JSON.stringify({
          date: "2026-02-30",
          fetchedAt: "2026-07-17T08:00:00.000Z",
          rates: { USD: 1.17 },
        }),
      ),
    ).toBe(null);
  });
});

describe("isCurrencyAvailable", () => {
  test("always supports the EUR base and requires a valid snapshot rate otherwise", () => {
    expect(isCurrencyAvailable("EUR", {})).toBe(true);
    expect(isCurrencyAvailable("USD", { USD: 1.17 })).toBe(true);
    expect(isCurrencyAvailable("JPY", { JPY: -1 })).toBe(false);
    expect(isCurrencyAvailable("GBP", {})).toBe(false);
  });
});

describe("fetchExchangeRates", () => {
  test("requests only the public EUR rate table and validates the response", async () => {
    let requestedUrl = "";
    const fetcher: typeof fetch = async (input) => {
      requestedUrl = String(input);
      return Response.json({ base: "EUR", date: "2026-07-20", rates: { USD: 1.17 } });
    };

    const snapshot = await fetchExchangeRates(undefined, fetcher);

    expect(requestedUrl).toBe(EXCHANGE_RATE_API_URL);
    expect(snapshot.date).toBe("2026-07-20");
    expect(snapshot.rates.USD).toBe(1.17);
  });

  test("reports provider HTTP failures", async () => {
    const fetcher: typeof fetch = async () => new Response(null, { status: 503 });

    let message = "";
    try {
      await fetchExchangeRates(undefined, fetcher);
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }

    expect(message).toContain("HTTP 503");
  });

  test("rejects malformed successful responses", async () => {
    const fetcher: typeof fetch = async () => Response.json({ status: "ok" });

    let message = "";
    try {
      await fetchExchangeRates(undefined, fetcher);
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }

    expect(message).toContain("invalid response");
  });
});
