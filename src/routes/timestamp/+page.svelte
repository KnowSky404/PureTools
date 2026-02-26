<script lang="ts">
import { copyToClipboard } from "$lib/utils/clipboard";

type TimestampUnit = "s" | "ms";

type TimestampResult =
  | { status: "empty" }
  | { status: "invalid"; message: string }
  | { status: "valid"; local: string; utc: string; ms: number };

type DateTimeResult =
  | { status: "empty" }
  | { status: "invalid"; message: string }
  | { status: "valid"; timestamp: string; ms: number };

let timestampInput = $state("");
let timestampUnit = $state<TimestampUnit>("ms");

let datetimeInput = $state("");
let datetimeUnit = $state<TimestampUnit>("ms");
let datetimeCopyStatus = $state("Copy");

const timestampResult = $derived.by<TimestampResult>(() => {
  const raw = timestampInput.trim();
  if (!raw) {
    return { status: "empty" };
  }

  if (!/^[+-]?\d+$/.test(raw)) {
    return { status: "invalid", message: "Timestamp must be an integer." };
  }

  const numeric = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(numeric)) {
    return { status: "invalid", message: "Timestamp is out of range." };
  }

  const ms = timestampUnit === "s" ? numeric * 1000 : numeric;
  if (!Number.isSafeInteger(ms)) {
    return { status: "invalid", message: "Timestamp is out of range." };
  }

  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return { status: "invalid", message: "Timestamp is not a valid date." };
  }

  return {
    status: "valid",
    local: formatLocal(date),
    utc: formatUtc(date),
    ms,
  };
});

const datetimeResult = $derived.by<DateTimeResult>(() => {
  const raw = datetimeInput.trim();
  if (!raw) {
    return { status: "empty" };
  }

  const parsed = parseHumanDateTime(raw);
  if (!parsed.date) {
    return { status: "invalid", message: parsed.error ?? "Invalid date/time." };
  }

  const ms = parsed.date.getTime();
  if (!Number.isFinite(ms)) {
    return { status: "invalid", message: "Date is out of range." };
  }

  const value = datetimeUnit === "s" ? Math.floor(ms / 1000) : ms;
  return {
    status: "valid",
    timestamp: String(value),
    ms,
  };
});

async function handleCopyDatetime() {
  if (datetimeResult.status !== "valid") {
    return;
  }

  const success = await copyToClipboard(datetimeResult.timestamp);
  datetimeCopyStatus = success ? "Copied!" : "Copy failed";
  setTimeout(() => (datetimeCopyStatus = "Copy"), 1500);
}

function handleNowTimestamp() {
  const now = Date.now();
  timestampInput = timestampUnit === "s" ? String(Math.floor(now / 1000)) : String(now);
}

function handleNowDatetime() {
  datetimeInput = formatLocal(new Date());
}

function formatLocal(date: Date): string {
  return formatDateTime(date, false);
}

function formatUtc(date: Date): string {
  return formatDateTime(date, true);
}

