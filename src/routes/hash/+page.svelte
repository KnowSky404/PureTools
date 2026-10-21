<script lang="ts">
import { Check, Copy, FileUp, RefreshCcw, ShieldCheck, Trash2, X } from "lucide-svelte";
import { onDestroy, untrack } from "svelte";
import { copyToClipboard } from "$lib/utils/clipboard";
import {
  compareChecksum,
  HASH_ALGORITHMS,
  HASH_LENGTHS,
  type HashAlgorithm,
  type HashWorkerRequest,
  type HashWorkerResponse,
  hashText,
} from "$lib/utils/hash";

type InputMode = "text" | "file";
type HashResult =
  | { status: "empty" | "pending" | "cancelled" }
  | { status: "working"; processed: number; total: number }
  | { status: "error"; message: string }
  | { status: "ready"; value: string };

let mode = $state<InputMode>("text");
let input = $state("");
let file = $state<File | null>(null);
let fileInput = $state<HTMLInputElement>();
let algorithm = $state<HashAlgorithm>("SHA-256");
let expected = $state("");
let result = $state<HashResult>({ status: "empty" });
let copyStatus = $state("Copy");
let worker: Worker | null = null;
let jobId = 0;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let copyTimer: ReturnType<typeof setTimeout> | undefined;

const busy = $derived(result.status === "pending" || result.status === "working");
const progress = $derived(
  result.status === "working" && result.total > 0
    ? Math.floor((result.processed / result.total) * 100)
    : result.status === "ready"
      ? 100
      : 0,
);
const checksum = $derived(
  compareChecksum(expected, algorithm, result.status === "ready" ? result.value : undefined),
);

function stopTask(): void {
  jobId += 1;
  clearTimeout(debounceTimer);
  debounceTimer = undefined;
  worker?.terminate();
  worker = null;
}

function resetCopy(): void {
  clearTimeout(copyTimer);
  copyStatus = "Copy";
}

// Only source changes trigger hashing. Expected checksums and progress do not.
$effect(() => {
  const snapshot = { mode, input, algorithm, file };
  untrack(() => {
    stopTask();
    resetCopy();
    result = { status: "empty" };
    if (snapshot.mode === "text" && snapshot.input !== "") {
      result = { status: "pending" };
      const id = jobId;
      debounceTimer = setTimeout(() => {
        void calculateText(snapshot.input, snapshot.algorithm, id);
      }, 250);
    }
  });
  return stopTask;
});

onDestroy(() => {
  stopTask();
  clearTimeout(copyTimer);
});

async function calculateText(raw: string, algo: HashAlgorithm, id: number): Promise<void> {
  if (id !== jobId) {
    return;
  }
  result = { status: "working", processed: 0, total: 0 };
  try {
    const value = await hashText(raw, algo);
    if (id === jobId) {
      result = { status: "ready", value };
    }
  } catch (error) {
    if (id === jobId) {
      result = {
        status: "error",
        message: error instanceof Error ? error.message : "Failed to calculate the hash.",
      };
    }
  }
}

function finishFile(id: number, next: HashResult): void {
  if (id !== jobId) {
    return;
  }
  worker?.terminate();
  worker = null;
  result = next;
}

