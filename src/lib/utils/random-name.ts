export type SupportedCountry = "us" | "cn" | "jp" | "kr";
export type NameGender = "random" | "male" | "female";
export type ResolvedNameGender = Exclude<NameGender, "random">;
export type NameDisplayOrder = "local" | "western";

type NameDataset = {
  familyNames: string[];
  maleGivenNames: string[];
  femaleGivenNames: string[];
  localOrder: "family-first" | "given-first";
  supportsWesternOrder: boolean;
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
    supportsWesternOrder: true,
  },
  cn: {
    familyNames: ["王", "李", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴"],
    maleGivenNames: ["伟", "杰", "俊", "浩", "明", "涛", "磊", "博", "鹏", "宇", "强", "斌"],
    femaleGivenNames: ["丽", "娜", "静", "妍", "婷", "悦", "欣", "芳", "敏", "雪", "玲", "倩"],
    localOrder: "family-first",
    supportsWesternOrder: false,
  },
  jp: {
    familyNames: ["佐藤", "鈴木", "高橋", "田中", "渡辺", "伊藤", "山本", "中村", "小林", "加藤"],
    maleGivenNames: [
      "陽斗",
      "悠真",
      "蒼太",
      "樹",
      "湊",
      "蓮",
      "大和",
      "颯真",
      "大翔",
      "健太",
      "拓海",
      "樹生",
    ],
    femaleGivenNames: [
      "結衣",
      "葵",
      "陽菜",
      "結菜",
      "芽依",
      "凛",
      "桜",
      "朱莉",
      "美桜",
      "七海",
      "穂香",
      "美咲",
    ],
    localOrder: "family-first",
    supportsWesternOrder: false,
  },
  kr: {
    familyNames: ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임"],
    maleGivenNames: [
      "민준",
      "서준",
      "지호",
      "도현",
      "준서",
      "현우",
      "지성",
      "태양",
      "예준",
      "시우",
      "건우",
      "우진",
    ],
    femaleGivenNames: [
      "민지",
      "서연",
      "지우",
      "수진",
      "하윤",
      "유나",
      "지원",
      "채원",
      "소희",
      "은지",
      "예서",
      "나리",
    ],
    localOrder: "family-first",
    supportsWesternOrder: false,
  },
};

export function formatGeneratedName(
  name: Pick<GeneratedName, "localizedFullName" | "westernFullName">,
  displayOrder: NameDisplayOrder,
): string {
  return displayOrder === "western" ? name.westernFullName : name.localizedFullName;
}

export function supportsWesternOrder(country: SupportedCountry): boolean {
  return randomNameDatasets[country].supportsWesternOrder;
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

  const dataset = randomNameDatasets[options.country];
  const count = resolveCount(options.count);
  const displayOrder =
    options.displayOrder === "western" && !dataset.supportsWesternOrder
      ? "local"
      : (options.displayOrder ?? "local");

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