function formatDateTime(date: Date, useUtc: boolean): string {
  const year = useUtc ? date.getUTCFullYear() : date.getFullYear();
  const month = useUtc ? date.getUTCMonth() + 1 : date.getMonth() + 1;
  const day = useUtc ? date.getUTCDate() : date.getDate();
  const hours = useUtc ? date.getUTCHours() : date.getHours();
  const minutes = useUtc ? date.getUTCMinutes() : date.getMinutes();
  const seconds = useUtc ? date.getUTCSeconds() : date.getSeconds();

  return `${year}-${pad2(month)}-${pad2(day)} ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

type ParsedDateTime = { date?: Date; error?: string };

function parseHumanDateTime(raw: string): ParsedDateTime {
  const value = raw.trim();
  if (!value) {
    return {};
  }

  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return { error: "Invalid ISO 8601 timestamp with timezone." };
    }
    return { date };
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) {
    return { error: "Use YYYY-MM-DD HH:mm:ss or ISO 8601." };
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const hour = match[4] ? Number.parseInt(match[4], 10) : 0;
  const minute = match[5] ? Number.parseInt(match[5], 10) : 0;
  const second = match[6] ? Number.parseInt(match[6], 10) : 0;

  if (!isInRange(month, 1, 12)) {
    return { error: "Month must be between 01 and 12." };
  }
  if (!isInRange(day, 1, 31)) {
    return { error: "Day must be between 01 and 31." };
  }
  if (!isInRange(hour, 0, 23)) {
    return { error: "Hour must be between 00 and 23." };
  }
  if (!isInRange(minute, 0, 59)) {
    return { error: "Minute must be between 00 and 59." };
  }
  if (!isInRange(second, 0, 59)) {
    return { error: "Second must be between 00 and 59." };
  }

  const date = new Date(year, month - 1, day, hour, minute, second);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return { error: "Invalid date/time." };
  }

  return { date };
}

function isInRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}
</script>

<div class="mx-auto max-w-5xl p-6">
  <div class="mb-8 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-slate-900">Timestamp Tool</h1>
      <p class="text-slate-500">Validate and convert timestamps locally in your browser.</p>
    </div>
    <a href="/" class="text-sm font-medium text-indigo-600 hover:text-indigo-500">← Back to Tools</a>
  </div>

  <div class="grid gap-8 lg:grid-cols-2">
    <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="mb-4">
        <h2 class="text-lg font-semibold text-slate-900">Timestamp → Date</h2>
        <p class="text-sm text-slate-500">Convert seconds or milliseconds to human-readable time.</p>
      </div>

      <div class="space-y-4">
        <div class="space-y-2">
          <label class="text-xs font-semibold uppercase tracking-wide text-slate-500">Timestamp</label>
          <div class="flex flex-wrap gap-2">
            <input
              type="text"
              bind:value={timestampInput}
              placeholder="1700000000 or 1700000000000"
              class="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              bind:value={timestampUnit}
              class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="s">Seconds (s)</option>
              <option value="ms">Milliseconds (ms)</option>
            </select>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            onclick={handleNowTimestamp}
            class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Use Now
          </button>
        </div>

        {#if timestampResult.status === "invalid"}
          <p class="text-sm font-medium text-red-600">{timestampResult.message}</p>
        {:else if timestampResult.status === "valid"}
          <p class="text-sm font-medium text-emerald-600">Valid timestamp</p>
        {:else}
          <p class="text-sm text-slate-400">Enter a timestamp to validate and convert.</p>
        {/if}

        <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
          {#if timestampResult.status === "valid"}
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Local Time</p>
                <p class="mt-1 font-mono text-sm text-slate-900">{timestampResult.local}</p>
              </div>
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">UTC</p>
                <p class="mt-1 font-mono text-sm text-slate-900">{timestampResult.utc}</p>
              </div>
            </div>
          {:else}
            <p class="font-mono text-sm text-slate-400">—</p>
          {/if}
        </div>
      </div>
    </section>

    <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="mb-4">
        <h2 class="text-lg font-semibold text-slate-900">Date → Timestamp</h2>
        <p class="text-sm text-slate-500">
          Parse a local time string and convert it to a timestamp.
        </p>
      </div>

      <div class="space-y-4">
        <div class="space-y-2">
          <label class="text-xs font-semibold uppercase tracking-wide text-slate-500">Local Time</label>
          <div class="flex flex-wrap gap-2">
            <input
              type="text"
              bind:value={datetimeInput}
              placeholder="2026-02-26 14:30:00"
              class="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              bind:value={datetimeUnit}
              class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="s">Seconds (s)</option>
              <option value="ms">Milliseconds (ms)</option>
            </select>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            onclick={handleNowDatetime}
            class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Use Now
          </button>
          {#if datetimeResult.status === "valid"}
            <button
              type="button"
              onclick={handleCopyDatetime}
              class="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              {datetimeCopyStatus}
            </button>
          {/if}
        </div>

        {#if datetimeResult.status === "invalid"}
          <p class="text-sm font-medium text-red-600">{datetimeResult.message}</p>
        {:else if datetimeResult.status === "valid"}
          <p class="text-sm font-medium text-emerald-600">Valid date/time</p>
        {:else}
          <p class="text-sm text-slate-400">Use format: YYYY-MM-DD HH:mm:ss</p>
        {/if}

        <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
          {#if datetimeResult.status === "valid"}
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Timestamp</p>
              <p class="mt-1 font-mono text-sm text-slate-900">{datetimeResult.timestamp}</p>
            </div>
          {:else}
            <p class="font-mono text-sm text-slate-400">—</p>
          {/if}
        </div>

        <p class="text-xs text-slate-400">
          Tip: Supports local time like "2026-02-26 14:30:00" or ISO 8601 with timezone.
        </p>
      </div>
    </section>
  </div>
</div>
