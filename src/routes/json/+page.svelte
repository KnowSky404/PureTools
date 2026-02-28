<script lang="ts">
import {
  Braces,
  Check,
  Code,
  Copy,
  FileJson,
  Highlighter,
  Maximize2,
  Minimize2,
  Trash2,
  Type,
} from "lucide-svelte";
import { copyToClipboard } from "$lib/utils/clipboard";

type FormatMode = "format" | "minify" | "escape" | "unescape";
type IndentSize = 2 | 4;

let input = $state("");
let output = $state("");
let error = $state("");
let mode = $state<FormatMode>("format");
let indent = $state<IndentSize>(2);
let copyStatus = $state("Copy");
let highlightOutput = $state(true);
let inputEl = $state<HTMLTextAreaElement | null>(null);
let inputLinesWrap = $state<HTMLDivElement | null>(null);
let outputScrollEl = $state<HTMLDivElement | null>(null);
let outputLinesWrap = $state<HTMLDivElement | null>(null);

const inputStats = $derived.by(() => {
  if (!input) {
    return { chars: 0, lines: 0 };
  }
  return { chars: input.length, lines: input.split("\n").length };
});

const outputStats = $derived.by(() => {
  if (!output) {
    return { chars: 0, lines: 0 };
  }
  return { chars: output.length, lines: output.split("\n").length };
});

const inputLineCount = $derived.by(() => Math.max(1, input.split("\n").length));
const outputLineCount = $derived.by(() => Math.max(1, output.split("\n").length));
const inputLineNumbers = $derived.by(() => buildLineNumbers(inputLineCount));
const outputLineNumbers = $derived.by(() => buildLineNumbers(outputLineCount));

