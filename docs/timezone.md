# Time Zone Converter & World Clock

`/timezone` is a pure browser tool. `/timestamp` retains its existing Unix timestamp behavior;
the two pages link to each other. No date library, Temporal polyfill, embedded time zone
database, network time service, or application API is required.

## Conversion and DST

- Region choices are explicit IANA identifiers, such as `America/Los_Angeles` and
  `Asia/Shanghai`. Native `Intl.DateTimeFormat` supplies date-specific rules and available
  abbreviations. A browser may return a GMT offset instead of a named abbreviation.
- Fixed **PST = UTC−08:00**, **PDT = UTC−07:00**, and **UTC = UTC+00:00** are separate choices.
  They do not follow Los Angeles DST rules. Ambiguous region abbreviations such as CST are
  rejected instead of guessed.
- Input includes a Gregorian date in years 0001–9999 and 24-hour time, with optional seconds
  and milliseconds. Strict numeric validation rejects nonexistent calendar dates, 24:00,
  leap seconds, and out-of-range converted dates. It never parses a selected region's
  wall time through `new Date(localDateTimeString)` in the device's time zone.
- The parser first represents the wall-clock fields on a UTC calendar. For an IANA region,
  it probes native offsets hourly across a 96-hour window centered on that calendar day.
  Each observed offset yields a candidate instant; a native offset round trip must reproduce
  the original wall time exactly. The window covers both sides of IANA DST changes and
  date-line jumps; offset precision includes historical seconds and half-hour changes.
- Zero candidates means a clock-forward gap: the page rejects the input with a visible
  error. Multiple candidates mean a clock-back overlap: no conversion/copy is available
  until the user selects **Earlier** or **Later**, with each candidate's UTC offset and
  ISO instant shown. No candidate is silently normalized or selected.
- **Swap** converts the selected instant into the new source wall time and retains its
  exact candidate, including milliseconds and a previously chosen overlap instance.
  **Now** similarly identifies the actual current instance during an overlap.
- Formatter and date/region offset caches are each bounded to 128 entries. Conversion is
  derived only from the converter inputs; ticking world clocks do not re-run source parsing.

Examples:

| Source | Target | Result |
| --- | --- | --- |
| 2026-10-22 14:06 fixed PDT | Asia/Shanghai | 2026-10-23 05:06 |
| 2026-10-22 14:06 fixed PST | Asia/Shanghai | 2026-10-23 06:06 |
| 2026-03-08 02:30 America/Los_Angeles | Any | Nonexistent local time |
| 2026-11-01 01:30 America/Los_Angeles | UTC | 08:30 at UTC−07:00, or 09:30 at UTC−08:00 |

## World clocks, privacy and browser support

The default clocks are Los Angeles, New York, London, Beijing (`Asia/Shanghai`), Tokyo, and
Sydney. Every clock shows the device's current instant as a local date/time, offset and
available abbreviation; day changes are relative to the detected device time zone.
Users can search/add/remove IANA regions, up to 24 clocks, and switch between 12/24 hours.

Only the selected IANA IDs and clock display preference are saved, under localStorage key
`puretools.world-clock.v1`. Converter input, results and clipboard content are not persisted
or uploaded. Corrupt preferences fall back safely; blocked storage keeps the current visit
functional and displays a notice. Theme persistence also tolerates blocked storage.

Current time, device-zone detection, storage and timers start in `onMount`, after SSR hydration.
One one-second timer updates all clocks while the page is visible. Hiding the page clears it;
returning immediately reads the device clock and resumes it. Navigation/unmount removes both
the timer and visibility listener.

The browser must support `Intl.DateTimeFormat`, IANA regions and `formatToParts`. A missing
`Intl.supportedValuesOf("timeZone")` falls back to a runtime-validated common-city list.
Missing core capabilities or invalid/unsupported zones produce visible feedback. Time zone
data and abbreviations depend on the runtime's installed rules, and current time depends on
the device clock. They are not independently synchronized or corrected. Native Temporal
support is not assumed.

Clipboard writes reuse the existing helper. Denied permissions, missing Clipboard API, or
an insecure context produce a manual-copy instruction. The repository's existing Google
Fonts requests remain separate from time calculations.

Platform references: [Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat),
[Intl.supportedValuesOf](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf).

## Global navigation

The original categories and the single `tools` registry remain authoritative. `navGroups`
maps them to four disclosures; homepage cards and search use that same registry.

| Navigation group | Existing categories |
| --- | --- |
| Text & Data | Formatters, Text |
| Generate & Encode | Identifiers, Encoding |
| Dev & Security | Patterns, Security, Delivery |
| Time & Convert | Time, Finance |

At the Tailwind `xl` breakpoint (80rem, normally 1280 CSS pixels of available viewport), all
four groups are visible. Below it, **Tools** opens a single menu containing every group.
Classic scrollbars can reduce the media viewport below the requested window width.
Search, theme and GitHub remain accessible at 320px.
The shared popup fits inside the viewport, scrolls vertically, and follows both themes.
Triggers expose `aria-expanded`/`aria-controls`; current tool links expose `aria-current`.
Click toggles the disclosure; ArrowDown opens and focuses its first link. Escape and the close
button restore trigger focus. Outside clicks, leaving the disclosure by keyboard, responsive
mode changes and completed navigations close it. `/` focuses search outside editable inputs.

## Verification

`timezone.test.ts` covers the examples, date validation, all runtime-enumerated regions in
winter/summer, UTC and fixed/region round trips, fractional offsets, DST gaps/overlaps in
America/Europe/Australia, Lord Howe half-hour changes, the Apia skipped day, Kwajalein's
23-hour overlap, historical second offsets, preference validation and enumeration fallback.

`timezone.e2e.ts` exercises device time zone detection, exact default city dates/offsets,
conversion and swaps, DST instance choice, searchable city management/persistence, blocked
storage, capability fallback, clipboard success/failure, request privacy, hydration, live
timer pause/resume and navigation cleanup. `navigation.e2e.ts` covers 320, 375, 768, 1024,
1280 and 1440px in light/dark themes, every homepage tool's navigation path, current route,
keyboard focus, dismissal, mobile scrolling and global search matching.

Run the project's required gates:

```sh
bun run lint:fix
bun run check
bun run lint
bun run test:unit
bun run test:e2e
bun run build
```

Actual execution results and environment limits are recorded in `log.md` for this iteration.