function calculate(): void {
  stopTask();
  resetCopy();
  const id = jobId;
  if (mode === "text") {
    void calculateText(input, algorithm, id);
    return;
  }
  if (!file) {
    return;
  }
  result = { status: "working", processed: 0, total: file.size };
  try {
    if (typeof Worker === "undefined") {
      throw new Error("Web Workers are required for file hashing in this browser.");
    }
    worker = new Worker(new URL("../../lib/workers/hash.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<HashWorkerResponse>): void => {
      const message = event.data;
      if (id !== jobId || message.id !== id) {
        return;
      }
      if (message.type === "progress") {
        result = { status: "working", processed: message.processed, total: message.total };
      } else if (message.type === "done") {
        finishFile(id, { status: "ready", value: message.value });
      } else {
        finishFile(id, { status: "error", message: message.message });
      }
    };
    worker.onerror = (event: ErrorEvent): void => {
      event.preventDefault();
      finishFile(id, {
        status: "error",
        message:
          "Unable to start the hash engine. This browser must allow Web Workers and WebAssembly.",
      });
    };
    worker.onmessageerror = (): void => {
      finishFile(id, {
        status: "error",
        message: "Unable to read the worker result. Please retry.",
      });
    };
    worker.postMessage({ id, file, algorithm } satisfies HashWorkerRequest);
  } catch (error) {
    finishFile(id, {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to start file hashing.",
    });
  }
}

function selectFiles(files: FileList | null): void {
  if (!files?.length) {
    return;
  }
  stopTask();
  if (files.length !== 1) {
    result = { status: "error", message: "Choose one file at a time." };
    return;
  }
  file = files[0];
  result = { status: "empty" };
}

function handleDrop(event: DragEvent): void {
  event.preventDefault();
  selectFiles(event.dataTransfer?.files ?? null);
}

function cancel(): void {
  stopTask();
  result = { status: "cancelled" };
}

function clear(): void {
  stopTask();
  resetCopy();
  input = "";
  file = null;
  expected = "";
  if (fileInput) {
    fileInput.value = "";
  }
  result = { status: "empty" };
}

async function handleCopy(): Promise<void> {
  if (result.status !== "ready") {
    return;
  }
  const id = jobId;
  const success = await copyToClipboard(result.value);
  if (id !== jobId) {
    return;
  }
  clearTimeout(copyTimer);
  copyStatus = success ? "Copied!" : "Copy failed — select and copy the hash manually.";
  copyTimer = setTimeout(() => {
    copyStatus = "Copy";
  }, 2500);
}

function swap(): void {
  if (result.status === "ready") {
    input = result.value;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const unit = bytes < 1024 ** 2 ? "KiB" : bytes < 1024 ** 3 ? "MiB" : "GiB";
  const divisor = unit === "KiB" ? 1024 : unit === "MiB" ? 1024 ** 2 : 1024 ** 3;
  return `${(bytes / divisor).toFixed(2)} ${unit} (${bytes.toLocaleString()} bytes)`;
}
</script>

<svelte:head>
  <title>Hash Calculator &amp; Verifier | PureTools</title>
  <meta name="description" content="Calculate and compare MD5 and SHA checksums for text and files locally in your browser." />
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <h1 class="mb-2 text-2xl font-bold text-neutral-900">Hash Calculator &amp; Verifier</h1>
  <p class="mb-6 flex items-center gap-2 text-xs text-neutral-500">
    <ShieldCheck size={14} aria-hidden="true" />
    Text and files stay in your browser. Nothing is uploaded or saved.
  </p>

  <div class="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
    <div role="group" aria-label="Input mode" class="flex gap-1 rounded-lg bg-neutral-50 p-1">
      {#each ["text", "file"] as source}
        <button
          type="button"
          aria-pressed={mode === source}
          onclick={() => { mode = source as InputMode; }}
          class="rounded-md px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-indigo-500 {mode === source ? 'bg-indigo-600 text-white' : 'text-neutral-600 hover:bg-neutral-100'}"
        >{source === "text" ? "Text" : "File"}</button>
      {/each}
    </div>
    <label for="hash-algorithm" class="text-xs font-semibold text-neutral-500">Algorithm</label>
    <select
      id="hash-algorithm"
      bind:value={algorithm}
      class="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 focus-visible:outline-2 focus-visible:outline-indigo-500"
    >
      {#each HASH_ALGORITHMS as algo}
        <option value={algo}>{algo}</option>
      {/each}
    </select>
    <button type="button" onclick={clear} class="ml-auto flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-600 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-indigo-500">
      <Trash2 size={14} aria-hidden="true" />Clear
    </button>
  </div>

  <div class="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
    <section aria-labelledby="hash-input-heading" class="min-w-0 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="hash-input-heading" class="text-xs font-semibold uppercase tracking-wider text-neutral-500">{mode === "text" ? "Text input" : "Local file"}</h2>
        <div class="flex gap-2">
          {#if busy}
            <button type="button" onclick={cancel} class="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-600 focus-visible:outline-2 focus-visible:outline-indigo-500"><X size={14} aria-hidden="true" />Cancel</button>
          {/if}
          <button
            type="button"
            onclick={calculate}
            disabled={busy || (mode === "file" && !file)}
            class="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >Calculate</button>
        </div>
      </div>
      {#if mode === "text"}
        <label for="hash-text" class="sr-only">Text to hash</label>
        <textarea
          id="hash-text"
          rows={10}
          bind:value={input}
          placeholder="Paste text to hash..."
          class="w-full resize-y rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
        ></textarea>
        <p class="mt-2 text-xs text-neutral-500">Exact UTF-8, including spaces and line breaks. Calculate also supports empty text.</p>
      {:else}
        <div
          role="group"
          aria-label="File drop area"
          ondragover={(event) => event.preventDefault()}
          ondrop={handleDrop}
          class="rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-5"
        >
          <FileUp size={24} aria-hidden="true" class="mb-3 text-neutral-400" />
          <label for="hash-file" class="mb-3 block text-sm text-neutral-600">Drop one file here, or choose a file</label>
          <input
            id="hash-file"
            type="file"
            bind:this={fileInput}
            onchange={(event) => selectFiles(event.currentTarget.files)}
            class="block w-full min-w-0 text-xs text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:font-semibold file:text-white focus-visible:outline-2 focus-visible:outline-indigo-500"
          />
          {#if file}
            <div class="mt-5 space-y-1 text-sm">
              <p class="break-all font-semibold text-neutral-900">{file.name}</p>
              <p class="text-xs text-neutral-500">{formatSize(file.size)}</p>
            </div>
          {/if}
        </div>
        {#if result.status === "working" || result.status === "ready"}
          <label for="hash-progress" class="mt-4 block text-xs text-neutral-500">File progress: {progress}%</label>
          <progress id="hash-progress" max="100" value={progress} class="mt-2 h-2 w-full accent-indigo-600">{progress}%</progress>
          {#if result.status === "working"}
            <p class="mt-2 text-xs text-neutral-500">{formatSize(result.processed)} of {formatSize(result.total)}</p>
          {/if}
        {/if}
        <p class="mt-3 text-xs text-neutral-500">Raw bytes, including empty or binary files. Read in 4 MiB chunks.</p>
      {/if}
    </section>

    <section aria-labelledby="hash-output-heading" aria-busy={busy} class="min-w-0 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 id="hash-output-heading" class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Result · {algorithm}</h2>
        <div class="flex gap-2">
          {#if mode === "text"}
            <button type="button" onclick={swap} disabled={result.status !== "ready"} aria-label="Swap hash into text" class="rounded-lg p-2 text-neutral-500 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-40"><RefreshCcw size={14} aria-hidden="true" /></button>
          {/if}
          <button type="button" onclick={handleCopy} disabled={result.status !== "ready"} aria-label="Copy hash" class="rounded-lg border border-neutral-200 p-2 text-neutral-600 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-40"><Copy size={14} aria-hidden="true" /></button>
        </div>
      </div>
      <output aria-label="Hash result" class="block min-h-[120px] whitespace-pre-wrap break-all rounded-xl border border-neutral-200 bg-neutral-50 p-4 font-mono text-sm text-neutral-700 select-all">{result.status === "ready" ? result.value : ""}</output>
      <div role="status" class="mt-3 min-h-6 text-xs text-neutral-500">
        {#if result.status === "ready"}
          <span class="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400"><Check size={14} aria-hidden="true" />Hash ready</span>
        {:else if result.status === "pending"}Waiting for typing to finish…
        {:else if result.status === "working"}Calculating…
        {:else if result.status === "cancelled"}Cancelled. Calculate to retry.
        {:else if result.status === "empty"}{mode === "file" && file ? "Ready to calculate." : "Hash output will appear here."}
        {/if}
      </div>
      {#if result.status === "error"}
        <p role="alert" class="mt-2 text-sm text-red-600 dark:text-red-400">{result.message}</p>
      {/if}
      {#if copyStatus !== "Copy"}
        <p role="status" class="mt-2 text-xs text-neutral-600">{copyStatus}</p>
      {/if}
      <div class="mt-5 border-t border-neutral-200 pt-4">
        <label for="expected-hash" class="mb-2 block text-xs font-semibold text-neutral-500">Expected Hash (optional)</label>
        <input
          id="expected-hash"
          type="text"
          bind:value={expected}
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          aria-invalid={checksum === "invalid"}
          aria-describedby="checksum-status"
          placeholder={`${HASH_LENGTHS[algorithm]} hexadecimal characters`}
          class="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
        />
        <p id="checksum-status" role="status" class="mt-2 min-h-5 text-xs {checksum === 'match' ? 'text-emerald-700 dark:text-emerald-400' : checksum === 'invalid' || checksum === 'mismatch' ? 'text-red-600 dark:text-red-400' : 'text-neutral-500'}">
          {#if checksum === "match"}Match
          {:else if checksum === "mismatch"}Mismatch
          {:else if checksum === "invalid"}Invalid checksum — expected {HASH_LENGTHS[algorithm]} hexadecimal characters.
          {:else if checksum === "pending"}Calculate a hash to compare.
          {/if}
        </p>
      </div>
    </section>
  </div>
  <p class="mt-4 text-xs leading-relaxed text-neutral-500">A matching hash does not establish a trusted source. MD5 has collision weaknesses: do not use it for password storage, security signatures or protection against malicious tampering. Prefer SHA-256.</p>
</div>