const highlightedOutput = $derived.by(() => {
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
      if (currentMode === "unescape") {
        const parsed = JSON.parse(value);
        if (typeof parsed !== "string") {
          throw new Error("Unescape expects a JSON string value.");
        }
        const unescaped = parsed;
        try {
          const decodedJson = JSON.parse(unescaped);
          output = JSON.stringify(decodedJson, null, spaces);
        } catch {
          output = unescaped;
        }
        error = "";
      } else {
        const parsed = JSON.parse(value);
        const normalized =
          currentMode === "format" ? JSON.stringify(parsed, null, spaces) : JSON.stringify(parsed);
        output = currentMode === "escape" ? JSON.stringify(normalized) : normalized;
        error = "";
      }
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

function syncInputScroll() {
  if (!inputEl || !inputLinesWrap) {
    return;
  }
  inputLinesWrap.scrollTop = inputEl.scrollTop;
}

function syncOutputScroll() {
  if (!outputScrollEl || !outputLinesWrap) {
    return;
  }
  outputLinesWrap.scrollTop = outputScrollEl.scrollTop;
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
  "features": ["format", "minify", "escape", "unescape", "validate"],
  "meta": { "source": "browser", "fast": true }
}`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function buildLineNumbers(total: number): string {
  return Array.from({ length: total }, (_, index) => `${index + 1}`).join("\n");
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

    let className = "text-neutral-700";
    if (token.startsWith('"')) {
      className = isKey ? "text-indigo-600 font-medium" : "text-emerald-600";
    } else if (token === "true" || token === "false" || token === "null") {
      className = "text-rose-600 font-medium";
    } else {
      className = "text-amber-600";
    }

    result += `<span class="${className}">${escapeHtml(token)}</span>`;
    lastIndex = end;
  }

  result += escapeHtml(value.slice(lastIndex));
  return result;
}
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <!-- Header Section -->
  <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex items-center gap-4">
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
        <Braces size={24} />
      </div>
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-neutral-900">JSON Formatter</h1>
        <p class="text-sm text-neutral-500 font-medium">Format, minify, escape, and validate JSON</p>
      </div>
    </div>
  </div>

  <!-- Toolbar -->
  <div class="mb-6 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm">
    <div class="flex flex-wrap items-center gap-1.5">
      <div class="flex items-center rounded-xl bg-neutral-100 p-1">
        <button
          onclick={() => (mode = "format")}
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all
          {mode === 'format' ? 'bg-white text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}"
        >
          <Maximize2 size={14} />
          Format
        </button>
        <button
          onclick={() => (mode = "minify")}
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all
          {mode === 'minify' ? 'bg-white text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}"
        >
          <Minimize2 size={14} />
          Minify
        </button>
        <button
          onclick={() => (mode = "escape")}
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all
          {mode === 'escape' ? 'bg-white text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}"
        >
          <Code size={14} />
          Escape
        </button>
        <button
          onclick={() => (mode = "unescape")}
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all
          {mode === 'unescape' ? 'bg-white text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}"
        >
          <Type size={14} />
          Unescape
        </button>
      </div>

      <div class="h-6 w-px bg-neutral-200 mx-1"></div>

      <div class="flex items-center gap-2">
        <select
          value={indent}
          onchange={handleIndentChange}
          class="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 outline-none hover:border-neutral-300 focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-50"
          disabled={mode === "minify" || mode === "escape"}
        >
          <option value={2}>2 Spaces</option>
          <option value={4}>4 Spaces</option>
        </select>

        <button
          onclick={handleHighlightToggle}
          class="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 transition-all hover:bg-neutral-50
          {highlightOutput ? 'border-indigo-200 bg-indigo-50/50 text-indigo-600' : ''}"
        >
          <Highlighter size={14} />
          {highlightOutput ? "Highlight On" : "Highlight Off"}
        </button>
      </div>

      <div class="h-6 w-px bg-neutral-200 mx-1 hidden sm:block"></div>

      <div class="flex items-center gap-1.5">
        <button
          onclick={handleExample}
          class="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 transition-all hover:bg-neutral-50"
        >
          <FileJson size={14} />
          Example
        </button>
        <button
          onclick={handleClear}
          class="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 transition-all hover:bg-neutral-50 hover:text-red-600"
        >
          <Trash2 size={14} />
          Clear
        </button>
      </div>

      <button
        onclick={handleCopy}
        disabled={!output}
        class="ml-auto flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:opacity-50"
      >
        {#if copyStatus === "Copied!"}
          <Check size={14} />
        {:else}
          <Copy size={14} />
        {/if}
        {copyStatus}
      </button>
    </div>
  </div>

  <!-- Editor Section -->
  <div class="grid gap-6 lg:grid-cols-2 lg:h-[calc(100vh-300px)] lg:min-h-0 min-h-[600px]">
    <!-- Input Panel -->
    <div class="flex flex-col gap-2 h-full min-h-0">
      <div class="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400 shrink-0">
        <span class="flex items-center gap-1.5">
          <span class="h-1.5 w-1.5 rounded-full {error ? 'bg-red-500' : input.trim() ? 'bg-green-500' : 'bg-neutral-300'}"></span>
          Input JSON
        </span>
        <span>{inputStats.lines} lines · {inputStats.chars} chars</span>
      </div>
      <div class="flex flex-1 min-h-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all focus-within:ring-4 focus-within:ring-indigo-500/5 focus-within:border-indigo-500/50">
        <div class="w-12 shrink-0 border-r border-neutral-100 bg-neutral-50/50 text-neutral-400 select-none">
          <div
            class="h-full overflow-hidden px-2 py-4 font-mono text-[11px] leading-6 text-right"
            bind:this={inputLinesWrap}
          >
            <pre class="whitespace-pre">{inputLineNumbers}</pre>
          </div>
        </div>
        <textarea
          bind:this={inputEl}
          bind:value={input}
          placeholder="Paste JSON here..."
          onscroll={syncInputScroll}
          class="flex-1 min-h-0 resize-none bg-transparent px-4 py-4 font-mono text-sm leading-6 text-neutral-900 outline-none placeholder:text-neutral-300"
        ></textarea>
      </div>
      {#if error}
        <div class="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 ring-1 ring-red-100 shrink-0">
          <Trash2 size={14} />
          {error}
        </div>
      {/if}
    </div>

    <!-- Output Panel -->
    <div class="flex flex-col gap-2 h-full min-h-0">
      <div class="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400 shrink-0">
        <span>Output</span>
        <span>{outputStats.lines} lines · {outputStats.chars} chars</span>
      </div>
      <div class="flex flex-1 min-h-0 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50/50 shadow-sm">
        <div class="w-12 shrink-0 border-r border-neutral-100 bg-neutral-100/50 text-neutral-400 select-none">
          <div
            class="h-full overflow-hidden px-2 py-4 font-mono text-[11px] leading-6 text-right"
            bind:this={outputLinesWrap}
          >
            <pre class="whitespace-pre">{outputLineNumbers}</pre>
          </div>
        </div>
        <div
          class="flex-1 min-h-0 overflow-auto px-4 py-4 font-mono text-sm leading-6 text-neutral-900"
          bind:this={outputScrollEl}
          onscroll={syncOutputScroll}
        >
          {#if output}
            {#if highlightOutput}
              <pre class="whitespace-pre break-all"><code>{@html highlightedOutput}</code></pre>
            {:else}
              <pre class="whitespace-pre break-all">{output}</pre>
            {/if}
          {:else}
            <div class="flex h-full items-center justify-center text-neutral-300">
              <div class="flex flex-col items-center gap-2">
                <FileJson size={32} class="opacity-20" />
                <p class="text-xs font-bold">Output will appear here</p>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
