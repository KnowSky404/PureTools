<script lang="ts">
import { ArrowRightLeft, Check, Clock, Copy, Globe, Plus, X } from "lucide-svelte";
import { onMount } from "svelte";
import TimeZonePicker from "$lib/components/TimeZonePicker.svelte";
import { copyToClipboard } from "$lib/utils/clipboard";
import {
  CLOCK_STORAGE_KEY,
  cityName,
  DEFAULT_CITIES,
  dayDifference,
  dayLabel,
  formatOffset,
  formatZonedDateTime,
  ianaZone,
  type LocalTimeResolution,
  readClockPreferences,
  resolveLocalDateTime,
  supportedTimeZones,
  type TimeZone,
  type ZonedDateTime,
  zoneFromValue,
  zoneLabel,
} from "$lib/utils/timezone";

type ParsedSource =
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "parsed"; resolution: LocalTimeResolution; source: TimeZone; target: TimeZone };
type Conversion = {
  instant: number;
  source: ZonedDateTime;
  target: ZonedDateTime;
  relativeDay: string;
};
type ClockCard = { zone: string; name: string; view: ZonedDateTime; relativeDay: string };

let ready = $state(false);
let capabilityError = $state("");
let actionError = $state("");
let localNotice = $state("");
let storageNotice = $state("");
let zones = $state<string[]>(["UTC"]);
let sourceValue = $state("UTC");
let targetValue = $state("Asia/Shanghai");
let datetimeInput = $state("");
let choice = $state<{ key: string; instant: number } | null>(null);
let clockNow = $state(0);
let localZone = $state("UTC");
let clockZones = $state<string[]>(DEFAULT_CITIES.map((city) => city.zone));
let hour12 = $state(false);
let addZone = $state("Asia/Kathmandu");
let cityNotice = $state("");
let copyFeedback = $state<{ value: string; message: string; failed: boolean } | null>(null);
let disposed = false;

const inputKey = $derived(`${sourceValue}|${datetimeInput}`);
const parsed = $derived.by<ParsedSource>(() => {
  if (!ready || !datetimeInput) {
    return { status: "empty" };
  }
  try {
    const source = zoneFromValue(sourceValue);
    const target = zoneFromValue(targetValue);
    return {
      status: "parsed",
      source,
      target,
      resolution: resolveLocalDateTime(datetimeInput, source),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to convert this date and time.",
    };
  }
});

const selected = $derived(
  parsed.status === "parsed"
    ? parsed.resolution.candidates.find(
        (candidate) =>
          parsed.resolution.status === "unique" ||
          (choice?.key === inputKey && candidate.instant === choice.instant),
      )
    : undefined,
);

const result = $derived.by<{ conversion: Conversion | null; error: string }>(() => {
  if (parsed.status !== "parsed" || !selected) {
    return { conversion: null, error: "" };
  }
  try {
    const source = formatZonedDateTime(selected.instant, parsed.source);
    const target = formatZonedDateTime(selected.instant, parsed.target);
    return {
      conversion: {
        instant: selected.instant,
        source,
        target,
        relativeDay: dayLabel(dayDifference(target.date, source.date)),
      },
      error: "",
    };
  } catch (error) {
    return {
      conversion: null,
      error: error instanceof Error ? error.message : "Unable to format the result.",
    };
  }
});

const copyText = $derived(
  result.conversion
    ? `${result.conversion.target.date} ${result.conversion.target.time} ${result.conversion.target.offset} (${result.conversion.target.abbreviation}; ${targetValue.startsWith("fixed:") ? "fixed offset" : targetValue})\n${result.conversion.relativeDay} relative to source\nInstant: ${new Date(result.conversion.instant).toISOString()}`
    : "",
);

