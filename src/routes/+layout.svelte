<script lang="ts">
import "./layout.css";
import { ChevronDown, Github, Grid2X2, MoonStar, Search, Sun, SunMoon, X } from "lucide-svelte";
import { onMount, type Snippet, tick } from "svelte";
import { afterNavigate } from "$app/navigation";
import { page } from "$app/state";
import { navGroups, type Tool, type ToolCategory, toolCategories, tools } from "$lib/utils/tools";

const { children }: { children: Snippet } = $props();
type ActiveMenu = (typeof navGroups)[number]["id"] | "tools" | "search" | null;
let activeMenu = $state<ActiveMenu>(null);
let toolQuery = $state("");
let popup = $state<HTMLDivElement>();
let menuTrigger: HTMLButtonElement | undefined;
let searchButton: HTMLButtonElement | undefined;
let searchInput = $state<HTMLInputElement>();
let themeMode = $state<"system" | "light" | "dark">("system");
let prefersDark = $state(false);
let themeInitialized = $state(false);

onMount(() => {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") {
      themeMode = stored;
    }
  } catch {
    // Theme controls still work when browser storage is blocked.
  }
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const update = (): void => {
    prefersDark = media.matches;
  };
  update();
  themeInitialized = true;
  media.addEventListener("change", update);
  const wide = window.matchMedia("(min-width: 1280px)");
  const closeOnResize = (): void => closeMenus();
  wide.addEventListener("change", closeOnResize);
  return () => {
    media.removeEventListener("change", update);
    wide.removeEventListener("change", closeOnResize);
  };
});

afterNavigate(() => closeMenus());

$effect(() => {
  if (!themeInitialized) {
    return;
  }
  const useDark = themeMode === "dark" || (themeMode === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", useDark);
  document.documentElement.style.colorScheme = useDark ? "dark" : "light";
  try {
    if (themeMode === "system") {
      localStorage.removeItem("theme");
    } else {
      localStorage.setItem("theme", themeMode);
    }
  } catch {
    // Keep the in-memory theme preference.
  }
});

const normalizedQuery = $derived(toolQuery.trim().toLowerCase());
const filteredTools = $derived(
  tools.filter((tool) =>
    [tool.name, tool.description, tool.category, tool.href, ...tool.keywords]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery),
  ),
);
const searchGroups = $derived(
  toolCategories
    .map((category) => ({
      category,
      items: filteredTools.filter((tool) => tool.category === category),
    }))
    .filter((group) => group.items.length),
);
const visibleGroups = $derived(
  navGroups.filter((group) => activeMenu === "tools" || group.id === activeMenu),
);
const activeGroup = $derived(navGroups.find((group) => group.id === activeMenu));

function closeMenus(restoreFocus = false): void {
  activeMenu = null;
  toolQuery = "";
  if (restoreFocus) {
    menuTrigger?.focus();
  }
}

async function openMenu(
  menu: ActiveMenu,
  trigger: HTMLButtonElement | undefined,
  focusFirst = false,
): Promise<void> {
  if (activeMenu === menu && !focusFirst) {
    closeMenus();
    return;
  }
  menuTrigger = trigger;
  activeMenu = menu;
  toolQuery = "";
  await tick();
  if (activeMenu !== menu) {
    return;
  }
  if (menu === "search") {
    searchInput?.focus();
  } else if (focusFirst) {
    popup?.querySelector<HTMLAnchorElement>("a[href]")?.focus();
  }
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && activeMenu) {
    event.preventDefault();
    closeMenus(true);
    return;
  }
  if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
    return;
  }
  if (
    event.target instanceof HTMLElement &&
    (event.target.closest("input, textarea, select") || event.target.isContentEditable)
  ) {
    return;
  }
  event.preventDefault();
  void openMenu("search", searchButton, true);
}

function handleOutside(event: PointerEvent | FocusEvent): void {
  if (
    activeMenu &&
    event.target instanceof Node &&
    !popup?.contains(event.target) &&
    !menuTrigger?.contains(event.target)
  ) {
    closeMenus();
  }
}

