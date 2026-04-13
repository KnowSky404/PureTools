# Random Name Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new browser-only random-name generator tool that supports United States, China, Japan, and South Korea with gender filters, batch generation, copy actions, and local or English display order.

**Architecture:** Add a new pure TypeScript utility module for datasets, validation, random selection, and formatted output; test that module first with focused Bun tests; then add a Svelte page that uses the utility and existing clipboard helper; finally register the tool in the shared homepage tool index.

**Tech Stack:** Svelte 5 runes, TypeScript, Bun test runner, Tailwind CSS, Biome, lucide-svelte.

---

### Task 1: Add utility tests for random-name generation

**Files:**
- Create: `src/lib/utils/random-name.test.ts`
- Test: `src/lib/utils/random-name.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import {
  formatGeneratedName,
  generateRandomNames,
  randomNameDatasets,
  type SupportedCountry,
} from "./random-name";

const supportedCountries: SupportedCountry[] = ["us", "cn", "jp", "kr"];

describe("generateRandomNames", () => {
  test("generates the requested number of names with valid structure", () => {
    const results = generateRandomNames({
      country: "us",
      gender: "male",
      count: 3,
      displayOrder: "western",
    });

    expect(results).toHaveLength(3);

    for (const result of results) {
      expect(result.country).toBe("us");
      expect(result.gender).toBe("male");
      expect(result.familyName.length).toBeGreaterThan(0);
      expect(result.givenName.length).toBeGreaterThan(0);
      expect(result.westernFullName).toBe(`${result.givenName} ${result.familyName}`);
      expect(result.fullName).toBe(result.westernFullName);
    }
  });

  test("supports every configured country", () => {
    for (const country of supportedCountries) {
      const results = generateRandomNames({
        country,
        gender: "female",
        count: 2,
        displayOrder: "local",
      });

      expect(results).toHaveLength(2);
      for (const result of results) {
        expect(result.country).toBe(country);
        expect(result.gender).toBe("female");
      }
    }
  });

  test("resolves random gender to male or female per result", () => {
    const results = generateRandomNames({
      country: "jp",
      gender: "random",
      count: 8,
      displayOrder: "local",
    });

    expect(results).toHaveLength(8);
    for (const result of results) {
      expect(["male", "female"]).toContain(result.gender);
    }
  });

  test("applies local order for family-first countries", () => {
    const results = generateRandomNames({
      country: "cn",
      gender: "male",
      count: 1,
      displayOrder: "local",
    });

    const [result] = results;
    expect(result.localizedFullName).toBe(`${result.familyName} ${result.givenName}`);
    expect(result.fullName).toBe(result.localizedFullName);
  });

  test("applies western order when requested", () => {
    const results = generateRandomNames({
      country: "kr",
      gender: "female",
      count: 1,
      displayOrder: "western",
    });

    const [result] = results;
    expect(result.westernFullName).toBe(`${result.givenName} ${result.familyName}`);
    expect(result.fullName).toBe(result.westernFullName);
  });

  test("formats generated names for both display orders", () => {
    const result = {
      familyName: "Kim",
      givenName: "Minji",
      localizedFullName: "Kim Minji",
      westernFullName: "Minji Kim",
    };

    expect(formatGeneratedName(result, "local")).toBe("Kim Minji");
    expect(formatGeneratedName(result, "western")).toBe("Minji Kim");
  });

  test("rejects an invalid count", () => {
    expect(() =>
      generateRandomNames({
        country: "us",
        gender: "male",
        count: 0,
      }),
    ).toThrow("Count must be an integer between 1 and 20.");
  });

  test("rejects unsupported option values", () => {
    expect(() =>
      generateRandomNames({
        country: "gb" as SupportedCountry,
        gender: "male",
        count: 1,
      }),
    ).toThrow("Unsupported country: gb.");

    expect(() =>
      generateRandomNames({
        country: "us",
        gender: "other" as "random",
        count: 1,
      }),
    ).toThrow("Unsupported gender: other.");
  });

  test("rejects empty pools from broken datasets", () => {
    const originalFamilyNames = [...randomNameDatasets.us.familyNames];

    randomNameDatasets.us.familyNames.length = 0;

    expect(() =>
      generateRandomNames({
        country: "us",
        gender: "male",
        count: 1,
      }),
    ).toThrow("Dataset for us is missing family names.");

    randomNameDatasets.us.familyNames.splice(0, 0, ...originalFamilyNames);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/utils/random-name.test.ts`
