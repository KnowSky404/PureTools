<script lang="ts">
import { ChevronRight, Globe, ShieldCheck, Zap } from "lucide-svelte";
import { tools } from "$lib/utils/tools";

const features = [
  { icon: Zap, title: "Client-side", desc: "Core processing runs directly in your browser." },
  { icon: ShieldCheck, title: "Privacy First", desc: "Your data never leaves your computer." },
  { icon: Globe, title: "Lightweight", desc: "Minimal dependencies for maximum performance." },
];
</script>

<div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
  <!-- Hero Section -->
  <div class="mb-20 text-center">
    <div class="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
      <Zap size={12} class="fill-indigo-600 dark:fill-indigo-300" />
      <span>Svelte 5 Powered</span>
    </div>
    <h1 class="mt-6 text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-6xl">
      Essential tools for <span class="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Modern Developers</span>
    </h1>
    <p class="mx-auto mt-6 max-w-2xl text-lg text-neutral-500 dark:text-neutral-400">
			Fast, private, and lightweight. Essential tools with core processing that runs directly in your browser.
    </p>
  </div>

  <!-- Tools Grid -->
  <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    {#each tools as tool}
      <a
        href={tool.href}
        class="group relative flex flex-col rounded-2xl border border-neutral-200 bg-white p-6 transition-[border-color,box-shadow] duration-300 hover:border-transparent hover:shadow-[0_0_40px_-10px_rgba(0,0,0,0.1)] hover:shadow-indigo-500/10 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700 dark:hover:shadow-none"
      >
        <div class="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border transition-all duration-300 {tool.color} {tool.hoverColor}">
          <tool.icon size={24} />
        </div>
        <h2 class="text-xl font-bold text-neutral-900 dark:text-neutral-100">{tool.name}</h2>
        <p class="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">{tool.description}</p>
        
        <div class="mt-8 flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
          Open Tool
          <ChevronRight size={16} class="transition-transform group-hover:translate-x-1" />
        </div>
      </a>
    {/each}

    <!-- Coming Soon Card -->
    <div class="group flex flex-col rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/50 p-6 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/60 dark:hover:bg-neutral-900">
      <div class="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-500">
        <span class="text-xl">+</span>
      </div>
      <h2 class="text-xl font-bold text-neutral-400 dark:text-neutral-500">More Tools</h2>
      <p class="mt-2 text-sm leading-relaxed text-neutral-400 dark:text-neutral-500">Request a tool or contribute on GitHub</p>
      <a 
        href="https://github.com/KnowSky404/PureTools/issues" 
        target="_blank"
        class="mt-8 text-sm font-semibold text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
      >
        Suggest tool →
      </a>
    </div>
  </div>

  <!-- Features -->
  <div class="mt-32 grid gap-12 sm:grid-cols-3">
    {#each features as feature}
      <div class="flex flex-col items-center text-center">
        <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
          <feature.icon size={20} class="text-neutral-600 dark:text-neutral-300" />
        </div>
        <h3 class="font-bold text-neutral-900 dark:text-neutral-100">{feature.title}</h3>
        <p class="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{feature.desc}</p>
      </div>
    {/each}
  </div>
</div>
