<script lang="ts">
import { AtSign, Check, Copy, History, RefreshCw, Sparkles, Trash2 } from "lucide-svelte";
import { copyToClipboard } from "$lib/utils/clipboard";
import {
  generateRandomStrings,
  type RandomStringOptions,
  type RandomStringPoolOptions,
  resolveRandomStringPools,
  SAFE_SYMBOL_CHARACTERS,
} from "$lib/utils/random-string";

type GeneratorPreset = {
  id: string;
  name: string;
  description: string;
  config: RandomStringOptions;
};

type RandomHistoryItem = {
  value: string;
  createdAt: number;
};

type PoolState =
  | {
      status: "error";
      message: string;
    }
  | {
      status: "ready";
      firstCharacterPool: string;
      pool: string;
    };

const presets: GeneratorPreset[] = [
  {
    id: "email",
    name: "Email Prefix",
    description: "Lowercase + numbers, starts with a letter, easy to reuse in temp mail flows.",
    config: {
      length: 12,
      count: 6,
      lowercase: true,
      uppercase: false,
      numbers: true,
      symbols: false,
      customCharacters: "",
      excludeSimilar: true,
      startsWithLetter: true,
    },
  },
  {
    id: "mixed",
    name: "Mixed Case",
    description: "Balanced letters + numbers for IDs, demo data, and short tokens.",
    config: {
      length: 16,
      count: 6,
      lowercase: true,
      uppercase: true,
      numbers: true,
      symbols: false,
      customCharacters: "",
      excludeSimilar: false,
      startsWithLetter: false,
    },
  },
  {
    id: "slug",
    name: "Safe Slug",
    description: `Adds ${SAFE_SYMBOL_CHARACTERS} for email/URL friendly names without heavy punctuation.`,
    config: {
      length: 14,
      count: 6,
      lowercase: true,
      uppercase: false,
      numbers: true,
      symbols: true,
      customCharacters: "",
      excludeSimilar: true,
      startsWithLetter: true,
    },
  },
];

let activePresetId = $state("email");
let length = $state(12);
let batchCount = $state(6);
let includeLowercase = $state(true);
let includeUppercase = $state(false);
let includeNumbers = $state(true);
let includeSymbols = $state(false);
let customCharacters = $state("");
let excludeSimilar = $state(true);
let startsWithLetter = $state(true);
let generatedValues = $state<string[]>([]);
let primaryValue = $state("");
let history = $state<RandomHistoryItem[]>([]);
let errorMessage = $state("");
let copiedValue = $state("");
let copyLabel = $state("Copy");
let initialized = false;
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

const poolState = $derived.by<PoolState>(() => {
  try {
    const pools = resolveRandomStringPools(getPoolOptions());
    return {
      status: "ready",
      ...pools,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to build the character pool.",
    };
  }
});

const optionSummary = $derived.by(() => {
  const summary: string[] = [];

  if (includeLowercase) {
    summary.push("lowercase");
  }
  if (includeUppercase) {
    summary.push("uppercase");
  }
  if (includeNumbers) {
    summary.push("numbers");
  }
  if (includeSymbols) {
    summary.push(`safe symbols (${SAFE_SYMBOL_CHARACTERS})`);
  }
  if (customCharacters) {
    summary.push("custom");
  }
  if (excludeSimilar) {
    summary.push("exclude similar");
  }
  if (startsWithLetter) {
    summary.push("letter start");
  }

  return summary;
});

$effect(() => {
  if (initialized) {
    return;
  }
  initialized = true;
  void handleGenerate(false);
});

function getPoolOptions(): RandomStringPoolOptions {
  return {
    lowercase: includeLowercase,
    uppercase: includeUppercase,
    numbers: includeNumbers,
    symbols: includeSymbols,
    customCharacters,
    excludeSimilar,
    startsWithLetter,
  };
}

function getGenerationOptions(): RandomStringOptions {
  return {
    ...getPoolOptions(),
    length,
    count: batchCount,
  };
}

function clampLength(): void {
  length = clampNumber(length, 1, 128, 12);
}

function clampBatchCount(): void {
  batchCount = clampNumber(batchCount, 1, 12, 6);
}

async function handleGenerate(shouldCopyPrimary = true): Promise<void> {
  errorMessage = "";

  try {
    const values = generateRandomStrings(getGenerationOptions());
    generatedValues = values;
    primaryValue = values[0] ?? "";
    pushHistory(values);

    if (shouldCopyPrimary && primaryValue) {
      await handleCopy(primaryValue, "Primary copied");
    } else {
      resetCopyFeedback();
    }
  } catch (error) {
    generatedValues = [];
    primaryValue = "";
    errorMessage = error instanceof Error ? error.message : "Failed to generate random strings.";
  }
}