Expected: FAIL with module-not-found or missing-export errors for `./random-name`

- [ ] **Step 3: Write minimal implementation**

```ts
export type SupportedCountry = "us" | "cn" | "jp" | "kr";
export type NameGender = "random" | "male" | "female";
export type ResolvedNameGender = Exclude<NameGender, "random">;
export type NameDisplayOrder = "local" | "western";

type NameDataset = {
  familyNames: string[];
  maleGivenNames: string[];
  femaleGivenNames: string[];
  localOrder: "family-first" | "given-first";
};

export type RandomNameOptions = {
  country: SupportedCountry;
  gender: NameGender;
  count?: number;
  displayOrder?: NameDisplayOrder;
};

export type GeneratedName = {
  country: SupportedCountry;
  gender: ResolvedNameGender;
  familyName: string;
  givenName: string;
  localizedFullName: string;
  westernFullName: string;
  fullName: string;
};

export const randomNameDatasets: Record<SupportedCountry, NameDataset> = {
  us: {
    familyNames: ["Smith"],
    maleGivenNames: ["James"],
    femaleGivenNames: ["Emma"],
    localOrder: "given-first",
  },
  cn: {
    familyNames: ["Wang"],
    maleGivenNames: ["Wei"],
    femaleGivenNames: ["Li"],
    localOrder: "family-first",
  },
  jp: {
    familyNames: ["Sato"],
    maleGivenNames: ["Haruto"],
    femaleGivenNames: ["Yui"],
    localOrder: "family-first",
  },
  kr: {
    familyNames: ["Kim"],
    maleGivenNames: ["Minjun"],
    femaleGivenNames: ["Minji"],
    localOrder: "family-first",
  },
};

export function formatGeneratedName(
  name: Pick<GeneratedName, "localizedFullName" | "westernFullName">,
  displayOrder: NameDisplayOrder,
): string {
  return displayOrder === "western" ? name.westernFullName : name.localizedFullName;
}

export function generateRandomNames(options: RandomNameOptions): GeneratedName[] {
  return [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/utils/random-name.test.ts`
Expected: still FAIL, but now with behavior assertions instead of missing-module errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/random-name.test.ts src/lib/utils/random-name.ts
git commit -m "test: add random name generator utility coverage"
```

### Task 2: Implement the utility behavior to satisfy the tests

**Files:**
- Modify: `src/lib/utils/random-name.ts`
- Test: `src/lib/utils/random-name.test.ts`

- [ ] **Step 1: Write the failing test**

Use the failing tests from Task 1 as the red state for this task. Do not add new production code before confirming the current failures are behavior failures.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/utils/random-name.test.ts`
Expected: FAIL with assertion failures for empty results or invalid behavior

- [ ] **Step 3: Write minimal implementation**

