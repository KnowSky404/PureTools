<script lang="ts">
import "./layout.css";
// biome-ignore lint/correctness/noUnusedImports: used in <svelte:head>.
import favicon from "$lib/assets/favicon.svg";

// biome-ignore lint/correctness/noUnusedVariables: used in {@render children()}.
const { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
