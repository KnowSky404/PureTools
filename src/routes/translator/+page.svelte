<script lang="ts">
import {
  AlertCircle,
  Check,
  Copy,
  Languages,
  LoaderCircle,
  RefreshCcw,
  ShieldCheck,
  Trash2,
} from "lucide-svelte";
import { copyToClipboard } from "$lib/utils/clipboard";
import {
  getLanguageName,
  normalizeDetectedLanguage,
  type TranslatorLanguageCode,
  translatorLanguages,
} from "$lib/utils/translator";

type ApiSupport = "checking" | "ready" | "unsupported";
type TranslationPhase =
  | "idle"
  | "detecting"
  | "checking"
  | "downloading"
  | "translating"
  | "success"
  | "error";
type SourceLanguage = "auto" | TranslatorLanguageCode;

let input = $state("");
let output = $state("");
let sourceLanguage = $state<SourceLanguage>("auto");
let targetLanguage = $state<TranslatorLanguageCode>("en");
let detectedLanguage = $state<TranslatorLanguageCode | null>(null);
let detectionConfidence = $state<number | null>(null);
let apiSupport = $state<ApiSupport>("checking");
let detectionSupported = $state(false);
let phase = $state<TranslationPhase>("idle");
let error = $state("");
let copyStatus = $state("Copy");
let downloadingModel = $state("");
let downloadProgress = $state<number | null>(null);
let translatedInput = $state("");
let translatedPair = $state("");

let activeTranslator: ChromeTranslator | null = null;
let activePair = "";
let languageDetector: ChromeLanguageDetector | null = null;
let jobId = 0;

const isBusy = $derived(
  phase === "detecting" ||
    phase === "checking" ||
    phase === "downloading" ||
    phase === "translating",
);
const currentPair = $derived(`${sourceLanguage}:${targetLanguage}`);
const resultChanged = $derived(
  output !== "" && (input !== translatedInput || currentPair !== translatedPair),
);
const canTranslate = $derived(
  apiSupport === "ready" &&
    input.trim().length > 0 &&
    !isBusy &&
    (sourceLanguage !== "auto" || detectionSupported),
);
const canSwap = $derived(
  output !== "" &&
    !resultChanged &&
    !isBusy &&
    (sourceLanguage !== "auto" || detectedLanguage !== null),
);

$effect(() => {
  apiSupport = window.Translator ? "ready" : "unsupported";
  detectionSupported = Boolean(window.LanguageDetector);

  return () => {
    jobId += 1;
    activeTranslator?.destroy();
    languageDetector?.destroy();
    activeTranslator = null;
    languageDetector = null;
  };
});

async function handleTranslate(): Promise<void> {
  if (!canTranslate) {
    return;
  }

  const translatorApi = window.Translator;
  if (!translatorApi) {
    apiSupport = "unsupported";
    return;
  }

  const raw = input.trim();
  const currentJob = ++jobId;
  error = "";
  output = "";
  detectedLanguage = null;
  detectionConfidence = null;
  downloadProgress = null;
  downloadingModel = "";

  try {
    const resolvedSource =
      sourceLanguage === "auto" ? await detectSourceLanguage(raw, currentJob) : sourceLanguage;

    if (resolvedSource === targetLanguage) {
      throw new Error("The source and target languages are the same.");
    }

    const pair = `${resolvedSource}:${targetLanguage}`;
    const translator = await getTranslator(resolvedSource, targetLanguage, currentJob);
    ensureCurrentJob(currentJob);

    phase = "translating";
    const translated = await translator.translate(raw);
    ensureCurrentJob(currentJob);

    if (!translated.trim()) {
      throw new Error("Chrome returned an empty translation.");
    }

    output = translated;
    translatedInput = input;
    translatedPair = currentPair;
    activePair = pair;
    phase = "success";
  } catch (caughtError) {
    if (currentJob !== jobId) {
      return;
    }
    output = "";
    phase = "error";
    error = formatApiError(caughtError);
  }
}

