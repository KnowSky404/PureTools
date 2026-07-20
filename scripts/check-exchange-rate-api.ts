import { EXCHANGE_RATE_API_URL, parseExchangeRateResponse } from "../src/lib/utils/exchange-rate";

const smokeTestOrigin = "https://puretools.local";
const response = await fetch(EXCHANGE_RATE_API_URL, {
  headers: {
    Accept: "application/json",
    Origin: smokeTestOrigin,
  },
  signal: AbortSignal.timeout(10_000),
});

if (!response.ok) {
  throw new Error(`Exchange-rate smoke test failed with HTTP ${response.status}.`);
}

const allowedOrigin = response.headers.get("access-control-allow-origin");
if (allowedOrigin !== "*" && allowedOrigin !== smokeTestOrigin) {
  throw new Error("Exchange-rate API does not expose a compatible CORS policy.");
}

const body: unknown = await response.json();
const snapshot = parseExchangeRateResponse(body);
console.log(
  `Exchange-rate API is healthy: ${snapshot.date}, ${Object.keys(snapshot.rates).length} currencies.`,
);
