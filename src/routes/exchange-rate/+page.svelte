<script lang="ts">
import {
  AlertCircle,
  ArrowRightLeft,
  BadgeDollarSign,
  CalendarDays,
  Database,
  ExternalLink,
  LoaderCircle,
  RefreshCcw,
  ShieldCheck,
} from "lucide-svelte";
import { untrack } from "svelte";
import {
  type CurrencyCode,
  convertCurrency,
  currencies,
  EXCHANGE_RATE_CACHE_KEY,
  type ExchangeRateSnapshot,
  fetchExchangeRates,
  isCurrencyAvailable,
  parseCachedSnapshot,
} from "$lib/utils/exchange-rate";

type RateStatus = "loading" | "ready" | "cached" | "error";

let amount = $state("1");
let sourceCurrency = $state<CurrencyCode>("USD");
let targetCurrency = $state<CurrencyCode>("EUR");
let snapshot = $state<ExchangeRateSnapshot | null>(null);
let status = $state<RateStatus>("loading");
let error = $state("");
let requestController: AbortController | null = null;

const numericAmount = $derived(Number(amount));
const conversionError = $derived.by(() => {
  if (!snapshot) {
    return "";
  }
  if (!isCurrencyAvailable(sourceCurrency, snapshot.rates)) {
    return `${sourceCurrency} is unavailable in the current rate snapshot.`;
  }
  if (!isCurrencyAvailable(targetCurrency, snapshot.rates)) {
    return `${targetCurrency} is unavailable in the current rate snapshot.`;
  }
  return "";
});
const result = $derived.by(() => {
  if (!snapshot || conversionError || amount.trim() === "" || !Number.isFinite(numericAmount)) {
    return null;
  }
  return safeConvert(numericAmount, sourceCurrency, targetCurrency, snapshot.rates);
});
const amountError = $derived(
  amount.trim() !== "" && !Number.isFinite(numericAmount) ? "Enter a valid amount." : "",
);
const directRate = $derived(
  snapshot ? safeConvert(1, sourceCurrency, targetCurrency, snapshot.rates) : null,
);

$effect(() => {
  let cached: ExchangeRateSnapshot | null = null;
  try {
    cached = parseCachedSnapshot(window.localStorage.getItem(EXCHANGE_RATE_CACHE_KEY));
  } catch {
    // Storage restrictions must not prevent the public rate request from running.
  }
  if (cached) {
    snapshot = cached;
    status = "cached";
  }
  untrack(() => {
    void refreshRates();
  });

  return () => requestController?.abort();
});

async function refreshRates(): Promise<void> {
  requestController?.abort();
  requestController = new AbortController();
  const hasSnapshot = snapshot !== null;
  if (!hasSnapshot) {
    status = "loading";
  }
  error = "";

  try {
    const latest = await fetchExchangeRates(requestController.signal);
    snapshot = latest;
    status = "ready";
    try {
      window.localStorage.setItem(EXCHANGE_RATE_CACHE_KEY, JSON.stringify(latest));
    } catch {
      // The current rates remain usable when browser storage is unavailable.
    }
  } catch (caughtError) {
    if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
      return;
    }
    error = caughtError instanceof Error ? caughtError.message : "Unable to load exchange rates.";
    status = hasSnapshot ? "cached" : "error";
  }
}

function swapCurrencies(): void {
  const previousSource = sourceCurrency;
  sourceCurrency = targetCurrency;
  targetCurrency = previousSource;
}

function safeConvert(
  value: number,
  source: CurrencyCode,
  target: CurrencyCode,
  rates: Record<string, number>,
): number | null {
  try {
    return convertCurrency(value, source, target, rates);
  } catch {
    return null;
  }
}

function formatMoney(value: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 6,
  }).format(value);
}

function formatRate(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumSignificantDigits: 8 }).format(value);
}

function formatFetchedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
</script>

