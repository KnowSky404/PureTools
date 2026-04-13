<script lang="ts">
import { Check, Copy, Languages, RefreshCw, UserRound } from "lucide-svelte";
import { copyToClipboard } from "$lib/utils/clipboard";
import {
  type GeneratedName,
  generateRandomNames,
  type NameDisplayOrder,
  type NameGender,
  type SupportedCountry,
  supportsWesternOrder,
} from "$lib/utils/random-name";

type CountryOption = {
  value: SupportedCountry;
  label: string;
  description: string;
  localOrderHint: string;
};

type GenderOption = {
  value: NameGender;
  label: string;
};

const countryOptions: CountryOption[] = [
  {
    value: "us",
    label: "United States",
    description: "Common English-style first and last names.",
    localOrderHint: "Local order: given name first",
  },
  {
    value: "cn",
    label: "China",
    description: "Common family names with short personal names.",
    localOrderHint: "Local order: family name first",
  },
  {
    value: "jp",
    label: "Japan",
    description: "Common surnames and modern Japanese given names.",
    localOrderHint: "Local order: family name first",
  },
  {
    value: "kr",
    label: "South Korea",
    description: "Common Korean surnames and given names.",
    localOrderHint: "Local order: family name first",
  },
];

const genderOptions: GenderOption[] = [
  { value: "random", label: "Random" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const displayOrderOptions: { value: NameDisplayOrder; label: string }[] = [
  { value: "local", label: "Local Order" },
  { value: "western", label: "English Order" },
];

let country = $state<SupportedCountry>("us");
let gender = $state<NameGender>("random");
let batchCount = $state(6);
let displayOrder = $state<NameDisplayOrder>("local");
let generatedNames = $state<GeneratedName[]>([]);
let errorMessage = $state("");
let copiedValue = $state("");
let copyLabel = $state("Copy");
let toastMessage = $state("");
let toastTone = $state<"success" | "error">("success");
let initialized = false;
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

const primaryName = $derived(generatedNames[0] ?? null);
const activeCountry = $derived(
  countryOptions.find((option) => option.value === country) ?? countryOptions[0],
);
const canUseWesternOrder = $derived(supportsWesternOrder(country));

$effect(() => {
  if (initialized) {
    return;
  }

  initialized = true;
  void handleGenerate(false);
});

$effect(() => {
  if (canUseWesternOrder) {
    return;
  }

  if (displayOrder === "western") {
    displayOrder = "local";
  }
});

function clampBatchCount(): void {
  if (!Number.isInteger(batchCount) || Number.isNaN(batchCount)) {
    batchCount = 6;
    return;
  }

  batchCount = Math.min(20, Math.max(1, batchCount));
}

function formatGenderLabel(value: GeneratedName["gender"]): string {
  return value === "male" ? "Male" : "Female";
}

function showToast(message: string, tone: "success" | "error"): void {
  toastMessage = message;
  toastTone = tone;

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = setTimeout(() => {
    toastMessage = "";
  }, 1800);
}

async function handleGenerate(shouldCopyPrimary = true): Promise<void> {
  errorMessage = "";
  clampBatchCount();

  try {
    generatedNames = generateRandomNames({
      country,
      gender,
      count: batchCount,
      displayOrder,
    });

    const nextPrimary = generatedNames[0] ?? null;

    if (shouldCopyPrimary && nextPrimary) {
      await handleCopy(nextPrimary.fullName, "Primary copied");
    } else {
      resetCopyFeedback();
    }
  } catch (error) {
    generatedNames = [];
    errorMessage = error instanceof Error ? error.message : "Failed to generate random names.";
    showToast("Failed to generate names", "error");
  }
}

async function handleCopy(value: string, successLabel = "Copied!"): Promise<void> {
  const success = await copyToClipboard(value);

  copiedValue = value;
  copyLabel = success ? successLabel : "Copy failed";
  showToast(success ? successLabel : "Copy failed", success ? "success" : "error");

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
</script>

<div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
  <div class="grid gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
    <section class="space-y-6">
      <div class="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div class="mb-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-neutral-900">
          <UserRound size={16} class="text-rose-600" />
          Controls
        </div>

        <div class="space-y-4">
          <label class="block space-y-2">
            <span class="text-sm font-semibold text-neutral-700">Country</span>
            <select
              bind:value={country}
              class="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-rose-500 focus:bg-white focus:ring-4 focus:ring-rose-500/5"
            >
              {#each countryOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
            <p class="text-xs leading-5 text-neutral-500">{activeCountry.description}</p>
          </label>

          <label class="block space-y-2">
            <span class="text-sm font-semibold text-neutral-700">Gender</span>
            <select
              bind:value={gender}
              class="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-rose-500 focus:bg-white focus:ring-4 focus:ring-rose-500/5"
            >
              {#each genderOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>

          <label class="block space-y-2">
            <span class="text-sm font-semibold text-neutral-700">Batch Size</span>
            <input
              type="number"
              min="1"
              max="20"
              bind:value={batchCount}
              class="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-rose-500 focus:bg-white focus:ring-4 focus:ring-rose-500/5"
            />
            <p class="text-xs leading-5 text-neutral-500">Generate between 1 and 20 names per run.</p>
          </label>

          {#if canUseWesternOrder}
            <label class="block space-y-2">
              <span class="text-sm font-semibold text-neutral-700">Display Order</span>
              <select
                bind:value={displayOrder}
                class="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-rose-500 focus:bg-white focus:ring-4 focus:ring-rose-500/5"
              >
                {#each displayOrderOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </label>
          {/if}

          <button
            onclick={() => handleGenerate(true)}
            class="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 active:scale-[0.99]"
          >
            <RefreshCw size={16} />
            Generate & Copy Primary
          </button>
        </div>
      </div>

      <div class="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div class="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-neutral-900">
          <Languages size={16} class="text-rose-600" />
          Order Rules
        </div>
        <ul class="space-y-3 text-sm leading-6 text-neutral-600">
          <li>{activeCountry.localOrderHint}.</li>
          <li>`Local Order` follows the naming convention of the selected country.</li>
          <li>`English Order` is available only for United States names.</li>
          <li>China, Japan, and South Korea stay in native script and local order.</li>
          <li>This MVP uses a compact built-in dataset for realistic demo data, not official records.</li>
        </ul>
      </div>
    </section>

    <section class="space-y-6">
      <div class="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div class="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 class="text-sm font-bold uppercase tracking-wider text-neutral-900">Primary Result</h2>
            <p class="mt-1 text-sm text-neutral-500">The first generated name is optimized for quick copy.</p>
          </div>

          {#if primaryName}
            <button
              onclick={() => handleCopy(primaryName.fullName, "Primary copied")}
              class="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:border-rose-200 hover:text-rose-600"
            >
              {#if copiedValue === primaryName.fullName && copyLabel !== "Copy"}
                <Check size={15} />
              {:else}
                <Copy size={15} />
              {/if}
              {copiedValue === primaryName.fullName ? copyLabel : "Copy Primary"}
            </button>
          {/if}
        </div>

        {#if errorMessage}
          <div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        {:else if primaryName}
          <div class="space-y-4">
            <div class="rounded-2xl bg-gradient-to-br from-rose-50 via-white to-orange-50 p-5 ring-1 ring-rose-100">
              <div class="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">Full Name</div>
              <div class="mt-3 text-3xl font-bold tracking-tight text-neutral-900">
                {primaryName.fullName}
              </div>
            </div>

            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div class="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Family Name</div>
                <div class="mt-2 text-lg font-semibold text-neutral-900">{primaryName.familyName}</div>
              </div>
              <div class="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Given Name</div>
                <div class="mt-2 text-lg font-semibold text-neutral-900">{primaryName.givenName}</div>
              </div>
              <div class="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Country</div>
                <div class="mt-2 text-lg font-semibold text-neutral-900">{activeCountry.label}</div>
              </div>
              <div class="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Gender</div>
                <div class="mt-2 text-lg font-semibold text-neutral-900">
                  {formatGenderLabel(primaryName.gender)}
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div class="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 class="text-sm font-bold uppercase tracking-wider text-neutral-900">Batch Results</h2>
            <p class="mt-1 text-sm text-neutral-500">
              Scan variants, copy one result, or regenerate the whole batch.
            </p>
          </div>
          <div class="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-600">
            {generatedNames.length} results
          </div>
        </div>

        <div class="space-y-3">
          {#each generatedNames as item, index (`${item.fullName}-${index}`)}
            <div class="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div class="min-w-0 flex-1">
                <div class="truncate text-lg font-semibold text-neutral-900">{item.fullName}</div>
                <div class="mt-2 flex flex-wrap gap-2 text-xs font-medium text-neutral-500">
                  <span class="rounded-full bg-white px-2.5 py-1 ring-1 ring-neutral-200">
                    {countryOptions.find((option) => option.value === item.country)?.label ?? item.country}
                  </span>
                  <span class="rounded-full bg-white px-2.5 py-1 ring-1 ring-neutral-200">
                    {formatGenderLabel(item.gender)}
                  </span>
                  <span class="rounded-full bg-white px-2.5 py-1 ring-1 ring-neutral-200">
                    Family: {item.familyName}
                  </span>
                  <span class="rounded-full bg-white px-2.5 py-1 ring-1 ring-neutral-200">
                    Given: {item.givenName}
                  </span>
                </div>
              </div>

              <button
                onclick={() => handleCopy(item.fullName)}
                class="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:border-rose-200 hover:text-rose-600"
              >
                {#if copiedValue === item.fullName && copyLabel !== "Copy"}
                  <Check size={15} />
                {:else}
                  <Copy size={15} />
                {/if}
                {copiedValue === item.fullName ? copyLabel : "Copy"}
              </button>
            </div>
          {/each}
        </div>
      </div>
    </section>
  </div>
</div>

{#if toastMessage}
  <div class="fixed left-1/2 top-20 z-50 -translate-x-1/2">
    <div
      class="rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur-sm transition
      {toastTone === 'success'
        ? 'border-emerald-200 bg-emerald-50/95 text-emerald-700'
        : 'border-red-200 bg-red-50/95 text-red-700'}"
    >
      {toastMessage}
    </div>
  </div>
{/if}
