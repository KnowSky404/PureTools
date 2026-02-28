<script lang="ts">
import {
  AlertCircle,
  Check,
  Copy,
  Database,
  FileCode,
  Maximize2,
  Minimize2,
  Trash2,
} from "lucide-svelte";
import { copyToClipboard } from "$lib/utils/clipboard";

type FormatMode = "format" | "minify";
type IndentSize = 2 | 4;

let input = $state("");
let output = $state("");
let error = $state("");
let mode = $state<FormatMode>("format");
let indent = $state<IndentSize>(2);
let copyStatus = $state("Copy");

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

    const validationError = validateSql(value);
    if (validationError) {
      output = "";
      error = validationError;
      return;
    }

    try {
      output = currentMode === "minify" ? minifySql(value) : formatSql(value, " ".repeat(spaces));
      error = "";
    } catch (err) {
      output = "";
      error = err instanceof Error ? err.message : "Failed to format SQL";
    }
  }, 250);

  return () => clearTimeout(timer);
});

function handleIndentChange(event: Event) {
  const value = Number((event.currentTarget as HTMLSelectElement).value);
  indent = value === 4 ? 4 : 2;
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
  input = `select u.id, u.name, p.title, p.created_at
from users u
left join posts p on p.user_id = u.id
where u.active = true and p.created_at >= '2024-01-01'
order by p.created_at desc;`;
}

function buildLineNumbers(total: number): string {
  return Array.from({ length: total }, (_, index) => `${index + 1}`).join("\n");
}

function validateSql(value: string): string | null {
  let parens = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    const next = value[i + 1];

    if (!inDouble && char === "'") {
      if (next === "'") {
        i += 1;
        continue;
      }
      inSingle = !inSingle;
      continue;
    }

    if (!inSingle && char === '"') {
      if (next === '"') {
        i += 1;
        continue;
      }
      inDouble = !inDouble;
      continue;
    }

    if (inSingle || inDouble) {
      continue;
    }

    if (char === "(") {
      parens += 1;
    } else if (char === ")") {
      parens -= 1;
      if (parens < 0) {
        return "Unmatched closing parenthesis.";
      }
    }
  }

  if (inSingle || inDouble) {
    return "Unclosed string literal.";
  }
  if (parens !== 0) {
    return "Unbalanced parentheses.";
  }
  return null;
}