const clockResult = $derived.by<{ cards: ClockCard[]; error: string }>(() => {
  if (!ready) {
    return { cards: [], error: "" };
  }
  try {
    const localDate = formatZonedDateTime(clockNow, ianaZone(localZone)).date;
    return {
      cards: clockZones.map((zone) => {
        const view = formatZonedDateTime(clockNow, ianaZone(zone), hour12);
        return {
          zone,
          name: cityName(zone),
          view,
          relativeDay: dayLabel(dayDifference(view.date, localDate)),
        };
      }),
      error: "",
    };
  } catch (error) {
    return {
      cards: [],
      error: error instanceof Error ? error.message : "Unable to display world clocks.",
    };
  }
});

onMount(() => {
  let interval: ReturnType<typeof setInterval> | undefined;
  const synchronize = (): void => {
    clearInterval(interval);
    interval = undefined;
    if (!document.hidden) {
      clockNow = Date.now();
      interval = setInterval(() => {
        clockNow = Date.now();
      }, 1000);
    }
  };
  try {
    ianaZone("UTC");
    try {
      localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      ianaZone(localZone);
    } catch {
      localZone = "UTC";
      localNotice =
        "Your local time zone could not be detected. Using UTC; choose a source time zone below.";
    }
    zones = [...new Set([...supportedTimeZones(), localZone])].sort();
    sourceValue = localZone;
    try {
      const preferences = readClockPreferences(localStorage.getItem(CLOCK_STORAGE_KEY));
      clockZones = preferences.zones;
      hour12 = preferences.hour12;
    } catch {
      storageNotice =
        "Local storage is unavailable. Clock preferences will last for this visit only.";
    }
    clockNow = Date.now();
    useNow();
    ready = true;
    synchronize();
    document.addEventListener("visibilitychange", synchronize);
  } catch (error) {
    capabilityError =
      error instanceof Error
        ? error.message
        : "Time zone support is unavailable. Try a current browser.";
  }
  return () => {
    disposed = true;
    clearInterval(interval);
    document.removeEventListener("visibilitychange", synchronize);
  };
});

function useNow(): void {
  try {
    const instant = Math.floor(Date.now() / 1000) * 1000;
    datetimeInput = formatZonedDateTime(instant, zoneFromValue(sourceValue)).input;
    choice = { key: `${sourceValue}|${datetimeInput}`, instant };
    actionError = "";
  } catch (error) {
    actionError = error instanceof Error ? error.message : "Unable to use the device time.";
  }
}

function swapZones(): void {
  if (!result.conversion) {
    return;
  }
  const { instant, target } = result.conversion;
  [sourceValue, targetValue] = [targetValue, sourceValue];
  datetimeInput = target.input;
  choice = { key: `${sourceValue}|${datetimeInput}`, instant };
}

async function copyResult(): Promise<void> {
  const value = copyText;
  if (!value) {
    return;
  }
  const success = await copyToClipboard(value);
  if (!disposed && copyText === value) {
    copyFeedback = {
      value,
      message: success
        ? "Copied!"
        : "Could not copy. Allow clipboard access over HTTPS, or select and copy the result manually.",
      failed: !success,
    };
  }
}

function savePreferences(): void {
  try {
    localStorage.setItem(CLOCK_STORAGE_KEY, JSON.stringify({ zones: clockZones, hour12 }));
  } catch {
    storageNotice =
      "Local storage is unavailable. Clock preferences will last for this visit only.";
  }
}

function addCity(): void {
  if (clockZones.includes(addZone)) {
    cityNotice = "That city is already in your world clock.";
    return;
  }
  if (clockZones.length >= 24) {
    cityNotice = "You can display up to 24 cities. Remove a city to add another.";
    return;
  }
  try {
    ianaZone(addZone);
    clockZones = [...clockZones, addZone];
    cityNotice = `Added ${cityName(addZone)}.`;
    savePreferences();
  } catch (error) {
    cityNotice = error instanceof Error ? error.message : "Choose a supported IANA time zone.";
  }
}

function removeCity(zone: string): void {
  clockZones = clockZones.filter((item) => item !== zone);
  cityNotice = `Removed ${cityName(zone)}.`;
  savePreferences();
}
</script>

<svelte:head>
  <title>Time Zone Converter &amp; World Clock | PureTools</title>
  <meta name="description" content="Convert IANA time zones or fixed PST/PDT offsets, resolve DST boundaries, and follow world clocks privately in your browser." />
