# PureTools

PureTools is a lightweight, privacy-first, pure-frontend toolkit for developers. All processing happens locally in the browser with zero backend dependencies.

## Tools

- JSON Formatter: format, minify, validate, escape/unescape, syntax highlight, line numbers, copy.
- SQL Formatter: format/minify, basic validation (strings/parentheses), line numbers, copy.
- UUID Generator: RFC 4122 v4 generate, validate, history, copy.
- Timestamp Tool: timestamp <-> local datetime, seconds/milliseconds, local + UTC outputs, copy.
- GitHub to jsDelivr: convert GitHub/raw links to raw + CDN URLs with helpful notices, copy.

## Tech Stack

- SvelteKit (Svelte 5 Runes) + Vite
- TypeScript (strict)
- Tailwind CSS v4
- Biome (lint/format)
- Cloudflare adapter (deployment target)

## Local Development

1. Install dependencies:

```sh
pnpm install
```

2. Start the dev server:

```sh
pnpm dev
```

## Scripts

- `pnpm dev`: start dev server
- `pnpm build`: build for production
- `pnpm preview`: preview production build
- `pnpm check`: type-check and sync
- `pnpm lint`: lint + type-check
- `pnpm lint:fix`: auto-fix lint issues
- `pnpm format`: format code

## Notes

- All tools run locally in the browser; no data is sent to any server.
