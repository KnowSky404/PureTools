<script lang="ts">
import { AlertCircle, Binary, Check, Copy, RefreshCcw, Trash2 } from "lucide-svelte";
import { copyToClipboard } from "$lib/utils/clipboard";

type Mode = "encode" | "decode";

type Variant = "standard" | "url";

let mode = $state<Mode>("encode");
let variant = $state<Variant>("standard");
let input = $state("");
let output = $state("");
let error = $state("");
let copyStatus = $state("Copy");

$effect(() => {
  const raw = input;
  const currentMode = mode;
  const currentVariant = variant;

  const timer = setTimeout(() => {
    if (!raw) {
      output = "";
      error = "";
      return;
    }

    try {
      if (currentMode === "encode") {
        const encoded = encodeBase64(raw);
        output = currentVariant === "url" ? toBase64Url(encoded) : encoded;
      } else {
        const normalized = currentVariant === "url" ? fromBase64Url(raw) : raw;
        output = decodeBase64(normalized);
      }
      error = "";
    } catch (err) {
      output = "";
      error = err instanceof Error ? err.message : "Invalid Base64 string.";
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

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeBase64(value: string): string {
  const normalized = value.replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function toBase64Url(value: string): string {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  let normalized = value.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  if (padding) {
    normalized += "=".repeat(4 - padding);
  }
  return normalized;
}
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex items-center gap-4">
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
        <Binary size={24} />
      </div>
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-neutral-900">Base64 Tool</h1>
        <p class="text-sm font-medium text-neutral-500">Encode or decode Base64 strings safely</p>
      </div>
    </div>
  </div>

  <div class="mb-6 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm">
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex items-center rounded-xl bg-neutral-100 p-1">
        <button
          onclick={() => (mode = "encode")}
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all
          {mode === 'encode' ? 'bg-white text-sky-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}"
        >
          Encode
        </button>
        <button
          onclick={() => (mode = "decode")}
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all
          {mode === 'decode' ? 'bg-white text-sky-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}"
        >
          Decode
        </button>
      </div>

      <div class="flex items-center rounded-xl bg-neutral-100 p-1">
        <button
          onclick={() => (variant = "standard")}
          class="rounded-lg px-3 py-1.5 text-xs font-bold transition-all
          {variant === 'standard' ? 'bg-white text-sky-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}"
        >
          Standard
        </button>
        <button
          onclick={() => (variant = "url")}
          class="rounded-lg px-3 py-1.5 text-xs font-bold transition-all
          {variant === 'url' ? 'bg-white text-sky-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}"
        >
          URL Safe
        </button>
      </div>

      <div class="ml-auto flex flex-wrap items-center gap-2">
        <button
          onclick={handleSwap}
          class="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-sky-200 hover:text-sky-600"
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
          class="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-sky-200 hover:text-sky-600"
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
        placeholder="Paste text or Base64 here..."
        class="w-full resize-y rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-500/10"
      ></textarea>
      <div class="mt-3 text-xs text-neutral-400">
        {mode === "encode"
          ? "Input will be encoded to Base64."
          : "Input will be decoded as Base64."}
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
