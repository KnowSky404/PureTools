<script lang="ts">
import { AlertCircle, Calendar, Check, Copy, Sparkles, Timer, Trash2 } from "lucide-svelte";
import { copyToClipboard } from "$lib/utils/clipboard";

type FieldDef = {
  key: string;
  label: string;
  min: number;
  max: number;
  rangeLabel: string;
  allowSeven?: boolean;
};

type FieldValidation = {
  key: string;
  label: string;
  value: string;
  valid: boolean;
  message?: string;
  rangeLabel: string;
};

type CronValidation =
  | { status: "empty" }
  | { status: "invalid"; message: string; fields?: FieldValidation[] }
  | { status: "valid"; fields: FieldValidation[]; normalized: string };

type ScheduleType =
  | "everyMinute"
  | "everyNMinutes"
  | "hourly"
  | "everyNHours"
  | "daily"
  | "weekly"
  | "monthly"
  | "advanced";

type Preset = {
  name: string;
  description: string;
  expression: string;
};

type NumberState = { value: number; valid: boolean };

const FIELD_DEFS: FieldDef[] = [
  { key: "minute", label: "Minute", min: 0, max: 59, rangeLabel: "0-59" },
  { key: "hour", label: "Hour", min: 0, max: 23, rangeLabel: "0-23" },
  { key: "day", label: "Day", min: 1, max: 31, rangeLabel: "1-31" },
  { key: "month", label: "Month", min: 1, max: 12, rangeLabel: "1-12" },
  {
    key: "weekday",
    label: "Weekday",
    min: 0,
    max: 7,
    rangeLabel: "0-7 (0/7=Sun)",
    allowSeven: true,
  },
];

const presets: Preset[] = [
  { name: "Every minute", description: "Runs every minute", expression: "* * * * *" },
  { name: "Every 5 minutes", description: "Runs every 5 minutes", expression: "*/5 * * * *" },
  { name: "Hourly", description: "At minute 0", expression: "0 * * * *" },
  { name: "Daily 02:00", description: "Runs at 02:00", expression: "0 2 * * *" },
  { name: "Weekdays 09:00", description: "Mon-Fri at 09:00", expression: "0 9 * * 1-5" },
  { name: "Monthly 1st 09:00", description: "1st day 09:00", expression: "0 9 1 * *" },
];

const weekdayOptions = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

let cronInput = $state("");
let cronResult = $state<CronValidation>({ status: "empty" });
let cronCopyStatus = $state("Copy");
let generatedCopyStatus = $state("Copy");
let presetCopyStatus = $state<string | null>(null);

let scheduleType = $state<ScheduleType>("everyMinute");
let everyMinutes = $state("5");
let everyHours = $state("2");
let dailyHour = $state("9");
let dailyMinute = $state("0");
let weeklyDay = $state("1");
let weeklyHour = $state("9");
let weeklyMinute = $state("0");
let monthlyDay = $state("1");
let monthlyHour = $state("9");
let monthlyMinute = $state("0");

let advancedMinute = $state("*");
let advancedHour = $state("*");
let advancedDay = $state("*");
let advancedMonth = $state("*");
let advancedWeekday = $state("*");

const everyMinutesState = $derived.by<NumberState>(() =>
  parseNumberInRange(everyMinutes, 1, 59, 5),
);
const everyHoursState = $derived.by<NumberState>(() => parseNumberInRange(everyHours, 1, 23, 2));
const dailyHourState = $derived.by<NumberState>(() => parseNumberInRange(dailyHour, 0, 23, 9));
const dailyMinuteState = $derived.by<NumberState>(() => parseNumberInRange(dailyMinute, 0, 59, 0));
const weeklyHourState = $derived.by<NumberState>(() => parseNumberInRange(weeklyHour, 0, 23, 9));
const weeklyMinuteState = $derived.by<NumberState>(() =>
  parseNumberInRange(weeklyMinute, 0, 59, 0),
);
const monthlyDayState = $derived.by<NumberState>(() => parseNumberInRange(monthlyDay, 1, 31, 1));
const monthlyHourState = $derived.by<NumberState>(() => parseNumberInRange(monthlyHour, 0, 23, 9));
const monthlyMinuteState = $derived.by<NumberState>(() =>
  parseNumberInRange(monthlyMinute, 0, 59, 0),
);

