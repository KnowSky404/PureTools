export const EXCHANGE_RATE_API_URL = "https://api.frankfurter.dev/v1/latest?base=EUR";
export const EXCHANGE_RATE_CACHE_KEY = "puretools:exchange-rates:v1";
export const EXCHANGE_RATE_REQUEST_TIMEOUT_MS = 10_000;

export const currencies = [
  { code: "AUD", name: "Australian Dollar" },
  { code: "BGN", name: "Bulgarian Lev" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "CZK", name: "Czech Koruna" },
  { code: "DKK", name: "Danish Krone" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "HUF", name: "Hungarian Forint" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "ILS", name: "Israeli Shekel" },
  { code: "INR", name: "Indian Rupee" },
  { code: "ISK", name: "Icelandic Króna" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "KRW", name: "South Korean Won" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "PLN", name: "Polish Złoty" },
  { code: "RON", name: "Romanian Leu" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "THB", name: "Thai Baht" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "USD", name: "US Dollar" },
  { code: "ZAR", name: "South African Rand" },
] as const;

export type CurrencyCode = (typeof currencies)[number]["code"];

export type ExchangeRateSnapshot = {
  date: string;
  fetchedAt: string;
  rates: Record<string, number>;
};

type FrankfurterResponse = {
  base: string;
  date: string;
  rates: Record<string, number>;
};

const currencyCodes = new Set<string>(currencies.map((currency) => currency.code));

export function convertCurrency(
  amount: number,
  source: CurrencyCode,
  target: CurrencyCode,
  rates: Record<string, number>,
): number {
  if (!Number.isFinite(amount)) {
    throw new Error("Enter a valid amount.");
  }

  const sourceRate = source === "EUR" ? 1 : rates[source];
  const targetRate = target === "EUR" ? 1 : rates[target];
  if (!isValidRate(sourceRate) || !isValidRate(targetRate)) {
    throw new Error("The selected currency is unavailable in this rate snapshot.");
  }

  return (amount / sourceRate) * targetRate;
}

export function isCurrencyAvailable(
  currency: CurrencyCode,
  rates: Record<string, number>,
): boolean {
  return currency === "EUR" || isValidRate(rates[currency]);
}

export function parseExchangeRateResponse(
  value: unknown,
  fetchedAt = new Date(),
): ExchangeRateSnapshot {
  if (!isRecord(value)) {
    throw new Error("The rate provider returned an invalid response.");
  }

  const response = value as FrankfurterResponse;
  if (response.base !== "EUR" || !isIsoDate(response.date) || !isRecord(response.rates)) {
    throw new Error("The rate provider returned an invalid response.");
  }

  const rates = normalizeRates(response.rates);

  if (!rates || !isValidRate(rates.USD)) {
    throw new Error("The rate provider response is missing required currencies.");
  }

  return {
    date: response.date,
    fetchedAt: fetchedAt.toISOString(),
    rates,
  };
}

export function parseCachedSnapshot(value: string | null): ExchangeRateSnapshot | null {
  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || !isIsoDate(parsed.date) || !isIsoDateTime(parsed.fetchedAt)) {
      return null;
    }
    const rates = normalizeRates(parsed.rates);
    if (!rates || !isValidRate(rates.USD)) {
      return null;
    }
    return {
      date: parsed.date,
      fetchedAt: parsed.fetchedAt,
      rates,
    };
  } catch {
    return null;
  }
}

export async function fetchExchangeRates(
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  timeoutMs = EXCHANGE_RATE_REQUEST_TIMEOUT_MS,
): Promise<ExchangeRateSnapshot> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("The rate request timeout must be a positive number.");
  }

  const requestController = new AbortController();
  const forwardCallerAbort = (): void => requestController.abort(signal?.reason);
  if (signal?.aborted) {
    forwardCallerAbort();
  } else {
    signal?.addEventListener("abort", forwardCallerAbort, { once: true });
  }
  const timeoutId = setTimeout(() => {
    requestController.abort(new DOMException("The rate request timed out.", "TimeoutError"));
  }, timeoutMs);

  try {
    const response = await fetcher(EXCHANGE_RATE_API_URL, {
      headers: { Accept: "application/json" },
      signal: requestController.signal,
    });
    if (!response.ok) {
      throw new Error(`The rate provider returned HTTP ${response.status}.`);
    }

    const body: unknown = await response.json();
    return parseExchangeRateResponse(body);
  } catch (caughtError) {
    if (
      requestController.signal.reason instanceof DOMException &&
      requestController.signal.reason.name === "TimeoutError"
    ) {
      throw new Error("The rate request timed out. Try again.");
    }
    throw caughtError;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", forwardCallerAbort);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function normalizeRates(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) {
    return null;
  }

  const rates: Record<string, number> = {};
  for (const [code, rate] of Object.entries(value)) {
    if (currencyCodes.has(code) && isValidRate(rate)) {
      rates[code] = rate;
    }
  }
  return rates;
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