async function detectSourceLanguage(
  raw: string,
  currentJob: number,
): Promise<TranslatorLanguageCode> {
  const detectorApi = window.LanguageDetector;
  if (!detectorApi) {
    throw new Error("Automatic language detection is unavailable. Select a source language.");
  }

  phase = "detecting";
  if (!languageDetector) {
    const availability = await detectorApi.availability();
    ensureCurrentJob(currentJob);
    if (availability === "unavailable") {
      throw new Error("Chrome's language detection model is unavailable on this device.");
    }

    if (availability === "downloadable" || availability === "downloading") {
      setDownloadState("language detection model", availability === "downloadable" ? 0 : null);
    }

    languageDetector = await detectorApi.create({
      monitor: (monitor) => monitorModelDownload(monitor, "language detection model", currentJob),
    });
    ensureCurrentJob(currentJob);
  }

  phase = "detecting";
  const results = await languageDetector.detect(raw);
  ensureCurrentJob(currentJob);

  const supportedResult = results.find(
    (result) => normalizeDetectedLanguage(result.detectedLanguage) !== null,
  );
  const normalizedLanguage = supportedResult
    ? normalizeDetectedLanguage(supportedResult.detectedLanguage)
    : null;

  if (!supportedResult || !normalizedLanguage || supportedResult.confidence < 0.2) {
    throw new Error("The source language could not be detected reliably. Select it manually.");
  }

  detectedLanguage = normalizedLanguage;
  detectionConfidence = supportedResult.confidence;
  return normalizedLanguage;
}

async function getTranslator(
  source: TranslatorLanguageCode,
  target: TranslatorLanguageCode,
  currentJob: number,
): Promise<ChromeTranslator> {
  const translatorApi = window.Translator;
  if (!translatorApi) {
    throw new Error("Chrome's Translator API is unavailable.");
  }

  const pair = `${source}:${target}`;
  if (activeTranslator && activePair === pair) {
    return activeTranslator;
  }

  activeTranslator?.destroy();
  activeTranslator = null;
  activePair = "";
  phase = "checking";

  const options = { sourceLanguage: source, targetLanguage: target };
  const availability = await translatorApi.availability(options);
  ensureCurrentJob(currentJob);
  if (availability === "unavailable") {
    throw new Error(
      `${getLanguageName(source)} to ${getLanguageName(target)} is not available on this device.`,
    );
  }

  if (availability === "downloadable" || availability === "downloading") {
    setDownloadState("translation language pack", availability === "downloadable" ? 0 : null);
  }

  const translator = await translatorApi.create({
    ...options,
    monitor: (monitor) => monitorModelDownload(monitor, "translation language pack", currentJob),
  });
  ensureCurrentJob(currentJob);
  activeTranslator = translator;
  activePair = pair;
  return translator;
}

function monitorModelDownload(
  monitor: ChromeAIModelMonitor,
  modelName: string,
  currentJob: number,
): void {
  monitor.addEventListener("downloadprogress", (event) => {
    if (currentJob !== jobId) {
      return;
    }
    setDownloadState(modelName, Math.round(event.loaded * 100));
  });
}

function setDownloadState(modelName: string, progress: number | null): void {
  phase = "downloading";
  downloadingModel = modelName;
  downloadProgress = progress;
}

function ensureCurrentJob(currentJob: number): void {
  if (currentJob !== jobId) {
    throw new DOMException("Translation cancelled.", "AbortError");
  }
}

function handleSwap(): void {
  if (!canSwap) {
    return;
  }

  const resolvedSource = sourceLanguage === "auto" ? detectedLanguage : sourceLanguage;
  if (!resolvedSource) {
    return;
  }

  const previousTarget = targetLanguage;
  sourceLanguage = previousTarget;
  targetLanguage = resolvedSource;
  input = output;
  output = "";
  detectedLanguage = null;
  detectionConfidence = null;
  phase = "idle";
  error = "";
}