const generatedExpression = $derived.by(() => buildGeneratedExpression());
const generatedValidation = $derived.by(() => validateCronExpression(generatedExpression));

$effect(() => {
  const value = cronInput.trim();
  const timer = setTimeout(() => {
    cronResult = validateCronExpression(value);
  }, 250);

  return () => clearTimeout(timer);
});

function validateCronExpression(expression: string): CronValidation {
  const trimmed = expression.trim();
  if (!trimmed) {
    return { status: "empty" };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    return {
      status: "invalid",
      message: "Cron must have 5 fields: minute hour day month weekday.",
    };
  }

  const fields = parts.map((value, index) => validateField(value, FIELD_DEFS[index]));
  const invalidField = fields.find((field) => !field.valid);
  if (invalidField) {
    return {
      status: "invalid",
      message: `${invalidField.label}: ${invalidField.message ?? "Invalid field."}`,
      fields,
    };
  }

  return {
    status: "valid",
    fields,
    normalized: parts.join(" "),
  };
}

function validateField(value: string, def: FieldDef): FieldValidation {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      key: def.key,
      label: def.label,
      value,
      valid: false,
      message: "Field is empty.",
      rangeLabel: def.rangeLabel,
    };
  }

  const segments = trimmed.split(",");
  for (const segment of segments) {
    const issue = validateSegment(segment, def);
    if (issue) {
      return {
        key: def.key,
        label: def.label,
        value: trimmed,
        valid: false,
        message: issue,
        rangeLabel: def.rangeLabel,
      };
    }
  }

  return {
    key: def.key,
    label: def.label,
    value: trimmed,
    valid: true,
    rangeLabel: def.rangeLabel,
  };
}

function validateSegment(segment: string, def: FieldDef): string | null {
  const trimmed = segment.trim();
  if (!trimmed) {
    return "Empty segment.";
  }

  if (trimmed === "*") {
    return null;
  }

  const [base, step] = trimmed.split("/");
  if (step !== undefined) {
    const stepValue = parsePositiveInt(step);
    if (stepValue === null || stepValue < 1) {
      return "Step must be a positive integer.";
    }
  }

  if (base === "*") {
    return null;
  }

  if (base.includes("-")) {
    const [startRaw, endRaw] = base.split("-");
    const start = parseNumberInRangeRaw(startRaw, def);
    const end = parseNumberInRangeRaw(endRaw, def);
    if (start === null || end === null) {
      return `Range must be within ${def.rangeLabel}.`;
    }
    if (start > end) {
      return "Range start must be <= end.";
    }
    return null;
  }

  const single = parseNumberInRangeRaw(base, def);
  if (single === null) {
    return `Value must be within ${def.rangeLabel}.`;
  }
  return null;
}

function parsePositiveInt(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }
  return Number.parseInt(value, 10);
}

function parseNumberInRangeRaw(raw: string, def: FieldDef): number | null {
  const parsed = parsePositiveInt(raw);
  if (parsed === null) {
    return null;
  }
  if (parsed < def.min || parsed > def.max) {
    return null;
  }
  if (!def.allowSeven && parsed === 7) {
    return null;
  }
  return parsed;
}

function parseNumberInRange(raw: string, min: number, max: number, fallback: number): NumberState {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return { value: fallback, valid: false };
  }
  return { value: parsed, valid: true };
}

