# HTML Preview Tool Design

## Goal

Add a pure frontend tool that lets users paste HTML and preview the rendered result locally.

## Scope

- Add an `/html-preview` route with an input textarea and live preview.
- Render with an iframe using `sandbox` and `srcdoc` so pasted markup does not enter the PureTools DOM.
- Support static HTML and CSS preview, including common fragments such as tables.
- Do not execute user-provided scripts.
- Add the tool to the existing tool registry and homepage/navigation.

## Architecture

The page owns all state with Svelte 5 runes. The preview document is a derived string that wraps the user's fragment in a minimal HTML shell and injects a small base stylesheet for readable default rendering.

The iframe uses `sandbox=""`, which prevents script execution, form submission, top navigation, and same-origin access. This keeps the preview isolated while still allowing normal static layout rendering through `srcdoc`.

## UI

- Toolbar actions: load example, clear.
- Left panel: HTML input textarea with character and line counts.
- Right panel: sandboxed preview iframe.
- Empty state: lightweight placeholder inside the iframe shell.

## Verification

- Run `bun run lint:fix`.
- Run `bun run check`.

