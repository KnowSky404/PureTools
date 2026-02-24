<script lang="ts">
import { copyToClipboard } from "$lib/utils/clipboard";

type HostKind = "github" | "raw" | "unknown";

let input = $state("");
let output = $state("");
let error = $state("");
let copyStatus = $state("Copy");

$effect(() => {
  const value = input.trim();

  const timer = setTimeout(() => {
    if (!value) {
      output = "";
      error = "";
      return;
    }

    try {
      const result = convertToJsdelivr(value);
      output = result;
      error = "";
    } catch (err) {
      output = "";
      error = err instanceof Error ? err.message : "Failed to convert URL";
    }
  }, 250);

  return () => clearTimeout(timer);
});

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
  input = "https://github.com/sveltejs/kit/blob/main/packages/kit/README.md";
}

function convertToJsdelivr(value: string): string {
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
  return convertRawUrl(url);
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

function convertGitHubUrl(url: URL): string {
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
      return buildJsdelivrBaseUrl(owner, repo, ref);
    }
    return buildJsdelivrUrl(owner, repo, ref, pathSegments);
  }

  if (type === "releases") {
    const [releaseKind, tag, ...pathSegments] = rest;
    if (!releaseKind || !tag) {
      throw new Error("Release URLs must include a tag.");
    }
    if (releaseKind === "tag") {
      return buildJsdelivrBaseUrl(owner, repo, tag);
    }
    if (releaseKind === "download") {
      if (pathSegments.length === 0) {
        throw new Error("Release download URL must include a file path.");
      }
      return buildJsdelivrUrl(owner, repo, tag, pathSegments);
    }
    throw new Error("Unsupported release URL. Use /releases/tag or /releases/download.");
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
    return buildJsdelivrBaseUrl(owner, repo, ref);
  }

  return buildJsdelivrUrl(owner, repo, ref, pathSegments);
}

function buildJsdelivrBaseUrl(owner: string, repo: string, ref: string): string {
  return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}/`;
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

<div class="mx-auto max-w-4xl p-6">
  <div class="mb-8 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-slate-900">GitHub to jsDelivr</h1>
      <p class="text-slate-500">Convert GitHub file links into jsDelivr CDN URLs.</p>
    </div>
    <a href="/" class="text-sm font-medium text-indigo-600 hover:text-indigo-500">
      ← Back to Tools
    </a>
  </div>

  <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div class="flex flex-wrap items-center gap-2">
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
      <div class="text-xs text-slate-500">GitHub URL</div>
      <textarea
        bind:value={input}
        placeholder="https://github.com/owner/repo/blob/branch/path/file.js or https://github.com/owner/repo/releases/tag/v1.0.0"
        class="min-h-[220px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      ></textarea>
      {#if error}
        <p class="text-sm font-medium text-red-600">{error}</p>
      {:else if input.trim()}
        <p class="text-sm font-medium text-green-600">Valid GitHub link</p>
        {#if output.endsWith("/")}
          <p class="text-xs text-slate-500">
            Tip: append a file path after the trailing slash to get a direct file CDN URL.
          </p>
        {/if}
      {/if}
    </div>

    <div class="flex flex-col gap-3">
      <div class="text-xs text-slate-500">jsDelivr CDN URL</div>
      <textarea
        readonly
        value={output}
        placeholder="https://cdn.jsdelivr.net/gh/owner/repo@branch/path/file.js"
        class="min-h-[220px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-900 shadow-sm focus:outline-none"
      ></textarea>
    </div>
  </div>
</div>
