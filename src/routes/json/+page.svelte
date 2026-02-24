<script lang="ts">
import { copyToClipboard } from "$lib/utils/clipboard";

type FormatMode = "format" | "minify" | "escape";
type IndentSize = 2 | 4;

let input = $state("");
let output = $state("");
let error = $state("");
let mode = $state<FormatMode>("format");
let indent = $state<IndentSize>(2);
let copyStatus = $state("Copy");
let highlightOutput = $state(true);

const inputStats = $derived(() => {
  if (!input) {
    return { chars: 0, lines: 0 };
  }
  return { chars: input.length, lines: input.split("\n").length };
});

const outputStats = $derived(() => {
  if (!output) {
    return { chars: 0, lines: 0 };
  }
  return { chars: output.length, lines: output.split("\n").length };
});

const highlightedOutput = $derived(() => {
  if (!output || !highlightOutput) {
    return "";
  }
  return highlightJson(output);
});

$effect(() => {
  const value = input.trim();
  const currentMode = mode;
  const spaces = indent;

  const timer = setTimeout(() => {
    if (!value) {
      output = "";
      error = "";
      return;
    }

    try {
      const parsed = JSON.parse(value);
      const normalized =
        currentMode === "format" ? JSON.stringify(parsed, null, spaces) : JSON.stringify(parsed);
      output = currentMode === "escape" ? JSON.stringify(normalized) : normalized;
      error = "";
    } catch (err) {
      output = "";
      error = err instanceof Error ? err.message : "Invalid JSON";
    }
  }, 250);

  return () => clearTimeout(timer);
});

function handleIndentChange(event: Event) {
  const value = Number((event.currentTarget as HTMLSelectElement).value);
  indent = value === 4 ? 4 : 2;
}

function handleHighlightToggle() {
  highlightOutput = !highlightOutput;
}

async function handleCopy() {
  if (!output) {
    return;
  }
  const success = await copyToClipboard(output);
  copyStatus = success ? "Copied!" : "Copy failed";
  setTimeout(() => (copyStatus = "Copy"), 1500);
}

function handleClear() {
  input = "";
  output = "";
  error = "";
}

function handleExample() {
  input = `{
  "name": "PureTools",
  "version": "0.1.0",
  "features": ["format", "minify", "validate"],
  "meta": { "source": "browser", "fast": true }
}`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function highlightJson(value: string): string {
  const tokenRegex = /"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  let result = "";
  let lastIndex = 0;

  for (const match of value.matchAll(tokenRegex)) {
    const start = match.index ?? 0;
    const token = match[0];
    const end = start + token.length;

    result += escapeHtml(value.slice(lastIndex, start));
    const nextNonSpace = value.slice(end).match(/\S/);
    const isKey = token.startsWith('"') && nextNonSpace?.[0] === ":";

    let className = "text-slate-700";
    if (token.startsWith('"')) {
      className = isKey ? "text-indigo-600" : "text-emerald-700";
    } else if (token === "true" || token === "false" || token === "null") {
      className = "text-rose-600";
    } else {
      className = "text-sky-600";
    }

    result += `<span class="${className}">${escapeHtml(token)}</span>`;
    lastIndex = end;
  }

  result += escapeHtml(value.slice(lastIndex));
  return result;
}
</script>

<div class="mx-auto max-w-5xl p-6">
  <div class="mb-8 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-slate-900">JSON Formatter</h1>
      <p class="text-slate-500">
        Format, minify, escape, and validate JSON in your browser.
      </p>
    </div>
    <a href="/" class="text-sm font-medium text-indigo-600 hover:text-indigo-500">
      ← Back to Tools
    </a>
  </div>

  <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onclick={() => (mode = "format")}
        class="rounded-lg px-3 py-2 text-xs font-semibold transition-colors
        {mode === 'format' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}"
      >
        Format
      </button>
      <button
        type="button"
        onclick={() => (mode = "minify")}
        class="rounded-lg px-3 py-2 text-xs font-semibold transition-colors
        {mode === 'minify' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}"
      >
        Minify
      </button>
      <button
        type="button"
        onclick={() => (mode = "escape")}
        class="rounded-lg px-3 py-2 text-xs font-semibold transition-colors
        {mode === 'escape' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}"
      >
        Escape
      </button>
      <select
        value={indent}
        onchange={handleIndentChange}
        class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
        disabled={mode !== "format"}
      >
        <option value={2}>2 spaces</option>
        <option value={4}>4 spaces</option>
      </select>
      <button
        type="button"
        onclick={handleHighlightToggle}
        class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        {highlightOutput ? "Highlight On" : "Highlight Off"}
      </button>
      <button
        type="button"
        onclick={handleExample}
        class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        Use Example
      </button>
      <button
        type="button"
        onclick={handleClear}
        class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        Clear
      </button>
      <button
        type="button"
        onclick={handleCopy}
        class="ml-auto rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        disabled={!output}
      >
        {copyStatus}
      </button>
    </div>
  </div>

  <div class="mt-6 grid gap-6 lg:grid-cols-2">
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between text-xs text-slate-500">
        <span>Input</span>
        <span>{inputStats.lines} lines · {inputStats.chars} chars</span>
      </div>
      <textarea
        bind:value={input}
        placeholder="Paste JSON here..."
        class="min-h-[320px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      ></textarea>
      {#if error}
        <p class="text-sm font-medium text-red-600">{error}</p>
      {:else if input.trim()}
        <p class="text-sm font-medium text-green-600">Valid JSON</p>
      {/if}
    </div>

    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between text-xs text-slate-500">
        <span>Output</span>
        <span>{outputStats.lines} lines · {outputStats.chars} chars</span>
      </div>
      <div class="min-h-[320px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-900 shadow-sm">
        {#if output}
          {#if highlightOutput}
            <pre class="whitespace-pre-wrap break-words"><code>{@html highlightedOutput}</code></pre>
          {:else}
            <pre class="whitespace-pre-wrap break-words">{output}</pre>
          {/if}
        {:else}
          <p class="text-slate-400">Formatted JSON will appear here...</p>
        {/if}
      </div>
    </div>
  </div>
</div>
