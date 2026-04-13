# Random Name Generator Design

## Summary

Add a new browser-only tool that generates random personal names for the United States, China, Japan, and South Korea. The tool must support:

- Country selection
- Gender selection: `random`, `male`, `female`
- Batch generation
- Local name order and English order switching
- Full-name output plus split family/given name display
- Clipboard copy for generated values

The implementation should stay lightweight, use a small built-in dataset, and follow the existing PureTools pattern used by other generator tools.

## Goals

- Add a new independent tool page under `src/routes/random-name/+page.svelte`
- Keep all generation logic inside pure frontend TypeScript utilities
- Use a compact in-repo dataset with no external API or remote fetch
- Match existing interaction patterns from the current tool pages
- Keep the implementation small enough for MVP while leaving room for future dataset expansion

## Non-Goals

- No large or exhaustive real-world name database
- No backend storage or analytics
- No transliteration feature in the first version
- No middle-name generation or honorific generation
- No localization system changes outside the new tool content

## User Experience

### Controls

The page exposes four main controls:

- `Country`: United States, China, Japan, South Korea
- `Gender`: Random, Male, Female
- `Batch size`: integer range, defaulting to a small useful value
- `Display order`: Local order, English order

Recommended defaults:

- Country: United States
- Gender: Random
- Batch size: 6
- Display order: Local order

### Output

The page shows:

- A primary generated name card
- A generated list for the current batch
- For each row:
  - Full name
  - Family name
  - Given name
  - Country tag
  - Gender tag
  - Copy action

### Order Rules

- United States local order: `givenName familyName`
- China local order: `familyName givenName`
- Japan local order: `familyName givenName`
- South Korea local order: `familyName givenName`
- English order for all countries: `givenName familyName`

### Error Handling

The page should show a friendly inline error if:

- The selected dataset is empty
- Batch size is out of range
- Web Crypto is unavailable
- The generator receives an invalid country or gender value

The page must never crash because of malformed state.

## Data Model

Add a new utility file: `src/lib/utils/random-name.ts`

### Types

```ts
export type SupportedCountry = "us" | "cn" | "jp" | "kr";
export type NameGender = "random" | "male" | "female";
export type NameDisplayOrder = "local" | "western";

export type GeneratedName = {
  country: SupportedCountry;
  gender: Exclude<NameGender, "random">;
  familyName: string;
  givenName: string;
  localizedFullName: string;
  westernFullName: string;
  fullName: string;
};
```

### Dataset Shape

Keep a compact static dataset in the same utility file for MVP:

```ts
type NameDataset = {
  familyNames: string[];
  maleGivenNames: string[];
  femaleGivenNames: string[];
  localOrder: "family-first" | "given-first";
};
```

Each country gets one dataset entry.

### Dataset Size

Use a small high-frequency dataset only:

- Around 10 to 20 family names per country
- Around 12 to 20 male given names per country
- Around 12 to 20 female given names per country

This size is enough for MVP and keeps bundle impact low.

## Generation Logic

### API

Proposed pure functions:

```ts
export type RandomNameOptions = {
  country: SupportedCountry;
  gender: NameGender;
  count?: number;
  displayOrder?: NameDisplayOrder;
};

export function generateRandomNames(options: RandomNameOptions): GeneratedName[];
export function formatGeneratedName(
  name: Pick<GeneratedName, "familyName" | "givenName" | "localizedFullName" | "westernFullName">,
  displayOrder: NameDisplayOrder,
): string;
```

### Validation Rules

- `country` must be one of the supported values
- `gender` must be one of the supported values
- `count` must be an integer in a bounded range, recommended `1..20`
- Required pools for the selected country and gender must not be empty
- `crypto.getRandomValues` must be available

### Randomness

Use `crypto.getRandomValues` with rejection sampling or an equivalent unbiased index picker, matching the quality bar already used in the random string generator.

### Gender Resolution

If `gender` is `random`, choose between `male` and `female` per generated row. This keeps mixed batches possible and makes the default mode more useful.

### Name Assembly

- Pick one family name from the country family-name pool
- Pick one given name from the gender-specific pool
- Compute both local-order and western-order strings
- Set `fullName` according to `displayOrder`

For this MVP:

- Chinese, Japanese, and Korean names are represented without inserting special punctuation beyond a normal space or direct concatenation chosen consistently in code
- The chosen separator should be simple and consistent across the tool output

Implementation choice: use a normal space between family and given name for all countries in v1. This keeps layout, copying, and readability consistent.

## UI Design

### Page Structure

Follow the current generator-style page layout:

1. Intro card with title and short description
2. Controls card with selectors and action buttons
3. Primary result card
4. Batch results list
5. Optional short explanation of naming-order rules

### Actions

- `Generate`: refresh the batch
- `Copy primary`: copy the main displayed name
- Per-row `Copy`: copy one generated full name

Optional but acceptable if already aligned with current patterns:

- Auto-copy the primary name after generation

Recommended choice: do not auto-copy in v1. Random names are often browsed in batches, so explicit copy is less surprising.

### Presentation Details

- Use country labels that are explicit and short
- Use gender badges for scanability
- Keep the result list readable on mobile
- Reuse existing Tailwind card and button patterns from the current tool pages

## Tool Index Integration

Update `src/lib/utils/tools.ts` with:

- Name: `Random Name Generator`
- Description: random names for United States, China, Japan, and South Korea
- Category: `Identifiers`
- Relevant keywords: `random`, `name`, `generator`, `person`, `identity`, country keywords

Choose an icon already available from `lucide-svelte` that fits the current visual language.

## Testing Strategy

Add a unit test file for the utility layer.

Coverage should include:

- Generates the requested number of names
- Returns valid structures for each supported country
- Resolves `random` gender into `male` or `female`
- Applies local order correctly for each country
- Applies western order correctly for each country
- Rejects invalid `count`
- Rejects unsupported option values
- Rejects empty pools if a dataset is accidentally broken in the future

Tests should focus on utility behavior, not page markup details.

## Implementation Plan Boundary

The implementation can be delivered in one small feature slice:

1. Add utility types, datasets, validators, and generator functions
2. Add utility tests
3. Add the new route page and wire up controls/results/copy behavior
4. Register the tool on the homepage index
5. Run linting and validation

This scope is appropriate for a single implementation plan and does not need further decomposition.

## Risks And Mitigations

- Repetitive output because of the small dataset
  - Accept for MVP and leave room for future expansion
- Cultural naming accuracy is simplified
  - Keep country-specific local order rules and avoid making claims of exhaustive realism
- UI clutter from too many controls
  - Limit controls to country, gender, count, and order only

## Acceptance Criteria

- A new `Random Name Generator` tool is visible from the homepage
- Users can generate random names for the United States, China, Japan, and South Korea
- Users can choose `random`, `male`, or `female`
- Users can switch between local order and English order
- Users can generate multiple results in one action
- Users can copy generated full names
- All logic runs locally in the browser with no network dependency
- The code follows existing Svelte 5, TypeScript, Tailwind, and Biome project conventions