<svelte:head>
  <title>Reference Exchange Rate Converter | PureTools</title>
  <meta
    name="description"
    content="Convert currencies locally using public reference exchange rates with cached offline fallback."
  />
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
  <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <div class="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
        <BadgeDollarSign size={18} />
        Finance
      </div>
      <h1 class="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
        Reference Exchange Rate Converter
      </h1>
      <p class="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
        Public reference rates are downloaded once; your amount and conversion stay in this browser.
      </p>
    </div>
    <button
      type="button"
      onclick={refreshRates}
      disabled={status === "loading"}
      class="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
    >
      {#if status === "loading"}
        <LoaderCircle size={16} class="animate-spin" />
        Loading
      {:else}
        <RefreshCcw size={16} />
        Refresh rates
      {/if}
    </button>
  </div>

  {#if error}
    <div class="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <AlertCircle size={18} class="mt-0.5 shrink-0" />
      <div>
        <p class="font-semibold">Could not refresh rates</p>
        <p class="mt-1">{error}{status === "cached" ? " Using the last saved snapshot." : ""}</p>
      </div>
    </div>
  {/if}

  <section class="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
    <div class="grid gap-5 p-5 sm:p-7 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
      <label class="block min-w-0">
        <span class="mb-2 block text-sm font-semibold text-neutral-700 dark:text-neutral-300">Amount</span>
        <div class="flex overflow-hidden rounded-xl border border-neutral-300 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-neutral-700 dark:bg-neutral-950">
          <input
            value={amount}
            oninput={(event) => {
              amount = event.currentTarget.value;
            }}
            type="number"
            inputmode="decimal"
            step="any"
            placeholder="1.00"
            class="min-w-0 flex-1 bg-transparent px-4 py-3 text-lg font-semibold text-neutral-900 outline-none dark:text-neutral-100"
          />
          <select
            bind:value={sourceCurrency}
            aria-label="Source currency"
            class="min-w-0 max-w-[60%] border-l border-neutral-200 bg-neutral-50 px-3 text-sm font-bold text-neutral-700 outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
          >
            {#each currencies as currency}
              <option
                value={currency.code}
                disabled={snapshot !== null && !isCurrencyAvailable(currency.code, snapshot.rates)}
              >
                {currency.code} · {currency.name}{snapshot !== null &&
                !isCurrencyAvailable(currency.code, snapshot.rates)
                  ? " (unavailable)"
                  : ""}
              </option>
            {/each}
          </select>
        </div>
        {#if amountError}
          <span class="mt-2 block text-sm text-red-600 dark:text-red-400">{amountError}</span>
        {/if}
      </label>

      <button
        type="button"
        onclick={swapCurrencies}
        aria-label="Swap currencies"
        title="Swap currencies"
        class="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300 lg:mb-0"
      >
        <ArrowRightLeft size={19} />
      </button>

      <div class="min-w-0">
        <span class="mb-2 block text-sm font-semibold text-neutral-700 dark:text-neutral-300">Converted amount</span>
        <div class="flex min-h-13 items-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
          <div class="min-w-0 flex-1 truncate px-4 py-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {result === null ? "—" : formatMoney(result, targetCurrency)}
          </div>
          <select
            bind:value={targetCurrency}
            aria-label="Target currency"
            class="min-w-0 max-w-[60%] self-stretch border-l border-neutral-200 bg-white px-3 text-sm font-bold text-neutral-700 outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
          >
            {#each currencies as currency}
              <option
                value={currency.code}
                disabled={snapshot !== null && !isCurrencyAvailable(currency.code, snapshot.rates)}
              >
                {currency.code} · {currency.name}{snapshot !== null &&
                !isCurrencyAvailable(currency.code, snapshot.rates)
                  ? " (unavailable)"
                  : ""}
              </option>
            {/each}
          </select>
        </div>
        {#if conversionError}
          <p class="mt-2 text-sm text-red-600 dark:text-red-400">{conversionError}</p>
        {/if}
      </div>
    </div>

    {#if snapshot && directRate !== null}
      <div class="border-t border-neutral-200 bg-neutral-50 px-5 py-4 dark:border-neutral-800 dark:bg-neutral-950/50 sm:px-7">
        <p class="font-mono text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          1 {sourceCurrency} = {formatRate(directRate)} {targetCurrency}
        </p>
      </div>
    {:else if status === "loading"}
      <div class="border-t border-neutral-200 bg-neutral-50 px-5 py-4 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/50 dark:text-neutral-400 sm:px-7">
        Loading the latest available reference-rate snapshot…
      </div>
    {/if}
  </section>

  <div class="mt-6 grid gap-4 md:grid-cols-3">
    <div class="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div class="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        <CalendarDays size={17} class="text-indigo-500" />
        Rate date
      </div>
      <p class="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        {snapshot?.date ?? "Waiting for data"}
      </p>
    </div>
    <div class="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div class="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        <Database size={17} class="text-indigo-500" />
        Local cache
      </div>
      <p class="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        {snapshot ? `Saved ${formatFetchedAt(snapshot.fetchedAt)}` : "No saved snapshot"}
      </p>
    </div>
    <div class="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div class="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        <ShieldCheck size={17} class="text-indigo-500" />
        Local calculation
      </div>
      <p class="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        The provider receives no amount or selected currency pair.
      </p>
    </div>
  </div>

  <aside class="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
    <p>
      Rates are reference data supplied by
      <a
        href="https://frankfurter.dev/"
        target="_blank"
        rel="noreferrer"
        class="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
      >Frankfurter <ExternalLink size={13} /></a>, which tracks published central-bank rates. They are not live trading, bank, or card settlement rates.
      For informational use only.
    </p>
  </aside>
</div>