function minifySql(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*([(),;])\s*/g, "$1")
    .replace(/\s*([=<>!]+)\s*/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatSql(value: string, indentSpace: string): string {
  let sql = value.trim().replace(/\s+/g, " ");
  sql = uppercaseKeywords(sql);
  sql = insertClauseBreaks(sql);
  sql = sql.replace(/\bSELECT\b\s+/g, `SELECT\n${indentSpace}`);
  sql = sql.replace(/\bFROM\b\s+/g, `FROM\n${indentSpace}`);
  sql = sql.replace(/\bWHERE\b\s+/g, `WHERE\n${indentSpace}`);
  sql = sql.replace(/\bGROUP BY\b\s+/g, `GROUP BY\n${indentSpace}`);
  sql = sql.replace(/\bORDER BY\b\s+/g, `ORDER BY\n${indentSpace}`);
  sql = sql.replace(/\bHAVING\b\s+/g, `HAVING\n${indentSpace}`);
  sql = sql.replace(/\bSET\b\s+/g, `SET\n${indentSpace}`);
  sql = breakTopLevelCommas(sql, indentSpace);
  sql = sql.replace(/\s+(AND|OR)\s+/gi, `\n${indentSpace}$1 `);
  return sql.trim();
}

function uppercaseKeywords(value: string): string {
  const keywords = [
    "UNION ALL",
    "UNION",
    "LEFT JOIN",
    "RIGHT JOIN",
    "FULL JOIN",
    "INNER JOIN",
    "OUTER JOIN",
    "CROSS JOIN",
    "JOIN",
    "GROUP BY",
    "ORDER BY",
    "INSERT INTO",
    "DELETE FROM",
    "SELECT",
    "FROM",
    "WHERE",
    "HAVING",
    "LIMIT",
    "OFFSET",
    "UPDATE",
    "SET",
    "VALUES",
    "DISTINCT",
    "ON",
    "AS",
    "CASE",
    "WHEN",
    "THEN",
    "ELSE",
    "END",
    "AND",
    "OR",
    "IN",
    "IS",
    "NULL",
    "NOT",
    "EXISTS",
    "BETWEEN",
  ];
  return keywords.reduce((acc, keyword) => {
    const pattern = keyword.split(" ").join("\\s+");
    const regex = new RegExp(`\\b${pattern}\\b`, "gi");
    return acc.replace(regex, keyword);
  }, value);
}

function insertClauseBreaks(value: string): string {
  const clauses = [
    "SELECT",
    "FROM",
    "WHERE",
    "GROUP BY",
    "ORDER BY",
    "HAVING",
    "LIMIT",
    "OFFSET",
    "INSERT INTO",
    "VALUES",
    "UPDATE",
    "SET",
    "DELETE FROM",
    "LEFT JOIN",
    "RIGHT JOIN",
    "FULL JOIN",
    "INNER JOIN",
    "OUTER JOIN",
    "CROSS JOIN",
    "JOIN",
    "UNION ALL",
    "UNION",
  ];
  return clauses.reduce((acc, clause) => {
    const pattern = clause.split(" ").join("\\s+");
    const regex = new RegExp(`\\b${pattern}\\b`, "g");
    return acc.replace(regex, `\n${clause}`);
  }, value);
}

function breakTopLevelCommas(value: string, indentSpace: string): string {
  let result = "";
  let depth = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    const next = value[i + 1];

    if (!inDouble && char === "'") {
      if (next === "'") {
        result += "''";
        i += 1;
        continue;
      }
      inSingle = !inSingle;
      result += char;
      continue;
    }

    if (!inSingle && char === '"') {
      if (next === '"') {
        result += '""';
        i += 1;
        continue;
      }
      inDouble = !inDouble;
      result += char;
      continue;
    }

    if (!inSingle && !inDouble) {
      if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth = Math.max(0, depth - 1);
      }
      if (char === "," && depth === 0) {
        result += `,\n${indentSpace}`;
        continue;
      }
    }
    result += char;
  }
  return result;
}
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <!-- Header Section -->
  <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex items-center gap-4">
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
        <Database size={24} />
      </div>
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-neutral-900">SQL Formatter</h1>
        <p class="text-sm text-neutral-500 font-medium">Beautify and optimize your SQL queries</p>
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
      </div>

      <div class="h-6 w-px bg-neutral-200 mx-1"></div>

      <select
        value={indent}
        onchange={handleIndentChange}
        class="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 outline-none hover:border-neutral-300 focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-50"
        disabled={mode === "minify"}
      >
        <option value={2}>2 Spaces</option>
        <option value={4}>4 Spaces</option>
      </select>

      <div class="h-6 w-px bg-neutral-200 mx-1 hidden sm:block"></div>

      <div class="flex items-center gap-1.5">
        <button
          onclick={handleExample}
          class="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 transition-all hover:bg-neutral-50"
        >
          <FileCode size={14} />
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
  <div class="grid gap-6 lg:grid-cols-2 lg:h-[calc(100vh-320px)] min-h-[500px]">
    <!-- Input Panel -->
    <div class="flex flex-col gap-2 h-full">
      <div class="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
        <span class="flex items-center gap-1.5">
          <span class="h-1.5 w-1.5 rounded-full {error ? 'bg-red-500' : input.trim() ? 'bg-green-500' : 'bg-neutral-300'}"></span>
          Input SQL
        </span>
        <span>{inputStats.lines} lines · {inputStats.chars} chars</span>
      </div>
      <div class="flex flex-1 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all focus-within:ring-4 focus-within:ring-indigo-500/5 focus-within:border-indigo-500/50">
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
          placeholder="Paste SQL here..."
          onscroll={syncInputScroll}
          class="flex-1 resize-none bg-transparent px-4 py-4 font-mono text-sm leading-6 text-neutral-900 outline-none placeholder:text-neutral-300"
        ></textarea>
      </div>
      {#if error}
        <div class="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 ring-1 ring-red-100">
          <AlertCircle size={14} />
          {error}
        </div>
      {/if}
    </div>

    <!-- Output Panel -->
    <div class="flex flex-col gap-2 h-full">
      <div class="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
        <span>Output</span>
        <span>{outputStats.lines} lines · {outputStats.chars} chars</span>
      </div>
      <div class="flex flex-1 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50/50 shadow-sm">
        <div class="w-12 shrink-0 border-r border-neutral-100 bg-neutral-100/50 text-neutral-400 select-none">
          <div
            class="h-full overflow-hidden px-2 py-4 font-mono text-[11px] leading-6 text-right"
            bind:this={outputLinesWrap}
          >
            <pre class="whitespace-pre">{outputLineNumbers}</pre>
          </div>
        </div>
        <div
          class="flex-1 overflow-auto px-4 py-4 font-mono text-sm leading-6 text-neutral-900"
          bind:this={outputScrollEl}
          onscroll={syncOutputScroll}
        >
          {#if output}
            <pre class="whitespace-pre-wrap break-all">{output}</pre>
          {:else}
            <div class="flex h-full items-center justify-center text-neutral-300">
              <div class="flex flex-col items-center gap-2">
                <FileCode size={32} class="opacity-20" />
                <p class="text-xs font-bold">Output will appear here</p>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
