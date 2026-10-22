import { describe, expect, test } from "bun:test";
import {
  DEFAULT_CITIES,
  dayDifference,
  dayLabel,
  FIXED_ZONES,
  formatOffset,
  formatZonedDateTime,
  ianaZone,
  offsetAt,
  parseLocalDateTime,
  readClockPreferences,
  resolveLocalDateTime,
  supportedTimeZones,
  type TimeZone,
  zoneFromValue,
} from "./timezone";

function unique(input: string, zone: TimeZone): number {
  const result = resolveLocalDateTime(input, zone);
  expect(result.status).toBe("unique");
  return result.candidates[0].instant;
}

describe("region and fixed-offset conversion", () => {
  test("PDT and PST stay distinct in October and in winter/summer", () => {
    const shanghai = ianaZone("Asia/Shanghai");
    const pdt = unique("2026-10-22T14:06", FIXED_ZONES.PDT);
    const pst = unique("2026-10-22T14:06", FIXED_ZONES.PST);
    expect(formatZonedDateTime(pdt, shanghai).input).toBe("2026-10-23T05:06:00");
    expect(formatZonedDateTime(pst, shanghai).input).toBe("2026-10-23T06:06:00");
    expect(pst - pdt).toBe(3_600_000);
    const la = ianaZone("America/Los_Angeles");
    for (const [input, expected] of [
      ["2026-01-22T14:06", -480],
      ["2026-07-22T14:06", -420],
    ] as const) {
      expect(offsetAt(unique(input, la), la)).toBe(expected);
      expect(offsetAt(unique(input, FIXED_ZONES.PST), FIXED_ZONES.PST)).toBe(-480);
      expect(offsetAt(unique(input, FIXED_ZONES.PDT), FIXED_ZONES.PDT)).toBe(-420);
    }
  });

  test("Kathmandu's quarter-hour offset and 12-hour midnight/noon", () => {
    const zone = ianaZone("Asia/Kathmandu");
    const instant = unique("2026-10-22T00:00", FIXED_ZONES.UTC);
    expect(formatZonedDateTime(instant, zone).input).toBe("2026-10-22T05:45:00");
    expect(formatZonedDateTime(instant, zone).offset).toBe("UTC+05:45");
    expect(formatZonedDateTime(instant, FIXED_ZONES.UTC, true).time).toBe("12:00:00 AM");
    expect(formatZonedDateTime(instant + 43_200_000, FIXED_ZONES.UTC, true).time).toBe(
      "12:00:00 PM",
    );
  });

  test("all supported regions round-trip across winter and summer independently of machine TZ", () => {
    for (const id of supportedTimeZones()) {
      const zone = ianaZone(id);
      for (const iso of ["2026-01-15T12:34:56.789Z", "2026-07-15T12:34:56.789Z"]) {
        const instant = Date.parse(iso);
        const local = formatZonedDateTime(instant, zone);
        expect(
          resolveLocalDateTime(local.input, zone).candidates.some((c) => c.instant === instant),
        ).toBe(true);
      }
    }
  });

  test("UTC, same region and fixed offsets convert in both directions; swaps preserve milliseconds", () => {
    for (const zone of [
      ianaZone("UTC"),
      ianaZone("Asia/Tokyo"),
      FIXED_ZONES.PST,
      FIXED_ZONES.PDT,
    ]) {
      const instant = unique("2026-12-31T23:59:59.123", zone);
      for (const target of [FIXED_ZONES.UTC, ianaZone("Asia/Shanghai"), FIXED_ZONES.PST, zone]) {
        const targetInput = formatZonedDateTime(instant, target).input;
        expect(unique(targetInput, target)).toBe(instant);
        expect(formatZonedDateTime(instant, zone).input).toBe("2026-12-31T23:59:59.123");
      }
    }
  });

  test("cross-day/year, leap day, early years and day labels", () => {
    const instant = unique("2026-12-31T20:30", FIXED_ZONES.UTC);
    const output = formatZonedDateTime(instant, ianaZone("Asia/Shanghai"));
    expect(output.date).toBe("2027-01-01");
    expect(dayDifference(output.date, "2026-12-31")).toBe(1);
    expect(dayLabel(1)).toBe("Next day (+1 day)");
    expect(dayLabel(-1)).toBe("Previous day (−1 day)");
    expect(dayLabel(0)).toBe("Same day");
    expect(dayLabel(2)).toBe("2 days ahead");
    expect(dayLabel(-2)).toBe("2 days behind");
    expect(dayDifference("2024-03-01", "2024-02-28")).toBe(2);
    for (const input of [
      "0001-01-01T00:00",
      "0099-02-28T00:00",
      "2024-02-29T12:30",
      "9999-12-31T23:59",
    ]) {
      expect(formatZonedDateTime(unique(input, FIXED_ZONES.UTC), FIXED_ZONES.UTC).input).toBe(
        `${input}:00`,
      );
    }
    expect(() =>
      formatZonedDateTime(unique("9999-12-31T23:59", FIXED_ZONES.UTC), ianaZone("Asia/Tokyo")),
    ).toThrow("outside");
  });
});

