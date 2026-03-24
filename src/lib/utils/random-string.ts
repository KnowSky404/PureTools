export const LOWERCASE_CHARACTERS = "abcdefghijklmnopqrstuvwxyz";
export const UPPERCASE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const NUMBER_CHARACTERS = "0123456789";
export const SAFE_SYMBOL_CHARACTERS = "-_.";

const AMBIGUOUS_CHARACTERS = "0O1lI";
const MAX_LENGTH = 128;
const MAX_COUNT = 24;

export type RandomStringPoolOptions = {
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  customCharacters?: string;
  excludeSimilar?: boolean;
  startsWithLetter?: boolean;
};

export type RandomStringOptions = RandomStringPoolOptions & {
  length: number;
  count?: number;
};

export type RandomStringPools = {
  pool: string;
  firstCharacterPool: string;
};

export function resolveRandomStringPools(options: RandomStringPoolOptions): RandomStringPools {
  const excludeSimilar = options.excludeSimilar ?? false;
  const startsWithLetter = options.startsWithLetter ?? false;

  let pool = "";

  if (options.lowercase) {
    pool += LOWERCASE_CHARACTERS;
  }
  if (options.uppercase) {
    pool += UPPERCASE_CHARACTERS;
  }
  if (options.numbers) {
    pool += NUMBER_CHARACTERS;
  }
  if (options.symbols) {
    pool += SAFE_SYMBOL_CHARACTERS;
  }
  if (options.customCharacters) {
    pool += options.customCharacters;
  }

  pool = normalizeCharacterSet(pool);
  if (excludeSimilar) {
    pool = removeAmbiguousCharacters(pool);
  }
  if (!pool) {
    throw new Error("Select at least one character set or provide custom characters.");
  }

  let firstCharacterPool = pool;
  if (startsWithLetter) {
    firstCharacterPool = "";
    if (options.lowercase) {
      firstCharacterPool += LOWERCASE_CHARACTERS;
    }
    if (options.uppercase) {
      firstCharacterPool += UPPERCASE_CHARACTERS;
    }
    firstCharacterPool = normalizeCharacterSet(firstCharacterPool);
    if (excludeSimilar) {
      firstCharacterPool = removeAmbiguousCharacters(firstCharacterPool);
    }
    if (!firstCharacterPool) {
      throw new Error("Enable lowercase or uppercase if the string must start with a letter.");
    }
  }

  return {
    pool,
    firstCharacterPool,
  };
}

export function generateRandomStrings(options: RandomStringOptions): string[] {
  const count = options.count ?? 1;

  if (!Number.isInteger(options.length) || options.length < 1 || options.length > MAX_LENGTH) {
    throw new Error(`Length must be an integer between 1 and ${MAX_LENGTH}.`);
  }
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new Error(`Batch size must be an integer between 1 and ${MAX_COUNT}.`);
  }
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Web Crypto is not available in this environment.");
  }

  const { pool, firstCharacterPool } = resolveRandomStringPools(options);

  return Array.from({ length: count }, () =>
    createRandomString(options.length, pool, firstCharacterPool),
  );
}

function createRandomString(length: number, pool: string, firstCharacterPool: string): string {
  let value = "";

  for (let index = 0; index < length; index += 1) {
    const source = index === 0 ? firstCharacterPool : pool;
    value += source[getRandomIndex(source.length)] ?? "";
  }

  return value;
}

function getRandomIndex(size: number): number {
  if (size <= 0) {
    throw new Error("Character pool must not be empty.");
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

function normalizeCharacterSet(value: string): string {
  return Array.from(new Set(value.split(""))).join("");
}

function removeAmbiguousCharacters(value: string): string {
  return value
    .split("")
    .filter((character) => !AMBIGUOUS_CHARACTERS.includes(character))
    .join("");
}