```ts
const SUPPORTED_COUNTRIES = ["us", "cn", "jp", "kr"] as const;
const SUPPORTED_GENDERS = ["random", "male", "female"] as const;
const MAX_COUNT = 20;

function assertSupportedCountry(country: string): asserts country is SupportedCountry {
  if (!SUPPORTED_COUNTRIES.includes(country as SupportedCountry)) {
    throw new Error(`Unsupported country: ${country}.`);
  }
}

function assertSupportedGender(gender: string): asserts gender is NameGender {
  if (!SUPPORTED_GENDERS.includes(gender as NameGender)) {
    throw new Error(`Unsupported gender: ${gender}.`);
  }
}

function resolveCount(count: number | undefined): number {
  const resolvedCount = count ?? 6;

  if (!Number.isInteger(resolvedCount) || resolvedCount < 1 || resolvedCount > MAX_COUNT) {
    throw new Error(`Count must be an integer between 1 and ${MAX_COUNT}.`);
  }

  return resolvedCount;
}

function ensureCrypto(): void {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Web Crypto is not available in this environment.");
  }
}

function pickRandomIndex(size: number): number {
  if (size < 1) {
    throw new Error("Random source pool must not be empty.");
  }

  const limit = Math.floor(0x100000000 / size) * size;
  const buffer = new Uint32Array(1);
  let value = 0;

  do {
    globalThis.crypto.getRandomValues(buffer);
    value = buffer[0] ?? 0;
  } while (value >= limit);

  return value % size;
}

function pickRandomValue(values: string[], errorMessage: string): string {
  if (values.length === 0) {
    throw new Error(errorMessage);
  }

  return values[pickRandomIndex(values.length)] ?? "";
}

function resolveGender(gender: NameGender): ResolvedNameGender {
  if (gender === "random") {
    return pickRandomIndex(2) === 0 ? "male" : "female";
  }

  return gender;
}

function buildLocalizedFullName(
  familyName: string,
  givenName: string,
  localOrder: NameDataset["localOrder"],
): string {
  return localOrder === "family-first"
    ? `${familyName} ${givenName}`
    : `${givenName} ${familyName}`;
}

export function generateRandomNames(options: RandomNameOptions): GeneratedName[] {
  assertSupportedCountry(options.country);
  assertSupportedGender(options.gender);
  ensureCrypto();

  const count = resolveCount(options.count);
  const displayOrder = options.displayOrder ?? "local";
  const dataset = randomNameDatasets[options.country];

  if (!dataset.familyNames.length) {
    throw new Error(`Dataset for ${options.country} is missing family names.`);
  }
  if (!dataset.maleGivenNames.length) {
    throw new Error(`Dataset for ${options.country} is missing male given names.`);
  }
  if (!dataset.femaleGivenNames.length) {
    throw new Error(`Dataset for ${options.country} is missing female given names.`);
  }

  return Array.from({ length: count }, () => {
    const resolvedGender = resolveGender(options.gender);
    const familyName = pickRandomValue(
      dataset.familyNames,
      `Dataset for ${options.country} is missing family names.`,
    );
    const givenNamePool =
      resolvedGender === "male" ? dataset.maleGivenNames : dataset.femaleGivenNames;
    const givenName = pickRandomValue(
      givenNamePool,
      `Dataset for ${options.country} is missing ${resolvedGender} given names.`,
    );
    const localizedFullName = buildLocalizedFullName(
      familyName,
      givenName,
      dataset.localOrder,
    );
    const westernFullName = `${givenName} ${familyName}`;

    return {
      country: options.country,
      gender: resolvedGender,
      familyName,
      givenName,
      localizedFullName,
      westernFullName,
      fullName:
        displayOrder === "western" ? westernFullName : localizedFullName,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/utils/random-name.test.ts`
