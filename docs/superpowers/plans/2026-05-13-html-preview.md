# HTML Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local HTML preview tool that renders pasted static HTML in a sandboxed iframe.

**Architecture:** Create an independent Svelte route at `/html-preview`. Keep state in the page component, derive iframe `srcdoc` from the input, and register the tool in the existing `tools` list.

**Tech Stack:** Svelte 5 runes, TypeScript, Tailwind CSS, Bun, Biome.

---

### Task 1: Add Page And Navigation

**Files:**
- Create: `src/routes/html-preview/+page.svelte`
- Modify: `src/lib/utils/tools.ts`
- Modify: `log.md`

- [x] **Step 1: Create the Svelte page**

Create a page with textarea input, example/clear actions, stats, and an iframe preview using `sandbox=""` and `srcdoc`.

- [x] **Step 2: Register the tool**

Add `HTML Previewer` to the `Formatters` category in `src/lib/utils/tools.ts`.

- [x] **Step 3: Update the project log**

Append a short 2026-05-13 entry describing the new tool.

- [x] **Step 4: Verify formatting and type checks**

Run:

```bash
bun run lint:fix
bun run check
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

Stage the page, registry, docs, and `log.md`, then commit with:

```bash
git commit -m "feat: add html preview tool"
```
