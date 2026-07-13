<script lang="ts">
import { AlertCircle, Check, Download, LoaderCircle, ShieldCheck, Trash2 } from "lucide-svelte";

type QrResult =
  | { status: "empty" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; dataUrl: string };

let input = $state("");
let result = $state<QrResult>({ status: "empty" });
let jobId = 0;

$effect(() => {
  const raw = input;
  const currentJob = ++jobId;

  if (raw === "") {
    result = { status: "empty" };
    return;
  }

  const timer = setTimeout(async () => {
    result = { status: "loading" };

    try {
      const { toDataURL } = await import("qrcode");
      const dataUrl = await toDataURL(raw, {
        errorCorrectionLevel: "M",
        margin: 4,
        type: "image/png",
        width: 640,
      });

      if (currentJob !== jobId) {
        return;
      }
      result = { status: "ready", dataUrl };
    } catch (error) {
      if (currentJob !== jobId) {
        return;
      }
      result = {
        status: "error",
        message: error instanceof Error ? error.message : "Failed to generate QR code.",
      };
    }
  }, 250);

  return () => clearTimeout(timer);
});

function handleClear(): void {
  input = "";
}

function handleDownload(): void {
  if (result.status !== "ready") {
    return;
  }

  const link = document.createElement("a");
  link.href = result.dataUrl;
  link.download = "qrcode.png";
  link.click();
}
</script>

<svelte:head>
  <title>QR Code Generator | PureTools</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <div class="mb-6 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm">
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex items-center gap-2 text-xs text-neutral-500">
        <ShieldCheck size={14} class="text-fuchsia-500" />
        Runs entirely in your browser.
      </div>

      <div class="ml-auto flex items-center gap-2">
        <button
          type="button"
          onclick={handleClear}
          disabled={input === ""}
          class="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 size={12} />
          Clear
        </button>
        <button
          type="button"
          onclick={handleDownload}
          disabled={result.status !== "ready"}
          class="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-fuchsia-200 hover:text-fuchsia-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download size={12} />
          Download PNG
        </button>
      </div>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
    <section class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div class="mb-2 flex items-center justify-between gap-4">
        <label for="qr-input" class="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Input
        </label>
        {#if input !== ""}
          <span class="text-xs text-neutral-400">{input.length} chars</span>
        {/if}
      </div>
      <textarea
        id="qr-input"
        rows={14}
        bind:value={input}
        spellcheck="false"
        placeholder="Enter text to encode..."
        class="min-h-80 w-full resize-y rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition focus:border-fuchsia-400 focus:bg-white focus:ring-4 focus:ring-fuchsia-500/10"
      ></textarea>
    </section>

    <section class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">QR Code</h2>

      <div class="flex min-h-80 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 p-5">
        {#if result.status === "empty"}
          <span class="text-center text-sm text-neutral-400">QR code will appear here.</span>
        {:else if result.status === "loading"}
          <div class="flex items-center gap-2 text-sm text-neutral-500">
            <LoaderCircle size={18} class="animate-spin text-fuchsia-500" />
            Generating...
          </div>
        {:else if result.status === "error"}
          <div class="flex max-w-sm items-start gap-2 text-sm text-red-600">
            <AlertCircle size={18} class="mt-0.5 shrink-0" />
            <span>{result.message}</span>
          </div>
        {:else}
          <img
            src={result.dataUrl}
            alt="Generated QR code"
            width="320"
            height="320"
            class="aspect-square w-full max-w-80 rounded-lg bg-white"
          />
        {/if}
      </div>

      {#if result.status === "ready"}
        <div class="mt-3 flex items-center gap-2 text-xs text-emerald-600">
          <Check size={14} />
          QR code ready
        </div>
      {:else if result.status === "error"}
        <div class="mt-3 flex items-center gap-2 text-xs text-red-600">
          <AlertCircle size={14} />
          Unable to generate QR code
        </div>
      {/if}
    </section>
  </div>
</div>
