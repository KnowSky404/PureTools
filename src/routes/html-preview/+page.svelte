<script lang="ts">
import { Code2, FileText, RotateCcw, Trash2 } from "lucide-svelte";

const exampleHtml = `<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>month_id</th>
      <th>user_id</th>
      <th>device_number</th>
      <th>call_nums</th>
      <th>call_duration</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>11</th>
      <td>202512</td>
      <td>8423071478760909</td>
      <td>02968084756</td>
      <td>67.000000000000000000</td>
      <td>10.533333333200000000</td>
    </tr>
  </tbody>
</table>`;

let input = $state(exampleHtml);

const inputStats = $derived.by(() => {
  if (!input) {
    return { chars: 0, lines: 0 };
  }
  return { chars: input.length, lines: input.split("\n").length };
});

const previewDocument = $derived.by(() => buildPreviewDocument(input));

function handleExample(): void {
  input = exampleHtml;
}

function handleClear(): void {
  input = "";
}

function buildPreviewDocument(markup: string): string {
  const body = markup.trim()
    ? markup
    : `<div class="empty-state">
        <strong>Preview is empty</strong>
        <span>Paste HTML on the left to render it here.</span>
      </div>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: light;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #171717;
        background: #ffffff;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        padding: 24px;
        overflow-wrap: anywhere;
      }

      table {
        border-collapse: collapse;
        max-width: 100%;
      }

      th,
      td {
        padding: 8px 10px;
      }

      img,
      svg,
      video,
      canvas {
        max-width: 100%;
      }

      .empty-state {
        display: grid;
        min-height: calc(100vh - 48px);
        place-content: center;
        gap: 6px;
        color: #737373;
        text-align: center;
      }

      .empty-state strong {
        color: #404040;
        font-size: 14px;
      }

      .empty-state span {
        font-size: 12px;
      }
    </style>
  </head>
  <body>
${body}
  </body>
</html>`;
}
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <div class="mb-6 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm">
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex items-center gap-2 px-2 text-xs font-semibold text-neutral-500">
        <Code2 size={14} class="text-violet-600" />
        Static HTML renders in a sandboxed iframe.
      </div>

      <div class="ml-auto flex flex-wrap items-center gap-2">
        <button
          onclick={handleExample}
          class="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-violet-200 hover:text-violet-600"
        >
          <RotateCcw size={12} />
          Example
        </button>
        <button
          onclick={handleClear}
          class="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-red-200 hover:text-red-600"
        >
          <Trash2 size={12} />
          Clear
        </button>
      </div>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-2">
    <section class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">HTML Input</h2>
        <span class="text-xs text-neutral-400">
          {inputStats.lines} lines · {inputStats.chars} chars
        </span>
      </div>
      <textarea
        rows={24}
        bind:value={input}
        spellcheck="false"
        placeholder="Paste HTML here..."
        class="min-h-[36rem] w-full resize-y rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
      ></textarea>
    </section>

    <section class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Preview</h2>
        <div class="flex items-center gap-1.5 text-xs text-neutral-400">
          <FileText size={12} />
          sandboxed
        </div>
      </div>
      <iframe
        title="HTML preview"
        sandbox=""
        srcdoc={previewDocument}
        class="min-h-[36rem] w-full rounded-xl border border-neutral-200 bg-white"
      ></iframe>
    </section>
  </div>
</div>