async function handleCopy(value: string, successLabel = "Copied!"): Promise<void> {
  const success = await copyToClipboard(value);

  copiedValue = value;
  copyLabel = success ? successLabel : "Copy failed";

  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer);
  }

  copyFeedbackTimer = setTimeout(() => {
    copiedValue = "";
    copyLabel = "Copy";
  }, 1600);
}

function resetCopyFeedback(): void {
  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = null;
  }
  copiedValue = "";
  copyLabel = "Copy";
}

function applyPreset(preset: GeneratorPreset): void {
  activePresetId = preset.id;
  length = preset.config.length;
  batchCount = preset.config.count ?? 6;
  includeLowercase = preset.config.lowercase;
  includeUppercase = preset.config.uppercase;
  includeNumbers = preset.config.numbers;
  includeSymbols = preset.config.symbols;
  customCharacters = preset.config.customCharacters ?? "";
  excludeSimilar = preset.config.excludeSimilar ?? false;
  startsWithLetter = preset.config.startsWithLetter ?? false;
  errorMessage = "";
  void handleGenerate(false);
}

function pushHistory(values: string[]): void {
  const startedAt = Date.now();
  const nextItems = values.map((value, index) => ({
    value,
    createdAt: startedAt - index,
  }));

  history = [
    ...nextItems,
    ...history.filter((item) => !nextItems.some((nextItem) => nextItem.value === item.value)),
  ].slice(0, 24);
}