</svelte:head>

<div class="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">Time Zone Converter &amp; World Clock</h1>
      <p class="mt-2 text-sm text-neutral-500">Region rules follow the date. Fixed PST/PDT offsets stay fixed.</p>
    </div>
    <a href="/timestamp" class="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400"><Clock size={16} /> Unix Timestamp Tool →</a>
  </div>

  {#if capabilityError}
    <p role="alert" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{capabilityError}</p>
  {:else if !ready}
    <p role="status" class="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Initializing your local time zone…</p>
  {:else}
    {#if localNotice}<p role="status" class="text-sm text-amber-700 dark:text-amber-300">{localNotice}</p>{/if}
    <section aria-label="Time zone converter" class="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
      <div class="grid min-w-0 gap-5 md:grid-cols-[1fr_auto_1fr]">
        <div class="min-w-0 space-y-4">
          <TimeZonePicker id="source-zone" label="Source time zone" bind:value={sourceValue} {zones} />
          <div>
            <label for="source-datetime" class="mb-2 block text-sm font-semibold text-neutral-700">Source date and time</label>
            <input id="source-datetime" type="datetime-local" step="0.001" min="0001-01-01T00:00" max="9999-12-31T23:59:59.999" bind:value={datetimeInput} class="block w-full min-w-0 max-w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 font-mono text-sm text-neutral-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <button onclick={useNow} class="inline-flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-200"><Clock size={15} /> Now</button>
            {#if result.conversion}<span data-testid="source-offset" class="text-xs text-neutral-500">{result.conversion.source.offset} · {result.conversion.source.abbreviation}</span>{/if}
          </div>
        </div>
        <div class="flex items-center justify-center">
          <button onclick={swapZones} disabled={!result.conversion} aria-label="Swap source and target time zones" title="Swap zones, keeping the same instant" class="rounded-full border border-neutral-200 p-3 text-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-indigo-400 dark:hover:bg-indigo-500/10"><ArrowRightLeft size={20} /></button>
        </div>
        <div class="min-w-0 space-y-4">
          <TimeZonePicker id="target-zone" label="Target time zone" bind:value={targetValue} {zones} />
          <div class="min-h-32 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10" aria-live="polite" aria-atomic="true">
            {#if result.conversion}
              <div class="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">Converted date and time</div>
              <output aria-label="Converted date and time" class="mt-2 block break-words font-mono text-xl font-bold text-neutral-900 sm:text-2xl">{result.conversion.target.date} {result.conversion.target.time}</output>
              <p data-testid="target-offset" class="mt-2 text-sm text-neutral-600">{result.conversion.target.offset} · {result.conversion.target.abbreviation}</p>
              <p class="mt-2 text-sm font-semibold text-indigo-600 dark:text-indigo-300">{result.conversion.relativeDay}</p>
            {:else}
              <p class="text-sm text-neutral-500">{parsed.status === "parsed" && parsed.resolution.status === "ambiguous" ? "Choose an earlier or later instance below." : "Enter a valid source date and time to convert."}</p>
            {/if}
          </div>
          <button onclick={copyResult} disabled={!copyText} class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">{#if copyFeedback?.value === copyText && !copyFeedback.failed}<Check size={15} />{:else}<Copy size={15} />{/if} Copy Result</button>
        </div>
      </div>

      {#if parsed.status === "error" || result.error || actionError}
        <p role="alert" class="mt-4 text-sm text-red-600 dark:text-red-400">{parsed.status === "error" ? parsed.message : result.error || actionError}</p>
      {:else if !datetimeInput}
        <p role="alert" class="mt-4 text-sm text-red-600 dark:text-red-400">Enter a valid source date and time, including the date.</p>
      {:else if parsed.status === "parsed" && parsed.resolution.status === "nonexistent"}
        <p role="alert" class="mt-4 text-sm text-red-600 dark:text-red-400">This local time does not exist in {sourceValue} because the clock moves forward. Choose a time before or after the gap.</p>
      {/if}

      {#if parsed.status === "parsed" && parsed.resolution.status === "ambiguous"}
        <fieldset class="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <legend class="px-1 text-sm font-semibold text-amber-800 dark:text-amber-200">This local time occurs twice. Choose an instance.</legend>
          <div class="flex flex-wrap gap-4">
            {#each parsed.resolution.candidates as candidate, index}
              <label class="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                <input type="radio" name="dst-instance" checked={selected?.instant === candidate.instant} onchange={() => { choice = { key: inputKey, instant: candidate.instant }; }} class="accent-indigo-600" />
                <span>{index === 0 ? "Earlier" : "Later"} · {formatOffset(candidate.offsetMinutes)} <span class="block text-xs text-neutral-500">{new Date(candidate.instant).toISOString()}</span></span>
              </label>
            {/each}
          </div>
        </fieldset>
      {/if}

      {#if copyFeedback?.value === copyText && copyText}
        <p role={copyFeedback.failed ? "alert" : "status"} class="mt-4 text-sm {copyFeedback.failed ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}">{copyFeedback.message}</p>
      {/if}
      <p class="mt-5 text-xs leading-relaxed text-neutral-500">IANA regions use automatic date-specific DST rules. {zoneLabel("fixed:PST")} and {zoneLabel("fixed:PDT")} never change with the season.</p>
    </section>

    <section aria-labelledby="world-clock-title" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 id="world-clock-title" class="flex items-center gap-2 text-xl font-bold text-neutral-900"><Globe size={21} class="text-indigo-600 dark:text-indigo-400" /> World Clock</h2>
        <label class="flex items-center gap-2 text-sm text-neutral-600"><input type="checkbox" checked={hour12} onchange={(event) => { hour12 = event.currentTarget.checked; savePreferences(); }} class="accent-indigo-600" /> 12-hour clock</label>
      </div>
      <p class="text-xs text-neutral-500">Day changes are relative to your local date in {localZone}.</p>
      {#if clockResult.error}<p role="alert" class="text-sm text-red-600 dark:text-red-400">{clockResult.error}</p>{/if}
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each clockResult.cards as card (card.zone)}
          <article aria-label={`${card.name} clock`} class="min-w-0 rounded-xl border border-neutral-200 bg-white p-4">
            <div class="flex items-center justify-between gap-2">
              <h3 class="font-semibold text-neutral-900">{card.name}</h3>
              <button onclick={() => removeCity(card.zone)} aria-label={`Remove ${card.name}`} class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"><X size={16} /></button>
            </div>
            <time datetime={new Date(clockNow).toISOString()} class="mt-2 block font-mono text-2xl font-semibold tabular-nums text-neutral-900">{card.view.time}</time>
            <p class="mt-1 text-sm text-neutral-600">{card.view.date}</p>
            <p class="mt-2 text-xs text-neutral-500">{card.view.offset} · {card.view.abbreviation}</p>
            <p class="mt-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">{card.relativeDay}</p>
            <p class="mt-2 break-all text-xs text-neutral-500">{card.zone}</p>
          </article>
        {/each}
      </div>
      {#if clockZones.length === 0}<p class="rounded-xl border border-dashed border-neutral-300 p-5 text-sm text-neutral-500">No cities yet. Add a city below.</p>{/if}
      <div class="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-end">
        <div class="min-w-0 flex-1"><TimeZonePicker id="add-clock-zone" label="Add a city" bind:value={addZone} {zones} includeFixed={false} /></div>
        <button onclick={addCity} class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-200"><Plus size={16} /> Add City</button>
      </div>
      {#if cityNotice}<p role="status" class="text-sm text-neutral-600">{cityNotice}</p>{/if}
      {#if storageNotice}<p role="status" class="text-sm text-amber-700 dark:text-amber-300">{storageNotice}</p>{/if}
    </section>
  {/if}
  <p class="text-xs leading-relaxed text-neutral-500">All calculations stay in your browser. Current time comes from your device system clock; time zone rules and abbreviations depend on your browser's IANA data. No network time service is used.</p>
</div>
