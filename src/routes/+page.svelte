<script lang="ts">
const tools = $state([
  { name: "JSON Formatter", description: "Format and validate JSON", icon: "JSON" },
  { name: "SQL Formatter", description: "Beautify your SQL queries", icon: "SQL" },
  { name: "UUID Generator", description: "Generate random UUIDs", icon: "ID" },
]);
</script>

<main class="min-h-screen bg-slate-50 p-8 text-slate-900">
  <div class="mx-auto max-w-4xl">
    <header class="mb-12 text-center">
      <h1 class="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
        PureTools
      </h1>
      <p class="mt-4 text-lg text-slate-600">
        Lightweight, privacy-focused, pure frontend developer tools.
      </p>
    </header>

    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {#each tools as tool}
        <div class="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
          <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-bold">
            {tool.icon}
          </div>
          <h2 class="text-xl font-semibold text-slate-900">{tool.name}</h2>
          <p class="mt-2 text-slate-500">{tool.description}</p>
          <button class="mt-6 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
            Open Tool
          </button>
        </div>
      {/each}
    </div>
  </div>
</main>