function handleClear(): void {
  if (isBusy) {
    return;
  }
  jobId += 1;
  input = "";
  output = "";
  detectedLanguage = null;
  detectionConfidence = null;
  translatedInput = "";
  translatedPair = "";
  phase = "idle";
  error = "";
}

async function handleCopy(): Promise<void> {
  if (!output) {
    return;
  }
  const success = await copyToClipboard(output);
  copyStatus = success ? "Copied!" : "Copy failed";
  setTimeout(() => (copyStatus = "Copy"), 1500);
}

function formatApiError(caughtError: unknown): string {
  if (caughtError instanceof DOMException) {
    if (caughtError.name === "NotAllowedError") {
      return "Chrome requires permission to download the local model. Click Translate again.";
    }
    if (caughtError.name === "NotSupportedError") {
      return "This language pair is not supported by Chrome on this device.";
    }
    if (caughtError.name === "NetworkError") {
      return "Chrome could not download the local language model. Check your connection and retry.";
    }
    if (caughtError.name === "QuotaExceededError") {
      return "The text is too long for the local translation model. Try a shorter passage.";
    }
  }
  return caughtError instanceof Error ? caughtError.message : "Local translation failed.";
}
</script>

<svelte:head>
  <title>Local Translator | PureTools</title>
  <meta
    name="description"
    content="Translate text privately with Chrome's on-device Translator API."
  />
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <div class="mb-6 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm">
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex items-center gap-2 px-2 text-xs text-neutral-500">
        <ShieldCheck size={14} class="text-cyan-500" />
        On-device translation. Your text never leaves the browser.
      </div>

      <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onclick={handleClear}
          disabled={isBusy || (input === "" && output === "")}
          class="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 size={12} />
          Clear
        </button>
        <button
          type="button"
          onclick={handleCopy}
          disabled={!output || isBusy}
          class="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-cyan-200 hover:text-cyan-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Copy size={12} />
          {copyStatus}
        </button>
        <button
          type="button"
          onclick={handleTranslate}
          disabled={!canTranslate}
          class="flex min-w-28 items-center justify-center gap-1.5 rounded-lg border border-cyan-600 bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:border-cyan-700 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:border-cyan-300 disabled:bg-cyan-300"
        >
          {#if isBusy}
            <LoaderCircle size={12} class="animate-spin" />
            {phase === "downloading" ? "Downloading" : "Translating"}
          {:else}
            <Languages size={12} />
            Translate
          {/if}
        </button>
      </div>
    </div>
  </div>

  {#if apiSupport === "unsupported"}
    <div
      class="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
      role="alert"
    >
      <AlertCircle size={18} class="mt-0.5 shrink-0" />
      <div>
        <div class="font-semibold">Local translation is unavailable in this browser.</div>
        <div class="mt-1 text-xs leading-relaxed text-amber-700">
          Open PureTools in desktop Chrome 138 or later. Chrome's Translator API is not available
          on mobile devices.
        </div>
      </div>
    </div>
  {/if}

  <div class="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
    <div class="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <label class="block">
        <span class="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Source language
        </span>
        <select
          bind:value={sourceLanguage}
          disabled={isBusy || apiSupport !== "ready"}
          class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-semibold text-neutral-700 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="auto" disabled={!detectionSupported}>Detect language</option>
          {#each translatorLanguages as language}
            <option value={language.code}>{language.name}</option>
          {/each}
        </select>
      </label>

      <button
        type="button"
        onclick={handleSwap}
        disabled={!canSwap}
        aria-label="Swap source and target languages"
        class="flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-neutral-500 transition hover:border-cyan-200 hover:text-cyan-600 disabled:cursor-not-allowed disabled:opacity-40 sm:w-10 sm:px-0"
      >
        <RefreshCcw size={16} />
        <span class="ml-2 text-xs font-semibold sm:hidden">Swap languages and text</span>
      </button>

      <label class="block">
        <span class="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Target language
        </span>
        <select
          bind:value={targetLanguage}
          disabled={isBusy || apiSupport !== "ready"}
          class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-semibold text-neutral-700 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {#each translatorLanguages as language}
            <option value={language.code}>{language.name}</option>
          {/each}
        </select>
      </label>
    </div>
  </div>

  {#if phase === "downloading"}
    <div
      class="mb-6 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3"
      aria-live="polite"
    >
      <div class="flex items-center justify-between gap-4 text-xs font-semibold text-cyan-800">
        <span>Downloading {downloadingModel} for local use</span>
        <span>{downloadProgress === null ? "Preparing..." : `${downloadProgress}%`}</span>
      </div>
      {#if downloadProgress !== null}
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-cyan-100">
          <div
            class="h-full rounded-full bg-cyan-500 transition-[width]"
            style={`width: ${downloadProgress}%`}
          ></div>
        </div>
      {/if}
    </div>
  {/if}

  <div class="grid gap-6 lg:grid-cols-2">
    <section class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div class="mb-2 flex items-center justify-between gap-4">
        <label
          for="translator-input"
          class="text-xs font-semibold uppercase tracking-wider text-neutral-500"
        >
          Input
        </label>
        {#if input}
          <span class="text-xs text-neutral-400">{input.length} chars</span>
        {/if}
      </div>
      <textarea
        id="translator-input"
        rows={14}
        bind:value={input}
        disabled={isBusy || apiSupport !== "ready"}
        placeholder="Enter text to translate..."
        class="min-h-80 w-full resize-y rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-900 placeholder:text-neutral-400 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-60"
      ></textarea>

      {#if sourceLanguage === "auto" && detectedLanguage}
        <div class="mt-3 flex items-center gap-2 text-xs text-emerald-600">
          <Check size={14} />
          Detected {getLanguageName(detectedLanguage)}
          {#if detectionConfidence !== null}
            ({Math.round(detectionConfidence * 100)}% confidence)
          {/if}
        </div>
      {:else if sourceLanguage === "auto" && !detectionSupported && apiSupport === "ready"}
        <div class="mt-3 flex items-start gap-2 text-xs text-amber-600">
          <AlertCircle size={14} class="mt-0.5 shrink-0" />
          Automatic detection is unavailable. Select the source language manually.
        </div>
      {/if}
    </section>

    <section class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div class="mb-2 flex items-center justify-between gap-4">
        <label
          for="translator-output"
          class="text-xs font-semibold uppercase tracking-wider text-neutral-500"
        >
          Translation
        </label>
        {#if output}
          <span class="text-xs text-neutral-400">{output.length} chars</span>
        {/if}
      </div>
      <textarea
        id="translator-output"
        rows={14}
        readonly
        value={output}
        placeholder="Translation will appear here..."
        class="min-h-80 w-full resize-y rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-900 placeholder:text-neutral-400 outline-none"
      ></textarea>

      {#if phase === "error"}
        <div
          class="mt-3 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600"
          role="alert"
        >
          <AlertCircle size={14} class="mt-0.5 shrink-0" />
          {error}
        </div>
      {:else if resultChanged}
        <div class="mt-3 flex items-center gap-2 text-xs text-amber-600">
          <RefreshCcw size={14} />
          Input or language changed. Translate again to update the result.
        </div>
      {:else if phase === "success"}
        <div class="mt-3 flex items-center gap-2 text-xs text-emerald-600">
          <Check size={14} />
          Local translation ready
        </div>
      {:else if isBusy && phase !== "downloading"}
        <div class="mt-3 flex items-center gap-2 text-xs text-cyan-600" aria-live="polite">
          <LoaderCircle size={14} class="animate-spin" />
          {phase === "detecting" ? "Detecting source language..." : "Translating locally..."}
        </div>
      {/if}
    </section>
  </div>
</div>
