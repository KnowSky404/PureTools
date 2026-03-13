# PureTools

English | [中文](README.zh-CN.md)

PureTools is a lightweight, privacy-first, pure-frontend toolkit for developers. All processing happens locally in the browser with zero backend dependencies.

## Highlights

- Pure frontend, no backend required
- Privacy-first: data never leaves your device
- Dark/light mode with system sync
- Fast tool search with category grouping

## Tools

- UUID Generator (RFC 4122 v4): generate, validate, history, copy
- JSON Formatter: format, minify, validate, escape/unescape, syntax highlight, line numbers, copy
- SQL Formatter: format/minify, basic validation (strings/parentheses), line numbers, copy
- Regex Tool: validate, test, highlight matches, generator templates
- CRON Tool: 5-field CRON validator and generator
- Base64 Tool: encode/decode, URL-safe mode
- URL Encoder: encode/decode (component/full URL)
- JWT Decoder: header/payload decode, time claim insights
- Hash Tool: SHA-1/256/384/512 via Web Crypto
- Timestamp Tool: timestamp <-> local datetime, seconds/milliseconds, local + UTC outputs, copy
- GitHub CDN: convert GitHub/raw links to raw + jsDelivr URLs, copy

## Tech Stack

- SvelteKit (Svelte 5 Runes) + Vite
- TypeScript (strict)
- Tailwind CSS v4
- Biome (lint/format)
- Cloudflare adapter (deployment target)

## Local Development

1. Install dependencies:

```sh
bun install
```

2. Start the dev server:

```sh
bun run dev
```

## Scripts

- `bun run dev`: start dev server
- `bun run build`: build for production
- `bun run preview`: preview production build
- `bun run check`: type-check and sync
- `bun run lint`: lint + type-check
- `bun run lint:fix`: auto-fix lint issues
- `bun run format`: format code
- `bun run cf:dev`: run Wrangler local dev
- `bun run cf:deploy`: deploy to Cloudflare Workers

## Notes

- All tools run locally in the browser; no data is sent to any server.
