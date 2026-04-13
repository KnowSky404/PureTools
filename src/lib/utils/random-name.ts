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

const SUPPORTED_COUNTRIES = ["us", "cn", "jp", "kr"] as const;
const SUPPORTED_GENDERS = ["random", "male", "female"] as const;
const MAX_COUNT = 20;

export const randomNameDatasets: Record<SupportedCountry, NameDataset> = {
  us: {
    familyNames: [
      "Smith",
      "Johnson",
      "Williams",
      "Brown",
      "Jones",
      "Garcia",
      "Miller",
      "Davis",
      "Wilson",
      "Taylor",
    ],
    maleGivenNames: [
      "James",
      "John",
      "Robert",
      "Michael",
      "William",
      "David",
      "Joseph",
      "Daniel",
      "Matthew",
      "Samuel",
      "Henry",
      "Jack",
    ],
    femaleGivenNames: [
      "Emma",
      "Olivia",
      "Ava",
      "Sophia",
      "Isabella",
      "Mia",
      "Charlotte",
      "Amelia",
      "Harper",
      "Evelyn",
      "Abigail",
      "Ella",
    ],
    localOrder: "given-first",
  },
  cn: {
    familyNames: ["Wang", "Li", "Zhang", "Liu", "Chen", "Yang", "Zhao", "Huang", "Zhou", "Wu"],
    maleGivenNames: [
      "Wei",
      "Jie",
      "Jun",
      "Hao",
      "Ming",
      "Tao",
      "Lei",
      "Bo",
      "Peng",
      "Yu",
      "Qiang",
      "Bin",
    ],
    femaleGivenNames: [
      "Li",
      "Na",
      "Jing",
      "Yan",
      "Ting",
      "Yue",
      "Xin",
      "Fang",
      "Min",
      "Xue",
      "Ling",
      "Qian",
    ],
    localOrder: "family-first",
  },
  jp: {
    familyNames: [
      "Sato",
      "Suzuki",
      "Takahashi",
      "Tanaka",
      "Watanabe",
      "Ito",
      "Yamamoto",
      "Nakamura",
      "Kobayashi",
      "Kato",
    ],
    maleGivenNames: [
      "Haruto",
      "Yuto",
      "Sota",
      "Yuki",
      "Hayato",
      "Koki",
      "Sora",
      "Ren",
      "Kenta",
      "Daiki",
      "Takumi",
      "Itsuki",
    ],
    femaleGivenNames: [
      "Yui",
      "Aoi",
      "Hina",
      "Yuna",
      "Mei",
      "Rin",
      "Sakura",
      "Akari",
      "Mio",
      "Nanami",
      "Honoka",
      "Misaki",
    ],
    localOrder: "family-first",
  },
  kr: {
    familyNames: ["Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Cho", "Yoon", "Jang", "Lim"],
    maleGivenNames: [
      "Minjun",
      "Seojun",
      "Jiho",
      "Dohyun",
      "Junseo",
      "Hyunwoo",
      "Jisung",
      "Taeyang",
      "Yejun",
      "Siwoo",
      "Geonwoo",
      "Woojin",
    ],
    femaleGivenNames: [
      "Minji",
      "Seoyeon",
      "Jiwoo",
      "Sujin",
      "Hayoon",
      "Yuna",
      "Jiwon",
      "Chaewon",
      "Sohee",
      "Eunji",
      "Yeseo",
      "Nari",
    ],
    localOrder: "family-first",
  },
};

export function formatGeneratedName(
  name: Pick<GeneratedName, "localizedFullName" | "westernFullName">,
  displayOrder: NameDisplayOrder,
): string {
  return displayOrder === "western" ? name.westernFullName : name.localizedFullName;
}

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
    const localizedFullName = buildLocalizedFullName(familyName, givenName, dataset.localOrder);
    const westernFullName = `${givenName} ${familyName}`;

    return {
      country: options.country,
      gender: resolvedGender,
      familyName,
      givenName,
      localizedFullName,
      westernFullName,
      fullName: formatGeneratedName(
        {
          localizedFullName,
          westernFullName,
        },
        displayOrder,
      ),
    };
  });
}
