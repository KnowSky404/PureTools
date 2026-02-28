<script lang="ts">
import {
  AlertCircle,
  Check,
  Copy,
  Fingerprint,
  History,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-svelte";
import { copyToClipboard } from "$lib/utils/clipboard";
import { generateUUID, validateUUID } from "$lib/utils/uuid";

// State using Svelte 5 Runes
let currentUuid = $state("");
let validationInput = $state("");
let history = $state<{ id: string; timestamp: number }[]>([]);
let copyStatus = $state("Copy");
const isValid = $derived(validationInput ? validateUUID(validationInput) : null);

// Generate and copy to clipboard
async function handleGenerate() {
  const newUuid = generateUUID();
  currentUuid = newUuid;
  history = [{ id: newUuid, timestamp: Date.now() }, ...history].slice(0, 50);

  const success = await copyToClipboard(newUuid);
  if (success) {
    copyStatus = "Copied!";
    setTimeout(() => (copyStatus = "Copy"), 2000);
  }
}

async function handleCopy(text: string) {
  await copyToClipboard(text);
}

function clearHistory() {
  history = [];
}
</script>

<div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
  <!-- Header Section -->
  <div class="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex items-center gap-4">
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
        <Fingerprint size={24} />
      </div>
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-neutral-900">UUID Generator</h1>
        <p class="text-sm text-neutral-500 font-medium">Generate and validate RFC 4122 UUIDs (v4)</p>
      </div>
    </div>
  </div>

  <div class="grid gap-8 lg:grid-cols-3">
    <!-- Main Generator & Validator (Left 2/3) -->
    <div class="lg:col-span-2 space-y-6">
      <!-- Generator Section -->
      <section class="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        <div class="border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
          <h2 class="flex items-center gap-2 text-sm font-bold text-neutral-900 uppercase tracking-wider">
            <RefreshCw size={14} class="text-indigo-600" />
            Generator (v4)
          </h2>
        </div>
        
        <div class="p-6">
          <div class="flex flex-col gap-4">
            <div class="group relative">
              <input
                type="text"
                readonly
                value={currentUuid}
                placeholder="Click generate button..."
                class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4 font-mono text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none transition-all"
              />
              {#if currentUuid}
                <button
                  onclick={() => handleCopy(currentUuid)}
                  class="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-white p-2 text-neutral-400 shadow-sm border border-neutral-100 transition-all hover:text-indigo-600 hover:border-indigo-100"
                  title="Copy to clipboard"
                >
                  <Copy size={18} />
                </button>
              {/if}
            </div>
            
            <div class="flex items-center gap-3">
              <button
                onclick={handleGenerate}
                class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-4 text-sm font-bold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.98]"
              >
                <RefreshCw size={18} />
                Generate & Copy
              </button>
              {#if currentUuid}
                 <div class="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-xs font-semibold text-neutral-500">
                    {#if copyStatus === "Copied!"}
                      <Check size={14} class="text-green-500" />
                      <span class="text-green-600">Copied!</span>
                    {:else}
                      <Copy size={14} />
                      <span>Ready to copy</span>
                    {/if}
                 </div>
              {/if}
            </div>
          </div>
        </div>
      </section>

      <!-- Validator Section -->
      <section class="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        <div class="border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
          <h2 class="flex items-center gap-2 text-sm font-bold text-neutral-900 uppercase tracking-wider">
            <Search size={14} class="text-indigo-600" />
            Validator
          </h2>
        </div>
        <div class="p-6">
          <div class="relative">
            <input
              type="text"
              bind:value={validationInput}
              placeholder="Paste UUID to validate..."
              class="w-full rounded-xl border px-5 py-4 font-mono text-base outline-none transition-all placeholder:text-neutral-400
              {isValid === true ? 'border-green-500 bg-green-50/30 ring-4 ring-green-500/5' : ''}
              {isValid === false ? 'border-red-500 bg-red-50/30 ring-4 ring-red-500/5' : 'border-neutral-200 bg-neutral-50 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/5'}"
            />
            {#if isValid !== null}
              <div class="absolute right-4 top-1/2 -translate-y-1/2">
                {#if isValid === true}
                  <Check class="text-green-500" size={20} />
                {:else}
                  <AlertCircle class="text-red-500" size={20} />
                {/if}
              </div>
            {/if}
          </div>
          
          {#if isValid !== null}
            <div class="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold {isValid ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}">
              {#if isValid === true}
                <Check size={14} />
                Valid RFC 4122 UUID format
              {:else}
                <AlertCircle size={14} />
                Invalid UUID format
              {/if}
            </div>
          {/if}
        </div>
      </section>
    </div>

    <!-- History Section (Right 1/3) -->
    <aside class="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div class="flex items-center justify-between border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
        <h2 class="flex items-center gap-2 text-sm font-bold text-neutral-900 uppercase tracking-wider">
          <History size={14} class="text-indigo-600" />
          History
        </h2>
        {#if history.length > 0}
          <button 
            onclick={clearHistory}
            class="group flex items-center gap-1.5 text-xs font-bold text-neutral-400 hover:text-red-600 transition-colors"
          >
            <Trash2 size={12} class="transition-transform group-hover:scale-110" />
            Clear
          </button>
        {/if}
      </div>
      
      <div class="flex-1 overflow-y-auto max-h-[600px]">
        {#if history.length === 0}
          <div class="flex h-64 flex-col items-center justify-center text-neutral-400">
            <History size={32} class="mb-3 opacity-20" />
            <p class="text-xs font-medium">No history yet</p>
          </div>
        {:else}
          <div class="divide-y divide-neutral-50">
            {#each history as item (item.timestamp)}
              <div class="group flex items-center justify-between gap-3 p-4 transition-colors hover:bg-neutral-50/50">
                <div class="flex flex-col gap-1 overflow-hidden">
                  <span class="truncate font-mono text-[11px] text-neutral-600">{item.id}</span>
                  <span class="text-[10px] font-medium text-neutral-400">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <button
                  onclick={() => handleCopy(item.id)}
                  class="shrink-0 rounded-lg bg-white p-2 text-neutral-400 shadow-sm border border-neutral-100 opacity-0 group-hover:opacity-100 transition-all hover:text-indigo-600 hover:border-indigo-100 active:scale-95"
                  title="Copy UUID"
                >
                  <Copy size={14} />
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </aside>
  </div>
</div>
