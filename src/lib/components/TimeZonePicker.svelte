<script lang="ts">
import { COMMON_CITIES, cityName, FIXED_ZONES, formatOffset } from "$lib/utils/timezone";

type Props = {
  id: string;
  label: string;
  value: string;
  zones: string[];
  includeFixed?: boolean;
};

let { id, label, value = $bindable(), zones, includeFixed = true }: Props = $props();
let query = $state("");
const normalized = $derived(query.trim().toLowerCase().replaceAll("_", " "));
const matching = $derived(
  zones.filter((zone) =>
    `${zone.replaceAll("_", " ")} ${cityName(zone)}`.toLowerCase().includes(normalized),
  ),
);
const common = $derived(COMMON_CITIES.filter((city) => matching.includes(city.zone)));
const other = $derived(matching.filter((zone) => !common.some((city) => city.zone === zone)));
const fixed = $derived(
  Object.entries(FIXED_ZONES).filter(([name]) =>
    `fixed ${name} utc`.toLowerCase().includes(normalized),
  ),
);
const selectedHidden = $derived(
  !matching.includes(value) && !(includeFixed && fixed.some(([name]) => value === `fixed:${name}`)),
);
</script>

<div class="min-w-0 space-y-2">
  <label for={id} class="block text-sm font-semibold text-neutral-700">{label}</label>
  <input
    type="search"
    aria-label={`${label} search`}
    placeholder="Search city or IANA time zone"
    bind:value={query}
    class="w-full min-w-0 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
  />
  <select id={id} bind:value class="w-full min-w-0 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20">
    {#if selectedHidden}
      <optgroup label="Current selection">
        <option value={value}>{value.startsWith("fixed:") ? `${value.slice(6)} (fixed offset)` : `${cityName(value)} · ${value}`}</option>
      </optgroup>
    {/if}
    {#if includeFixed && fixed.length}
      <optgroup label="Fixed UTC offsets · no DST">
        {#each fixed as [name, zone]}
          {#if zone.kind === "fixed"}
            <option value={`fixed:${name}`}>{name} · fixed {formatOffset(zone.offsetMinutes)}</option>
          {/if}
        {/each}
      </optgroup>
    {/if}
    {#if common.length}
      <optgroup label="Common cities · automatic DST">
        {#each common as city}
          <option value={city.zone}>{city.name} · {city.zone}</option>
        {/each}
      </optgroup>
    {/if}
    {#if other.length}
      <optgroup label="IANA regions · automatic DST">
        {#each other as zone}
          <option value={zone}>{zone}</option>
        {/each}
      </optgroup>
    {/if}
  </select>
  {#if matching.length === 0 && (!includeFixed || fixed.length === 0)}
    <p class="text-xs text-neutral-500" role="status">No matching time zones. Try a city or region name.</p>
  {/if}
</div>