function buildGeneratedExpression(): string {
  switch (scheduleType) {
    case "everyMinute":
      return "* * * * *";
    case "everyNMinutes":
      return `*/${everyMinutesState.value} * * * *`;
    case "hourly":
      return "0 * * * *";
    case "everyNHours":
      return `0 */${everyHoursState.value} * * *`;
    case "daily":
      return `${dailyMinuteState.value} ${dailyHourState.value} * * *`;
    case "weekly":
      return `${weeklyMinuteState.value} ${weeklyHourState.value} * * ${weeklyDay}`;
    case "monthly":
      return `${monthlyMinuteState.value} ${monthlyHourState.value} ${monthlyDayState.value} * *`;
    case "advanced":
      return [
        advancedMinute.trim() || "*",
        advancedHour.trim() || "*",
        advancedDay.trim() || "*",
        advancedMonth.trim() || "*",
        advancedWeekday.trim() || "*",
      ].join(" ");
    default:
      return "* * * * *";
  }
}

function resetGenerator(): void {
  scheduleType = "everyMinute";
  everyMinutes = "5";
  everyHours = "2";
  dailyHour = "9";
  dailyMinute = "0";
  weeklyDay = "1";
  weeklyHour = "9";
  weeklyMinute = "0";
  monthlyDay = "1";
  monthlyHour = "9";
  monthlyMinute = "0";
  advancedMinute = "*";
  advancedHour = "*";
  advancedDay = "*";
  advancedMonth = "*";
  advancedWeekday = "*";
}

function handleClear(): void {
  cronInput = "";
  cronResult = { status: "empty" };
}

async function handleCopyCron(): Promise<void> {
  const value = cronInput.trim();
  if (!value) {
    return;
  }
  const success = await copyToClipboard(value);
  cronCopyStatus = success ? "Copied!" : "Copy failed";
  setTimeout(() => (cronCopyStatus = "Copy"), 1500);
}

async function handleCopyGenerated(): Promise<void> {
  const value = generatedExpression.trim();
  if (!value) {
    return;
  }
  const success = await copyToClipboard(value);
  generatedCopyStatus = success ? "Copied!" : "Copy failed";
  setTimeout(() => (generatedCopyStatus = "Copy"), 1500);
}

async function handleCopyPreset(preset: Preset): Promise<void> {
  const success = await copyToClipboard(preset.expression);
  presetCopyStatus = success ? preset.name : null;
  setTimeout(() => (presetCopyStatus = null), 1200);
}

function applyGeneratedToValidator(): void {
  cronInput = generatedExpression;
}

