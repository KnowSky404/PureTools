<script lang="ts">
import "./layout.css";
import { ChevronDown, Command, Github, Search, X } from "lucide-svelte";
import { page } from "$app/state";
import favicon from "$lib/assets/favicon.svg";
import { type Tool, toolCategories, tools } from "$lib/utils/tools";

const { children } = $props();

let toolsOpen = $state(false);
let toolQuery = $state("");
let toolsMenu = $state<HTMLDivElement | null>(null);
let searchInput = $state<HTMLInputElement | null>(null);

$effect(() => {
  if (!toolsOpen) {
    toolQuery = "";
  }
});

$effect(() => {
  const handleGlobalSearch = (event: KeyboardEvent) => {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
      return;
    }
    if (isTypingTarget(event.target)) {
      return;
    }
    event.preventDefault();
    openToolsWithSearch();
  };
  document.addEventListener("keydown", handleGlobalSearch);
  return () => document.removeEventListener("keydown", handleGlobalSearch);
});

$effect(() => {
  if (!toolsOpen) {
    return;
  }
  const handleClick = (event: MouseEvent) => {
    if (!toolsMenu) {
      return;
    }
    if (!toolsMenu.contains(event.target as Node)) {
      toolsOpen = false;
    }
  };
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      toolsOpen = false;
    }
  };
  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", handleKeydown);
  return () => {
    document.removeEventListener("click", handleClick);
    document.removeEventListener("keydown", handleKeydown);
  };
});

const normalizedQuery = $derived.by(() => toolQuery.trim().toLowerCase());

const filteredTools = $derived.by(() => {
  if (!normalizedQuery) {
    return tools;
  }
  return tools.filter((tool) => matchesQuery(tool, normalizedQuery));
});

const groupedTools = $derived.by(() => {
  const groups = new Map<string, Tool[]>();
  for (const tool of filteredTools) {
    const group = groups.get(tool.category) ?? [];
    group.push(tool);
    groups.set(tool.category, group);
  }
  return toolCategories
    .filter((category) => groups.has(category))
    .map((category) => ({
      category,
      items: groups.get(category) ?? [],
    }));
});

function toggleTools(): void {
  toolsOpen = !toolsOpen;
}

function openToolsWithSearch(): void {
  toolsOpen = true;
  setTimeout(() => searchInput?.focus(), 0);
}

function closeTools(): void {
  toolsOpen = false;
}

function clearSearch(): void {
  toolQuery = "";
  searchInput?.focus();
}

function matchesQuery(tool: Tool, query: string): boolean {
  const haystack = [tool.name, tool.description, tool.category, tool.href, ...tool.keywords]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") {
    return true;
  }
  return target.isContentEditable;
}
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>PureTools | Lightweight Developer Toolset</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-neutral-50 selection:bg-indigo-100 selection:text-indigo-900">
  <!-- Header -->
  <header class="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-md">
    <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <div class="flex items-center gap-4">
        <a href="/" class="flex items-center gap-2 group">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm transition-transform group-hover:scale-105">
            <span class="font-bold text-lg">P</span>
          </div>
          <span class="hidden font-bold tracking-tight text-neutral-900 sm:inline-block">PureTools</span>
        </a>

        <div class="relative" bind:this={toolsMenu}>
          <button
            onclick={toggleTools}
            class="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
          >
            Tools
            <ChevronDown size={14} class="transition-transform {toolsOpen ? 'rotate-180' : ''}" />
          </button>

          {#if toolsOpen}
            <div class="absolute left-1/2 top-full z-50 mt-3 w-[90vw] max-w-2xl -translate-x-1/2 rounded-2xl border border-neutral-200 bg-white shadow-xl sm:left-0 sm:translate-x-0">
              <div class="border-b border-neutral-200 p-3 sm:p-4">
                <div class="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <Search size={14} class="text-neutral-400" />
                  <input
                    bind:this={searchInput}
                    bind:value={toolQuery}
                    placeholder="Search tools..."
                    class="w-full bg-transparent text-sm text-neutral-700 outline-none"
                  />
                  {#if toolQuery}
                    <button
                      onclick={clearSearch}
                      class="rounded-md p-1 text-neutral-400 transition hover:text-neutral-600"
                    >
                      <X size={14} />
                    </button>
                  {/if}
                </div>
                <div class="mt-2 text-xs text-neutral-400">Search by name, keyword, or category.</div>
              </div>

              <div class="max-h-[60vh] overflow-auto p-3 sm:p-4">
                {#if groupedTools.length === 0}
                  <div class="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-400">
                    No tools match “{toolQuery}”.
                  </div>
                {:else}
                  <div class="space-y-4">
                    {#each groupedTools as group}
                      <div class="space-y-2">
                        <div class="px-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                          {group.category}
                        </div>
                        <div class="grid gap-2 sm:grid-cols-2">
                          {#each group.items as tool}
                            <a
                              href={tool.href}
                              onclick={closeTools}
                              class="group flex items-start gap-3 rounded-xl border border-transparent p-3 transition hover:border-neutral-200 hover:bg-neutral-50 {page.url.pathname === tool.href ? 'border-neutral-200 bg-neutral-50' : ''}"
                            >
                              <div class="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border {tool.color} {tool.hoverColor}">
                                <tool.icon size={18} />
                              </div>
                              <div class="min-w-0">
                                <div class="text-sm font-semibold text-neutral-900">{tool.name}</div>
                                <div class="text-xs text-neutral-500">{tool.description}</div>
                              </div>
                            </a>
                          {/each}
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
              <div class="border-t border-neutral-200 px-4 py-3 text-xs text-neutral-500">
                <a
                  href="/"
                  onclick={closeTools}
                  class="font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Browse all tools →
                </a>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <div class="flex items-center gap-4">
        <!-- Search placeholder -->
        <button
          onclick={openToolsWithSearch}
          class="hidden h-9 w-40 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-400 transition-colors hover:border-neutral-300 sm:flex lg:w-64"
        >
          <Search size={14} />
          <span class="flex-1 text-left">Search tools...</span>
          <div class="flex items-center gap-0.5 rounded border border-neutral-200 bg-white px-1 py-0.5 text-[10px] font-medium">
            <Command size={10} />
            <span>K</span>
          </div>
        </button>

        <a
          href="https://github.com/KnowSky404/PureTools"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          title="GitHub Repository"
        >
          <Github size={20} />
        </a>
      </div>
    </div>
  </header>

  <main class="flex-1">
    {@render children()}
  </main>

  <!-- Footer -->
  <footer class="border-t border-neutral-200 bg-white">
    <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p class="text-sm text-neutral-500">
          &copy; {new Date().getFullYear()} PureTools. Privacy-focused & Pure Frontend.
        </p>
        <div class="flex items-center gap-6 text-sm text-neutral-500">
          <a href="/" class="hover:text-indigo-600">Home</a>
          <a href="https://github.com/KnowSky404/PureTools" target="_blank" class="hover:text-indigo-600">Source</a>
          <span class="flex items-center gap-1.5">
            <span class="inline-block h-2 w-2 rounded-full bg-green-500"></span>
            Cloudflare Pages
          </span>
        </div>
      </div>
    </div>
  </footer>
</div>
