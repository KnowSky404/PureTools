<script lang="ts">
import { AlertCircle, Check, Copy, Search, Sparkles, Trash2 } from "lucide-svelte";
import { copyToClipboard } from "$lib/utils/clipboard";

type RegexFlagKey = "g" | "i" | "m" | "s" | "u" | "y";

type RegexFlagState = Record<RegexFlagKey, boolean>;

type CharacterSet =
  | "digits"
  | "letters"
  | "alnum"
  | "word"
  | "hex"
  | "whitespace"
  | "any"
  | "custom";

type Quantifier = "exact" | "range" | "oneOrMore" | "zeroOrMore" | "optional";

type MatchInfo = {
  index: number;
  text: string;
  groups: string[];
  namedGroups: Record<string, string> | null;
};

type RegexResult =
  | { status: "empty" }
  | { status: "invalid"; message: string }
  | {
      status: "valid";
      flags: string;
      matches: MatchInfo[];
      truncated: boolean;
      zeroLength: boolean;
      highlightedHtml: string;
      highlightSkipped: boolean;
    };

type Preset = {
  name: string;
  description: string;
  pattern: string;
  flags: string;
  example: string;
};

const FLAG_ORDER: RegexFlagKey[] = ["g", "i", "m", "s", "u", "y"];
const FLAG_META: { key: RegexFlagKey; label: string; desc: string }[] = [
  { key: "g", label: "g", desc: "global" },
  { key: "i", label: "i", desc: "ignore case" },
  { key: "m", label: "m", desc: "multiline" },
  { key: "s", label: "s", desc: "dotAll" },
  { key: "u", label: "u", desc: "unicode" },
  { key: "y", label: "y", desc: "sticky" },
];

const presets: Preset[] = [
  {
    name: "Email",
    description: "Basic email address",
    pattern: "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$",
    flags: "i",
    example: "hello@puretools.dev",
  },
  {
    name: "URL (http/https)",
    description: "http/https URL with optional path",
    pattern: "^https?:\\/\\/[\\w.-]+(?:\\:[0-9]{2,5})?(?:\\/[\\w\\-./?%&=]*)?$",
    flags: "i",
    example: "https://example.com/docs?ref=home",
  },
  {
    name: "IPv4",
    description: "IPv4 address",
    pattern:
      "^(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}$",
    flags: "",
    example: "192.168.0.1",
  },
  {
    name: "Hex Color",
    description: "3 or 6 digit hex color",
    pattern: "^#?(?:[A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$",
    flags: "",
    example: "#ff8800",
  },
  {
    name: "Date (YYYY-MM-DD)",
    description: "Simple calendar date",
    pattern: "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$",
    flags: "",
    example: "2026-03-13",
  },
];

const MATCH_LIMIT = 200;
const HIGHLIGHT_MAX_LENGTH = 20000;

let patternInput = $state("");
let testInput = $state("");
let flagState = $state<RegexFlagState>({
  g: true,
  i: false,
  m: false,
  s: false,
  u: false,
  y: false,
});

let validationResult = $state<RegexResult>({ status: "empty" });
let patternCopyStatus = $state("Copy");
let generatedCopyStatus = $state("Copy");
let presetCopyStatus = $state<string | null>(null);

let builderPrefix = $state("");
let builderSuffix = $state("");
let builderCharSet = $state<CharacterSet>("digits");
let builderCustomSet = $state("");
let builderQuantifier = $state<Quantifier>("range");
let builderMin = $state("1");
let builderMax = $state("10");
let builderExact = $state("6");
let builderAnchors = $state(true);
let builderExample = $state("");
let builderFlags = $state<RegexFlagState>({
  g: false,
  i: false,
  m: false,
  s: false,
  u: false,
  y: false,
});

const compiledPattern = $derived.by(() => {
  if (!patternInput.trim()) {
    return "";
  }
  const flags = buildFlags(flagState);
  return `/${patternInput}/${flags}`;
});