function clearHistory(): void {
  history = [];
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(Math.round(value), min), max);
}
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <div class="mb-6 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm">
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex items-center gap-2 text-xs text-neutral-500">
        <AtSign size={14} class="text-emerald-600" />
        Default preset fits temp mail prefixes without extra typing.
      </div>

      <div class="ml-auto flex flex-wrap items-center gap-2">
        <button
          onclick={() => handleGenerate(true)}
          class="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
        >
          <RefreshCw size={12} />
          Generate & copy first
        </button>
        <button
          onclick={() => primaryValue && handleCopy(primaryValue)}
          class="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-emerald-200 hover:text-emerald-700"
          disabled={!primaryValue}
        >
          <Copy size={12} />
          {primaryValue && copiedValue === primaryValue ? copyLabel : "Copy primary"}
        </button>
        <button
          onclick={clearHistory}
          class="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-red-200 hover:text-red-600"
          disabled={history.length === 0}
        >
          <Trash2 size={12} />
          Clear history
        </button>
      </div>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
    <div class="space-y-6">
      <section class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Generator</h2>
            <p class="mt-1 text-sm text-neutral-500">
              Keep symbols limited to <span class="font-mono text-neutral-700">{SAFE_SYMBOL_CHARACTERS}</span> so results stay email and URL friendly.
            </p>
          </div>
          <div class="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            {batchCount} candidates
          </div>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <label class="flex flex-col gap-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Length</span>
            <input
              type="number"
              min="1"
              max="128"
              bind:value={length}
              onblur={clampLength}
              class="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </label>

          <label class="flex flex-col gap-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Batch Size</span>
            <input
              type="number"
              min="1"
              max="12"
              bind:value={batchCount}
              onblur={clampBatchCount}
              class="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </label>
        </div>

        <div class="mt-5 grid gap-3 sm:grid-cols-2">
          <label class="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            <span>Lowercase</span>
            <input bind:checked={includeLowercase} type="checkbox" class="h-4 w-4 accent-emerald-600" />
          </label>
          <label class="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            <span>Uppercase</span>
            <input bind:checked={includeUppercase} type="checkbox" class="h-4 w-4 accent-emerald-600" />
          </label>
          <label class="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            <span>Numbers</span>
            <input bind:checked={includeNumbers} type="checkbox" class="h-4 w-4 accent-emerald-600" />
          </label>
          <label class="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            <span>Safe symbols ({SAFE_SYMBOL_CHARACTERS})</span>
            <input bind:checked={includeSymbols} type="checkbox" class="h-4 w-4 accent-emerald-600" />
          </label>
          <label class="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            <span>Exclude similar chars</span>
            <input bind:checked={excludeSimilar} type="checkbox" class="h-4 w-4 accent-emerald-600" />
          </label>
          <label class="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            <span>First char must be a letter</span>
            <input bind:checked={startsWithLetter} type="checkbox" class="h-4 w-4 accent-emerald-600" />
          </label>
        </div>

        <label class="mt-5 flex flex-col gap-2">
          <span class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Custom Characters</span>
          <input
            type="text"
            bind:value={customCharacters}
            placeholder="Optional extra characters, e.g. xyz"
            class="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
          />
        </label>

        {#if optionSummary.length > 0}
          <div class="mt-4 flex flex-wrap gap-2">
            {#each optionSummary as item}
              <span class="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-600">
                {item}
              </span>
            {/each}
          </div>
        {/if}

        {#if errorMessage}
          <div class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        {/if}
      </section>

      <section class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Results</h2>
            <p class="mt-1 text-sm text-neutral-500">The first result is treated as the primary candidate.</p>
          </div>
          {#if generatedValues.length > 0}
            <div class="flex items-center gap-2 text-xs text-emerald-700">
              <Check size={14} />
              Web Crypto generated
            </div>
          {/if}
        </div>

        <div class="relative">
          <input
            type="text"
            readonly
            value={primaryValue}
            placeholder="Generated strings will appear here..."
            class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4 pr-28 font-mono text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
          />
          {#if primaryValue}
            <button
              onclick={() => handleCopy(primaryValue)}
              class="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-500 transition hover:border-emerald-200 hover:text-emerald-700"
            >
              {copiedValue === primaryValue ? copyLabel : "Copy"}
            </button>
          {/if}
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {#if generatedValues.length === 0}
            <div class="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-400 sm:col-span-2 xl:col-span-3">
              Generate a batch to see candidate strings.
            </div>
          {:else}
            {#each generatedValues as value, index (`${value}-${index}`)}
              <button
                onclick={() => handleCopy(value)}
                class="group flex flex-col items-start rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50/50"
              >
                <div class="flex w-full items-center justify-between gap-3">
                  <span class="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    {index === 0 ? "Primary" : `Option ${index + 1}`}
                  </span>
                  <span class="text-[11px] font-semibold text-neutral-400 transition group-hover:text-emerald-700">
                    {copiedValue === value ? copyLabel : "Copy"}
                  </span>
                </div>
                <span class="mt-2 break-all font-mono text-sm text-neutral-900">{value}</span>
              </button>
            {/each}
          {/if}
        </div>
      </section>
    </div>

    <div class="space-y-6">
      <section class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div class="mb-4 flex items-center gap-2">
          <Sparkles size={16} class="text-emerald-600" />
          <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Presets</h2>
        </div>

        <div class="space-y-3">
          {#each presets as preset}
            <button
              onclick={() => applyPreset(preset)}
              class="w-full rounded-xl border px-4 py-3 text-left transition {activePresetId === preset.id ? 'border-emerald-200 bg-emerald-50/70' : 'border-neutral-200 bg-neutral-50 hover:border-neutral-300'}"
            >
              <div class="flex items-center justify-between gap-3">
                <span class="text-sm font-semibold text-neutral-900">{preset.name}</span>
                {#if activePresetId === preset.id}
                  <span class="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                    Active
                  </span>
                {/if}
              </div>
              <p class="mt-1 text-xs leading-relaxed text-neutral-500">{preset.description}</p>
            </button>
          {/each}
        </div>
      </section>

      <section class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Character Pool</h2>

        {#if poolState.status === "error"}
          <div class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {poolState.message}
          </div>
        {:else}
          <div class="mt-4 space-y-4">
            <div>
              <div class="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Full pool
              </div>
              <div class="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-xs text-neutral-700 break-all">
                {poolState.pool}
              </div>
            </div>

            <div>
              <div class="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                First character pool
              </div>
              <div class="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-xs text-neutral-700 break-all">
                {poolState.firstCharacterPool}
              </div>
            </div>
          </div>
        {/if}
      </section>

      <section class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <History size={16} class="text-emerald-600" />
            <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">History</h2>
          </div>
          {#if history.length > 0}
            <span class="text-xs text-neutral-400">{history.length} saved</span>
          {/if}
        </div>

        <div class="max-h-[360px] space-y-2 overflow-y-auto">
          {#if history.length === 0}
            <div class="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-400">
              Recent strings will be stored here.
            </div>
          {:else}
            {#each history as item (item.createdAt)}
              <div class="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div class="min-w-0">
                  <div class="truncate font-mono text-sm text-neutral-900">{item.value}</div>
                  <div class="mt-1 text-[11px] text-neutral-400">
                    {new Date(item.createdAt).toLocaleTimeString()}
                  </div>
                </div>
                <button
                  onclick={() => handleCopy(item.value)}
                  class="shrink-0 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-500 transition hover:border-emerald-200 hover:text-emerald-700"
                >
                  {copiedValue === item.value ? copyLabel : "Copy"}
                </button>
              </div>
            {/each}
          {/if}
        </div>
      </section>
    </div>
  </div>
</div>