function applyPreset(preset: Preset): void {
  cronInput = preset.expression;
}
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <!-- Header Section -->
  <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex items-center gap-4">
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100">
        <Timer size={24} />
      </div>
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-neutral-900">CRON Generator & Validator</h1>
        <p class="text-sm font-medium text-neutral-500">
          Validate 5-field cron expressions and build schedules quickly
        </p>
      </div>
    </div>
  </div>

  <div class="grid gap-8 lg:grid-cols-2">
    <!-- Validator -->
    <section class="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
        <h2 class="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-neutral-900">
          <Calendar size={14} class="text-cyan-600" />
          Validator
        </h2>
        <div class="flex items-center gap-2">
          <button
            onclick={handleClear}
            class="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-red-200 hover:text-red-600"
          >
            <Trash2 size={12} />
            Clear
          </button>
          <button
            onclick={handleCopyCron}
            class="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-cyan-200 hover:text-cyan-600"
            disabled={!cronInput.trim()}
          >
            <Copy size={12} />
            {cronCopyStatus}
          </button>
        </div>
      </div>

      <div class="space-y-6 p-6">
        <div class="space-y-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Expression</label>
          <input
            type="text"
            bind:value={cronInput}
            placeholder="*/5 * * * *"
            class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
          />
          <p class="text-xs text-neutral-400">Fields: minute hour day month weekday</p>
          <p class="text-xs text-neutral-400">
            Supports: `*`, `*/n`, `n`, `n-m`, `n-m/n`, `n/n`, and comma lists
          </p>
        </div>

        <div class="rounded-xl border border-neutral-200 bg-white p-4">
          {#if cronResult.status === "empty"}
            <div class="text-sm text-neutral-400">Waiting for a cron expression.</div>
          {:else if cronResult.status === "invalid"}
            <div class="flex items-start gap-2 text-sm font-semibold text-red-600">
              <AlertCircle size={16} class="mt-0.5" />
              <div>
                Invalid cron: {cronResult.message}
                <div class="mt-1 text-xs font-normal text-neutral-400">
                  Example: */15 9-17 * * 1-5
                </div>
              </div>
            </div>
          {:else}
            <div class="flex flex-wrap items-center gap-2 text-sm font-semibold text-emerald-600">
              <Check size={16} />
              Cron is valid
            </div>
            <div class="mt-3 text-xs text-neutral-500">
              Normalized: <span class="font-mono text-neutral-800">{cronResult.normalized}</span>
            </div>
          {/if}
        </div>

        <div class="space-y-2">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Fields</h3>
          <div class="grid gap-3 sm:grid-cols-2">
            {#if cronResult.status === "valid"}
              {#each cronResult.fields as field}
                <div class="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div class="text-[11px] font-semibold uppercase text-neutral-400">{field.label}</div>
                  <div class="mt-1 font-mono text-sm text-neutral-800">{field.value}</div>
                  <div class="text-[11px] text-neutral-400">Range {field.rangeLabel}</div>
                </div>
              {/each}
            {:else}
              {#each FIELD_DEFS as field}
                <div class="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div class="text-[11px] font-semibold uppercase text-neutral-400">{field.label}</div>
                  <div class="mt-1 text-xs text-neutral-400">Range {field.rangeLabel}</div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>
    </section>

    <!-- Generator -->
    <section class="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
        <h2 class="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-neutral-900">
          <Sparkles size={14} class="text-cyan-600" />
          Generator
        </h2>
        <button
          onclick={resetGenerator}
          class="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-neutral-300 hover:text-neutral-900"
        >
          Reset
        </button>
      </div>

      <div class="space-y-6 p-6">
        <div class="space-y-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Schedule Type</label>
          <select
            bind:value={scheduleType}
            class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
          >
            <option value="everyMinute">Every minute</option>
            <option value="everyNMinutes">Every N minutes</option>
            <option value="hourly">Hourly</option>
            <option value="everyNHours">Every N hours</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="advanced">Advanced (manual)</option>
          </select>
        </div>

        {#if scheduleType === "everyNMinutes"}
          <div class="space-y-2">
            <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Every N Minutes</label>
            <input
              type="text"
              inputmode="numeric"
              bind:value={everyMinutes}
              class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
            />
            {#if !everyMinutesState.valid}
              <p class="text-xs text-red-500">Use 1-59.</p>
            {/if}
          </div>
        {/if}

        {#if scheduleType === "everyNHours"}
          <div class="space-y-2">
            <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Every N Hours</label>
            <input
              type="text"
              inputmode="numeric"
              bind:value={everyHours}
              class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
            />
            {#if !everyHoursState.valid}
              <p class="text-xs text-red-500">Use 1-23.</p>
            {/if}
          </div>
        {/if}

        {#if scheduleType === "daily"}
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Hour (0-23)</label>
              <input
                type="text"
                inputmode="numeric"
                bind:value={dailyHour}
                class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
              {#if !dailyHourState.valid}
                <p class="text-xs text-red-500">Use 0-23.</p>
              {/if}
            </div>
            <div class="space-y-2">
              <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Minute (0-59)</label>
              <input
                type="text"
                inputmode="numeric"
                bind:value={dailyMinute}
                class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
              {#if !dailyMinuteState.valid}
                <p class="text-xs text-red-500">Use 0-59.</p>
              {/if}
            </div>
          </div>
        {/if}

        {#if scheduleType === "weekly"}
          <div class="space-y-4">
            <div class="space-y-2">
              <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Weekday</label>
              <select
                bind:value={weeklyDay}
                class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              >
                {#each weekdayOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Hour (0-23)</label>
                <input
                  type="text"
                  inputmode="numeric"
                  bind:value={weeklyHour}
                  class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                />
                {#if !weeklyHourState.valid}
                  <p class="text-xs text-red-500">Use 0-23.</p>
                {/if}
              </div>
              <div class="space-y-2">
                <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Minute (0-59)</label>
                <input
                  type="text"
                  inputmode="numeric"
                  bind:value={weeklyMinute}
                  class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                />
                {#if !weeklyMinuteState.valid}
                  <p class="text-xs text-red-500">Use 0-59.</p>
                {/if}
              </div>
            </div>
          </div>
        {/if}

        {#if scheduleType === "monthly"}
          <div class="space-y-4">
            <div class="space-y-2">
              <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Day of Month (1-31)</label>
              <input
                type="text"
                inputmode="numeric"
                bind:value={monthlyDay}
                class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
              {#if !monthlyDayState.valid}
                <p class="text-xs text-red-500">Use 1-31.</p>
              {/if}
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Hour (0-23)</label>
                <input
                  type="text"
                  inputmode="numeric"
                  bind:value={monthlyHour}
                  class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                />
                {#if !monthlyHourState.valid}
                  <p class="text-xs text-red-500">Use 0-23.</p>
                {/if}
              </div>
              <div class="space-y-2">
                <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Minute (0-59)</label>
                <input
                  type="text"
                  inputmode="numeric"
                  bind:value={monthlyMinute}
                  class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                />
                {#if !monthlyMinuteState.valid}
                  <p class="text-xs text-red-500">Use 0-59.</p>
                {/if}
              </div>
            </div>
          </div>
        {/if}

        {#if scheduleType === "advanced"}
          <div class="space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Minute</label>
                <input
                  type="text"
                  bind:value={advancedMinute}
                  class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-mono text-neutral-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Hour</label>
                <input
                  type="text"
                  bind:value={advancedHour}
                  class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-mono text-neutral-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Day</label>
                <input
                  type="text"
                  bind:value={advancedDay}
                  class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-mono text-neutral-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Month</label>
                <input
                  type="text"
                  bind:value={advancedMonth}
                  class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-mono text-neutral-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Weekday</label>
                <input
                  type="text"
                  bind:value={advancedWeekday}
                  class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-mono text-neutral-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>
            </div>
          </div>
        {/if}

        <div class="space-y-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Generated Expression</label>
          <div class="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-700">
            <span class="break-all">{generatedExpression}</span>
            <button
              onclick={handleCopyGenerated}
              class="ml-auto flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-500 transition hover:border-cyan-200 hover:text-cyan-600"
            >
              <Copy size={12} />
              {generatedCopyStatus}
            </button>
          </div>
          {#if generatedValidation.status === "invalid"}
            <div class="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
              {generatedValidation.message}
            </div>
          {/if}
          <button
            onclick={applyGeneratedToValidator}
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 active:scale-[0.98]"
          >
            <Check size={14} />
            Use In Validator
          </button>
        </div>

        <div class="space-y-3">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Templates</h3>
          <div class="space-y-3">
            {#each presets as preset}
              <div class="rounded-xl border border-neutral-200 bg-white p-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p class="text-sm font-semibold text-neutral-900">{preset.name}</p>
                    <p class="text-xs text-neutral-400">{preset.description}</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      onclick={() => handleCopyPreset(preset)}
                      class="flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-500 transition hover:border-cyan-200 hover:text-cyan-600"
                    >
                      <Copy size={12} />
                      {presetCopyStatus === preset.name ? "Copied!" : "Copy"}
                    </button>
                    <button
                      onclick={() => applyPreset(preset)}
                      class="rounded-md bg-cyan-600 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-cyan-700"
                    >
                      Use
                    </button>
                  </div>
                </div>
                <div class="mt-2 rounded-lg bg-neutral-50 px-3 py-2 font-mono text-[11px] text-neutral-700 break-all">
                  {preset.expression}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </section>
  </div>
</div>
