<script lang="ts">
import { AlertCircle, Check, Copy, Hash, RefreshCcw, ShieldCheck, Trash2 } from "lucide-svelte";
import { copyToClipboard } from "$lib/utils/clipboard";

type HashAlgo = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

type HashResult =
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "ready"; value: string };

let input = $state("");
let algorithm = $state<HashAlgo>("SHA-256");
let result = $state<HashResult>({ status: "empty" });
let copyStatus = $state("Copy");
let jobId = 0;

$effect(() => {
  const raw = input;
  const algo = algorithm;
  const currentJob = ++jobId;

  const timer = setTimeout(async () => {
    if (!raw) {
      result = { status: "empty" };
      return;
    }

    try {
      if (!crypto?.subtle) {
        result = { status: "error", message: "Web Crypto is not available in this environment." };
        return;
      }
      const data = new TextEncoder().encode(raw);
      const hashBuffer = await crypto.subtle.digest(algo, data);
      if (currentJob !== jobId) {
        return;
      }
      result = { status: "ready", value: toHex(hashBuffer) };
    } catch (err) {
      if (currentJob !== jobId) {
        return;
      }
      result = {
        status: "error",
        message: err instanceof Error ? err.message : "Failed to generate hash.",
      };
    }
  }, 250);

  return () => clearTimeout(timer);
});

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function handleCopy(): Promise<void> {
  if (result.status !== "ready") {
    return;
  }
  const success = await copyToClipboard(result.value);
  copyStatus = success ? "Copied!" : "Copy failed";
  setTimeout(() => (copyStatus = "Copy"), 1500);
}

function handleClear(): void {
  input = "";
  result = { status: "empty" };
}

function handleSwap(): void {
  if (result.status !== "ready") {
    return;
  }
  input = result.value;
}
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex items-center gap-4">
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-600 ring-1 ring-slate-100">
        <Hash size={24} />
      </div>
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-neutral-900">Hash Tool</h1>
        <p class="text-sm font-medium text-neutral-500">Generate SHA hashes locally with Web Crypto</p>
      </div>
    </div>
  </div>

  <div class="mb-6 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm">
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex items-center gap-2 text-xs text-neutral-500">
        <ShieldCheck size={14} class="text-slate-500" />
        Runs entirely in your browser.
      </div>

      <div class="ml-auto flex flex-wrap items-center gap-2">
        <button
          onclick={handleSwap}
          class="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-slate-200 hover:text-slate-600"
          disabled={result.status !== "ready"}
        >
          <RefreshCcw size={12} />
          Swap
        </button>
        <button
          onclick={handleClear}
          class="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-red-200 hover:text-red-600"
        >
          <Trash2 size={12} />
          Clear
        </button>
        <button
          onclick={handleCopy}
          class="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-slate-200 hover:text-slate-600"
          disabled={result.status !== "ready"}
        >
          <Copy size={12} />
          {copyStatus}
        </button>
      </div>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
    <section class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Input</h2>
        {#if input}
          <span class="text-xs text-neutral-400">{input.length} chars</span>
        {/if}
      </div>
      <textarea
        rows={10}
        bind:value={input}
        placeholder="Paste text to hash..."
        class="w-full resize-y rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-500/10"
      ></textarea>
    </section>

    <section class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Algorithm</h2>
        <select
          bind:value={algorithm}
          class="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 outline-none transition focus:border-slate-400 focus:bg-white"
        >
          <option value="SHA-1">SHA-1</option>
          <option value="SHA-256">SHA-256</option>
          <option value="SHA-384">SHA-384</option>
          <option value="SHA-512">SHA-512</option>
        </select>
      </div>

      <div class="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-xs text-neutral-700 break-all min-h-[150px]">
        {#if result.status === "empty"}
          <span class="text-neutral-400">Hash output will appear here.</span>
        {:else if result.status === "error"}
          <span class="text-red-600">{result.message}</span>
        {:else}
          {result.value}
        {/if}
      </div>

      {#if result.status === "ready"}
        <div class="mt-3 flex items-center gap-2 text-xs text-emerald-600">
          <Check size={14} />
          Hash ready
        </div>
      {:else if result.status === "error"}
        <div class="mt-3 flex items-center gap-2 text-xs text-red-600">
          <AlertCircle size={14} />
          {result.message}
        </div>
      {/if}
    </section>
  </div>
</div>
