<script lang="ts">
import {
  AlertCircle,
  Check,
  Code,
  Copy,
  ExternalLink,
  Github,
  Globe,
  Link2,
  Trash2,
  Zap,
} from "lucide-svelte";
import { copyToClipboard } from "$lib/utils/clipboard";

type HostKind = "github" | "raw" | "unknown";

let input = $state("");
let rawOutput = $state("");
let cdnOutput = $state("");
let error = $state("");
let rawCopyStatus = $state("Copy Raw");
let cdnCopyStatus = $state("Copy CDN");
let rawNotice = $state("");
let cdnNotice = $state("");

$effect(() => {
  const value = input.trim();

  const timer = setTimeout(() => {
    if (!value) {
      rawOutput = "";
      cdnOutput = "";
      rawNotice = "";
      cdnNotice = "";
      error = "";
      return;
    }

    try {
      const result = convertToJsdelivr(value);
      rawOutput = result.rawUrl;
      cdnOutput = result.cdnUrl;
      rawNotice = result.rawNotice;
      cdnNotice = result.cdnNotice;
      error = "";
    } catch (err) {
      rawOutput = "";
      cdnOutput = "";
      rawNotice = "";
      cdnNotice = "";
      error = err instanceof Error ? err.message : "Failed to convert URL";
    }
  }, 250);

  return () => clearTimeout(timer);
});

async function handleCopyRaw() {
  if (!rawOutput) {
    return;
  }
  const success = await copyToClipboard(rawOutput);
  rawCopyStatus = success ? "Copied!" : "Copy failed";
  setTimeout(() => (rawCopyStatus = "Copy Raw"), 1500);
}

async function handleCopyCdn() {
  if (!cdnOutput) {
    return;
  }
  const success = await copyToClipboard(cdnOutput);
  cdnCopyStatus = success ? "Copied!" : "Copy failed";
  setTimeout(() => (cdnCopyStatus = "Copy CDN"), 1500);
}

function handleClear() {
  input = "";
  rawOutput = "";
  cdnOutput = "";
  rawNotice = "";
  cdnNotice = "";
  error = "";
}

function handleExample() {
  input = "https://github.com/sveltejs/kit/blob/main/packages/kit/README.md";
}

type ConvertResult = {
  rawUrl: string;
  cdnUrl: string;
  rawNotice: string;
  cdnNotice: string;
};

function convertToJsdelivr(value: string): ConvertResult {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Please enter a valid GitHub file URL.");
  }
  const hostKind = detectHostKind(url.hostname);
  if (hostKind === "unknown") {
    throw new Error("Only github.com or raw.githubusercontent.com links are supported.");
  }
  if (hostKind === "github") {
    return convertGitHubUrl(url);
  }
  const rawUrl = convertRawUrl(url);
  const cdnUrl = convertRawToJsdelivr(url);
  return { rawUrl, cdnUrl, rawNotice: "", cdnNotice: "" };
}

function detectHostKind(hostname: string): HostKind {
  if (hostname === "github.com") {
    return "github";
  }
  if (hostname === "raw.githubusercontent.com") {
    return "raw";
  }
  return "unknown";
}

function convertGitHubUrl(url: URL): ConvertResult {
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 3) {
    throw new Error("Please use a valid GitHub repository URL.");
  }
  const [owner, repo, type, ...rest] = segments;

  if (type === "blob" || type === "tree") {
    const [ref, ...pathSegments] = rest;
    if (!ref) {
      throw new Error("Missing branch or tag in the GitHub URL.");
    }
    if (pathSegments.length === 0) {
      return {
        rawUrl: "",
        cdnUrl: buildJsdelivrBaseUrl(owner, repo, ref),
        rawNotice: "Raw URLs require a file path.",
        cdnNotice: "",
      };
    }
    return {
      rawUrl: buildRawUrl(owner, repo, ref, pathSegments),
      cdnUrl: buildJsdelivrUrl(owner, repo, ref, pathSegments),
      rawNotice: "",
      cdnNotice: "",
    };
  }

  if (type === "releases") {
    const [releaseKind, tag, ...pathSegments] = rest;
    if (!releaseKind || !tag) {
      throw new Error("Release URLs must include a tag.");
    }
    if (releaseKind === "tag") {
      const baseUrl = buildJsdelivrBaseUrl(owner, repo, tag);
      return {
        rawUrl: "",
        cdnUrl: pathSegments.length ? buildJsdelivrUrl(owner, repo, tag, pathSegments) : baseUrl,
        rawNotice: "Release pages do not provide raw file URLs.",
        cdnNotice: "Using the tag for CDN. Release assets are not supported by jsDelivr.",
      };
    }
    if (releaseKind === "download") {
      if (pathSegments.length === 0) {
        throw new Error("Release download URL must include a file path.");
      }
      return {
        rawUrl: "",
        cdnUrl: buildJsdelivrUrl(owner, repo, "releases", ["download", tag, ...pathSegments]),
        rawNotice: "Release assets do not have raw URLs.",
        cdnNotice:
          "jsDelivr does not serve GitHub release assets. Use the GitHub release URL instead.",
      };
    }
    throw new Error("Unsupported release URL.");
  }
  throw new Error("Only GitHub blob/tree or release URLs can be converted.");
}

function convertRawUrl(url: URL): string {
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 4) {
    throw new Error("Raw GitHub URL is missing required segments.");
  }
  const [owner, repo, ref, ...pathSegments] = segments;
  if (pathSegments.length === 0) {
    throw new Error("Raw GitHub URL must include a file path.");
  }
  return buildRawUrl(owner, repo, ref, pathSegments);
}

function convertRawToJsdelivr(url: URL): string {
  const segments = url.pathname.split("/").filter(Boolean);
  const [owner, repo, ref, ...pathSegments] = segments;
  return buildJsdelivrUrl(owner, repo, ref, pathSegments);
}

