import { defaultSchema, type Schema } from "hast-util-sanitize";

export { DEFAULT_MARKDOWN_LIMITS as LIMITS } from "./types";

/**
 * The parser emits user HTML only after this schema has removed active and
 * network-capable elements. Mermaid, KaTeX, and highlighting are filled into
 * slots afterwards by trusted application code.
 */
export const markdownSanitizeSchema: Schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), "target", "rel"],
    code: [...(defaultSchema.attributes?.code ?? [])],
    details: [
      ...(defaultSchema.attributes?.details ?? []),
      "open",
      ["className", /^markdown-frontmatter$/],
    ],
    div: [...(defaultSchema.attributes?.div ?? []), ["className", /^markdown-alert(?:$|-)/]],
    img: [...(defaultSchema.attributes?.img ?? []), "alt"],
    ol: [...(defaultSchema.attributes?.ol ?? [])],
    section: [...(defaultSchema.attributes?.section ?? [])],
    span: [...(defaultSchema.attributes?.span ?? [])],
    table: [...(defaultSchema.attributes?.table ?? [])],
    td: [...(defaultSchema.attributes?.td ?? [])],
    th: [...(defaultSchema.attributes?.th ?? [])],
    "*": [...(defaultSchema.attributes?.["*"] ?? [])],
  },
  // Anchors and absolute links are checked again after sanitization. Images
  // are converted to text placeholders before this schema runs.
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    src: [],
  },
  strip: [
    ...(defaultSchema.strip ?? []),
    "base",
    "embed",
    "form",
    "iframe",
    "link",
    "meta",
    "object",
    "script",
    "style",
  ],
  tagNames: [...(defaultSchema.tagNames ?? []), "mark"],
};

function hasUnsafeHrefCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (
      code <= 0x20 ||
      (code >= 0x7f && code <= 0x9f) ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069)
    ) {
      return true;
    }
  }
  return false;
}

export function isSafeMarkdownHref(value: string): boolean {
  const href = value.trim();
  if (!href || hasUnsafeHrefCharacters(href)) {
    return false;
  }
  let decoded = href;
  for (let index = 0; index < 2; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) {
        break;
      }
      decoded = next;
    } catch {
      return false;
    }
  }
  if (hasUnsafeHrefCharacters(decoded)) {
    return false;
  }
  if (decoded.startsWith("#")) {
    return true;
  }
  if (/^https?:\/\/[^/\s]+(?:\/[^\s]*)?$/i.test(decoded)) {
    return true;
  }
  if (/^mailto:[^\s]+$/i.test(decoded)) {
    return true;
  }
  return false;
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}
