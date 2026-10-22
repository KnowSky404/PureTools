export type TimeZone =
  | { kind: "iana"; id: string }
  | { kind: "fixed"; offsetMinutes: number; label: string };

export type City = { name: string; zone: string };
export type TimeCandidate = { instant: number; offsetMinutes: number };
export type LocalTimeResolution = {
  status: "unique" | "ambiguous" | "nonexistent";
  candidates: TimeCandidate[];
};
export type ZonedDateTime = {
  date: string;
  time: string;
  input: string;
  offsetMinutes: number;
  offset: string;
  abbreviation: string;
};

export const DEFAULT_CITIES: readonly City[] = [
  { name: "Los Angeles", zone: "America/Los_Angeles" },
  { name: "New York", zone: "America/New_York" },
  { name: "London", zone: "Europe/London" },
  { name: "Beijing", zone: "Asia/Shanghai" },
  { name: "Tokyo", zone: "Asia/Tokyo" },
  { name: "Sydney", zone: "Australia/Sydney" },
];

export const COMMON_CITIES: readonly City[] = [
  ...DEFAULT_CITIES,
  { name: "UTC", zone: "UTC" },
  { name: "Paris", zone: "Europe/Paris" },
  { name: "Berlin", zone: "Europe/Berlin" },
  { name: "Dubai", zone: "Asia/Dubai" },
  { name: "Kolkata", zone: "Asia/Kolkata" },
  { name: "Kathmandu", zone: "Asia/Kathmandu" },
  { name: "Singapore", zone: "Asia/Singapore" },
  { name: "Hong Kong", zone: "Asia/Hong_Kong" },
  { name: "Auckland", zone: "Pacific/Auckland" },
  { name: "Honolulu", zone: "Pacific/Honolulu" },
  { name: "São Paulo", zone: "America/Sao_Paulo" },
  { name: "Toronto", zone: "America/Toronto" },
  { name: "Johannesburg", zone: "Africa/Johannesburg" },
  { name: "Cairo", zone: "Africa/Cairo" },
  { name: "Lord Howe Island", zone: "Australia/Lord_Howe" },
  { name: "Apia", zone: "Pacific/Apia" },
];

export const FIXED_ZONES: Readonly<Record<string, TimeZone>> = {
  PST: { kind: "fixed", offsetMinutes: -480, label: "PST" },
  PDT: { kind: "fixed", offsetMinutes: -420, label: "PDT" },
  UTC: { kind: "fixed", offsetMinutes: 0, label: "UTC" },
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const formatters = new Map<string, Intl.DateTimeFormat>();
const dailyOffsets = new Map<string, number[]>();

function cache<K, V>(map: Map<K, V>, key: K, value: V): V {
  // Bound caches even if a visitor explores every supported region/date.
  if (map.size >= 128) {
    const oldest = map.keys().next();
    if (!oldest.done) {
      map.delete(oldest.value);
    }
  }
  map.set(key, value);
  return value;
}

function formatter(id: string): Intl.DateTimeFormat {
  if (typeof Intl === "undefined" || typeof Intl.DateTimeFormat !== "function") {
    throw new Error("This browser does not support Intl time zones. Try a current browser.");
  }
  // Do not accept ambiguous abbreviations such as CST as region identifiers.
  if (id !== "UTC" && !/^[A-Za-z_+-]+\/[A-Za-z0-9_+\-/]+$/.test(id)) {
    throw new Error(`Invalid IANA time zone: ${id}. Choose a region or a fixed offset.`);
  }
  const existing = formatters.get(id);
  if (existing) {
    return existing;
  }
  try {
    const value = new Intl.DateTimeFormat("en-US", {
      timeZone: id,
      calendar: "gregory",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      era: "short",
      hourCycle: "h23",
      timeZoneName: "short",
    });
    if (typeof value.formatToParts !== "function") {
      throw new Error("formatToParts is unavailable");
    }
    return cache(formatters, id, value);
  } catch {
    throw new Error(`Time zone ${id} is invalid or unsupported in this browser.`);
  }
}

export function ianaZone(id: string): TimeZone {
  formatter(id);
  return { kind: "iana", id };
}

export function zoneFromValue(value: string): TimeZone {
  if (value.startsWith("fixed:")) {
    const name = value.slice(6);
    const zone = Object.hasOwn(FIXED_ZONES, name) ? FIXED_ZONES[name] : undefined;
    if (!zone) {
      throw new Error("Invalid fixed UTC offset. Choose PST, PDT, or UTC.");
    }
    return zone;
  }
  return ianaZone(value);
}

function validateFixed(zone: Extract<TimeZone, { kind: "fixed" }>): void {
  if (!Number.isInteger(zone.offsetMinutes) || Math.abs(zone.offsetMinutes) > 14 * 60) {
    throw new Error("Fixed UTC offset must be whole minutes between −14:00 and +14:00.");
  }
}

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function utcEpoch(parts: DateParts, millisecond = 0): number {
  // Date.UTC maps years 0–99 to 1900–1999; setUTCFullYear does not.
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, parts.second, millisecond);
  return date.getTime();
}

