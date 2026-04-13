<script lang="ts">
import { AlertCircle, Check, Copy, RefreshCcw, Trash2 } from "lucide-svelte";
import { copyToClipboard } from "$lib/utils/clipboard";

type Mode = "encode" | "decode";

type Scope = "component" | "full";

let mode = $state<Mode>("encode");
let scope = $state<Scope>("component");
let input = $state("");
let output = $state("");
let error = $state("");
let copyStatus = $state("Copy");

$effect(() => {
  const raw = input;
  const currentMode = mode;
  const currentScope = scope;

  const timer = setTimeout(() => {
    if (!raw) {
      output = "";
      error = "";
      return;
    }

    try {
      if (currentMode === "encode") {
        output = currentScope === "component" ? encodeURIComponent(raw) : encodeURI(raw);
      } else {
        output = currentScope === "component" ? decodeURIComponent(raw) : decodeURI(raw);
      }
      error = "";
    } catch (err) {
      output = "";
      error = err instanceof Error ? err.message : "Invalid URL encoding.";
    }
  }, 250);

  return () => clearTimeout(timer);
});

async function handleCopy(): Promise<void> {
  if (!output) {
    return;
  }
  const success = await copyToClipboard(output);
  copyStatus = success ? "Copied!" : "Copy failed";
  setTimeout(() => (copyStatus = "Copy"), 1500);
}

function handleClear(): void {
  input = "";
  output = "";
  error = "";
}

function handleSwap(): void {
  if (!output) {
    return;
  }
  input = output;
}
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <div class="mb-6 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm">
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex items-center rounded-xl bg-neutral-100 p-1">
        <button
          onclick={() => (mode = "encode")}
          class="rounded-lg px-3 py-1.5 text-xs font-bold transition-all
          {mode === 'encode' ? 'bg-white text-teal-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}"
        >
          Encode
        </button>
        <button
          onclick={() => (mode = "decode")}
          class="rounded-lg px-3 py-1.5 text-xs font-bold transition-all
          {mode === 'decode' ? 'bg-white text-teal-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}"
        >
          Decode
        </button>
      </div>

      <div class="flex items-center rounded-xl bg-neutral-100 p-1">
        <button
          onclick={() => (scope = "component")}
          class="rounded-lg px-3 py-1.5 text-xs font-bold transition-all
          {scope === 'component' ? 'bg-white text-teal-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}"
        >
          Component
        </button>
        <button
          onclick={() => (scope = "full")}
          class="rounded-lg px-3 py-1.5 text-xs font-bold transition-all
          {scope === 'full' ? 'bg-white text-teal-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}"
        >
          Full URL
        </button>
      </div>

      <div class="ml-auto flex flex-wrap items-center gap-2">
        <button
          onclick={handleSwap}
          class="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-teal-200 hover:text-teal-600"
          disabled={!output}
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
          class="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-teal-200 hover:text-teal-600"
          disabled={!output}
        >
          <Copy size={12} />
          {copyStatus}
        </button>
      </div>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-2">
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
        placeholder="Paste URL or text here..."
        class="w-full resize-y rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
      ></textarea>
      <div class="mt-3 text-xs text-neutral-400">
        {mode === "encode" ? "Input will be URL-encoded." : "Input will be URL-decoded."}
      </div>
    </section>

    <section class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Output</h2>
        {#if output}
          <span class="text-xs text-neutral-400">{output.length} chars</span>
        {/if}
      </div>
      <textarea
        rows={10}
        readonly
        value={output}
        placeholder="Result will appear here..."
        class="w-full resize-y rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 outline-none"
      ></textarea>

      {#if error}
        <div class="mt-3 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertCircle size={14} class="mt-0.5" />
          {error}
        </div>
      {:else if output}
        <div class="mt-3 flex items-center gap-2 text-xs text-emerald-600">
          <Check size={14} />
          Output ready
        </div>
      {/if}
    </section>
  </div>
</div>