const generatedOutput = $derived.by(() => {
  const pattern = buildGeneratedPattern();
  const flags = buildFlags(builderFlags);
  let error = "";
  try {
    if (pattern) {
      new RegExp(pattern, flags);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Invalid regex.";
  }
  return {
    pattern,
    flags,
    display: pattern ? `/${pattern}/${flags}` : "",
    error,
  };
});

$effect(() => {
  const pattern = patternInput.trim();
  const flagsValue = buildFlags(flagState);
  const text = testInput;

  const timer = setTimeout(() => {
    if (!pattern) {
      validationResult = { status: "empty" };
      return;
    }

    try {
      const regex = new RegExp(pattern, flagsValue);
      const { matches, truncated, zeroLength } = collectMatches(regex, text, MATCH_LIMIT);
      const highlightSkipped = text.length > HIGHLIGHT_MAX_LENGTH;
      const highlightedHtml = highlightSkipped ? "" : buildHighlightHtml(text, matches);

      validationResult = {
        status: "valid",
        flags: flagsValue,
        matches,
        truncated,
        zeroLength,
        highlightedHtml,
        highlightSkipped,
      };
    } catch (err) {
      validationResult = {
        status: "invalid",
        message: err instanceof Error ? err.message : "Invalid regex.",
      };
    }
  }, 250);

  return () => clearTimeout(timer);
});

function buildFlags(state: RegexFlagState): string {
  return FLAG_ORDER.filter((key) => state[key]).join("");
}

function setFlagStateFromString(flags: string): RegexFlagState {
  return {
    g: flags.includes("g"),
    i: flags.includes("i"),
    m: flags.includes("m"),
    s: flags.includes("s"),
    u: flags.includes("u"),
    y: flags.includes("y"),
  };
}

function toggleValidatorFlag(key: RegexFlagKey): void {
  flagState = { ...flagState, [key]: !flagState[key] };
}

function toggleBuilderFlag(key: RegexFlagKey): void {
  builderFlags = { ...builderFlags, [key]: !builderFlags[key] };
}

function handleExample(): void {
  patternInput = "\\b[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}\\b";
  testInput = "Team: hello@puretools.dev, support@puretools.dev";
  flagState = setFlagStateFromString("gi");
}

function handleClear(): void {
  patternInput = "";
  testInput = "";
  validationResult = { status: "empty" };
}

function resetBuilder(): void {
  builderPrefix = "";
  builderSuffix = "";
  builderCharSet = "digits";
  builderCustomSet = "";
  builderQuantifier = "range";
  builderMin = "1";
  builderMax = "10";
  builderExact = "6";
  builderAnchors = true;
  builderExample = "";
  builderFlags = {
    g: false,
    i: false,
    m: false,
    s: false,
    u: false,
    y: false,
  };
}

async function handleCopyCompiled(): Promise<void> {
  if (!compiledPattern) {
    return;
  }
  const success = await copyToClipboard(compiledPattern);
  patternCopyStatus = success ? "Copied!" : "Copy failed";
  setTimeout(() => (patternCopyStatus = "Copy"), 1500);
}

async function handleCopyGenerated(): Promise<void> {
  if (!generatedOutput.display) {
    return;
  }
  const success = await copyToClipboard(generatedOutput.display);
  generatedCopyStatus = success ? "Copied!" : "Copy failed";
  setTimeout(() => (generatedCopyStatus = "Copy"), 1500);
}

async function handleCopyPreset(preset: Preset): Promise<void> {
  const value = `/${preset.pattern}/${preset.flags}`;
  const success = await copyToClipboard(value);
  presetCopyStatus = success ? preset.name : null;
  setTimeout(() => (presetCopyStatus = null), 1200);
}

function applyGeneratedToValidator(): void {
  if (!generatedOutput.pattern) {
    return;
  }
  patternInput = generatedOutput.pattern;
  flagState = setFlagStateFromString(generatedOutput.flags);
  if (builderExample.trim()) {
    testInput = builderExample;
  }
}

function applyPreset(preset: Preset): void {
  patternInput = preset.pattern;
  flagState = setFlagStateFromString(preset.flags);
  testInput = preset.example;
}

function collectMatches(
  regex: RegExp,
  text: string,
  limit: number,
): { matches: MatchInfo[]; truncated: boolean; zeroLength: boolean } {
  const matches: MatchInfo[] = [];
  let truncated = false;
  let zeroLength = false;

  if (!regex.global && !regex.sticky) {
    const single = regex.exec(text);
    if (single) {
      matches.push(toMatchInfo(single));
      if (single[0] === "") {
        zeroLength = true;
      }
    }
    return { matches, truncated, zeroLength };
  }

  regex.lastIndex = 0;
  let result: RegExpExecArray | null = regex.exec(text);
  while (result) {
    matches.push(toMatchInfo(result));
    if (result[0] === "") {
      zeroLength = true;
      regex.lastIndex += 1;
    }
    if (matches.length >= limit) {
      truncated = true;
      break;
    }
    result = regex.exec(text);
  }

  return { matches, truncated, zeroLength };
}

function toMatchInfo(match: RegExpExecArray): MatchInfo {
  return {
    index: match.index ?? 0,
    text: match[0] ?? "",
    groups: match.slice(1),
    namedGroups: match.groups ? { ...match.groups } : null,
  };
}

function buildHighlightHtml(text: string, matches: MatchInfo[]): string {
  if (!text) {
    return "";
  }

  let output = "";
  let cursor = 0;

  for (const match of matches) {
    if (!match.text || match.index < cursor) {
      continue;
    }
    const start = match.index;
    const end = start + match.text.length;
    output += escapeHtml(text.slice(cursor, start));
    output += `<mark class="rounded bg-amber-200/70 px-1">${escapeHtml(
      text.slice(start, end),
    )}</mark>`;
    cursor = end;
  }

  output += escapeHtml(text.slice(cursor));
  return output;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function buildGeneratedPattern(): string {
  const prefix = escapeRegexLiteral(builderPrefix.trim());
  const suffix = escapeRegexLiteral(builderSuffix.trim());
  const core = `${buildCharFragment()}${buildQuantifier()}`;
  const body = `${prefix}${core}${suffix}`;
  if (!body) {
    return "";
  }
  return builderAnchors ? `^${body}$` : body;
}

function buildCharFragment(): string {
  switch (builderCharSet) {
    case "digits":
      return "\\d";
    case "letters":
      return "[A-Za-z]";
    case "alnum":
      return "[A-Za-z0-9]";
    case "word":
      return "\\w";
    case "hex":
      return "[A-Fa-f0-9]";
    case "whitespace":
      return "\\s";
    case "any":
      return ".";
    case "custom": {
      const custom = builderCustomSet.trim();
      return custom ? `[${custom}]` : "\\w";
    }
    default:
      return "\\w";
  }
}

function buildQuantifier(): string {
  switch (builderQuantifier) {
    case "exact": {
      const exact = parseCount(builderExact, 1);
      return `{${exact}}`;
    }
    case "range": {
      const min = parseCount(builderMin, 0);
      const max = parseCount(builderMax, min);
      if (max <= min) {
        return `{${min}}`;
      }
      return `{${min},${max}}`;
    }
    case "oneOrMore":
      return "+";
    case "zeroOrMore":
      return "*";
    case "optional":
      return "?";
    default:
      return "";
  }
}

function parseCount(raw: string, fallback: number): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <div class="grid gap-8 lg:grid-cols-2">
    <!-- Validator -->
    <section class="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
        <h2 class="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-neutral-900">
          <Search size={14} class="text-rose-600" />
          Validator
        </h2>
        <div class="flex items-center gap-2">
          <button
            onclick={handleExample}
            class="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 transition hover:border-rose-200 hover:text-rose-600"
          >
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

      <div class="space-y-6 p-6">
        <div class="space-y-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Pattern</label>
          <input
            type="text"
            bind:value={patternInput}
            placeholder="e.g. ^\\w+$"
            class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-500/10"
          />
          <p class="text-xs text-neutral-400">Enter pattern without surrounding slashes.</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          {#each FLAG_META as flag}
            <button
              onclick={() => toggleValidatorFlag(flag.key)}
              title={flag.desc}
              class="rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all
              {flagState[flag.key]
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-800'}"
            >
              {flag.label}
            </button>
          {/each}
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-mono text-neutral-600">
          <span>{compiledPattern || "/pattern/flags"}</span>
          <button
            onclick={handleCopyCompiled}
            class="flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-500 transition hover:border-rose-200 hover:text-rose-600"
            disabled={!compiledPattern}
          >
            <Copy size={12} />
            {patternCopyStatus}
          </button>
        </div>

        <div class="space-y-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Test Text</label>
          <textarea
            rows={6}
            bind:value={testInput}
            placeholder="Paste or type text to test..."
            class="w-full resize-y rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-500/10"
          ></textarea>
        </div>

        <div class="rounded-xl border border-neutral-200 bg-white p-4">
          {#if validationResult.status === "empty"}
            <div class="text-sm text-neutral-400">Waiting for a regex pattern.</div>
          {:else if validationResult.status === "invalid"}
            <div class="flex items-start gap-2 text-sm font-semibold text-red-600">
              <AlertCircle size={16} class="mt-0.5" />
              <div>
                Invalid regex: {validationResult.message}
                <div class="mt-1 text-xs font-normal text-neutral-400">Check escaping and flag support.</div>
              </div>
            </div>
          {:else}
            <div class="flex flex-wrap items-center gap-2 text-sm font-semibold text-emerald-600">
              <Check size={16} />
              Regex is valid
            </div>
            <div class="mt-3 grid gap-2 text-xs text-neutral-500 sm:grid-cols-2">
              <div class="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
                Matches: <span class="font-semibold text-neutral-900">{validationResult.matches.length}</span>
                {#if validationResult.truncated}
                  <span class="ml-1 text-amber-600">(showing first {MATCH_LIMIT})</span>
                {/if}
              </div>
              <div class="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
                Flags: <span class="font-semibold text-neutral-900">{validationResult.flags || "none"}</span>
              </div>
              {#if validationResult.zeroLength}
                <div class="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-amber-700 sm:col-span-2">
                  Zero-length matches detected. Highlight skips empty matches.
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Highlight</h3>
            {#if validationResult.status === "valid" && validationResult.highlightSkipped}
              <span class="text-xs text-neutral-400">Text too long, highlight skipped.</span>
            {/if}
          </div>
          <div class="min-h-[120px] max-h-[240px] overflow-auto rounded-xl border border-neutral-200 bg-neutral-50 p-4 font-mono text-sm leading-relaxed text-neutral-700">
            {#if validationResult.status === "valid"}
              {#if validationResult.highlightSkipped}
                <span class="text-neutral-400">Enable shorter input to preview highlights.</span>
              {:else}
                <div class="whitespace-pre-wrap">{@html validationResult.highlightedHtml}</div>
              {/if}
            {:else}
              <span class="text-neutral-400">Matches will be highlighted here.</span>
            {/if}
          </div>
        </div>

        <div class="space-y-2">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Matches</h3>
          <div class="max-h-[260px] space-y-2 overflow-auto">
            {#if validationResult.status !== "valid"}
              <div class="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-400">
                Run a regex to see matches.
              </div>
            {:else if validationResult.matches.length === 0}
              <div class="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-400">
                No matches found.
              </div>
            {:else}
              {#each validationResult.matches as match, index}
                <div class="rounded-xl border border-neutral-200 bg-white p-3">
                  <div class="flex items-center justify-between text-xs text-neutral-400">
                    <span># {index + 1}</span>
                    <span>Index {match.index}</span>
                  </div>
                  <div class="mt-2 rounded-lg bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-800 break-all">
                    {match.text || "(empty match)"}
                  </div>
                  {#if match.groups.length > 0}
                    <div class="mt-2 flex flex-wrap gap-2">
                      {#each match.groups as group, groupIndex}
                        <span class="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-600">
                          ${groupIndex + 1}: {group || "(empty)"}
                        </span>
                      {/each}
                    </div>
                  {/if}
                  {#if match.namedGroups}
                    <div class="mt-2 flex flex-wrap gap-2">
                      {#each Object.entries(match.namedGroups) as [name, value]}
                        <span class="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700">
                          {name}: {value || "(empty)"}
                        </span>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/each}
              {#if validationResult.truncated}
                <div class="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                  Match list truncated to {MATCH_LIMIT} results for performance.
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </div>
    </section>

    <!-- Generator -->
    <section class="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
        <h2 class="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-neutral-900">
          <Sparkles size={14} class="text-rose-600" />
          Generator
        </h2>
        <button
          onclick={resetBuilder}
          class="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-neutral-300 hover:text-neutral-900"
        >
          Reset
        </button>
      </div>

      <div class="space-y-6 p-6">
        <div class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Prefix</label>
              <input
                type="text"
                bind:value={builderPrefix}
                placeholder="Literal prefix"
                class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 outline-none transition focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-500/10"
              />
            </div>
            <div class="space-y-2">
              <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Suffix</label>
              <input
                type="text"
                bind:value={builderSuffix}
                placeholder="Literal suffix"
                class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 outline-none transition focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-500/10"
              />
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Character Set</label>
              <select
                bind:value={builderCharSet}
                class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-500/10"
              >
                <option value="digits">Digits (0-9)</option>
                <option value="letters">Letters (A-Z)</option>
                <option value="alnum">Alphanumeric</option>
                <option value="word">Word (\\w)</option>
                <option value="hex">Hex (0-9, A-F)</option>
                <option value="whitespace">Whitespace (\\s)</option>
                <option value="any">Any Character (.)</option>
                <option value="custom">Custom Class</option>
              </select>
            </div>
            {#if builderCharSet === "custom"}
              <div class="space-y-2">
                <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Custom Class</label>
                <input
                  type="text"
                  bind:value={builderCustomSet}
                  placeholder="e.g. a-z0-9_-"
                  class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 outline-none transition focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-500/10"
                />
              </div>
            {/if}
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Quantifier</label>
              <select
                bind:value={builderQuantifier}
                class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-500/10"
              >
                <option value="range">Range {"{min,max}"}</option>
                <option value="exact">Exact {"{n}"}</option>
                <option value="oneOrMore">One or More (+)</option>
                <option value="zeroOrMore">Zero or More (*)</option>
                <option value="optional">Optional (?)</option>
              </select>
            </div>
            <div class="space-y-2">
              {#if builderQuantifier === "exact"}
                <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Exact Length</label>
                <input
                  type="text"
                  inputmode="numeric"
                  bind:value={builderExact}
                  class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-500/10"
                />
              {:else if builderQuantifier === "range"}
                <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Min / Max</label>
                <div class="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    inputmode="numeric"
                    bind:value={builderMin}
                    placeholder="Min"
                    class="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-500/10"
                  />
                  <input
                    type="text"
                    inputmode="numeric"
                    bind:value={builderMax}
                    placeholder="Max"
                    class="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-500/10"
                  />
                </div>
              {:else}
                <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Length</label>
                <div class="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
                  No length needed
                </div>
              {/if}
            </div>
          </div>

          <div class="flex items-center gap-3">
            <input
              id="builder-anchors"
              type="checkbox"
              bind:checked={builderAnchors}
              class="h-4 w-4 rounded border-neutral-300 text-rose-600"
            />
            <label for="builder-anchors" class="text-sm font-medium text-neutral-600">
              Add ^ and $ anchors
            </label>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            {#each FLAG_META as flag}
              <button
                onclick={() => toggleBuilderFlag(flag.key)}
                title={flag.desc}
                class="rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all
                {builderFlags[flag.key]
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-800'}"
              >
                {flag.label}
              </button>
            {/each}
          </div>

          <div class="space-y-2">
            <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Sample Text (Optional)</label>
            <input
              type="text"
              bind:value={builderExample}
              placeholder="Optional sample to send to validator"
              class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 outline-none transition focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-500/10"
            />
          </div>

          <div class="space-y-2">
            <label class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Generated Regex</label>
            <div class="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-700">
              <span class="break-all">{generatedOutput.display || "/pattern/flags"}</span>
              <button
                onclick={handleCopyGenerated}
                class="ml-auto flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-500 transition hover:border-rose-200 hover:text-rose-600"
                disabled={!generatedOutput.display}
              >
                <Copy size={12} />
                {generatedCopyStatus}
              </button>
            </div>
            {#if generatedOutput.error}
              <div class="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
                {generatedOutput.error}
              </div>
            {/if}
            <button
              onclick={applyGeneratedToValidator}
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 active:scale-[0.98]"
              disabled={!generatedOutput.pattern}
            >
              <Check size={14} />
              Use In Validator
            </button>
          </div>
        </div>

        <div class="space-y-3">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Templates</h3>
          <div class="space-y-3">
            {#each presets as preset}
              <div class="rounded-xl border border-neutral-200 bg-white p-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p class="text-sm font-semibold text-neutral-900">{preset.name}</p>
                    <p class="text-xs text-neutral-400">{preset.description}</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      onclick={() => handleCopyPreset(preset)}
                      class="flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-500 transition hover:border-rose-200 hover:text-rose-600"
                    >
                      <Copy size={12} />
                      {presetCopyStatus === preset.name ? "Copied!" : "Copy"}
                    </button>
                    <button
                      onclick={() => applyPreset(preset)}
                      class="rounded-md bg-rose-600 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-rose-700"
                    >
                      Use
                    </button>
                  </div>
                </div>
                <div class="mt-2 rounded-lg bg-neutral-50 px-3 py-2 font-mono text-[11px] text-neutral-700 break-all">
                  /{preset.pattern}/{preset.flags}
                </div>
                <div class="mt-2 text-xs text-neutral-400">Example: {preset.example}</div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </section>
  </div>
</div>
