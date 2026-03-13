<script lang="ts">
import "./layout.css";
import { ChevronDown, Command, Github, Search } from "lucide-svelte";
import { page } from "$app/state";
import favicon from "$lib/assets/favicon.svg";
import { tools } from "$lib/utils/tools";

const { children } = $props();

let toolsOpen = $state(false);
let toolsMenu = $state<HTMLDivElement | null>(null);

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

function toggleTools(): void {
  toolsOpen = !toolsOpen;
}

function closeTools(): void {
  toolsOpen = false;
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
              <div class="max-h-[60vh] overflow-auto p-3 sm:p-4">
                <div class="grid gap-2 sm:grid-cols-2">
                  {#each tools as tool}
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
        <button class="hidden h-9 w-40 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-400 transition-colors hover:border-neutral-300 sm:flex lg:w-64">
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
