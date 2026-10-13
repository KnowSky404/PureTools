<script lang="ts">
import {
  Check,
  Clipboard,
  Code2,
  Download,
  FileText,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-svelte";
import { onMount } from "svelte";
import { copyToClipboard } from "$lib/utils/clipboard";
import {
  COMPREHENSIVE_MARKDOWN_EXAMPLE,
  DEFAULT_MARKDOWN_EXAMPLE,
} from "$lib/utils/markdown/example";
import type { MermaidRenderer } from "$lib/utils/markdown/mermaid-renderer";
import { createRenderSession } from "$lib/utils/markdown/session";
import { LIMITS } from "$lib/utils/markdown/types";

type Mode = "enhanced" | "commonmark";
type Theme = "light" | "dark";
type View = "edit" | "split" | "preview";
type RenderResult = { document: string; warnings: string[] };
type MermaidRendererModule = typeof import("$lib/utils/markdown/mermaid-renderer");
type RenderMarkdown = (
  source: string,
  mode: Mode,
  theme: Theme,
  renderer: MermaidRenderer | null,
  isCurrent?: () => boolean,
) => Promise<RenderResult>;

const MAX_INPUT_BYTES = LIMITS.maxInputBytes;
const AUTO_RENDER_BYTES = LIMITS.manualRenderThresholdBytes;
const RENDER_DELAY_MS = 300;
function makeEmptyPreviewDocument(currentTheme: Theme): string {
  const colors =
    currentTheme === "dark"
      ? { background: "#171717", color: "#a3a3a3", strong: "#f5f5f5", scheme: "dark" }
      : { background: "#fff", color: "#525252", strong: "#262626", scheme: "light" };
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-src 'none'; img-src 'none'; object-src 'none'; connect-src 'none'" />
    <style>
      :root { color-scheme: ${colors.scheme}; font-family: ui-sans-serif, system-ui, sans-serif; color: ${colors.color}; background: ${colors.background}; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; padding: 24px; }
      main { display: grid; min-height: calc(100vh - 48px); place-content: center; gap: 6px; text-align: center; }
      strong { color: ${colors.strong}; font-size: 14px; }
      span { font-size: 12px; }
    </style>
  </head>
  <body><main><strong>Preview is empty</strong><span>Write Markdown on the left to render it here.</span></main></body>
</html>`;
}

const EMPTY_PREVIEW_DOCUMENT = makeEmptyPreviewDocument("light");

let source = $state(DEFAULT_MARKDOWN_EXAMPLE);
let mode = $state<Mode>("enhanced");
let theme = $state<Theme>("light");
let activeView = $state<View>("split");
let previewDocument = $state(EMPTY_PREVIEW_DOCUMENT);
let warnings = $state<string[]>([]);
let renderError = $state("");
let isRendering = $state(false);
let isComposing = $state(false);
let manualRefreshNeeded = $state(false);
let copied = $state(false);
let copyError = $state("");
let importError = $state("");
let fileInput = $state<HTMLInputElement | null>(null);

const session = createRenderSession();
let renderTimer: ReturnType<typeof setTimeout> | null = null;
let copyTimer: ReturnType<typeof setTimeout> | null = null;
let downloadTimer: ReturnType<typeof setTimeout> | null = null;
let renderMarkdown: RenderMarkdown | null = null;
let actualMermaidRenderer: MermaidRenderer | null = null;
let mermaidRendererPromise: Promise<MermaidRenderer | null> | null = null;
let mermaidImportAttempt = 0;
let rendererDisposed = false;
let lazyMermaidRenderer: MermaidRenderer | null = createLazyMermaidRenderer();
const objectUrls = new Set<string>();

const inputStats = $derived.by(() => ({
  chars: source.length,
  lines: source ? source.split("\n").length : 0,
  bytes: getByteLength(source),
}));

const tooLarge = $derived(inputStats.bytes > MAX_INPUT_BYTES);

const statusLabel = $derived.by(() => {
  if (renderError) {
    return "Preview failed";
  }
  if (tooLarge) {
    return "Input is too large";
  }
  if (manualRefreshNeeded) {
    return "Large document — refresh when ready";
  }
  if (isRendering) {
    return "Rendering locally…";
  }
  if (warnings.length > 0) {
    return `${warnings.length} warning${warnings.length === 1 ? "" : "s"}`;
  }
  return "Preview up to date";
});

onMount(() => {
  const updateTheme = (): void => {
    const nextTheme: Theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    if (nextTheme === theme) {
      return;
    }
    theme = nextTheme;
    previewDocument = makeEmptyPreviewDocument(theme);
    invalidateAndSchedule();
  };

  updateTheme();
  const observer = new MutationObserver(updateTheme);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  invalidateAndSchedule(0);

  return () => {
    observer.disconnect();
    if (renderTimer) {
      clearTimeout(renderTimer);
    }
    if (copyTimer) {
      clearTimeout(copyTimer);
    }
    if (downloadTimer) {
      clearTimeout(downloadTimer);
    }
    rendererDisposed = true;
    lazyMermaidRenderer?.dispose();
    for (const objectUrl of objectUrls) {
      URL.revokeObjectURL(objectUrl);
    }
    objectUrls.clear();
    session.invalidate();
  };
});

function getByteLength(value: string): number {
  if (typeof TextEncoder === "undefined") {
    return value.length;
  }
  return new TextEncoder().encode(value).byteLength;
}

function invalidateAndSchedule(delay = RENDER_DELAY_MS, force = false): void {
  const version = session.invalidate();
  renderError = "";
  warnings = [];
  isRendering = false;
  if (renderTimer) {
    clearTimeout(renderTimer);
    renderTimer = null;
  }
  if (tooLarge || (!force && inputStats.bytes > AUTO_RENDER_BYTES)) {
    manualRefreshNeeded = true;
    previewDocument = makeEmptyPreviewDocument(theme);
    return;
  }
  manualRefreshNeeded = false;
  if (delay === 0) {
    void render(version);
    return;
  }
  if (isComposing) {
    return;
  }
  renderTimer = setTimeout(() => {
    renderTimer = null;
    void render(version);
  }, delay);
}

async function render(version: number): Promise<void> {
  if (!session.isCurrent(version) || tooLarge) {
    return;
  }
  isRendering = true;
  renderError = "";
  try {
    if (!renderMarkdown) {
      const module = await import("$lib/utils/markdown/render");
      renderMarkdown = module.renderMarkdown as RenderMarkdown;
    }
    if (!session.isCurrent(version)) {
      return;
    }
    const renderer = mode === "enhanced" ? lazyMermaidRenderer : null;
    if (!session.isCurrent(version)) {
      return;
    }
    const result = await renderMarkdown(source, mode, theme, renderer, () =>
      session.isCurrent(version),
    );
    if (!session.isCurrent(version)) {
      return;
    }
    previewDocument = result.document || makeEmptyPreviewDocument(theme);
    warnings = result.warnings;
  } catch (error: unknown) {
    if (session.isCurrent(version)) {
      renderError =
        error instanceof Error ? error.message : "The Markdown preview could not be rendered.";
    }
  } finally {
    if (session.isCurrent(version)) {
      isRendering = false;
    }
  }
}

async function getMermaidRenderer(): Promise<MermaidRenderer | null> {
  if (rendererDisposed) {
    return null;
  }
  if (actualMermaidRenderer) {
    return actualMermaidRenderer;
  }
  if (mermaidRendererPromise) {
    return mermaidRendererPromise;
  }
  mermaidImportAttempt += 1;
  mermaidRendererPromise = importMermaidRenderer()
    .then((module) => {
      if (rendererDisposed) {
        return null;
      }
      actualMermaidRenderer = module.createMermaidRenderer();
      return actualMermaidRenderer;
    })
    .finally(() => {
      mermaidRendererPromise = null;
    });
  return mermaidRendererPromise;
}

function importMermaidRenderer(): Promise<MermaidRendererModule> {
  // A failed browser module fetch is cached by its exact URL. Retry with a
  // stable alternate query so the user can recover from a transient failure
  // without reloading the page or losing the source textarea.
  switch (mermaidImportAttempt % 4) {
    case 1:
      return import("$lib/utils/markdown/mermaid-renderer");
    case 2:
      // @ts-expect-error Vite resolves the retry query at build time.
      return import("$lib/utils/markdown/mermaid-renderer?retry=2");
    case 3:
      // @ts-expect-error Vite resolves the retry query at build time.
      return import("$lib/utils/markdown/mermaid-renderer?retry=3");
    default:
      // @ts-expect-error Vite resolves the retry query at build time.
      return import("$lib/utils/markdown/mermaid-renderer?retry=4");
  }
}

function createLazyMermaidRenderer(): MermaidRenderer {
  let disposed = false;
  return {
    async render(source, currentTheme, id) {
      if (disposed) {
        return { error: "Mermaid renderer has been disposed." };
      }
      const renderer = await getMermaidRenderer();
      if (disposed || !renderer) {
        return { error: "Mermaid renderer is unavailable." };
      }
      return renderer.render(source, currentTheme, id);
    },
    dispose() {
      disposed = true;
      actualMermaidRenderer?.dispose();
      actualMermaidRenderer = null;
    },
  };
}

function handleSourceInput(event: Event): void {
  source = (event.currentTarget as HTMLTextAreaElement).value;
  importError = "";
  invalidateAndSchedule();
}

function handleCompositionStart(): void {
  isComposing = true;
  session.invalidate();
  isRendering = false;
  if (renderTimer) {
    clearTimeout(renderTimer);
    renderTimer = null;
  }
}

function handleCompositionEnd(): void {
  isComposing = false;
  invalidateAndSchedule();
}

function handleModeChange(nextMode: Mode): void {
  if (mode === nextMode) {
    return;
  }
  mode = nextMode;
  previewDocument = makeEmptyPreviewDocument(theme);
  invalidateAndSchedule(0);
}

function replaceSource(nextSource: string, action: string): boolean {
  if (
    source.trim() &&
    source !== nextSource &&
    !confirm(`Replace the current Markdown with ${action}?`)
  ) {
    return false;
  }
  source = nextSource;
  if (!nextSource) {
    previewDocument = makeEmptyPreviewDocument(theme);
  }
  invalidateAndSchedule(0);
  return true;
}

function handleExample(): void {
  replaceSource(COMPREHENSIVE_MARKDOWN_EXAMPLE, "the example");
}

function handleClear(): void {
  replaceSource("", "an empty document");
}

async function handleCopy(): Promise<void> {
  copied = await copyToClipboard(source);
  copyError = copied ? "" : "Clipboard unavailable. Select the source and copy it manually.";
  if (copyTimer) {
    clearTimeout(copyTimer);
  }
  copyTimer = setTimeout(() => {
    copied = false;
    copyTimer = null;
  }, 1800);
}

function handleDownload(): void {
  const blob = new Blob([source], { type: "text/markdown;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  objectUrls.add(objectUrl);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = "document.md";
  link.click();
  if (downloadTimer) {
    clearTimeout(downloadTimer);
  }
  downloadTimer = setTimeout(() => {
    objectUrls.delete(objectUrl);
    URL.revokeObjectURL(objectUrl);
    downloadTimer = null;
  }, 0);
}

function handleImportClick(): void {
  fileInput?.click();
}

async function handleFile(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  importError = "";
  if (!file) {
    return;
  }
  if (!/\.(?:md|markdown|txt)$/iu.test(file.name)) {
    importError = "Choose a .md, .markdown, or .txt file.";
    return;
  }
  if (file.size > MAX_INPUT_BYTES) {
    importError = `This file is larger than the ${Math.round(MAX_INPUT_BYTES / 1000)} KB limit.`;
    return;
  }
  const importVersion = session.invalidate();
  if (renderTimer) {
    clearTimeout(renderTimer);
    renderTimer = null;
  }
  isRendering = false;
  try {
    let buffer: ArrayBuffer;
    try {
      buffer = await file.arrayBuffer();
    } catch {
      importError = "Could not read this file as UTF-8 text.";
      return;
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    if (!session.isCurrent(importVersion)) {
      return;
    }
    if (getByteLength(text) > MAX_INPUT_BYTES) {
      importError = `This file is larger than the ${Math.round(MAX_INPUT_BYTES / 1000)} KB limit.`;
      return;
    }
    if (!replaceSource(text, file.name)) {
      invalidateAndSchedule(0);
    }
  } catch {
    importError = "The file is not valid UTF-8 Markdown text.";
  }
}

function handleRefresh(): void {
  invalidateAndSchedule(0, true);
}
</script>

<svelte:head>
  <title>Markdown Previewer | PureTools</title>
  <meta
    name="description"
    content="Preview Markdown, GFM, math, and Mermaid locally in your browser."
  />
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
  <div class="mb-4 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex items-center gap-2 px-2 text-xs font-semibold text-neutral-500">
        <Code2 size={15} class="text-indigo-600 dark:text-indigo-400" />
        Markdown Previewer
      </div>
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <input
          bind:this={fileInput}
          type="file"
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          class="hidden"
          onchange={handleFile}
        />
        <button class="toolbar-button" type="button" onclick={handleImportClick} title="Import UTF-8 Markdown">
          <Upload size={13} />
          Import
        </button>
        <button class="toolbar-button" type="button" onclick={handleExample} title="Load comprehensive Markdown example">
          <RotateCcw size={13} />
          Example
        </button>
        <button class="toolbar-button" type="button" onclick={handleCopy} title="Copy Markdown source">
          {#if copied}<Check size={13} />{:else}<Clipboard size={13} />{/if}
          {copied ? "Copied" : "Copy source"}
        </button>
        <button class="toolbar-button" type="button" onclick={handleDownload} title="Download Markdown source">
          <Download size={13} />
          Download .md
        </button>
        <button
          class="toolbar-button text-red-600 hover:border-red-200 hover:text-red-700 dark:text-red-400"
          type="button"
          onclick={handleClear}
          title="Clear Markdown source"
        >
          <Trash2 size={13} />
          Clear
        </button>
      </div>
    </div>
    <div class="mt-2 flex flex-wrap items-center gap-2 border-t border-neutral-100 px-2 pt-2 dark:border-neutral-800">
      <span class="text-xs font-semibold text-neutral-500">Compatibility mode</span>
      <div class="flex rounded-lg border border-neutral-200 p-0.5 dark:border-neutral-700" role="group" aria-label="Compatibility mode">
        <button
          type="button"
          class="mode-button {mode === 'enhanced' ? 'mode-button-active' : ''}"
          aria-pressed={mode === "enhanced"}
          onclick={() => handleModeChange("enhanced")}
        >Enhanced</button>
        <button
          type="button"
          class="mode-button {mode === 'commonmark' ? 'mode-button-active' : ''}"
          aria-pressed={mode === "commonmark"}
          onclick={() => handleModeChange("commonmark")}
        >CommonMark</button>
      </div>
      <span class="ml-auto text-xs text-neutral-400">{inputStats.lines} lines · {inputStats.chars} chars · {inputStats.bytes} bytes</span>
    </div>
  </div>

  {#if importError}
    <p class="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300" role="alert">{importError}</p>
  {/if}

  {#if copyError}
    <p class="mb-3 text-xs text-red-700 dark:text-red-300" role="alert">{copyError}</p>
  {/if}

  <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-2 text-xs text-neutral-500" aria-live="polite">
      <span class:animate-pulse={isRendering} class="h-2 w-2 rounded-full {renderError ? 'bg-red-500' : warnings.length ? 'bg-amber-500' : 'bg-emerald-500'}"></span>
      {statusLabel}
      {#if warnings.length > 0}<span class="text-amber-600 dark:text-amber-400">{warnings.join(" ")}</span>{/if}
    </div>
    <div class="flex items-center gap-2">
      <button class="toolbar-button" type="button" onclick={handleRefresh} disabled={isRendering}>
        <RefreshCw size={13} />
        Refresh preview
      </button>
      <div class="hidden rounded-lg border border-neutral-200 p-0.5 md:flex dark:border-neutral-700" role="group" aria-label="Preview view">
        {#each ["edit", "split", "preview"] as view}
          <button
            type="button"
            class="mode-button {activeView === view ? 'mode-button-active' : ''}"
            aria-pressed={activeView === view}
            onclick={() => (activeView = view as View)}
          >{view[0].toUpperCase() + view.slice(1)}</button>
        {/each}
      </div>
      <div class="flex rounded-lg border border-neutral-200 p-0.5 md:hidden dark:border-neutral-700" role="group" aria-label="Mobile view">
        <button type="button" class="mode-button {activeView !== 'preview' ? 'mode-button-active' : ''}" aria-pressed={activeView !== "preview"} onclick={() => (activeView = "edit")}>Edit</button>
        <button type="button" class="mode-button {activeView === 'preview' ? 'mode-button-active' : ''}" aria-pressed={activeView === "preview"} onclick={() => (activeView = "preview")}>Preview</button>
      </div>
    </div>
  </div>

  <div class="grid min-h-[42rem] gap-4 {activeView === 'split' ? 'md:grid-cols-2' : 'md:grid-cols-1'}">
    <section class:hidden={activeView === "preview"} class:mobile-split-editor={activeView === "split"} class="flex min-h-[42rem] flex-col rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div class="mb-2 flex items-center justify-between">
        <label for="markdown-source" class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Markdown source</label>
        <span class="text-xs text-neutral-400">UTF-8 · in memory</span>
      </div>
      <textarea
        id="markdown-source"
        bind:value={source}
        oninput={handleSourceInput}
        oncompositionstart={handleCompositionStart}
        oncompositionend={handleCompositionEnd}
        spellcheck="false"
        aria-label="Markdown source"
        placeholder="Write Markdown here…"
        class="min-h-[38rem] flex-1 resize-y rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm leading-6 text-neutral-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:bg-neutral-900"
      ></textarea>
    </section>

    <section class:hidden={activeView === "edit"} class:mobile-split-preview={activeView === "split"} class="flex min-h-[42rem] flex-col rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Markdown preview</h2>
        <div class="flex items-center gap-1.5 text-xs text-neutral-400"><FileText size={13} /> sandboxed</div>
      </div>
      {#if renderError}
        <div class="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/60 dark:bg-red-950/20">
          <p class="text-sm font-semibold text-red-800 dark:text-red-200">Preview unavailable</p>
          <p class="max-w-md text-xs text-red-700 dark:text-red-300">{renderError}</p>
          <button class="toolbar-button" type="button" onclick={handleRefresh}><RefreshCw size={13} /> Retry</button>
        </div>
      {:else}
        <iframe
          title="Markdown preview"
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          srcdoc={previewDocument}
          class="min-h-[38rem] w-full flex-1 rounded-xl border border-neutral-200 bg-white dark:border-neutral-700"
        ></iframe>
      {/if}
    </section>
  </div>

  <details class="mt-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs leading-5 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
    <summary class="cursor-pointer font-semibold text-neutral-600 dark:text-neutral-300">Compatibility and safety</summary>
    <div class="mt-3 grid gap-3 sm:grid-cols-3">
      <p><strong class="text-neutral-700 dark:text-neutral-200">Supported</strong><br />Enhanced mode uses CommonMark with GFM, footnotes, callouts, frontmatter display, safe static HTML, KaTeX 0.19.0 math, and Mermaid 12.1.0 diagrams. CommonMark mode keeps those extensions as ordinary Markdown.</p>
      <p><strong class="text-neutral-700 dark:text-neutral-200">Security restricted</strong><br />Scripts, event attributes, forms, embeds, unsafe links, remote CSS, fonts, images, and Mermaid configuration overrides are removed. The final document runs in a sandboxed iframe with a restrictive CSP.</p>
      <p><strong class="text-neutral-700 dark:text-neutral-200">Not supported</strong><br />This tool does not execute MDX, JSX, Svelte/Vue components, arbitrary plugins, or full LaTeX documents. <code>\(...\)</code> and <code>\[...\]</code> delimiters, remote images, and relative images without supplied assets are not promised.</p>
    </div>
    <p class="mt-3 border-t border-neutral-100 pt-3 text-neutral-400 dark:border-neutral-800">Renderer baseline: remark-parse 11.0.0, remark-gfm 4.0.1, KaTeX 0.19.0, Mermaid 12.1.0. All processing stays in this browser tab.</p>
  </details>
</div>

<style>
  .toolbar-button {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    border: 1px solid rgb(229 229 229);
    border-radius: 0.5rem;
    background: white;
    padding: 0.375rem 0.625rem;
    color: rgb(115 115 115);
    font-size: 0.75rem;
    font-weight: 600;
    transition: border-color 120ms ease, color 120ms ease;
  }

  .toolbar-button:hover,
  .toolbar-button:focus-visible {
    border-color: rgb(165 180 252);
    color: rgb(79 70 229);
    outline: none;
  }

  .toolbar-button:disabled {
    cursor: wait;
    opacity: 0.55;
  }

  .mode-button {
    border-radius: 0.375rem;
    padding: 0.25rem 0.5rem;
    color: rgb(115 115 115);
    font-size: 0.6875rem;
    font-weight: 600;
  }

  .mode-button-active {
    background: rgb(238 242 255);
    color: rgb(79 70 229);
  }

  :global(.dark) .toolbar-button {
    border-color: rgb(64 64 64);
    background: rgb(38 38 38);
    color: rgb(163 163 163);
  }

  :global(.dark) .mode-button-active {
    background: rgb(55 48 163 / 0.35);
    color: rgb(165 180 252);
  }

  @media (max-width: 767px) {
    .mobile-split-preview {
      display: none;
    }
  }
</style>
