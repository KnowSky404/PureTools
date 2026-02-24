<script lang="ts">
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

<div class="mx-auto max-w-4xl p-6">
  <div class="mb-8 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-slate-900">UUID Generator</h1>
      <p class="text-slate-500">Generate and validate RFC 4122 UUIDs</p>
    </div>
    <a href="/" class="text-sm font-medium text-indigo-600 hover:text-indigo-500">← Back to Tools</a>
  </div>

  <div class="grid gap-8 lg:grid-cols-2">
    <!-- Generator Section -->
    <div class="space-y-6">
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="mb-4 text-lg font-semibold text-slate-900 font-mono">Generate UUID (v4)</h2>
        
        <div class="flex flex-col gap-4">
          <div class="relative flex-1">
            <input
              type="text"
              readonly
              value={currentUuid}
              placeholder="Click generate button..."
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm focus:outline-none"
            />
          </div>
          
          <div class="flex gap-2">
            <button
              onclick={handleGenerate}
              class="flex-1 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              Generate & Copy
            </button>
            {#if currentUuid}
              <button
                onclick={() => handleCopy(currentUuid)}
                class="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {copyStatus}
              </button>
            {/if}
          </div>
        </div>
      </div>

      <!-- Validator Section -->
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="mb-4 text-lg font-semibold text-slate-900">UUID Validator</h2>
        <div class="space-y-4">
          <input
            type="text"
            bind:value={validationInput}
            placeholder="Paste UUID to validate..."
            class="w-full rounded-lg border px-4 py-3 font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none
            {isValid === true ? 'border-green-500 ring-green-100' : ''}
            {isValid === false ? 'border-red-500 ring-red-100' : 'border-slate-200'}"
          />
          {#if isValid === true}
            <p class="text-sm font-medium text-green-600 flex items-center gap-1">
              <span class="inline-block w-2 h-2 rounded-full bg-green-500"></span>
              Valid UUID format
            </p>
          {:else if isValid === false}
            <p class="text-sm font-medium text-red-600 flex items-center gap-1">
              <span class="inline-block w-2 h-2 rounded-full bg-red-500"></span>
              Invalid UUID format
            </p>
          {/if}
        </div>
      </div>
    </div>

    <!-- History Section -->
    <div class="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-100 p-4">
        <h2 class="font-semibold text-slate-900">History</h2>
        {#if history.length > 0}
          <button 
            onclick={clearHistory}
            class="text-xs font-medium text-slate-400 hover:text-red-500 transition-colors"
          >
            Clear All
          </button>
        {/if}
      </div>
      
      <div class="flex-1 overflow-y-auto max-h-[400px] p-4">
        {#if history.length === 0}
          <div class="flex h-full flex-col items-center justify-center py-12 text-slate-400">
            <p class="text-sm">No history yet</p>
          </div>
        {:else}
          <ul class="space-y-3">
            {#each history as item (item.timestamp)}
              <li class="group flex items-center justify-between gap-4 rounded-lg border border-slate-50 bg-slate-50/50 p-3">
                <span class="truncate font-mono text-xs text-slate-600">{item.id}</span>
                <button
                  onclick={() => handleCopy(item.id)}
                  class="shrink-0 rounded bg-white px-2 py-1 text-[10px] font-bold text-slate-400 shadow-sm opacity-0 group-hover:opacity-100 hover:text-indigo-600 transition-all"
                >
                  COPY
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  </div>
</div>