export function parseLocalDateTime(input: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(
    input,
  );
  if (!match) {
    throw new Error("Enter a date and time as YYYY-MM-DD HH:mm[:ss].");
  }
  const [year, month, day, hour, minute, second] = match
    .slice(1, 7)
    .map((part) => Number(part ?? 0));
  const milliseconds = Number((match[7] ?? "").padEnd(3, "0"));
  const epoch = utcEpoch({ year, month, day, hour, minute, second }, milliseconds);
  const date = new Date(epoch);
  if (
    year < 1 ||
    year > 9999 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    throw new Error("Invalid date or time. Use a real date in years 0001–9999 and a 24-hour time.");
  }
  return epoch;
}

function regionParts(instant: number, id: string): { parts: DateParts; abbreviation: string } {
  const values = Object.fromEntries(
    formatter(id)
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return {
    parts: {
      year: values.era === "BC" ? 1 - Number(values.year) : Number(values.year),
      month: Number(values.month),
      day: Number(values.day),
      hour: Number(values.hour),
      minute: Number(values.minute),
      second: Number(values.second),
    },
    abbreviation: values.timeZoneName ?? "",
  };
}

export function offsetAt(instant: number, zone: TimeZone): number {
  if (!Number.isFinite(instant) || !Number.isFinite(new Date(instant).getTime())) {
    throw new Error("Invalid time instant.");
  }
  if (zone.kind === "fixed") {
    validateFixed(zone);
    return zone.offsetMinutes;
  }
  const { parts } = regionParts(instant, zone.id);
  // Historical IANA offsets can include seconds; retain that precision.
  return (utcEpoch(parts) - Math.floor(instant / 1000) * 1000) / 60_000;
}

export function resolveLocalDateTime(input: string, zone: TimeZone): LocalTimeResolution {
  const wallEpoch = parseLocalDateTime(input);
  let offsets: number[];
  if (zone.kind === "fixed") {
    validateFixed(zone);
    offsets = [zone.offsetMinutes];
  } else {
    const day = Math.floor(wallEpoch / DAY) * DAY;
    const key = `${zone.id}:${day}`;
    const stored = dailyOffsets.get(key);
    if (stored) {
      offsets = stored;
    } else {
      // Inspect native IANA offsets on both sides of the requested date. The
      // 96-hour window covers offset jumps up to a full date-line day; hourly
      // probes also handle half-hour DST and historical second-based offsets.
      const observed = new Set<number>();
      for (let hour = -48; hour <= 48; hour += 1) {
        observed.add(offsetAt(day + hour * HOUR, zone));
      }
      offsets = cache(dailyOffsets, key, [...observed]);
    }
  }
  const candidates = offsets
    .map((offsetMinutes) => ({ instant: wallEpoch - offsetMinutes * 60_000, offsetMinutes }))
    // Exact round trips reject spring gaps and never normalize user input.
    .filter(({ instant, offsetMinutes }) => offsetAt(instant, zone) === offsetMinutes)
    .sort((a, b) => a.instant - b.instant);
  return {
    status:
      candidates.length === 0 ? "nonexistent" : candidates.length === 1 ? "unique" : "ambiguous",
    candidates,
  };
}

export function formatOffset(minutes: number): string {
  const seconds = Math.round(Math.abs(minutes) * 60);
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const remainder = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const suffix = seconds % 60 ? `:${String(seconds % 60).padStart(2, "0")}` : "";
  return `UTC${minutes < 0 ? "−" : "+"}${hours}:${remainder}${suffix}`;
}

export function formatZonedDateTime(
  instant: number,
  zone: TimeZone,
  hour12 = false,
): ZonedDateTime {
  const offsetMinutes = offsetAt(instant, zone);
  const shifted = new Date(instant + offsetMinutes * 60_000);
  const year = shifted.getUTCFullYear();
  if (year < 1 || year > 9999) {
    throw new Error("Converted date is outside the supported years 0001–9999.");
  }
  const date = `${String(year).padStart(4, "0")}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
  const hours = shifted.getUTCHours();
  const remainder = `${String(shifted.getUTCMinutes()).padStart(2, "0")}:${String(shifted.getUTCSeconds()).padStart(2, "0")}`;
  const time24 = `${String(hours).padStart(2, "0")}:${remainder}`;
  const fractional = shifted.getUTCMilliseconds();
  return {
    date,
    time: hour12 ? `${hours % 12 || 12}:${remainder} ${hours < 12 ? "AM" : "PM"}` : time24,
    input: `${date}T${time24}${fractional ? `.${String(fractional).padStart(3, "0")}` : ""}`,
    offsetMinutes,
    offset: formatOffset(offsetMinutes),
    abbreviation: zone.kind === "fixed" ? zone.label : regionParts(instant, zone.id).abbreviation,
  };
}

export function dayDifference(date: string, referenceDate: string): number {
  return (parseLocalDateTime(`${date}T00:00`) - parseLocalDateTime(`${referenceDate}T00:00`)) / DAY;
}

export function dayLabel(difference: number): string {
  if (difference === 0) {
    return "Same day";
  }
  if (difference === -1) {
    return "Previous day (−1 day)";
  }
  if (difference === 1) {
    return "Next day (+1 day)";
  }
  return `${Math.abs(difference)} days ${difference > 0 ? "ahead" : "behind"}`;
}

export function cityName(zone: string): string {
  return (
    COMMON_CITIES.find((city) => city.zone === zone)?.name ??
    zone.split("/").at(-1)?.replaceAll("_", " ") ??
    zone
  );
}

export function zoneLabel(value: string): string {
  const zone = zoneFromValue(value);
  return zone.kind === "fixed"
    ? `${zone.label} (fixed ${formatOffset(zone.offsetMinutes)})`
    : `${cityName(zone.id)} · ${zone.id} (auto DST)`;
}

export function supportedTimeZones(): string[] {
  let available: string[] = [];
  try {
    available = Intl.supportedValuesOf?.("timeZone") ?? [];
  } catch {
    // Older engines can still format common IANA zones without enumeration.
  }
  return [...new Set([...COMMON_CITIES.map((city) => city.zone), ...available])]
    .filter((id) => {
      try {
        ianaZone(id);
        return true;
      } catch {
        return false;
      }
    })
    .sort();
}

export type ClockPreferences = { zones: string[]; hour12: boolean };
export const CLOCK_STORAGE_KEY = "puretools.world-clock.v1";

export function readClockPreferences(raw: string | null): ClockPreferences {
  const defaults = { zones: DEFAULT_CITIES.map((city) => city.zone), hour12: false };
  if (!raw) {
    return defaults;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value !== "object" ||
      value === null ||
      !("zones" in value) ||
      !Array.isArray(value.zones)
    ) {
      return defaults;
    }
    const zones = [
      ...new Set(value.zones.filter((zone): zone is string => typeof zone === "string")),
    ]
      .slice(0, 24)
      .filter((zone) => {
        try {
          ianaZone(zone);
          return true;
        } catch {
          return false;
        }
      });
    return { zones, hour12: "hour12" in value && value.hour12 === true };
  } catch {
    return defaults;
  }
}
