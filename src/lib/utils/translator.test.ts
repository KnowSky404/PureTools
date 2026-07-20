import { describe, expect, test } from "bun:test";
import { getLanguageName, normalizeDetectedLanguage } from "./translator";

describe("normalizeDetectedLanguage", () => {
  test("keeps an exact supported language code", () => {
    expect(normalizeDetectedLanguage("zh-Hant")).toBe("zh-Hant");
  });

  test("falls back to a supported base language", () => {
    expect(normalizeDetectedLanguage("en-US")).toBe("en");
    expect(normalizeDetectedLanguage("zh-CN")).toBe("zh");
  });

  test("returns null for unsupported languages", () => {
    expect(normalizeDetectedLanguage("af")).toBe(null);
  });
});

describe("getLanguageName", () => {
  test("returns the display name or the original code", () => {
    expect(getLanguageName("ja")).toBe("Japanese");
    expect(getLanguageName("unknown")).toBe("unknown");
  });
});
