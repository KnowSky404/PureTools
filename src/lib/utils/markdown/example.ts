/**
 * Small default content used on first visit. Keeping this example free of
 * optional syntax means opening the tool does not eagerly exercise Mermaid or
 * math rendering.
 */
export const DEFAULT_MARKDOWN_EXAMPLE = `# Markdown Previewer

Write Markdown on the left and see a local preview on the right.

- CommonMark headings, lists, links, and code are supported.
- Enhanced mode adds GFM and document extensions when you need them.

> Your source stays in this page and is never uploaded.

\`\`\`ts
const message = "Hello, PureTools!";
console.log(message);
\`\`\``;

/**
 * A richer opt-in sample for the Example button. It intentionally exercises
 * the syntax users are most likely to want to verify without making it the
 * default render path.
 */
export const COMPREHENSIVE_MARKDOWN_EXAMPLE = `---
title: Markdown Previewer example
---

# A practical Markdown document

This example covers **GFM**, [links](https://example.com), and an inline formula $a^2 + b^2 = c^2$.

> [!TIP]
> Enhanced mode keeps useful document extensions local and safe.

## Checklist

- [x] CommonMark paragraphs and emphasis
- [x] GFM table and task list
- [ ] Add your own content

| Feature | Enhanced | CommonMark |
| :-- | :--: | --: |
| GFM table | yes | no |
| Mermaid | yes | code |

## Code

\`\`\`typescript
type Preview = { source: string; warnings: string[] };
\`\`\`

## Diagram

\`\`\`mermaid
flowchart LR
  source[Markdown source] --> parser[Local parser]
  parser --> preview[Sandboxed preview]
\`\`\`

## Block formula

$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$

<details>
<summary>Static HTML details</summary>

This is a small, safe HTML element supported in Enhanced mode.
</details>`;
