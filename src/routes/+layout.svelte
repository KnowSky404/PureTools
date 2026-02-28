<script lang="ts">
import "./layout.css";
import { Command, Github, Search } from "lucide-svelte";
import { page } from "$app/state";
import favicon from "$lib/assets/favicon.svg";

const { children } = $props();

const navItems = [
  { name: "UUID", href: "/uuid" },
  { name: "JSON", href: "/json" },
  { name: "SQL", href: "/sql" },
  { name: "Timestamp", href: "/timestamp" },
  { name: "GitHub CDN", href: "/jsdelivr" },
];
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>PureTools | Lightweight Developer Toolset</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-neutral-50 selection:bg-indigo-100 selection:text-indigo-900">
  <!-- Header -->
  <header class="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-md">
    <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <div class="flex items-center gap-6">
        <a href="/" class="flex items-center gap-2 group">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm transition-transform group-hover:scale-105">
            <span class="font-bold text-lg">P</span>
          </div>
          <span class="hidden font-bold tracking-tight text-neutral-900 sm:inline-block">PureTools</span>
        </a>

        <nav class="hidden gap-1 md:flex">
          {#each navItems as item}
            <a
              href={item.href}
              class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {page.url.pathname === item.href ? 'bg-neutral-100 text-indigo-600' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'}"
            >
              {item.name}
            </a>
          {/each}
        </nav>
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