function triggerKeydown(event: KeyboardEvent, menu: ActiveMenu): void {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    void openMenu(menu, event.currentTarget as HTMLButtonElement, true);
  }
}

function cycleTheme(): void {
  themeMode = themeMode === "system" ? "light" : themeMode === "light" ? "dark" : "system";
}
</script>

<svelte:window onkeydown={handleGlobalKeydown} onpointerdown={handleOutside} onfocusin={handleOutside} />

<svelte:head>
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" href="/favicon.png" type="image/png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <title>PureTools | Lightweight Developer Toolset</title>
</svelte:head>

{#snippet toolLink(tool: Tool)}
  <a href={tool.href} onclick={() => closeMenus()} aria-current={page.url.pathname === tool.href ? "page" : undefined} class="group flex items-start gap-3 rounded-xl border p-3 transition focus-visible:outline-2 focus-visible:outline-indigo-500 {page.url.pathname === tool.href ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/10' : 'border-transparent hover:border-neutral-200 hover:bg-neutral-50'}">
    <div class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border {tool.color} {tool.hoverColor}"><tool.icon size={18} /></div>
    <div class="min-w-0">
      <div class="text-sm font-semibold text-neutral-900">{tool.name}</div>
      <div class="mt-0.5 text-xs text-neutral-500">{tool.description}</div>
    </div>
  </a>
{/snippet}

{#snippet categoryLinks(category: ToolCategory)}
  <div class="space-y-1">
    <h3 class="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{category}</h3>
    {#each tools.filter((tool) => tool.category === category) as tool}{@render toolLink(tool)}{/each}
  </div>
{/snippet}

<div class="flex min-h-screen flex-col bg-neutral-50 selection:bg-indigo-100 selection:text-indigo-900 dark:bg-neutral-950 dark:selection:bg-indigo-500/30 dark:selection:text-indigo-200">
  <header class="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur-md dark:bg-neutral-950/95">
    <div class="relative mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
      <a href="/" class="group flex shrink-0 items-center gap-2" aria-label="PureTools home">
        <img src="/brand/puretools-logo.png" alt="" width="32" height="32" class="h-8 w-8 transition-transform group-hover:scale-105" />
        <span class="hidden font-bold tracking-tight text-neutral-900 sm:inline-block">PureTools</span>
      </a>
      <nav aria-label="Tools navigation" class="flex min-w-0 items-center gap-2">
        <div class="hidden items-center gap-2 xl:flex">
          {#each navGroups as group}
            {@const isCurrent = tools.some((tool) => tool.href === page.url.pathname && group.categories.some((category) => category === tool.category))}
            <button onclick={(event) => openMenu(group.id, event.currentTarget)} onkeydown={(event) => triggerKeydown(event, group.id)} aria-expanded={activeMenu === group.id} aria-controls="tools-panel" class="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-indigo-500 {activeMenu === group.id || isCurrent ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-100'}">
              {group.name}<ChevronDown size={14} class={activeMenu === group.id ? "rotate-180" : ""} />
            </button>
          {/each}
        </div>
        <button onclick={(event) => openMenu("tools", event.currentTarget)} onkeydown={(event) => triggerKeydown(event, "tools")} aria-expanded={activeMenu === "tools"} aria-controls="tools-panel" class="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-indigo-500 xl:hidden"><Grid2X2 size={16} /> Tools <ChevronDown size={12} /></button>
        <button bind:this={searchButton} onclick={(event) => openMenu("search", event.currentTarget)} aria-label="Search" title="Search tools (/)" aria-expanded={activeMenu === "search"} aria-controls="tools-panel" class="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-indigo-500 sm:px-3"><Search size={18} /><span class="hidden sm:inline">Search</span></button>
      </nav>
      <div class="flex shrink-0 items-center gap-1 sm:gap-2">
        <button onclick={cycleTheme} class="rounded-lg border border-neutral-200 bg-white p-2 text-neutral-600 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-indigo-500" aria-label={`Theme: ${themeMode} (click to switch)`} title={`Theme: ${themeMode} (click to switch)`}>
          {#if themeMode === "system"}<SunMoon size={18} />{:else if themeMode === "dark"}<MoonStar size={18} />{:else}<Sun size={18} />{/if}
        </button>
        <a href="https://github.com/KnowSky404/PureTools" target="_blank" rel="noopener noreferrer" class="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-indigo-500" aria-label="GitHub Repository" title="GitHub Repository"><Github size={20} /></a>
      </div>

      {#if activeMenu}
        <div id="tools-panel" bind:this={popup} role="region" aria-label={activeMenu === "search" ? "Tool search" : activeMenu === "tools" ? "All tools" : activeGroup?.name} class="absolute inset-x-4 top-full z-50 mx-auto mt-2 max-h-[calc(100dvh-5rem)] max-w-3xl overflow-y-auto overscroll-contain rounded-2xl border border-neutral-200 bg-white shadow-xl sm:inset-x-6">
          <div class="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
            <h2 class="text-sm font-semibold text-neutral-900">{activeMenu === "search" ? "Search tools" : activeMenu === "tools" ? "All tools" : activeGroup?.name}</h2>
            <button onclick={() => closeMenus(true)} aria-label="Close tools menu" class="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"><X size={18} /></button>
          </div>
          {#if activeMenu === "search"}
            <div class="border-b border-neutral-200 p-3 sm:p-4">
              <div class="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                <Search size={16} class="shrink-0 text-neutral-500" />
                <input bind:this={searchInput} bind:value={toolQuery} aria-label="Search tools" placeholder="Search tools..." class="w-full min-w-0 bg-transparent text-sm text-neutral-900 outline-none" />
                {#if toolQuery}<button onclick={() => { toolQuery = ""; searchInput?.focus(); }} aria-label="Clear search" class="rounded-md p-1 text-neutral-500 hover:text-neutral-900"><X size={16} /></button>{/if}
              </div>
              <p class="mt-2 text-xs text-neutral-500">Search by name, description, category, or keyword.</p>
            </div>
            <div class="space-y-4 p-3 sm:p-4">
              {#if searchGroups.length === 0}<p role="status" class="p-4 text-center text-sm text-neutral-500">No tools match “{toolQuery}”.</p>{/if}
              {#each searchGroups as group}
                <section aria-label={group.category}>
                  <h3 class="px-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">{group.category}</h3>
                  <div class="grid gap-1 sm:grid-cols-2">{#each group.items as tool}{@render toolLink(tool)}{/each}</div>
                </section>
              {/each}
            </div>
          {:else}
            <div class="grid gap-4 p-3 sm:grid-cols-2 sm:p-4">
              {#each visibleGroups as group}
                <section aria-label={group.name} class={activeMenu === "tools" ? "space-y-2" : "space-y-2 sm:col-span-2"}>
                  {#if activeMenu === "tools"}<h2 class="px-3 text-sm font-bold text-indigo-600 dark:text-indigo-400">{group.name}</h2>{/if}
                  <div class={activeMenu === "tools" ? "space-y-3" : "grid gap-3 sm:grid-cols-2"}>{#each group.categories as category}{@render categoryLinks(category)}{/each}</div>
                </section>
              {/each}
            </div>
          {/if}
          <div class="border-t border-neutral-200 px-4 py-3 text-sm"><a href="/" onclick={() => closeMenus()} class="font-semibold text-indigo-600 dark:text-indigo-400">Browse all tools →</a></div>
        </div>
      {/if}
    </div>
  </header>
  <main class="flex-1">{@render children()}</main>
  <footer class="border-t border-neutral-200 bg-white">
    <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p class="text-sm text-neutral-500">&copy; {new Date().getFullYear()} PureTools. Privacy-focused &amp; Pure Frontend.</p>
        <div class="flex items-center gap-6 text-sm text-neutral-500">
          <a href="/" class="hover:text-indigo-600">Home</a>
          <a href="https://github.com/KnowSky404/PureTools" target="_blank" rel="noopener noreferrer" class="hover:text-indigo-600">Source</a>
          <span class="flex items-center gap-1.5"><span class="inline-block h-2 w-2 rounded-full bg-green-500"></span>Cloudflare Pages</span>
        </div>
      </div>
    </div>
  </footer>
</div>