Expected: PASS with all utility tests green

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/random-name.ts src/lib/utils/random-name.test.ts
git commit -m "feat: implement random name generator utility"
```

### Task 3: Expand the utility dataset from placeholders to the MVP dataset

**Files:**
- Modify: `src/lib/utils/random-name.ts`
- Test: `src/lib/utils/random-name.test.ts`

- [ ] **Step 1: Write the failing test**

Add one test that proves each country dataset has a meaningful lightweight pool:

```ts
test("ships lightweight pools for every country", () => {
  for (const country of supportedCountries) {
    expect(randomNameDatasets[country].familyNames.length).toBeGreaterThanOrEqual(10);
    expect(randomNameDatasets[country].maleGivenNames.length).toBeGreaterThanOrEqual(12);
    expect(randomNameDatasets[country].femaleGivenNames.length).toBeGreaterThanOrEqual(12);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/utils/random-name.test.ts`
Expected: FAIL because the placeholder pools are too small

- [ ] **Step 3: Write minimal implementation**

Replace the placeholder arrays in `src/lib/utils/random-name.ts` with lightweight MVP pools:

```ts
us: {
  familyNames: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Wilson", "Taylor"],
  maleGivenNames: ["James", "John", "Robert", "Michael", "William", "David", "Joseph", "Daniel", "Matthew", "Samuel", "Henry", "Jack"],
  femaleGivenNames: ["Emma", "Olivia", "Ava", "Sophia", "Isabella", "Mia", "Charlotte", "Amelia", "Harper", "Evelyn", "Abigail", "Ella"],
  localOrder: "given-first",
},
cn: {
  familyNames: ["Wang", "Li", "Zhang", "Liu", "Chen", "Yang", "Zhao", "Huang", "Zhou", "Wu"],
  maleGivenNames: ["Wei", "Jie", "Jun", "Hao", "Ming", "Tao", "Lei", "Bo", "Peng", "Yu", "Qiang", "Bin"],
  femaleGivenNames: ["Li", "Na", "Jing", "Yan", "Ting", "Yue", "Xin", "Fang", "Min", "Xue", "Ling", "Qian"],
  localOrder: "family-first",
},
jp: {
  familyNames: ["Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Ito", "Yamamoto", "Nakamura", "Kobayashi", "Kato"],
  maleGivenNames: ["Haruto", "Yuto", "Sota", "Yuki", "Hayato", "Koki", "Sora", "Ren", "Kenta", "Daiki", "Takumi", "Itsuki"],
  femaleGivenNames: ["Yui", "Aoi", "Hina", "Yuna", "Mei", "Rin", "Sakura", "Akari", "Mio", "Nanami", "Honoka", "Misaki"],
  localOrder: "family-first",
},
kr: {
  familyNames: ["Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Cho", "Yoon", "Jang", "Lim"],
  maleGivenNames: ["Minjun", "Seojun", "Jiho", "Dohyun", "Junseo", "Hyunwoo", "Jisung", "Taeyang", "Yejun", "Siwoo", "Geonwoo", "Woojin"],
  femaleGivenNames: ["Minji", "Seoyeon", "Jiwoo", "Sujin", "Hayoon", "Yuna", "Jiwon", "Chaewon", "Sohee", "Eunji", "Yeseo", "Nari"],
  localOrder: "family-first",
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/utils/random-name.test.ts`
Expected: PASS and all country pools meet the MVP threshold

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/random-name.ts src/lib/utils/random-name.test.ts
git commit -m "feat: expand random name generator datasets"
```

### Task 4: Add the random-name page with controls and results

**Files:**
- Create: `src/routes/random-name/+page.svelte`
- Modify: `src/lib/utils/clipboard.ts` (only if no changes are required, leave untouched)
- Test: `src/lib/utils/random-name.test.ts`

- [ ] **Step 1: Write the failing test**

Use the utility tests as the behavior safety net for this page task. The page itself will be validated with `svelte-check` and the app-wide lint command after implementation.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run check`
Expected: FAIL because `src/routes/random-name/+page.svelte` does not yet exist and the route is not implemented

- [ ] **Step 3: Write minimal implementation**

Create `src/routes/random-name/+page.svelte` with:

```svelte
<script lang="ts">
import { Check, Copy, Languages, RefreshCw, UserRound, Users } from "lucide-svelte";
import { copyToClipboard } from "$lib/utils/clipboard";
import {
  generateRandomNames,
  type GeneratedName,
  type NameDisplayOrder,
  type NameGender,
  type SupportedCountry,
} from "$lib/utils/random-name";

type CountryOption = {
  value: SupportedCountry;
  label: string;
  description: string;
};

type GenderOption = {
  value: NameGender;
  label: string;
};

const countryOptions: CountryOption[] = [
  { value: "us", label: "United States", description: "Given name first by default." },
  { value: "cn", label: "China", description: "Family name first in local order." },
  { value: "jp", label: "Japan", description: "Family name first in local order." },
  { value: "kr", label: "South Korea", description: "Family name first in local order." },
];

const genderOptions: GenderOption[] = [
  { value: "random", label: "Random" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const displayOrderOptions: { value: NameDisplayOrder; label: string }[] = [
  { value: "local", label: "Local Order" },
  { value: "western", label: "English Order" },
];

let country = $state<SupportedCountry>("us");
let gender = $state<NameGender>("random");
let batchCount = $state(6);
let displayOrder = $state<NameDisplayOrder>("local");
let generatedNames = $state<GeneratedName[]>([]);
let primaryName = $derived(generatedNames[0] ?? null);
let errorMessage = $state("");
let copiedValue = $state("");
let copyLabel = $state("Copy");
let initialized = false;
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

$effect(() => {
  if (initialized) {
    return;
  }

  initialized = true;
  handleGenerate();
});

function clampBatchCount(): void {
  if (!Number.isInteger(batchCount) || Number.isNaN(batchCount)) {
    batchCount = 6;
    return;
  }

  batchCount = Math.min(20, Math.max(1, batchCount));
}

function countryLabel(value: SupportedCountry): string {
  return countryOptions.find((option) => option.value === value)?.label ?? value;
}

async function handleGenerate(): Promise<void> {
  errorMessage = "";
  clampBatchCount();

  try {
    generatedNames = generateRandomNames({
      country,
      gender,
      count: batchCount,
      displayOrder,
    });
    resetCopyFeedback();
  } catch (error) {
    generatedNames = [];
    errorMessage =
      error instanceof Error ? error.message : "Failed to generate random names.";
  }
}

async function handleCopy(value: string, successLabel = "Copied!"): Promise<void> {
  const success = await copyToClipboard(value);

  copiedValue = value;
  copyLabel = success ? successLabel : "Copy failed";

  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer);
  }

  copyFeedbackTimer = setTimeout(() => {
    copiedValue = "";
    copyLabel = "Copy";
  }, 1600);
}

function resetCopyFeedback(): void {
  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = null;
  }

  copiedValue = "";
  copyLabel = "Copy";
}
</script>
```

And the page markup should include:

- Intro card with title, description, and naming-order hint
- Select controls for country, gender, and display order
- Number input for batch size with `bind:value={batchCount}`
- Generate button
- Primary result card with full name and copy action
- Batch results list with family name, given name, gender, country, and per-row copy buttons
- Inline error message block when `errorMessage` is set

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run check`
Expected: PASS for the new route and its TypeScript bindings

- [ ] **Step 5: Commit**

```bash
git add src/routes/random-name/+page.svelte
git commit -m "feat: add random name generator page"
```

### Task 5: Register the tool in the shared tool index

**Files:**
- Modify: `src/lib/utils/tools.ts`
- Test: `src/routes/+page.svelte`

- [ ] **Step 1: Write the failing test**

Use app verification as the guard here. The failing condition is the absence of the new tool in the homepage tool list.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run check`
Expected: functional gap remains because the homepage tool registry does not expose the new route yet

- [ ] **Step 3: Write minimal implementation**

Add a new entry in `src/lib/utils/tools.ts` near the existing identifier generators:

```ts
{
  name: "Random Name Generator",
  description: "Generate random names for the US, China, Japan, and South Korea",
  icon: Users,
  href: "/random-name",
  color: "bg-rose-50 text-rose-600 border-rose-100",
  hoverColor: "group-hover:bg-rose-600 group-hover:text-white",
  category: "Identifiers",
  keywords: ["random", "name", "generator", "person", "identity", "us", "china", "japan", "korea"],
},
```

Also update the `lucide-svelte` imports to include `Users`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run check`
Expected: PASS with the new tool metadata wired into the homepage grid and navigation data

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/tools.ts
git commit -m "feat: register random name generator tool"
```

### Task 6: Final verification, cleanup, and delivery commit

**Files:**
- Modify: `log.md`
- Verify: `src/lib/utils/random-name.ts`
- Verify: `src/lib/utils/random-name.test.ts`
- Verify: `src/routes/random-name/+page.svelte`
- Verify: `src/lib/utils/tools.ts`

- [ ] **Step 1: Write the failing test**

Add the delivery note to `log.md` before final verification:

```md
## 20260413

新增：随机姓名生成器工具页，支持美国、中国、日本、韩国姓名生成。
新增：支持 `random` / `male` / `female` 性别筛选、批量生成、本地顺序与英文顺序切换、完整姓名复制。
新增：随机姓名纯函数工具与测试覆盖，统一处理轻量词库、参数校验与 Web Crypto 随机选择。
更新：首页工具索引，新增 Random Name Generator 入口。
```

- [ ] **Step 2: Run test to verify it fails**

Run: `git diff -- log.md`
Expected: shows the new delivery note before the final commit

- [ ] **Step 3: Write minimal implementation**

Run the required formatting and verification commands after updating `log.md`:

```bash
bun run lint:fix
bun test src/lib/utils/random-name.test.ts
bun run check
```

If all commands pass, stage the feature files and `log.md`.

- [ ] **Step 4: Run test to verify it passes**

Expected fresh evidence:

- `bun run lint:fix` exits 0
- `bun test src/lib/utils/random-name.test.ts` exits 0
- `bun run check` exits 0

- [ ] **Step 5: Commit**

```bash
git add log.md src/lib/utils/random-name.ts src/lib/utils/random-name.test.ts src/routes/random-name/+page.svelte src/lib/utils/tools.ts
git commit -m "feat: add random name generator tool"
```
