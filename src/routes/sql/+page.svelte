<script lang="ts">
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

<div class="mx-auto max-w-5xl p-6">
  <div class="mb-8 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-slate-900">SQL Formatter</h1>
      <p class="text-slate-500">Format and minify SQL in your browser.</p>
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
      <select
        value={indent}
        onchange={handleIndentChange}
        class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
        disabled={mode === "minify"}
      >
        <option value={2}>2 spaces</option>
        <option value={4}>4 spaces</option>
      </select>
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
      <div class="flex min-h-[320px] w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="w-12 border-r border-slate-200 bg-slate-50 text-slate-400">
          <div
            class="h-full overflow-hidden px-2 py-3 font-mono text-xs leading-6"
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
          class="min-h-[320px] flex-1 resize-none px-4 py-3 font-mono text-sm leading-6 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        ></textarea>
      </div>
      {#if error}
        <p class="text-sm font-medium text-red-600">{error}</p>
      {:else if input.trim()}
        <p class="text-sm font-medium text-green-600">Basic validation passed</p>
      {/if}
    </div>

    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between text-xs text-slate-500">
        <span>Output</span>
        <span>{outputStats.lines} lines · {outputStats.chars} chars</span>
      </div>
      <div class="flex min-h-[320px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
        <div class="w-12 border-r border-slate-200 bg-slate-100 text-slate-400">
          <div
            class="h-full overflow-hidden px-2 py-3 font-mono text-xs leading-6"
            bind:this={outputLinesWrap}
          >
            <pre class="whitespace-pre">{outputLineNumbers}</pre>
          </div>
        </div>
        <div
          class="flex-1 overflow-auto px-4 py-3 font-mono text-sm leading-6 text-slate-900"
          bind:this={outputScrollEl}
          onscroll={syncOutputScroll}
        >
          {#if output}
            <pre class="whitespace-pre-wrap break-words">{output}</pre>
          {:else}
            <p class="text-slate-400">Formatted SQL will appear here...</p>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
