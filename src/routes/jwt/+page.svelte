<script lang="ts">
import { AlertCircle, Check, Copy, ShieldCheck, Trash2 } from "lucide-svelte";
import { copyToClipboard } from "$lib/utils/clipboard";

type TimeClaim = {
  key: string;
  value: number;
  local: string;
  utc: string;
};

type JwtResult =
  | { status: "empty" }
  | { status: "invalid"; message: string }
  | {
      status: "valid";
      header: string;
      payload: string;
      signature: string;
      timeClaims: TimeClaim[];
    };

let input = $state("");
let result = $state<JwtResult>({ status: "empty" });
let headerCopyStatus = $state("Copy");
let payloadCopyStatus = $state("Copy");
let signatureCopyStatus = $state("Copy");

const validResult = $derived.by(() => (result.status === "valid" ? result : null));

$effect(() => {
  const raw = input.trim();
  const timer = setTimeout(() => {
    result = decodeJwt(raw);
  }, 250);

  return () => clearTimeout(timer);
});

function decodeJwt(token: string): JwtResult {
  if (!token) {
    return { status: "empty" };
  }

  const parts = token.split(".");
  if (parts.length < 2 || parts.length > 3) {
    return { status: "invalid", message: "JWT must have 2 or 3 segments." };
  }

  try {
    const headerText = decodeBase64UrlToString(parts[0]);
    const payloadText = decodeBase64UrlToString(parts[1]);
    const headerJson = safeJsonParse(headerText, "Header");
    if (headerJson.error) {
      return { status: "invalid", message: headerJson.error };
    }
    const payloadJson = safeJsonParse(payloadText, "Payload");
    if (payloadJson.error) {
      return { status: "invalid", message: payloadJson.error };
    }

    const headerPretty = JSON.stringify(headerJson.value, null, 2);
    const payloadPretty = JSON.stringify(payloadJson.value, null, 2);
    const signature = parts[2] ?? "";

    return {
      status: "valid",
      header: headerPretty,
      payload: payloadPretty,
      signature,
      timeClaims: buildTimeClaims(payloadJson.value),
    };
  } catch (err) {
    return {
      status: "invalid",
      message: err instanceof Error ? err.message : "Invalid JWT token.",
    };
  }
}

function decodeBase64UrlToString(value: string): string {
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  if (padding) {
    normalized += "=".repeat(4 - padding);
  }
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

type JsonParseResult = { value?: unknown; error?: string };

function safeJsonParse(value: string, label: string): JsonParseResult {
  try {
    return { value: JSON.parse(value) };
  } catch (err) {
    return {
      error: `${label} is not valid JSON: ${err instanceof Error ? err.message : "Parse error"}`,
    };
  }
}

function buildTimeClaims(payload: unknown): TimeClaim[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const record = payload as Record<string, unknown>;
  const keys = ["exp", "iat", "nbf"];
  const results: TimeClaim[] = [];

  for (const key of keys) {
    const value = record[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      continue;
    }
    const ms = value > 1e12 ? value : value * 1000;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) {
      continue;
    }
    results.push({
      key,
      value,
      local: date.toLocaleString(),
      utc: date.toUTCString(),
    });
  }

  return results;
}

async function handleCopy(
  value: string,
  target: "header" | "payload" | "signature",
): Promise<void> {
  if (!value) {
    return;
  }
  const success = await copyToClipboard(value);
  if (target === "header") {
    headerCopyStatus = success ? "Copied!" : "Copy failed";
    setTimeout(() => (headerCopyStatus = "Copy"), 1500);
  } else if (target === "payload") {
    payloadCopyStatus = success ? "Copied!" : "Copy failed";
    setTimeout(() => (payloadCopyStatus = "Copy"), 1500);
  } else {
    signatureCopyStatus = success ? "Copied!" : "Copy failed";
    setTimeout(() => (signatureCopyStatus = "Copy"), 1500);
  }
}

function handleClear(): void {
  input = "";
  result = { status: "empty" };
}
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <div class="mb-6 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2 text-xs text-neutral-500">
        <ShieldCheck size={14} class="text-amber-500" />
        All decoding runs locally in your browser.
      </div>
      <button
        onclick={handleClear}
        class="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-red-200 hover:text-red-600"
      >
        <Trash2 size={12} />
        Clear
      </button>
    </div>
  </div>

  <section class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
    <div class="mb-2 flex items-center justify-between">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">JWT</h2>
      {#if input}
        <span class="text-xs text-neutral-400">{input.length} chars</span>
      {/if}
    </div>
    <textarea
      rows={4}
      bind:value={input}
      placeholder="Paste JWT here..."
      class="w-full resize-y rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-500/10"
    ></textarea>
  </section>

  <div class="mt-6 rounded-2xl border border-neutral-200 bg-white p-4">
    {#if result.status === "empty"}
      <div class="text-sm text-neutral-400">Waiting for a JWT token.</div>
    {:else if result.status === "invalid"}
      <div class="flex items-start gap-2 text-sm font-semibold text-red-600">
        <AlertCircle size={16} class="mt-0.5" />
        {result.message}
      </div>
    {:else}
      <div class="flex flex-wrap items-center gap-2 text-sm font-semibold text-emerald-600">
        <Check size={16} />
        JWT decoded successfully
      </div>
      <div class="mt-2 text-xs text-neutral-500">
        Signature: {result.signature ? "present" : "missing"} ({result.signature.length} chars)
      </div>
    {/if}
  </div>

  {#if validResult}
    <div class="mt-6 grid gap-6 lg:grid-cols-2">
      <section class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Header</h3>
          <button
            onclick={() => handleCopy(validResult.header, "header")}
            class="flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-500 transition hover:border-amber-200 hover:text-amber-600"
          >
            <Copy size={12} />
            {headerCopyStatus}
          </button>
        </div>
        <pre class="max-h-[320px] overflow-auto rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-700">
{validResult.header}
        </pre>
      </section>

      <section class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Payload</h3>
          <button
            onclick={() => handleCopy(validResult.payload, "payload")}
            class="flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-500 transition hover:border-amber-200 hover:text-amber-600"
          >
            <Copy size={12} />
            {payloadCopyStatus}
          </button>
        </div>
        <pre class="max-h-[320px] overflow-auto rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-700">
{validResult.payload}
        </pre>

        {#if validResult.timeClaims.length > 0}
          <div class="mt-4 space-y-2">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Time Claims</h4>
            {#each validResult.timeClaims as claim}
              <div class="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                <div class="font-semibold text-neutral-800">{claim.key}: {claim.value}</div>
                <div class="text-neutral-500">Local: {claim.local}</div>
                <div class="text-neutral-500">UTC: {claim.utc}</div>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    </div>

    <section class="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Signature</h3>
        <button
          onclick={() => handleCopy(validResult.signature, "signature")}
          class="flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-500 transition hover:border-amber-200 hover:text-amber-600"
          disabled={!validResult.signature}
        >
          <Copy size={12} />
          {signatureCopyStatus}
        </button>
      </div>
      <div class="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-xs text-neutral-700 break-all">
        {validResult.signature || "(no signature segment)"}
      </div>
    </section>
  {/if}
</div>