describe("native IANA transition boundaries", () => {
  test("Los Angeles spring gap is rejected, with exact neighboring seconds", () => {
    const zone = ianaZone("America/Los_Angeles");
    expect(resolveLocalDateTime("2026-03-08T02:30", zone)).toEqual({
      status: "nonexistent",
      candidates: [],
    });
    expect(new Date(unique("2026-03-08T01:59:59", zone)).toISOString()).toBe(
      "2026-03-08T09:59:59.000Z",
    );
    expect(new Date(unique("2026-03-08T03:00:00", zone)).toISOString()).toBe(
      "2026-03-08T10:00:00.000Z",
    );
  });

  test("Los Angeles autumn overlap returns both instants ordered, with both offsets", () => {
    const result = resolveLocalDateTime("2026-11-01T01:30", ianaZone("America/Los_Angeles"));
    expect(result.status).toBe("ambiguous");
    expect(result.candidates.map((c) => c.offsetMinutes)).toEqual([-420, -480]);
    expect(result.candidates.map((c) => new Date(c.instant).toISOString())).toEqual([
      "2026-11-01T08:30:00.000Z",
      "2026-11-01T09:30:00.000Z",
    ]);
    for (const candidate of result.candidates) {
      const utcInput = formatZonedDateTime(candidate.instant, FIXED_ZONES.UTC).input;
      expect(unique(utcInput, FIXED_ZONES.UTC)).toBe(candidate.instant);
      expect(formatZonedDateTime(candidate.instant, ianaZone("America/Los_Angeles")).input).toBe(
        "2026-11-01T01:30:00",
      );
    }
  });

  test("European DST uses March 29/October 25, independently of US rules", () => {
    const zone = ianaZone("Europe/London");
    expect(resolveLocalDateTime("2026-03-29T01:30", zone).status).toBe("nonexistent");
    const overlap = resolveLocalDateTime("2026-10-25T01:30", zone);
    expect(overlap.status).toBe("ambiguous");
    expect(overlap.candidates.map((c) => c.offsetMinutes)).toEqual([60, 0]);
    expect(resolveLocalDateTime("2026-03-08T02:30", zone).status).toBe("unique");
  });

  test("southern hemisphere Sydney and half-hour Lord Howe transitions", () => {
    const sydney = ianaZone("Australia/Sydney");
    expect(offsetAt(unique("2026-01-15T12:00", sydney), sydney)).toBe(660);
    expect(offsetAt(unique("2026-07-15T12:00", sydney), sydney)).toBe(600);
    expect(resolveLocalDateTime("2026-10-04T02:30", sydney).status).toBe("nonexistent");
    expect(
      resolveLocalDateTime("2026-04-05T02:30", sydney).candidates.map((c) => c.offsetMinutes),
    ).toEqual([660, 600]);
    const lordHowe = ianaZone("Australia/Lord_Howe");
    expect(resolveLocalDateTime("2026-10-04T02:15", lordHowe).status).toBe("nonexistent");
    const overlap = resolveLocalDateTime("2026-04-05T01:45", lordHowe);
    expect(overlap.candidates.map((c) => c.offsetMinutes)).toEqual([660, 630]);
    expect(overlap.candidates[1].instant - overlap.candidates[0].instant).toBe(1_800_000);
  });

  test("date-line gap, whole-day overlap and historical second offsets", () => {
    expect(resolveLocalDateTime("2011-12-30T12:00", ianaZone("Pacific/Apia")).status).toBe(
      "nonexistent",
    );
    const overlap = resolveLocalDateTime("1969-09-30T12:00", ianaZone("Pacific/Kwajalein"));
    expect(overlap.candidates.map((c) => c.offsetMinutes)).toEqual([660, -720]);
    const paris = ianaZone("Europe/Paris");
    const instant = unique("1900-01-01T12:00", paris);
    expect(formatZonedDateTime(instant, paris).offset).toBe("UTC+00:09:21");
    expect(formatZonedDateTime(instant, paris).input).toBe("1900-01-01T12:00:00");
  });
});