function buildJsdelivrBaseUrl(owner: string, repo: string, ref: string): string {
  return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}/`;
}

function buildRawUrl(owner: string, repo: string, ref: string, pathSegments: string[]): string {
  const encodedPath = pathSegments.map((segment) => encodeURIComponent(segment)).join("/");
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${encodedPath}`;
}

function buildJsdelivrUrl(
  owner: string,
  repo: string,
  ref: string,
  pathSegments: string[],
): string {
  const encodedPath = pathSegments.map((segment) => encodeURIComponent(segment)).join("/");
  return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}/${encodedPath}`;
}
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <!-- Header Section -->
  <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex items-center gap-4">
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 ring-1 ring-purple-100">
        <Link2 size={24} />
      </div>
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-neutral-900">GitHub CDN</h1>
        <p class="text-sm text-neutral-500 font-medium">Convert GitHub file links to jsDelivr CDN URLs</p>
      </div>
    </div>
  </div>

  <div class="grid gap-8 lg:grid-cols-2 lg:h-[calc(100vh-280px)] min-h-[500px]">
    <!-- Input Panel -->
    <div class="flex flex-col gap-4 h-full">
      <div class="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
        <span class="flex items-center gap-1.5">
          <Github size={12} />
          GitHub File URL
        </span>
      </div>
      
      <div class="flex flex-col flex-1 gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-all focus-within:ring-4 focus-within:ring-indigo-500/5 focus-within:border-indigo-500/50">
        <textarea
          bind:value={input}
          placeholder="Paste GitHub link here... (blob/tree/raw)"
          class="flex-1 resize-none bg-transparent font-mono text-sm leading-relaxed text-neutral-900 outline-none placeholder:text-neutral-300"
        ></textarea>
        
        <div class="flex items-center justify-between pt-4 border-t border-neutral-50">
          <div class="flex gap-2">
            <button
              onclick={handleExample}
              class="flex items-center gap-1.5 rounded-xl bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-700 transition-all hover:bg-neutral-200 active:scale-95"
            >
              <Zap size={14} class="text-purple-600" />
              Example
            </button>
            <button
              onclick={handleClear}
              class="flex items-center gap-1.5 rounded-xl border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-500 transition-all hover:bg-neutral-50 hover:text-red-600 active:scale-95"
            >
              <Trash2 size={14} />
              Clear
            </button>
          </div>
          
          {#if error}
            <div class="flex items-center gap-2 text-red-600">
              <AlertCircle size={16} />
              <span class="text-xs font-bold">{error}</span>
            </div>
          {:else if input.trim()}
             <div class="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-[10px] font-bold text-green-700 uppercase tracking-wider">
               <Check size={12} /> Valid Format
             </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Output Panel -->
    <div class="flex flex-col gap-6 h-full">
      <!-- jsDelivr CDN -->
      <div class="flex flex-col flex-1 gap-3">
        <div class="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
          <span class="flex items-center gap-1.5 text-indigo-600">
            <Globe size={12} />
            jsDelivr CDN URL (Fast)
          </span>
          <button
            onclick={handleCopyCdn}
            disabled={!cdnOutput}
            class="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
          >
            {#if cdnCopyStatus === "Copied!"}
              <Check size={12} />
            {:else}
              <Copy size={12} />
            {/if}
            {cdnCopyStatus}
          </button>
        </div>
        <div class="flex-1 rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4 shadow-inner">
          <textarea
            readonly
            value={cdnOutput}
            placeholder="CDN link will appear here..."
            class="h-full w-full resize-none bg-transparent font-mono text-sm leading-relaxed text-indigo-900 outline-none placeholder:text-indigo-300"
          ></textarea>
        </div>
        {#if cdnNotice}
          <div class="flex items-start gap-2 px-2 text-[10px] font-bold text-amber-600 uppercase tracking-wider">
            <AlertCircle size={12} class="shrink-0" />
            {cdnNotice}
          </div>
        {/if}
      </div>

      <!-- GitHub Raw -->
      <div class="flex flex-col flex-1 gap-3">
        <div class="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
          <span class="flex items-center gap-1.5">
            <Code size={12} />
            GitHub Raw URL
          </span>
          <button
            onclick={handleCopyRaw}
            disabled={!rawOutput}
            class="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-1 text-[11px] font-bold text-neutral-600 transition-all hover:bg-neutral-200 active:scale-95 disabled:opacity-50"
          >
            {#if rawCopyStatus === "Copied!"}
              <Check size={12} />
            {:else}
              <Copy size={12} />
            {/if}
            {rawCopyStatus}
          </button>
        </div>
        <div class="flex-1 rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4 shadow-inner">
          <textarea
            readonly
            value={rawOutput}
            placeholder="Raw link will appear here..."
            class="h-full w-full resize-none bg-transparent font-mono text-sm leading-relaxed text-neutral-600 outline-none placeholder:text-neutral-300"
          ></textarea>
        </div>
        {#if rawNotice}
           <div class="flex items-start gap-2 px-2 text-[10px] font-bold text-amber-600 uppercase tracking-wider">
            <AlertCircle size={12} class="shrink-0" />
            {rawNotice}
          </div>
        {/if}
      </div>
      
      <div class="rounded-xl bg-neutral-100/50 p-4 border border-neutral-200">
        <p class="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2 mb-2">
          <ExternalLink size={12} /> Why use jsDelivr?
        </p>
        <p class="text-[11px] text-neutral-500 leading-relaxed">
          GitHub Raw URLs have strict rate limits and don't serve proper content-types for some files. jsDelivr provides a high-performance global CDN with no rate limits.
        </p>
      </div>
    </div>
  </div>
</div>
