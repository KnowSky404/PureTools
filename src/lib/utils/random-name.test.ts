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

  test("uses native scripts for China, Japan, and South Korea", () => {
    const chinese = generateRandomNames({
      country: "cn",
      gender: "female",
      count: 1,
    })[0];
    const japanese = generateRandomNames({
      country: "jp",
      gender: "male",
      count: 1,
    })[0];
    const korean = generateRandomNames({
      country: "kr",
      gender: "female",
      count: 1,
    })[0];

    expect(chinese.fullName).toMatch(/[\u4e00-\u9fff]/);
    expect(japanese.fullName).toMatch(/[\u3040-\u30ff\u4e00-\u9faf]/);
    expect(korean.fullName).toMatch(/[\uac00-\ud7af]/);
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
      country: "us",
      gender: "female",
      count: 1,
      displayOrder: "western",
    });

    const [result] = results;
    expect(result.westernFullName).toBe(`${result.givenName} ${result.familyName}`);
    expect(result.fullName).toBe(result.westernFullName);
  });

  test("falls back to local order for countries without western order support", () => {
    const results = generateRandomNames({
      country: "kr",
      gender: "female",
      count: 1,
      displayOrder: "western",
    });

    const [result] = results;
    expect(result.localizedFullName).toBe(`${result.familyName} ${result.givenName}`);
    expect(result.fullName).toBe(result.localizedFullName);
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

  test("ships lightweight pools for every country", () => {
    for (const country of supportedCountries) {
      expect(randomNameDatasets[country].familyNames.length).toBeGreaterThanOrEqual(10);
      expect(randomNameDatasets[country].maleGivenNames.length).toBeGreaterThanOrEqual(12);
      expect(randomNameDatasets[country].femaleGivenNames.length).toBeGreaterThanOrEqual(12);
    }
  });
});