describe("validation and compatibility", () => {
  test("rejects normalization, incomplete dates, ambiguous abbreviations and invalid offsets", () => {
    for (const input of [
      "2026-02-29T12:00",
      "2024-02-30T12:00",
      "2026-13-01T00:00",
      "2026-00-01T00:00",
      "2026-04-31T12:00",
      "0000-01-01T00:00",
      "2026-01-01T24:00",
      "2026-01-01T23:60",
      "2026-01-01T12:00:60",
      "2026-01-01",
      "12:00",
      "2026-01-01T12:00Z",
      "2026-01-01T12:00:00.1234",
    ]) {
      expect(() => parseLocalDateTime(input)).toThrow();
    }
    for (const zone of ["CST", "PST", "PDT", "GMT", "Invalid/Zone", "", "fixed:invalid"]) {
      expect(() => zoneFromValue(zone)).toThrow();
    }
    expect(() =>
      resolveLocalDateTime("2026-01-01T00:00", { kind: "fixed", offsetMinutes: NaN, label: "bad" }),
    ).toThrow();
    expect(() => offsetAt(NaN, FIXED_ZONES.UTC)).toThrow();
    expect(formatOffset(-480)).toBe("UTC−08:00");
    expect(formatOffset(0)).toBe("UTC+00:00");
  });

  test("clock preference parsing validates IANA IDs and preserves intentionally empty lists", () => {
    expect(readClockPreferences(null).zones).toEqual(DEFAULT_CITIES.map((city) => city.zone));
    for (const raw of ["{", "null", "[]", '{"zones":"bad"}']) {
      expect(readClockPreferences(raw).zones).toHaveLength(6);
    }
    expect(
      readClockPreferences(
        '{"zones":["Asia/Tokyo","PST","fixed:PDT","Invalid/Zone",7,"Asia/Tokyo"],"hour12":true}',
      ),
    ).toEqual({ zones: ["Asia/Tokyo"], hour12: true });
    expect(readClockPreferences('{"zones":[],"hour12":"yes"}')).toEqual({
      zones: [],
      hour12: false,
    });
  });

  test("common-city fallback is validated when supportedValuesOf is unavailable", () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, "supportedValuesOf");
    Object.defineProperty(Intl, "supportedValuesOf", { value: undefined, configurable: true });
    try {
      const zones = supportedTimeZones();
      for (const city of DEFAULT_CITIES) {
        expect(zones.includes(city.zone)).toBe(true);
      }
      expect(zones.includes("Asia/Kathmandu")).toBe(true);
      expect(zones.includes("UTC")).toBe(true);
    } finally {
      if (descriptor) {
        Object.defineProperty(Intl, "supportedValuesOf", descriptor);
      }
    }
  });
});
