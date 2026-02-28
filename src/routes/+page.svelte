<script lang="ts">
import {
  Braces,
  ChevronRight,
  Clock,
  Database,
  Fingerprint,
  Globe,
  Link2,
  ShieldCheck,
  Zap,
} from "lucide-svelte";

const tools = [
  {
    name: "UUID Generator",
    description: "Generate and validate RFC 4122 UUIDs (v4)",
    icon: Fingerprint,
    href: "/uuid",
    color: "bg-indigo-50 text-indigo-600 border-indigo-100",
    hoverColor: "group-hover:bg-indigo-600 group-hover:text-white",
  },
  {
    name: "JSON Formatter",
    description: "Format, minify, and validate JSON data",
    icon: Braces,
    href: "/json",
    color: "bg-emerald-50 text-emerald-600 border-emerald-100",
    hoverColor: "group-hover:bg-emerald-600 group-hover:text-white",
  },
  {
    name: "SQL Formatter",
    description: "Beautify and optimize your SQL queries",
    icon: Database,
    href: "/sql",
    color: "bg-blue-50 text-blue-600 border-blue-100",
    hoverColor: "group-hover:bg-blue-600 group-hover:text-white",
  },
  {
    name: "Timestamp Tool",
    description: "Convert and validate Unix timestamps",
    icon: Clock,
    href: "/timestamp",
    color: "bg-orange-50 text-orange-600 border-orange-100",
    hoverColor: "group-hover:bg-orange-600 group-hover:text-white",
  },
  {
    name: "GitHub CDN",
    description: "GitHub links to jsDelivr CDN URLs",
    icon: Link2,
    href: "/jsdelivr",
    color: "bg-purple-50 text-purple-600 border-purple-100",
    hoverColor: "group-hover:bg-purple-600 group-hover:text-white",
  },
];

const features = [
  { icon: Zap, title: "Pure Frontend", desc: "No backend, everything runs in your browser." },
  { icon: ShieldCheck, title: "Privacy First", desc: "Your data never leaves your computer." },
  { icon: Globe, title: "Lightweight", desc: "Minimal dependencies for maximum performance." },
];
</script>

<div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
  <!-- Hero Section -->
  <div class="mb-20 text-center">
    <div class="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
      <Zap size={12} class="fill-indigo-600" />
      <span>Svelte 5 Powered</span>
    </div>
    <h1 class="mt-6 text-4xl font-extrabold tracking-tight text-neutral-900 sm:text-6xl">
      Essential tools for <span class="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Modern Developers</span>
    </h1>
    <p class="mx-auto mt-6 max-w-2xl text-lg text-neutral-500">
      Fast, private, and lightweight. A collection of essential tools built for the modern web developer, running entirely in your browser.
    </p>
  </div>

  <!-- Tools Grid -->
  <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    {#each tools as tool}
      <a
        href={tool.href}
        class="group relative flex flex-col rounded-2xl border border-neutral-200 bg-white p-6 transition-all duration-300 hover:border-transparent hover:shadow-[0_0_40px_-10px_rgba(0,0,0,0.1)] hover:shadow-indigo-500/10"
      >
        <div class="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border transition-all duration-300 {tool.color} {tool.hoverColor}">
          <tool.icon size={24} />
        </div>
        <h2 class="text-xl font-bold text-neutral-900">{tool.name}</h2>
        <p class="mt-2 text-sm leading-relaxed text-neutral-500">{tool.description}</p>
        
        <div class="mt-8 flex items-center gap-2 text-sm font-semibold text-indigo-600">
          Open Tool
          <ChevronRight size={16} class="transition-transform group-hover:translate-x-1" />
        </div>
      </a>
    {/each}

    <!-- Coming Soon Card -->
    <div class="group flex flex-col rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/50 p-6 transition-colors hover:bg-neutral-50">
      <div class="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-400">
        <span class="text-xl">+</span>
      </div>
      <h2 class="text-xl font-bold text-neutral-400">More Tools</h2>
      <p class="mt-2 text-sm leading-relaxed text-neutral-400">Request a tool or contribute on GitHub</p>
      <a 
        href="https://github.com/KnowSky404/PureTools/issues" 
        target="_blank"
        class="mt-8 text-sm font-semibold text-neutral-400 hover:text-neutral-600"
      >
        Suggest tool →
      </a>
    </div>
  </div>

  <!-- Features -->
  <div class="mt-32 grid gap-12 sm:grid-cols-3">
    {#each features as feature}
      <div class="flex flex-col items-center text-center">
        <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-neutral-200">
          <feature.icon size={20} class="text-neutral-600" />
        </div>
        <h3 class="font-bold text-neutral-900">{feature.title}</h3>
        <p class="mt-2 text-sm text-neutral-500">{feature.desc}</p>
      </div>
    {/each}
  </div>
</div>
