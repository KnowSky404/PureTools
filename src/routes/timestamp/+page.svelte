<script lang="ts">
import {
  AlertCircle,
  ArrowRightLeft,
  Calendar,
  Check,
  Clock,
  Copy,
  Fingerprint,
  Globe,
  Timer,
  Zap,
} from "lucide-svelte";
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
    return { error: "Month 01-12." };
  }
  if (!isInRange(day, 1, 31)) {
    return { error: "Day 01-31." };
  }
  if (!isInRange(hour, 0, 23)) {
    return { error: "Hour 00-23." };
  }
  if (!isInRange(minute, 0, 59)) {
    return { error: "Minute 00-59." };
  }
  if (!isInRange(second, 0, 59)) {
    return { error: "Second 00-59." };
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

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <!-- Header Section -->
  <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex items-center gap-4">
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 ring-1 ring-orange-100">
        <Clock size={24} />
      </div>
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-neutral-900">Timestamp Tool</h1>
        <p class="text-sm text-neutral-500 font-medium">Validate and convert timestamps instantly</p>
      </div>
    </div>
  </div>

  <div class="grid gap-8 lg:grid-cols-2">
    <!-- Timestamp to Date -->
    <section class="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div class="border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
        <h2 class="flex items-center gap-2 text-sm font-bold text-neutral-900 uppercase tracking-wider">
          <ArrowRightLeft size={14} class="text-orange-600" />
          Timestamp to Date
        </h2>
      </div>
      
      <div class="flex-1 p-6 space-y-6">
        <div class="space-y-3">
          <label for="ts-input" class="text-xs font-bold uppercase tracking-wider text-neutral-400">Timestamp Value</label>
          <div class="flex gap-2">
            <div class="relative flex-1">
              <input
                id="ts-input"
                type="text"
                bind:value={timestampInput}
                placeholder="e.g. 1700000000000"
                class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm text-neutral-900 placeholder:text-neutral-300 outline-none transition-all focus:border-orange-500/50 focus:bg-white focus:ring-4 focus:ring-orange-500/5"
              />
            </div>
            <select
              bind:value={timestampUnit}
              class="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-xs font-bold text-neutral-700 outline-none transition-all hover:border-neutral-300 focus:ring-2 focus:ring-orange-500/10"
            >
              <option value="s">Seconds (s)</option>
              <option value="ms">Millis (ms)</option>
            </select>
          </div>
        </div>

        <button
          onclick={handleNowTimestamp}
          class="flex items-center gap-2 rounded-xl bg-neutral-100 px-4 py-2.5 text-xs font-bold text-neutral-700 transition-all hover:bg-neutral-200 active:scale-95"
        >
          <Zap size={14} class="text-orange-600 fill-orange-600" />
          Get Current Timestamp
        </button>

        <div class="space-y-4">
          <div class="rounded-xl border border-neutral-100 bg-neutral-50/50 p-5 space-y-4">
            {#if timestampResult.status === "valid"}
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="space-y-1.5">
                  <span class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    <Timer size={10} /> Local Time
                  </span>
                  <p class="font-mono text-sm font-semibold text-neutral-900">{timestampResult.local}</p>
                </div>
                <div class="space-y-1.5">
                  <span class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    <Globe size={10} /> UTC
                  </span>
                  <p class="font-mono text-sm font-semibold text-neutral-900">{timestampResult.utc}</p>
                </div>
              </div>
            {:else if timestampResult.status === "invalid"}
              <div class="flex items-center gap-2 text-red-600">
                <AlertCircle size={16} />
                <span class="text-xs font-bold">{timestampResult.message}</span>
              </div>
            {:else}
              <div class="flex flex-col items-center justify-center py-4 text-neutral-300">
                <ArrowRightLeft size={24} class="mb-2 opacity-20" />
                <p class="text-[10px] font-bold uppercase tracking-widest">Awaiting Input</p>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </section>

    <!-- Date to Timestamp -->
    <section class="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div class="border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
        <h2 class="flex items-center gap-2 text-sm font-bold text-neutral-900 uppercase tracking-wider">
          <Calendar size={14} class="text-orange-600" />
          Date to Timestamp
        </h2>
      </div>
      
      <div class="flex-1 p-6 space-y-6">
        <div class="space-y-3">
          <label for="dt-input" class="text-xs font-bold uppercase tracking-wider text-neutral-400">Human Readable Date</label>
          <div class="flex gap-2">
            <div class="relative flex-1">
              <input
                id="dt-input"
                type="text"
                bind:value={datetimeInput}
                placeholder="YYYY-MM-DD HH:mm:ss"
                class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm text-neutral-900 placeholder:text-neutral-300 outline-none transition-all focus:border-orange-500/50 focus:bg-white focus:ring-4 focus:ring-orange-500/5"
              />
            </div>
            <select
              bind:value={datetimeUnit}
              class="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-xs font-bold text-neutral-700 outline-none transition-all hover:border-neutral-300 focus:ring-2 focus:ring-orange-500/10"
            >
              <option value="s">Seconds (s)</option>
              <option value="ms">Millis (ms)</option>
            </select>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            onclick={handleNowDatetime}
            class="flex items-center gap-2 rounded-xl bg-neutral-100 px-4 py-2.5 text-xs font-bold text-neutral-700 transition-all hover:bg-neutral-200 active:scale-95"
          >
            <Clock size={14} class="text-orange-600" />
            Use Current Time
          </button>
          
          {#if datetimeResult.status === "valid"}
            <button
              onclick={handleCopyDatetime}
              class="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95"
            >
              {#if datetimeCopyStatus === "Copied!"}
                <Check size={14} />
              {:else}
                <Copy size={14} />
              {/if}
              {datetimeCopyStatus}
            </button>
          {/if}
        </div>

        <div class="space-y-4">
          <div class="rounded-xl border border-neutral-100 bg-neutral-50/50 p-5 space-y-4">
            {#if datetimeResult.status === "valid"}
              <div class="space-y-1.5">
                <span class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  <Fingerprint size={10} /> Generated Timestamp ({datetimeUnit})
                </span>
                <p class="font-mono text-lg font-bold text-indigo-600 tracking-tight">{datetimeResult.timestamp}</p>
              </div>
            {:else if datetimeResult.status === "invalid"}
              <div class="flex items-center gap-2 text-red-600">
                <AlertCircle size={16} />
                <span class="text-xs font-bold">{datetimeResult.message}</span>
              </div>
            {:else}
              <div class="flex flex-col items-center justify-center py-4 text-neutral-300">
                <Calendar size={24} class="mb-2 opacity-20" />
                <p class="text-[10px] font-bold uppercase tracking-widest">Awaiting Input</p>
              </div>
            {/if}
          </div>
        </div>
        
        <p class="text-[10px] leading-relaxed text-neutral-400 font-medium italic">
          Tip: Supports YYYY-MM-DD HH:mm:ss, ISO 8601, and shorthand dates. Everything stays local.
        </p>
      </div>
    </section>
  </div>
</div>
